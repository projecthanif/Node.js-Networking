
// ── live: a tiny TCP model driving the machine ──────────────────────────────
const P = __P__;
const { SLOT_X, ECHO, CART_H, CABLES } = __CONST__;

const stage = document.querySelector(".tcp-stage");
const svg = stage.querySelector("svg");
const $ = (sel, root = svg) => root.querySelector(sel);
const echoEl = $('[data-part="echo"]');
const rivalEl = $('[data-part="rival"]');
const lampEl = $('[data-role="lamp"]', echoEl);
const beadsEl = $('[data-part="beads"]');
const readout = document.querySelector("[data-readout]");
const consoleEl = stage.querySelector(".tcp-console");
const input = stage.querySelector("[data-text]");
const buttons = [...stage.querySelectorAll("button[data-do]")];
const picks = [...stage.querySelectorAll("button[data-pick]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const NS = "http://www.w3.org/2000/svg";

// cable geometry in screen px, for beads
const lengths = CABLES.map((pts) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0));
function pointOn(index, s) {
  const pts = CABLES[index];
  let left = Math.max(0, Math.min(lengths[index], s));
  for (let i = 1; i < pts.length; i += 1) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (left <= seg) { const t = seg ? left / seg : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]; }
    left -= seg;
  }
  return pts[pts.length - 1];
}

// ── state ───────────────────────────────────────────────────────────────────
const server = { state: "off", z: 40, tz: 40, alpha: 0, talpha: 0, lamp: 0, online: 0 };
const rival = { z: 50, tz: 50, alpha: 0, talpha: 0, shake: 0, busy: false };
const clients = [0, 1, 2].map((i) => ({
  i,
  state: "off",
  reveal: 0,
  treveal: 0,
  port: 0,
  sock: 0,
  tsock: 0,
  glow: 0,
  text: "",
  el: $(`[data-cable="${i}"]`),
  term: $(`[data-term="${i}"]`),
  sockEl: $(`[data-sock="${i}"]`, echoEl),
}));
const packets = [];
let picked = 0, clock = 0;

// ── scheduler ───────────────────────────────────────────────────────────────
const waiters = [];
const until = (test) => new Promise((resolve) => { waiters.push({ test, resolve }); run(); });
const sleep = (s) => { const end = clock + (still.matches ? s * 0.2 : s); return until(() => clock >= end); };

// a packet: bytes riding a cable together; dir +1 is client → server
function send(client, dir, count, kind = "data") {
  return new Promise((resolve) => {
    packets.push({ c: client.i, dir, s: 0, count: Math.max(1, Math.min(count, 14)), kind, resolve });
    run();
  });
}

// ── output ──────────────────────────────────────────────────────────────────
function log(text, kind = "out") {
  const line = document.createElement("span");
  line.className = "c-" + kind;
  line.textContent = text;
  consoleEl.append(line);
  while (consoleEl.children.length > 30) consoleEl.firstChild.remove();
}

const COLS = 12;
function print(client, text) {
  client.text = (client.text + text).slice(-400);
  const lines = client.text.split("\n").slice(-3);
  while (lines.length < 3) lines.unshift("");
  lines.forEach((line, row) => {
    const shown = line.length > COLS ? "…" + line.slice(-(COLS - 1)) : line;
    const el = $(`[data-role="l${row}"]`, client.term);
    if (el.textContent !== shown) el.textContent = shown;
  });
  client.glow = 1;
}

const who = (c) => `::1:${c.port}`;
const hex = (text) => [...new TextEncoder().encode(text)].map((b) => b.toString(16).padStart(2, "0")).join(" ");
const open = () => clients.filter((c) => c.state === "open" || c.state === "closing").length;

function describe() {
  const n = open();
  let text = "not listening";
  if (server.state === "listening") text = `listening :3000 · ${n} socket${n === 1 ? "" : "s"}`;
  if (server.state === "closing") text = `closing · waiting on ${n} socket${n === 1 ? "" : "s"}`;
  if (readout.textContent !== text) readout.textContent = text;
  const c = clients[picked];
  for (const b of buttons) {
    const act = b.dataset.do;
    if (act === "listen") {
      b.textContent = server.state === "listening" ? "server.close()" : "server.listen(3000)";
      b.disabled = server.state === "closing" || rival.busy || server.moving;
    }
    if (act === "rival") b.disabled = rival.busy || server.moving || server.state === "closing";
    if (act === "connect") b.disabled = c.state !== "off";
    if (act === "send" || act === "end" || act === "kill") b.disabled = c.state !== "open";
  }
  picks.forEach((p, i) => p.setAttribute("aria-pressed", String(i === picked)));
}

// ── server ──────────────────────────────────────────────────────────────────
async function listen() {
  if (server.state === "listening") return close();
  server.moving = true;
  server.state = "listening";
  echoEl.style.display = "";
  server.tz = 0;
  server.talpha = 1;
  describe();
  await until(() => Math.abs(server.z) < 0.3);
  server.moving = false;
  log("listening on port 3000");
  describe();
}

async function close() {
  log("server.close()", "sys");
  if (open()) {
    server.state = "closing";
    log(`// no new connections; waiting for ${open()} open socket(s)`, "sys");
    describe();
    await until(() => open() === 0);
  }
  server.moving = true;
  server.state = "off";
  server.tz = 40;
  server.talpha = 0;
  describe();
  await until(() => server.alpha < 0.02);
  echoEl.style.display = "none";
  server.moving = false;
  log("// server closed — port 3000 is free", "sys");
  describe();
}

async function second() {
  rival.busy = true;
  describe();
  log("second.listen(3000)", "sys");
  const taken = server.state !== "off";
  rival.z = 50;
  rival.alpha = 0;
  rivalEl.style.display = "";
  rival.tz = taken ? CART_H + 1.5 : 0;
  rival.talpha = 1;
  await until(() => Math.abs(rival.z - rival.tz) < 0.3);
  if (taken) {
    rival.shake = 1;
    await sleep(0.45);
    log("second server failed: EADDRINUSE", "err");
  } else {
    log("second server got port 3000");
    await sleep(1.2);
    log("second.close() — port is free again", "sys");
  }
  rival.tz = 50;
  rival.talpha = 0;
  await until(() => rival.alpha < 0.02);
  rivalEl.style.display = "none";
  rival.busy = false;
  describe();
}

// ── clients ─────────────────────────────────────────────────────────────────
async function connect(c) {
  if (c.state !== "off") return;
  c.state = "connecting";
  c.port = 49152 + Math.floor(Math.random() * 16000);
  c.text = "";
  print(c, `$ nc localhost 3000\n`);
  c.treveal = 1;
  describe();
  await until(() => c.reveal > 0.995);
  if (server.state !== "listening") {
    await sleep(0.15);
    print(c, "refused\n");
    log(`// client ${c.i + 1}: connect ECONNREFUSED 127.0.0.1:3000 — nobody is listening`, "sys");
    c.treveal = 0;
    await until(() => c.reveal < 0.01);
    c.state = "off";
    describe();
    return;
  }
  c.state = "open";
  c.tsock = 1;
  server.online += 1;
  log(`[+] ${who(c)} connected`);
  log(`Clients online: ${server.online}`);
  describe();
  const hi = "hi! type something and I'll echo it back\n";
  await send(c, -1, hi.length);
  print(c, hi);
}

async function write(c, text) {
  if (c.state !== "open") return;
  const bytes = text + "\n";
  print(c, bytes); // nc shows what you typed
  // TCP has no messages: the bytes may arrive in one chunk or several
  const cuts = [];
  if (bytes.length > 3 && Math.random() < 0.6) cuts.push(1 + Math.floor(Math.random() * (bytes.length - 2)));
  const chunks = [];
  let from = 0;
  for (const cut of [...cuts, bytes.length]) { chunks.push(bytes.slice(from, cut)); from = cut; }
  const arrivals = chunks.map(async (chunk, index) => {
    await sleep(index * 0.32);
    await send(c, +1, chunk.length);
    if (c.state !== "open") return;
    log(`[${who(c)}] bytes: <Buffer ${hex(chunk)}>`);
    log(`[${who(c)}] text:  ${JSON.stringify(chunk)}`);
    const echo = `echo: ${chunk}`;
    await send(c, -1, echo.length);
    if (c.state === "open") print(c, echo);
  });
  await Promise.all(arrivals);
}

async function end(c) {
  if (c.state !== "open") return;
  c.state = "closing";
  describe();
  await send(c, +1, 1, "fin");
  log(`[${who(c)}] ended`);
  await send(c, -1, 1, "fin"); // allowHalfOpen is false: the server ends its side too
  finish(c, false);
}

async function kill(c) {
  if (c.state !== "open") return;
  c.state = "closing";
  print(c, "^C\n");
  describe();
  await send(c, +1, 1, "rst");
  log(`[${who(c)}] error: read ECONNRESET`, "err");
  finish(c, true);
}

async function finish(c, hadError) {
  log(`[-] ${who(c)} closed (error: ${hadError})`);
  c.tsock = 0;
  c.treveal = 0;
  describe();
  await until(() => c.reveal < 0.01);
  c.state = "off";
  describe();
}

function reset() {
  packets.length = 0;
  waiters.length = 0; // abandon anything still in flight from before
  for (const c of clients) {
    c.state = "off"; c.reveal = c.treveal = 0; c.sock = c.tsock = 0; c.text = ""; print(c, "");
    c.glow = 0;
  }
  Object.assign(server, { state: "off", z: 40, tz: 40, alpha: 0, talpha: 0, online: 0, moving: false });
  Object.assign(rival, { z: 50, tz: 50, alpha: 0, talpha: 0, busy: false });
  echoEl.style.display = "none";
  rivalEl.style.display = "none";
  consoleEl.textContent = "";
  log("$ npx tsx 02-tcp-server/echo-server.ts", "sys");
  describe();
  run();
}

// ── tour: echo-server.ts with three nc windows, then port-in-use.ts ─────────
let touring = false, tourId = 0, idleTimer = 0;
async function tour() {
  const id = ++tourId;
  touring = true;
  const C = clients;
  const steps = [
    reset, () => sleep(0.8),
    listen, () => sleep(0.6),
    () => connect(C[0]), () => sleep(0.5),
    () => connect(C[1]), () => sleep(0.8),
    () => write(C[0], "hello"), () => sleep(0.5),
    () => write(C[1], "hi there"), () => sleep(0.8),
    second, () => sleep(0.6),
    () => connect(C[2]), () => sleep(0.6),
    () => end(C[0]), () => sleep(0.5),
    () => kill(C[1]), () => sleep(0.8),
    () => { close(); }, () => sleep(1.4),
    () => end(C[2]), () => sleep(1.6),
    () => connect(C[0]), () => sleep(3),
  ];
  for (const step of steps) {
    if (!touring || id !== tourId) return;
    await step();
  }
  if (touring && id === tourId) tour();
}
function stopTour() {
  const was = touring;
  touring = false;
  tourId += 1;
  clearTimeout(idleTimer);
  if (!still.matches) idleTimer = setTimeout(tour, 25000);
  return was;
}
function takeOver() { if (stopTour()) reset(); }

const actions = {
  listen,
  rival: second,
  connect: () => connect(clients[picked]),
  send: () => write(clients[picked], input.value || " "),
  end: () => end(clients[picked]),
  kill: () => kill(clients[picked]),
};
for (const b of buttons) b.addEventListener("click", () => { takeOver(); actions[b.dataset.do](); describe(); });
for (const p of picks) p.addEventListener("click", () => { stopTour(); picked = Number(p.dataset.pick); describe(); });
input.addEventListener("focus", () => takeOver());
input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); takeOver(); actions.send(); } });
stage.addEventListener("pointerdown", (e) => { if (!e.target.closest("button,input")) stopTour(); });

// ── frame loop ──────────────────────────────────────────────────────────────
let frame = 0, last = 0, visible = false;
const ease = (from, to, dt, tau) => (still.matches ? to : from + (to - from) * (1 - Math.exp(-dt / tau)));
const SPEED = 165; // screen px per second along a cable

function step(dt) {
  clock += dt;
  server.z = ease(server.z, server.tz, dt, 0.2);
  server.alpha = ease(server.alpha, server.talpha, dt, 0.18);
  server.lamp = ease(server.lamp, server.state === "listening" ? 1 : 0.15, dt, 0.2);
  rival.z = ease(rival.z, rival.tz, dt, 0.2);
  rival.alpha = ease(rival.alpha, rival.talpha, dt, 0.18);
  rival.shake *= Math.exp(-dt / 0.2);

  const wob = still.matches ? 0 : Math.sin(clock * 50) * 1.6 * rival.shake;
  echoEl.setAttribute("transform", translateAlong(P, [SLOT_X[ECHO], 0, server.z]));
  echoEl.setAttribute("opacity", Math.min(1, server.alpha).toFixed(3));
  lampEl.setAttribute("opacity", server.lamp.toFixed(3));
  rivalEl.setAttribute("transform", translateAlong(P, [SLOT_X[ECHO] + wob, 0, rival.z]));
  rivalEl.setAttribute("opacity", Math.min(1, rival.alpha).toFixed(3));

  for (const c of clients) {
    const span = still.matches ? 0 : 0.5;
    c.reveal = span ? Math.max(0, Math.min(1, c.reveal + Math.sign(c.treveal - c.reveal) * dt / span)) : c.treveal;
    if (Math.abs(c.reveal - c.treveal) < 0.004) c.reveal = c.treveal;
    c.sock = ease(c.sock, c.tsock, dt, 0.15);
    c.glow *= Math.exp(-dt / 0.6);
    c.el.querySelector('[data-role="run"]').style.strokeDashoffset = String(1 - c.reveal);
    c.el.querySelector('[data-role="end"]').style.opacity = c.reveal > 0.99 ? "1" : "0";
    c.sockEl.style.display = c.sock > 0.02 ? "" : "none";
    c.sockEl.setAttribute("transform", translateAlong(P, [0, 3 * c.sock, 0]));
    c.sockEl.setAttribute("opacity", Math.min(1, c.sock * 1.4).toFixed(3));
    const glass = c.term.querySelector('[data-role="glass"] .iso-solid');
    if (c.glow > 0.15) glass.setAttribute("data-lit", ""); else glass.removeAttribute("data-lit");
  }

  // beads
  const dots = [];
  for (const p of [...packets]) {
    p.s += (still.matches ? 4000 : SPEED) * dt;
    const len = lengths[p.c];
    const span = (p.count - 1) * 3.2;
    for (let b = 0; b < p.count; b += 1) {
      const along = p.s - b * 3.2;
      if (along < 0 || along > len) continue;
      const [x, y] = pointOn(p.c, p.dir > 0 ? along : len - along);
      const kind = p.kind === "data" ? (p.dir > 0 ? "out" : "back") : p.kind;
      dots.push(`<circle class="tcp-bead" data-kind="${kind}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p.kind === "data" ? 1.15 : 1.5}"/>`);
    }
    if (p.s - span >= len) { packets.splice(packets.indexOf(p), 1); p.resolve(); }
  }
  const html = dots.join("");
  if (beadsEl.innerHTML !== html) beadsEl.innerHTML = html;

  for (const w of [...waiters]) if (w.test()) { waiters.splice(waiters.indexOf(w), 1); w.resolve(); }
}

function settled() {
  if (waiters.length || packets.length) return false;
  if (Math.abs(server.z - server.tz) > 0.01 || Math.abs(server.alpha - server.talpha) > 0.002) return false;
  if (Math.abs(rival.z - rival.tz) > 0.01 || rival.shake > 0.01) return false;
  return clients.every((c) => c.reveal === c.treveal && Math.abs(c.sock - c.tsock) < 0.002 && c.glow < 0.01);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  step(dt);
  describe();
  frame = visible && !settled() ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }

new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);

reset();
step(0);
if (!still.matches) idleTimer = setTimeout(tour, 1400);
