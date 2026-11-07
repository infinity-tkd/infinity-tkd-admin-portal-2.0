# Pro-Shop and Academy review

Infinity Taekwondo · 3 November 2026

This release improves shop operations, lesson authoring and routine management within the existing admin portal. It also adds separate student catalog contracts so the student portal can consume public content without receiving administrative database rows. The [integration guide](SHOP_LMS_INTEGRATION_2026-11-03.md) documents the API shapes and the boundary for a future independently hosted Shop or LMS.

Existing live data was preserved. Write-path tests used fictional fixtures in isolated PostgreSQL/API environments. No live test sale, stock adjustment, publication, routine or assignment was created to make a check pass.

## Shop changes

| Area | Problem and resulting behavior |
| --- | --- |
| Product content | Product management did not expose the full supported description, image, cost and storefront controls. Management now handles those fields while preserving the current catalog identity and theme. |
| Student visibility | New interface drafts start with student visibility off. The create transaction now honors explicit active/visibility flags instead of silently using database defaults. Existing flags are not reset. |
| Archive and restore | Product retirement keeps historical rows and order-item snapshots. Both standard and existing archive paths disable the product and student ordering; restore keeps student ordering off until staff explicitly enable it. |
| Variant metadata | Variants can change price overrides and availability without replacing stock. Omitted attributes remain unchanged, identifiers remain linked and a zero override remains a valid free variant. Foreign IDs and duplicate SKUs are rejected. |
| Concurrent catalog edits | Current editors send the last catalog timestamp. A newer sale or edit causes a conflict response instead of a stale metadata save. Converting existing base stock into variations requires reconciliation. |
| Inventory replay | Current stock adjustments use a UUID command key. An identical uncertain retry confirms the original command rather than adding stock twice. Reused keys with changed payloads are rejected. |
| Inventory evidence | Future initial stock on new products/variations is logged. Historical stock is retained as-is; the migration does not fabricate old receipts or reconcile old opening balances. |
| Stock presentation | Sellable quantities and replenishment health use active variants. One low or empty active size makes an otherwise stocked product Low; no available active stock makes it Out. Each size uses its own threshold, including zero. Archived products do not inflate active alert counts. Retail stock value retains physical stock and effective variant prices. |
| Order acceptance | Accepting an order keeps its collection state. Preparation, pickup readiness, verified payment and handover have separate actions. Completion still requires recorded payment. |
| Collection audit | A new pending-to-paid transition requires a verified reference and records previous/resulting states. Later fulfillment keeps the original confirmation operator. This is staff verification, not automatic bank confirmation. |
| Collection periods | Order creation time is no longer used as collection time. The server records future PAID transitions, retains that timestamp through fulfillment/refund, and leaves legacy unknown dates for review. Dated filters use academy day, Monday-start week and calendar month boundaries. |
| Concurrent order actions | Current queue actions send the last order timestamp. An intervening update returns HTTP 409 and requires a fresh review. Double-click/pending controls prevent overlapping commands in the interface. |
| Counter checkout | A completed counter checkout cannot use `Pay at Counter`; that method belongs to the pending student-order flow. |
| Student membership | New student-channel orders require Active training membership. API validation and a database insert guard cover the legacy service RPC as well. Rejected orders roll back reservation/log changes. Eligible linked accounts retain catalog/history access; staff counter policy is separate. |
| Student ownership | Legacy order history and checkout use the canonical ownership resolver and academy login switch. Contradictory links do not grant access to another student's orders. Internal staff notes are excluded from student reads. |
| Listing contracts | Orders support validated bounded filters and pagination metadata. Products support explicit bounded pagination while retaining legacy full-catalog reads for existing management callers. |

## Academy and LMS changes

Lesson authoring now has explicit private draft, publish, changed-since-publish and unpublish states. Current revision checks prevent one editor from overwriting another's draft or publishing stale content. Staff can review the management catalog and deliberately publish a public curriculum snapshot with a reason.

The public snapshot contains typed teaching content rather than the entire authoring metadata blob. It supports step instructions, prerequisites, principles, drills, performance guidance, mistake/correction pairs, terminology and study-guide questions. Anatomy targets come from the actual lesson-muscle relationships at publication time. Later draft changes do not rewrite the approved anatomy snapshot.

Lesson media uses an explicit descriptor for approved provider frames, native video, external links or unavailable content. The reader should use that descriptor rather than frame every URL. Native video does not autoplay and uses no speculative media preload; unsupported or unsafe links do not become frames.

Existing library and curriculum titles, media and active flags remain unchanged. They are not bulk-published or bulk-unpublished. Legacy associations and classifications still need staff review before treating the richer gateway as a fully migrated course catalog. Newly published Fitness/Dance content receives the general-audience normalization needed by the student reader; unknown restricted belt levels still fail closed.

Routine authoring now has private draft storage, validated structure/timing, explicit publication, revision checks and idempotent commands. Public routine rows remain the compatible reader surface. Private draft edits do not immediately replace the published routine. Published routines are retained; draft archiving cannot remove an already-published routine through that action.

Training assignment keeps the existing reviewed assignment workflow and snapshots. Opening a lesson or routine is a reading action; it must not automatically create an official grade or completed assessment. Staff grading and curriculum management retain separate permissions.

The management interface continues to use the academy's components, theme and responsive shell. Destructive, publishing and financial actions remain deliberate, with pending states and meaningful error feedback. The release review does not equate hidden buttons with authorization; server and database checks enforce the corresponding decisions.

## Student and future-app boundaries

The release provides:

- `GET /api/portal/shop/catalog` with `shop-v1`.
- `GET /api/portal/learning/library` with `learning-v1`.

Both verify a genuine Student identity, canonical account ownership and the academy's student-portal switch on each request. Their signed cursors are account/filter scoped and expire. Results are private and not shared-cacheable.

The shop projection excludes costs, private flags and inventory logs. Only active, student-enabled products and active variants appear. Simple products remain simple when historical inactive variant rows exist; inconsistent active-variant configuration fails for review. Unsafe legacy image links are omitted from the response without rewriting stored data.

The learning projection reads active published curriculum, applies current belt eligibility and returns only allowlisted teaching fields. Clients must follow the cursor even if filtering produces an empty page. Changing the account, belt, filters or page size starts a new cursor sequence.

These boundaries support later separate deployment without moving authorization or inventory/publication rules into the browser. They do not implement guest checkout, independent customer identities, multi-academy tenancy or a payment-provider integration.

The separate student application's rich gateway readers and corresponding screens still need integration and acceptance. Exposing a tested API is not evidence that every student screen already renders the new guidance, anatomy targets or catalog state.

## Installed database release

| Registered version | Migration | Purpose |
| --- | --- | --- |
| `20261102181719` | [Shop management integrity](../supabase/migrations/20261102181719_shop_management_integrity.sql) | Inventory replay, reviewed collection/fulfillment, catalog guards, stock evidence and membership gate |
| `20261102181732` | [Academy content publication](../supabase/migrations/20261102181732_academy_content_publication.sql) | Versioned authoring, public lesson snapshots, rich content and reviewed anatomy links |
| `20261102181741` | [Workout authoring publications](../supabase/migrations/20261102181741_workout_authoring_publications.sql) | Private routine drafts, publication, conflict and replay protection |
| `20261102182859` | [Order collection timestamps](../supabase/migrations/20261102182859_order_collection_timestamps.sql) | Server-recorded collection time, immutable historical timestamps and explicit legacy unknown dates |
| `20261102183241` | [Workout authoring foreign-key indexes](../supabase/migrations/20261102183241_workout_authoring_foreign_key_indexes.sql) | Covers the three new authoring/command foreign keys identified by the post-installation advisor |

The [release manifest](../supabase/shop-lms-release-migrations.json) records the SQL hashes. Local files were renamed to their registered provider versions without changing the tested SQL bytes. Older historical migrations were not edited or replayed.

The collection-timestamp follow-up is installed as `20261102182859`. It adds a nullable timestamp and server trigger, with no historical date backfill. Collection reports use that recording time rather than order creation or a guessed client time; recorded times are not bank settlement dates. Refunded orders are excluded from current collection totals, so those totals are not a full bank cash-flow or refund-event ledger.

New authoring and command tables use RLS and service-only access. Private routines, command payloads and publication source data are not granted to anonymous or authenticated browser roles. Staff API access still goes through the existing effective permission model, including explicit denials and required page access.

The post-installation review identified three missing indexes on the new authoring tables. A separate bounded migration adds leading-column indexes for command actors and draft creators/editors. Isolated PostgreSQL tests verify all three foreign keys have coverage, the empty tables remain empty and browser read grants remain denied.

The final database advisor reports no missing foreign-key indexes. Its 120 unused-index notices remain informational; indexes were retained rather than removed on the basis of current usage alone. The three new private tables intentionally have RLS without browser policies, and live privilege checks confirm no anonymous or authenticated `SELECT` grants.

Existing security warnings remain unchanged: one [extension in the public schema](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), eleven [authenticated security-definer helper notices](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and disabled [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The helper execution paths are intentional authorization helpers. These findings are not reported as resolved by the Shop/LMS changes.

## Data preservation

Pre- and post-installation core-content fingerprints matched exactly. The inspected counts also remained unchanged:

| Data | Before and after |
| --- | ---: |
| Products | 10 |
| Product variants | 7 |
| Library assets | 81 |
| Curriculum records | 81 |
| POS orders | 0 |
| Inventory logs | 0 |
| Published workout templates | 0 |
| Workout drafts | 0 |
| Training assignments | 0 |
| Learning progress records | 0 |

Saved role-permission grants were unchanged. These checks establish preservation of the inspected live data during installation; they do not claim that matching counts alone prove every future transaction or reconcile historical inventory balances.

## Verification scope

Targeted tests exercise actual PostgreSQL transactions for stock replay, failed-order rollback, catalog/variant guards, membership eligibility, publication snapshots and private routine behavior. API fixtures exercise actor-derived identity, strict query validation, denial paths, private projections, conflict handling and command payloads. They use fictional data and do not make live business writes.

The student contract regressions include effective zero-price variants, converted-simple product stock, unsafe image links, current lesson eligibility, cursor account/filter boundaries, portal closure and unsupported query fields. The management regressions include read-only roles, explicit permission denials and publication/assignment separation.

Final release checks completed on 3 November 2026:

| Check | Result |
| --- | --- |
| Full regression suite | 295 tests passed; no failures or skipped tests |
| Additional empty/custom belt-catalog regressions | 4 tests passed |
| Production build | Passed, including TypeScript validation and zero-warning lint |
| Production route/security smoke | 79 cases passed, including the new private routine and student catalog routes |
| Live database readiness | Passed metadata and zero-row query-shape checks; this service-role check does not simulate a student session |
| Shop browser checks | Passed at 1440, 834 and 390 pixels, plus mobile management and explicit-denial flows |
| Academy browser checks | Root and Assistant Coach fixtures passed at 1440, 834 and 390 pixels; mobile authoring, publication review and media controls passed |
| Browser errors | No JavaScript, hydration or tested media-policy errors detected |
| Installation | Five registered migrations; every local SQL checksum matches the release manifest |

Shop regressions cover active variant replenishment thresholds, missing variant setup, metadata saves preserving unconfigured product mode, uncertain stock retries, explicit storefront visibility, fulfillment separate from collection, delayed-payment periods and unknown legacy collection dates. Mobile regression assertions cover the navigation/filter groups and readable routine selections. Final browser checks used the production build at `http://127.0.0.1:3101`, fictional providers and no live business writes.

All 81 legacy lesson ID/title pairs still match. Post-test live counts and private command tables confirm that testing created no real order, inventory log, routine, assignment, progress record or replay command. Local scratch logs and screenshots are evidence for that run and are intentionally excluded from Git. Browser viewport checks do not replace physical-device testing or acceptance in the separate student application.

## Existing catalog records needing review

Five existing products have `has_variants=true`, stored base quantities and no variant rows: `APPAREL-HOOD-005`, `BELT-DAN-003`, `DOBOK-MST`, `GEAR-GLOVES-006` and `GEAR-SPAR-002`. Their recorded base quantities total 126 units. The interface flags missing variant setup; it does not invent sizes or allocate these quantities automatically. Confirm the actual size/colour counts before enabling their sale as variant products. The other two variant products have matching aggregate quantities.

The retail-value summary explicitly excludes stock needing variant setup. Its total is not a complete valuation of those unresolved base quantities.

All 81 existing library assets remain legacy publication records with their explicit curriculum-link field unset. Their existing ID/title association is reviewed when deliberately edited; they are not bulk-published or linked by this release. The live belt-reference table is empty, so the student reader uses the same established belt sequence as Academy when that table has no rows. A non-empty database catalog takes precedence, and unknown restricted levels remain unavailable.

## Remaining acceptance and operating decisions

- Complete real HTTPS deployment sign-in, proxy/session handling and the intended hosted origins. Local HTTP production preview is not a substitute for those checks.
- Integrate the separate student application's new rich catalog readers and verify actual publication-to-display behavior on its desktop and mobile screens.
- Keep payment collection manual until a real provider and reconciliation workflow have been connected and verified. A staff-entered bank reference alone does not prove settlement.
- Review legacy lesson classification and historical inventory opening balances deliberately. This release does not backfill or invent that history.
- Use staging accounts and fictional fixtures for full write-path acceptance under every intended role. Preserve the production records used by ordinary academy operations.
- Measure physical-device performance, media compatibility and accessibility before making hardware-specific performance claims.

Credential rotation and unrelated student-portal feature expansion remain outside this release, as previously agreed.
