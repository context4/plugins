# Context4 MCP — business tools for your AI assistant

Context4 connects Codex and Claude Code to business services through accounts you authorize. This plugin includes the Context4 MCP connection and three skills: service discovery and execution, client setup, and workflows across connected services. Available actions depend on your account, workspace permissions and active provider connections.

**[Explore Context4 →](https://ctx4.me/?utm_source=github&utm_medium=plugin-readme&utm_campaign=mcp-presence)** · [Choose your AI client](https://ctx4.me/connect?utm_source=github&utm_medium=plugin-readme&utm_campaign=mcp-presence) · [Browse connectors](https://ctx4.me/apps?utm_source=github&utm_medium=plugin-readme&utm_campaign=mcp-presence)

[![Example requests for Context4](assets/examples.png)](https://ctx4.me/docs/business-cases?utm_source=github&utm_medium=plugin-readme&utm_campaign=mcp-presence)

## Connect

Install from the public marketplace:

```sh
codex plugin marketplace add context4/plugins
codex plugin add context4@context4
```

For Claude Code, use `claude plugin marketplace add context4/plugins` and `claude plugin install context4@context4`.

Restart the client and complete Context4 browser OAuth when requested. The remote MCP endpoint is https://ctx4.me/mcp. Sign in to the intended workspace, inspect the requested permissions, and select an authorized provider account. No API key or credential belongs in this package.

## Try it

- Show my connected accounts.
- Find overdue deals in my connected CRM and summarize next actions.
- Find records for a customer across my connected services.

Confirm the intended records and changes before a write operation. A missing connection or failed request is not a completed task. This package provides no payment or media-generation tools.

[Setup guide](https://ctx4.me/docs/agent-setup?utm_source=github&utm_medium=plugin-readme&utm_campaign=mcp-presence) · [Business workflows](https://ctx4.me/docs/business-cases?utm_source=github&utm_medium=plugin-readme&utm_campaign=mcp-presence) · [How data is handled](https://ctx4.me/docs/data-handling?utm_source=github&utm_medium=plugin-readme&utm_campaign=mcp-presence) · [Support](https://ctx4.me/support) · [Privacy](https://ctx4.me/privacy) · [Terms](https://ctx4.me/terms).

## License

MIT; skill licenses and attribution are retained in each skill directory. The license applies to packaged files; hosted service use is governed by the linked terms.
