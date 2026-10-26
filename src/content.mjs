import { readFile, lstat, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const validId = (id) => typeof id === "string" && /^[a-z0-9][a-z0-9-]*$/.test(id);
export const validPath = (name) => typeof name === "string" && !name.includes("\\") && name.split("/").every((part) => part && part !== "." && part !== "..") && !/^[a-z]:/i.test(name);
export const validHash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
export const contentHash = (value) => digest(JSON.stringify(canonical(value)));
export function bind(text) {
  return text
    .replaceAll("@@CONTEXT4_DOCS_ORIGIN@@", "https://ctx4.me")
    .replaceAll("@@CONTEXT4_MCP_URL@@", "https://ctx4.me/mcp")
    .replaceAll("@@CONTEXT4_API_ORIGIN@@", "https://ctx4.me")
    .replaceAll("@@CONTEXT4_CONSOLE_URL@@", "https://ctx4.me/integrations")
    .replaceAll(
      "@@CONTEXT4_COMPAT_URL@@",
      "https://ctx4.me/compat/context4/v1",
    );
}
export function resolveSkills(source, roots) {
  const resolved = new Set(), visiting = new Set();
  function visit(id) {
    if (visiting.has(id)) throw new Error(`Dependency cycle: ${id}`);
    if (resolved.has(id)) return;
    const skill = source.catalog.find((item) => item.id === id);
    if (!skill) throw new Error(`Unknown skill: ${id}`);
    visiting.add(id);
    for (const dependency of Object.keys(skill.dependencies)) visit(dependency);
    visiting.delete(id); resolved.add(id);
  }
  for (const id of roots) visit(id);
  return [...resolved].sort();
}
export function validateLibrary(source) {
  if (source?.schemaVersion !== 1 || typeof source.release !== "string" || !Array.isArray(source.catalog) || !source.catalog.length || !source.files || typeof source.files !== "object") throw new Error("Invalid skill source snapshot");
  const ids = new Set(), allowed = new Set();
  for (const skill of source.catalog) {
    if (!validId(skill.id) || ids.has(skill.id) || typeof skill.version !== "string" || !Array.isArray(skill.files) || !skill.files.includes("SKILL.md") || new Set(skill.files).size !== skill.files.length || skill.files.some((file) => !validPath(file))) throw new Error("Invalid skill catalog");
    ids.add(skill.id);
    if (!skill.dependencies || typeof skill.dependencies !== "object" || Array.isArray(skill.dependencies)) throw new Error(`Invalid dependencies: ${skill.id}`);
  }
  for (const skill of source.catalog) {
    for (const [id, version] of Object.entries(skill.dependencies)) if (source.catalog.find((item) => item.id === id)?.version !== version) throw new Error(`Missing or incompatible dependency: ${skill.id} -> ${id}`);
    for (const language of ["en", "ru"]) for (const file of skill.files) {
      const key = `${language}/${skill.id}/${file}`; allowed.add(key);
      if (typeof source.files[key] !== "string") throw new Error(`Missing translation or source: ${key}`);
    }
  }
  if (Object.keys(source.files).some((name) => !allowed.has(name))) throw new Error("Unexpected source snapshot file");
  const { sourceDigest, ...body } = source;
  if (!validHash(sourceDigest) || contentHash(body) !== sourceDigest) throw new Error("Source snapshot integrity mismatch");
  resolveSkills(source, [...ids]);
  return source;
}
export async function loadLibrary(directory = root) {
  const pkg = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"));
  const catalog = JSON.parse(await readFile(path.join(directory, "catalog.json"), "utf8"));
  const files = {};
  for (const skill of catalog) {
    if (!validId(skill.id) || !Array.isArray(skill.files)) throw new Error("Invalid skill catalog");
    for (const language of ["en", "ru"]) for (const file of skill.files) {
      if (!validPath(file)) throw new Error("Unsafe source path");
      const base = path.join(directory, language === "en" ? "skills" : "locales/ru");
      const target = path.join(base, skill.id, file);
      for (let cursor = target; cursor !== directory; cursor = path.dirname(cursor)) {
        if ((await lstat(cursor)).isSymbolicLink()) throw new Error(`Symlink source rejected: ${cursor}`);
        if (cursor === path.dirname(cursor)) break;
      }
      if (!(await lstat(target)).isFile()) throw new Error(`Source is not a regular file: ${target}`);
      files[`${language}/${skill.id}/${file}`] = await readFile(target, "utf8");
    }
  }
  let plugin;
  let hasPackaging = true;
  try { await lstat(path.join(directory, "packaging/context4")); }
  catch (error) { if (error.code === "ENOENT") hasPackaging = false; else throw error; }
  if (hasPackaging) {
    const manifests = {};
    for (const name of ["plugin.json", "mcp.json", ".mcp.json", ".claude-plugin/plugin.json"]) manifests[name] = await readFile(path.join(directory, "packaging/context4", name), "utf8");
    const assets = {};
    for (const entry of await readdir(path.join(directory, "assets"), {withFileTypes:true})) {
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Plugin assets must be regular files");
      assets[entry.name] = (await readFile(path.join(directory, "assets", entry.name))).toString("base64");
    }
    plugin = {manifests, assets};
  }
  const body = { schemaVersion: 1, release: pkg.version, repository: pkg.repository.url, catalog, files, ...(plugin ? {plugin} : {}) };
  return validateLibrary({ ...body, sourceDigest: contentHash(body) });
}
export async function readSnapshot(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Source snapshot must be a regular file");
  return validateLibrary(JSON.parse(await readFile(file, "utf8")));
}
export function filesForSkill(source, id, language = "en", render = true) {
  if (!["en", "ru"].includes(language)) throw new Error(`Unsupported language: ${language}`);
  const skill = source.catalog.find((item) => item.id === id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return Object.fromEntries(skill.files.map((file) => {
    const text = source.files[`${language}/${id}/${file}`];
    if (typeof text !== "string") throw new Error(`Missing translation: ${id}/${file}`);
    return [`${id}/${file}`, Buffer.from(render ? bind(text) : text)];
  }));
}
export const library = await loadLibrary();
export const version = library.release;
export const catalog = library.catalog;
export const ids = catalog.map((skill) => skill.id);
export async function skillFiles(language = "en", selected = ids, render = true) {
  return Object.assign({}, ...resolveSkills(library, selected).map((id) => filesForSkill(library, id, language, render)));
}
