# Past-ride import — deferred beyond v1

Decision: 16 October 2026, at the owner's request. The import button, preview dialog, picker adapter and document-picker dependency have been removed from the app. New recordings are the supported way to populate the v1 logbook. GPX and postcard **export** remain available.

Existing rides imported in an earlier preview are preserved. The storage schema retains their provenance. Pure GPX/TCX parsing and duplicate-detection helpers remain in source with synthetic regression fixtures, but there is no reachable import flow in the shipping UI.

The earlier investigation established an important product constraint: summary-only workouts cannot reconstruct GPS positions that were never recorded. A future import release should be evaluated against real GPS-bearing exports, with explicit missing-data explanations, provenance and device testing. No Google Health, Fitbit or Timeline account sync is implemented.

Revisit import only after the core recording, saving and replay experience has passed physical-device testing. Do not advertise historical route recovery without verifying the actual data source.
