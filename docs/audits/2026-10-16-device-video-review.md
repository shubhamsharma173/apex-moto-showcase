# Device-review summary — 16 October 2026

This is a sanitized summary of a historical Android device review. The original recordings and detailed private evidence are retained outside this public snapshot. This document includes no source-video links, personal profile details or recorded GPS coordinates.

The review identified 22 issues and improvement opportunities across setup, recording, recovery and presentation. The observations describe the earlier build at the time of review; they are not a statement that every issue remains open. See the [subsequent remediation record](2026-10-16-remediation.md) and [release/device checklist](../release.md) for implementation and retest status.

## Findings retained for engineering context

| Area | Historical observation | Verification needed |
| --- | --- | --- |
| Sensor calibration | Missing motion samples could surface a raw calibration error. | Missing, stale and nonfinite samples; bounded recovery without losing GPS capture. |
| Automatic capture | Returning from the background-permission screen could lose setup intent. | First grant, refusal, interruption and process recreation. |
| Personal content | Sample route promotion remained after the clean-install experience was intended to become personal-only. | Empty install and upgrade while preserving genuine stored records. |
| App restoration | External-app handoffs could return to loading screens or lose navigation context. | Separate cold start, warm resume and process recreation with logs. |
| Forms | Keyboard-visible submission and service/fuel correction flows needed improvement. | Single-tap save, validation, edit/delete and restart persistence. |
| Input interpretation | Odometer targets and unusually large fuel entries needed clearer review. | Unit conversion, optional fields and useful confirmation without inventing vehicle limits. |
| Route handoff | External directions could differ from a route preview. | Accurate handoff labels and explicit route limitations. |
| Maps and replay | Zoom, route scale, replay speed and telemetry labels could mislead. | Short and long synthetic tracks; missing-data states; stable map interactions. |
| Recording feedback | Setup controls and armed/recording states were not always clear. | Permission recovery and visible state transitions backed by native behavior. |
| Summaries | Rounding and time labels obscured short rides and period boundaries. | Small values, moving versus elapsed time, and week/all-time summaries. |
| Controls | Bookmark, empty-state, toast and small-screen interactions needed attention. | Action feedback, accessible layout and state preservation. |
| Diagnostics | The displayed version did not identify the exact native build. | Build metadata available for reproducible device reports. |

## Evidence boundaries

The historical review combined recorded interaction observations with source inspection. It did not prove causes such as operating-system process reclamation, battery behavior or native failures without logs. Layout captures do not establish physical-device GPS reliability.

The later remediation record distinguishes code changes, automated checks and outstanding physical-device retests. No tests were rerun when preparing this publication summary. Extended outdoor, locked-screen, sensor and device-specific checks remain relevant before a store release.
