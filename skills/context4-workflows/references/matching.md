# Matching and recovery

For CRM + calls, fetch relevant CRM entities and call records through discovered read tools. Match only documented phone/contact keys after normalizing the representation needed for the comparison. If multiple contacts match, ask or mark unresolved; do not pick the first.

For CRM + messaging, resolve the actual destination in the messaging service. A CRM contact ID is not a messaging recipient ID. Draft or send only what the user requested, through a discovered tool and authorized account.

For finance + sales, align time ranges, currency, account and entity definitions before comparing totals. A missing result or an incomplete page is not zero revenue.

Track the real execution ID/status for each requested write. Keep documented idempotency keys stable for the same logical operation. Do not claim a shared transaction or automatic rollback across providers. After unknown outcome, inspect execution and provider state before reissuing a mutation. Preserve a safe summary, not a local dump of personal records.
