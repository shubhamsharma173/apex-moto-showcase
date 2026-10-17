import assert from "node:assert/strict";
import test from "node:test";
import { parseGpx, parseTcx, exportGpx } from "../../src/domain/gpx";
import { summarizeRide } from "../../src/domain/ride";
import { findDuplicateRide } from "../../src/domain/imports";

const namespace = "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2";
const time = (seconds: number) =>
  new Date(Date.UTC(2026, 9, 10, 8, 0, seconds)).toISOString();
const fix = (seconds: number, lon: number | null, extra = "") =>
  `<Trackpoint><Time>${time(seconds)}</Time>${lon === null ? "" : `<Position><LatitudeDegrees>18.5</LatitudeDegrees><LongitudeDegrees>${lon}</LongitudeDegrees></Position>`}${extra}</Trackpoint>`;
const tcx = (tracks: string, notes = "") =>
  `<?xml version="1.0"?><TrainingCenterDatabase xmlns="${namespace}" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Activities><Activity Sport="Biking"><Id>${time(0)}</Id><Lap StartTime="${time(0)}"><TotalTimeSeconds>9999</TotalTimeSeconds><DistanceMeters>999999</DistanceMeters>${tracks}</Lap>${notes}</Activity></Activities></TrainingCenterDatabase>`;
const track = (...points: string[]) => `<Track>${points.join("")}</Track>`;
const valid = () => tcx(track(fix(0, 73), fix(10, 73.001), fix(20, 73.002)));

test("Fitbit TCX imports timed GPS, altitude and measured speed, ignoring health fields and summary totals", () => {
  const r = parseTcx(
    tcx(
      track(
        fix(
          0,
          73,
          "<AltitudeMeters>100</AltitudeMeters><HeartRateBpm><Value>130</Value></HeartRateBpm>",
        ),
        fix(
          10,
          73.001,
          "<AltitudeMeters>105</AltitudeMeters><Extensions><ns3:TPX><ns3:Speed>10.5</ns3:Speed></ns3:TPX></Extensions>",
        ),
      ),
      "<Notes>Morning &amp; mountains</Notes>",
    ),
  );
  assert.equal(r.importFormat, "tcx");
  assert.equal(r.source, "import");
  assert.equal(r.name, "Morning & mountains");
  assert.equal(r.points[0].speed, null);
  assert.equal(r.points[1].speed, 10.5);
  assert.equal(r.points[1].altitude, 105);
  assert.equal(r.points[1].lean, undefined);
  assert.equal("heartRate" in r.points[0], false);
  const summary = summarizeRide(r);
  assert.equal(summary.durationSeconds, 10);
  assert.ok(summary.distanceKm > 0.1 && summary.distanceKm < 0.11);
  assert.ok(r.importWarnings?.[0].includes("Heart rate"));
});

test("TCX track boundaries and GPS-less samples preserve discontinuities", () => {
  const r = parseTcx(
    tcx(
      track(
        fix(0, 73),
        fix(5, 73.0005),
        fix(10, null),
        fix(15, 74),
        fix(20, 74.0005),
      ) + track(fix(25, 75), fix(30, 75.0005)),
    ),
  );
  assert.equal(r.points.length, 6);
  assert.deepEqual(
    r.points.map((p) => p.segment),
    [0, 0, 1, 1, 2, 2],
  );
  assert.ok(summarizeRide(r).distanceKm < 0.2);
  assert.ok(r.importWarnings?.some((w) => w.includes("1 samples")));
});

test("TCX summary-only and indoor activities explain that GPS cannot be reconstructed", () => {
  for (const xml of [tcx(""), tcx(track(fix(0, null), fix(10, null)))]) {
    assert.throws(() => parseTcx(xml), /no usable GPS route/);
  }
});

test("TCX rejects incomplete positions, invalid time and duplicate point fields", () => {
  assert.throws(
    () =>
      parseTcx(valid().replace("<LongitudeDegrees>73</LongitudeDegrees>", "")),
    /invalid coordinate/,
  );
  assert.throws(
    () => parseTcx(valid().replace("18.5", "999")),
    /invalid coordinate/,
  );
  assert.throws(
    () =>
      parseTcx(
        valid()
          .replace(time(0), "2026-02-30T08:00:00Z")
          .replaceAll(time(0), "2026-02-30T08:00:00Z"),
      ),
    /timestamp/,
  );
  assert.throws(
    () =>
      parseTcx(valid().replace("</Time>", `</Time><Time>${time(0)}</Time>`)),
    /duplicate timestamps/,
  );
  assert.throws(
    () =>
      parseTcx(
        valid().replace(
          "</LatitudeDegrees>",
          "</LatitudeDegrees><LatitudeDegrees>0</LatitudeDegrees>",
        ),
      ),
    /Duplicate latitude/,
  );
});

test("TCX validates XML and forbids DTDs, external entities and wrong roots", () => {
  assert.throws(
    () =>
      parseTcx(
        `<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///private">]>${valid()}`,
      ),
    /DTDs/,
  );
  assert.throws(
    () => parseTcx(valid().replace("</Trackpoint>", "</Track>")),
    /mismatched/,
  );
  assert.throws(() => parseTcx(valid() + "<Other/>"), /one root/);
  assert.throws(
    () => parseTcx(valid().replace(namespace, "https://example.invalid")),
    /namespace/,
  );
  assert.throws(() => parseTcx("<html>error</html>"), /not a TCX/);
});

test("TCX rejects multiple activities rather than joining separate rides", () => {
  assert.throws(
    () =>
      parseTcx(
        valid().replace(
          "</Activities>",
          `<Activity Sport="Biking"/></Activities>`,
        ),
      ),
    /one activity/,
  );
});

test("TCX exports back to GPX with gaps and measured telemetry intact", () => {
  const r = parseTcx(
    tcx(
      track(fix(0, 73), fix(10, 73.001)) + track(fix(60, 74), fix(70, 74.001)),
    ),
  );
  const restored = parseGpx(exportGpx(r));
  assert.deepEqual(restored.points, r.points);
  assert.equal(restored.importFormat, "gpx");
});

test("repeat imports find the existing GPS track and preserve edited ride metadata", () => {
  const r = parseTcx(valid());
  const saved = {
    ...r,
    id: "saved",
    name: "My renamed ride",
    notes: "Keep me",
  };
  assert.equal(findDuplicateRide({ ...r, id: "new-import" }, [saved]), saved);
  assert.equal(
    findDuplicateRide(
      {
        ...r,
        points: r.points.map((p, i) => ({
          ...p,
          longitude: p.longitude + (i === 1 ? 0.01 : 0),
        })),
      },
      [saved],
    ),
    undefined,
  );
  assert.equal(findDuplicateRide(r, [{ ...saved, source: "demo" }]), undefined);
});

test("TCX file and sample limits also bound GPS-less inputs", () => {
  assert.throws(() => parseTcx(" ".repeat(10_000_001)), /10 MB/);
  assert.throws(
    () =>
      parseTcx(
        tcx(track(...Array.from({ length: 50_001 }, () => fix(0, null)))),
      ),
    /50,000/,
  );
});
