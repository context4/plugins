import { lstat, mkdir, readdir, readFile, rename, rm, writeFile, open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { digest, validHash, validId, validPath } from "./content.mjs";

export async function exists(file) {
  try { return await lstat(file); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
export async function safeAncestors(file) {
  for (let cursor = path.resolve(file); ; cursor = path.dirname(cursor)) {
    if ((await exists(cursor))?.isSymbolicLink()) throw new Error(`Symlink destination rejected: ${cursor}`);
    if (cursor === path.dirname(cursor)) break;
  }
}
const receiptName = ".context4-skills.json";
const lockName = ".context4-skills.lock";
function fail() { throw new Error("Invalid ownership receipt"); }
export function validateReceipt(value) {
  if (!value || ![1, 2].includes(value.schemaVersion)) fail();
  if (value.schemaVersion === 1) {
    if (!value.files || typeof value.files !== "object" || Array.isArray(value.files)) fail();
    for (const [file, hash] of Object.entries(value.files)) if (!validPath(file) || !file.includes("/") || !validId(file.split("/")[0]) || !validHash(hash)) fail();
    if (!["en", "ru"].includes(value.language) || typeof value.version !== "string") fail();
    const skills = {};
    for (const [file, hash] of Object.entries(value.files)) {
      const [id, ...parts] = file.split("/");
      skills[id] ??= { version: value.version, locale: value.language, source: { status: "legacy-unresolved" }, dependencies: {}, files: {} };
      skills[id].files[parts.join("/")] = hash;
    }
    return validateReceipt({ schemaVersion: 2, roots: Object.keys(skills).sort(), host: "legacy", skills });
  }
  if (!Array.isArray(value.roots) || new Set(value.roots).size !== value.roots.length || !value.skills || typeof value.skills !== "object" || Array.isArray(value.skills) || typeof value.host !== "string") fail();
  for (const id of value.roots) if (!validId(id) || !Object.hasOwn(value.skills, id)) fail();
  for (const [id, skill] of Object.entries(value.skills)) {
    if (!validId(id) || typeof skill.version !== "string" || !["en", "ru"].includes(skill.locale) || !skill.files || typeof skill.files !== "object" || Array.isArray(skill.files) || !Object.hasOwn(skill.files, "SKILL.md") || !skill.dependencies || typeof skill.dependencies !== "object" || Array.isArray(skill.dependencies)) fail();
    for (const [file, hash] of Object.entries(skill.files)) if (!validPath(file) || !validHash(hash)) fail();
    const source = skill.source;
    if (source?.status !== "legacy-unresolved" && (typeof source?.release !== "string" || typeof source?.repository !== "string" || !validHash(source?.digest))) fail();
    for (const [dependency, version] of Object.entries(skill.dependencies)) if (!validId(dependency) || value.skills[dependency]?.version !== version) fail();
  }
  const seen = new Set(), active = new Set();
  function visit(id) {
    if (active.has(id)) fail();
    if (seen.has(id)) return;
    active.add(id);
    for (const dependency of Object.keys(value.skills[id].dependencies)) visit(dependency);
    active.delete(id); seen.add(id);
  }
  for (const id of value.roots) visit(id);
  if (seen.size !== Object.keys(value.skills).length) fail();
  return value;
}
export async function readReceipt(target) {
  const file = path.join(target, receiptName); await safeAncestors(file);
  if (!(await exists(file))) return null;
  if (!(await lstat(file)).isFile()) fail();
  return validateReceipt(JSON.parse(await readFile(file, "utf8")));
}
export async function verifyOwned(target, receipt) {
  for (const [id, skill] of Object.entries(receipt?.skills ?? {})) {
    const found = new Set();
    async function visit(directory, prefix = "") {
      await safeAncestors(directory);
      if (!(await exists(directory))?.isDirectory()) throw new Error(`Local changes conflict: ${id}/${prefix}`);
      for (const item of await readdir(directory, { withFileTypes: true })) {
        const relative = prefix + item.name, file = path.join(directory, item.name);
        if (item.isSymbolicLink()) throw new Error(`Symlink rejected: ${file}`);
        if (item.isDirectory()) await visit(file, relative + "/");
        else if (!item.isFile() || !Object.hasOwn(skill.files, relative) || digest(await readFile(file)) !== skill.files[relative]) throw new Error(`Local changes conflict: ${id}/${relative}`);
        else found.add(relative);
      }
    }
    await visit(path.join(target, id));
    if (found.size !== Object.keys(skill.files).length) throw new Error(`Local changes conflict: ${id} has missing files`);
  }
}
async function durableJson(file, value) {
  const handle = await open(file, "w", 0o600);
  try { await handle.writeFile(JSON.stringify(value, null, 2) + "\n"); await handle.sync(); } finally { await handle.close(); }
}
function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== "ESRCH"; }
}
function validOwner(value) {
  return value && Number.isSafeInteger(value.pid) && value.pid > 0 && typeof value.nonce === "string" && value.nonce.length > 0;
}
async function restore(target, lock, journal) {
  if (journal?.schemaVersion !== 1 || !Array.isArray(journal.ids) || journal.ids.some((id) => !validId(id)) || new Set(journal.ids).size !== journal.ids.length || !Array.isArray(journal.previousIds) || journal.previousIds.some((id) => !journal.ids.includes(id)) || typeof journal.hadReceipt !== "boolean") throw new Error("Invalid installation recovery journal");
  if (journal.committed === true) return;
  for (const id of journal.ids) {
    const backup = path.join(lock, "backup", id), destination = path.join(target, id);
    await safeAncestors(backup); await safeAncestors(destination);
    if (await exists(backup)) { await rm(destination, { recursive: true, force: true }); await rename(backup, destination); }
    else if (!journal.previousIds.includes(id)) await rm(destination, { recursive: true, force: true });
  }
  const receipt = path.join(target, receiptName), backup = path.join(lock, "previous-receipt.json");
  await safeAncestors(receipt); await safeAncestors(backup);
  if (journal.hadReceipt) await writeFile(receipt, await readFile(backup), { mode: 0o600 });
  else await rm(receipt, { force: true });
}
export async function acquire(target, hooks = {}) {
  const lock = path.join(target, lockName);
  await safeAncestors(lock);
  if (await exists(lock)) {
    const owner = path.join(lock, "owner.json"), journalFile = path.join(lock, "journal.json");
    await safeAncestors(owner); await safeAncestors(journalFile);
    if (!(await exists(owner))) throw new Error(`Another Context4 operation or legacy lock exists: ${lock}; inspect backup, staging and ownership receipt before removing the lock`);
    const metadata = JSON.parse(await readFile(owner, "utf8"));
    if (!validOwner(metadata)) throw new Error(`Invalid Context4 lock owner: ${lock}; inspect backup, staging and ownership receipt`);
    if (alive(metadata.pid)) throw new Error(`Another Context4 operation is running: ${lock}; inspect backup, staging and ownership receipt`);
    try { await mkdir(path.join(lock, "recovering")); } catch (error) { if (error.code === "EEXIST") throw new Error(`Another recovery or interrupted recovery needs inspection: ${lock}`); throw error; }
    if (typeof hooks.onRecoveryClaim === "function") await hooks.onRecoveryClaim({ lock, owner, metadata });
    if (!(await exists(owner))) throw new Error(`Lock owner disappeared during recovery: ${lock}; inspect backup, staging and ownership receipt`);
    const claimed = JSON.parse(await readFile(owner, "utf8"));
    if (!validOwner(claimed) || claimed.pid !== metadata.pid || claimed.nonce !== metadata.nonce) throw new Error(`Lock owner changed during recovery: ${lock}; inspect backup, staging and ownership receipt`);
    if (alive(claimed.pid)) throw new Error(`Lock owner became active during recovery: ${lock}; inspect backup, staging and ownership receipt`);
    if (await exists(journalFile)) await restore(target, lock, JSON.parse(await readFile(journalFile, "utf8")));
    await rm(lock, { recursive: true });
  }
  try { await mkdir(lock); } catch (error) { if (error.code === "EEXIST") throw new Error(`Another Context4 operation is running: ${lock}`); throw error; }
  await durableJson(path.join(lock, "owner.json"), { pid: process.pid, nonce: randomUUID() });
  return lock;
}
export async function transact(target, lock, previous, next, replacements, progress) {
  const changed = Object.keys(replacements).sort();
  const journal = { schemaVersion: 1, ids: changed, previousIds: changed.filter((id) => Object.hasOwn(previous?.skills ?? {}, id)), hadReceipt: Boolean(await exists(path.join(target, receiptName))), committed: false };
  await mkdir(path.join(lock, "backup")); await mkdir(path.join(lock, "staging"));
  if (journal.hadReceipt) await writeFile(path.join(lock, "previous-receipt.json"), await readFile(path.join(target, receiptName)), { mode: 0o600 });
  for (const [id, files] of Object.entries(replacements)) if (files) for (const [name, bytes] of Object.entries(files)) {
    const file = path.join(lock, "staging", id, name); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes);
  }
  await durableJson(path.join(lock, "next-receipt.json"), next);
  await durableJson(path.join(lock, "journal.json"), journal);
  try {
    for (const id of changed) {
      const destination = path.join(target, id);
      await safeAncestors(destination);
      if (await exists(destination)) await rename(destination, path.join(lock, "backup", id));
      progress(`Backing up ${id}`);
      if (replacements[id]) await rename(path.join(lock, "staging", id), destination);
      progress(`Installing ${id}`);
    }
    if (Object.keys(next.skills).length) await rename(path.join(lock, "next-receipt.json"), path.join(target, receiptName));
    else await rm(path.join(target, receiptName), { force: true });
    progress("Recording ownership receipt");
    // Atomic marker distinguishes a fully installed receipt from rollback work.
    await durableJson(path.join(lock, "committed.tmp"), { ...journal, committed: true });
    await rename(path.join(lock, "committed.tmp"), path.join(lock, "journal.json"));
  } catch (error) {
    await restore(target, lock, journal);
    await durableJson(path.join(lock, "journal.json"), { ...journal, rolledBack: true });
    throw error;
  }
}
