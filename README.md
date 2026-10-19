# Context4 plugins and skills

Connect AI clients to authorized business services through [Context4](https://ctx4.me). This repository contains three product skills, a plugin and marketplace for Codex and Claude Code, OpenAI plugin metadata, and a local skills installer. It contains no service backend or account credentials.

## Codex plugin

```sh
codex plugin marketplace add context4/plugins
codex plugin add context4@context4
codex plugin list --json
```

Codex supports this repository's `.claude-plugin/marketplace.json` compatibility format. The installed plugin includes all three skills and the `https://ctx4.me/mcp` connection configuration. Restart Codex after installation and complete browser OAuth when it requests Context4 authorization. Installation does not grant access to a Context4 account by itself.

For a pinned installation, use `codex plugin marketplace add context4/plugins --ref v1.2.1` as the first command. Installation of this release was verified with an isolated Codex configuration: the plugin was installed and enabled, with all three skills and the MCP endpoint present. See the [OpenAI packaging documentation](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli) for marketplace support.

## Claude Code plugin

```sh
claude plugin marketplace add context4/plugins
claude plugin install context4@context4
```

This installs the skills and declares `https://ctx4.me/mcp`. Complete browser OAuth when Claude asks. File installation and account authorization are separate steps.

## Skills installer

Use the installer when you want skill files in a specific client directory. Requires Node.js 22+ and Git. Run in your project directory. The npm registry package is not published; these commands use the versioned GitHub source.

```sh
npx --yes --package=github:context4/plugins#v1.2.1 context4-skills install --agent claude
npx --yes --package=github:context4/plugins#v1.2.1 context4-skills install --agent codex
```

Add `--global` for your user account. Supported destinations:

| Agent | Project | Global |
|---|---|---|
| Claude Code | `.claude/skills` | `~/.claude/skills` |
| Codex | `.agents/skills` | `~/.agents/skills` |
| Cursor | `.cursor/skills` | `~/.cursor/skills` |
| Hermes | explicit `--dir` | `~/.hermes/skills` |
| OpenClaw | workspace `skills` | `~/.openclaw/skills` |

```sh
npx --yes --package=github:context4/plugins#v1.2.1 context4-skills install --agent hermes --global
npx --yes --package=github:context4/plugins#v1.2.1 context4-skills install --agent openclaw --global
npx --yes --package=github:context4/plugins#v1.2.1 context4-skills install --agent cursor --lang ru
npx --yes --package=github:context4/plugins#v1.2.1 context4-skills install --dir ./my-agent/skills
npx --yes --package=github:context4/plugins#v1.2.1 context4-skills update --agent claude
npx --yes --package=github:context4/plugins#v1.2.1 context4-skills remove --agent claude
```

Use the same destination flags for update and remove. `--lang en` is the default; `--lang ru` selects Russian instructions. To update the release, explicitly select a newer GitHub tag. Restart your agent after changing its skills.

The installer records hashes for its files and refuses to overwrite unowned directories or local edits, missing files, added files and symlink destinations. It does not change MCP configuration or create credentials. Use `--dir` for another agent's documented skill directory. If a process is interrupted, inspect the lock's backup, staging files, skill directories and ownership receipt before removing `.context4-skills.lock`; do not restore files blindly.

## Hosted Claude and ChatGPT

The CLI cannot install into a hosted account. [Releases](https://github.com/context4/plugins/releases) provide `claude-plugin.zip`, portable OpenAI `plugin.zip`, and individual English/Russian skill ZIPs. Use the client's supported upload flow. Claude directory submissions use this repository's `plugins/context4` folder. Directory approval is separate from personal installation.

For MCP access, configure `https://ctx4.me/mcp` and complete OAuth. [Client setup](https://ctx4.me/docs/agent-setup.md) explains authorization. Skills without a working connection cannot access services.

## Contents and maintenance

- `context4`: select accounts and discover exact tool schemas.
- `context4-setup`: configure a client and verify the first connection.
- `context4-workflows`: complete tasks across connected services.

Canonical English skills and both platform manifests live in `plugins/context4`; Russian translations in `locales/ru`. Codex reads the portable `plugin.json` and `mcp.json` directly from that directory, including its presentation and setup onboarding skill. The installer and archives use those same files. Claude Code uses the compatible `.claude-plugin/plugin.json` and `.mcp.json` in the same directory.

```sh
npm ci
npm run check
claude plugin validate .
claude plugin validate plugins/context4
```

The release script produces eight deterministic ZIPs and SHA256 metadata in `dist`. Tests exercise real temporary directories, conflict protection and archive equality. `private:true` prevents accidental npm publication; it does not make this GitHub repository private.

The public package, installer and release tooling are MIT licensed. Existing skill licenses and upstream attribution are retained. Hosted use is governed by [terms](https://ctx4.me/terms) and [privacy](https://ctx4.me/privacy).

[Support](https://ctx4.me/support) · [Documentation](https://ctx4.me/docs/agent-setup.md).
