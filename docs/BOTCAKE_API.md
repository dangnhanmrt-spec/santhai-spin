# Botcake voucher warehouse

Endpoint: https://stxymyjwxdtfxkvmsgmz.supabase.co/functions/v1/chatbot-voucher-issue
POST with Content-Type application/json and existing dedicated Bearer token (never commit plaintext).

## Request
```json
{"campaign_id":"BOTCAKE_TEST_20261126","prize_code":"TP10k","customer_id":"{{psid}}"}
```
Supported prize codes (case-sensitive): TP10k, x2TP, M2T1, Upsiz, 15%.
TRUOT does not allocate a voucher.
Test campaign: BOTCAKE_TEST_20261126. Live campaign: BOTCAKE_LIVE.
Each campaign/prize has an independent pool. Live pools initially contain no codes; import real POS codes before use. No fallback from live to test or another prize.

Save response path voucher_code into the text custom field Voucher (3188938). Use that field in the subsequent message. Botcake's actual PSID variable is {{psid}}, verified with delivered Messenger messages; {{user.id}} was not substituted in this integration.

Success returns status success, voucher_code, replayed, is_test, prize_code. Empty/disabled/expired pools return an empty voucher_code and a business status. Authentication and input failures return non-2xx.

No event_id means a fresh allocation on every call. Optional event_id allows same-customer same-event replay without consuming another code; it must differ for each new win. Retries without this key can consume extra codes.

Flow: JSON API -> message using Voucher -> unsubscribe from prize sequence. Before public launch add field clearing and error branches to prevent stale/blank messages on failed requests; current Botcake flow is a functional test. Do not infer load readiness from these functional tests.

## Verification
17 unit tests and production build passed. Live API test covers every test/live prize mapping; test codes are unique across pools. Test-only QA allocations are reset by exact synthetic customer/event; actual customer allocations remain untouched.

## Stock gate and mapped backup
POST to the same endpoint with `{"action":"check_stock","campaign_id":"BOTCAKE_TEST_20261126"}` and the existing Bearer token. This is read-only and does not require customer_id. Map `stock_gate` to a dedicated text custom field; compare exactly with `OPEN`. Result is `OPEN` with 0–2 empty primary pools; `CLOSED` with 3–5. Backup inventory never contributes. Invalid/disabled configuration fails closed. API failures/retry behavior in Botcake remain a separate follow-up review.

Each primary pool has one backup linked via `backup_for`, with the same prize and test/live mode. Backup campaigns end in `_BACKUP` and cannot be addressed through the public issuance allowlist. Import real backup codes through the warehouse selector. Existing issuance requests remain unchanged: primary first, mapped backup only when primary is empty. Already-granted spins can issue regardless of the entrance gate. Both allocation and fallback happen in one transaction with a per-primary lock. Explicit event retries find the original allocation in either pool; Botcake requests without event_id still allocate per invocation.

The optimized prize flows end after the voucher message; no unsubscribe action is needed. The entrance closed message should say the wheel has closed, not that every voucher has been issued.

### Saved Botcake entrance flow
Flow `444794176` (Mở vòng quay): Kiểm tra mã → Điều kiện #3 → Còn mã / Hết mã. API path `stock_gate` maps to text field `3228400` (Trang thai kho vong quay); condition is exactly `OPEN`. Published and reopened in a fresh tab to verify. Uses TEST campaign until real stock is imported and launch is requested. No unsubscribe action. Channel button restoration awaits the lost destination URL. Each test backup pool has 10 random five-character test codes; real backup pools remain empty.

Database integration checks are in `tests/chatbotStock.integration.sql`; all fixtures roll back. They cover 2/5 open, 3/5 closed, main priority, mapped backup after entrance closes, same-event replay across backup, no cross-prize fallback, and service-role-only execution. Run via a trusted SQL administration connection, not a browser client.

## Warehouse administration (2026-11-29)

- Owner: confirmed Google account dangnhan.mrt@gmail.com. Owner can grant manager/viewer by email. Roles are checked on the server for every operation; membership does not create an account or send email.
- Manager: read/import/export. Viewer: read only. CSV export controls do not prevent a viewer from copying data they can already read.
- Audit is server-written for imports, CSV pages, grants/revocations, issuing, round lifecycle and transfers. A verified Auth session is recorded once when an authorized user first accesses the warehouse, with its real creation timestamp. This is not a global failed-login log or a reconstruction of old logins.
- Existing TEST and LIVE campaigns are retained. Each new round creates five main pools and five same-prize backups. New campaigns resolve through a service-only RPC; use the new campaign_id in all six Botcake API blocks.
- Only one active round per mode. Closing a round disables issuance in both main/backup and stores counts by pool/status. Do this only after all outstanding spins are fulfilled; the automated 3/5 entrance gate does NOT close the administrative round.
- Transfer moves only available, unexpired stock from a closed round to a draft of the same mode and same prize/warehouse type. Issued vouchers stay with the original round. Transfers cannot extend source expiry. Global code uniqueness is retained. Repeating a completed transfer moves zero vouchers.
- CSV is a stock export, not a full disaster-recovery database backup. Snapshot and transfer history are kept in the database. Provider backup/restore policy has not been changed.
- Legacy wheel RPCs in the shared database still have security-advisor warnings; this release does not certify or modify those unrelated functions. See https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable . Private admin tables intentionally have RLS with no direct-access policies: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .

Validation: 21 Node tests and production build; rollback-only database integration verifies owner/viewer/manager boundaries, denial of direct inserts, duplicate import, round activation/closure snapshot, transfer of unissued vouchers only, retained issued history and transfer replay.
