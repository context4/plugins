# Context4 plugins and skills

Connect AI clients to authorized business services through [Context4](https://ctx4.me). This repository contains three product skills, a Claude plugin and marketplace, OpenAI plugin metadata, and a local skills installer. It contains no service backend or account credentials.

## Claude Code plugin

```sh
claude plugin marketplace add context4/plugins
claude plugin install context4@context4
```

This installs the skills and declares `https://ctx4.me/mcp`. Complete browser OAuth when Claude asks. File installation and account authorization are separate steps.

## Skills installer

Requires Node.js 22+ and Git. Run in your project directory. The npm registry package is not published; these commands use the versioned GitHub source.

```sh
npx --yes --package=github:context4/plugins#v1.2.0 context4-skills install --agent claude
npx --yes --package=github:context4/plugins#v1.2.0 context4-skills install --agent codex
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
npx --yes --package=github:context4/plugins#v1.2.0 context4-skills install --agent hermes --global
npx --yes --package=github:context4/plugins#v1.2.0 context4-skills install --agent openclaw --global
npx --yes --package=github:context4/plugins#v1.2.0 context4-skills install --agent cursor --lang ru
npx --yes --package=github:context4/plugins#v1.2.0 context4-skills install --dir ./my-agent/skills
npx --yes --package=github:context4/plugins#v1.2.0 context4-skills update --agent claude
npx --yes --package=github:context4/plugins#v1.2.0 context4-skills remove --agent claude
```

Use the same destination flags for update and remove. `--lang en` is the default; `--lang ru` selects Russian instructions. To update the release, explicitly select a newer GitHub tag. Restart your agent after changing its skills.

The installer records hashes for its files and refuses to overwrite unowned directories or local edits, missing files, added files and symlink destinations. It does not change MCP configuration or create credentials. Use `--dir` for another agent's documented skill directory.

## Hosted Claude and ChatGPT

The CLI cannot install into a hosted account. [Releases](https://github.com/context4/plugins/releases) provide `claude-plugin.zip`, portable OpenAI `plugin.zip`, and individual English/Russian skill ZIPs. Use the client's supported upload flow. Claude directory submissions use this repository's `plugins/context4` folder. Directory approval is separate from personal installation.

For MCP access, configure `https://ctx4.me/mcp` and complete OAuth. [Client setup](https://ctx4.me/docs/agent-setup.md) explains authorization. Skills without a working connection cannot access services.

## Contents and maintenance

- `context4`: select accounts and discover exact tool schemas.
- `context4-setup`: configure a client and verify the first connection.
- `context4-workflows`: complete tasks across connected services.

Canonical English skills and the Claude plugin live in `plugins/context4`; Russian translations in `locales/ru`. The installer and archives use those same files. `manifests/openai` contains platform-specific metadata only.

```sh
npm ci
npm run check
claude plugin validate .
claude plugin validate plugins/context4
```

The release script produces eight deterministic ZIPs and SHA256 metadata in `dist`. Tests exercise real temporary directories, conflict protection and archive equality. `private:true` prevents accidental npm publication; it does not make this GitHub repository private.

The public package, installer and release tooling are MIT licensed. Existing skill licenses and upstream attribution are retained. Hosted use is governed by [terms](https://ctx4.me/terms) and [privacy](https://ctx4.me/privacy).

[Support](https://ctx4.me/support) · [Documentation](https://ctx4.me/docs/agent-setup.md).
