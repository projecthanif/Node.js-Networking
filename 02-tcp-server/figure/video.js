// ── Lesson 2 as a video: the port bay played from a script ─────────────────
// Runs on shared/player.js, which owns time, seeking, captions and the console.
const P = __P__;
const G = __GEO__;

const stage = document.querySelector(".ee-stage");
const svg = stage.querySelector("svg");
const $ = (sel) => svg.querySelector(sel);
const procLampEl = $('[data-part="proc-lamp"]');
const plugEl = $('[data-part="plug"]');
const plug2El = $('[data-part="plug2"]');
const band2El = plug2El.querySelector(".pl-band");
const cordEl = $('[data-part="cord"]');
const cordPath = cordEl.querySelector("path");
const cordEnd = cordEl.querySelector("circle");
const guardEls = [...svg.querySelectorAll("[data-guard]")];
const beadsEl = $('[data-part="beads"]');

const NS = "http://www.w3.org/2000/svg";
const beadPool = Array.from({ length: 48 }, () => {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "ev-bead");
  g.innerHTML = '<rect x="-3.1" y="-3.6" width="6.2" height="7.2" rx="1"/><text></text>';
  g.style.display = "none";
  beadsEl.append(g);
  return { g, text: g.querySelector("text"), ch: "" };
});

// each row: its cable (client → module), the module, and one client box per port it can show
const rowEls = G.COLS.map((x, r) => {
  const root = $(`[data-row="${r}"]`);
  const cable = root.querySelector("[data-cable]");
  const route = [[x, G.CLIENT_PORT_Y, G.CABLE_Z], [x, G.CLIENT_PORT_Y - 7, 1.4], [x, G.MOD_PORT_Y + 7, 1.4], [x, G.MOD_PORT_Y, G.CABLE_Z]];
  const seg = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1], p[2] - route[i][2]));
  const length = seg.reduce((a, b) => a + b, 0);
  const pts = route.map((p) => iso(p, P));
  cable.querySelector("path").setAttribute("d", "M" + pts.map(([px, py]) => `${px.toFixed(2)} ${py.toFixed(2)}`).join("L"));
  const [endClient, endMod] = cable.querySelectorAll("circle");
  endClient.setAttribute("cx", pts[0][0].toFixed(2)); endClient.setAttribute("cy", pts[0][1].toFixed(2));
  endMod.setAttribute("cx", pts[3][0].toFixed(2)); endMod.setAttribute("cy", pts[3][1].toFixed(2));
  const clients = {};
  for (const el of root.querySelectorAll("[data-client]")) clients[el.dataset.client] = el;
  // the world point at distance fraction s along the cable (0 = client, 1 = module)
  const along = (s) => {
    let d = Math.max(0, Math.min(1, s)) * length;
    for (let i = 0; i < seg.length; i += 1) {
      if (d <= seg[i] || i === seg.length - 1) {
        const t = seg[i] ? Math.min(1, d / seg[i]) : 0;
        return route[i].map((v, j) => v + (route[i + 1][j] - v) * t);
      }
      d -= seg[i];
    }
  };
  return {
    mod: root.querySelector("[data-mod]"), lamp: root.querySelector("[data-mod] .lamp"),
    cable, path: cable.querySelector("path"), endClient, endMod, clients, length, along,
    portsHere: G.CLIENT_PORTS.filter((_, i) => i % G.COLS.length === r),
  };
});

const GAP = 7.2; // world units between byte tiles
const SPEED = 46; // world units per second along a cable

// ── board state ─────────────────────────────────────────────────────────────
function fresh() {
  return {
    proc: 0, procTo: 0, listening: false,
    plug: { z: 30, tz: 30, alpha: 0, talpha: 0 },
    plug2: { z: 40, tz: 40, alpha: 0, talpha: 0, err: 0 },
    guard: 0, guardTo: 0,
    conns: [], beads: [], messages: [],
    portAt: G.COLS.map(() => 0), connected: 0,
  };
}

const who = (c) => `127.0.0.1:${c.port}`;
const openConns = () => S.conns.filter((c) => c.state === "open");
const hex = (text) => [...text].map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");

function newConn(r) {
  const row = rowEls[r];
  const port = row.portsHere[S.portAt[r]++ % row.portsHere.length];
  const c = {
    r, port, n: S.conns.length + 1, state: "dialing",
    client: { z: 10, tz: 0, alpha: 0, talpha: 1 }, key: 0,
    cable: 0, cableTo: 0,
    mod: { z: 16, tz: 16, alpha: 0, talpha: 0 },
    lamp: 0, lampTo: 0, err: 0, flash: 0,
  };
  S.conns.push(c);
  return c;
}
const freeRow = () => G.COLS.findIndex((_, r) => !S.conns.some((c) => c.r === r));

// bytes: tiles spawned queued up behind the cable's start, so a whole write leaves in order
function sendBytes(c, text, dir) {
  const row = rowEls[c.r];
  const gapS = GAP / row.length;
  const ahead = S.beads.filter((b) => b.c === c && b.dir === dir);
  const last = ahead.length ? ahead[ahead.length - 1].s : dir === "in" ? 0 : 1;
  [...text].forEach((ch, i) => {
    const s = dir === "in" ? Math.min(0, last - gapS) - i * gapS : Math.max(1, last + gapS) + i * gapS;
    S.beads.push({ c, ch, dir, s });
  });
  if (dir === "out") S.messages.push({ c, text, left: text.length });
}
const inbound = (c) => S.beads.filter((b) => b.c === c && b.dir === "in");
// how many bytes have reached the socket and wait in its receive buffer
function arrived(c) {
  const gapS = GAP / rowEls[c.r].length;
  let n = 0;
  for (const b of inbound(c)) { if (b.s >= 1 - n * gapS - 0.003) n += 1; else break; }
  return n;
}
function take(c, n) {
  const list = inbound(c).slice(0, n);
  S.beads = S.beads.filter((b) => !list.includes(b));
  return list.map((b) => b.ch).join("");
}

// ── the calls ───────────────────────────────────────────────────────────────
function* startProcess() {
  log("$ npx tsx 02-tcp-server/echo-server.ts", "sys");
  S.procTo = 1;
  S.plug.talpha = 1;
  yield* sleep(0.6);
}

function* listen() {
  press("listen");
  if (S.listening) {
    log("server.close()", "sys");
    S.listening = false;
    S.plug.tz = 30;
    yield* sleep(0.5);
    log("closed: no new connections (open sockets stay open)");
    return;
  }
  if (!S.procTo) yield* startProcess();
  log("server.listen(3000)", "sys");
  S.plug.tz = 0;
  yield* until(() => S.plug.z < 0.3);
  S.listening = true;
  log("listening on port 3000");
}

function* listenAgain() {
  if (!S.listening) { yield* listen(); return; }
  press("listen2");
  const p = S.plug2;
  log("second.listen(3000)", "sys");
  Object.assign(p, { z: 40, tz: 22, alpha: 0, talpha: 1, err: 0 });
  yield* until(() => p.z < 22.5);
  p.err = 1;
  p.tz = 31;
  log("second server failed: EADDRINUSE", "err");
  yield* sleep(1.1);
  p.talpha = 0;
  yield* sleep(0.5);
}

function* connect() {
  press("connect");
  // a socket still fading out frees its slot in a moment
  if (freeRow() < 0 && S.conns.some((c) => c.state === "closed")) yield* until(() => freeRow() >= 0);
  const r = freeRow();
  if (r < 0) { log("// the rack here has 3 slots (Node has no such limit)", "sys"); return null; }
  log("$ nc localhost 3000", "sys");
  const c = newConn(r);
  yield* sleep(0.45);
  if (!S.listening) {
    c.cableTo = 0.35;
    yield* sleep(0.5);
    log("nc: connect to localhost port 3000: Connection refused", "err");
    c.cableTo = 0;
    c.client.talpha = 0;
    c.state = "closed";
    return null;
  }
  c.cableTo = 1;
  yield* until(() => c.cable > 0.985);
  c.mod.talpha = 1;
  c.mod.tz = 0;
  yield* until(() => c.mod.z < 0.4);
  c.state = "open";
  c.lampTo = 1;
  S.connected += 1;
  log(`[+] ${who(c)} connected`);
  log(`Clients online: ${S.connected}`);
  sendBytes(c, "hi!", "out");
  return c;
}

function* type(c, text) {
  log(`client ${c.n} writes ${JSON.stringify(text)}`, "sys");
  sendBytes(c, text, "in");
  c.key = 1;
  yield* sleep(0.2);
}

// 'data' fires with whatever has arrived: n bytes, not one message
function* data(c, n) {
  const chunk = take(c, n);
  c.flash = 1;
  log(`[${who(c)}] bytes: <Buffer ${hex(chunk)}>`);
  log(`[${who(c)}] text:  ${JSON.stringify(chunk)}`);
  sendBytes(c, `echo: ${chunk}`, "out");
  yield* sleep(0.1);
}

function* write(c) {
  press("write");
  if (!c) { log("// no client connected — try nc localhost 3000", "sys"); return; }
  yield* type(c, "hi");
  yield* until(() => arrived(c) === inbound(c).length);
  yield* data(c, inbound(c).length);
}

function close(c, hadError) {
  log(`[-] ${who(c)} closed (error: ${hadError})`);
  c.state = "closed";
  c.lampTo = 0;
  c.mod.tz = 16;
  c.mod.talpha = 0;
  c.cableTo = 0;
  c.client.talpha = 0;
  c.client.tz = 8;
  S.beads = S.beads.filter((b) => b.c !== c);
}

function* hangup(c) {
  press("hangup");
  if (!c) { log("// no client connected", "sys"); return; }
  log(`client ${c.n} (:${c.port}): ^C`, "sys");
  c.state = "ending";
  c.lampTo = 0.45;
  yield* sleep(0.35);
  log(`[${who(c)}] ended`);
  yield* sleep(0.7);
  close(c, false);
}

function* breakConn(c) {
  press("reset-conn");
  if (!c) { log("// no client connected", "sys"); return; }
  c.state = "ending";
  c.err = 1;
  log(`[${who(c)}] error: read ECONNRESET`);
  yield* sleep(0.8);
  close(c, true);
}

// ── the lesson ──────────────────────────────────────────────────────────────
const CHAPTERS = [
  {
    title: "A server waits",
    *run() {
      cap("A server is just a program that waits for other programs to connect to it. No special hardware: your laptop can be one.");
      yield* sleep(2.4);
      yield* startProcess();
      cap("This box is that program: node running echo-server.ts. It has a cord, but it isn't plugged into anything yet.");
      yield* sleep(4.2);
      yield* listen();
      cap("server.listen(3000) plugs it into port 3000 of this machine. Then it does nothing at all: it waits.");
      yield* sleep(4.6);
    },
  },
  {
    title: "Ports pick the program",
    *run() {
      cap("The address 127.0.0.1 (localhost) gets data to this machine. The port number picks which program on it gets the data.");
      yield* sleep(5);
      S.guardTo = 1;
      cap("Ports run from 0 to 65535. Those below 1024 (22 SSH, 80 HTTP, 443 HTTPS) are reserved and need admin rights.");
      yield* sleep(4.6);
      S.guardTo = 0;
      cap("And only one program can hold a port. A second server tries listen(3000)...");
      yield* sleep(1.6);
      yield* listenAgain();
      cap("...and gets EADDRINUSE: the jack is already taken. That's port-in-use.ts.");
      yield* sleep(3.4);
    },
  },
  {
    title: "One socket per client",
    *run() {
      cap("A client runs nc localhost 3000. The connection comes in on port 3000...");
      const a = yield* connect();
      S.a = a;
      cap("...and Node hands the server a brand-new socket: one end of this one connection. createServer's callback runs once per client.");
      yield* sleep(5);
      log("// in a second terminal", "sys");
      const b = yield* connect();
      S.b = b;
      cap("A second client gets a second socket. The OS gave each client its own random port, so their bytes never get mixed up.");
      yield* sleep(5.4);
    },
  },
  {
    title: "Bytes, not messages",
    *run() {
      const a = S.a;
      cap("Client 1 sends 'hello', then 'world'. TCP is one ordered stream of bytes, like a phone call, not a pile of letters.");
      yield* type(a, "hello");
      yield* sleep(0.5);
      yield* type(a, "world");
      yield* until(() => arrived(a) >= 3);
      yield* data(a, 3);
      cap("So 'data' fires with whatever has arrived. Here it's 'hel': raw bytes in a Buffer, which .toString() turns into text.");
      yield* until(() => arrived(a) >= 7 && S.beads.every((b) => b.dir !== "in" || b.c !== a || b.s >= 0));
      yield* sleep(1.2);
      yield* data(a, 7);
      cap("...then 'loworld'. Where one message ends is your job, for example one message per line. HTTP does that on top of TCP.");
      yield* sleep(6);
    },
  },
  {
    title: "Ending and errors",
    *run() {
      cap("Client 2 presses Ctrl+C. 'end' says it has finished sending, and 'close' always fires last.");
      yield* sleep(0.8);
      yield* hangup(S.b);
      yield* sleep(2.6);
      cap("Client 1's connection breaks. The socket has an 'error' listener, so only that socket closes.");
      yield* sleep(0.8);
      yield* breakConn(S.a);
      yield* sleep(2.8);
      cap("Without that listener, one bad client would crash the whole server (lesson 1). Here it's still plugged in, waiting for the next one.");
      yield* sleep(5.6);
    },
  },
];

// ── physics: one fixed step ─────────────────────────────────────────────────
function step(dt) {
  S.proc = ease(S.proc, S.procTo, dt, 0.2);
  S.guard = ease(S.guard, S.guardTo, dt, 0.15);
  for (const p of [S.plug, S.plug2]) {
    p.z = ease(p.z, p.tz, dt, p === S.plug2 && !p.err ? 0.16 : 0.2);
    p.alpha = ease(p.alpha, p.talpha, dt, 0.18);
  }
  S.plug2.err *= Math.exp(-dt / 1.2);

  for (const c of S.conns) {
    c.client.z = ease(c.client.z, c.client.tz, dt, 0.2);
    c.client.alpha = ease(c.client.alpha, c.client.talpha, dt, 0.2);
    c.mod.z = ease(c.mod.z, c.mod.tz, dt, 0.16);
    c.mod.alpha = ease(c.mod.alpha, c.mod.talpha, dt, 0.16);
    const reach = (SPEED * 2.2 * dt) / rowEls[c.r].length;
    c.cable = still.matches ? c.cableTo : c.cable + Math.max(-reach, Math.min(reach, c.cableTo - c.cable));
    c.lamp = ease(c.lamp, c.lampTo, dt, 0.12);
    c.err *= c.state === "closed" ? Math.exp(-dt / 0.3) : 1;
    c.flash *= Math.exp(-dt / 0.25);
    c.key *= Math.exp(-dt / 0.15);
  }
  // retire a connection once everything of it has faded
  S.conns = S.conns.filter((c) => c.state !== "closed" || c.client.alpha > 0.01 || c.mod.alpha > 0.01 || c.cable > 0.001);

  // bytes: each tile rides its cable; inbound ones queue at the socket's receive buffer
  const moved = new Map();
  for (const b of S.beads) {
    const row = rowEls[b.c.r];
    const ds = (SPEED * dt) / row.length;
    const gapS = GAP / row.length;
    const key = b.c.port + b.dir;
    const prev = moved.get(key);
    if (b.dir === "in") {
      const stop = prev === undefined ? 1 : prev - gapS;
      b.s = still.matches ? stop : Math.min(stop, b.s + ds);
    } else {
      const floor = prev === undefined ? -1 : prev + gapS;
      b.s = still.matches ? -1 : Math.max(floor, b.s - ds);
    }
    moved.set(key, b.s);
  }
  // outbound tiles are absorbed by the client at s = 0
  for (const b of S.beads.filter((b) => b.dir === "out" && b.s <= 0)) {
    S.beads.splice(S.beads.indexOf(b), 1);
    const m = S.messages.find((m) => m.c === b.c);
    if (m && --m.left === 0) {
      S.messages.splice(S.messages.indexOf(m), 1);
      log(m.text === "hi!" ? `client ${m.c.n} got: "hi! type something and I'll echo it back\\n"` : `client ${m.c.n} got: ${JSON.stringify(m.text)}`, "in");
    }
  }
}

// ── drawing: the board only (the player draws the rest) ─────────────────────
const show = (el, on) => { const v = on ? "" : "none"; if (el.style.display !== v) el.style.display = v; };
const fade = (el, a) => { if (a < 0.999) el.setAttribute("opacity", Math.max(0, a).toFixed(3)); else el.removeAttribute("opacity"); };
const lit = (el, on) => el.toggleAttribute("data-lit", on);

function cordPoints(top) {
  const [x0, y0, z0] = [G.JACK_X, G.SERVER_Y, top];
  const [x2, y2, z2] = G.PROC_PORT;
  const [x1, y1, z1] = [x0 + 10, y0 - 70, Math.max(z0, 30) + 18];
  const out = [];
  for (let i = 0; i <= 18; i += 1) {
    const t = i / 18, u = 1 - t;
    out.push(iso([u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2, u * u * z0 + 2 * u * t * z1 + t * t * z2], P));
  }
  return out;
}

function draw() {
  fade(procLampEl, 0.25 + 0.75 * S.proc);
  lit(procLampEl.querySelector(".iso-solid"), S.proc > 0.5);

  const p = S.plug;
  show(plugEl, p.alpha > 0.005);
  plugEl.setAttribute("transform", translateAlong(P, [0, 0, p.z]));
  fade(plugEl, p.alpha);
  show(cordEl, p.alpha > 0.005);
  fade(cordEl, p.alpha);
  const pts = cordPoints(G.SEAT + 22 + p.z);
  cordPath.setAttribute("d", "M" + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L"));
  const end = pts[pts.length - 1];
  cordEnd.setAttribute("cx", end[0].toFixed(2));
  cordEnd.setAttribute("cy", end[1].toFixed(2));

  const q = S.plug2;
  show(plug2El, q.alpha > 0.005);
  plug2El.setAttribute("transform", translateAlong(P, [0, 0, q.z]));
  fade(plug2El, q.alpha);
  band2El.toggleAttribute("data-err", q.err > 0.25);

  for (const g of guardEls) lit(g, S.guard > 0.5);

  rowEls.forEach((row, r) => {
    const c = S.conns.find((c) => c.r === r);
    show(row.mod, c && c.mod.alpha > 0.005);
    show(row.cable, c && c.cable > 0.002);
    for (const [port, el] of Object.entries(row.clients)) show(el, c && +port === c.port && c.client.alpha > 0.005);
    if (!c) return;
    row.mod.setAttribute("transform", translateAlong(P, [0, 0, c.mod.z]));
    fade(row.mod, c.mod.alpha);
    const lampSolid = row.lamp.querySelector(".iso-solid");
    lit(lampSolid, c.lamp > 0.6 || c.flash > 0.3);
    fade(row.lamp, 0.35 + 0.65 * Math.max(c.lamp, c.flash));
    row.lamp.toggleAttribute("data-err", c.err > 0.25);
    const el = row.clients[c.port];
    el.setAttribute("transform", translateAlong(P, [0, 0, c.client.z]));
    fade(el, c.client.alpha);
    el.querySelector("[data-key]").setAttribute("transform", translateAlong(P, [0, 0, -1.2 * c.key]));
    row.path.style.strokeDashoffset = String(1 - c.cable);
    show(row.endClient, c.cable > 0.002);
    show(row.endMod, c.cable > 0.985);
  });

  let used = 0;
  for (const b of S.beads) {
    if (b.s < 0 || b.s > 1 || used >= beadPool.length) continue;
    const bead = beadPool[used++];
    const w = rowEls[b.c.r].along(b.s);
    const [x, y] = iso([w[0] + (b.dir === "in" ? -2.6 : 2.6), w[1], w[2] + 3.4], P);
    bead.g.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    if (bead.ch !== b.ch) { bead.ch = b.ch; bead.text.textContent = b.ch === " " ? "␠" : b.ch; }
    bead.g.toggleAttribute("data-out", b.dir === "out");
    show(bead.g, true);
  }
  for (let i = used; i < beadPool.length; i += 1) show(beadPool[i].g, false);
}

function settled() {
  if (S.beads.length) return false;
  const near = (a, b) => Math.abs(a - b) < 0.01;
  for (const p of [S.plug, S.plug2]) if (!near(p.z, p.tz) || !near(p.alpha, p.talpha)) return false;
  for (const c of S.conns) {
    if (!near(c.cable, c.cableTo) || !near(c.mod.z, c.mod.tz) || !near(c.mod.alpha, c.mod.talpha) || !near(c.client.alpha, c.client.talpha) || !near(c.lamp, c.lampTo) || c.flash > 0.01 || c.key > 0.01) return false;
    if (c.state === "closed") return false;
  }
  return near(S.proc, S.procTo) && near(S.guard, S.guardTo) && S.plug2.err < 0.01;
}

const newest = () => openConns()[openConns().length - 1];

mountPlayer({
  chapters: CHAPTERS,
  fresh, step, draw, settled,
  hint: "Node.js · lesson 2 · 02-tcp-server",
  readout() {
    if (!S.procTo) return "no server running";
    const n = openConns().length;
    return (S.listening ? "listening :3000" : "not listening") + ` · ${n} socket${n === 1 ? "" : "s"}`;
  },
  labels(stage) {
    const button = stage.querySelector('[data-do="listen"]');
    const label = S.listening ? "server.close()" : "server.listen(3000)";
    if (button.textContent !== label) button.textContent = label;
  },
  actions: {
    listen,
    listen2: listenAgain,
    connect,
    write: () => write(openConns()[0]),
    hangup: () => hangup(newest()),
    "reset-conn": () => breakConn(newest()),
  },
  // a call the lesson was halfway through is finished off at once
  onSandbox() {
    S.plug.tz = S.listening ? 0 : S.plug.tz;
    S.plug2.talpha = 0;
    S.guardTo = 0;
    S.beads = S.beads.filter((b) => b.dir === "out");
    for (const c of S.conns) {
      if (c.state === "dialing" || c.state === "ending") close(c, c.state === "ending" && c.err > 0);
    }
  },
});
