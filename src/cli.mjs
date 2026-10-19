#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ids, skillFiles, version } from "./content.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function exists(file) {
  try {
    return await lstat(file);
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
async function safeAncestors(file) {
  for (let p = path.resolve(file); ; p = path.dirname(p)) {
    const stat = await exists(p);
    if (stat?.isSymbolicLink())
      throw new Error(`Symlink destination rejected: ${p}`);
    if (p === path.dirname(p)) break;
  }
}
export async function run(
  args,
  { cwd = process.cwd(), home = os.homedir(), onProgress = () => {} } = {},
) {
  const help =
    "context4-skills <install|update|remove|list> --agent <codex|claude|cursor|hermes|openclaw> [--global] [--lang en|ru] [--dir path]";
  const [command, ...flags] = args;
  if (command === "--help" || !command) return help;
  if (!["install", "update", "remove", "list"].includes(command))
    throw new Error(help);
  let agent,
    directory,
    global = false,
    language = "en";
  const seen = new Set();
  for (let i = 0; i < flags.length; i++) {
    const flag = flags[i];
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === "--global") global = true;
    else if (flag === "--codex") agent = "codex";
    else if (["--agent", "--dir", "--lang"].includes(flag)) {
      const value = flags[++i];
      if (!value || value.startsWith("--"))
        throw new Error(`Missing value for ${flag}`);
      if (flag === "--agent") agent = value;
      if (flag === "--dir") directory = value;
      if (flag === "--lang") language = value;
    } else throw new Error(`Unknown option: ${flag}`);
  }
  if (!["en", "ru"].includes(language))
    throw new Error("Supported languages: en, ru");
  const locations = {
    codex: [".agents/skills", ".agents/skills"],
    claude: [".claude/skills", ".claude/skills"],
    cursor: [".cursor/skills", ".cursor/skills"],
    hermes: [null, ".hermes/skills"],
    openclaw: ["skills", ".openclaw/skills"],
  };
  if (seen.has("--codex") && seen.has("--agent"))
    throw new Error("Choose --agent or --codex, not both");
  if (agent && !locations[agent])
    throw new Error(`Unsupported agent: ${agent}`);
  if (directory && global)
    throw new Error("Choose --dir or --global, not both");
  if (command === "list") return JSON.stringify(ids, null, 2);
  if (!agent && !directory)
    throw new Error("Choose an explicit --agent or --dir");
  const location = locations[agent]?.[global ? 1 : 0];
  if (!directory && !location)
    throw new Error(`${agent} requires --global or an explicit --dir`);
  const base = await realpath(global ? home : cwd);
  const target = directory
    ? path.resolve(base, directory)
    : path.join(base, location);
  onProgress(`Preparing ${command} in ${target}`);
  await safeAncestors(target);
  if (command === "remove" && !(await exists(target)))
    return "No Context4 installation found.";
  await mkdir(target, { recursive: true });
  const lock = path.join(target, ".context4-skills.lock");
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        `Another Context4 skills operation is running in this directory. ` +
          `If no operation is running, inspect ${lock}, including ` +
          `${path.join(lock, "backup")} and ${path.join(lock, "staging")}, ` +
          "reconcile the skills and ownership receipt, then remove the lock.",
      );
    throw error;
  }
  try {
    const receiptPath = path.join(target, ".context4-skills.json");
    await safeAncestors(receiptPath);
    let receipt = null;
    try {
      receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    if (
      receipt &&
      (receipt.schemaVersion !== 1 ||
        !receipt.files ||
        Array.isArray(receipt.files) ||
        typeof receipt.files !== "object" ||
        Object.entries(receipt.files).some(
          ([f, h]) =>
            !ids.includes(f.split("/")[0]) ||
            f.split("/").some((s) => !s || s === "." || s === "..") ||
            f.includes("\\") ||
            !/^[a-f0-9]{64}$/.test(h),
        ))
    )
      throw new Error("Invalid ownership receipt");
    if (!receipt && command === "remove")
      return "No Context4 installation found.";
    const files = command === "remove" ? {} : await skillFiles(language);
    for (const id of ids) {
      const dir = path.join(target, id);
      await safeAncestors(dir);
      if (!receipt && (await exists(dir)))
        throw new Error(`Existing skill is not owned by this package: ${id}`);
      async function check(dir, prefix) {
        if (!(await exists(dir))) return;
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          const key = `${prefix}/${entry.name}`;
          if (entry.isSymbolicLink())
            throw new Error(`Symlink rejected: ${key}`);
          if (entry.isDirectory()) await check(path.join(dir, entry.name), key);
          else if (
            !receipt?.files[key] ||
            hash(await readFile(path.join(dir, entry.name))) !==
              receipt.files[key]
          )
            throw new Error(`Local changes conflict: ${key}`);
        }
      }
      await check(dir, id);
    }
    for (const [name, digest] of Object.entries(receipt?.files ?? {})) {
      await safeAncestors(path.join(target, name));
      if (
        !(await exists(path.join(target, name))) ||
        hash(await readFile(path.join(target, name))) !== digest
      )
        throw new Error(`Local changes conflict: ${name}`);
    }
    const staging = path.join(lock, "staging");
    const backup = path.join(lock, "backup");
    await mkdir(staging);
    await mkdir(backup);
    for (const [name, bytes] of Object.entries(files)) {
      const dest = path.join(staging, name);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, bytes);
    }
    const moved = [];
    const installed = [];
    try {
      for (const id of ids) {
        if (await exists(path.join(target, id))) {
          await rename(path.join(target, id), path.join(backup, id));
          moved.push(id);
        }
        if (await exists(path.join(staging, id))) {
          await rename(path.join(staging, id), path.join(target, id));
          installed.push(id);
        }
      }
      if (command === "remove") await rm(receiptPath);
      else {
        const nextReceipt = path.join(lock, "receipt.json");
        await writeFile(
          nextReceipt,
          JSON.stringify(
            {
              schemaVersion: 1,
              language,
              version,
              files: Object.fromEntries(
                Object.entries(files).map(([k, v]) => [k, hash(v)]),
              ),
            },
            null,
            2,
          ) + "\n",
        );
        await rename(nextReceipt, receiptPath);
      }
    } catch (error) {
      for (const id of installed)
        await rm(path.join(target, id), { recursive: true, force: true });
      for (const id of moved)
        await rename(path.join(backup, id), path.join(target, id));
      throw error;
    }
    return command === "remove"
      ? "Context4 skills removed."
      : `Context4 skills installed in ${target}. Restart your agent or start a new conversation. MCP authorization is separate.`;
  } finally {
    await rm(lock, { recursive: true });
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(await realpath(process.argv[1])).href
) {
  run(process.argv.slice(2), { onProgress: console.log })
    .then(console.log)
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
