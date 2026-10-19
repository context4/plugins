import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const version = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
).version;
export const catalog = JSON.parse(
  await readFile(path.join(root, "catalog.json"), "utf8"),
);
export const ids = catalog.map((skill) => skill.id);
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
export async function skillFiles(language = "en") {
  const files = {};
  for (const skill of catalog)
    for (const name of skill.files) {
      const key = `${skill.id}/${name}`;
      files[key] = Buffer.from(
        bind(
          await readFile(
            path.join(
              root,
              language === "ru" ? "locales/ru" : "plugins/context4/skills",
              key,
            ),
            "utf8",
          ),
        ),
      );
    }
  return files;
}
