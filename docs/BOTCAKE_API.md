# Botcake voucher API — test integration

Status: deployed and HTTP-tested; **not connected to Botcake**. Existing flow unchanged.

Endpoint: `POST https://stxymyjwxdtfxkvmsgmz.supabase.co/functions/v1/chatbot-voucher-issue`

Headers:
- Content-Type: application/json
- Authorization: Bearer <dedicated test token>

Token recovery: encrypted production variable `BOTCAKE_TEST_ISSUE_TOKEN` in Vercel project `santhai-spin`. Do not expose in UI, URL, logs or Git. Edge source contains only its SHA-256 digest. Credential is restricted to the one test pool; no production voucher allocation is exposed.

```json
{
  "campaign_id": "BOTCAKE_TEST_20261126",
  "prize_code": "TP10k",
  "customer_id": "<numeric customer identifier; confirm Botcake substitution>",
  "event_id": "<stable unique win identifier; not yet configured in Botcake>"
}
```

Success: `{ "status":"success", "voucher_code":"ABCDE", "replayed":false, "is_test":true, "prize_code":"TP10k" }`.

Repeated customer+event returns the existing code even if the pool has since run out. New events for the same customer get different codes. Database locking protects simultaneous allocation.

Business errors return HTTP 200 with status `out_of_stock`, `disabled`, or `expired`, and an empty voucher_code. Auth/input/server failures use 401/400/413/415/502/503, always with empty voucher_code. Do not assume Botcake maps non-2xx responses. Clear status and voucher fields before calling, then branch on success **and** a nonempty code.

## Integration checkpoint — user review required

Inspected Botcake User Fields: Voucher (3188938), Tiếp nhận (362149). System Field screen lists gender, phone, email and address. No per-win event ID was identified in these inspected surfaces. This does not establish that Botcake cannot expose one elsewhere.

Current flow still: congratulation (4 second delay) → Receive voucher button → coupon text → mark coupon used / reset coupon NONE / unsubscribe sequence.

Proposed sequence for review:
1. Identify/persist a unique win reference. Prefer Botcake's actual win ID. A numeric per-customer win counter is an alternative only after verifying increment support, initialization, retry placement and non-overlapping execution.
2. Clear API result fields.
3. Call API using customer ID and persisted win reference.
4. Branch on successful response with nonempty code.
5. Send code immediately, with test labeling; do not issue again from an old Receive voucher button.
6. Failure branch for API errors/empty stock. Remove obsolete coupon actions only when the revised flow is approved.

Shared Custom Fields can be overwritten by simultaneous flows; verify serialization before assuming counter or code-field isolation.

No Botcake configuration was saved and no customer messages were sent during inspection.

## Validation (2026-11-26 Vietnam)

- 6 handler unit tests: authentication, scope/input validation, customer-event namespace, empty stock, upstream errors, payload size.
- Real HTTPS requests: invalid credential rejected; missing event rejected.
- 4 simultaneous requests for the same event returned one code.
- 9 further events issued 9 other codes; all 10 codes distinct for the same synthetic customer.
- 11th event reported out_of_stock and cleared response code.
- Retrying first event after exhaustion returned original code.
- Only synthetic test allocations were reset afterward. Pool again has 10 available codes.

Files: `supabase/functions/chatbot-voucher-issue/`, `tests/chatbotApi.test.mjs`, `scripts/test-chatbot-api.py`.
