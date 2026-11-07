# Muscle explorer review — 14 October 2026

## What changed

Student details, the academy library and the learning page now use a shared Infinity TKD muscle explorer. The interface follows the portal’s red accent, neutral surfaces, existing fonts and touch controls. Source credits sit in the About panel; the teaching workspace is organised around students and academy materials.

Previews open in 2D. Opening 3D mounts one scene, and expanding or opening the studio suspends the underlying preview. Closing the view cancels pending work and releases its renderer, geometries, materials and WebGL context. The learning page’s previously disconnected studio button now opens the shared modal.

Selecting a mapped muscle chip focuses the corresponding structures. The inspector shows its function, Taekwondo relevance and saved related materials. Those resources open in the library or learning page. Material links also support `/library?material=ID` and `/lms?material=ID`.

The modal supports keyboard focus containment, Escape, touch controls and safe areas. Camera controls occupy their own row, so they do not cover the model. Mobile information panels scroll within the workspace; the close button remains available.

## Data and business rules

- Saved `library_asset_muscles` relationships take priority. Primary wins when several structures map to the same group.
- Legacy authored focus zones remain supported. Named kick and category references are labelled as teaching references when no saved mapping exists. Unrecognised or theory-only materials no longer receive an invented generic whole-body heatmap.
- Student colours use only that student’s completed learning materials. Duplicate progress rows and multiple structures in one group do not count the same material twice.
- Colour describes relative teaching emphasis or learning coverage. It does not measure muscle force, strength, fatigue, injury or physical readiness.
- Structure names are normalised carefully: rectus femoris and vastus map to quadriceps; biceps femoris maps to hamstrings. Quadratus muscles, eye obliques and the hand’s adductor pollicis remain separate.
- The 3D geometry is an adult male educational reference. The 2D illustration can be changed per viewer without changing other open viewers or student records.

The live read-only review found 423 muscle records, 81 library materials and 324 saved material/muscle relationships. Every current material had a saved relationship. There were no saved learning-progress records at review time; an empty student coverage view is therefore expected until learning is completed.

No database migration was needed. The existing protected library-save function keeps the legacy curriculum rows aligned with library IDs for the progress foreign key. Anatomy browsing itself writes no records and uses the portal’s existing permitted data reads.

## Performance changes

| Area | Previous viewer | Updated default |
| --- | --- | --- |
| Geometry requested | All body systems, about 60 MB decoded | Muscle-only training bundle, 14,790,884 bytes decoded |
| Compressed muscle geometry | Mixed with unrelated systems | 7,675,999 bytes across four chunks |
| Anatomy triangles | 2,288,268 | 437,500 muscle triangles |
| Layers | Hidden systems still submitted to the renderer | Separate muscle, skeletal and connective bundles; disabled systems are skipped |
| Rendering | Continuous animation-frame polling | Frames requested for interaction and changes; idle view stops |
| Opening a larger view | Could retain the scene underneath | One scene per viewer path |
| Reopening | Repeated downloads and geometry work | Bounded 24 MB decoded-data cache; graphics resources still disposed |
| Loading | Large synchronous construction | Two concurrent chunk requests and short construction batches |
| Failure | Could interrupt the workspace | Local 2D fallback, retry, bounded requests and context-loss handling |

Compact preserves all 738 training structure identifiers and boundaries, with a maximum additional relative simplification error of 0.003. Detailed quality repacks the original retained geometry without simplification. The original source assets remain unchanged. Run `npm run build:anatomy` to regenerate both tiers.

## Verification

- 115 automated tests passed, including saved mapping precedence, student isolation, canonical structure matching, exact atlas links, WebGL capability cleanup, cancellation, gzip handling, geometry bounds, cache limits, idle scheduling and training-bundle integrity.
- Production compilation, TypeScript validation and build-time lint completed with no errors. Existing lint warnings remain in the wider application.
- The anatomy browser check used real model files in headless Edge, with authentication and records replaced by fixtures. It verified 390, 834 and 1440 pixel widths, focus/Escape, selection and isolation, ten open/close cycles, a single canvas, related material navigation, the LMS modal, a lightweight library preview, WebGL context-loss recovery with retry, and local recovery from model HTTP failures. No live data was changed.
- In the final local browser run, first opening took about one second. The scene reported 439,020 drawn triangles including its platform and ten draw calls. After settling, its render count remained unchanged during the idle sample. These are local checks, not a mobile-device frame-rate guarantee.
- Existing business and contact browser checks passed. The production HTTP smoke check passed 65 routes and security cases.
- Changed text files were checked against local private credential values and common credential patterns; no matches were found.

## Remaining device checks

The compact muscle geometry is still substantial for older phones. Lightweight 2D remains the default and the fallback. Physical iPhone/iPad, Android and low-memory GPU checks are still needed before promising a frame rate on those devices. Detailed quality deliberately costs more memory and download time.

## Sources and licences

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International. [Source licence](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html).

Adapted atlas renderer: Copyright (c) 2026 ashemag, MIT licence. The original notice remains in `CloneIntegrate/human-atlas-main/LICENSE`; a distributable copy is included at `public/models/training/LICENSE.renderer.txt`. The training manifests record their source and simplification tier. Public model files contain no student records.
