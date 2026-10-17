/* global __dirname */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));

function setup({ values = new Map(), background = true, granted = true, web = false, failWrite = false, os = 'ios', backgroundSupported = background, appState = 'active', requestBackground, motionSample } = {}) {
  const clock = { now: 1760000000000 };
  const recorded = new Map();
  let task, watch, hidden, watching = false, running = false, requests = 0, accuracy = null, backgroundRequests = 0;
  const stateListeners = new Set();
  const nativeAppState = { currentState: appState, addEventListener: (_, callback) => { stateListeners.add(callback); return { remove: () => stateListeners.delete(callback) }; } };
  let fail = failWrite;
  const storage = {
    getValue: async (key, fallback) => values.has(key) ? JSON.parse(values.get(key)) : fallback,
    setValue: async (key, value) => { if (fail) { fail = false; throw new Error('Storage is full'); } values.set(key, JSON.stringify(value)); },
    saveRide: async (ride) => recorded.set(ride.id, JSON.parse(JSON.stringify(ride))),
    loadPointJournal: async (key) => values.has(key) ? JSON.parse(values.get(key)) : null,
    savePointJournal: async (key, metadata, points) => {
      if (fail) { fail = false; throw new Error('Storage is full'); }
      values.set(key, JSON.stringify({ metadata, points }));
    },
  };
  const location = {
    Accuracy: { High: 4, Balanced: 3 }, ActivityType: { AutomotiveNavigation: 1 },
    hasServicesEnabledAsync: async () => true,
    requestForegroundPermissionsAsync: async () => { requests++; return { granted }; },
    getForegroundPermissionsAsync: async () => ({ granted }),
    requestBackgroundPermissionsAsync: async () => { backgroundRequests++; return requestBackground ? await requestBackground() : { granted: background }; },
    getBackgroundPermissionsAsync: async () => ({ granted: background }),
    isBackgroundLocationAvailableAsync: async () => backgroundSupported,
    hasStartedLocationUpdatesAsync: async () => running,
    startLocationUpdatesAsync: async (_, options) => { running = true; accuracy = options.accuracy; },
    stopLocationUpdatesAsync: async () => { running = false; },
    watchPositionAsync: async (_, callback) => { watch = callback; watching = true; return { remove: () => { watching = false; } }; },
    getCurrentPositionAsync: async () => position(0, 0),
  };
  const motion = {
    isAvailableAsync: async () => !!motionSample,
    requestPermissionsAsync: async () => ({ granted: true }),
    getPermissionsAsync: async () => ({ granted: true }),
    setUpdateInterval: () => {},
    addListener: callback => {
      const timer = setInterval(() => { clock.now += 100; callback(motionSample()); }, 80);
      return { remove: () => clearInterval(timer) };
    },
  };
  const taskManager = { isTaskDefined: () => false, defineTask: (_, callback) => { task = callback; }, isAvailableAsync: async () => true };
  const mods = { 'expo-location': location, 'expo-task-manager': taskManager, 'expo-sensors': { DeviceMotion: motion }, 'react-native': { Platform: { OS: os }, AppState: nativeAppState } };
  const disk = new Map();
  const diskWrites = [];
  let writeFailureKey = null;
  mods['@react-native-async-storage/async-storage'] = {
    getItem: async key => disk.get(key) ?? null,
    setItem: async (key, value) => {
      if (writeFailureKey === key) { writeFailureKey = null; throw new Error('Disk unavailable'); }
      diskWrites.push({ key, value }); disk.set(key, value);
    },
    removeItem: async key => { disk.delete(key); },
    getAllKeys: async () => [...disk.keys()],
    multiGet: async keys => keys.map(key => [key, disk.get(key) ?? null]),
    multiRemove: async keys => { for (const key of keys) disk.delete(key); },
  };
  const cache = new Map();
  const doc = { visibilityState: 'visible', addEventListener: (_, callback) => { hidden = callback; } };
  const position = (offset, speed = 12, latitude = 12 + offset / 5000000) => ({ timestamp: clock.now + offset, coords: { latitude, longitude: 77, speed, accuracy: 5, altitude: 900, heading: 90 } });
  const navigator = { geolocation: {
    getCurrentPosition: (yes) => { clock.now += 1000; yes(position(0)); },
    watchPosition: (yes) => { watch = yes; watching = true; return 1; },
    clearWatch: () => { watching = false; },
  } };
  class MockDate extends Date { static now() { return clock.now; } }
  const globals = { console, Date: MockDate, setTimeout, clearTimeout, navigator, window: { isSecureContext: true }, document: doc };
  function load(filename) {
    filename = path.normalize(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} }; cache.set(filename, mod);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const requireLocal = (id) => {
      if (id === './storage') return storage;
      if (mods[id]) return mods[id];
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), `${id}.ts`));
      throw new Error(`Unexpected import ${id}`);
    };
    const fn = vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, globals, { filename });
    fn(requireLocal, mod, mod.exports);
    return mod.exports;
  }
  const service = load(path.join(root, `src/services/recording${web ? '.web' : ''}.ts`));
  const actualStorage = load(path.join(root, 'src/services/storage.ts'));
  return { service, values, recorded, clock, actualStorage, diskWrites, disk, failDiskKey(key) { writeFailureKey = key; }, get running() { return running; }, get watching() { return watching; }, get requests() { return requests; }, get accuracy() { return accuracy; }, get backgroundRequests() { return backgroundRequests; },
    setAppState(value) { nativeAppState.currentState = value; for (const callback of stateListeners) callback(value); },
    failNextWrite() { fail = true; },
    position,
    async fix(offset = 2000, speed = 12, latitude) { const value = position(offset, speed, latitude); clock.now = value.timestamp; if (web || watching) { watch(value); await service.getRecordingSnapshot(); } else await task({ data: { locations: [value] } }); return value; },
    async deliver(value) { await task({ data: { locations: [value] } }); },
    async hide() { doc.visibilityState = 'hidden'; hidden(); await service.getRecordingSnapshot(); },
  };
}

test('Android manual recording uses a location service without opening Always permission settings', async () => {
  const env = setup({ os: 'android', background: false, backgroundSupported: true });
  await env.service.startRecording('');
  assert.equal(env.backgroundRequests, 0);
  assert.equal(env.running, true);
  assert.equal(env.watching, false);
  await env.fix();
  assert.equal((await env.service.getRecordingSnapshot()).points.length, 1);
  assert.equal((await env.service.getRecordingSnapshot()).error, null);
});

test('Android waits for the permission activity to return before starting the location service', async () => {
  const env = setup({ os: 'android', appState: 'background' });
  const starting = env.service.startRecording('');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(env.running, false);
  env.setAppState('active');
  await starting;
  assert.equal(env.running, true);
});

test('Android automatic capture still requires Always permission', async () => {
  const env = setup({ os: 'android', background: false, backgroundSupported: true });
  await assert.rejects(env.service.setAutomaticCapture(true, ''), /Always location/);
  assert.equal(env.backgroundRequests, 1);
  assert.equal(env.running, false);
});

test('automatic opt-in survives process recreation in permission settings without prompting again', async () => {
  let completePermission;
  const env = setup({ os: 'android', background: false, backgroundSupported: true, requestBackground: () => new Promise(resolve => { completePermission = resolve; }) });
  const enabling = env.service.setAutomaticCapture(true, 'bike-1');
  for (let i = 0; i < 20 && !completePermission; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(completePermission, 'permission request was reached');
  const persisted = JSON.parse(env.values.get('recording-draft'));
  assert.equal(persisted.metadata.pendingAutomatic.vehicleId, 'bike-1');
  const restored = setup({ os: 'android', values: new Map(env.values) });
  const snapshot = await restored.service.getRecordingSnapshot();
  assert.equal(snapshot.status, 'armed');
  assert.equal(snapshot.automatic, true);
  assert.equal(restored.running, true);
  assert.equal(restored.requests + restored.backgroundRequests, 0);
  assert.equal(JSON.parse(restored.values.get('recording-draft')).metadata.pendingAutomatic, undefined);
  for (const options of [{ background: false, backgroundSupported: true }, { expired: true }]) {
    const denied = setup({ os: 'android', values: new Map(env.values), ...options });
    if (options.expired) denied.clock.now += 16 * 60_000;
    assert.equal((await denied.service.getRecordingSnapshot()).automatic, false);
    assert.equal(denied.running, false);
    assert.equal(denied.requests + denied.backgroundRequests, 0);
  }
  completePermission({ granted: true });
  await enabling;
  await env.service.setAutomaticCapture(false, 'bike-1');
  await restored.service.setAutomaticCapture(false, 'bike-1');
});

test('automatic setup persistence failure leaves no armed service or pending opt-in', async () => {
  const initial = setup({ failWrite: true });
  await assert.rejects(initial.service.setAutomaticCapture(true, ''), /Storage is full/);
  assert.equal((await initial.service.getRecordingSnapshot()).automatic, false);
  assert.equal(initial.running, false);
  const env = setup({ background: false, backgroundSupported: true, requestBackground: async () => { env.failNextWrite(); return { granted: true }; } });
  await assert.rejects(env.service.setAutomaticCapture(true, ''), /Storage is full/);
  assert.equal(env.running, false);
  assert.equal((await env.service.getRecordingSnapshot()).status, 'idle');
  assert.equal(JSON.parse(env.values.get('recording-draft')).metadata.pendingAutomatic, undefined);
});

test('missing rotation samples give a readable calibration error while GPS keeps recording', async () => {
  const env = setup({ motionSample: () => ({ acceleration: { x: 0, y: 0, z: 0 }, orientation: 0 }) });
  await env.service.startRecording('bike-1');
  await assert.rejects(env.service.calibrateLean(), /Reliable orientation data/);
  assert.equal(env.running, true);
  await env.fix();
  const snapshot = await env.service.getRecordingSnapshot();
  assert.equal(snapshot.status, 'recording');
  assert.equal(snapshot.lean, null);
  assert.equal(snapshot.points.length, 1);
  await env.service.discardRecording();
});

test('fresh stationary orientation samples calibrate, then absent rotation remains unavailable', async () => {
  let partial = false;
  const env = setup({ motionSample: () => ({ rotation: partial ? undefined : { gamma: 0.1 }, acceleration: { x: 0, y: 0, z: 0 }, orientation: 0 }) });
  await env.service.startRecording('bike-1');
  try {
    await env.service.calibrateLean();
    assert.equal((await env.service.getRecordingSnapshot()).lean, 0);
    partial = true;
    await new Promise(resolve => setTimeout(resolve, 550));
    await env.fix();
    assert.equal((await env.service.getRecordingSnapshot()).lean, null);
    assert.equal(env.running, true);
  } finally { await env.service.discardRecording(); }
});

test('native recording deduplicates, persists, segments pauses and saves GPS rides', async () => {
  const env = setup(); const s = env.service;
  await s.startRecording('bike-1');
  const first = await env.fix(); await env.deliver(first);
  assert.equal((await s.getRecordingSnapshot()).points.length, 1);
  await s.pauseRecording();
  assert.equal(env.running, false);
  await env.deliver(env.position(1000));
  assert.equal((await s.getRecordingSnapshot()).points.length, 1);
  await s.resumeRecording(); await env.fix(2000, 12, 12.001);
  const snapshot = await s.getRecordingSnapshot();
  assert.equal(snapshot.points[0].segment, 0); assert.equal(snapshot.points[1].segment, 1);
  const ride = await s.finishRecording();
  assert.equal(ride.source, 'gps'); assert.equal(ride.points.length, 2);
  assert.equal(env.recorded.size, 1); assert.equal(env.running, false);
  assert.equal((await s.getRecordingSnapshot()).status, 'idle');
});

test('native restores an active draft without prompting and deduplicates replayed fixes', async () => {
  const first = setup(); await first.service.startRecording('bike-1');
  const fix = await first.fix();
  const restored = setup({ values: first.values }); restored.clock.now = first.clock.now;
  const snapshot = await restored.service.getRecordingSnapshot();
  assert.equal(snapshot.status, 'recording'); assert.equal(snapshot.points.length, 1);
  assert.equal(restored.requests, 0); assert.equal(restored.running, true);
  await restored.deliver(fix);
  assert.equal((await restored.service.getRecordingSnapshot()).points.length, 1);
});

test('automatic capture saves a confirmed ride after parking and re-arms', async () => {
  const env = setup(); const s = env.service;
  await s.setAutomaticCapture(true, 'bike-1');
  assert.equal((await s.getRecordingSnapshot()).status, 'armed');
  assert.equal(env.accuracy, 3);
  for (let i = 0; i < 16; i++) await env.fix(5000, 12, 12 + i * 0.0006);
  assert.equal((await s.getRecordingSnapshot()).status, 'recording');
  assert.equal(env.accuracy, 4);
  for (let i = 0; i < 14; i++) await env.fix(15000, 0, 12 + 15 * 0.0006);
  assert.equal(env.recorded.size, 1);
  assert.equal((await s.getRecordingSnapshot()).status, 'armed');
  assert.equal(env.accuracy, 3);
});

test('denied permission never creates a ride or starts a transport', async () => {
  const env = setup({ granted: false });
  await assert.rejects(env.service.startRecording('bike-1'), /permission/);
  assert.equal((await env.service.getRecordingSnapshot()).status, 'idle');
  assert.equal(env.running, false); assert.equal(env.recorded.size, 0);
});

test('native fallback warns that recording is foreground-only and rejects automatic capture', async () => {
  const env = setup({ background: false });
  await env.service.startRecording('bike-1');
  assert.match((await env.service.getRecordingSnapshot()).error, /Foreground recording only/);
  await assert.rejects(env.service.setAutomaticCapture(true, 'bike-1'), /Always location/);
  assert.equal((await env.service.getRecordingSnapshot()).automatic, false);
  assert.equal(env.watching, true);
});

test('an empty recording cannot be saved as a fake GPS ride', async () => {
  const env = setup(); await env.service.startRecording('bike-1');
  await assert.rejects(env.service.finishRecording(), /two accurate/);
  assert.equal(env.recorded.size, 0);
  assert.equal((await env.service.getRecordingSnapshot()).status, 'recording');
});

test('failed initial persistence stops background GPS and preserves an honest idle state', async () => {
  const env = setup({ failWrite: true });
  await assert.rejects(env.service.startRecording('bike-1'), /Storage is full/);
  assert.equal(env.running, false);
  assert.equal((await env.service.getRecordingSnapshot()).status, 'idle');
});

test('browser recording pauses on hidden tabs and recovers a paused draft', async () => {
  const env = setup({ web: true }); await env.service.startRecording('bike-1');
  await env.service.getRecordingSnapshot(); await env.fix(2000, 12, 12.001);
  assert.match((await env.service.getRecordingSnapshot()).error, /only while this tab is visible/);
  await env.hide();
  assert.equal((await env.service.getRecordingSnapshot()).status, 'paused'); assert.equal(env.watching, false);
  const restored = setup({ web: true, values: env.values });
  assert.equal((await restored.service.getRecordingSnapshot()).status, 'paused');
  await assert.rejects(restored.service.setAutomaticCapture(true, 'bike-1'), /installed iOS and Android/);
  await assert.rejects(restored.service.calibrateLean(), /native iOS or Android/);
});

test('point journal appends only its bounded tail and removes old generations', async () => {
  const env = setup();
  const points = Array.from({ length: 600 }, (_, index) => ({ latitude: 12, longitude: 77, timestamp: index, speed: 0, altitude: null, accuracy: 5, heading: null }));
  await env.actualStorage.savePointJournal('draft', { status: 'recording' }, points, 'ride-1');
  env.diskWrites.length = 0;
  await env.actualStorage.savePointJournal('draft', { status: 'recording' }, [...points, { ...points[599], timestamp: 600 }], 'ride-1');
  assert.equal(env.diskWrites.length, 2); // one tail chunk + the small journal head
  assert.equal(JSON.parse(env.diskWrites[0].value).length, 89);
  assert.equal((await env.actualStorage.loadPointJournal('draft')).points.length, 601);
  await env.actualStorage.savePointJournal('draft', { status: 'idle' }, [], 'idle');
  assert.equal([...env.disk.keys()].filter(key => key.includes('/points/')).length, 0);
});

test('point journal recovers the prior committed count when head commit fails', async () => {
  const env = setup();
  const point = { latitude: 12, longitude: 77, timestamp: 1, speed: 0, altitude: null, accuracy: 5, heading: null };
  await env.actualStorage.savePointJournal('draft', { count: 1 }, [point], 'ride-1');
  env.failDiskKey('@apexmoto/v1/draft');
  await assert.rejects(env.actualStorage.savePointJournal('draft', { count: 2 }, [point, { ...point, timestamp: 2 }], 'ride-1'), /Disk unavailable/);
  const restored = await env.actualStorage.loadPointJournal('draft');
  assert.equal(restored.points.length, 1);
  assert.equal(restored.metadata.count, 1);
});

test('coarse moving fixes upgrade discovery accuracy without polluting the route', async () => {
  const env = setup(); await env.service.setAutomaticCapture(true, 'bike-1');
  const coarse = env.position(2000, 12); coarse.coords.accuracy = 150; env.clock.now = coarse.timestamp;
  await env.deliver(coarse);
  assert.equal(env.accuracy, 4);
  assert.equal((await env.service.getRecordingSnapshot()).points.length, 0);
});

test('revoked background permission recovers an automatic ride as a paused manual draft', async () => {
  const first = setup(); await first.service.setAutomaticCapture(true, 'bike-1');
  for (let i = 0; i < 6; i++) await first.fix(5000, 12, 12 + i * 0.0006);
  const original = await first.service.getRecordingSnapshot();
  assert.equal(original.status, 'recording');
  const restored = setup({ background: false, values: first.values }); restored.clock.now = first.clock.now;
  const snapshot = await restored.service.getRecordingSnapshot();
  assert.equal(snapshot.status, 'paused'); assert.equal(snapshot.automatic, false);
  assert.equal(snapshot.points.length, original.points.length);
  const stored = JSON.parse(restored.values.get('recording-draft'));
  assert.equal(stored.points.length, original.points.length);
  assert.equal(stored.metadata.mode, 'manual');
});

test('saved rides use bounded chunks, preserve edited routes and delete every chunk', async () => {
  const env = setup();
  const point = { latitude: 12, longitude: 77, timestamp: 1, speed: 0, altitude: null, accuracy: 5, heading: null };
  const ride = { id: 'ride-1', name: 'Test ride', startedAt: 1, endedAt: 600, vehicleId: 'bike-1', source: 'gps', notes: '', isFavorite: false, points: Array.from({ length: 600 }, (_, index) => ({ ...point, timestamp: index + 1 })) };
  await env.actualStorage.saveRide(ride);
  let saved = await env.actualStorage.loadRides();
  assert.equal(saved.length, 1); assert.equal(saved[0].points.length, 600);
  const next = { ...ride, notes: 'Updated', points: ride.points.map(point => ({ ...point, latitude: 13 })) };
  await env.actualStorage.saveRide(next);
  saved = await env.actualStorage.loadRides();
  assert.equal(saved[0].notes, 'Updated'); assert.equal(saved[0].points[0].latitude, 13);
  assert.equal([...env.disk.keys()].filter(key => key.includes('/points/')).length, 3);
  await env.actualStorage.deleteRide(ride.id);
  assert.equal(env.disk.size, 0);
});
