# Privacy and security design

This is the repository's implementation-oriented privacy description, not a statement that the app has completed store/privacy review. Apex Moto's v1 architecture stores ride data locally and has no account or application backend. Native platform behavior, map providers, explicit sharing and OS backups are separate data boundaries.

Known dependency advisories and their assessed tooling paths are recorded separately in [security.md](security.md).

## Data inventory

| Data | Purpose | Storage / recipients | Retention |
| --- | --- | --- | --- |
| Precise coordinates and timestamps | Record route and compute ride metrics | App-local ride/checkpoint records | Until deletion or app data removal; external backups may persist. |
| Speed, heading, altitude, accuracy | Ride display and quality filtering | With local points | Same as ride. |
| Calibrated phone lean estimate | Reflective telemetry | With points when available | Same as ride; no medical/safety assessment. |
| Vehicle, service and fuel details | Attribute rides and track care | Local settings/garage data | Until changed or app data is removed. |
| Saved route selections and units | Personal preferences | Local data | Until changed or cleared. |
| Previously imported rides | Preserve records saved in earlier previews | Existing app-local ride records; no new import flow in v1 | Until removed; source file remains separately owned. |
| Exported GPX/share content | User-directed portability | OS share destination or browser download | Recipient/filesystem controlled; app deletion cannot recall copies. |
| Map requests | Display online maps | OpenFreeMap/OSM-derived map assets through MapLibre on native and web | Provider controlled; viewport requests may reveal approximate area and network metadata. |

The app does not implement ads, a social graph, cloud ride uploads or an application analytics service. Do not add them without revising this inventory and the permission/share flows. A dependency's presence is not evidence that a feature sends data; verify runtime traffic before preparing store disclosures.

## Permission and consent model

Import is deferred beyond v1. No Google Health or Fitbit connection exists and no health credentials are requested or stored. Existing imported GPS rides are preserved during upgrade.

- Opening stored routes and the journal must not require location permission.
- Manual recording requests foreground location in context. Automatic/background capture requires an explicit opt-in and applicable OS permission; denial keeps a useful non-recording app.
- Explain recording state continuously. Stop subscriptions when the rider disables the feature; never infer permission from a remembered toggle alone.
- Sensor availability and calibration are separate from location consent. An unavailable value remains unavailable.
- Exports invoke an explicit share/download action. No file-picker or import action is exposed.

Platform permission dialogs and background restrictions are governed by the SDK/OS. The native implementation must be tested with denied, limited and revoked permissions, including changes made outside the app. [Expo SDK 57 location](https://docs.expo.dev/versions/v57.0.0/sdk/location/)

## Export protection

The domain privacy helper trims a configurable distance from both trace ends (300 metres by default) and can remove circular private zones. It conservatively drops fixes, splits segments when a removed area is crossed and never mutates the stored ride. A short ride can have no remaining exportable trace; that must produce a clear empty-protection outcome, not an unprotected fallback.

Endpoint trimming is not anonymisation. Remaining roads, timestamps, repeated routes, names or notes can identify a home or person. UI privacy controls must be connected to the export operation; the existence of a tested helper alone does not mean every export is protected. Private-zone editing is a separate UI capability and must not be claimed merely because the domain supports zones.

## Threat model

| Threat / boundary | Existing design | Residual risk and required verification |
| --- | --- | --- |
| Someone accesses an unlocked device | No public account/feed; OS app sandbox | Local data is not encrypted by Apex; device access/backups can expose it. |
| Export exposes home/work | Endpoint trimming and segment-aware redaction | Verify actual UI export path; inference remains possible. |
| Exported data contains XML markup | Escape names and metadata; bound accepted data | Verify actual shared GPX and postcard output. |
| Noisy/spoofed GPS creates false conclusions | Timestamp/accuracy/jump filtering | Device GPS is not trusted for safety or legal evidence. |
| Storage race loses a ride | Serialized writes and chunk journals with metadata head committed last | Check background/foreground coordination and forced-termination recovery. |
| Corrupt stored JSON triggers silent data loss | Preserve source records and expose errors | Current validation is structural, not a complete migration/repair system. |
| Online map supplier sees browsing area | Clear provider boundary | Audit provider requests and disclosure before release; offline geometry does not imply offline tiles. |
| A future network feature leaks locations | No application backend in v1 | Require authentication, authorization, consent, expiry and deletion before adding sharing. |
| Sensitive traces enter source/issues | Synthetic test fixtures outside the runtime app | Review staged files; never include personal GPX or recordings in public bug reports. |

## Deletion and retention

The ride detail can delete an individual saved ride. Settings can clear saved real/imported ride history after confirmation; it keeps the garage, preferences, saved route selections and current recording. This is not a whole-device or whole-app erase. To remove every local record, stop recording and use the operating system's app-data removal/uninstall controls. Files already exported, OS backups and provider-side logs are outside those actions. Do not promise cryptographic erasure from flash storage.

There is no server-side retention policy because there is no server. Before public distribution, test the deletion flows after relaunch and publish a user-facing policy at a stable URL. Complete store data disclosures from the shipping binary and configured services, not from assumptions about the framework.

## Security release checklist

1. No secrets, personal traces, tokens or session captures committed.
2. Permission text matches real usage; automatic capture is off by default and revocation is respected.
3. Every location export is intentional; redaction is verified on the exported file.
4. Export, migration and storage-failure tests pass; the app does not hide a failed save.
5. No undocumented data recipients; map/provider and OS backup boundaries are disclosed.
6. Native build permissions and dependencies reviewed for both platforms.
