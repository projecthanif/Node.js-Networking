// ── Lesson 3 as a video: the dialer played from a script ───────────────────
// Runs on shared/player.js, which owns time, seeking, captions and the console.
const P = __P__;
const G = __GEO__;

const stage = document.querySelector(".ee-stage");
const svg = stage.querySelector("svg");
const $ = (sel) => svg.querySelector(sel);
const plugEl = $('[data-part="plug"]');
const bandEl = plugEl.querySelector(".pl-band");
const cordEl = $('[data-part="cord"]');
const cordPath = cordEl.querySelector("path");
const cordEnd = cordEl.querySelector("circle");
const needleEl = $('[data-part="dial-needle"]');
const needlePath = needleEl.querySelector("path");
const needleHub = needleEl.querySelector("circle");
const attemptEls = [0, 1, 2].map((i) => $(`[data-part="attempt-${i}"]`));
const statusEl = $('[data-part="status"]');
const timeoutEl = $('[data-part="timeout"]');
const serverEls = [$('[data-part="server-1"]')];
const listenEls = [$('[data-part="listen-1"]')];
const beadsEl = $('[data-part="beads"]');

const NS = "http://www.w3.org/2000/svg";
const beadPool = Array.from({ length: 40 }, () => {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "ev-bead");
  g.innerHTML = '<rect x="-3.1" y="-3.6" width="6.2" height="7.2" rx="1"/><text></text>';
  g.style.display = "none";
  beadsEl.append(g);
  return { g, text: g.querySelector("text"), ch: "" };
});

const GAP = 7.4; // world units between byte tiles
const SPEED = 70; // world units per second along the cord
const DIAL_SPAN = 10; // seconds for the dial's 300° sweep
const LOCAL_PORTS = [52144, 52160, 52177, 52183, 52196, 52208, 52215, 52231];

// ── geometry of the flight ──────────────────────────────────────────────────
// targets: 0 = jack 3001, 1 = jack 3009, "void" = the jack on 10.255.255.1
const HOME = [G.HOLSTER[0], G.HOLSTER[1], G.SEAT];
const targetOf = (t) => (t === "void" ? [G.REMOTE_JACK[0], G.REMOTE_JACK[1], 3] : [G.JACK_X, G.PORTS[t], G.SEAT]);
const smooth = (u) => u * u * (3 - 2 * u);
function plugAt(p) {
  const e = smooth(Math.max(0, Math.min(1, p.u)));
  const to = p.tgt === null ? HOME : targetOf(p.tgt);
  const span = Math.hypot(to[0] - HOME[0], to[1] - HOME[1]);
  return [
    HOME[0] + (to[0] - HOME[0]) * e,
    HOME[1] + (to[1] - HOME[1]) * e,
    HOME[2] + (to[2] - HOME[2]) * e + Math.sin(Math.PI * e) * (14 + span * 0.14) + (p.tgt === "void" ? 9 * e : 0),
  ];
}
// the cord: a sagging curve from the client's gland to the top of its plug
function cordOf(top) {
  const a = G.CPORT;
  const dist = Math.hypot(top[0] - a[0], top[1] - a[1]);
  const mid = [(a[0] + top[0]) / 2, (a[1] + top[1]) / 2, Math.max(a[2], top[2]) + 6 + dist * 0.12];
  const pts = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24, u = 1 - t;
    pts.push([0, 1, 2].map((j) => u * u * a[j] + 2 * u * t * mid[j] + t * t * top[j]));
  }
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]));
  const length = seg.reduce((x, y) => x + y, 0);
  const along = (s) => {
    let d = Math.max(0, Math.min(1, s)) * length;
    for (let i = 0; i < seg.length; i += 1) {
      if (d <= seg[i] || i === seg.length - 1) { const t = seg[i] ? Math.min(1, d / seg[i]) : 0; return pts[i].map((v, j) => v + (pts[i + 1][j] - v) * t); }
      d -= seg[i];
    }
  };
  return { pts, length, along };
}
const plugTop = () => { const p = plugAt(S.plug); return [p[0], p[1], p[2] + 22]; };

// ── board state ─────────────────────────────────────────────────────────────
function fresh() {
  return {
    plug: { u: 0, uTo: 0, tgt: null, err: 0 },
    sock: null, // { state, tgt, port, started }
    server9: 0, server9To: 0, listening9: false,
    dial: { t: 0, run: false, rate: 1 },
    attempts: 0, status: 0, flash: 0,
    beads: [], nextPort: 0,
  };
}

const sockOpen = () => S.sock && S.sock.state !== "closed";
const portName = (t) => (t === "void" ? "10.255.255.1:80" : `localhost:${t === 0 ? 3001 : 3009}`);
const listeningAt = (t) => t === 0 || (t === 1 && S.listening9);
const elapsed = () => `[${(S.dial.t).toFixed(1)}s]`;

function dialStart(rate = 1) { S.dial.t = 0; S.dial.run = true; S.dial.rate = rate; }
function dialStop() { S.dial.run = false; }

// fly the plug out; resolves "connect", "refused" or (for the void) never settles by itself
function* fly(tgt) {
  const p = S.plug;
  Object.assign(p, { tgt, u: 0, uTo: 1, err: 0 });
  yield* until(() => p.u >= 0.999);
  if (tgt === "void") return "silence";
  if (listeningAt(tgt)) return "connect";
  p.err = 1; // the machine answered: nothing is listening here
  p.uTo = 0;
  return "refused";
}
function* home() { S.plug.uTo = 0; yield* until(() => S.plug.u <= 0.001); S.plug.tgt = null; }

// bytes along the cord: "out" from client to server, "in" back
function sendBytes(text, dir) {
  const len = cordOf(plugTop()).length;
  const gapS = GAP / len;
  const same = S.beads.filter((b) => b.dir === dir);
  const last = same.length ? same[same.length - 1].s : dir === "out" ? 0 : 1;
  [...text].forEach((ch, i) => {
    const s = dir === "out" ? Math.min(0, last - gapS) - i * gapS : Math.max(1, last + gapS) + i * gapS;
    S.beads.push({ ch, dir, s });
  });
}
const inFlight = (dir) => S.beads.some((b) => b.dir === dir);

// ── the calls ───────────────────────────────────────────────────────────────
function* connect(tgt, opts = {}) {
  const port = LOCAL_PORTS[S.nextPort++ % LOCAL_PORTS.length];
  S.sock = { state: "connecting", tgt, port };
  if (!opts.quiet) log(tgt === "void" ? `net.connect(80, "10.255.255.1")` : `net.connect(${tgt === 0 ? 3001 : 3009}, "localhost")`, "sys");
  const result = yield* fly(tgt);
  if (result === "connect") {
    S.sock.state = "connected";
    S.status = 1;
    return "connect";
  }
  if (result === "refused") {
    yield* sleep(0.25);
    return "refused";
  }
  return "silence";
}

function closed(hadError) {
  if (S.sock) S.sock.state = "closed";
  S.status = 0;
  S.beads = [];
  dialStop();
  return hadError;
}

// one command and its reply, the way client.ts and the lesson 2 command server talk
const REPLIES = { time: ["09:43:02", "09:43:02 GMT+0100 (West Africa Standard Time)"], "upper hello": ["HELLO", "HELLO"], count: ["clients online: 1", "clients online: 1"], quit: ["bye", "bye"] };
function* command(cmd) {
  log(`> ${cmd}`);
  sendBytes(cmd + "⏎", "out");
  yield* until(() => !inFlight("out"));
  const [tiles, full] = REPLIES[cmd] || ["unknown", "unknown command"];
  sendBytes(tiles + "⏎", "in");
  yield* until(() => !inFlight("in"));
  log(`< ${full}`, "in");
}

function* serverEnds() {
  log("server ended the connection");
  S.sock.state = "ending";
  yield* sleep(0.4);
  yield* home();
  closed(false);
  log("closed (error: false)");
}

function* destroy(reason) {
  log(`socket.destroy(${reason ? `new Error("${reason}")` : ""})`, "sys");
  // the socket is gone at once; the plug flying home is only the picture catching up
  const when = elapsed();
  if (reason) log(`${when} error: ${reason}`, "err");
  closed(!!reason);
  log(reason ? `${when} closed` : "closed (error: false)");
  yield* home();
}

// ── sandbox calls ───────────────────────────────────────────────────────────
function* tryConnect(tgt) {
  press(tgt === "void" ? "cvoid" : tgt === 0 ? "c3001" : "c3009");
  if (sockOpen()) { log("// this client holds one socket: destroy() it first", "sys"); return; }
  if (tgt === "void") { yield* timeoutRun(true); return; }
  const r = yield* connect(tgt);
  if (r === "connect") log(`connected: me ${S.sock.port} -> server ${tgt === 0 ? 3001 : 3009}`);
  else { log("error: ECONNREFUSED", "err"); yield* home(); closed(true); log("closed (error: true)"); }
}
function* sandboxCommand(cmd) {
  press(cmd === "quit" ? "quit" : "time");
  if (!S.sock || S.sock.state !== "connected") { log("// not connected", "sys"); return; }
  if (S.sock.tgt === 1) { log(`> ${cmd}`); log("// that server never replies: it's an empty createServer()", "sys"); return; }
  yield* command(cmd);
  if (cmd === "quit") yield* serverEnds();
}
function* sandboxDestroy() {
  press("destroy");
  if (!sockOpen()) { log("// no socket to destroy", "sys"); return; }
  yield* destroy();
}
function* toggleServer() {
  press("srv");
  if (S.listening9) {
    log("// server on 3009 stopped (Ctrl+C)", "sys");
    S.listening9 = false;
    S.server9To = 0;
    return;
  }
  log(`$ node -e "require('node:net').createServer().listen(3009)"`, "sys");
  S.server9To = 1;
  yield* sleep(0.4);
  S.listening9 = true;
}

// timeout.ts: an address that never answers, setTimeout(2000), and destroy() in the handler
function* timeoutRun(withDestroy) {
  // the plug flies out and hangs; the timer fires at 2 s whatever the plug is doing
  const p = S.plug;
  const port = LOCAL_PORTS[S.nextPort++ % LOCAL_PORTS.length];
  S.sock = { state: "connecting", tgt: "void", port };
  log(`net.connect(80, "10.255.255.1")`, "sys");
  log("socket.setTimeout(2000)", "sys");
  dialStart();
  Object.assign(p, { tgt: "void", u: 0, uTo: 1, err: 0 });
  yield* until(() => S.dial.t >= 2 - 1e-9);
  S.flash = 1;
  log(`${elapsed()} 'timeout' fired — the socket is still open!`);
  if (withDestroy) yield* destroy("gave up after 2s");
}

// ── the lesson ──────────────────────────────────────────────────────────────
const CHAPTERS = [
  {
    title: "connect() returns at once",
    *run() {
      log("$ npx tsx 03-tcp-client/client.ts", "sys");
      cap("A client is the side that starts the conversation. Your lesson 2 command server is listening on 3001: its lamp is lit.");
      yield* sleep(4.6);
      cap("net.connect(3001) hands back a socket immediately, before it's connected. The OS does the handshake in the background...");
      log(`net.connect(3001, "localhost")`, "sys");
      log("// returned at once: not connected yet", "sys");
      yield* connect(0, { quiet: true });
      log(`connected: me ${S.sock.port} -> server 3001`);
      cap("...then 'connect' fires. Your port is random, picked by the OS. The server's is the one you asked for.");
      yield* sleep(4.8);
    },
  },
  {
    title: "Talking to the server",
    *run() {
      cap("Now both ends hold a net.Socket with the same API. client.ts writes a command per line...");
      yield* command("time");
      yield* sleep(0.5);
      yield* command("upper hello");
      cap("...and the server answers each one. TCP is symmetric: either side can send at any time.");
      yield* sleep(0.4);
      yield* command("count");
      yield* sleep(0.6);
      cap("'quit' makes the server call socket.end(\"bye\\n\"). The client sees the data, then 'end', then 'close'.");
      yield* command("quit");
      yield* sleep(0.3);
      yield* serverEnds();
      cap("'end' means the other side has finished sending. 'close' means the connection is completely gone. It always comes last.");
      yield* sleep(5.2);
    },
  },
  {
    title: "ECONNREFUSED",
    *run() {
      log("$ npx tsx 03-tcp-client/client.ts 3009", "sys");
      cap("Now try port 3009. Its lamp is dark: nothing is listening there.");
      yield* sleep(2.4);
      yield* connect(1);
      log("error: ECONNREFUSED", "err");
      cap("The machine answers straight away: nobody's home on that port. That's ECONNREFUSED, and the plug comes straight back.");
      yield* home();
      closed(true);
      log("closed (error: true)");
      yield* sleep(4.4);
    },
  },
  {
    title: "Retry with backoff",
    *run() {
      log("$ npx tsx 03-tcp-client/retry.ts", "sys");
      cap("retry.ts tries 3009 up to three times, waiting longer each time. The dial shows each wait, at 5× speed.");
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        S.attempts = attempt;
        log(`attempt ${attempt}...`);
        const r = yield* connect(1, { quiet: true });
        if (r === "connect") {
          log("connected!");
          cap("Attempt 3 lands on a listening port: connected. retry.ts then calls socket.end() and lets go.");
          yield* sleep(1.6);
          yield* home();
          closed(false);
          break;
        }
        log("  failed: ECONNREFUSED", "err");
        yield* home();
        closed(true);
        const delay = attempt * 5000;
        log(`  retrying in ${delay}ms`);
        dialStart(5);
        if (attempt === 2) {
          cap("While it waits, someone starts a server on 3009 in another terminal...");
          yield* until(() => S.dial.t >= 4);
          log(`$ node -e "require('node:net').createServer().listen(3009)"`, "sys");
          S.server9To = 1;
          yield* sleep(0.4);
          S.listening9 = true;
        }
        yield* until(() => S.dial.t >= delay / 1000 - 1e-6);
        dialStop();
      }
      S.attempts = 0;
      yield* sleep(3.4);
    },
  },
  {
    title: "Timeouts do nothing",
    *run() {
      log("$ npx tsx 03-tcp-client/timeout.ts", "sys");
      cap("timeout.ts dials 10.255.255.1, an address where nothing answers. No refusal, just silence: the plug hangs in the air.");
      yield* timeoutRun(false);
      log("// destroy() commented out: still waiting", "sys");
      cap("At 2 s 'timeout' fires. It only tells you the socket has been idle. Nothing has closed: the plug is still out, still waiting.");
      yield* until(() => S.dial.t >= 6.4);
      cap("You have to act on it yourself. That's why timeout.ts calls socket.destroy() inside the handler.");
      yield* sleep(0.6);
      yield* destroy("gave up after 2s");
      cap("An event is a notification, not an action: the same lesson as your Timer's stop() back in lesson 1.");
      yield* sleep(5);
    },
  },
];

// ── physics: one fixed step ─────────────────────────────────────────────────
function step(dt) {
  const p = S.plug;
  const rate = dt / (p.tgt === "void" ? 1.1 : 0.85);
  p.u = still.matches ? p.uTo : p.u + Math.max(-rate, Math.min(rate, p.uTo - p.u));
  p.err *= Math.exp(-dt / 0.9);
  if (S.dial.run) S.dial.t += dt * S.dial.rate;
  else S.dial.t = ease(S.dial.t, 0, dt, 0.25);
  S.server9 = ease(S.server9, S.server9To, dt, 0.2);
  S.flash *= Math.exp(-dt / 0.5);

  if (S.beads.length) {
    const len = cordOf(plugTop()).length;
    const ds = (SPEED * dt) / len;
    for (const b of S.beads) b.s = still.matches ? (b.dir === "out" ? 2 : -1) : b.s + (b.dir === "out" ? ds : -ds);
    S.beads = S.beads.filter((b) => (b.dir === "out" ? b.s < 1 : b.s > 0));
  }
}

// ── drawing: the board only (the player draws the rest) ─────────────────────
const show = (el, on) => { const v = on ? "" : "none"; if (el.style.display !== v) el.style.display = v; };
const fade = (el, a) => { if (a < 0.999) el.setAttribute("opacity", Math.max(0, a).toFixed(3)); else el.removeAttribute("opacity"); };
const d2 = (pts) => "M" + pts.map((q) => { const [x, y] = iso(q, P); return `${x.toFixed(2)} ${y.toFixed(2)}`; }).join("L");

function draw() {
  const at = plugAt(S.plug);
  plugEl.setAttribute("transform", translateAlong(P, at));
  bandEl.toggleAttribute("data-err", S.plug.err > 0.25);
  const cord = cordOf([at[0], at[1], at[2] + 22]);
  cordPath.setAttribute("d", d2(cord.pts));
  const [ex, ey] = iso(cord.pts[0], P);
  cordEnd.setAttribute("cx", ex.toFixed(2));
  cordEnd.setAttribute("cy", ey.toFixed(2));

  // the dial needle: 0 at the top, DIAL_SPAN seconds over 300°
  const [dx, dy] = G.DIAL;
  const z = G.CBOX_H + 1.7;
  const a = -Math.PI / 2 + (Math.min(S.dial.t, DIAL_SPAN) / DIAL_SPAN) * ((Math.PI * 2 * 300) / 360);
  needlePath.setAttribute("d", d2([[dx - Math.cos(a) * 2.4, dy - Math.sin(a) * 2.4, z], [dx + Math.cos(a) * (G.DIAL_R - 1.6), dy + Math.sin(a) * (G.DIAL_R - 1.6), z]]));
  const [hx, hy] = iso([dx, dy, z], P);
  needleHub.setAttribute("cx", hx.toFixed(2));
  needleHub.setAttribute("cy", hy.toFixed(2));

  attemptEls.forEach((el, i) => show(el, S.attempts > i));
  show(statusEl, S.status > 0.5);
  show(timeoutEl, S.flash > 0.04);
  fade(timeoutEl, S.flash);
  show(serverEls[0], S.server9 > 0.01);
  fade(serverEls[0], S.server9);
  show(listenEls[0], S.listening9);

  let used = 0;
  for (const b of S.beads) {
    if (b.s < 0 || b.s > 1 || used >= beadPool.length) continue;
    const bead = beadPool[used++];
    const w = cord.along(b.s);
    const [x, y] = iso([w[0], w[1] + (b.dir === "out" ? -2.6 : 2.6), w[2] + 3.2], P);
    bead.g.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    if (bead.ch !== b.ch) { bead.ch = b.ch; bead.text.textContent = b.ch === " " ? "␠" : b.ch; }
    bead.g.toggleAttribute("data-in", b.dir === "in");
    show(bead.g, true);
  }
  for (let i = used; i < beadPool.length; i += 1) show(beadPool[i].g, false);
}

function settled() {
  const p = S.plug;
  return !S.beads.length && Math.abs(p.u - p.uTo) < 0.001 && p.err < 0.01 && !S.dial.run && S.dial.t < 0.01 && Math.abs(S.server9 - S.server9To) < 0.01 && S.flash < 0.01;
}

mountPlayer({
  chapters: CHAPTERS,
  fresh, step, draw, settled,
  hint: "Node.js · lesson 3 · 03-tcp-client",
  readout() {
    const s = S.sock;
    if (!s || s.state === "closed") return "no socket";
    const where = s.tgt === "void" ? "10.255.255.1:80" : `:${s.tgt === 0 ? 3001 : 3009}`;
    if (s.state === "connecting") return `connecting → ${where}` + (S.dial.run ? ` · ${S.dial.t.toFixed(1)} s` : "");
    if (s.state === "ending") return "server ended · closing";
    return `connected · me :${s.port} → ${where}`;
  },
  labels(stage) {
    const button = stage.querySelector('[data-do="srv"]');
    const label = S.listening9 ? "stop server on 3009" : "start server on 3009";
    if (button.textContent !== label) button.textContent = label;
  },
  actions: {
    c3001: () => tryConnect(0),
    c3009: () => tryConnect(1),
    cvoid: () => tryConnect("void"),
    time: () => sandboxCommand("time"),
    quit: () => sandboxCommand("quit"),
    destroy: sandboxDestroy,
    srv: toggleServer,
  },
  // a call the lesson was halfway through is finished off at once
  onSandbox() {
    S.beads = [];
    S.attempts = 0;
    dialStop();
    if (S.sock && S.sock.state !== "connected") { S.plug.uTo = 0; S.plug.tgt = S.plug.u > 0 ? S.plug.tgt : null; closed(false); }
    S.server9To = S.listening9 ? 1 : 0;
  },
});
