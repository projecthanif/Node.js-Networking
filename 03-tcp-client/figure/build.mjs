// Fig 3 — a TCP client as a dialer: a box whose plug flies out on its cord to a
// port, seats (connect), bounces off (ECONNREFUSED) or hangs in the air (timeout).
// node 03-tcp-client/figure/build.mjs [--light]  → writes client-video(-light).html next to this file.
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
const PLATE = { x: -172, y: -76, w: 258, d: 140, r: 8 }; // this laptop: localhost
const PLATE_H = 12;
const FOOT_H = 5;
const REMOTE = { x: -70, y: 84, w: 54, d: 42, r: 5 }; // 10.255.255.1: a pad with nothing on it, off this machine
const REMOTE_H = 7;

const CBOX = { x: -162, y: -36, w: 54, d: 44, r: 2 }; // the client: net.connect
const CBOX_H = 20;
const DIAL = [-140, -16]; // a timer dial on its lid
const DIAL_R = 11;
const CPORT = [CBOX.x + CBOX.w + 1.6, -6, 10]; // the cord gland on its +x face
const HOLSTER = [-92, -6]; // the plug parks here
const LAMPS = [-156, -148, -140]; // one per connect attempt
const STATUS = [-117, -27]; // lit while connected
const TIMEOUT_LAMP = [-117, 2]; // blinks on 'timeout'

const STRIP = { x: -8, y: -62, w: 28, d: 62, r: 2 }; // this machine's ports
const STRIP_H = 6;
const JACK_X = 2;
const PORTS = [
  { n: 3001, y: -48 },
  { n: 3009, y: -18 },
];
const SEAT = STRIP_H + 1.2;
// servers sit behind the panel, each wired to its jack by a bus on the deck
const SERVERS = [
  { x: 36, y: -61, w: 40, d: 26, r: 2 }, // your lesson 2 command server, on 3001
  { x: 36, y: -31, w: 40, d: 26, r: 2 }, // started halfway through the retries, on 3009
];
const LISTEN_LAMP_X = 13;
const SERVER_H = 16;
const REMOTE_JACK = [-43, 99];

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners(REMOTE, -REMOTE_H - FOOT_H, 0), [JACK_X, -48, 58], [-40, -20, 62]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 44 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const slab = (plan, z, h, steps = 3, bevel = 0) => k.slabOf(plan, z, h, P, steps, bevel);
const halo = (plan, z = 0, blur = 4) => `<path class="iso-halo" d="${k.haloOf(plan, z, 1, P)}" style="filter:blur(${blur}px)"/>`;
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ── bases ───────────────────────────────────────────────────────────────────
function base(plan, h, label, labelAt) {
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, -h - FOOT_H, h, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(plan, Math.min(22, plan.w / 4)))) {
    out.push(S(k.cylinder(x, y, 6, -h - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.6, -h - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(slab(plan, -h, h, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(plan, -h / 2.4, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(plan, 4.4), 0, P), { tone: "lo" }));
  const screws = k.corners(plan, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  if (label) {
    out.push(S(slab(labelAt, 0, 0.8, 4), { tone: "lo" }));
    out.push(L(k.planOutline(k.insetPlan(labelAt, 1.4), 0.8, P, 4), { tone: "faint" }));
    out.push(k.faceTextSvg(k.topMatrix([labelAt.x + labelAt.w / 2, labelAt.y + labelAt.d / 2 + 1.7], 0.8, P, "x"), label, { size: 4.6, tone: "mid", anchor: "middle" }));
    out.push(D([at([labelAt.x + 3, labelAt.y + labelAt.d / 2, 0.8]), at([labelAt.x + labelAt.w - 3, labelAt.y + labelAt.d / 2, 0.8])], { size: 0.4 }));
  }
  return out.join("");
}

function laptop() {
  const out = [base(PLATE, PLATE_H, "localhost", { x: 4, y: 44, w: 60, d: 11, r: 1.2 })];
  const ruler = { x: -150, y: 54, w: 70, d: 5, r: 1 };
  out.push(S(slab(ruler, 0, 0.6), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(ruler.x + 4, ruler.x + ruler.w - 4, 4, 5, ruler.y + 0.6, 0.6, [1.6, 3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([ruler.x + 2, ruler.y + 2.5, 0.6]), at([ruler.x + ruler.w - 2, ruler.y + 2.5, 0.6])], { size: 0.45 }));
  return out.join("");
}

// the address that doesn't answer: a bare pad and one jack collar, nothing behind it
function remote() {
  const out = [base(REMOTE, REMOTE_H, "10.255.255.1", { x: REMOTE.x + 5, y: REMOTE.y + REMOTE.d - 13, w: REMOTE.w - 10, d: 9, r: 1 })];
  const [x, y] = REMOTE_JACK;
  out.push(S(k.cylinder(x, y, 5.6, 0, 3, P, 28, 0.3), { tone: "lo" }));
  out.push(L(k.ring(x, y, 2.6, 3, P, 20), { tone: "mid" }));
  out.push(D([at([x, y, 3])], { size: 0.55, tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([x + 9, y + 1.4], 0, P, "x"), ":80", { size: 3.4, tone: "lo", anchor: "start" }));
  return out.join("");
}

// ── the client box ──────────────────────────────────────────────────────────
function clientBox() {
  const out = [halo(CBOX, 0, 5)];
  out.push(S(slab(CBOX, 0, CBOX_H, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(CBOX, 6, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(CBOX, 2.4), CBOX_H, P, 4), { tone: "faint" }));
  out.push(D(k.corners(CBOX, 2.6).map(([x, y]) => at([x, y, CBOX_H])), { size: 0.4 }));
  // the dial: a bezel, a face with ticks for 0–5 s, and a hub
  const [dx, dy] = DIAL;
  out.push(S(k.cylinder(dx, dy, DIAL_R + 1.6, CBOX_H, 1.6, P, 40, 0.4), { tone: "mid" }));
  out.push(L(k.ring(dx, dy, DIAL_R, CBOX_H + 1.6, P, 40), { tone: "lo" }));
  const ticks = k.radialTicks(dx, dy, DIAL_R - 0.6, 25, 5, CBOX_H + 1.6, [1.2, 2.6], P, -Math.PI / 2, (Math.PI * 2 * 300) / 360);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // attempt lamps along the front edge, status and timeout lamps on the right
  for (const x of LAMPS) out.push(S(k.cylinder(x, -2, 2.6, CBOX_H, 0.8, P, 20), { tone: "lo" }));
  for (const [x, y] of [STATUS, TIMEOUT_LAMP]) out.push(S(k.cylinder(x, y, 3.2, CBOX_H, 1, P, 22), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([-158.5, 6.2], CBOX_H, P, "x"), "net.connect", { size: 3.4, tone: "mid", anchor: "start" }));
  // the cord gland on its +x face
  out.push(S(slab({ x: CBOX.x + CBOX.w, y: CPORT[1] - 3.4, w: 1.6, d: 6.8, r: 0.6 }, 6.6, 6.8, 2), { tone: "mid", crease: "none" }));
  // the holster the plug parks in
  const [hx, hy] = HOLSTER;
  out.push(halo({ x: hx - 6, y: hy - 6, w: 12, d: 12, r: 6 }, 0, 3));
  out.push(S(k.cylinder(hx, hy, 6, 0, 2, P, 28, 0.4), { tone: "lo" }));
  out.push(S(k.cylinder(hx, hy, 5, 2, SEAT - 2, P, 28, 0.3), { tone: "mid" }));
  out.push(L(k.ring(hx, hy, 2.6, SEAT, P, 20), { tone: "hi" }));
  return out.join("");
}
// lit parts of the client box, toggled live
const lampSvg = ([x, y], h, r) => S(k.cylinder(x, y, r, CBOX_H + h, 1.2, P, 20), { tone: "hi" }) + D([at([x, y, CBOX_H + h + 1.2])], { size: 0.7, tone: "hi" });

// ── the server side of the laptop ───────────────────────────────────────────
function strip() {
  const out = [halo(STRIP, 0, 5)];
  out.push(S(slab(STRIP, 0, STRIP_H, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(STRIP, 2, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(STRIP, 2.2), STRIP_H, P, 4), { tone: "faint" }));
  out.push(D([at([STRIP.x + STRIP.w / 2, STRIP.y + 3.4, STRIP_H]), at([STRIP.x + STRIP.w / 2, STRIP.y + STRIP.d - 3.4, STRIP_H])], { size: 0.45 }));
  for (const port of PORTS) {
    out.push(S(k.cylinder(JACK_X, port.y, 5.2, STRIP_H, 1.2, P, 28, 0.3), { tone: "mid" }));
    out.push(L(k.ring(JACK_X, port.y, 2.6, SEAT, P, 20), { tone: "hi" }));
    out.push(D([at([JACK_X, port.y, SEAT])], { size: 0.55, tone: "lo" }));
    out.push(k.faceTextSvg(k.topMatrix([STRIP.x + STRIP.w - 2, port.y + 6.4], STRIP_H, P, "x"), String(port.n), { size: 3.6, tone: "mid", anchor: "end" }));
    // the listening lamp's socket: dark unless a server is behind this port
    out.push(S(k.cylinder(LISTEN_LAMP_X, port.y - 4, 2.4, STRIP_H, 0.6, P, 18), { tone: "lo" }));
  }
  return out.join("");
}

function serverBox(plan, file) {
  const out = [halo(plan, 0, 4)];
  out.push(S(slab(plan, 0, SERVER_H, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, 5, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(plan, 2.2), SERVER_H, P, 4), { tone: "faint" }));
  for (let i = 0; i < 4; i += 1) out.push(L(k.planOutline({ x: plan.x + 5 + i * 4.2, y: plan.y + 5, w: 1.8, d: 14, r: 0.9 }, SERVER_H, P, 3), { tone: "lo" }));
  out.push(D(k.corners(plan, 2.4).map(([x, y]) => at([x, y, SERVER_H])), { size: 0.4 }));
  out.push(S(k.cylinder(plan.x + plan.w - 7, plan.y + 8, 2.6, SERVER_H, 1.4, P, 20), { tone: "hi", lit: true }));
  out.push(k.faceTextSvg(k.topMatrix([plan.x + plan.w - 5, plan.y + plan.d - 4], SERVER_H, P, "x"), file, { size: 3.2, tone: "mid", anchor: "end" }));
  return out.join("");
}

// the bus from a server box to its jack, flat on the deck
function bus(plan, jackY) {
  const x0 = STRIP.x + STRIP.w - 1, x1 = plan.x + 1;
  const out = [S(slab({ x: x0, y: jackY - 2, w: x1 - x0, d: 4, r: 0.8 }, 0, 0.8, 2), { tone: "lo", crease: "none" })];
  out.push(L(k.lineOnTop([x0 + 1, jackY], [x1 - 1, jackY], 0.8, P), { tone: "faint" }));
  return out.join("");
}
const listenLamp = (y) => S(k.cylinder(LISTEN_LAMP_X, y - 4, 1.8, STRIP_H + 0.6, 1, P, 16), { tone: "hi", lit: true }) + D([at([LISTEN_LAMP_X, y - 4, STRIP_H + 1.6])], { size: 0.6, tone: "hi" });

// a plug standing in a jack at (x, y); `tone` marks the server's (lit) or the client's
function plug(x, y, z0, bright) {
  const out = [];
  out.push(S(k.cylinder(x, y, 3.4, z0, 3, P, 24), { tone: "mid" }));
  out.push(`<g class="pl-band">${S(k.cylinder(x, y, 4.4, z0 + 3, 3, P, 28, 0.3), { tone: bright ? "hi" : "mid" })}</g>`);
  out.push(S(k.cylinder(x, y, 4.4, z0 + 6, 12, P, 32), { tone: "hi", lit: bright, inner: L(k.sideArc(x, y, 4.4, z0 + 15, P, 24), { tone: "faint" }) }));
  out.push(L(k.knurl(x, y, 4.4, z0 + 7, z0 + 13, 26, P), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, 2.8, z0 + 18, 4, P, 24, 0.4), { tone: "mid" }));
  out.push(D([at([x, y, z0 + 22])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

const server = (i, file) => bus(SERVERS[i], PORTS[i].y) + serverBox(SERVERS[i], file);

// ── assemble ────────────────────────────────────────────────────────────────
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A dialer standing for a TCP client. On the left of a base marked localhost, a client box labelled net.connect has a timer dial, three attempt lamps and a cord ending in a plug parked in a holster. On the right, a jack strip holds port 3001, wired to a command server behind the panel with its listening lamp lit, and port 3009, dark and empty. Off the base, a bare pad marked 10.255.255.1 has a single jack and nothing behind it. Connecting flies the plug along its cord to a jack: it seats on 3001, bounces off 3009 with ECONNREFUSED, and hangs over the bare pad until the client gives up. Bytes travel along the cord as small lettered tiles.",
  body: [
    laptop(),
    remote(),
    `<g data-part="server-0">${server(0, "exercise.ts")}</g>`,
    `<g data-part="server-1" style="display:none">${server(1, "node -e")}</g>`,
    strip(),
    `<g data-part="listen-0">${listenLamp(PORTS[0].y)}</g>`,
    `<g data-part="listen-1" style="display:none">${listenLamp(PORTS[1].y)}</g>`,
    clientBox(),
    `<g data-part="dial-needle"><path class="iso-line ev-needle" data-tone="hi"/><circle class="iso-wire-end" r="1.4"/></g>`,
    ...LAMPS.map((x, i) => `<g data-part="attempt-${i}" style="display:none">${lampSvg([x, -2], 0.8, 2)}</g>`),
    `<g data-part="status" style="display:none">${lampSvg(STATUS, 1, 2.4)}</g>`,
    `<g data-part="timeout" style="display:none">${lampSvg(TIMEOUT_LAMP, 1, 2.4)}</g>`,
    `<g data-part="cord"><path class="iso-line ev-cord" data-tone="mid"/><circle class="iso-wire-end" r="1.2"/></g>`,
    `<g data-part="plug">${plug(0, 0, 0, false)}</g>`,
    `<g data-part="beads"></g>`,
  ],
});

const controls = `
<div class="ee-controls" role="group" aria-label="Client calls">
  <div class="ee-row">
    <button data-do="c3001">net.connect(3001)</button>
    <button data-do="c3009">net.connect(3009)</button>
    <button data-do="cvoid">net.connect(80, '10.255.255.1')</button>
  </div>
  <div class="ee-row">
    <button data-do="time">write('time\\n')</button>
    <button data-do="quit">write('quit\\n')</button>
    <button data-do="destroy">destroy()</button>
    <button data-do="srv">start server on 3009</button>
    <button data-do="reset" class="ee-quiet">reset</button>
  </div>
</div>
<pre class="ee-console" aria-live="polite" aria-label="console output"></pre>`;

const CSS = `
<style>
.ev-cord{stroke-width:1.3px}
.ev-needle{stroke-width:1px}
.pl-band[data-err] .iso-shade,.pl-band[data-err] .iso-top{fill:var(--anatomy-red)}
.ev-bead rect{fill:var(--anatomy-card);stroke:var(--anatomy-hi);stroke-width:.6px}
.ev-bead text{font:600 6.4px/1 var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central}
.ev-bead[data-in] rect{stroke:var(--anatomy-mid)}
.ev-bead[data-in] text{fill:var(--anatomy-text)}
</style>`;

const geo = { CPORT, HOLSTER, SEAT, JACK_X, PORTS: PORTS.map((p) => p.y), REMOTE_JACK, DIAL, DIAL_R, CBOX_H };

const CHAPTER_TITLES = ["connect() returns at once", "Talking to the server", "ECONNREFUSED", "Retry with backoff", "Timeouts do nothing"];
const vname = theme === "light" ? "client-video-light" : "client-video";

const lesson = readFileSync(join(HERE, "video.js"), "utf8").replace("__P__", JSON.stringify(P)).replace("__GEO__", JSON.stringify(geo));

const body =
  PLAYER_CSS + CSS +
  k.plateHtml({
    fig: "Fig 3",
    title: "TCP client · the lesson",
    hint: "Space plays · ← → seek · 1–5 chapters",
    readout: "no socket",
    keys: [
      { mark: "lit", label: "Lamps by the jacks: a server listening on that port" },
      { mark: "raised", label: "Cord and plug: the client's one socket, flying out to connect" },
      { mark: "flat", label: "Dial: time since connect(), or until the next retry" },
    ],
    caption:
      "Lesson 3 played on a dialer, from 03-tcp-client/client.ts, retry.ts and timeout.ts. The client starts the conversation; the plug's flight is the handshake. A port with no server behind it bounces it straight back, an address that never answers leaves it hanging, and 'timeout' only tells you so. Pause anywhere and the calls below act on the board as it stands.",
    body: `<div class="iso-stage ee-stage" tabindex="0" role="group" aria-label="Lesson 3 video: a TCP client as a dialer. Space plays and pauses, arrow keys seek.">${svg}${playerHtml({ chapters: CHAPTER_TITLES, mp4: vname + ".mp4" })}${controls}</div>`,
  });

writeFileSync(join(HERE, vname + ".html"), k.pageHtml({ title: "TCP client lesson", theme, body, script: kitScript() + playerScript() + lesson, width: 720 }));
console.log("wrote", vname + ".html");
