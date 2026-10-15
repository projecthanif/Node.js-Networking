// ── Lesson player: turns an iso figure into a scrubbable video ─────────────
// Inlined into each lesson page before the lesson's own script. A lesson is a
// deterministic simulation stepped at a fixed 1/60 s, with the lesson itself a
// generator script run inside it, so any moment can be rebuilt exactly: seeking
// resets the board and replays the script up to that time without drawing.
//
// The lesson calls mountPlayer({ fresh, step, draw, settled, readout, chapters,
// actions, onSandbox, labels, dead, hint }) and uses the helpers below.
const DT = 1 / 60;
const still = matchMedia("(prefers-reduced-motion: reduce)");
const ease = (from, to, dt, tau) => (still.matches ? to : from + (to - from) * (1 - Math.exp(-dt / tau)));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

let S; // the whole state of the board at S.clock: rebuilt by every seek

// coroutine helpers: a script yields a test, and resumes once it passes
function* sleep(s) { const end = S.clock + s; yield () => S.clock >= end - 1e-9; }
function* until(test) { yield test; }
function log(text, kind = "out") { S.lines.push([text, kind]); if (S.lines.length > 40) S.lines.shift(); }
function cap(text) { S.caption = text; S.captionAt = S.clock; }
function press(name) { S.active = name; S.activeUntil = S.clock + 0.9; }

function mountPlayer(lesson) {
  const stage = document.querySelector(".ee-stage");
  const readoutEl = document.querySelector("[data-readout]");
  const consoleEl = stage.querySelector(".ee-console");
  const captionEl = stage.querySelector(".ev-caption span");
  const playEl = stage.querySelector(".ev-play");
  const speedEl = stage.querySelector(".ev-speed");
  const trackEl = stage.querySelector(".ev-track");
  const timeEl = stage.querySelector(".ev-time");
  const nowEl = stage.querySelector(".ev-now");
  const sandboxEl = stage.querySelector(".ev-sandbox");
  const buttons = [...stage.querySelectorAll("button[data-do]")];
  const CHAPTERS = lesson.chapters;

  let mode = "video"; // "video": the lesson owns the board · "sandbox": paused, and the reader is pressing calls
  let playing = false, ended = false, videoT = 0, pausedAt = 0, total = 0, speed = 1;
  let scrubbing = false, wasPlaying = false;
  const SPEEDS = [1, 1.5, 2, 0.75];
  const marks = [];

  function fresh() {
    S = Object.assign({ clock: 0, lines: [], caption: "", captionAt: 0, active: null, activeUntil: 0, runner: null, wait: null }, lesson.fresh());
  }
  function pump() {
    while (S.runner && (!S.wait || S.wait())) {
      const r = S.runner.next();
      if (r.done) { S.runner = null; S.wait = null; }
      else S.wait = r.value;
    }
  }
  function step(dt) {
    S.clock += dt;
    lesson.step(dt);
    if (S.active && S.clock >= S.activeUntil) S.active = null;
    pump();
  }
  function* script() {
    for (let i = 0; i < CHAPTERS.length; i += 1) { marks[i] = S.clock; yield* CHAPTERS[i].run(); }
  }
  function startLesson() { fresh(); S.runner = script(); pump(); }

  // ── drawing ───────────────────────────────────────────────────────────────
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const chapterAt = (t) => { let i = 0; while (i + 1 < marks.length && t >= marks[i + 1] - 1e-6) i += 1; return i; };
  let drawnLines = null, drawnCaption = null, segs = [], chapterButtons = [];

  function draw() {
    lesson.draw();
    const linesKey = S.lines.length + "|" + (S.lines[S.lines.length - 1] || []).join();
    if (linesKey !== drawnLines) {
      drawnLines = linesKey;
      consoleEl.replaceChildren(...S.lines.map(([text, kind]) => {
        const line = document.createElement("span");
        line.className = "c-" + kind;
        line.textContent = text;
        return line;
      }));
    }
    const caption = mode === "sandbox" ? "Your turn: press any call below. Press play to go back to the lesson." : S.caption;
    if (caption !== drawnCaption) { drawnCaption = caption; captionEl.textContent = caption; }
    // captions fade in on lesson time, so a rendered frame matches the played one
    const fade = mode === "sandbox" || still.matches ? 1 : Math.min(1, (S.clock - S.captionAt) / 0.45);
    captionEl.style.opacity = fade.toFixed(3);
    captionEl.style.transform = fade < 1 ? `translateY(${(4 * (1 - fade) ** 2).toFixed(2)}px)` : "";

    const text = lesson.readout();
    if (readoutEl.textContent !== text) readoutEl.textContent = text;

    const free = !playing && !scrubbing && (mode === "video" || !S.runner);
    const dead = lesson.dead ? lesson.dead() : false;
    for (const button of buttons) {
      const act = button.dataset.do;
      button.disabled = act === "reset" ? mode !== "sandbox" : !free || dead;
      button.toggleAttribute("data-active", S.active === act);
    }
    if (lesson.labels) lesson.labels(stage);

    const t = mode === "video" ? videoT : pausedAt;
    for (const s of segs) s.fill.style.transform = `scaleX(${clamp01((t - s.from) / (s.to - s.from)).toFixed(4)})`;
    const time = `${fmt(t)} / ${fmt(total)}`;
    if (timeEl.textContent !== time) timeEl.textContent = time;
    const c = chapterAt(t);
    const now = `${String(c + 1).padStart(2, "0")} · ${CHAPTERS[c].title}`;
    if (nowEl.textContent !== now) nowEl.textContent = now;
    chapterButtons.forEach((b, i) => b.toggleAttribute("data-current", i === c));
    trackEl.setAttribute("aria-valuenow", String(Math.round(t)));
    trackEl.setAttribute("aria-valuetext", `${fmt(t)}, ${CHAPTERS[c].title}`);
    playEl.setAttribute("data-state", playing ? "playing" : ended && mode === "video" ? "ended" : "paused");
    playEl.setAttribute("aria-label", playing ? "Pause" : ended ? "Replay" : "Play");
  }

  // ── time ──────────────────────────────────────────────────────────────────
  // rebuild the board at lesson time t: replay from the start (or from here, if t is ahead)
  function seek(t) {
    t = Math.max(0, Math.min(total, t));
    if (mode !== "video" || t < S.clock - 1e-9) { mode = "video"; startLesson(); }
    while (S.clock < t - 1e-9) step(DT);
    videoT = S.clock;
    ended = videoT >= total - 1e-6;
    sandboxEl.hidden = true;
    draw();
  }

  function play(on) {
    if (on) {
      if (mode === "sandbox") seek(pausedAt);
      if (ended) seek(0);
      playing = true;
    } else {
      playing = false;
      pausedAt = videoT;
    }
    draw();
    run();
  }

  // measure the lesson once: where each chapter starts, and how long it runs
  startLesson();
  while (S.runner) step(DT);
  total = S.clock + 0.5;

  segs = CHAPTERS.map((chapter, i) => {
    const seg = document.createElement("span");
    seg.className = "ev-seg";
    const from = marks[i], to = i + 1 < marks.length ? marks[i + 1] : total;
    seg.style.flexGrow = String(to - from);
    seg.innerHTML = "<i></i>";
    trackEl.append(seg);
    return { seg, fill: seg.firstChild, from, to };
  });
  chapterButtons = [...stage.querySelectorAll(".ev-chapters button")];
  chapterButtons.forEach((button, i) => {
    button.querySelector(".ev-at").textContent = fmt(marks[i]);
    button.addEventListener("click", () => { seek(marks[i]); play(true); });
  });

  playEl.addEventListener("click", () => play(!playing));
  speedEl.addEventListener("click", () => {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    speedEl.textContent = speed + "×";
  });

  // scrubbing
  trackEl.setAttribute("aria-valuemax", String(Math.round(total)));
  const tAt = (event) => { const r = trackEl.getBoundingClientRect(); return ((event.clientX - r.left) / r.width) * total; };
  trackEl.addEventListener("pointerdown", (event) => {
    scrubbing = true;
    wasPlaying = playing;
    playing = false;
    trackEl.setPointerCapture(event.pointerId);
    seek(tAt(event));
  });
  trackEl.addEventListener("pointermove", (event) => { if (scrubbing) seek(tAt(event)); });
  const endScrub = () => { if (!scrubbing) return; scrubbing = false; pausedAt = videoT; if (wasPlaying && !ended) play(true); else draw(); };
  trackEl.addEventListener("pointerup", endScrub);
  trackEl.addEventListener("pointercancel", endScrub);

  stage.addEventListener("keydown", (event) => {
    if (event.target.closest(".ev-chapters, .ee-controls, a") && (event.key === " " || event.key === "Enter")) return;
    const base = mode === "video" ? videoT : pausedAt;
    const go = (t) => { const was = playing; seek(t); pausedAt = videoT; if (was && !ended) play(true); else draw(); };
    if (event.key === " " || event.key === "k") play(!playing);
    else if (event.key === "ArrowRight" || event.key === "l") go(base + 5);
    else if (event.key === "ArrowLeft" || event.key === "j") go(base - 5);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(total);
    else if (/^[1-9]$/.test(event.key) && marks[+event.key - 1] !== undefined) { seek(marks[+event.key - 1]); play(true); }
    else return;
    event.preventDefault();
  });

  // try it yourself: pausing hands the board to the reader. The lesson's script is
  // dropped there, and the lesson finishes off any call it was halfway through.
  function enterSandbox() {
    pausedAt = videoT;
    mode = "sandbox";
    sandboxEl.hidden = false;
    S.runner = null; S.wait = null;
    lesson.onSandbox();
  }
  for (const button of buttons) {
    button.addEventListener("click", () => {
      if (mode === "video" && playing) return;
      if (button.dataset.do === "reset") { seek(pausedAt); return; }
      if (mode === "video") enterSandbox();
      if (S.runner || (lesson.dead && lesson.dead())) return;
      S.runner = lesson.actions[button.dataset.do]();
      S.wait = null;
      pump();
      draw();
      run();
    });
  }

  // ── frame loop ────────────────────────────────────────────────────────────
  let frame = 0, last = 0, acc = 0, visible = false, resumeOnView = false;
  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 0.1) : DT;
    last = now;
    if (mode === "video" && playing) {
      acc += dt * speed;
      while (acc >= DT && S.clock < total) { step(DT); acc -= DT; }
      videoT = S.clock;
      if (videoT >= total - 1e-6) { ended = true; playing = false; pausedAt = videoT; }
    } else if (mode === "sandbox") {
      // a paused lesson is a frozen frame; the sandbox runs in real time
      acc += dt;
      while (acc >= DT) { step(DT); acc -= DT; }
    }
    draw();
    frame = visible && (playing || (mode === "sandbox" && (S.runner || !lesson.settled()))) ? requestAnimationFrame(tick) : 0;
  }
  function run() { if (!frame && visible) { last = 0; acc = 0; frame = requestAnimationFrame(tick); } }

  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (!visible && playing) { resumeOnView = true; play(false); }
    else if (visible && resumeOnView) { resumeOnView = false; play(true); }
    else if (visible) run();
  }, { threshold: 0.35 }).observe(stage);

  // ?render: a 16:9 frame for shared/render-video.mjs, stepped from outside
  const rendering = new URLSearchParams(location.search).has("render");
  if (rendering) {
    document.body.classList.add("ev-render");
    if (lesson.hint) document.querySelector('[data-corner="hint"]').textContent = lesson.hint;
  }

  window.__lesson = { seek, play: () => play(true), pause: () => play(false), marks, get total() { return total; }, get t() { return mode === "video" ? videoT : pausedAt; } };

  seek(0);
  if (!still.matches && !rendering) setTimeout(() => { if (visible && !playing && videoT === 0) play(true); }, 900);
}
