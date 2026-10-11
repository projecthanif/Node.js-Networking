// 10.255.255.1 is a private address that (almost certainly) doesn't exist on your network.
// Packets go out, nothing ever answers — no ECONNREFUSED, just silence.
import net from "node:net";

const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;

const socket = net.connect(80, "10.255.255.1");
socket.setTimeout(2000);

socket.on("timeout", () => {
  console.log(`[${elapsed()}] 'timeout' fired — the socket is still open!`);
  // Without this line the program would keep waiting (comment it out and see).
  socket.destroy(new Error("gave up after 2s"));
});

socket.on("connect", () => console.log("connected?! (that address exists on your network)"));
socket.on("error", (err) => console.log(`[${elapsed()}] error: ${err.message}`));
socket.on("close", () => console.log(`[${elapsed()}] closed`));
