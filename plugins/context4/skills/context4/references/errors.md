# Errors and recovery

Start with the tool result, request ID or execution ID. Identify whether the failure is MCP authentication, provider authorization, arguments, permissions or a provider operation; do not rotate unrelated credentials.

- `connection_required`: inspect accounts and request a server-provided link.
- `connection_ambiguous`: ask which eligible account to use.
- `authorization_pending`: wait using the actual connection ID and retry hints.
- `invalid_arguments`: fetch the current schema and correct arguments.
- `permission_denied`: explain the missing permission; do not try another account to evade it.
- `rate_limited`: follow retry hints and reduce work.
- Pending execution: use the actual returned execution mechanism. A global endpoint and a session may expose different tools; use only listed tools.
- Timeout or failed write: inspect the previous execution before retrying; a provider side effect may already exist.

Never invent a diagnosis from public docs alone. Keep secrets and private provider payloads out of support messages. [Troubleshooting](https://ctx4.me/docs/troubleshooting.md), [results](https://ctx4.me/docs/actions.md).
