// Build-side half of the lesson player: markup, styles and the inlined script.
// Each lesson's build.mjs calls playerHtml() and playerCss(), and puts
// playerScript() before its own lesson script.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const playerScript = () => readFileSync(join(HERE, "player.js"), "utf8");

const ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><path class="i-play" d="M4.5 2.8v10.4L13 8z"/><path class="i-pause" d="M4 2.8h2.8v10.4H4zM9.2 2.8H12v10.4H9.2z"/><path class="i-replay" d="M8 2.6a5.4 5.4 0 1 1-5.2 6.9h1.7A3.8 3.8 0 1 0 8 4.2v2.1L4.9 3.4 8 .5z"/></svg>`;
const DOWN = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M7.2 1.5h1.6v7.7l2.7-2.7 1.1 1.1L8 12.2 3.4 7.6l1.1-1.1 2.7 2.7zM2.5 13h11v1.6h-11z"/></svg>`;

// chapters: titles in order · mp4: the rendered video's file name, next to the page
export function playerHtml({ chapters, mp4 }) {
  return `
<div class="ev-caption" aria-live="polite"><span></span></div>
<div class="ev-bar">
  <button class="ev-play" data-state="paused" aria-label="Play">${ICON}</button>
  <div class="ev-mid">
    <div class="ev-meta"><span class="ev-now"></span><span class="ev-sandbox" hidden>paused · sandbox</span><span class="ev-time">0:00</span></div>
    <div class="ev-track" role="slider" tabindex="0" aria-label="Lesson time" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"></div>
  </div>
  <button class="ev-speed" aria-label="Playback speed">1×</button>
  <a class="ev-dl" href="${mp4}" download="${mp4}" aria-label="Download the video (MP4)">${DOWN}<span>MP4</span></a>
</div>
<ol class="ev-chapters" style="--n:${chapters.length}">${chapters.map((t, i) => `<li><button><span class="ev-n">${String(i + 1).padStart(2, "0")}</span><span class="ev-at"></span><span class="ev-t">${t}</span></button></li>`).join("")}</ol>
<p class="ev-try">Pause anywhere, then try the calls yourself:</p>`;
}

export const PLAYER_CSS = `
<style>
.ee-stage{outline:none}
.ee-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.ee-stage[data-dead] .iso-svg{opacity:.55;transition:opacity .6s}
.ee-controls{display:grid;gap:6px;margin:8px 0 0}
.ee-row{display:flex;flex-wrap:wrap;gap:6px}
.ee-controls button{font:11.5px/1 var(--anatomy-mono);color:var(--anatomy-strong);background:transparent;border:0;box-shadow:0 0 0 1px var(--anatomy-lo);padding:8px 10px;border-radius:0;cursor:pointer;transition:box-shadow .2s,color .2s,opacity .2s}
.ee-controls button:hover:not(:disabled){box-shadow:0 0 0 1px var(--anatomy-hi)}
.ee-controls button:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.ee-controls button:disabled{opacity:.35;cursor:default}
.ee-controls button.ee-quiet{color:var(--anatomy-muted)}
.ee-controls button[data-active]{box-shadow:0 0 0 1px var(--anatomy-lit);color:var(--anatomy-lit);opacity:1}
.ee-console{margin:12px 0 0;padding:10px 12px;height:9.6em;overflow:hidden;font:11.5px/1.6 var(--anatomy-mono);color:var(--anatomy-text);box-shadow:0 0 0 1px var(--anatomy-faint);white-space:pre-wrap;display:flex;flex-direction:column;justify-content:flex-end}
.ee-console span{display:block}
.ee-console .c-sys{color:var(--anatomy-muted)}
.ee-console .c-out{color:var(--anatomy-strong)}
.ee-console .c-err{color:var(--anatomy-red)}
.ee-console .c-in{color:var(--anatomy-text)}
.ev-caption{min-height:3.4em;margin:10px 0 0;display:flex;align-items:center;justify-content:center;text-align:center;font:500 14px/1.5 system-ui,-apple-system,sans-serif;color:var(--anatomy-strong);padding:0 8px;text-wrap:balance}
.ev-caption span{display:block}
.ev-bar{display:flex;align-items:center;gap:12px;margin:10px 0 0}
.ev-bar button,.ev-dl{flex:none;font:11.5px/1 var(--anatomy-mono);color:var(--anatomy-strong);background:transparent;border:0;box-shadow:0 0 0 1px var(--anatomy-lo);cursor:pointer;border-radius:0;text-decoration:none}
.ev-bar button:hover,.ev-dl:hover{box-shadow:0 0 0 1px var(--anatomy-hi)}
.ev-bar :focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.ev-play{width:36px;height:36px;display:grid;place-items:center;padding:0}
.ev-play svg{width:14px;height:14px;fill:var(--anatomy-strong)}
.ev-play path{display:none}
.ev-play[data-state=paused] .i-play,.ev-play[data-state=playing] .i-pause,.ev-play[data-state=ended] .i-replay{display:block}
.ev-speed{width:44px;height:36px}
.ev-dl{height:36px;display:flex;align-items:center;gap:6px;padding:0 10px}
.ev-dl svg{width:13px;height:13px;fill:currentColor}
.ev-mid{flex:1;min-width:0}
.ev-meta{display:flex;gap:10px;font:11px/1 var(--anatomy-mono);color:var(--anatomy-muted);margin:0 0 8px}
.ev-now{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--anatomy-text)}
.ev-sandbox{color:var(--anatomy-strong)}
.ev-track{display:flex;gap:3px;height:14px;align-items:center;cursor:pointer;touch-action:none;outline:none}
.ev-track:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:3px}
.ev-seg{flex-basis:0;height:3px;background:var(--anatomy-faint);overflow:hidden;transition:height .15s}
.ev-track:hover .ev-seg{height:5px}
.ev-seg i{display:block;height:100%;background:var(--anatomy-hi);transform-origin:left;transform:scaleX(0)}
.ev-chapters{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:repeat(var(--n),1fr);gap:6px}
.ev-chapters button{width:100%;height:100%;display:grid;grid-template-columns:1fr auto;gap:2px 6px;align-items:baseline;text-align:left;font:11px/1.3 var(--anatomy-mono);color:var(--anatomy-text);background:transparent;border:0;box-shadow:0 0 0 1px var(--anatomy-faint);padding:8px 9px;cursor:pointer;border-radius:0}
.ev-chapters button:hover{box-shadow:0 0 0 1px var(--anatomy-lo)}
.ev-chapters button[data-current]{color:var(--anatomy-strong);box-shadow:0 0 0 1px var(--anatomy-hi)}
.ev-n,.ev-at{color:var(--anatomy-muted)}
.ev-t{grid-column:1/-1}
.ev-try{margin:16px 0 0;font:11px/1 var(--anatomy-mono);color:var(--anatomy-muted)}
/* ?render: one 16:9 frame (1280 x 720 css px) for the MP4 */
.ev-render .iso-page{width:1280px;margin:0}
.ev-render .iso-figure{margin:0}
.ev-render .iso-figure>:not(.iso-plate),.ev-render .ev-chapters,.ev-render .ev-try,.ev-render .ee-controls,.ev-render .ev-play,.ev-render .ev-speed,.ev-render .ev-dl{display:none}
.ev-render .iso-plate{height:720px;padding:46px 40px 50px;box-shadow:none}
.ev-render .ee-stage{display:grid;grid-template-columns:760px 1fr;grid-template-rows:1fr auto auto;column-gap:32px;height:100%}
.ev-render .iso-svg{grid-column:1;grid-row:1/3;align-self:center;width:760px}
.ev-render .ev-caption{grid-column:2;grid-row:1;align-self:end;justify-content:flex-start;text-align:left;font-size:22px;line-height:1.45;min-height:6em;margin:0 0 18px;padding:0}
.ev-render .ee-console{grid-column:2;grid-row:2;align-self:end;height:13.2em;margin:0;font-size:12.5px}
.ev-render .ev-bar{grid-column:1/-1;grid-row:3;margin:22px 0 0}
.ev-render .ev-meta{font-size:12.5px}
.ev-render .ev-sandbox{display:none}
@media (max-width:520px){
  .ev-caption{font-size:13px;min-height:4.6em}
  .ev-bar{gap:8px}
  .ev-dl span{display:none}
  .ev-chapters{gap:4px}
  .ev-chapters button{padding:7px 6px;grid-template-columns:1fr}
  .ev-t,.ev-at{display:none}
}
</style>`;
