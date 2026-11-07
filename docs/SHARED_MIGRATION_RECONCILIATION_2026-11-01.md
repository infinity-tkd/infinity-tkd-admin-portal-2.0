# Shared student migration reconciliation

1 November 2026 · Infinity TKD

Six student-portal schema migrations were already registered in the connected shared database but absent from the admin repository. The first four student source filenames used earlier local timestamps than the database registration. Importing their definitions is required for an isolated install/upgrade to provide the tables and functions that the new admin preparation workflow uses.

This work read `supabase_migrations.schema_migrations` metadata and registered SQL only. It did not apply SQL, repair migration history, seed records or change the sibling student repository. These are copies of existing registered migrations, not newly generated migrations or an instruction to replay them live.

## Canonical imports

| Registered version/name | Sibling source filename | Review |
| --- | --- | --- |
| `20261026030859_student_portal_self_tracking` | `20261026030800_student_portal_self_tracking.sql` | Same SQL after outer whitespace normalization |
| `20261026031101_student_portal_pending_order_cancel` | `20261026031033_student_portal_pending_order_cancel.sql` | Same SQL after outer whitespace normalization |
| `20261026130445_student_portal_belt_aliases` | `20261026130420_student_portal_belt_aliases.sql` | Same SQL after outer whitespace normalization |
| `20261028115518_student_portal_data_api_boundary` | `20261026131549_student_portal_data_api_boundary.sql` | Only a blank line/end-newline differs; policy text is unchanged |
| `20261030081259_student_portal_ranking_publications` | Same version/name | Same SQL after outer whitespace normalization |
| `20261101001159_student_portal_readiness` | Same version/name | Same SQL after outer whitespace normalization |

The admin copies live in `supabase/migrations` under the exact registered versions above. Their content comes from the registered statements, normalized to LF and one final newline. The companion `supabase/student-migration-imports.json` records the original registered statement MD5, reviewed source SHA-256, and normalized imported SHA-256. No SQL body was changed to make a hash match.

The scripts contain schema, policies and service-only functions. Function bodies contain transactional insert/update logic, but installing these migrations does not invoke those functions, publish readiness/rankings or create athletes/receipts/consent. The belt-alias helper is application taxonomy, not a seeded official belt catalog.

## Verification

Run from the admin root:

```sh
node scripts/check-shared-student-migrations.mjs
```

When the sibling source is available, also compare the reviewed source files:

```sh
node scripts/check-shared-student-migrations.mjs --source "../infinitytkd student portal 2.0/supabase/migrations"
```

An optional `--live-metadata file.json` compares a supplied read-only metadata snapshot against the manifest. Its array must contain `version`, `name`, `statements_md5`, as returned by this read-only query:

```sql
select version, name,
       md5(array_to_string(statements, E'\n')) as statements_md5
from supabase_migrations.schema_migrations
where name like 'student_portal_%'
order by version;
```

The checker itself has no credentials, network requests or database write capability. Hash checks normalize line endings for Windows/Linux checkout compatibility. A change requires source/registered SQL review; do not update the manifest simply to silence a failure.

The isolated schema test applies the imports after the existing tested academy foundation, confirms empty publication tables and Student browser isolation, and preserves staff access. A truly empty database still needs the academy's base schema/auth setup first; these six additions are not a replacement for that foundation.

## Existing older admin discrepancies

The same read-only history inspection found these older registrations:

| Registered version/name | Existing local source/history situation |
| --- | --- |
| `20261011165119_portal_production_upgrade_20261011` | Consolidated historical upgrade; multiple older local component files are not separate registered migrations |
| `20261011165527_portal_policy_optimization_20261011` | Local component filename is `20261011090100_portal_policy_optimization.sql` |
| `20261011165644_portal_validate_existing_records_20261011` | Local component filename is `20261011090200_portal_validate_existing_records.sql` |
| `20261011220353_portal_realtime_sync` | Local filename is `20261011215930_portal_realtime_sync.sql` |
| `20261012072924_portal_achievement_integrity` | Local filename is `20261012065927_portal_achievement_integrity.sql` |

Those older aliases/baselines were not renamed, re-registered or replayed in this reconciliation. Matching names alone is insufficient proof for a history repair. Existing matching registrations for Telegram contacts, membership/makeup notifications, operations and counter-sale validation remain unchanged.

## Release rules

- On the current live project, the six imported student versions are already applied. Do not run their SQL again or mark them reverted.
- Both repositories should adopt a single agreed canonical migration history. The student team must review/rename its four earlier local filenames, or use an explicitly reviewed release process, before automatic pushes. This task did not edit those files.
- Do not run a blanket `supabase db push` against the shared live database while older baseline/alias differences remain. Reconcile the migration list with the actual registered history and planned release subset first.
- A migration applied through a tool that chooses the registration timestamp may differ from the earlier CLI-created local timestamp. Capture its actual registered version and reconcile local release history once; do not reapply the migration to fix the filename.
- New admin changes depend on the already installed student publication storage. Fresh/test deployments must install the canonical student imports before the new admin preparation migration.
- No readiness policy, ranking entry, consent evidence, confirmation or official result is approved by migration validation.
