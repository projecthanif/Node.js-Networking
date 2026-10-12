
// ── live: a tiny EventEmitter model driving the bell board ──────────────────
const P = __P__;
const { SLOTS, ERR_X, HOME, KEY_H } = __CONST__;

const stage = document.querySelector(".ee-stage");
const svg = stage.querySelector("svg");
const $ = (sel) => svg.querySelector(sel);
const carriageEl = $('[data-part="carriage"]');
const strikerEl = $('[data-part="striker"]');
const keyKnockEl = $('[data-part="key-knock"]');
const keyErrorEl = $('[data-part="key-error"]');
const leverEl = $('[data-part="lever"]');
const lampEl = $('[data-part="lamp"]');
const readout = document.querySelector("[data-readout]");
const consoleEl = stage.querySelector(".ee-console");
const buttons = [...stage.querySelectorAll("button[data-do]")];
const still = matchMedia("(prefers-reduced-motion: reduce)");

const pool = { on: [], once: [], error: [] };
for (const el of svg.querySelectorAll("[data-chime]")) pool[el.dataset.kind].push(el);

// ── state ───────────────────────────────────────────────────────────────────
const listeners = { knock: [], error: [] };
const fading = []; // chimes on their way off the board
const car = { x: HOME, target: HOME, v: 0, dy: 0 };
const keys = { knock: 0, knockTo: 0, error: 0, errorTo: 0 };
const breaker = { at: 0, to: 0, lamp: 1 };
let busy = false, dead = false, clock = 0;
const WHO = ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank"];
let whoAt = 0;
const NAMES = ["logger", "audit", "notify", "metrics", "trace"];

// ── tiny scheduler: promises resolved from the frame loop ───────────────────
const waiters = [];
const until = (test) => new Promise((resolve) => { waiters.push({ test, resolve }); run(); });
const sleep = (s) => { const end = clock + (still.matches ? s * 0.25 : s); return until(() => clock >= end); };

// ── chimes ──────────────────────────────────────────────────────────────────
function hang(kind, fn, event = "knock") {
  const el = pool[kind].pop();
  if (!el) return null;
  const x = event === "error" ? ERR_X : SLOTS[listeners.knock.length];
  const chime = { el, kind, fn, event, x, tx: x, z: 14, tz: 0, alpha: 0, talpha: 1, vz: 0, ring: 0, shake: 0, mode: "hang" };
  el.style.display = "";
  listeners[event].push(chime);
  return chime;
}

function unhang(chime, how) {
  const list = listeners[chime.event];
  const index = list.indexOf(chime);
  if (index >= 0) list.splice(index, 1);
  chime.mode = how; // "drop" or "lift"
  if (how === "lift") { chime.tz = 16; chime.talpha = 0; }
  fading.push(chime);
  if (how !== "hold") restack();
}

function restack() {
  listeners.knock.forEach((chime, index) => { chime.tx = SLOTS[index]; });
}

function retire(chime) {
  chime.el.style.display = "none";
  chime.el.removeAttribute("opacity");
  pool[chime.kind].push(chime.el);
  fading.splice(fading.indexOf(chime), 1);
}

// ── the carriage ────────────────────────────────────────────────────────────
async function travel(where) {
  const target = typeof where === "function" ? where : () => where;
  car.target = target();
  await until(() => { car.target = target(); return Math.abs(car.x - car.target) < 0.25 && Math.abs(car.v) < 4; });
}

let strikeAt = -1, onContact = null;
async function strike(contact) {
  strikeAt = 0;
  onContact = contact;
  await until(() => strikeAt < 0);
}

// ── console and readout ─────────────────────────────────────────────────────
function log(text, kind = "out") {
  const line = document.createElement("span");
  line.className = "c-" + kind;
  line.textContent = text;
  consoleEl.append(line);
  while (consoleEl.children.length > 30) consoleEl.firstChild.remove();
}

function describe() {
  let text = `listenerCount('knock') = ${listeners.knock.length}`;
  if (dead) text = "process exited · code 1";
  else if (busy) text += " · emit() running";
  if (readout.textContent !== text) readout.textContent = text;
  const off = listeners.knock.some((c) => c.fn === "logger");
  for (const button of buttons) {
    const act = button.dataset.do;
    button.disabled = act === "reset" ? busy && !dead : busy || dead;
    if (act === "on-error") button.textContent = listeners.error.length ? "off('error', handler)" : "on('error', handler)";
    if (act === "off") button.style.opacity = button.disabled ? "" : off ? "" : ".6";
  }
  stage.querySelector("[data-who]").textContent = WHO[whoAt % WHO.length];
  stage.querySelector("[data-next]").textContent = NAMES.find((n) => !listeners.knock.some((c) => c.fn === n)) || "fn";
}

function setBusy(value) { busy = value; describe(); }

// ── the EventEmitter calls ──────────────────────────────────────────────────
const say = {
  greet: (who) => `[on]   ${who} knocked`,
  first: (who) => `[once] first knock was ${who}`,
  logger: () => "[logger] knock",
};

async function emitKnock() {
  const who = WHO[whoAt++ % WHO.length];
  setBusy(true);
  log(`door.emit('knock', '${who}')`, "sys");
  log("before emit");
  keys.knockTo = 1;
  await sleep(0.25);
  const list = listeners.knock.slice(); // Node copies the array: listeners added now wait for the next emit
  if (!list.length) {
    await travel(SLOTS[0]);
    log("(no listeners: emit returned false)", "sys");
  }
  for (const chime of list) {
    if (!listeners.knock.includes(chime)) continue;
    await travel(() => chime.tx);
    if (chime.kind === "once") unhang(chime, "hold"); // once() unhooks itself *before* it runs
    await strike(() => {
      chime.ring = 1;
      log((say[chime.fn] || ((w) => `[${chime.fn}] ${w} knocked`))(who));
      if (chime.kind === "once") { chime.mode = "drop"; restack(); }
    });
    await sleep(0.12);
  }
  await travel(HOME);
  keys.knockTo = 0;
  await sleep(0.15);
  log("after emit");
  setBusy(false);
}

async function emitError() {
  setBusy(true);
  log("door.emit('error', new Error('connection reset'))", "sys");
  keys.errorTo = 1;
  await sleep(0.25);
  await travel(ERR_X);
  const handler = listeners.error[0];
  await strike(() => {
    if (handler) { handler.ring = 1; log("handled error: connection reset"); }
  });
  if (!handler) {
    breaker.to = 1;
    await sleep(0.35);
    dead = true;
    stage.setAttribute("data-dead", "");
    log("Uncaught Error: connection reset", "err");
    log("    at door.emit (node:events)", "err");
    log("process exited with code 1 — press reset", "sys");
    keys.errorTo = 0;
    busy = false;
    describe();
    return;
  }
  await travel(HOME);
  keys.errorTo = 0;
  await sleep(0.15);
  log("still alive 👍");
  setBusy(false);
}

function on(kind) {
  if (listeners.knock.length >= SLOTS.length) {
    log("// the board has 5 hooks (Node allows more, and warns past 10)", "sys");
    return;
  }
  if (kind === "once") {
    if (!hang("once", "first")) return log("// out of once() chimes — emit to use them up", "sys");
    log("door.once('knock', (who) => …)", "sys");
  } else {
    const fn = NAMES.find((n) => !listeners.knock.some((c) => c.fn === n)) || "fn";
    hang("on", fn);
    log(`door.on('knock', ${fn})`, "sys");
  }
  describe();
}

function off() {
  log("door.off('knock', logger)", "sys");
  const list = listeners.knock;
  const chime = [...list].reverse().find((c) => c.fn === "logger");
  if (!chime) log("// logger isn't attached — nothing removed", "sys");
  else unhang(chime, "lift");
  describe();
}

function offNew() {
  log("door.off('knock', () => console.log('[logger] knock'))", "sys");
  log("// nothing removed: a new arrow function is a different reference", "sys");
  for (const chime of listeners.knock) chime.shake = 1;
  run();
}

function toggleError() {
  if (listeners.error.length) {
    log("door.off('error', handler)", "sys");
    unhang(listeners.error[0], "lift");
  } else {
    log("door.on('error', handler)", "sys");
    hang("error", "handler", "error");
  }
  describe();
}

function reset(quiet) {
  for (const chime of [...listeners.knock, ...listeners.error, ...fading]) {
    chime.el.style.display = "none";
    pool[chime.kind].push(chime.el);
  }
  listeners.knock.length = 0;
  listeners.error.length = 0;
  fading.length = 0;
  dead = false;
  stage.removeAttribute("data-dead");
  breaker.to = 0;
  keys.knockTo = keys.errorTo = 0;
  car.target = HOME;
  whoAt = 0;
  consoleEl.textContent = "";
  log("// 01-events/basics.ts", "sys");
  log("door.on('knock', greet)", "sys");
  log("door.once('knock', first)", "sys");
  hang("on", "greet");
  hang("once", "first");
  if (quiet || still.matches) for (const c of listeners.knock) { c.z = 0; c.alpha = 1; }
  busy = false;
  describe();
  run();
}

// ── the idle tour: basics.ts, then error-event.ts ───────────────────────────
let touring = false, tourId = 0, idleTimer = 0;
async function tour() {
  const id = ++tourId;
  touring = true;
  const steps = [
    () => reset(false), () => sleep(0.8),
    emitKnock, () => sleep(0.9),
    emitKnock, () => sleep(0.9),
    () => on("on"), () => sleep(0.9),
    emitKnock, () => sleep(0.9),
    off, () => sleep(0.9),
    emitKnock, () => sleep(1.2),
    toggleError, () => sleep(0.8),
    emitError, () => sleep(0.9),
    toggleError, () => sleep(0.8),
    emitError, () => sleep(3.2),
  ];
  for (const step of steps) {
    if (!touring || id !== tourId) return;
    await step();
  }
  if (touring && id === tourId) tour();
}
function stopTour() {
  touring = false;
  clearTimeout(idleTimer);
  if (!still.matches) idleTimer = setTimeout(() => { if (!busy) tour(); }, 20000);
}

const actions = { emit: emitKnock, on: () => on("on"), once: () => on("once"), off, "off-new": offNew, error: emitError, "on-error": toggleError, reset: () => reset(false) };
for (const button of buttons) {
  button.addEventListener("click", () => {
    const wasTouring = touring;
    stopTour();
    if (wasTouring && button.dataset.do !== "reset" && !dead) reset(true);
    if (busy && !dead) return;
    actions[button.dataset.do]();
  });
}
stage.addEventListener("pointerdown", (event) => { if (!event.target.closest("button")) stopTour(); });

// ── frame loop ──────────────────────────────────────────────────────────────
let frame = 0, last = 0, visible = false;
const ease = (from, to, dt, tau) => (still.matches ? to : from + (to - from) * (1 - Math.exp(-dt / tau)));

function drawChime(chime) {
  const wobble = still.matches ? 0 : Math.sin(clock * 55) * 1.1 * Math.max(chime.ring * 0.8, chime.shake);
  chime.el.setAttribute("transform", translateAlong(P, [chime.x + wobble, 0, chime.z]));
  const alpha = Math.max(0, Math.min(1, chime.alpha));
  if (alpha < 0.999) chime.el.setAttribute("opacity", alpha.toFixed(3));
  else chime.el.removeAttribute("opacity");
  const tube = chime.el.querySelector(".ch-tube > .iso-solid");
  if (chime.ring > 0.18) tube.setAttribute("data-lit", "");
  else tube.removeAttribute("data-lit");
}

function step(dt) {
  clock += dt;
  // carriage: a belt drive with a top speed, easing in and out of each stop
  const gap = car.target - car.x;
  const want = Math.sign(gap) * Math.min(Math.abs(gap) / 0.16, 300);
  car.v = still.matches ? 0 : car.v + (want - car.v) * (1 - Math.exp(-dt / 0.08));
  car.x = still.matches ? car.target : car.x + car.v * dt;
  if (Math.abs(car.target - car.x) < 0.05 && Math.abs(car.v) < 1) { car.x = car.target; car.v = 0; }

  // the hammer: out, contact, back
  if (strikeAt >= 0) {
    strikeAt += dt / (still.matches ? 0.05 : 0.26);
    if (onContact && strikeAt >= 0.5) { onContact(); onContact = null; }
    if (strikeAt >= 1) strikeAt = -1;
  }
  car.dy = strikeAt >= 0 ? -3 * Math.sin(Math.PI * Math.min(1, strikeAt)) : 0;

  for (const chime of [...listeners.knock, ...listeners.error, ...fading]) {
    chime.x = ease(chime.x, chime.tx, dt, 0.22);
    chime.ring *= Math.exp(-dt / 0.45);
    chime.shake *= Math.exp(-dt / 0.18);
    if (chime.mode === "drop") {
      chime.vz -= 520 * dt;
      chime.z = Math.max(-33.4, chime.z + chime.vz * dt);
      if (chime.z <= -33.4 || still.matches) { chime.z = -33.4; chime.talpha = 0; }
      chime.alpha = ease(chime.alpha, chime.talpha, dt, 0.18);
    } else {
      chime.z = ease(chime.z, chime.tz, dt, 0.22);
      chime.alpha = ease(chime.alpha, chime.talpha, dt, 0.2);
    }
    drawChime(chime);
  }
  for (const chime of [...fading]) if (chime.mode !== "hold" && chime.alpha < 0.01) retire(chime);

  keys.knock = ease(keys.knock, keys.knockTo, dt, 0.06);
  keys.error = ease(keys.error, keys.errorTo, dt, 0.06);
  breaker.at = ease(breaker.at, breaker.to, dt, 0.05);
  breaker.lamp = ease(breaker.lamp, dead ? 0.15 : 1, dt, 0.25);

  carriageEl.setAttribute("transform", translateAlong(P, [car.x, 0, 0]));
  strikerEl.setAttribute("transform", translateAlong(P, [0, car.dy, 0]));
  keyKnockEl.setAttribute("transform", translateAlong(P, [0, 0, -2.4 * keys.knock]));
  keyErrorEl.setAttribute("transform", translateAlong(P, [0, 0, -2.4 * keys.error]));
  leverEl.setAttribute("transform", translateAlong(P, [0, 0, -7 * breaker.at]));
  lampEl.setAttribute("opacity", breaker.lamp.toFixed(3));

  for (const waiter of [...waiters]) {
    if (waiter.test()) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(); }
  }
}

function settled() {
  if (waiters.length || strikeAt >= 0 || fading.length) return false;
  if (car.x !== car.target) return false;
  for (const c of [...listeners.knock, ...listeners.error]) {
    if (Math.abs(c.x - c.tx) > 0.01 || Math.abs(c.z - c.tz) > 0.01 || Math.abs(c.alpha - c.talpha) > 0.002 || c.ring > 0.01 || c.shake > 0.01) return false;
  }
  return Math.abs(keys.knock - keys.knockTo) < 0.002 && Math.abs(keys.error - keys.errorTo) < 0.002 && Math.abs(breaker.at - breaker.to) < 0.002;
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

reset(true);
step(0);
if (!still.matches) setTimeout(() => { if (!busy && !touring && idleTimer === 0) tour(); }, 1400);
