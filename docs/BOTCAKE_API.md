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
