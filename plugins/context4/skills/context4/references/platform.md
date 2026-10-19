# Platform

Use the application's existing identity, tenant, authenticated execution path and model/framework. Read [SDK compatibility](https://ctx4.me/docs/composio-sdk.md) before choosing a package/version. Composio SDK base URL: `https://ctx4.me/compat/context4/v1`; native API: `https://ctx4.me/v1`.

Read [OpenAPI](https://ctx4.me/docs/openapi.json) and [compat routes](https://ctx4.me/docs/compat-routes.json). Use credentials from the application's normal secret mechanism; never ask for or print them in chat. Do not run Composio login/dev-init, create a Composio cloud project, introduce a Context4 SDK/CLI, or copy cloud-only capabilities.

Sessions, proxy, errors and identifiers have their own documented shapes. Preserve user IDs and account mapping; never share one example user across tenants. Create auth configs only when the integration actually requires them. Validate a requested integration through its real execution path when the user has authorized that operation; documentation alone is not proof.
