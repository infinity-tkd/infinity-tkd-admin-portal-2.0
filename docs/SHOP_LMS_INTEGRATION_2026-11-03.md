# Pro-Shop and Academy integration

Release guide · 3 November 2026 · Infinity Taekwondo

Pro-Shop and Academy remain part of the admin portal. This release strengthens their management workflows and provides separate student-facing catalog contracts. Those contracts can serve the existing student portal and, later, independently deployed Shop or LMS applications.

No separate application or payment-provider integration is deployed by this work. Existing orders, receipts, product references, lesson progress and training assignments are retained. Staff must deliberately publish new lessons and routines or enable a product for student orders.

The five release migrations are installed in the connected Infinity TKD database. The [release manifest](../supabase/shop-lms-release-migrations.json) records the registered versions and unchanged SQL hashes:

- [Shop management integrity](../supabase/migrations/20261102181719_shop_management_integrity.sql) — `20261102181719`.
- [Academy content publication](../supabase/migrations/20261102181732_academy_content_publication.sql) — `20261102181732`.
- [Workout authoring publications](../supabase/migrations/20261102181741_workout_authoring_publications.sql) — `20261102181741`.
- [Order collection timestamps](../supabase/migrations/20261102182859_order_collection_timestamps.sql) — `20261102182859`.
- [Workout authoring foreign-key indexes](../supabase/migrations/20261102183241_workout_authoring_foreign_key_indexes.sql) — `20261102183241`.

The [release review](SHOP_LMS_REVIEW_2026-11-03.md) separates implemented behavior, verified data preservation and remaining acceptance work.

## Management workflows

### Catalog and inventory

Product management includes descriptions, images, cost, selling price, active/archive state and student-store visibility. Archiving retains the product, variants and historical order-item snapshots. Restoring the product does not automatically enable student orders again.

Variant metadata changes preserve the existing variant identity and physical stock. Staff can update its price override and availability without submitting a stock replacement. An override of zero is a valid free variant; a missing override uses the parent price. Stock changes use the separate adjustment workflow and inventory ledger.

The current editor sends the product's last `updatedAt` value. A concurrent edit or sale can change that value; a stale save is rejected rather than overwriting the newer state. Refresh and review the product before trying again. Converting a stocked simple product into a variant product requires explicit inventory reconciliation first.

Initial quantities on newly created products and variations are recorded in the inventory ledger. Existing quantities are not backfilled or changed by the release migrations.

Stock-adjustment requests from the current interface carry a UUID request key. Retrying an identical request returns its original outcome, with `replayed: true`, without changing stock again. Reusing the key for a different product, quantity, reason or note is rejected. An adjustment result describes the balance after that command; refresh the catalog for the current balance after any intervening sales.

The counter uses active products and active variants. Stock health checks each active variation against its own minimum threshold, using the product threshold only when the variation has none. Zero is a valid threshold. One low or empty active size makes an otherwise stocked product Low; no available active stock makes it Out. Archived products are excluded from active alert counts.

Physical inventory valuation includes retained stock, while sellable stock excludes inactive variants. The displayed valuation is **retail stock value**, not profit, accounting cost or collected revenue.

### Orders and payment collection

Order acceptance, fulfillment and payment collection are separate actions:

| Action | Order state | Payment effect |
| --- | --- | --- |
| Accept order | `CONFIRMED` | Keeps its existing payment state |
| Start preparing | `PREPARING` | None |
| Mark ready | `READY_FOR_PICKUP` | None |
| Record verified payment | Keeps its current fulfillment state | Changes a pending collection to `PAID` |
| Complete handover | `COMPLETED` | Requires payment to have been recorded |
| Cancel or refund | Dedicated reviewed workflow | Retains the existing cancellation/refund and stock rules |

Recording payment against a pending order requires a verified payment reference. The transaction records the reference, operator, previous states and resulting states in the audit log. Later preparation or handover does not replace the original order-confirmation operator.

**Verified payment means staff verification.** Entering a reference does not contact a bank, prove settlement or provide a payment-provider webhook. Connect and reconcile an actual provider before offering automatic online payment confirmation.

Counter checkout represents an immediately collected sale. `Pay at Counter` belongs to the pending student-order workflow and cannot be used to record an already-paid counter sale.

The current order interface sends `expectedUpdatedAt`. A stale update receives HTTP 409 and must be refreshed before another decision. Avoid automatically retrying an uncertain payment, cancellation or refund; read the saved order first.

### Collection reporting dates

An order's placement time and collection time are separate. `payment_recorded_at` records server time when a new order is created as PAID, or an existing pending order is first recorded as PAID. An order placed weeks earlier belongs to the period when its payment was recorded, not its creation period.

The timestamp describes staff recording, not the bank's settlement time. Fulfillment and refund preserve the original collection timestamp; ordinary updates cannot replace it. Legacy paid records without a trustworthy collection timestamp are not backfilled from creation time or the staff device clock. They remain in all-time audit history with a review label and are excluded from dated collection filters.

Collection filters use academy calendar periods: Today starts at academy midnight, This Week starts Monday, and This Month starts on the first day. They are not rolling 7-day or 30-day windows. Dated filters exclude missing, invalid and future timestamps.

Collection totals include currently PAID, non-cancelled orders. Pending, voided and refunded records remain visible in audit history but are excluded from those totals. This is not a complete bank cash-flow or refund-event ledger.

The counter response reads its collection timestamp from the saved order. If that metadata read is temporarily unavailable after a confirmed sale, the sale remains confirmed and the date stays unknown until a refresh; the interface must not substitute `Date.now()`.

### Lessons and routines

Lesson authoring separates the staff draft from the published curriculum record. Saving changes leaves the previously published version available. Publishing requires a reviewed revision and reason. Student readers use the published curriculum projection, rather than the raw authoring description or arbitrary metadata.

The public projection supports lesson overview and media, difficulty, repetitions/sets, instructions, prerequisites, principles, drilling guidance, performance points, mistake/correction pairs, terminology and study-guide questions. Treat these fields as text; do not render arbitrary HTML from the response.

Published anatomy targets are derived from the lesson's actual muscle associations and captured in the approved snapshot as muscle IDs with Primary/Secondary roles. Free-form metadata cannot invent those associations. These are teaching references, not a student's body measurements or medical record.

Routine authoring uses private drafts and explicit publication. Its management API uses revisions and request keys for conflict protection and safe replay. The routine duration is calculated from preparation, work, rest, exercises and rounds. Invalid timing, empty exercise lists and excessive durations are rejected by both the API and transaction.

Legacy published routines remain available. New private drafts are not written into the published routine table. A private draft may be archived; an already-published routine is retained and revised rather than deleted through that draft action.

Training assignments use the existing reviewed assignment workflow. Current assignments capture their assigned routine structure; later authoring changes do not silently replace that snapshot. Keep the assignment API and its permission checks when building a separate LMS. Viewing material must not automatically write official completion or assessment results.

## Student-facing contracts

Use the student's own access token on the server-to-server request. A contract header identifies the expected response shape; it does not grant access by itself.

Every request verifies the current account, requires the Student role, resolves its explicit student link and checks the academy's student-portal login switch. Contradictory links fail closed. The browser cannot select a different student by submitting a `studentId` query parameter.

| Resource | Method and path | Required header |
| --- | --- | --- |
| Student shop catalog | `GET /api/portal/shop/catalog` | `X-Portal-Contract: shop-v1` |
| Published lesson library | `GET /api/portal/learning/library` | `X-Portal-Contract: learning-v1` |

Both resources return `Cache-Control: private, no-store`. Responses vary by authorization, cookie and contract header. Do not put these responses in a public CDN cache, shared browser cache or service-worker cache.

### Query parameters

| Parameter | Shop catalog | Lesson library |
| --- | --- | --- |
| `limit` | 1–50; default 25 | 1–50; default 25 |
| `cursor` | Opaque next-page value | Opaque next-page value |
| `q` | Product-name search, up to 100 characters | Lesson-title search, up to 100 characters |
| `category` | Exact catalog category | Exact published content category |
| `type` | Unsupported | `Taekwondo`, `Fitness` or `Dance` |

Unknown parameters, repeated fields and unsupported page sizes are rejected. Do not pass SQL column names, relationship expansions or sorting expressions from the client.

### Response envelope

```json
{
  "success": true,
  "data": {
    "contractVersion": "shop-v1",
    "subjectStudentId": "STU-M-001",
    "canOrder": true,
    "products": [],
    "nextCursor": null,
    "pricing": "server_verified_at_checkout"
  },
  "error": null
}
```

The lesson response uses `contractVersion: "learning-v1"`, `subjectStudentId`, `lessons` and `nextCursor`.

Check the contract version and subject before displaying a response. Clear the previous account's data on sign-out, identity change or permission denial. Treat an HTTP 503 as unavailable data, not an empty catalog or a zero balance.

### Shop product fields

Products expose `id`, `sku`, `name`, `category`, `description`, `imageUrl`, `priceUsd`, `stock`, `hasVariants` and `variants`. A variant exposes `id`, `sku`, `size`, `color`, effective `priceUsd` and `stock`.

Only active products explicitly enabled for student orders are selected. Only active variants are included. Variant products report their active-variant stock; simple products use base stock, even when archived historical variant rows remain in the database. An inconsistent active-variant configuration is reported for academy review rather than presenting a misleading quantity.

Costs, internal inventory logs, administrative flags and private notes are excluded. Unsafe legacy image links are returned as null; safe HTTPS links and ordinary same-origin image paths remain usable. No stored image URL is rewritten by this projection.

For a separately hosted application, resolve a root-relative image path against the backend's configured public asset origin, rather than assuming it belongs to the student's current page origin. Keep the image host allowlist and HTTPS policy explicit.

The server recalculates catalog prices and stock at checkout. Displayed availability is not a reservation. Honor `canOrder` in the interface, and handle a checkout rejection or changed quote by refreshing and asking the student to review the current cart.

Student checkout requires an Active training membership. Linked Paused, Inactive and Graduated accounts can still read their catalog and order history when their account and portal access remain enabled. The API and a database insert guard enforce the checkout rule, including calls through legacy service RPCs. Rejected orders roll back their stock reservations and inventory-log writes. Staff counter sales follow the separate staff POS policy.

### Lesson fields and eligibility

Lessons expose the published curriculum `id`, `targetBelt`, title, description, video and thumbnail URLs, content type/category and an allowlisted `content` object. Draft text, private source metadata and staff notes are excluded.

Each lesson also supplies a sanitized `media` descriptor. Consume that descriptor instead of putting every `videoUrl` into an iframe:

| `media.kind` | Reader behavior |
| --- | --- |
| `iframe` | Use the approved `src` for the named YouTube, Google Drive or Vimeo provider. `href` retains its safe original link. |
| `video` | Render a native video using `src` and `mimeType`, with controls, autoplay off and `preload="none"`. |
| `external` | Offer an explicit link to `href`; do not frame an arbitrary external site. Use safe new-tab link behavior when applicable. |
| `unavailable` | Show a clear unavailable-media state while keeping the published teaching text usable. |

Only approved providers become frames. Media links use sanitized HTTPS URLs without embedded credentials. Do not reintroduce unsafe raw source URLs or autoplay query parameters as a fallback.

Belt-restricted lessons use the academy's ordered belt catalog. If that table is empty, the same established belt sequence used by Academy supplies the order. Any non-empty database catalog takes precedence; unknown restricted levels fail closed. Newly published Fitness and Dance material uses the publication workflow's general audience normalization. Existing legacy material is retained for review rather than being silently reclassified or republished.

Eligibility is checked while scanning each key range. A page can therefore contain fewer lessons than `limit`, or no lessons, while still returning `nextCursor`. **Continue until `nextCursor` is null**; do not use an empty array as the end-of-library signal.

### Cursor handling

Cursors are signed, expire after one hour and are bound to the account, student, filters and page size. Lesson cursors also include the student's current belt context. Changing an account, belt, filter or limit requires a fresh first page. A stale or altered cursor returns HTTP 409.

Use the returned cursor as an opaque value. Keyset order is based on stable record IDs, not the visual title or publication date. Newly available content may require a fresh catalog load; pagination is not a frozen historical snapshot.

## Administrative API compatibility

Administrative order and product responses keep their existing `data` arrays. Order listings add `shop-admin-v1` pagination metadata. Product listings support explicit bounded `limit`/`offset`; omitting pagination retains the legacy full-catalog behavior for existing callers. New clients should use bounded queries.

Order listing supports status, channel, payment state, selected dates and search. Its `from`/`to` filters use **order creation time** in academy time, UTC+07:00. They are not collection-period filters. Do not discard older-created orders before applying a report based on `payment_recorded_at`. Unknown filters and invalid bounds are rejected rather than silently ignored.

`GET/POST /api/shop/order` remains the legacy authenticated order endpoint with the `shop-orders-v1` response header. Its existing array response is not the new `shop-v1` catalog envelope. Student reads use the canonical ownership resolver, respect the academy login switch and exclude internal notes. Existing staff callers still require the corresponding POS permission.

Inventory request keys and optimistic timestamps remain optional in legacy request shapes. The updated management interface supplies them. New integrations should always supply them and retain the same request key for an identical uncertain stock-adjustment retry.

The lesson management catalog uses `academy-library-v1`. Routine management uses `academy-workouts-v1` through `/api/admin/workout-templates`; training assignment remains `/api/admin/student-training-plans`. These are staff APIs and must not be called from a Student browser or exposed through an unrestricted proxy.

## Separating Shop or LMS later

Keep the domain API as the boundary when extracting a new application:

1. Keep identity verification and ownership checks on every request. A contract header or frontend route is not an authorization rule.
2. Use the existing permission engine for staff actions. Preserve explicit denials and each action's required page access.
3. Send credentials only to the intended backend. Never ship a Supabase secret/service-role key to a browser or mobile client.
4. Reuse public DTOs rather than exposing database rows, authoring tables or direct unrestricted Supabase queries.
5. Keep order, stock, collection and publication mutations transactional. Do not reproduce their business rules in a second client.
6. Preserve product/variant IDs, curriculum IDs, order-item snapshots and assigned routine snapshots. A new interface should not rewrite historical references.
7. Introduce a new contract version for breaking response or behavior changes. Keep the existing consumer working during a planned migration.
8. Configure the actual HTTPS origin, proxy and session behavior before enabling a separate deployment. There is no wildcard cross-origin access or automatic public exposure in this release.

A separate Shop will still need its own checkout, settlement/reconciliation and operational acceptance. A separate LMS will still need its student learning interface, assessment policy and progress acceptance. Those applications can reuse these boundaries without receiving broad staff or database access.

The current Shop contract is an authenticated student catalog. Guest retail customers, independent customer identities and multi-academy tenancy require their own explicit access and checkout policies; do not simulate them by creating Student links or granting staff access.

## Student-reader handoff

These APIs make the richer published data available. They do not automatically replace the separate student application's existing readers or screens. The student application team still needs to connect and verify the `shop-v1` and `learning-v1` gateways before presenting the new capabilities as complete.

The reader implementation should:

- Adapt the typed public DTOs rather than assume that administrative database columns are returned.
- Render the published guidance sections and anatomy targets, not only the old description/video fields.
- Honor `canOrder`, display effective variant prices and stock, and let the server confirm the final quote.
- Continue lesson pagination while a cursor exists, including an eligibility-filtered empty page.
- Handle identity changes, portal closure, unpublication, stale cursors and unavailable data without keeping another account's cached information.
- Keep existing order-history and assigned-plan references intact while adding the richer displays.
- Run genuine Student sign-in, publication-to-display, checkout-denial and desktop/mobile acceptance against the intended HTTPS deployment.

Existing readers can continue their compatible published-data path during that integration. Do not expose private authoring tables or raw description metadata as a shortcut to the richer UI.

## Verification and rollout

Use the release's migration manifest and review to identify the tested SQL versions. Do not replay older migrations or run a blanket database push to resolve differing historical migration names.

Before deployment, run the type, lint, business-rule, API, SQL and production-build checks. Validate the intended role matrix and real data reads, then verify desktop/mobile controls and real HTTPS sign-in. Use isolated fixtures for write-path acceptance; do not create or remove live test orders, stock movements or learning records merely to satisfy a test.

The final release review records the installed migration versions and verification results. Catalog and learning API availability does not by itself prove that a separate student application's screens have been connected to them.
