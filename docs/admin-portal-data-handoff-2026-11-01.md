# Infinity TKD — student portal data handoff to the admin portal

Prepared 1 November 2026. Copy this document into the admin portal development chat.

## Request to the admin portal team

Please audit the existing admin application and shared academy database against the contract below. Confirm which admin screens/APIs produce each record, correct missing mappings, and prepare the unpublished content for academy review. Reuse the existing shared schema and transactions. Do not create duplicate student, attendance, accounting or curriculum systems.

**Keep the readiness requirement draft and the first academy ranking unpublished until the academy approves them.** This handoff requests inspection and preparation; it does not approve athlete publication, invented consent, backdated coach confirmations or automatic promotions.

There are three different work categories:

1. **Integrated:** the student portal already reads or writes these records. Check completeness, relationships, permissions and the admin producer.
2. **Storage ready, unpublished:** the portal can consume approved publications, but the academy must prepare and approve actual content.
3. **Integration still required:** supplying records alone will not activate these features. Agree the schema, admin workflow, student API and authorization before enabling them.

Live read-only publication check on 1 November:

| Resource | Stored records | Current published/unrevoked records | Action |
|---|---:|---:|---|
| `student_portal_ranking_publications` | 0 | 0 | Prepare the first consented, academy-approved ranking snapshot. |
| `student_portal_readiness_policies` | 0 | 0 | Review the documented rules and map the required lessons/skills before publication. |
| `student_portal_coach_confirmations` | 0 | 0 | Provide a trusted coach confirmation workflow tied to published lesson requirements. |

These counts do not mean that the academy has no students, achievements or assessments. Private official records are separate from approved student-facing publications. Other tables below were traced through the current application code; this handoff does not certify that every academy record is complete.

## 1. Accounts, ownership and student profile — integrated

### Account and ownership records

| Source | Fields/data required | Admin checks |
|---|---|---|
| Managed authentication account (`auth.users`) | Stable authenticated user ID, authentication email, provider-managed password/recovery/session state | `profiles.id` must identify the correct authenticated user. Use the existing secure account/invitation/password workflow; never copy passwords or password hashes into portal records. New passwords have an 8-character minimum; spaces are allowed. |
| `profiles` | `id`, `username`, `email`, `display_name`, `role`, `is_active`, `student_id`, `must_change_password` | Username must resolve unambiguously to the intended authentication account. Current portal requires role `Student` and `is_active=true`. Staff/Parent accounts are not automatically student accounts. |
| `students` ownership/access fields | `id`, `profile_id`, `deleted_at`, `student_status` | At least one valid, explicit profile/student link is required. If both `profiles.student_id` and `students.profile_id` are set, they must agree. Reject duplicates or contradictory links. Email, phone and emergency-contact similarity do not establish ownership. |
| `academy_profile` | `allow_student_portal_login` | This is the academy-wide login switch. Membership status and account activation must remain separate. |

The current reader accepts linked, nondeleted students with status `Active`, `Paused`, `Inactive` or `Graduated`; individual actions have stricter rules. For example, shop ordering requires Active training membership. Do not deactivate a parent's/student's login merely to record a training pause.

### Official student profile fields

The current profile projection needs the following `students` fields:

- Identity: `id`, `khmer_name`, `english_name`, `gender`, `dob`, `nationality`.
- Contacts: `email`, `phone`, `telegram_username`.
- Registration/membership: `registration_date`, `membership_start_date`, `billing_schedule`, `student_status`, `status_reason`, `status_changed_at`, `pause_end_date`.
- Rank/certification: `current_belt`, `initial_belt`, `belt_id`, `kukkiwon_id`.
- Recorded measurements: `height_cm`, `weight_kg`.
- Photo: `profile_picture_path`.
- Emergency contact: `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation`.
- Private own-student health information: `medical_notes`, `allergies`.
- Relationships: `home_branch_id`, `scholarship_id`, plus the ownership/access fields above.

Related sources:

| Source | Fields/data required |
|---|---|
| `student_addresses` | Student link `student_id`; `address_id`, `is_primary`; `address_line1`, `address_line2`, `district_commune`, `state_province_city`, `postal_code`, `country`. The current reader selects one address, preferring the primary address. |
| `branches` | `id`, `branch_name`, joined through the student's home branch and scheduled classes. |
| `scholarships` | `id`, `type_name`, `discount_percentage`, joined through the student. Posted invoice amounts remain authoritative for issued charges. |

The student profile is read-only in the student application. Please identify the admin correction workflow for official names, DOB, contacts, rank, scholarship, health information and address. Sensitive health/contact data must never enter academy-wide rankings, public certificates, general notifications or public exports.

### Google Drive photos and files

- Store an individual image file ID or a supported HTTPS Google Drive share URL in `profile_picture_path`, preserving any `resourcekey` needed for access. A folder link is not a profile image.
- Confirm that the portal's server fetch can retrieve actual image bytes, not a Google sign-in or permission page. The current image proxy does not forward a parent's Google browser session.
- Where private Drive access requires Google authentication, prepare authenticated server-side retrieval or access-controlled storage integration. Do not assume that having a share URL makes a private file readable, or make children's files public just to bypass an integration gap.
- Check product images, lesson thumbnails, diagrams and certificate URLs separately. Photo proxy support is not proof that every Drive video/document URL will play or open.

## 2. Attendance, enrollment, schedule and makeups — integrated

| Source | Fields/data required | What the portal uses it for |
|---|---|---|
| `attendance` | `id`, `student_id`, `date`, `status`, `class_id`, `occurrence_id`, `created_at`; joined class name/start time where available | Attendance views, daily/class/dated-session provenance, history, monthly exports and published readiness attendance factors. |
| `class_enrollments` | `id`, `student_id`, `class_id`, `enrolled_at`, `enrollment_date` | Own enrolled classes and recurring timetable estimates. |
| `class_sessions` | `id`, `class_name`, `class_type`, `branch_id`, `days_of_week`, legacy `day_of_week`, `start_time`, `end_time` | Class labels, branch and recurring schedule. |
| `class_occurrence_roster` | `occurrence_id`, `student_id`; retain enrollment/provenance history | Determines which actual dated sessions belong to this student. |
| `class_occurrences` | `id`, `class_id`, `source_date`, `starts_at`, `ends_at`, `class_name`, `branch_id`, `status`, `revision`, `roster_provenance` | Confirmed dated schedule, changes/cancellations and historical roster context. |
| `makeup_attendance` | `id`, `student_id`, `source_class_id`, `source_date`, `source_occurrence_id`, `source_status`, `attended_date`, `target_class_id`, `status`, `voided_at` | Recorded makeup history and whether an entry was voided. |
| `membership_pauses` | `id`, `student_id`, `start_date`, `resume_date`, `voided_at` | Approved pause context for schedule and tuition. |

Admin preparation:

- Record real attendance dates and canonical statuses such as Present, Late, Absent and Excused.
- Preserve the recording type. A daily mark, a class-linked mark and a dated-session mark are not interchangeable denominators.
- Save actual dated occurrences and their student rosters. A recurring timetable is only an estimate, not proof that a class occurred or the student attended.
- Preserve cancellation/reschedule revisions and original roster provenance. Confirm the earliest date for which dated rosters are reliable.
- Maintain makeup source/replacement links and voiding state rather than overwriting the original absence.
- A true check-in timestamp, scanner evidence, coach label or session booking must come from a verified record/service. The portal does not invent these from an attendance date.
- Student correction requests, makeup entitlement/request/booking workflows and their staff approval are not established merely by the existing recorded-makeup reader; review them as additional integration work.

Use the academy timezone **Asia/Phnom_Penh** for training dates and month boundaries.

## 3. Tuition, receipts, credit and pauses — integrated reads

| Source | Fields/data required |
|---|---|
| `membership_invoices` | `id`, `student_id`, `cycle_month`, `due_date`, `cycle_end`, `amount_usd`, `waiver_usd`, `balance_usd`, `legacy_settlement_id`, `created_at` |
| `membership_receipts` | `id`, `student_id`, `receipt_number`, `amount_usd`, `payment_date`, `payment_method`, `created_at` |
| `membership_allocations` | `receipt_id`, `invoice_id`, `amount_usd`; correct foreign keys to the student's issued receipts/invoices |
| `membership_credits` | `id`, `student_id`, `amount_usd`, `created_at` |
| `membership_credit_uses` | `credit_id`, `invoice_id`, `amount_usd` |
| `payments` — legacy history | `id`, `student_id`, `year`, `for_month`, `billing_month`, `status`, `amount_usd`, `payment_date`, `created_at` |
| `academy_operations_policy` | `late_grace_days` is read by the current student tuition projection. |
| `membership_pauses` | Own approved/nonvoid start and resume dates, as above. |

Admin preparation:

- Publish/post real invoices with dates, amounts, waivers and reconciled balances. A current fee configuration is not a historical issued invoice.
- Record an actual issued receipt number, received amount, method and payment date when a receipt exists. A legacy Paid label alone must not generate an invented receipt.
- Preserve receipt-to-invoice allocations, credit issuance/use and legacy settlement links. These are distinct accounting effects, not extra amounts to add together.
- Allow partial payments and one receipt covering multiple invoices. The displayed received amount and allocated amount may differ.
- A waiver is not cash received. An approved pause does not erase older posted debt.
- Amount fields consumed by the current portal are USD. Changing an academy display currency does not migrate invoice currencies or implement currency conversion.
- Direct receipt PDFs and monthly progress downloads are already implemented. They are generated from authorized records; no manually seeded `reports` or PDF table is required for those features.
- Verified online payment collection, provider settlement, refunds and automated reconciliation still need integration. Do not mark an invoice Paid merely because a QR was displayed or a client reported success.

## 4. Learning library and official/personal progress — integrated, with content gaps

| Source | Fields/data required |
|---|---|
| `curriculum` | `id`, `target_belt`, `category`, `title`, `description`, `video_url`, `thumbnail_url`, `is_active` |
| `belts` | `id`, `belt_name`, `belt_order`, `color_hex` where used; stable canonical rank/alias mapping |
| `belt_techniques` | `id`, `belt_level`, `technique_name`, `category`, `created_at` |
| `lms_progress` | `id`, `student_id`, `curriculum_id`, `status`, `completed_at`, `repetition_count`, `last_watched_at` |
| `student_portal_progress` | `student_id`, `curriculum_id`, `completed`, `repetition_count`, `updated_at` |

Admin preparation:

- Ensure active lessons have accurate titles, categories, descriptions, approved playable media, thumbnails and belt eligibility.
- The current student lesson reader uses **`curriculum`**. Confirm any admin library/asset catalog maps to these IDs rather than populating a separate catalog that the student portal never reads.
- Current lesson ordering uses curriculum ID; an independently configured admin sort order needs an explicit adapter if it should control student ordering.
- `is_active` makes content eligible for the library; it does not by itself declare a mandatory grading requirement.
- Keep student-reported practice in `student_portal_progress`. Do not let personal completion overwrite official grades or become a coach confirmation.
- Historical `lms_progress` has no verified confirmer/provenance field in the current reader. Do not label every old Completed row as coach-approved. Readiness uses the explicit confirmation contract in section 7 instead.
- Rich lesson instructions, Korean/English/Khmer terminology, study questions/answers, common mistakes, coaching notes, media permissions and content versions need an agreed publication/metadata mapping. The current reader does not consume an arbitrary rich JSON payload simply because an admin screen stores it.

## 5. Training assignments, assessments, measurements and anatomy — integrated

| Source | Fields/data required |
|---|---|
| `student_training_plans` | `id`, `student_id`, `template_id`, `customized_structure`, `is_active`, `created_at` |
| `workout_templates` | `id`, `title`, `description`, `difficulty`, `duration_mins`, `structure` |
| `student_physical_evaluations` | `id`, `student_id`, `skill_name`, `belt_level`, `grade`, `evaluated_by`, `updated_at` |
| `student_body_compositions` | `id`, `student_id`, `recorded_date`, `height_cm`, `weight_kg`, `body_fat_percentage`, `skeletal_muscle_mass_kg`, `waist_cm`, `hips_cm`, `created_at` |
| `muscles` | `id`, `name`, `name_kh`, `name_zh`, `muscle_group`, `target_function`, `diagram_url`, `description` |
| `library_asset_muscles` | `asset_id`, `muscle_id`, `role` |
| `profiles` — server-side staff verification | `id`, `role`, `is_active` for the named evaluator/approver/coach; private IDs are not student-facing labels |

Admin preparation:

- Assign valid templates to the correct student and mark the intended assignment active. A catalog template alone is not an assignment.
- Canonical workout step fields are `name`, `duration_secs`, `reps`, `rest_secs`. The reader accepts arrays or structured exercises/steps, with validated optional rounds/preparation. Confirm that admin structures normalize successfully; do not rely on unsupported arbitrary JSON.
- Save actual physical grades with the exact skill and belt, the real evaluator and assessment timestamp. Missing coach attribution is not a confirmed result.
- Grade mapping for readiness is Needs Work/F=1, Developing/C=2, Proficient/B=3, Outstanding/A=4. Publish the required skill list and average threshold separately.
- Preserve unknown measurements as null; do not populate guessed body-fat or muscle values.
- Confirm that `library_asset_muscles.asset_id` maps to the lesson IDs actually served to students. Anatomy names have explicit Khmer/Chinese fields; descriptions and other academy-authored text need a separately agreed localization contract if required.
- If assessments/learning rows are updated in place, earlier versions may no longer exist. True longitudinal assessment history requires a versioned/append-only data producer and reader integration; the portal cannot reconstruct overwritten data.

## 6. Belt journey, promotions and private achievements — integrated

| Source | Fields/data required |
|---|---|
| `students` | `current_belt`, `initial_belt`, `belt_id`, `registration_date`, `kukkiwon_id` |
| `belts` | Stable rank IDs, names, order and colors, as above. |
| `belt_histories` | `id`, `student_id`, `belt_level`, `promotion_date`, `certificate_id`, `certificate_path`, `kukkiwon_dan_card_id`, `created_at` |
| `achievements` | `id`, `student_id`, `event_name`, `date`, `category`, `division`, `medal_rank`, `age_division`, `belt_division`, `created_at` |

Admin preparation:

- Maintain actual promotion events and dates; missing earlier events must not be manufactured from the displayed belt path.
- Support White, Yellow, Green, Blue, Brown, Red, Black 1 Poom/Dan, Black 2 Poom/Dan, and Black 3–6 Dan. Confirm the student's actual Poom/Dan designation and alias mapping; do not silently convert stripes or Poom into Dan.
- Keep the current belt and promotion history consistent. Readiness needs a valid current-rank start; it will not substitute today for a missing/invalid date.
- Supply real certificate references and authorized file URLs. A reference or Drive PDF is not external registry verification.
- Record competition event/date, medal/placing and the available category/division details accurately. Unknown historical results should stay unknown.
- **Achievement detail gap:** the UI has optional slots for weight class, points scored, opponent record and academy notes. The current reader does not supply those extra result columns. A `notes` column exists in the inspected achievements schema but is not selected by the current student reader. Agree a student-safe notes/detail projection before exposing it; do not publish internal notes wholesale.
- Private achievements do not automatically become academy-wide rankings. Use the approved publication below.

## 7. Belt readiness — storage ready, unpublished

Both tables below exist and are protected. The current live count is zero in each. The student checklist is implemented and waits honestly for academy-approved content.

### Published policy: `student_portal_readiness_policies`

Required publication fields:

- `id` — UUID.
- `target_belt` — the **current student belt the requirements apply to**, matched unambiguously, including Poom/Dan; do not assume this column means the next awarded rank.
- `version` — stable approved policy version.
- `requirements` — the structured contract below.
- `approved_by` — real active approver profile ID with role `Root`, `Super Root`, `Admin` or `Head Coach`.
- `approved_at`, `approval_reference` — real approval timestamp and private evidence reference.
- `publish_from`, `publish_until` — publication window.
- `revoked_at` — null while applicable; populated when withdrawn.
- `created_at` — stored audit timestamp.

Exact required `requirements` keys:

| Key | Required content |
|---|---|
| `minimumDays` | Integer minimum days at the current rank; zero explicitly means that factor is not required. |
| `minimumAverageGrade` | Required physical average on the 0–4 scale. A positive value requires named skills. |
| `attendance.minimum` | Integer minimum attended count. |
| `attendance.basis` | Exactly `unique_days`, `class_records` or `dated_sessions`; academy must choose the intended basis. |
| `lessons[]` | Each item: unique `id`, exact active `curriculumId`, and `label: {en, kh, zh}`. |
| `skills[]` | Each item: unique `id`, exact `skillName`, integer `minimumGrade` from 1–4, and `label: {en, kh, zh}`. |

An empty lesson/skill list explicitly means there are no requirements in that category; it must not stand in for an unmapped syllabus. Physical-average thresholds are separate from individual skill minimums. Replace old versions through a new publication and withdrawal of the obsolete policy; overlapping current policies require review.

**Unapproved documented baseline for review only:**

| Current belt | Minimum days | Attendance threshold — counting basis still needs approval | Minimum physical average |
|---|---:|---:|---:|
| White | 60 | 16 | 2.0 |
| Yellow | 90 | 24 | 2.0 |
| Green | 90 | 24 | 2.5 |
| Blue | 120 | 36 | 2.5 |
| Brown | 120 | 36 | 3.0 |
| Red | 150 | 48 | 3.0 |
| 1st Poom/Dan | 365 | 96 | 3.5 |
| 2nd Poom/Dan | 730 | 192 | 3.5 |
| 3rd Poom/Dan | 1095 | 288 | 3.8 |

These are documented application baseline rules, not independently verified Kukkiwon regulations. Confirm rank naming, required lesson/skill mappings and individual grade rules. No baseline is approved for Black 4–6 Dan; obtain academy rules rather than extrapolating.

### Lesson confirmation: `student_portal_coach_confirmations`

Required fields: `id`, `student_id`, `policy_id`, `requirement_key`, `result`, `confirmed_by`, `confirmed_at`, `confirmation_reference`, `revoked_at`, `created_at`.

- `requirement_key` must match a lesson key in that exact published policy.
- `result` is exactly `passed` or `needs_work`.
- `confirmed_by` is the real authorized active coach; retain the private evidence reference. Allowed current roles are `Root`, `Super Root`, `Admin`, `Head Coach`, `Coach` and `Assistant Coach`.
- The confirmation must be within the policy's publication window and applicable current-rank period. Do not backdate or attribute old self-completions to a coach.
- Record corrections as new results; use withdrawal for invalid confirmations. A withdrawn latest result must not resurrect an older pass.
- Physical skills use matching `student_physical_evaluations` records with real evaluator and current-policy timestamps. Do not misuse lesson confirmations to fabricate physical grades.
- Trusted staff administration is required. Students have no endpoint to write these tables or approve promotion.

The result can only mean **Ready for coach review**. It does not itself approve promotion, certification or exam registration.

## 8. Academy-wide rankings — storage ready, unpublished

`student_portal_ranking_publications` exists and currently has zero records. Prepare one approved season/list before publishing.

Publication fields:

- `id`, `title`.
- `season_start`, `season_end`.
- `methodology` — currently exactly `medal_order`.
- `entries` — 1–1,000 approved athletes.
- `approval_reference`, `approved_by`, `approved_at`.
- `publish_from`, `publish_until`, `revoked_at`, `created_at`.

Every athlete entry contains **exactly**:

- `student_id` — valid existing academy student.
- `display_name` — exact approved display name.
- `consent_reference` — real academy-approved publication/consent evidence.
- `gold`, `silver`, `bronze` — nonnegative integer counts for the approved season/snapshot.

Confirm season eligibility, counting rules, display-name/consent scope, approver and publication window. The active approver must have role `Root`, `Super Root`, `Admin` or `Head Coach`. No duplicate athletes. Current ordering is gold, then silver, then bronze; equal counts share rank. Do not invent a points formula. The student API omits private student IDs and approval/consent evidence from the leaderboard projection. Expired or withdrawn snapshots do not display.

Do not fill the table by automatically copying every private achievement/student into a public list. A validation command is not publication approval.

## 9. Academy shop — integrated pay-at-academy ordering

| Source | Fields/data required |
|---|---|
| `products` | `id`, `sku`, `name`, `category_name`, `description`, `price_usd`, `stock`, `sizes`, `has_variants`, `image_url`, `is_active`, `allow_student_orders` |
| `product_variants` | `id`, `product_id`, `sku`, `size`, `color`, `price_override`, `stock`, `is_active` |
| `pos_orders` — student history | `id`, `order_number`, `student_id`, `customer_name`, `subtotal_usd`, `discount_percentage`, `discount_usd`, `total_usd`, `payment_method`, `payment_status`, `order_status`, `order_channel`, `created_at` |
| `pos_order_items` | `id`, `order_id`, `product_id`, `variant_id`, `sku`, `product_name`, `size`, `unit_price_usd`, `quantity`, `total_price_usd` |
| `pos_orders` — server transaction/recovery support | `recorded_by`, `request_key`, `request_payload`, plus transaction-owned contact/branch/confirmation state needed by the existing staff workflow. These internal fields are not a student-facing raw export. |

Admin preparation:

- Only active products explicitly allowed for student orders should be offered.
- Supply active variants and accurate variant stock/prices when variants are required. A parent must not bypass a required size/color through a generic product ID.
- Keep SKU/item name/price/quantity snapshots on placed orders. Later product edits must not rewrite historical order lines.
- Preserve `STUDENT_PORTAL` channel, actor ownership and idempotency keys. Existing transactional placement/cancellation owns pricing, stock reservation and replay behavior.
- Staff must maintain fulfillment, payment and confirmation states. Student cancellation is restricted to their own eligible pending/unpaid, unconfirmed student-channel orders.
- Current supported checkout is pay at the academy. Online merchant settlement remains a separate integration.

## 10. Academy information and portal preferences — integrated

| Source | Fields/data required |
|---|---|
| `academy_profile` — current contact reader | `academy_name`, `tagline`, `contact_phone`, `support_email`, `primary_address`, `website_url`, `facebook_url`, `telegram_channel` |
| `student_portal_preferences` | `user_id`, `theme`, `language`, `updated_at` |

Please provide current public academy contact details and approved links. Interface languages are English, Khmer and Chinese. Requirement labels use exact keys `en`, `kh`, `zh`; language preferences and any legacy aliases should follow the existing portal normalizer rather than introducing competing locale codes.

Academy-authored lesson titles/descriptions, product copy, season titles and announcements do not automatically acquire translations because interface buttons are translated. Prepare approved localized content and agree an adapter/storage contract where the current table only has a single text field. Personal names and identifiers must stay as recorded/approved.

**Existing academy configuration is not all wired into the student UI.** The current contact reader does not consume every `academy_profile` column. For example, logo, Instagram, generic exam passing/attendance settings, fee defaults, tax and display-currency settings must not be assumed to configure the new readiness policy, issued invoices or unused UI features just by being populated. Confirm each producer-to-reader mapping.

## 11. Student-owned activity — integrated; not official coach data

| Source | Fields/data required | Ownership |
|---|---|---|
| `student_portal_progress` | `student_id`, `curriculum_id`, `completed`, `repetition_count`, `updated_at` | Student-reported practice, not official readiness approval. |
| `student_portal_events` | `id`, `actor_id`, `student_id`, `request_key`, `kind`, `payload`, `created_at` | Idempotent personal events. Event kinds include `lesson`, `template`, `workout`, `stat`; the training reader selects the relevant training kinds. |
| `student_portal_preferences` | Own `user_id`, theme/language and update timestamp | Personal presentation preferences. |

Validated personal payloads cover lesson practice, personal routine steps, workout duration/rating and exercise value/unit. Workout events retain a template snapshot for historical display. Preserve their request keys and provenance. Do not manually seed these as official coaching outcomes or allow a personal routine to overwrite an assigned academy plan.

Existing transaction/service dependencies to preserve and verify:

- `portal_take_rate_slot` — login request limiting.
- `student_portal_record_event` — authorized, idempotent personal practice/training recording.
- `portal_place_order` — server-priced atomic order placement.
- `student_portal_cancel_pending_order` — guarded, replay-safe cancellation and stock handling.

Inspect the live function signatures/grants and the actual API call sites before changing them. Do not replace these with separate client-side inserts or send service credentials to the browser.

## 12. History and monthly downloads — already integrated; derived from records

The paginated history page uses 12 sources/categories: attendance, promotions, achievements, assessments, measurements, workouts, posted invoices, issued receipts, legacy payments, orders, recorded learning and personal practice.

Monthly progress exports use seven sections: attendance, assessments, promotions, achievements, personal workouts, recorded learning and personal practice. Daily/class/dated attendance stays separate. Monthly boundaries use the academy timezone; current-month reports stop at the current day. Receipt PDFs come from issued receipt/allocation records, not from monthly progress summaries.

Admin work is to maintain valid, linked, dated official records and preserve history. It is not necessary to create fake report rows, upload a monthly PDF manually or calculate a second set of official totals. If the academy wants immutable monthly report archives, signatures or a true historical assessment revision log, agree that additional lifecycle and integration explicitly.

## 13. Features still needing data contracts AND backend/admin integration

The following are **logical requirements, not a claim that tables with these names already exist or are connected**. Inspect/reuse suitable existing admin resources before proposing schema changes.

| Feature | Data/workflow the admin side must prepare | Remaining integration |
|---|---|---|
| Student inbox/announcements | Explicit student/guardian audience, recipients/student scope, category, approved localized title/body, safe student route, publication/expiry/withdrawal, author/approval evidence, read/dismiss state | The current `portal_notifications` table has `id`, `user_id`, `source_key`, `category`, `title`, `body`, `href`, `permission_key`, `read_at`, `dismissed_at`, `resolved_at`, `created_at`. It is a shared operational resource, not a verified student publication contract. Current student notice API deliberately reports unavailable. Add/verify approved student-safe producers, audience checks and read/dismiss handling; never expose staff notices just because `user_id` matches or `permission_key` is null. |
| Push notifications | Consent/preferences, device endpoint and subscription keys, owning account/student grant, expiry/revocation, safe payload/deep link, delivery/retry/deduplication state | Student-specific subscribe/dispatch is disabled. Approved inbox content, delivery service and ownership rules must be integrated first. Do not seed a subscription table and assume delivery works. |
| Parent/guardian accounts and sibling switching | Verified guardian identity, explicit child grants, permitted capabilities per child, relationship/consent/approval evidence, grant/revocation dates and audit history | Current portal requires a Student account and does not support Parent-role grants/switching. Implement the guardian resolver and per-request child authorization in both applications. Do not infer sibling ownership from shared contacts or rewrite permanent account links when switching. |
| Exam publication/registration/results | Approved cohort/exam, target rank, branch/location, date/time, syllabus/policy version, registration window, capacity, fee, eligibility inputs, coach approval, student application/status, assessor/result, withdrawal/cancellation | Student exam endpoints are intentionally unavailable. Admin publishing, eligibility, registration concurrency/fee handling and official result APIs still need implementation. Rows alone do not enable registration. |
| Issued/public certificate verification | Issuer, student-approved public display identity, certificate/serial, rank/achievement, issue date, source result, private authorized file, verification token/hash, status and revocation | Recorded certificate references/files are supported. A public registry, minimal public projection, issuance and revocation verification service are not implemented. Do not expose a full profile through a public certificate URL. |
| Verified online tuition/payment settlement | Merchant/provider configuration kept server-side; server-priced payment intent, student/invoice/currency/amount, provider transaction/event IDs, verified webhook evidence, idempotent allocation, settlement/refund/reconciliation state | Payment initiation/verification remains disabled. A screenshot, QR display, client callback or staff-entered reference is not a verified provider settlement. Preserve the existing invoice/receipt/credit accounting model. |
| Server-verified QR attendance/check-in | Short-lived scoped token/pass, student and session occurrence, issue/expiry/consumption, nonce/replay protection, revocation, authorized scanner and audit evidence | Current QR-pass/check-in service is disabled. A static student ID/barcode is not an attendance pass. Implement authorized generation/consumption and duplicate/replay handling. |
| Correction requests and makeup booking | Own source attendance, reason, requested correction/replacement, eligibility/entitlement, staff decision, capacity, history and cancellation | Existing readers expose recorded makeups. A complete student request/approval/booking service must be verified or integrated separately. |
| Rich localized content and true revision histories | Approved multilingual lesson/product/announcement metadata; stable asset mapping; versioned assessments/content and any archived report snapshots | Some UI slots exist, but current readers/schema do not supply every proposed field. Agree mappings and APIs first; do not add guessed columns or repurpose staff-only notes. |

## 14. Shared integration rules

- Admin remains authoritative for official student records, attendance corrections, posted accounting, assessments, promotions and publication approval.
- Students may read their authorized records and write only supported personal/transactional actions. They cannot approve their own grades, policies, rankings, payments or promotions.
- Keep public/browser access restricted. The new readiness/ranking tables are intentionally service-only with RLS and browser grants revoked. Use trusted server administration; do not grant browser access simply to simplify an admin form.
- Six student migrations are applied. Relevant registered versions include `20261028115518` (Data API boundary), `20261030081259` (ranking publication), and `20261101001159` (readiness). Reconcile local/live migration history before any automatic push; do not blindly replay old setup scripts against the shared database.
- Preserve existing IDs, foreign keys, unique constraints, transaction semantics and staff access. Student IDs are academy strings; other tables mix integer and UUID IDs. Do not coerce every identifier into a new UUID scheme.
- Regenerate and type-check any shared database types/DTOs after approved schema changes, including the new publication tables. Verify both applications against the same registered migration history.
- Null/unknown/unpublished must stay distinct from zero, completed, paid or approved. Check malformed, expired, withdrawn and deleted records.
- Maintain timestamps and stable IDs for bounded history pagination. Keep official data out of public caches and diagnostic logs. Handoffs should contain schema/mapping and aggregate checks, not children's private records or credentials.
- Validate English, Khmer and Chinese, both themes, phone/tablet/desktop layouts, and real media permissions. Current emulated checks do not substitute for physical-device and authenticated acceptance.

## 15. Please return this preparation checklist

For every module above, provide:

| Module/table | Exists in shared DB? | Required fields/types/FKs verified? | Admin screen/API that owns it | Student reader/API mapping verified? | Missing/invalid data or publication | Proposed action/owner | Approval needed? |
|---|---|---|---|---|---|---|---|
| Fill one row per resource/workflow | | | | | | | |

Prioritize:

1. Account linking/login readiness, official profiles and Drive file access.
2. Current enrollment, dated rosters, attendance and posted accounting/receipts.
3. Readiness rule/lesson/skill mappings and a genuine coach confirmation producer — prepare drafts only.
4. The first consented academy ranking season/list — prepare for academy review only.
5. Published lesson/training/media completeness and safe achievement detail mappings.
6. Student-safe inbox publication; then guardian, exams, payments, certificates, check-in and push integrations according to academy priorities.

State explicitly which items are **data completion**, **publication/academy approval**, or **code/integration work**. For proposed changes, include affected tables/APIs, compatibility with the student application and how isolation and staff workflows will be verified. Do not use invented sample athletes, grades, consent or receipts as production data.

---

## Local developer references

- Current implementation: [readiness/history/report review](readiness-history-reports-2026-11-01.md).
- Requirements draft: [unpublished baseline](readiness-policy-draft.json) and [staff publication/confirmation workflow](readiness-publication-workflow.md).
- Rankings: [approved publication workflow](ranking-publication-workflow.md).
- Source of truth for current readers: `lib/student-data.ts`, `lib/student-scope.ts`, `lib/student-schedule.ts`, `lib/student-history.ts`, `lib/student-receipt.ts`, `lib/student-readiness.ts`, `lib/student-rankings.ts`, `lib/student-progress-report.ts`, and `app/api/student/`.
- Strict publication shapes: `lib/readiness-contract.ts` and `lib/student-rankings.ts`.
- API reference: [OpenAPI document](openapi.json).
- Main development document: [technical specification](../Infinity%20TKD%20Student%20Portal%20Techstack%20Development%20Document.md), especially the current implementation sections 51.14–51.15. Older audit paragraphs describe historical states and must not override these later deliveries.

This handoff was prepared from current source plus read-only schema/publication checks. No academy records, permissions or publications were changed while preparing it.
