import { readFile, readdir, mkdir, writeFile, rm, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { root, skillFiles, bind } from "./content.mjs";

async function tree(directory, prefix = "") {
  const files = {};
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const key = prefix + item.name, file = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error(`Symlink package input rejected: ${file}`);
    if (item.isDirectory()) Object.assign(files, await tree(file, key + "/"));
    else if (item.isFile()) files[key] = await readFile(file);
    else throw new Error(`Invalid package input: ${file}`);
  }
  return files;
}
export async function generatePlugins(check = false) {
  const files = await tree(path.join(root, "packaging/context4"));
  for (const name of ["plugin.json", "mcp.json", ".mcp.json", ".claude-plugin/plugin.json"]) files[name] = Buffer.from(bind(files[name].toString()));
  Object.assign(files, Object.fromEntries(Object.entries(await tree(path.join(root, "assets"))).map(([key, value]) => [`assets/${key}`, value])));
  Object.assign(files, Object.fromEntries(Object.entries(await skillFiles()).map(([key, value]) => [`skills/${key}`, value])));
  const destination = path.join(root, "plugins/context4");
  if ((await lstat(destination)).isSymbolicLink()) throw new Error("Symlink generated directory rejected");
  if (check) {
    const actual = await tree(destination);
    if (Object.keys(actual).length !== Object.keys(files).length || Object.entries(files).some(([name, bytes]) => !actual[name]?.equals(bytes))) throw new Error("Generated plugin drift; run npm run generate and commit the projection");
  } else {
    await rm(destination, { recursive: true });
    for (const [name, bytes] of Object.entries(files)) {
      const target = path.join(destination, name);
      await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes);
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generatePlugins(process.argv.includes("--check"));
  console.log("Generated plugin projection verified");
}
