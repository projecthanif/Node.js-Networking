// Render a lesson video page to an MP4, one exact frame at a time.
// node shared/render-video.mjs <page.html> [--fps 30]  → <page>.mp4 next to the page.
// Needs Google Chrome and ffmpeg. The page is opened with ?render (a 16:9 layout), and each
// frame is __lesson.seek(t): the board is stepped to that exact lesson time, never filmed live.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (typeof WebSocket === "undefined" && !process.execArgv.includes("--experimental-websocket")) {
  const child = spawn(process.execPath, ["--experimental-websocket", ...process.argv.slice(1)], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await main();
}

async function main() {
  const page = resolve(process.argv[2] || "");
  if (!process.argv[2] || !page.endsWith(".html")) throw new Error("usage: node shared/render-video.mjs <page.html> [--fps 30]");
  const fpsAt = process.argv.indexOf("--fps");
  const FPS = fpsAt > 0 ? Number(process.argv[fpsAt + 1]) : 30;
  const TAIL = 2; // seconds held on the last frame
  const out = page.replace(/\.html$/, ".mp4");
  if (!existsSync(page)) throw new Error(`${page} is missing: run the lesson's build.mjs first`);

  const chromeBin = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const profile = mkdtempSync(join(tmpdir(), "lesson-render-"));
  const chrome = spawn(chromeBin, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--allow-file-access-from-files", "about:blank"]);
  const port = await new Promise((done, fail) => {
    let text = "";
    chrome.stderr.on("data", (chunk) => {
      text += chunk;
      const match = text.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
      if (match) done(Number(match[1]));
    });
    chrome.on("exit", (code) => fail(new Error(`Chrome exited: ${code}`)));
  });

  const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done) => socket.addEventListener("open", done, { once: true }));
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { done, fail } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) fail(new Error(data.error.message));
      else done(data.result);
    }
  });
  const send = (method, params = {}) => new Promise((done, fail) => {
    const call = ++id;
    pending.set(call, { done, fail });
    socket.send(JSON.stringify({ id: call, method, params }));
  });
  const evaluate = async (expression) => {
    const reply = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text);
    return reply.result.value;
  };

  try {
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
    await send("Page.navigate", { url: pathToFileURL(page).href + "?render" });
    for (let i = 0; i < 100 && !(await evaluate("!!window.__lesson").catch(() => false)); i += 1) await new Promise((r) => setTimeout(r, 50));
    await evaluate("document.fonts.ready.then(() => { __lesson.pause(); return 1; })");
    const total = await evaluate("__lesson.total");
    const frames = Math.ceil((total + TAIL) * FPS);

    const ffmpeg = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-tune", "animation", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
    const encoded = new Promise((done, fail) => ffmpeg.on("exit", (code) => (code === 0 ? done() : fail(new Error(`ffmpeg exited ${code}`)))));

    const started = Date.now();
    for (let f = 0; f < frames; f += 1) {
      await evaluate(`__lesson.seek(${(f / FPS).toFixed(6)})`);
      const shot = await send("Page.captureScreenshot", { format: "png" });
      if (!ffmpeg.stdin.write(Buffer.from(shot.data, "base64"))) await new Promise((r) => ffmpeg.stdin.once("drain", r));
      if (f % FPS === 0) process.stdout.write(`\r  frame ${f}/${frames} · ${((Date.now() - started) / 1000).toFixed(0)} s`);
    }
    ffmpeg.stdin.end();
    await encoded;
    console.log(`\nwrote ${out} · ${frames} frames · ${(frames / FPS).toFixed(1)} s at ${FPS} fps, 1920×1080`);
  } finally {
    socket.close();
    chrome.kill("SIGKILL");
    rmSync(profile, { recursive: true, force: true });
  }
}
