import assert from 'node:assert/strict';
import test from 'node:test';
import { exportGpx, parseGpx } from '../../src/domain/gpx';
import { summarizeRide } from '../../src/domain/ride';
import { point, ride } from './fixtures';

test('GPX roundtrip preserves escaped names, segments, timestamps and calibrated telemetry', () => {
  const original = ride([point(0, 0, { lean: -15 }), point(100, 10, { lean: 20 }), point(1000, 20, { segment: 1 }), point(1100, 30, { segment: 1 })]);
  const xml = exportGpx(original);
  assert.match(xml, /River &amp; ridge &lt;loop&gt;/);
  const imported = parseGpx(xml, { id: 'roundtrip', vehicleId: 'my-bike' });
  assert.equal(imported.id, 'roundtrip');
  assert.equal(imported.vehicleId, 'my-bike');
  assert.equal(imported.name, original.name);
  assert.equal(imported.source, 'import');
  assert.equal(imported.points.length, 4);
  assert.deepEqual(imported.points.map(p => p.segment), [0, 0, 1, 1]);
  assert.equal(imported.points[0].lean, -15);
  assert.equal(imported.endedAt, original.endedAt);
  assert.ok(Math.abs(summarizeRide(imported).distanceKm - 0.2) < 0.001);
});

test('GPX privacy export removes endpoint fixes and refuses a completely hidden route', () => {
  const original = ride(Array.from({ length: 21 }, (_, i) => point(i * 100, i * 10)));
  const imported = parseGpx(exportGpx(original, { privacy: {} }));
  assert.ok(imported.points.length < original.points.length);
  assert.ok(imported.startedAt > original.startedAt);
  assert.throws(() => exportGpx(ride(original.points.slice(0, 4)), { privacy: {} }), /visible GPS/);
});

test('rejects DTDs, entity expansion and malformed XML without external processing', () => {
  const xml = exportGpx(ride([point(0, 0), point(100, 10)]));
  for (const malformed of [
    xml.replace('<gpx ', '<!DOCTYPE gpx [<!ENTITY x SYSTEM "file:///private">]><gpx '),
    xml.replace('River &amp; ridge &lt;loop&gt;', '&unknown;'),
    xml.replace('</trkseg>', '</oops>'),
    xml.replace('lat="0.0000000"', 'lat="0" lat="1"'),
    xml + '<gpx/>',
    xml.slice(0, -6),
    xml.replace('</gpx>', '<?run command="bad"?></gpx>'),
    xml.replace('River &amp; ridge &lt;loop&gt;', '&#0;'),
  ]) assert.throws(() => parseGpx(malformed));
});

test('untimed and invalid coordinate tracks produce actionable errors', () => {
  const xml = exportGpx(ride([point(0, 0), point(100, 10)]));
  assert.throws(() => parseGpx(xml.replace(/<time>.*?<\/time>/g, '')), /untimed/);
  assert.throws(() => parseGpx(xml.replace('lat="0.0000000"', 'lat="95"')), /invalid coordinate/);
  assert.throws(() => parseGpx(xml.replace(/<time>.*?<\/time>/, '<time>yesterday</time>')), /ISO timestamp/);
  assert.throws(() => parseGpx(xml.replace(/<time>.*?<\/time>/, '<time>2026-02-30T08:00:00Z</time>')), /timestamp/);
  assert.throws(() => parseGpx('x'.repeat(10_000_001)), /10 MB/);
});

test('large ordinary whitespace-separated tracks stay parseable', () => {
  const original = ride(Array.from({ length: 3_000 }, (_, i) => point(i * 10, i)));
  const parsed = parseGpx(exportGpx(original));
  assert.equal(parsed.points.length, 3_000);
});

test('reader supports namespaces, scientific coordinate notation and self-closing unknown extensions', () => {
  const xml = `<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Morning &#38; road</name><trkseg>
    <trkpt lat="0e0" lon="0"><time>2026-10-15T08:00:00Z</time><extensions><unknown/></extensions></trkpt>
    <trkpt lat="0" lon="1e-3"><time>2026-10-15T08:00:10+00:00</time></trkpt>
  </trkseg></trk></gpx>`;
  const parsed = parseGpx(xml);
  assert.equal(parsed.name, 'Morning & road');
  assert.equal(parsed.points.length, 2);
});
