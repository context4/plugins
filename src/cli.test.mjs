import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
  access,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { run } from "./cli.mjs";

async function sandbox(action) {
  const base = await mkdtemp(path.join(os.tmpdir(), "ctx4-install-"));
  const cwd = path.join(base, "project"),
    home = path.join(base, "home");
  await mkdir(cwd);
  await mkdir(home);
  try {
    await action({ cwd, home });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}
test("every agent installs to its documented project or global directory", async () => {
  const cases = [
    ["codex", false, ".agents/skills"],
    ["codex", true, ".agents/skills"],
    ["claude", false, ".claude/skills"],
    ["claude", true, ".claude/skills"],
    ["cursor", false, ".cursor/skills"],
    ["cursor", true, ".cursor/skills"],
    ["hermes", true, ".hermes/skills"],
    ["openclaw", false, "skills"],
    ["openclaw", true, ".openclaw/skills"],
  ];
  for (const [agent, global, dir] of cases)
    await sandbox(async (options) => {
      const flags = ["--agent", agent, ...(global ? ["--global"] : [])];
      await run(["install", ...flags], options);
      const root = path.join(global ? options.home : options.cwd, dir);
      assert.match(
        await readFile(path.join(root, "context4/SKILL.md"), "utf8"),
        /https:\/\/ctx4.me\/mcp/,
      );
      await run(["update", ...flags], options);
      await run(["remove", ...flags], options);
      await assert.rejects(access(path.join(root, "context4/SKILL.md")));
    });
});
test("repeat installation and locale update retain byte ownership and unrelated skills", async () =>
  sandbox(async (o) => {
    const flags = ["--agent", "claude"];
    await run(["install", ...flags], o);
    await run(["install", ...flags], o);
    const root = path.join(o.cwd, ".claude/skills");
    await mkdir(path.join(root, "other"));
    await writeFile(path.join(root, "other/SKILL.md"), "untouched");
    await run(["update", ...flags, "--lang", "ru"], o);
    const receipt = JSON.parse(
      await readFile(path.join(root, ".context4-skills.json"), "utf8"),
    );
    assert.equal(receipt.schemaVersion, 2);
    for (const skill of Object.values(receipt.skills)) assert.equal(skill.locale, "ru");
    for (const skill of Object.values(receipt.skills)) assert.equal(skill.version, "1.3.0");
    await run(["remove", ...flags], o);
    assert.equal(
      await readFile(path.join(root, "other/SKILL.md"), "utf8"),
      "untouched",
    );
  }));
test("modified, deleted and added files prevent both update and removal before mutation", async () => {
  for (const kind of ["modified", "deleted", "added"])
    await sandbox(async (o) => {
      await run(["install", "--codex"], o);
      const root = path.join(o.cwd, ".agents/skills");
      const file = path.join(root, "context4/SKILL.md");
      const sibling = await readFile(
        path.join(root, "context4-setup/SKILL.md"),
      );
      if (kind === "modified") await writeFile(file, "local edit");
      if (kind === "deleted") await rm(file);
      if (kind === "added")
        await writeFile(
          path.join(root, "context4/local.txt"),
          "local addition",
        );
      await assert.rejects(run(["update", "--codex"], o), /Local changes/);
      await assert.rejects(run(["remove", "--codex"], o), /Local changes/);
      assert.deepEqual(
        await readFile(path.join(root, "context4-setup/SKILL.md")),
        sibling,
      );
    });
});
test("unowned installs, destination symlinks, receipt traversal and locks fail safely", async () => {
  await sandbox(async (o) => {
    await mkdir(path.join(o.cwd, ".agents/skills/context4"), {
      recursive: true,
    });
    await assert.rejects(run(["install", "--codex"], o), /not owned/);
  });
  await sandbox(async (o) => {
    await mkdir(path.join(o.cwd, ".agents"));
    await symlink(o.home, path.join(o.cwd, ".agents/skills"));
    await assert.rejects(run(["install", "--codex"], o), /Symlink/);
  });
  await sandbox(async (o) => {
    const dir = path.join(o.cwd, "custom");
    await mkdir(dir);
    await writeFile(
      path.join(dir, ".context4-skills.json"),
      JSON.stringify({
        schemaVersion: 1,
        files: { "../escape": "a".repeat(64) },
      }),
    );
    await assert.rejects(
      run(["install", "--dir", "custom"], o),
      /Invalid ownership/,
    );
    await rm(path.join(dir, ".context4-skills.json"));
    await mkdir(path.join(dir, ".context4-skills.lock"));
    await assert.rejects(run(["install", "--dir", "custom"], o), (error) => {
      assert.match(error.message, /Another Context4/);
      assert.match(error.message, /\.context4-skills\.lock/);
      assert.match(error.message, /backup/);
      assert.match(error.message, /staging/);
      assert.match(error.message, /ownership receipt/);
      return true;
    });
    await access(path.join(dir, ".context4-skills.lock"));
  });
});
test("explicit custom path works; unsupported or ambiguous invocations do not write", async () =>
  sandbox(async (o) => {
    await run(["install", "--dir", "custom", "--lang", "ru"], o);
    await access(path.join(o.cwd, "custom/context4/SKILL.md"));
    for (const args of [
      ["install"],
      ["install", "--agent", "missing"],
      ["install", "--agent", "hermes"],
      ["install", "--agent"],
      ["install", "--dir", "x", "--global"],
      ["install", "--codex", "--lang", "xx"],
      ["install", "--codex", "--global", "--global"],
    ])
      await assert.rejects(run(args, o));
    assert.deepEqual(JSON.parse(await run(["list"], o)), [
      "context4",
      "context4-setup",
      "context4-workflows",
    ]);
  }));
