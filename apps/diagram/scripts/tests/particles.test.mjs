import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = async (name) =>
  (
    await runnerImport(`${root}src/particles/${name}.ts`, {
      root,
      configFile: false,
      logLevel: "error",
    })
  ).module;
const { particleProfile, particlePhase, particleSlots, MAX_PARTICLES_PER_EDGE } =
  await load("profiles");
const { samplePath, pointAt, inViewport } = await load("path-sampler");
test("schedule aliases preserve free-form text with modest unknown fallback", () => {
  for (const [schedule, cadence] of [
    ["real-time", "continuous"],
    ["hourly", "hourly"],
    ["nightly 02:00", "batch"],
    ["daily", "batch"],
    ["on-demand", "demand"],
    ["query time", "demand"],
    ["Custom schedule", "continuous"],
  ])
    assert.equal(particleProfile("data", schedule).cadence, cadence);
  assert.ok(
    particleProfile("data", "").spawnEveryMs > particleProfile("data", "real-time").spawnEveryMs,
  );
  assert.equal(particleProfile("data", "hourly").spawnEveryMs, 2000);
  assert.equal(particleProfile("data", "daily").spawnEveryMs, 6000);
});
test("all five kinds have distinct sprites and bounded profiles", () => {
  const profiles = ["data", "request", "access", "control", "network"].map((k) =>
    particleProfile(k),
  );
  assert.equal(new Set(profiles.map((p) => p.sprite)).size, 5);
  for (const p of profiles) {
    assert.ok(p.opacity > 0 && p.opacity <= 1);
    assert.ok(p.speed > 0);
    assert.ok(p.burst <= MAX_PARTICLES_PER_EDGE);
  }
});
test("hourly repeated bursts and batch pauses do not change travel direction", () => {
  const hourly = particleProfile("data", "hourly");
  assert.equal(particlePhase(0, 0, 4000, hourly), 0);
  assert.equal(particlePhase(2000, 0, 4000, hourly), 0);
  assert.equal(particlePhase(1000, 0, 4000, hourly), 0.25);
  const batch = particleProfile("data", "nightly");
  assert.equal(particlePhase(3000, 0, 1000, batch), null);
  assert.equal(particlePhase(6000, 0, 1000, batch), 0);
  assert.equal(particlePhase(0, 0, 0, batch), null);
});
test("real path sampling caches endpoints, tangent and finite bounds in caller-owned buffers", () => {
  const path = samplePath({
    getAttribute: () => "M0 0L100 0",
    getTotalLength: () => 100,
    getPointAtLength: (l) => ({ x: l, y: 0 }),
  });
  const out = new Float32Array(3);
  pointAt(path, 0, out);
  assert.equal(out[0], 0);
  pointAt(path, 1, out);
  assert.equal(out[0], 100);
  pointAt(path, 0.5, out);
  assert.equal(out[0], 50);
  assert.equal(out[2], 0);
  assert.deepEqual(path.bounds, { x: 0, y: 0, width: 100, height: 0 });
  assert.equal(samplePath({ getAttribute: () => "", getTotalLength: () => 0 }), null);
  assert.equal(
    samplePath({
      getAttribute: () => "",
      getTotalLength: () => {
        throw Error("detached");
      },
    }),
    null,
  );
});
test("viewport culling handles zoom/pan and paths crossing the view with offscreen endpoints", () => {
  const path = { bounds: { x: -200, y: 10, width: 500, height: 20 } };
  assert.equal(inViewport(path, 0, 0, 1, 100, 100), true);
  assert.equal(inViewport(path, 1000, 0, 1, 100, 100), false);
  assert.equal(inViewport(path, 0, 0, 0.1, 100, 100), true);
});
test("long paths adapt within a strict cache budget", () => {
  const path = samplePath({
    getAttribute: () => "long",
    getTotalLength: () => 100000,
    getPointAtLength: (l) => ({ x: l, y: 0 }),
  });
  assert.equal(path.points.length, 1024);
});

test("fixed pulses overlap without slowing down on long paths; both directions are paired", () => {
  for (const schedule of ["hourly", "nightly", "real-time", "on-demand"]) {
    const p = particleProfile("data", schedule);
    assert.ok(particleSlots(100, p, true) >= 2);
    assert.equal(particleSlots(100000, p, true), MAX_PARTICLES_PER_EDGE);
    for (const duration of [100, 10000, 100000]) {
      assert.equal(particlePhase(p.spawnEveryMs, 0, duration, p), 0);
      assert.equal(particlePhase(p.spawnEveryMs * 2, 0, duration, p), 0);
    }
    assert.ok(particlePhase(500, p.burst, 10000, p) > particlePhase(500, 0, 10000, p));
  }
});
