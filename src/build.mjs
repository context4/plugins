import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { zipSync } from "fflate";
import { bind, ids, root, skillFiles } from "./content.mjs";

const out = path.resolve(process.argv[2] ?? path.join(root, "dist"));
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const canonical = path.join(root, "plugins/context4");
const archive = (files) =>
  zipSync(
    Object.fromEntries(
      Object.entries(files)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, bytes]) => [
          name,
          [bytes, { mtime: new Date(1980, 0, 1), level: 6 }],
        ]),
    ),
  );
const skills = await skillFiles();
const common = Object.fromEntries(
  Object.entries(skills).map(([name, bytes]) => [`skills/${name}`, bytes]),
);
for (const entry of await readdir(path.join(canonical, "assets"), {
  withFileTypes: true,
})) {
  if (!entry.isFile())
    throw new Error(`Asset must be a regular file: ${entry.name}`);
  common[`assets/${entry.name}`] = await readFile(
    path.join(canonical, "assets", entry.name),
  );
}
const manifest = JSON.parse(
  await readFile(path.join(root, "manifests/openai/plugin.json"), "utf8"),
);
const claude = JSON.parse(
  await readFile(path.join(canonical, ".claude-plugin/plugin.json"), "utf8"),
);
if (claude.version !== pkg.version)
  throw new Error("Claude plugin version must match package version");
manifest.version = pkg.version;
manifest.author = claude.author;
manifest.extensions["com.openai"].interface.developerName = claude.author.name;
const openai = {
  ...common,
  "plugin.json": Buffer.from(JSON.stringify(manifest, null, 2) + "\n"),
  "mcp.json": Buffer.from(
    bind(await readFile(path.join(root, "manifests/openai/mcp.json"), "utf8")),
  ),
};
const bundle = { ...common };
for (const name of [
  ".claude-plugin/plugin.json",
  ".mcp.json",
  "README.md",
  "LICENSE",
])
  bundle[name] = await readFile(path.join(canonical, name));
const artifacts = {
  "plugin.zip": archive(openai),
  "claude-plugin.zip": archive(bundle),
};
for (const language of ["en", "ru"]) {
  const files = await skillFiles(language);
  for (const id of ids)
    artifacts[`${id}${language === "ru" ? ".ru" : ""}.zip`] = archive(
      Object.fromEntries(
        Object.entries(files).filter(([name]) => name.startsWith(`${id}/`)),
      ),
    );
}
await mkdir(out, { recursive: true });
for (const [name, bytes] of Object.entries(artifacts))
  await writeFile(path.join(out, name), bytes);
await writeFile(
  path.join(out, "manifest.json"),
  JSON.stringify(
    {
      version: pkg.version,
      files: Object.fromEntries(
        Object.entries(artifacts).map(([name, bytes]) => [
          name,
          {
            sha256: createHash("sha256").update(bytes).digest("hex"),
            bytes: bytes.length,
          },
        ]),
      ),
    },
    null,
    2,
  ) + "\n",
);
console.log(`Built ${Object.keys(artifacts).length} archives in ${out}`);
