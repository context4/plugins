import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { root, skillFiles } from "./content.mjs";

test("both plugin formats and localized skill archives share canonical bytes and reproducible hashes", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "ctx4-release-"));
  try {
    for (const name of ["one", "two"]) {
      const result = spawnSync(
        process.execPath,
        [path.join(root, "src/build.mjs"), path.join(temp, name)],
        { encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
    }
    const manifest = JSON.parse(
      await readFile(path.join(temp, "one/manifest.json"), "utf8"),
    );
    assert.equal(manifest.version, "1.3.0");
    const packageVersion = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ).version;
    for (const language of ["en", "ru"]) {
      const files = await skillFiles(language);
      for (const [name, bytes] of Object.entries(files)) {
        const text = bytes.toString();
        if (name.endsWith("/SKILL.md"))
          assert.match(text, new RegExp(`version: "${packageVersion}"`));
        if (name.endsWith("/ATTRIBUTION.md"))
          assert.match(text, new RegExp(`Context4 package ${packageVersion}`));
      }
    }
    for (const [name, facts] of Object.entries(manifest.files)) {
      const bytes = await readFile(path.join(temp, "one", name));
      assert.deepEqual(bytes, await readFile(path.join(temp, "two", name)));
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        facts.sha256,
      );
      assert.equal(bytes.length, facts.bytes);
    }
    const openai = unzipSync(await readFile(path.join(temp, "one/plugin.zip")));
    for (const name of ["plugin.json", "mcp.json"])
      assert.deepEqual(
        Buffer.from(openai[name]),
        await readFile(path.join(root, "plugins/context4", name)),
      );
    const portable = JSON.parse(Buffer.from(openai["plugin.json"]).toString());
    assert.equal(portable.version, manifest.version);
    assert.equal(portable.extensions["com.openai"].interface.displayName, "Context4");
    assert.ok(
      openai[portable.extensions["com.openai"].onboardingSkill.replace(/^\.\//, "")],
    );
    assert.equal(
      JSON.parse(Buffer.from(openai["mcp.json"]).toString()).mcpServers.context4.url,
      "https://ctx4.me/mcp",
    );
    const claude = unzipSync(
      await readFile(path.join(temp, "one/claude-plugin.zip")),
    );
    for (const [name, bytes] of Object.entries(await skillFiles())) {
      assert.deepEqual(Buffer.from(openai[`skills/${name}`]), bytes);
      assert.deepEqual(Buffer.from(claude[`skills/${name}`]), bytes);
      assert.doesNotMatch(
        bytes.toString(),
        /@@CONTEXT4_|https:\/\/context4\.me/,
      );
    }
    assert.equal(
      JSON.parse(Buffer.from(openai["mcp.json"]).toString()).mcpServers.context4
        .type,
      "streamable-http",
    );
    assert.equal(
      JSON.parse(Buffer.from(claude[".mcp.json"]).toString()).mcpServers
        .context4.type,
      "http",
    );
    assert.equal(
      JSON.parse(Buffer.from(claude[".claude-plugin/plugin.json"]).toString())
        .version,
      manifest.version,
    );
    assert.equal(openai[".app.json"], undefined);
    assert.equal(
      JSON.parse(Buffer.from(openai["plugin.json"]).toString()).extensions[
        "com.openai"
      ].apps,
      undefined,
    );
    for (const files of [openai, claude]) {
      assert.ok(files["assets/logo.png"].length > 0);
      assert.ok(
        Object.keys(files).every(
          (name) => !name.includes("upstream") && !name.includes("evals"),
        ),
      );
    }
    const ru = unzipSync(
      await readFile(path.join(temp, "one/context4.ru.zip")),
    );
    assert.deepEqual(
      Buffer.from(ru["context4/SKILL.md"]),
      (await skillFiles("ru"))["context4/SKILL.md"],
    );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
