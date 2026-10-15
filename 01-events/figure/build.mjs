// Fig 1 — EventEmitter as a bell board.
// node 01-events/figure/build.mjs [--light]  → writes event-board(-light).html and event-video(-light).html next to this file.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const SKILL = join(homedir(), ".claude/skills/anatomy");
const k = await import(join(SKILL, "kit/iso-kit.mjs"));
const { kitScript } = await import(join(SKILL, "scripts/inline-kit.mjs"));
const { playerHtml, playerScript, PLAYER_CSS } = await import("../../shared/player.mjs");

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 640;
const HEIGHT = 372;

// ── world plan (x along the beam, y toward the front, z up) ─────────────────
const PLATE = { x: -168, y: -44, w: 318, d: 96, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const POSTS = [-130, 112];
const BEAM = { x: -136, y: -15, w: 254, d: 10, r: 1.5 };
const BEAM_Z = 100;
const BEAM_H = 8;
const CHIME_Y = -10;

const SLOTS = [-96, -64, -32, 0, 32]; // five hooks on the 'knock' side
const ERR_X = 84; // one hook on the 'error' side, past the divider
const DIVIDER_X = 56;
const HOME = -114; // where the carriage parks: emit() has returned

const TUBE = { r: 4.6, z0: 38, z1: 85 };
const RAILS = [11, 23];
const RAIL = { from: -132, to: 110, d: 4, h: 3 };

const KEYS = { x: -160, y: 30, w: 34, d: 15, r: 2 };
const KEY_H = 9;
const KEY_KNOCK = [-151, 37.5];
const KEY_ERROR = [-135, 37.5];

const BOX = { x: 122, y: -36, w: 20, d: 20, r: 2 }; // breaker housing
const BOX_H = 18;
const LEVER = [129, -26];
const LAMP = [136.5, -21];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(BEAM, BEAM_Z, BEAM_Z + BEAM_H)],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ── base ────────────────────────────────────────────────────────────────────
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(slab(PLATE, -PLATE_H, PLATE_H, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(PLATE, -5, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));

  // ruler strip along the front edge: the carriage pointer reads off it
  const strip = { x: -120, y: 42, w: 236, d: 6, r: 1 };
  out.push(S(slab(strip, 0, 0.6), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 8, strip.y + 0.6, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3, 0.6]), at([strip.x + strip.w - 2, strip.y + 3, 0.6])], { size: 0.45 }));

  // engraved label plate
  const label = { x: 52, y: 29, w: 56, d: 11, r: 1.2 };
  out.push(S(slab(label, 0, 0.8, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + label.w / 2, label.y + 7.2], 0.8, P, "x"), "EventEmitter", { size: 4.4, tone: "mid", anchor: "middle" }));
  out.push(D([at([label.x + 3, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3, label.y + label.d / 2, 0.8])], { size: 0.4 }));

  // catch pad under the knock chimes: a once() chime lands here when it lets go
  const pad = { x: -110, y: -21, w: 154, d: 22, r: 2 };
  out.push(S(slab(pad, 0, 2.2, 4, 0.5), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(pad, 2.6), 2.2, P, 4), { tone: "faint" }));
  out.push(D(k.corners(pad, 1.6).map(([x, y]) => at([x, y, 2.2])), { size: 0.35, tone: "lo" }));
  return out.join("");
}

function rails() {
  const out = [];
  // toothed belt between the rails, on two pulleys
  const belt = { x: RAIL.from + 4, y: 17, w: RAIL.to - RAIL.from - 8, d: 3, r: 1.2 };
  for (const x of [belt.x + 1, belt.x + belt.w - 1]) {
    out.push(S(k.cylinder(x, 18.5, 3, 0, 2.2, P, 24), { tone: "mid" }));
    out.push(D([at([x, 18.5, 2.2])], { size: 0.5, tone: "hi" }));
  }
  out.push(S(slab(belt, 0.4, 1.2, 3), { tone: "lo", crease: "none" }));
  const teeth = k.topTicks(belt.x + 3, belt.x + belt.w - 3, 2, 1000, belt.y, 1.6, [1, 1], P);
  out.push(L(teeth.minor, { tone: "faint" }));
  for (const y of RAILS) {
    out.push(S(slab({ x: RAIL.from, y, w: RAIL.to - RAIL.from, d: RAIL.d, r: 1 }, 0, RAIL.h, 3, 0.4), { tone: "mid" }));
    out.push(D([RAIL.from + 6, (RAIL.from + RAIL.to) / 2, RAIL.to - 6].map((x) => at([x, y + RAIL.d / 2, RAIL.h])), { size: 0.4 }));
  }
  for (const x of [RAIL.from - 5, RAIL.to]) {
    out.push(S(slab({ x, y: RAILS[0] - 3, w: 5, d: RAILS[1] - RAILS[0] + RAIL.d + 6, r: 1.2 }, 0, 7, 3, 0.5), { tone: "mid" }));
    out.push(D([at([x + 2.5, RAILS[0] - 0.5, 7]), at([x + 2.5, RAILS[1] + RAIL.d + 0.5, 7])], { size: 0.45 }));
  }
  return out.join("");
}

// ── structure: posts, beam, hooks, divider ──────────────────────────────────
function post(px) {
  const out = [];
  const foot = { x: px - 8, y: -18, w: 16, d: 16, r: 2 };
  out.push(S(slab(foot, 0, 5, 4, 0.6), { tone: "mid" }));
  out.push(D(k.corners(foot, 2.6).map(([x, y]) => at([x, y, 5])), { size: 0.45 }));
  out.push(S(slab({ x: px - 5.5, y: -15.5, w: 11, d: 11, r: 1.4 }, 5, 6, 3, 0.4), { tone: "mid" }));
  const column = { x: px - 4, y: -14, w: 8, d: 8, r: 1 };
  out.push(S(slab(column, 11, BEAM_Z - 11, 3), { tone: "mid", crease: "none", inner: L(k.sideSeam(column, 56, P, 3), { tone: "faint" }) }));
  out.push(S(slab({ x: px - 5.5, y: -15.5, w: 11, d: 11, r: 1.4 }, BEAM_Z - 6, 6, 3, 0.4), { tone: "mid" }));
  return out.join("");
}

function beam() {
  const out = [];
  for (const x of [...SLOTS, ERR_X]) {
    out.push(S(slab({ x: x - 2.5, y: CHIME_Y - 2.5, w: 5, d: 5, r: 1 }, BEAM_Z - 4, 4, 3), { tone: "mid" }));
    out.push(L(k.ring(x, CHIME_Y, 1.1, BEAM_Z - 4, P, 12), { tone: "lo" }));
  }
  const divider = { x: DIVIDER_X - 1.5, y: -14, w: 3, d: 8, r: 0.6 };
  out.push(S(slab(divider, BEAM_Z - 22, 22, 2), { tone: "mid" }));
  out.push(S(slab(BEAM, BEAM_Z, BEAM_H, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(BEAM, BEAM_Z + 3, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BEAM, 2.4), BEAM_Z + BEAM_H, P, 4), { tone: "faint" }));
  out.push(D([...SLOTS, ERR_X].map((x) => at([x, CHIME_Y, BEAM_Z + BEAM_H])), { size: 0.5, tone: "hi" }));
  out.push(D([...POSTS.map((x) => at([x, CHIME_Y, BEAM_Z + BEAM_H])), at([DIVIDER_X, CHIME_Y, BEAM_Z + BEAM_H])], { size: 0.45 }));
  return out.join("");
}

// the error line: from the error hook, down the right post, into the breaker
function errorWire() {
  const px = POSTS[1];
  const via = [
    [px, -4.9, BEAM_Z + 4],
    [px, -5.6, BEAM_Z - 1],
    [px, -5.6, 11.2],
    [px, -4.3, 11.2],
    [px, -4.3, 5.2],
    [px, -1.6, 5.2],
    [px, -1.6, 0.3],
    [132, -1.6, 0.3],
    [132, -15.4, 0.3],
  ].map(at);
  return k.wireSvg(at([ERR_X + 8, -4.9, BEAM_Z + 4]), at([132, -15.8, 7]), { via, tone: "mid", size: 1 });
}

function breaker() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(BOX, 0, 2, P)}" style="filter:blur(5px)"/>`);
  out.push(S(slab(BOX, 0, BOX_H, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(BOX, 4, P, 4), { tone: "faint" }) }));
  out.push(D(k.corners(BOX, 2.4).map(([x, y]) => at([x, y, BOX_H])), { size: 0.4 }));
  out.push(L(k.planOutline({ x: LEVER[0] - 3, y: LEVER[1] - 5, w: 6, d: 10, r: 1.4 }, BOX_H, P, 3), { tone: "lo" }));
  out.push(S(k.cylinder(LAMP[0], LAMP[1], 3.2, BOX_H, 1.4, P, 24), { tone: "mid" }));
  return out.join("");
}

function lever() {
  return S(slab({ x: LEVER[0] - 1.5, y: LEVER[1] - 3, w: 3, d: 6, r: 0.8 }, BOX_H - 6, 14, 2, 0.4), { tone: "mid" }) + D([at([LEVER[0], LEVER[1], BOX_H + 8])], { size: 0.5, tone: "hi" });
}

// belt motor at the left end, wired from the key block
const MOTOR = [-150, 17];
function motor() {
  const [x, y] = MOTOR;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - 8, y: y - 8, w: 16, d: 16, r: 8 }, 0, 2, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.cylinder(x, y, 8, 0, 1.6, P, 32), { tone: "lo" }));
  out.push(D(k.corners({ x: x - 8, y: y - 8, w: 16, d: 16 }, 2.6).filter((p, i) => i !== 0).map(([a, b]) => at([a, b, 1.6])), { size: 0.4 }));
  out.push(S(k.cylinder(x, y, 6.4, 1.6, 12, P, 36), { tone: "mid", inner: L(k.sideArc(x, y, 6.4, 3.4, P, 24) + k.sideArc(x, y, 6.4, 11.8, P, 24), { tone: "faint" }) }));
  out.push(L(k.knurl(x, y, 6.4, 3.4, 11.8, 30, P), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, 5, 13.6, 1.6, P, 32, 0.4), { tone: "mid" }));
  out.push(L(k.ring(x, y, 2, 15.2, P, 16), { tone: "lo" }));
  out.push(D([at([x, y, 15.2])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

function lamp() {
  return [
    S(k.cylinder(LAMP[0], LAMP[1], 2.4, BOX_H + 1.4, 2.4, P, 24), { tone: "hi" }),
    S(k.cylinder(LAMP[0], LAMP[1], 1.6, BOX_H + 3.8, 1, P, 20), { tone: "hi" }),
    D([at([LAMP[0], LAMP[1], BOX_H + 4.8])], { size: 0.9, tone: "hi" }),
  ].join("");
}

// ── keys: one per event name ────────────────────────────────────────────────
function keyBlock() {
  const out = [`<path class="iso-halo" d="${k.haloOf(KEYS, 0, 2, P)}" style="filter:blur(5px)"/>`];
  out.push(S(slab(KEYS, 0, KEY_H, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(KEYS, 3, P, 4), { tone: "faint" }) }));
  for (const [x, y] of [KEY_KNOCK, KEY_ERROR]) {
    out.push(S(k.cylinder(x, y, 5.4, KEY_H, 0.8, P, 28), { tone: "lo" }));
    out.push(L(k.ring(x, y, 4.5, KEY_H + 0.8, P, 28), { tone: "faint" }));
  }
  out.push(D([at([KEYS.x + 2.4, KEYS.y + 2.4, KEY_H]), at([KEYS.x + KEYS.w - 2.4, KEYS.y + 2.4, KEY_H])], { size: 0.4 }));
  return out.join("");
}

function keyCap([x, y], guard) {
  const out = [S(k.cylinder(x, y, 3.8, KEY_H + 0.8, 3.4, P, 28, 0.5), { tone: guard ? "mid" : "hi" })];
  out.push(L(k.knurl(x, y, 3.8, KEY_H + 0.8, KEY_H + 4.2, 26, P), { tone: "faint" }));
  if (guard) out.push(L(k.ring(x, y, 1.6, KEY_H + 4.2, P, 16), { tone: "mid" }));
  else out.push(D([at([x, y, KEY_H + 4.2])], { size: 0.7, tone: "hi" }));
  return out.join("");
}

// ── chimes: each one is a listener ──────────────────────────────────────────
// Built at x = 0 and moved along the beam with translateAlong.
function chime(kind) {
  const out = [];
  out.push(S(k.cylinder(0, CHIME_Y, 0.9, 87, 9, P, 12), { tone: "mid", crease: "none" }));
  if (kind === "once") {
    // breakaway tab clip: lets go after its first ring
    out.push(S(slab({ x: -4.6, y: CHIME_Y - 2.4, w: 9.2, d: 4.8, r: 0.8 }, 85, 5, 2, 0.4), { tone: "hi" }));
    out.push(L(k.segment([0, CHIME_Y + 2.4, 85], [0, CHIME_Y + 2.4, 90], P), { tone: "lo" }));
  } else {
    out.push(S(k.cylinder(0, CHIME_Y, 2.6, 85, 3.4, P, 18), { tone: "mid" }));
  }
  const seams = L(k.sideArc(0, CHIME_Y, TUBE.r, TUBE.z1 - 4, P, 20) + k.sideArc(0, CHIME_Y, TUBE.r, TUBE.z0 + 4, P, 20), { tone: "faint" });
  out.push(`<g class="ch-tube">${S(k.cylinder(0, CHIME_Y, TUBE.r, TUBE.z0, TUBE.z1 - TUBE.z0, P, 36, 0.5), { tone: "hi", inner: seams })}</g>`);
  out.push(S(k.cylinder(0, CHIME_Y, TUBE.r + 0.3, TUBE.z0 - 1.4, 1.4, P, 28), { tone: "mid" }));
  return out.join("");
}

// ── the striker carriage: one emit() is one trip ────────────────────────────
function carriage() {
  const out = [];
  const base = { x: -15, y: 7, w: 30, d: 24, r: 2 };
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(base, 3), 3, 0.1, P)}" style="filter:blur(4px)"/>`);
  out.push(S(slab(base, 3, 4, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(base, 5, P, 4), { tone: "faint" }) }));
  for (const y of RAILS) {
    for (const x of [-13, 6]) {
      const block = { x, y: y - 1.5, w: 7, d: RAIL.d + 3, r: 1 };
      out.push(S(slab(block, 7, 3, 2, 0.3), { tone: "mid" }));
      out.push(D([at([x + 3.5, y + RAIL.d / 2, 10])], { size: 0.4 }));
    }
  }
  // pointer reading off the ruler
  out.push(S(slab({ x: -1.5, y: 31, w: 3, d: 10.6, r: 0.8 }, 3, 1, 2), { tone: "mid", crease: "none" }));
  out.push(D([at([0, 41, 4])], { size: 0.55, tone: "hi" }));
  // thumb screw on the front face
  out.push(S(slab({ x: 8.4, y: 31, w: 3, d: 1.8, r: 0.6 }, 3.6, 2.4, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(9.9, 34.6, 2.2, 2.6, 4.4, P, 18), { tone: "mid" }));
  out.push(L(k.knurl(9.9, 34.6, 2.2, 2.6, 7, 16, P), { tone: "lo" }));
  // mast
  const collar = { x: -4.5, y: 14, w: 9, d: 9, r: 1.2 };
  out.push(S(slab(collar, 7, 5, 3, 0.4), { tone: "mid" }));
  const mast = { x: -3, y: 15.5, w: 6, d: 6, r: 1 };
  out.push(S(slab(mast, 12, 46, 3), { tone: "mid", crease: "none", inner: L(k.sideSeam(mast, 36, P, 3), { tone: "faint" }) }));
  return out.join("");
}

function striker() {
  const out = [];
  // hammer head first, then the arm that comes toward us from it
  out.push(S(slab({ x: -5.5, y: -2.4, w: 11, d: 8, r: 1.8 }, 52, 15, 4, 0.6), { tone: "hi", lit: true }));
  out.push(L(k.planOutline({ x: -3.6, y: -0.6, w: 7.2, d: 4.4, r: 1 }, 67, P, 3), { tone: "lo" }));
  out.push(S(slab({ x: -2, y: 5.6, w: 4, d: 16, r: 0.8 }, 58, 3.5, 2, 0.3), { tone: "mid" }));
  out.push(D([at([0, 18.5, 61.5]), at([0, 8, 61.5])], { size: 0.45, tone: "hi" }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const chimes = [];
for (let i = 0; i < 6; i += 1) chimes.push(`<g data-chime data-kind="on" style="display:none">${chime("on")}</g>`);
for (let i = 0; i < 3; i += 1) chimes.push(`<g data-chime data-kind="once" style="display:none">${chime("once")}</g>`);
chimes.push(`<g data-chime data-kind="error" style="display:none">${chime("on")}</g>`);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A bell board standing for a Node EventEmitter. Chimes hang from hooks on a beam: each chime is a listener, in the order it was added. Pressing a key sends a striker carriage along the rail; it rings every chime in turn and only then returns home and lets the key back up, which is why emit is synchronous. A chime with a tab clip is a once listener and drops away after it rings. Past a divider, one hook belongs to the error event; an error with no chime there trips the breaker and the process goes dark.",
  body: [
    plate(),
    rails(),
    motor(),
    `<g data-part="chimes">${chimes.join("")}</g>`,
    POSTS.map(post).join(""),
    beam(),
    errorWire(),
    breaker(),
    `<g data-part="lever">${lever()}</g>`,
    `<g data-part="lamp">${lamp()}</g>`,
    `<g data-part="carriage">${carriage()}<g data-part="striker">${striker()}</g></g>`,
    keyBlock(),
    `<g data-part="key-knock">${keyCap(KEY_KNOCK, false)}</g>`,
    `<g data-part="key-error">${keyCap(KEY_ERROR, true)}</g>`,
  ],
});

const controls = `
<div class="ee-controls" role="group" aria-label="EventEmitter calls">
  <div class="ee-row">
    <button data-do="emit">emit('knock', '<span data-who>Alice</span>')</button>
    <button data-do="on">on('knock', <span data-next>logger</span>)</button>
    <button data-do="once">once('knock', fn)</button>
  </div>
  <div class="ee-row">
    <button data-do="off">off('knock', logger)</button>
    <button data-do="off-new">off('knock', () =&gt; …)</button>
    <button data-do="error">emit('error', err)</button>
    <button data-do="on-error">on('error', handler)</button>
    <button data-do="reset" class="ee-quiet">reset</button>
  </div>
</div>
<pre class="ee-console" aria-live="polite" aria-label="console output"></pre>`;

const CSS = `
<style>
.ee-stage{outline:none}
.ee-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.ee-stage[data-dead] .iso-svg{opacity:.55;transition:opacity .6s}
.ee-controls{display:grid;gap:6px;margin:18px 0 0}
.ee-row{display:flex;flex-wrap:wrap;gap:6px}
.ee-controls button{font:11.5px/1 var(--anatomy-mono);color:var(--anatomy-strong);background:transparent;border:0;box-shadow:0 0 0 1px var(--anatomy-lo);padding:8px 10px;border-radius:0;cursor:pointer;transition:box-shadow .2s,color .2s,opacity .2s}
.ee-controls button:hover:not(:disabled){box-shadow:0 0 0 1px var(--anatomy-hi)}
.ee-controls button:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.ee-controls button:disabled{opacity:.35;cursor:default}
.ee-controls button.ee-quiet{color:var(--anatomy-muted)}
.ee-console{margin:12px 0 0;padding:10px 12px;height:9.6em;overflow:hidden;font:11.5px/1.6 var(--anatomy-mono);color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-faint);white-space:pre-wrap;display:flex;flex-direction:column;justify-content:flex-end}
.ee-console span{display:block}
.ee-console .c-sys{color:var(--anatomy-muted)}
.ee-console .c-out{color:var(--anatomy-strong)}
.ee-console .c-err{color:var(--anatomy-red)}
</style>`;

const live = readFileSync(join(HERE, "live.js"), "utf8")
  .replace("__P__", JSON.stringify(P))
  .replace("__CONST__", JSON.stringify({ SLOTS, ERR_X, HOME, KEY_H }));

const body =
  CSS +
  k.plateHtml({
    fig: "Fig 1",
    title: "EventEmitter",
    hint: "Press the calls below",
    readout: "listenerCount('knock') = 2",
    keys: [
      { mark: "lit", label: "Hammer: emit() calling listeners, one after another" },
      { mark: "raised", label: "Chimes: listeners, in the order they were added" },
      { mark: "flat", label: "Tab clip: a once() listener, dropped after one ring" },
    ],
    caption:
      "emit() is one trip of the carriage: it rings every chime on that event's hooks in order and only then returns home, so the key (and your code after emit) waits until every listener has run. off() needs the very same function, and an 'error' with no chime on its hook trips the breaker: the process crashes.",
    body: `<div class="iso-stage ee-stage" tabindex="0" role="group" aria-label="EventEmitter bell board. Use the buttons to call emit, on, once and off.">${svg}${controls}</div>`,
  });

const out = theme === "light" ? "event-board-light.html" : "event-board.html";
writeFileSync(join(HERE, out), k.pageHtml({ title: "EventEmitter bell board", theme, body, script: kitScript() + live, width: 720 }));
console.log("wrote", out);

// ── the same board as a lesson video (shared/player.*) ──────────────────────
const CHAPTER_TITLES = ["Listeners are chimes", "emit() is synchronous", "once() lets go", "off() needs the same function", "'error' is special"];
const vname = theme === "light" ? "event-video-light" : "event-video";
const player = playerHtml({ chapters: CHAPTER_TITLES, mp4: vname + ".mp4" });

const video = readFileSync(join(HERE, "video.js"), "utf8")
  .replace("__P__", JSON.stringify(P))
  .replace("__CONST__", JSON.stringify({ SLOTS, ERR_X, HOME }));

const vbody =
  PLAYER_CSS +
  k.plateHtml({
    fig: "Fig 1",
    title: "EventEmitter · the lesson",
    hint: "Space plays · ← → seek · 1–5 chapters",
    readout: "listenerCount('knock') = 0",
    keys: [
      { mark: "lit", label: "Hammer: emit() calling listeners, one after another" },
      { mark: "raised", label: "Chimes: listeners, in the order they were added" },
      { mark: "flat", label: "Tab clip: a once() listener, dropped after one ring" },
    ],
    caption:
      "Lesson 1 played on the bell board, from 01-events/basics.ts and error-event.ts. Every frame comes from the same small EventEmitter model, so scrubbing rebuilds the board exactly; pause anywhere and the calls below act on the board as it stands.",
    body: `<div class="iso-stage ee-stage" tabindex="0" role="group" aria-label="Lesson 1 video: EventEmitter on a bell board. Space plays and pauses, arrow keys seek.">${svg}${player}${controls}</div>`,
  });

const vout = vname + ".html";
writeFileSync(join(HERE, vout), k.pageHtml({ title: "EventEmitter lesson", theme, body: vbody, script: kitScript() + playerScript() + video, width: 720 }));
console.log("wrote", vout);
