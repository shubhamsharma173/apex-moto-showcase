import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceCapture, CaptureEvent, CaptureState, createCaptureState, setCaptureEnabled } from '../../src/domain/capture';
import { point } from './fixtures';

function feed(state: CaptureState, fromSeconds: number, toSeconds: number, meters: (seconds: number) => number, speed: number): { state: CaptureState; events: CaptureEvent[] } {
  const events: CaptureEvent[] = [];
  for (let seconds = fromSeconds; seconds <= toSeconds; seconds += 5) {
    const result = advanceCapture(state, point(meters(seconds), seconds, { speed }));
    state = result.state;
    if (result.event) events.push(result.event);
  }
  return { state, events };
}

test('capture is disabled by default and opt-out resets every buffer', () => {
  const disabled = createCaptureState();
  assert.equal(advanceCapture(disabled, point(0, 0)).state, disabled);
  const candidate = advanceCapture(createCaptureState(true), point(0, 0)).state;
  assert.equal(candidate.phase, 'candidate');
  assert.deepEqual(setCaptureEnabled(candidate, false), disabled);
});

test('sustained 15 seconds starts with retained candidate and bounded pre-roll', () => {
  let state = feed(createCaptureState(true), 0, 30, () => 0, 0).state;
  const started = feed(state, 35, 50, seconds => (seconds - 30) * 10, 10);
  state = started.state;
  assert.equal(state.phase, 'recording');
  assert.equal(started.events.length, 1);
  assert.equal(started.events[0].type, 'started');
  assert.ok(state.points.length >= 4);
  assert.equal(state.points[0].timestamp, point(0, 25).timestamp);
  assert.ok(state.preRoll.length <= 30);
});

test('speed dip resets candidate and long missing-fix gap cannot satisfy start duration', () => {
  let state = feed(createCaptureState(true), 0, 10, seconds => seconds * 10, 10).state;
  assert.equal(state.phase, 'candidate');
  state = advanceCapture(state, point(120, 15, { speed: 2 })).state;
  assert.equal(state.phase, 'armed');
  state = advanceCapture(state, point(140, 20)).state;
  const gap = advanceCapture(state, point(600, 70));
  assert.equal(gap.state.phase, 'candidate');
  assert.equal(gap.state.candidateStartedAt, point(600, 70).timestamp);
  assert.equal(gap.event, null);
});

test('a real ride auto-finishes after three continuous parked minutes without the idle tail', () => {
  let state = feed(createCaptureState(true), 0, 100, seconds => seconds * 10, 10).state;
  const parked = feed(state, 105, 285, () => 1_000, 0);
  state = parked.state;
  assert.equal(state.phase, 'armed');
  assert.equal(parked.events.length, 1);
  const event = parked.events[0];
  assert.equal(event.type, 'finished');
  if (event.type === 'finished') {
    assert.equal(event.endedAt, point(1_000, 105).timestamp);
    assert.equal(event.points[event.points.length - 1].timestamp, event.endedAt);
    assert.equal(event.reason, 'parked');
  }
});

test('rides shorter than 500 metres are discarded', () => {
  const state = feed(createCaptureState(true), 0, 20, seconds => seconds * 10, 10).state;
  const parked = feed(state, 25, 205, () => 200, 0);
  assert.equal(parked.events[0].type, 'discarded');
  if (parked.events[0].type === 'discarded') assert.ok(parked.events[0].distanceKm < 0.5);
});

test('movement and a long gap both reset parking confirmation', () => {
  let state = feed(createCaptureState(true), 0, 100, seconds => seconds * 10, 10).state;
  state = feed(state, 105, 205, () => 1_000, 0).state;
  state = advanceCapture(state, point(1100, 215, { speed: 10 })).state;
  assert.equal(state.phase, 'recording');
  assert.equal(state.parkedAt, null);
  state = advanceCapture(state, point(1100, 220, { speed: 0 })).state;
  const gap = advanceCapture(state, point(1100, 400, { speed: 0 }));
  assert.equal(gap.event, null);
  assert.equal(gap.state.parkedAt, point(1100, 400).timestamp);
  assert.notEqual(gap.state.points[gap.state.points.length - 1].segment, gap.state.points[0].segment);
});

test('invalid or impossible GPS fixes do not advance a sustained timer', () => {
  let state = advanceCapture(createCaptureState(true), point(0, 0)).state;
  assert.equal(advanceCapture(state, point(100, 15, { accuracy: 200 })).state, state);
  assert.equal(advanceCapture(state, point(100000, 15)).state, state);
  assert.equal(advanceCapture(state, point(100, -1)).state, state);
});

test('recording buffer limit completes a valid ride instead of silently truncating it', () => {
  let state = createCaptureState(true);
  let lastEvent: CaptureEvent | null = null;
  for (let i = 0; i < 10; i += 1) {
    const result = advanceCapture(state, point(i * 100, i * 10), { maxRecordingPoints: 10 });
    state = result.state;
    lastEvent = result.event;
  }
  assert.equal(lastEvent?.type, 'finished');
  if (lastEvent?.type === 'finished') assert.equal(lastEvent.reason, 'capacity');
});

test('start speed and duration thresholds are inclusive, and just below cannot start', () => {
  let state = advanceCapture(createCaptureState(true), point(0, 0, { speed: 15 / 3.6 - 0.001 })).state;
  assert.equal(state.phase, 'armed');
  state = advanceCapture(state, point(5, 1, { speed: 15 / 3.6 })).state;
  state = advanceCapture(state, point(63, 15, { speed: 15 / 3.6 })).state;
  assert.equal(state.phase, 'candidate');
  const result = advanceCapture(state, point(67, 16, { speed: 15 / 3.6 }));
  assert.equal(result.event?.type, 'started');
});

test('park speed threshold is inclusive, but a speed just above resets parking', () => {
  let state = feed(createCaptureState(true), 0, 100, seconds => seconds * 10, 10).state;
  state = advanceCapture(state, point(1001, 105, { speed: 3 / 3.6 })).state;
  assert.equal(state.phase, 'parked');
  state = advanceCapture(state, point(1002, 110, { speed: 3 / 3.6 + 0.001 })).state;
  assert.equal(state.phase, 'recording');
  assert.equal(state.parkedAt, null);
});
