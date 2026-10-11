import net from "node:net";
import readline from "node:readline";

const args = Number(process.argv[2] ?? 3001);
const PORT: number = args;
const RETRY_COUNT = 3;
const IdleTimer = 10000;

let interval: NodeJS.Timeout;
let socket: net.Socket | undefined;

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  console.log(`Line: ${line}`);
  if (socket?.writable) {
    socket.write(`${line}\n`);
    resetIntervalTimer();
  }
});

function resetIntervalTimer() {
  clearTimeout(interval);
  interval = setTimeout(() => console.log("server idle"), IdleTimer);
}

function connect(attempts: number) {
  let connected: boolean = false;

  socket = net.connect(PORT, "localhost");

  socket.setEncoding("utf8");

  socket.on("connect", () => {
    connected = true;
    resetIntervalTimer();
  });

  socket.on("data", (data) => {
    process.stdout.write(`< ${data}`);
    resetIntervalTimer();
  });

  socket.on("error", (error: NodeJS.ErrnoException) => {
    if (attempts < RETRY_COUNT) {
      const delay = attempts * 500;
      console.log(`retrying... attempts: ${attempts}`);
      setTimeout(() => {
        connect(attempts + 1);
      }, delay);
    } else {
      console.log("server unavailable");
      process.exitCode = 1;
      rl.close();
    }
  });

  socket.on("close", () => {
    clearTimeout(interval);

    if (connected) {
      console.log("disconnected");
      rl.close();
    }
  });
}

connect(1);
