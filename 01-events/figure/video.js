// ── Lesson 1 as a video: the bell board played from a script ───────────────
// Runs on shared/player.js, which owns time, seeking, captions and the console.
const P = __P__;
const { SLOTS, ERR_X, HOME } = __CONST__;

const stage = document.querySelector(".ee-stage");
const svg = stage.querySelector("svg");
const $ = (sel) => svg.querySelector(sel);
const carriageEl = $('[data-part="carriage"]');
const strikerEl = $('[data-part="striker"]');
const keyKnockEl = $('[data-part="key-knock"]');
const keyErrorEl = $('[data-part="key-error"]');
const leverEl = $('[data-part="lever"]');
const lampEl = $('[data-part="lamp"]');

const chimeEls = { on: [], once: [], error: [] };
for (const el of svg.querySelectorAll("[data-chime]")) chimeEls[el.dataset.kind].push(el);
const allChimeEls = [...svg.querySelectorAll("[data-chime]")];

// ── board state (pure: no DOM writes until draw) ────────────────────────────
const WHO = ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank"];
const NAMES = ["logger", "audit", "notify", "metrics", "trace"];

function fresh() {
  return {
    pool: { on: [...chimeEls.on], once: [...chimeEls.once], error: [...chimeEls.error] },
    listeners: { knock: [], error: [] },
    fading: [],
    car: { x: HOME, target: HOME, v: 0, dy: 0 },
    keys: { knock: 0, knockTo: 0, error: 0, errorTo: 0 },
    breaker: { at: 0, to: 0, lamp: 1 },
    strikeAt: -1, onContact: null,
    busy: false, dead: false, who: 0,
  };
}


function* travel(where) {
  const target = typeof where === "function" ? where : () => where;
  S.car.target = target();
  yield () => { S.car.target = target(); return S.car.x === S.car.target; };
}
function* strike(contact) {
  S.strikeAt = 0;
  S.onContact = contact;
  yield () => S.strikeAt < 0;
}


// ── chimes ──────────────────────────────────────────────────────────────────
function hang(kind, fn, event = "knock") {
  const el = S.pool[kind].shift();
  if (!el) return null;
  const x = event === "error" ? ERR_X : SLOTS[S.listeners.knock.length];
  const chime = { el, kind, fn, event, x, tx: x, z: 14, tz: 0, alpha: 0, talpha: 1, vz: 0, ring: 0, shake: 0, mode: "hang" };
  S.listeners[event].push(chime);
  return chime;
}
function unhang(chime, how) {
  const list = S.listeners[chime.event];
  const index = list.indexOf(chime);
  if (index >= 0) list.splice(index, 1);
  chime.mode = how; // "drop", "lift" or "hold" (a once() chime, unhooked but still ringing)
  if (how === "lift") { chime.tz = 16; chime.talpha = 0; }
  S.fading.push(chime);
  if (how !== "hold") restack();
}
function restack() { S.listeners.knock.forEach((chime, index) => { chime.tx = SLOTS[index]; }); }
function retire(chime) {
  S.pool[chime.kind].push(chime.el);
  S.fading.splice(S.fading.indexOf(chime), 1);
}


// ── the EventEmitter calls ──────────────────────────────────────────────────
const say = {
  greet: (who) => `[on]   ${who} knocked`,
  first: (who) => `[once] first knock was ${who}`,
  logger: () => "[logger] knock",
};

function* emitKnock() {
  const who = WHO[S.who++ % WHO.length];
  S.busy = true;
  press("emit");
  log(`door.emit('knock', '${who}')`, "sys");
  log("before emit");
  S.keys.knockTo = 1;
  yield* sleep(0.25);
  const list = S.listeners.knock.slice(); // Node copies the array: listeners added now wait for the next emit
  if (!list.length) {
    yield* travel(SLOTS[0]);
    log("(no listeners: emit returned false)", "sys");
  }
  for (const chime of list) {
    if (!S.listeners.knock.includes(chime)) continue;
    yield* travel(() => chime.tx);
    if (chime.kind === "once") unhang(chime, "hold"); // once() unhooks itself *before* it runs
    yield* strike(() => {
      chime.ring = 1;
      log((say[chime.fn] || ((w) => `[${chime.fn}] ${w} knocked`))(who));
      if (chime.kind === "once") { chime.mode = "drop"; restack(); }
    });
    yield* sleep(0.12);
  }
  yield* travel(HOME);
  S.keys.knockTo = 0;
  yield* sleep(0.15);
  log("after emit");
  S.busy = false;
}

function* emitError() {
  S.busy = true;
  press("error");
  log("door.emit('error', new Error('connection reset'))", "sys");
  S.keys.errorTo = 1;
  yield* sleep(0.25);
  yield* travel(ERR_X);
  const handler = S.listeners.error[0];
  yield* strike(() => { if (handler) { handler.ring = 1; log("handled error: connection reset"); } });
  if (!handler) {
    S.breaker.to = 1;
    yield* sleep(0.35);
    S.dead = true;
    log("Uncaught Error: connection reset", "err");
    log("    at door.emit (node:events)", "err");
    log("process exited with code 1", "sys");
    S.keys.errorTo = 0;
    S.busy = false;
    return;
  }
  yield* travel(HOME);
  S.keys.errorTo = 0;
  yield* sleep(0.15);
  log("still alive 👍");
  S.busy = false;
}

function* on(kind, name) {
  if (S.listeners.knock.length >= SLOTS.length) { log("// the board has 5 hooks (Node allows more, and warns past 10)", "sys"); return; }
  press(kind);
  if (kind === "once") {
    if (!hang("once", "first")) { log("// out of once() chimes — emit to use them up", "sys"); return; }
    log("door.once('knock', first)", "sys");
  } else {
    const fn = name || NAMES.find((n) => !S.listeners.knock.some((c) => c.fn === n)) || "fn";
    hang("on", fn);
    log(`door.on('knock', ${fn})`, "sys");
  }
}

function* off() {
  press("off");
  log("door.off('knock', logger)", "sys");
  const chime = [...S.listeners.knock].reverse().find((c) => c.fn === "logger");
  if (!chime) log("// logger isn't attached — nothing removed", "sys");
  else unhang(chime, "lift");
}

function* offNew() {
  press("off-new");
  log("door.off('knock', () => console.log('[logger] knock'))", "sys");
  log("// nothing removed: a new arrow function is a different reference", "sys");
  for (const chime of S.listeners.knock) chime.shake = 1;
}

function* toggleError() {
  press("on-error");
  if (S.listeners.error.length) { log("door.off('error', handler)", "sys"); unhang(S.listeners.error[0], "lift"); }
  else { log("door.on('error', handler)", "sys"); hang("error", "handler", "error"); }
}

// ── the lesson ──────────────────────────────────────────────────────────────
const CHAPTERS = [
  {
    title: "Listeners are chimes",
    *run() {
      log("// 01-events/basics.ts", "sys");
      log("const door = new EventEmitter()", "sys");
      cap("Node can't sit and wait for a packet. You hang up a function, and Node calls it when something happens.");
      yield* sleep(4.2);
      yield* on("on", "greet");
      cap("on('knock', greet) hangs a chime on the 'knock' side of the beam. Each chime is one listener.");
      yield* sleep(4.4);
      yield* on("once");
      cap("once('knock', first) hangs a second chime, on a breakaway clip. Chimes hang in the order you add them.");
      yield* sleep(4.6);
    },
  },
  {
    title: "emit() is synchronous",
    *run() {
      cap("emit('knock') presses the key. The carriage rings every chime in turn, left to right.");
      yield* sleep(1.4);
      yield* emitKnock();
      cap("The key stays down until the carriage is home, so 'after emit' prints only once every listener has run.");
      yield* sleep(4.8);
      cap("Events don't make code async. Whatever fires them (a socket, a timer) is what happens later.");
      yield* sleep(4.4);
    },
  },
  {
    title: "once() lets go",
    *run() {
      cap("Did you see the clipped chime fall? once() unhooks itself just before it runs, so it rings exactly once.");
      yield* sleep(4.6);
      cap("Knock again, as Bob: only greet is left to ring.");
      yield* sleep(1.2);
      yield* emitKnock();
      yield* sleep(2.4);
    },
  },
  {
    title: "off() needs the same function",
    *run() {
      yield* on("on", "logger");
      cap("on('knock', logger) hangs a new chime at the end of the line.");
      yield* sleep(2.4);
      yield* emitKnock();
      yield* sleep(0.8);
      yield* off();
      cap("off('knock', logger) lifts that exact chime off its hook. It finds it by function reference.");
      yield* sleep(3.6);
      yield* emitKnock();
      yield* sleep(1);
      yield* on("on", "logger");
      cap("Hang logger again, then try to remove it with a freshly written arrow function...");
      yield* sleep(2.6);
      yield* offNew();
      cap("...nothing comes off. A new arrow function is a different object, even if its code is identical.");
      yield* sleep(4.6);
    },
  },
  {
    title: "'error' is special",
    *run() {
      log("// 01-events/error-event.ts", "sys");
      cap("Past the divider is the 'error' hook. on('error', handler) hangs a chime there.");
      yield* toggleError();
      yield* sleep(3.4);
      cap("With a handler attached, an error is just another event: it rings, and the process carries on.");
      yield* emitError();
      yield* sleep(3.2);
      cap("Now take the handler off and emit 'error' again...");
      yield* toggleError();
      yield* sleep(2.6);
      yield* emitError();
      cap("Nobody on the 'error' hook: the breaker trips and Node throws. Always attach .on('error') to your sockets.");
      yield* sleep(6.4);
    },
  },
];


// ── physics: one fixed step ─────────────────────────────────────────────────
function step(dt) {
  const { car, keys, breaker } = S;
  // carriage: a belt drive with a top speed, easing in and out of each stop
  const gap = car.target - car.x;
  const want = Math.sign(gap) * Math.min(Math.abs(gap) / 0.16, 300);
  car.v = still.matches ? 0 : car.v + (want - car.v) * (1 - Math.exp(-dt / 0.08));
  car.x = still.matches ? car.target : car.x + car.v * dt;
  if (Math.abs(car.target - car.x) < 0.25 && Math.abs(car.v) < 4) { car.x = car.target; car.v = 0; }

  // the hammer: out, contact, back
  if (S.strikeAt >= 0) {
    S.strikeAt += dt / (still.matches ? 0.05 : 0.26);
    if (S.onContact && S.strikeAt >= 0.5) { S.onContact(); S.onContact = null; }
    if (S.strikeAt >= 1) S.strikeAt = -1;
  }
  car.dy = S.strikeAt >= 0 ? -3 * Math.sin(Math.PI * Math.min(1, S.strikeAt)) : 0;

  for (const chime of [...S.listeners.knock, ...S.listeners.error, ...S.fading]) {
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
  }
  for (const chime of [...S.fading]) if (chime.mode !== "hold" && chime.alpha < 0.01) retire(chime);

  keys.knock = ease(keys.knock, keys.knockTo, dt, 0.06);
  keys.error = ease(keys.error, keys.errorTo, dt, 0.06);
  breaker.at = ease(breaker.at, breaker.to, dt, 0.05);
  breaker.lamp = ease(breaker.lamp, S.dead ? 0.15 : 1, dt, 0.25);
}


// ── drawing: the board only (the player draws the rest) ─────────────────────
function draw() {
  const { car, keys, breaker } = S;
  const shown = new Set();
  for (const chime of [...S.listeners.knock, ...S.listeners.error, ...S.fading]) {
    shown.add(chime.el);
    const wobble = still.matches ? 0 : Math.sin(S.clock * 55) * 1.1 * Math.max(chime.ring * 0.8, chime.shake);
    chime.el.setAttribute("transform", translateAlong(P, [chime.x + wobble, 0, chime.z]));
    const alpha = Math.max(0, Math.min(1, chime.alpha));
    if (alpha < 0.999) chime.el.setAttribute("opacity", alpha.toFixed(3));
    else chime.el.removeAttribute("opacity");
    const tube = chime.el.querySelector(".ch-tube > .iso-solid");
    if (chime.ring > 0.18) tube.setAttribute("data-lit", "");
    else tube.removeAttribute("data-lit");
  }
  for (const el of allChimeEls) el.style.display = shown.has(el) ? "" : "none";

  carriageEl.setAttribute("transform", translateAlong(P, [car.x, 0, 0]));
  strikerEl.setAttribute("transform", translateAlong(P, [0, car.dy, 0]));
  keyKnockEl.setAttribute("transform", translateAlong(P, [0, 0, -2.4 * keys.knock]));
  keyErrorEl.setAttribute("transform", translateAlong(P, [0, 0, -2.4 * keys.error]));
  leverEl.setAttribute("transform", translateAlong(P, [0, 0, -7 * breaker.at]));
  lampEl.setAttribute("opacity", breaker.lamp.toFixed(3));
  stage.toggleAttribute("data-dead", S.dead);
}

function settled() {
  if (S.runner || S.strikeAt >= 0 || S.fading.length || S.car.x !== S.car.target) return false;
  for (const c of [...S.listeners.knock, ...S.listeners.error]) {
    if (Math.abs(c.x - c.tx) > 0.01 || Math.abs(c.z - c.tz) > 0.01 || Math.abs(c.alpha - c.talpha) > 0.002 || c.ring > 0.01 || c.shake > 0.01) return false;
  }
  const { keys, breaker } = S;
  return Math.abs(keys.knock - keys.knockTo) < 0.002 && Math.abs(keys.error - keys.errorTo) < 0.002 && Math.abs(breaker.at - breaker.to) < 0.002;
}

mountPlayer({
  chapters: CHAPTERS,
  fresh, step, draw, settled,
  hint: "Node.js · lesson 1 · 01-events",
  dead: () => S.dead,
  readout() {
    if (S.dead) return "process exited · code 1";
    return `listenerCount('knock') = ${S.listeners.knock.length}` + (S.busy ? " · emit() running" : "");
  },
  labels(stage) {
    const errorButton = stage.querySelector('[data-do="on-error"]');
    const label = S.listeners.error.length ? "off('error', handler)" : "on('error', handler)";
    if (errorButton.textContent !== label) errorButton.textContent = label;
    stage.querySelector("[data-who]").textContent = WHO[S.who % WHO.length];
    stage.querySelector("[data-next]").textContent = NAMES.find((n) => !S.listeners.knock.some((c) => c.fn === n)) || "fn";
  },
  actions: { emit: emitKnock, on: () => on("on"), once: () => on("once"), off, "off-new": offNew, error: emitError, "on-error": toggleError },
  // a call the lesson was halfway through is finished off at once
  onSandbox() {
    S.strikeAt = -1; S.onContact = null; S.busy = false;
    S.keys.knockTo = S.keys.errorTo = 0;
    if (!S.dead) S.car.target = HOME;
    for (const chime of S.fading) if (chime.mode === "hold") { chime.mode = "drop"; restack(); }
  },
});
