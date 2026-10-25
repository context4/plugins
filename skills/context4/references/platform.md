# Platform

Use the application's existing identity, tenant, authenticated execution path and model/framework. Read [SDK compatibility](@@CONTEXT4_DOCS_ORIGIN@@/docs/composio-sdk.md) before choosing a package/version. Composio SDK base URL: `@@CONTEXT4_COMPAT_URL@@`; native API: `@@CONTEXT4_API_ORIGIN@@/v1`.

Read [OpenAPI](@@CONTEXT4_DOCS_ORIGIN@@/docs/openapi.json) and [compat routes](@@CONTEXT4_DOCS_ORIGIN@@/docs/compat-routes.json). Use credentials from the application's normal secret mechanism; never ask for or print them in chat. Do not run Composio login/dev-init, create a Composio cloud project, introduce a Context4 SDK/CLI, or copy cloud-only capabilities.

Sessions, proxy, errors and identifiers have their own documented shapes. Preserve user IDs and account mapping; never share one example user across tenants. Create auth configs only when the integration actually requires them. Validate a requested integration through its real execution path when the user has authorized that operation; documentation alone is not proof.
