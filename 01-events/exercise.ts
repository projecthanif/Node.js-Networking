import { EventEmitter } from "node:events";

type TimerEvents = {
  tick: [remaining: number];
  done: [];
  stopped: [];
};

class Timer extends EventEmitter<TimerEvents> {
  private interval?: NodeJS.Timeout;

  start(seconds: number) {
    let remaining = seconds;
    this.interval = setInterval(() => {
      remaining--;
      this.emit("tick", remaining);

      if (remaining === 0) {
        clearInterval(this.interval);
        this.emit("done");
      }
    }, 1000);
  }

  stop() {
    clearInterval(this.interval);
    this.emit("stopped");
  }
}

const timer = new Timer();

timer.on("tick", (n) => {
  console.log(`${n}s left`);
  if (n === 5) timer.stop();
});
timer.once("done", () => console.log("done"));
timer.on("stopped", () => console.log("stopped"));

timer.start(10);
