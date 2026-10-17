# Apex Moto v1 product requirements

## Product intent

Apex Moto helps a motorcyclist choose a ride, capture it, understand it after parking and keep their motorcycle ready for the next trip. Its interface combines a useful route collection and personal activity journal with a motorcycle-focused recorder. The identity, layout and implementation are original. [Research](research.md) records the limited reel observation and the broader publisher claims separately.

Primary users are weekend explorers who want memorable routes and riders who want a dependable private log. The first release prioritizes one rider on one device. It targets iOS and Android through Expo/React Native; web is an accessible preview and a useful desktop journal, with platform limits stated openly.

Success means the rider can complete the choose → record → save → review → export loop, recover their saved data after relaunch, and understand which values are measurements or estimates. There are no speed leaderboards or promised crash/safety assessments.

## Scope and traceability

These acceptance criteria define the intended release behavior. Implementation and automated checks are distinct from physical-device validation; the [release gates](SDLC.md) must be satisfied before store-ready claims.

| ID  | Requirement / rationale             | Acceptance criteria                                                                                                                                                                     | Verification                                    |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| R01 | Distinct mobile home and navigation | Primary destinations are reachable with one tab; deep links/back resolve; record action remains obvious at small widths.                                                                | Mobile-width UI review; route traversal.        |
| R02 | Explore personal routes | Show only recorded rides; search and favourite filters change results; useful first-use/no-match states; route details retain trip context. | Search/filter/detail flow. |
| R03 | Revisit favourite roads | Favourite/unfavourite persists across Home, Logbook and Explore; offline availability describes stored geometry, not downloaded road tiles. | Reload and disconnected test. |
| R04 | Manual ride capture                 | Permission is requested when needed; denial produces an actionable message; start/pause/resume/finish work; pause/gaps do not add straight-line distance.                               | State tests; GPS device test.                   |
| R05 | Opt-in automatic capture            | Toggle starts an explicit armed state; sustained motion begins a ride; short interruptions do not prematurely finish; stopping saves once; disabling stops observation.                 | Capture fixtures; native background matrix.     |
| R06 | Reliable ride metrics               | Distance, moving/stopped time, average/maximum speed and climbing derive from accepted samples; invalid/out-of-order fixes are rejected; unavailable telemetry is not fabricated.       | Domain tests and reference recording.           |
| R07 | Replay and inspection               | Scrubbing updates map marker and corresponding sample values; play/pause reaches the end without overrunning; speed trace is understandable without colour alone.                       | Replay/UI review, missing-sample check.         |
| R08 | Honest lean information             | Native recorded lean uses calibrated mounted-phone telemetry; UI calls it an estimate; missing values stay unavailable; previously imported values retain their provenance.                   | Sensor adapter inspection; device calibration.  |
| R09 | Personal logbook                    | New installs contain no sample rides; real saved rides survive upgrades; deleting a ride updates totals and survives reload. | Save/reload/delete flow.                        |
| R10 | Garage and care                     | Vehicle details, service entries and fill-ups persist; care reminders are explainable and editable, not a roadworthiness verdict.                                                       | Garage/edit/service/fuel/reload flow.           |
| R11 | GPX export               | Export accepted recorded points as GPX, preserving gaps and endpoint privacy. Import is deferred beyond v1. | GPX round-trip/privacy fixtures and native sharing check. |
| R12 | Privacy-aware sharing               | Export defaults to endpoint protection where offered; too-short protected traces do not expose endpoints; explicit exports disclose location content.                                   | Privacy fixture + exported-file inspection.     |
| R13 | Settings and local control          | km/mi choice updates distance/speed consistently and persists; automatic capture defaults off; real saved rides are removable individually or as a history.                             | Settings/reload/delete test.                    |
| R14 | Resilient storage                   | Save success follows durable write; concurrent changes are serialized; corrupt data is preserved with a useful error; no silent reset.                                                  | Storage code review; failure injection.         |
| R15 | Accessible, smooth UI               | Text remains legible, touch controls are large, controls have meaningful labels, reduced motion is respected; long traces do not block routine interaction.                             | Accessibility and performance gates.            |
| R16 | Cross-platform delivery             | Shared app routes run on web, Android and iOS; platform-specific capabilities fail honestly; native config and EAS build profiles are present.                                          | Static/export checks plus signed native builds. |

### Core implementation trace

| Requirements               | Implementation                                                           | Automated evidence / remaining checks                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R04–R05                    | `src/services/recording.ts`, `recording.web.ts`, `src/domain/capture.ts` | `tests/domain/capture.test.ts` covers pure decisions; `tests/recording.test.cjs` exercises mocked adapter contracts. Permissions, process recovery and OS background behavior still need device tests. |
| R06, R08                   | `src/domain/ride.ts`, native recorder sensor adapter                     | `tests/domain/ride.test.ts` covers numerical/filter invariants; real sensor accuracy remains unverified.                                                                                               |
| R07, R15                   | `src/domain/display.ts`, map/chart components                            | `tests/domain/display.test.ts` covers vertex budgets, colour boundaries, elapsed-time positions and missing/gapped telemetry; device frame timing remains unmeasured.                                  |
| R11–R12                    | `src/domain/gpx.ts`, privacy helpers in `ride.ts`                        | `tests/domain/gpx.test.ts`, `ride.test.ts`; inspect the actual UI export flow.                                                                                                       |
| R09, R13–R14               | `src/services/storage.ts`, `src/state/AppContext.tsx`                    | Reload/delete and injected storage failure remain integration acceptance checks.                                                                                                                       |
| R01–R03, R07, R10, R15–R16 | Router screens, shared components, platform maps and configuration       | UI/build/device evidence belongs in the release verification record; passing pure tests is insufficient.                                                                                               |

### Shipped source flows

| Screen                            | Source behavior                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview (`src/app/index.tsx`)    | Recent/all-time totals, latest ride, weekly distance goal and seven-day activity bars.                                                      |
| Explore and route detail          | Search/category filters, bundled Maharashtra route previews and saved selections.                                         |
| Record                            | Manual controls, native opt-in automatic capture, native stationary mount calibration and explicit browser limits.                          |
| Logbook and ride detail           | Search/favourites, editable name/notes/vehicle, deletion, play/scrub telemetry, GPX and single-ride PNG/SVG postcards.                      |
| Garage (`src/app/garage.tsx`)     | Add/edit/select motorcycles, manual odometer and next-service reading, dated service and fuel entries, real ride totals and INR fuel spend. |
| Settings (`src/app/settings.tsx`) | Local display name, units, weekly goal, endpoint protection, saved-ride-history deletion and local-data guidance.           |

New installations start with an empty garage. Only user-entered motorcycles appear. Distance and speed convert with the selected units; fuel remains litres/INR and elevation remains metres. Odometers are user-entered and not incremented automatically from rides. Basic service/fuel entries are not a full accounting system.

## Priority and boundaries

P0 is capture integrity, local persistence, clear privacy, readable mobile navigation, replay and telemetry. P1 is route discovery/saving, GPX export and garage care. Completion of a source implementation does not replace device testing.

Explore contains the rider's saved GPS routes. The authored sample catalogue was removed after the device audit. Saved geometry can be viewed offline; online basemaps still require connectivity. A past ride does not establish current road access, surface, weather or hazards. A route preview is not turn-by-turn navigation.

Automatic capture depends on granted permissions and OS scheduling. A browser tab cannot provide equivalent background behavior. Cold-start-after-termination behavior, device battery use and missed-trip rates require native evidence. Sensor lean is a mounted-phone estimate affected by calibration, vibration and mounting; it is for reflective review.

## Explicit parity backlog

| Capability beyond this local v1                              | Why it remains separate                                                                                    | Required next work                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Past-ride import and provider sync | Deferred by the owner for v1; summary-only health exports cannot recover an unrecorded route. | Revisit reliable GPS sources, provenance, consent and device testing. |
| Friends, cloud feed, invitations, temporary location sharing | Needs an authenticated service and consent/retention controls.                                             | Identity, backend, abuse controls, live expiry and delivery tests.                      |
| Cloud backup and multi-device sync                           | No server is deployed.                                                                                     | Conflict resolution, encryption/key design, recovery, deletion guarantees.              |
| Turn-by-turn directions and full offline maps                | Geometry is not navigation data.                                                                           | Licensed provider, offline pack lifecycle, route restrictions and field validation.     |
| 3D rider models, terrain rendering and video replay export   | Separate renderer/media work; map pitch is a narrower capability.            | Licensing, device memory/performance profiling, render pipeline.                        |
| Platform widgets, Lock Screen/Live Activities                | Native integration and distribution required.                                                              | Platform-specific extensions/configuration and device tests.                            |
| Full share-card/postcard customisation                       | A complete media editor is outside the core capture loop.                                                  | Image composition, private preview, export sizes and native sharing tests.              |
| Automatic monthly postcards and year-long rhythm             | The current overview has calendar-week activity bars and the exporter makes single-ride PNG/SVG postcards. | Calendar aggregation, monthly eligibility, archive and accessible annual chart.         |
| Advanced fuel accounting and scheduled maintenance alerts    | Basic local entries do not provide full accounting or delivered reminders.                                 | Correction flows, odometer provenance, economy calculations and notification lifecycle. |
| Live weather, hazards, emergency response                    | Cannot be represented as working without data and service operations.                                      | Reliable providers, freshness/status handling, coverage and service ownership.          |

These items are deliberately visible as backlog rather than interactive screens pretending a service exists. The user's long-term feature request remains larger than the current v1 boundary.

## Interaction principles

Use dark app surfaces with a legible labelled basemap, restrained bright accents, large numeric typography and readable secondary text. Colour signals state; it never carries meaning alone. Use large primary controls in the recorder, calm motion and immediate feedback on taps. Put destructive controls behind a clear confirmation. Surface loading, empty, denied-permission, unavailable-sensor and storage-error states in the same visual system. Reuse components and tokens across platforms rather than duplicating screens.

All ride details and sharing decisions are made after parking. Progress highlights consistency and exploration; maximum speed remains a private statistic rather than a challenge.

### Design contract

The requested UI/UX Pro Max skill informed hierarchy, form accessibility and mobile interaction review. Its generic search results were adapted to this product rather than treated as a ready-made visual specification. The authored tokens live in `src/theme.ts`.

| Token / pattern                                      | Use                                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Background `#0B100F`, surfaces `#121A18` / `#1A2320` | Quiet dark canvas; elevation and borders establish grouping.                 |
| Text `#F2F5EF`, secondary `#A6B2AA`                  | Readable hierarchy; secondary text still needs device/contrast review.       |
| Accent `#D4F779`                                     | Primary actions, progress and selected state; pair colour with labels/icons. |
| Space Grotesk + DM Sans                              | Display/metrics and readable interface copy respectively.                    |
| Consistent rounded cards and restrained separators   | Group related decisions without crowding the recorder.                       |
| Scrollable, keyboard-aware dialogs                   | Labels, inline validation, loading feedback and an explicit close control.   |
| Estimate labels                           | Provenance stays near the values it qualifies.                               |

The acceptance review must include 375 px layouts, safe areas, keyboard appearance, enlarged text and desktop expansion. Generated road artwork supplies atmosphere; route geometry and numeric data carry the product's meaning. No generated image is a substitute for an actual screenshot or real route evidence.
