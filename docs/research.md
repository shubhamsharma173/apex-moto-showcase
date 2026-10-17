# Product evidence and reconstruction

Research date: 15 October 2026. Product: **Apex Moto**, an independent motorcycle companion. This report separates what was seen, what a publisher claims, and what this project implements. It is not a claim to have recovered another app's source code.

## Target and evidence ledger

| ID | Evidence | Finding | Confidence / boundary |
| --- | --- | --- | --- |
| E01 | [User's Instagram reel](https://www.instagram.com/reel/Ded5n5RzqGH/) inspected in browser | Account/caption identifies `ryval.moto`; a visible ride screen shows a glowing cyan route, a twisty ride, distance, moving time, maximum speed, climbing and a scrub interaction. Caption describes automatic capture. | High for visible content; this is a limited reel observation, not an exhaustive interaction audit. |
| E02 | [Ryval's official site](https://www.joinryval.com/) | Ryval describes automatic background capture, manual recording, short-trip rejection, ride cards, logbook, monthly postcards, garage and friends' temporary location beacons. Its stated capture progression is armed, recording, then saved. The site currently advertises iPhone availability and an Android waitlist. | Publisher claims; recording reliability and battery use were not measured. |
| E03 | [Ryval App Store listing](https://apps.apple.com/ca/app/ryval-motorcycle-car-rides/id6806740090) | Name: Ryval: Motorcycle & Car Rides; developer: Michal Parkitny. Version 1.0.2 notes glowing speed-coloured traces and scrubbable heading, forces, corners and lean. Version 1.0.3 notes mounted-phone lean calibration, 3D/satellite views and rider models. Other listed features include replay/video export, widgets/Live Activities, garage mileage/service/fuel, monthly cards, offline recording, friend visibility and configurable stop duration. | Store metadata and developer release notes; not verified by running the iOS binary. |
| E04 | [Strava saved routes help](https://support.strava.com/en-us/articles/15401678-how-do-i-find-my-saved-routes-on-the-strava-website) | Saved routes can be searched and filtered by criteria such as distance and elevation. | Official interaction reference; not an API integration. |
| E05 | [Strava route following help](https://support.strava.com/en-us/articles/15401749-how-do-i-follow-a-route-on-strava) | A saved route can be selected from recording; public routes can be exported as GPX or TCX. | Official interaction reference; Apex does not connect a Strava account. |
| E06 | REA doctor, CLI 6.5.0, Windows x64, Node 24.18.0 | Codex REA registration missing (`config_drift`); no REA tools connected. Ghidra, IDA, JADX and Hopper providers unavailable. | Read-only diagnostic, exit 1; not application Evidence from REA analysis. |

The website and current store listing disagree on which logbook/share-card capabilities require Pro. Apex does not reproduce that entitlement model. The store version is newer than some promotional material; the reel does not establish every current feature. [E02](https://www.joinryval.com/) [E03](https://apps.apple.com/ca/app/ryval-motorcycle-car-rides/id6806740090)

## Reverse-engineering method and limitations

The requested `reverse-engineer-anything` skill and its `references/connection-and-recovery.md` were read. The prescribed command was run:

```text
npx -y rea-agents@latest doctor --client codex --json
```

The invocation acquired the CLI in npm's cache; no MCP configuration was changed and no analysis engine was installed. The local skill file was present although doctor could not establish its installed identity. No Ryval IPA/APK, source archive or authorized runtime was supplied. Windows cannot run the target's iOS application here. Consequently there are no binary hashes, decompilation results, REA application Evidence IDs, network captures or verified internal algorithms to cite. Browser-session credentials were not collected. Diagnosis does not establish a live REA connection.

The useful reconstruction is at the behavior and interface level: identify the target, inspect public presentation, inventory capabilities, design original flows, and test our own implementation. Source, artwork, branding and private APIs were not copied. Native parity remains bounded by available evidence.

## Original product decisions

- Focus on motorcycles and reflective ride review: a high-contrast cockpit, quiet map presentation, useful trip metrics and vehicle care.
- Combine route discovery and a personal activity log with a private recorder. Keep recording controls large; put detailed analysis after the ride.
- Use opt-in automatic capture. Manual capture remains available when background permission is unavailable.
- Label phone lean and derived telemetry as estimates. Mounted-phone orientation is not a validated measurement of a motorcycle's physical bank angle; no lean is invented from a GPS curve.
- Offer local route geometry and GPX portability. A saved line is distinct from downloaded road maps or turn-by-turn navigation.
- Use examples to make an empty installation explorable; label them as sample rides/routes, and never imply community activity or current road conditions.
- Defer network-dependent social and safety services until identity, consent, delivery, retention and operations exist. Do not manufacture friends, live hazards, weather or rescue coverage.

## Investigation closure

| Question | Resolution |
| --- | --- |
| Which app is in the reel? | Answered: Ryval, linked above. |
| Which visible interaction should inform v1? | Answered within the reel boundary: automatic-capture story, route/metrics view and ride scrubbing. |
| What else is publicly advertised? | Answered as publisher claims in E02–E03, not an installed-app audit. |
| How do Ryval's proprietary internals work? | Unresolved; no binary/runtime evidence. Our capture and telemetry are independent implementations. |
| Does Apex have full Ryval/Strava parity? | No. See [requirements and parity scope](PRD.md) and [release gates](SDLC.md). |

The requested scope is broader than a single release. Deferred capabilities are named explicitly so a polished local v1 cannot be mistaken for a deployed social platform.

## Project asset and route provenance

`scripts/prepare-routes.mjs` requests driving geometry for selected Maharashtra waypoints from the public [OSRM route service](https://project-osrm.org/docs/v5.24.0/api/) and bundles simplified geometry in `src/data/routes.json`. Underlying road data comes from [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Descriptions, categories and elevation figures are editorial examples; durations are routing estimates, not field measurements. `src/data/demo.ts` generates fictional ride times, speed, altitude and lean over that geometry. The hero image is original generated artwork, not a photograph documenting a specific road.

The browser map uses MapLibre with the OpenFreeMap dark vector style and its attribution control. Native maps use the configured platform provider. Preserve attribution and review provider usage terms before production distribution; the public routing endpoint is a development data-preparation dependency, not a production availability guarantee. [OpenFreeMap styles](https://github.com/hyperknot/openfreemap-styles)
