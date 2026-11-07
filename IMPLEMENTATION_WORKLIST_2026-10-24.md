# Operations release worklist

Updated 28 October 2026. The operations migration is installed live; application deployment remains pending. Details and operator instructions: [operations release guide](OPERATIONS_RELEASE_2026-10-25.md).

The student portal is deferred at the owner's request. The existing staff-only boundary remains in place.

Approved pause policy: waive complete billing cycles fully covered by an approved pause. Partial cycles remain payable. Preserve paid receipts.

## Payments, attendance and inventory follow-up — 28 October

Extracted nine more components: the tuition ledger, student tuition dialog, renewal-day dialog, attendance roster, student attendance dialog, counter layout, counter catalog, checkout pane and variant selector. Larger views load on demand. The coordinating screens now contain 882 lines for financials, 714 for attendance and 1,903 for inventory/POS; the counter layout itself contains 112 lines. The shared application store and some controllers remain candidates for further decomposition.

- Tuition and POS share decimal currency rounding. Prepayments validate 1–24 months, preserve exact cents across year boundaries and reject invalid totals, settled cycles and dates before enrollment. Existing invoices, pauses and historical balances use the invoice ledger. Payment submissions are guarded while pending.
- Billing-day sorting, exports and ledger labels honor effective schedule changes and month-end limits without converting dates to the staff device timezone. Settled rows distinguish cash collections, waivers and credit-only settlement.
- Bulk attendance is one upsert statement. A rejected row rolls back all changes. Uncertain network results ask staff to reload before retrying; no automatic write retry is added. Clearing without a selected class targets daily check-ins, preserving other class marks. Bulk clearing updates local state only for returned record IDs and reports incomplete deletion. Late attendance responses cannot populate a different account's local records.
- Class finalization reads saved session rosters rather than the current weekly timetable and enrollments. It preserves existing marks, excludes cancellations and uses actual session dates. It requires a selected class; daily check-ins are explicitly separate. Missing session snapshots require review in Operations rather than silently inventing absences.
- Selected class rosters include enrolled students from other home branches. Marking and deletion permissions control their own actions. Roster save failures are caught rather than becoming unhandled promises.
- Dashboard and schedule bulk marking also use one atomic batch. Their quick actions and historical attendance edits share pending/error handling through `use-attendance-actions.ts`; failed writes cannot produce a success message. Already-present dashboard students are excluded from repeat bulk writes.
- Variant payloads use the API's `priceOverride` field, including zero overrides; style-only variants may omit size. Unknown variant fields are rejected. Stock movements enforce positive restocks, negative damage write-offs, and signed audits, bounded to 100,000 units. Repeat product edits and stock adjustments are blocked while saving.
- Product metadata edits no longer resubmit stale stock balances. Quantity changes use the stock-adjustment workflow. Checkout locks basket controls during saving so newly edited items cannot be erased by an earlier sale response.

The 180-test regression suite passed, including isolated PostgreSQL rollback tests and API validation tests. TypeScript, strict lint, production build, 15 browser suites and 75 HTTP/security cases passed. Focused attendance, component, business, authentication and hydration suites were rerun after the final safeguards. Browser and database checks use mocked providers and isolated PostgreSQL fixtures. This follow-up introduces no schema migration or live business-record changes. Credential rotation and the separate student portal remain deferred.

## Earlier warning cleanup and feature components — 28 October

All 146 original lint warnings are resolved without disabling their rules. The lint command now rejects any warning. The follow-up extracts 25 feature components, with larger views loaded only when opened.

| Screen | Before | After |
| --- | ---: | ---: |
| Inventory and POS | 5,157 lines | 3,283 lines |
| Student management | 4,193 lines | 1,661 lines |
| Financials | 3,856 lines | 2,309 lines |
| Library | 3,386 lines | 1,135 lines |
| Student directory | 3,194 lines | 2,394 lines |
| Attendance | 2,505 lines | 1,435 lines |

The extracted views cover student profile editing and overview, belt and achievement records, bulk editors, biometrics, promotion review, inventory, student orders, sales, product forms, stock adjustments, financial reports, renewal calendars, library editors, attendance analytics, kiosk controls, the date picker and birthday greetings. State and authenticated actions remain in their coordinating screens; shared rules live under `lib/`.

Business and error-handling fixes:

- Belt batches use one insert instead of separate concurrent requests. A rejected row rolls back the complete batch and its rank changes. Incomplete rows stay editable; an uncertain network result asks staff to reload history before retrying.
- Product creation blocks repeat submissions and protects the form while saving. Zero stock thresholds survive input validation and request serialization. Physical audits preserve signed corrections.
- Inventory and order controls follow their write permissions. Student removal and belt grading use their own permissions. An expired session cannot report a product as removed.
- Sales history refreshes from the server instead of clearing the visible financial ledger and claiming deletion.
- Clipboard failures no longer produce false copied states or unhandled promises. Birthday share links do not mark a message sent; staff confirm that separately.
- Kiosk feedback reuses and disposes audio resources. Extracted forms retain keyboard focus, reject closing during saves and preserve their spacing.

Verification: zero lint warnings/errors, TypeScript, production build, 169 tests, 15 browser suites and 75 HTTP/security cases passed. Tests use isolated PostgreSQL fixtures and mocked browser providers. No migration or live business-data write was required. Credential rotation, deployment acceptance and the separate student application remain deferred as previously recorded.

## Earlier component and business-rule review — 28 October

- Extracted the finance receipt designer and printable card; library CSV import and workout timer; POS packing slip, sale receipt and bank-confirmation dialog. The receipt designer, library import and timer load only when opened.
- Centralized receipt classification, saved collection amounts, POS cent calculations, workout phases, library categories and POS types. Shared keyboard handling traps focus in the active dialog, supports Escape and restores focus when it closes.
- Fixed tuition summaries that could display current fees instead of the original invoice, mislabel partial collections as paid, or turn a preview into apparent payment evidence. Partial collections now open from the student dossier. Credit-only settlements and missing legacy amounts have explicit labels.
- Removed the simulated bank QR and hardcoded receiving account. Counter staff use the academy's verified bank details, acknowledge receipt of funds and enter a bank reference. The saved order retains that reference in its administrative notes.
- Workout timers now use elapsed monotonic time, catch up after missed background ticks and preserve paused time. Preparation or rest may be zero; malformed historical values are bounded. CSV import failures can be downloaded for correction.
- Centralized cart changes and API quantity, line-count and notes limits. Cart validation no longer sends notifications from React state updaters. Decimal arithmetic matches database half-cent rounding for prices and discounts.
- Installed `20261027190551_counter_sale_quote_validation.sql` on the connected database. Counter checkout locks product prices, rejects stale quotes before changing stock and preserves completed idempotent retries. A rejected quote refreshes the cart and requires fresh payment confirmation. The student-order engine remains unchanged.
- Bounded the test runner to two concurrent files after an unrestricted Windows run exhausted host memory. This setting also applies in CI.
- The release checks include a dedicated browser fixture for original invoice amounts, partial collections, phone/tablet/desktop receipt layouts, dialog keyboard control, library import opening, timer pause/resume and bank confirmation. All provider responses in this fixture are fictional.
- Verification at the end of that earlier pass covered the production build, TypeScript, 164 tests and 75 HTTP/security cases. It left 146 lint warnings; those are resolved by the follow-up above. Configured private keys were absent from changed source and public bundles.

The new checkout function is callable only by the service role; anonymous and signed-in clients have no execute privilege. Metadata-only live verification preserved 86 student and 194 payment records and created no orders. Other large screens, including student management and attendance, still warrant gradual decomposition; this pass does not claim every component has been split or every possible defect eliminated.

## Implementation and verification

- [x] Credential replacement validator and owner handoff guide; administrator MFA in UI, API and database. Provider rotation itself remains deferred.
- [x] Job leases, durable run history, visible health and operational review tasks.
- [x] Audited membership pauses, return dates and whole-cycle billing treatment.
- [x] Separate renewal reminder lead time and late-payment grace.
- [x] Dated class occurrences, frozen started-session rosters and attendance integration.
- [x] Holidays, cancellation and rescheduling with change history.
- [x] Enrollment events and dated membership periods.
- [x] Receipt reconciliation against imported bank records.
- [x] Invoice snapshots, partial collections, controlled credits and allocations.
- [x] Today queue, assigned tasks and recorded outcomes.
- [x] Permission-filtered student activity timeline.
- [x] Exam events, assessments, eligibility and audited promotions.
- [x] Page-specific data plans, selected periods and explicit display limits.
- [x] Device performance collector and aggregate report; physical-device measurements remain pending.
- [x] Data-quality findings and documented reviews.
- [x] Accessible operation forms, separate feature components and shared rules. Existing large screens remain candidates for gradual decomposition.
- [x] Isolated database/API tests, production build, responsive browser checks and secret verification. See the release guide for verification scope.

## External actions

Credential entry and provider revocation require the owner through the Supabase dashboard. Browser tools cannot perform credential-changing submissions on the owner's behalf. The existing student application does not yet exist, so compatibility with a deployed student client cannot be tested. Physical-device performance and notification acceptance require actual devices after deployment.

- [ ] Rotate and revoke the exposed provider credentials; deferred by owner.
- [ ] Select deployment hosting, supervise the worker and confirm its health.
- [ ] Verify real-account MFA, notifications and performance on physical devices.
- [ ] Rehearse database backup and restore.
- [ ] Connect the separate student application once its source exists.
