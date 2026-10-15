// Fig 2 — a TCP server as a port bay: a machine with numbered jacks, a server
// plugged into one, and a rack that hands every client its own socket.
// node 02-tcp-server/figure/build.mjs [--light]  → writes server-video(-light).html next to this file.
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

// ── world plan (x to the right and back, y toward the front, z up) ─────────
const PLATE = { x: -138, y: -90, w: 272, d: 176, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const STRIP = { x: -128, y: -36, w: 30, d: 112, r: 2 }; // the jack strip, down the left edge
const STRIP_H = 6;
const JACK_X = -119;
const PORTS = [
  { n: 22, y: -25, guard: true },
  { n: 80, y: -7, guard: true },
  { n: 443, y: 11, guard: true },
  { n: 3000, y: 35 },
  { n: 3001, y: 52 },
  { n: 3002, y: 69 },
];
const DIVIDER_Y = 23;
const SERVER_Y = 35; // jack 3000
const SEAT = STRIP_H + 1.2; // a plug's sleeve stands on the jack collar

const PROC = { x: -84, y: -84, w: 46, d: 32, r: 2 }; // the node process, at the back
const PROC_H = 20;
const PROC_PORT = [-70, PROC.y + PROC.d + 1.6, 10];
const PROC_LAMP = [-46, -74];

const TRAY = { x: -26, y: -84, w: 150, d: 30, r: 2 }; // the socket rack, along the back
const TRAY_H = 2.5;
const COLS = [6, 54, 102];
const MOD = { y: -79, w: 20, d: 18, h: 12 }; // a socket module, per column
const MOD_PORT_Y = MOD.y + MOD.d + 2.4;
const CLIENT = { y: 36, w: 32, d: 20, h: 10 };
const CLIENT_PORT_Y = CLIENT.y - 2.4;
const CABLE_Z = 5.4;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [JACK_X, SERVER_Y, 48], ...k.boxCorners(TRAY, 0, TRAY_H + 22)],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 46 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const halo = (plan, z = 0, blur = 4) => `<path class="iso-halo" d="${k.haloOf(plan, z, 1, P)}" style="filter:blur(${blur}px)"/>`;
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ── base: the machine ───────────────────────────────────────────────────────
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

  // ruler along the front edge
  const ruler = { x: -84, y: 76, w: 120, d: 5, r: 1 };
  out.push(S(slab(ruler, 0, 0.6), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(ruler.x + 4, ruler.x + ruler.w - 4, 4, 5, ruler.y + 0.6, 0.6, [1.6, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([ruler.x + 2, ruler.y + 2.5, 0.6]), at([ruler.x + ruler.w - 2, ruler.y + 2.5, 0.6])], { size: 0.45 }));

  // the machine's address, engraved: it gets data to this box; the port picks the program
  const label = { x: 58, y: 66, w: 60, d: 12, r: 1.2 };
  out.push(S(slab(label, 0, 0.8, 4), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 4), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + label.w / 2, label.y + 7.6], 0.8, P, "x"), "127.0.0.1", { size: 5, tone: "mid", anchor: "middle" }));
  out.push(D([at([label.x + 3, label.y + label.d / 2, 0.8]), at([label.x + label.w - 3, label.y + label.d / 2, 0.8])], { size: 0.4 }));
  return out.join("");
}

// the trunk: from the side of jack 3000 to the rack, a flat bus on the deck
const TRUNK_X = -34;
function trunk() {
  const legs = [
    { x: STRIP.x + STRIP.w - 1, y: SERVER_Y - 2, w: TRUNK_X - (STRIP.x + STRIP.w) + 3, d: 4, r: 0.8 },
    { x: TRUNK_X - 2, y: TRAY.y + TRAY.d - 1, w: 4, d: SERVER_Y + 2 - (TRAY.y + TRAY.d) + 1, r: 0.8 },
  ];
  const out = legs.map((leg) => S(slab(leg, 0, 0.8, 2), { tone: "lo", crease: "none" }));
  out.push(L(k.lineOnTop([STRIP.x + STRIP.w, SERVER_Y], [TRUNK_X, SERVER_Y], 0.8, P) + k.lineOnTop([TRUNK_X, SERVER_Y], [TRUNK_X, TRAY.y + TRAY.d], 0.8, P), { tone: "faint" }));
  out.push(D([at([TRUNK_X, SERVER_Y, 0.8])], { size: 0.45 }));
  return out.join("");
}

// ── the jack strip ──────────────────────────────────────────────────────────
function jackStrip() {
  const out = [halo(STRIP, 0, 5)];
  out.push(S(slab(STRIP, 0, STRIP_H, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(STRIP, 2, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(STRIP, 2.2), STRIP_H, P, 4), { tone: "faint" }));
  out.push(D([at([STRIP.x + STRIP.w / 2, STRIP.y + 3.6, STRIP_H]), at([STRIP.x + STRIP.w / 2, STRIP.y + STRIP.d - 3.6, STRIP_H])], { size: 0.45 }));
  // a divider between the reserved ports and the free ones
  out.push(L(k.lineOnTop([STRIP.x + 2.2, DIVIDER_Y], [STRIP.x + STRIP.w - 2.2, DIVIDER_Y], STRIP_H, P), { tone: "lo" }));
  for (const port of PORTS) {
    out.push(S(k.cylinder(JACK_X, port.y, 5.2, STRIP_H, 1.2, P, 28, 0.3), { tone: "mid" }));
    out.push(L(k.ring(JACK_X, port.y, 2.6, SEAT, P, 20), { tone: "hi" }));
    out.push(D([at([JACK_X, port.y, SEAT])], { size: 0.55, tone: "lo" }));
    out.push(k.faceTextSvg(k.topMatrix([STRIP.x + STRIP.w - 2.2, port.y + 1.3], STRIP_H, P, "x"), String(port.n), { size: 3.6, tone: port.guard ? "lo" : "mid", anchor: "end" }));
  }
  return out.join("");
}

// reserved ports sit behind hinged guards: they need admin rights
function guards() {
  return PORTS.filter((p) => p.guard).map((port) => {
    const cap = { x: JACK_X - 5.4, y: port.y - 4.6, w: 10.8, d: 9.2, r: 1.4 };
    return `<g data-guard>${S(k.cylinder(JACK_X - 5.4, port.y, 1, SEAT, 1.6, P, 12), { tone: "mid" })}${S(slab(cap, SEAT, 1.2, 3, 0.3), { tone: "lo" })}${D([at([JACK_X + 2.4, port.y, SEAT + 1.2])], { size: 0.4 })}</g>`;
  }).join("");
}

// ── the node process ────────────────────────────────────────────────────────
function proc() {
  const out = [halo(PROC, 0, 5)];
  out.push(S(slab(PROC, 0, PROC_H, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(PROC, 6, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PROC, 2.4), PROC_H, P, 4), { tone: "faint" }));
  // vents: closed slots on the lid
  for (let i = 0; i < 5; i += 1) out.push(L(k.planOutline({ x: PROC.x + 6 + i * 4.4, y: PROC.y + 6, w: 1.8, d: 18, r: 0.9 }, PROC_H, P, 3), { tone: "lo" }));
  out.push(D(k.corners(PROC, 2.6).map(([x, y]) => at([x, y, PROC_H])), { size: 0.4 }));
  // the cord gland on the front face
  out.push(S(slab({ x: PROC_PORT[0] - 3.4, y: PROC.y + PROC.d, w: 6.8, d: 1.6, r: 0.6 }, 6.6, 6.8, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(PROC_LAMP[0], PROC_LAMP[1], 3.6, PROC_H, 1.2, P, 24), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([PROC.x + 33, PROC.y + 24], PROC_H, P, "x"), "node", { size: 3.8, tone: "mid", anchor: "middle" }));
  return out.join("");
}
const procLamp = () =>
  S(k.cylinder(PROC_LAMP[0], PROC_LAMP[1], 2.6, PROC_H + 1.2, 2, P, 22), { tone: "hi" }) + D([at([PROC_LAMP[0], PROC_LAMP[1], PROC_H + 3.2])], { size: 0.9, tone: "hi" });

// ── the rack ────────────────────────────────────────────────────────────────
function rack() {
  const out = [halo(TRAY, 0, 5)];
  out.push(S(slab(TRAY, 0, TRAY_H, 4, 0.5), { tone: "mid", inner: L(k.sideSeam(TRAY, 1, P, 4), { tone: "faint" }) }));
  // posts and a back bar: the frame the modules stand in front of
  for (const x of [TRAY.x + 3, TRAY.x + TRAY.w - 6]) out.push(S(slab({ x, y: TRAY.y + 1.6, w: 3, d: 3, r: 0.6 }, TRAY_H, 20, 2), { tone: "mid", crease: "none" }));
  out.push(S(slab({ x: TRAY.x + 2.4, y: TRAY.y + 1, w: TRAY.w - 7.8, d: 4.2, r: 0.8 }, TRAY_H + 20, 3, 2, 0.3), { tone: "mid" }));
  out.push(D([at([TRAY.x + 4.5, TRAY.y + 3.1, TRAY_H + 23]), at([TRAY.x + TRAY.w - 4.5, TRAY.y + 3.1, TRAY_H + 23])], { size: 0.45 }));
  for (const col of COLS) {
    for (const x of [col - MOD.w / 2 - 1.8, col + MOD.w / 2 + 0.4]) out.push(S(slab({ x, y: MOD.y - 1, w: 1.4, d: MOD.d + 3, r: 0.5 }, TRAY_H, 1.6, 2), { tone: "lo" }));
    out.push(D([at([col, TRAY.y + TRAY.d - 1.6, TRAY_H])], { size: 0.4, tone: "lo" }));
  }
  out.push(D(k.corners(TRAY, 2).filter((p) => p[1] > TRAY.y + 10).map(([x, y]) => at([x, y, TRAY_H])), { size: 0.4 }));
  return out.join("");
}

// a socket module, built in its slot and dropped in live
function module(col) {
  const plan = { x: col - MOD.w / 2, y: MOD.y, w: MOD.w, d: MOD.d, r: 1.6 };
  const out = [halo(plan, TRAY_H, 3)];
  out.push(S(slab(plan, TRAY_H, MOD.h, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(plan, TRAY_H + 3, P, 3), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(plan, 1.8), TRAY_H + MOD.h, P, 3), { tone: "faint" }));
  out.push(D(k.corners(plan, 1.6).map(([x, y]) => at([x, y, TRAY_H + MOD.h])), { size: 0.35 }));
  // the cable port on its front face
  out.push(S(slab({ x: col - 3.2, y: MOD.y + MOD.d, w: 6.4, d: 2.4, r: 0.6 }, CABLE_Z - 3, 6, 2), { tone: "mid", crease: "none" }));
  out.push(`<g class="lamp">${S(k.cylinder(col, MOD.y + 6, 2.4, TRAY_H + MOD.h, 2, P, 20), { tone: "hi" })}</g>`);
  return out.join("");
}

// a client (nc), with its random port on the screen
function client(col, port) {
  const plan = { x: col - CLIENT.w / 2, y: CLIENT.y, w: CLIENT.w, d: CLIENT.d, r: 2 };
  const out = [halo(plan, 0, 4)];
  out.push(S(slab(plan, 0, CLIENT.h, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, 3, P, 4), { tone: "faint" }) }));
  const screen = { x: plan.x + 2.6, y: CLIENT.y + 3, w: 19, d: 9, r: 1 };
  out.push(S(slab(screen, CLIENT.h, 0.5, 3), { tone: "lo", crease: "none" }));
  out.push(k.faceTextSvg(k.topMatrix([screen.x + screen.w / 2, screen.y + 5.9], CLIENT.h + 0.5, P, "x"), ":" + port, { size: 3.8, tone: "hi", anchor: "middle" }));
  // three keys along the front: the bright one is the one that "types"
  for (const kx of [plan.x + 6, plan.x + 12]) out.push(S(k.cylinder(kx, CLIENT.y + 15.6, 1.8, CLIENT.h, 1, P, 16, 0.2), { tone: "mid" }));
  out.push(`<g data-key>${S(k.cylinder(plan.x + 19, CLIENT.y + 15.6, 2, CLIENT.h, 1.2, P, 18, 0.3), { tone: "hi" })}</g>`);
  out.push(S(slab({ x: col - 3.2, y: CLIENT.y - 2.4, w: 6.4, d: 2.4, r: 0.6 }, CABLE_Z - 3, 6, 2), { tone: "mid", crease: "none" }));
  out.push(D(k.corners(plan, 2.2).map(([x, y]) => at([x, y, CLIENT.h])), { size: 0.35 }));
  return out.join("");
}

// ── plugs ───────────────────────────────────────────────────────────────────
// Built standing in jack 3000; moved up and down live.
function plug(second) {
  const out = [];
  const x = JACK_X, y = SERVER_Y;
  out.push(S(k.cylinder(x, y, 3.4, SEAT, 3, P, 24), { tone: "mid" }));
  out.push(`<g class="pl-band">${S(k.cylinder(x, y, 4.4, SEAT + 3, 3, P, 28, 0.3), { tone: second ? "mid" : "hi" })}</g>`);
  out.push(S(k.cylinder(x, y, 4.4, SEAT + 6, 12, P, 32), { tone: second ? "mid" : "hi", lit: !second, inner: L(k.sideArc(x, y, 4.4, SEAT + 15, P, 24), { tone: "faint" }) }));
  out.push(L(k.knurl(x, y, 4.4, SEAT + 7, SEAT + 13, 26, P), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, 2.8, SEAT + 18, 4, P, 24, 0.4), { tone: "mid" }));
  out.push(D([at([x, y, SEAT + 22])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

// ── assemble ────────────────────────────────────────────────────────────────
const CLIENT_PORTS = [52144, 52151, 52163, 52170, 52188, 52196, 52203, 52219, 52231];
// every column (left to right) gets a module, a cable and a client for each port it might show
const rowSvg = COLS.map((col, r) => {
  const ports = CLIENT_PORTS.filter((_, i) => i % COLS.length === r);
  return `<g data-row="${r}">
    <g data-mod style="display:none">${module(col)}</g>
    <g data-cable style="display:none"><path class="iso-line ev-cable" data-tone="mid" pathLength="1"/><circle class="iso-wire-end" r="1.1"/><circle class="iso-wire-end" r="1.1"/></g>
    ${ports.map((port) => `<g data-client="${port}" style="display:none">${client(col, port)}</g>`).join("")}
  </g>`;
}).join("");

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A port bay standing for a TCP server. The deck is the machine, 127.0.0.1. A strip of numbered jacks are its ports; 22, 80 and 443 sit behind guards. A node process box has a cord to a plug that seats in jack 3000 when the server listens, and a second plug that tries the same jack bounces off: EADDRINUSE. A bus runs from jack 3000 to a rack. Each client box that connects gets its own cable and its own socket module in the rack, and bytes travel along the cable as small lettered tiles that arrive in arbitrary chunks.",
  body: [
    plate(),
    trunk(),
    proc(),
    `<g data-part="proc-lamp">${procLamp()}</g>`,
    rack(),
    rowSvg,
    jackStrip(),
    `<g data-part="guards">${guards()}</g>`,
    `<g data-part="cord"><path class="iso-line ev-cord" data-tone="mid"/><circle class="iso-wire-end" r="1.2"/></g>`,
    `<g data-part="plug" style="display:none">${plug(false)}</g>`,
    `<g data-part="plug2" style="display:none">${plug(true)}</g>`,
    `<g data-part="beads"></g>`,
  ],
});

const controls = `
<div class="ee-controls" role="group" aria-label="Server and client calls">
  <div class="ee-row">
    <button data-do="listen">server.listen(3000)</button>
    <button data-do="listen2">second.listen(3000)</button>
    <button data-do="connect">nc localhost 3000</button>
  </div>
  <div class="ee-row">
    <button data-do="write">client.write('hi')</button>
    <button data-do="hangup">Ctrl+C a client</button>
    <button data-do="reset-conn">break a connection</button>
    <button data-do="reset" class="ee-quiet">reset</button>
  </div>
</div>
<pre class="ee-console" aria-live="polite" aria-label="console output"></pre>`;

const CSS = `
<style>
.ev-cable{stroke-width:1.3px;stroke-dasharray:1 1}
.ev-cord{stroke-width:1.3px}
.pl-band[data-err] .iso-shade,.pl-band[data-err] .iso-top{fill:var(--anatomy-red)}
.lamp[data-err] .iso-shade,.lamp[data-err] .iso-top{fill:var(--anatomy-red)}
[data-guard][data-lit] .iso-top{fill:var(--anatomy-lit-top)}
[data-guard][data-lit] .iso-edge{stroke:var(--anatomy-hi)}
.ev-bead rect{fill:var(--anatomy-card);stroke:var(--anatomy-hi);stroke-width:.6px}
.ev-bead text{font:600 6.4px/1 var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central}
.ev-bead[data-out] rect{stroke:var(--anatomy-mid)}
.ev-bead[data-out] text{fill:var(--anatomy-text)}
</style>`;

const geo = {
  JACK_X, SERVER_Y, SEAT, PROC_PORT, COLS, MOD_PORT_Y, CLIENT_PORT_Y, CABLE_Z, CLIENT_PORTS,
};

const CHAPTER_TITLES = ["A server waits", "Ports pick the program", "One socket per client", "Bytes, not messages", "Ending and errors"];
const vname = theme === "light" ? "server-video-light" : "server-video";

const lesson = readFileSync(join(HERE, "video.js"), "utf8").replace("__P__", JSON.stringify(P)).replace("__GEO__", JSON.stringify(geo));

const body =
  PLAYER_CSS + CSS +
  k.plateHtml({
    fig: "Fig 2",
    title: "TCP server · the lesson",
    hint: "Space plays · ← → seek · 1–5 chapters",
    readout: "not listening",
    keys: [
      { mark: "lit", label: "Plug: the server, listening on port 3000" },
      { mark: "raised", label: "Modules: one socket per connected client" },
      { mark: "flat", label: "Tiles: bytes on the wire, delivered in any-size chunks" },
    ],
    caption:
      "Lesson 2 played on a port bay, from 02-tcp-server/echo-server.ts and port-in-use.ts. The address gets data to the machine, the port to one program; every client gets its own socket; and TCP carries bytes, not messages. Pause anywhere and the calls below act on the board as it stands.",
    body: `<div class="iso-stage ee-stage" tabindex="0" role="group" aria-label="Lesson 2 video: a TCP server as a port bay. Space plays and pauses, arrow keys seek.">${svg}${playerHtml({ chapters: CHAPTER_TITLES, mp4: vname + ".mp4" })}${controls}</div>`,
  });

writeFileSync(join(HERE, vname + ".html"), k.pageHtml({ title: "TCP server lesson", theme, body, script: kitScript() + playerScript() + lesson, width: 720 }));
console.log("wrote", vname + ".html");
