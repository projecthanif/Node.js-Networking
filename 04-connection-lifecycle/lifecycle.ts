// A server and a client in ONE process, so you can see both sides' events in order.
// Usage: npx tsx lifecycle.ts [end|destroy|reset]
import net from "node:net";

const PORT = 3040;
const scenario = process.argv[2] ?? "end";

const t0 = Date.now();
const log = (who: string, msg: string) =>
  console.log(`${String(Date.now() - t0).padStart(4)}ms  ${who.padEnd(6)} ${msg}`);

function watch(socket: net.Socket, who: string) {
  socket.on("data", (d) => log(who, `data ${JSON.stringify(String(d))}`));
  socket.on("end", () => log(who, "end      (other side is done sending)"));
  socket.on("finish", () => log(who, "finish   (my own end() has been flushed)"));
  socket.on("error", (e: NodeJS.ErrnoException) => log(who, `error    ${e.code ?? e.message}`));
  socket.on("close", (hadError) => log(who, `close    (hadError: ${hadError})`));
}

const server = net.createServer((socket) => {
  log("server", "connection");
  watch(socket, "server");
  socket.on("close", () => server.close()); // one connection is enough for the demo
});

server.listen(PORT, () => {
  console.log(`scenario: ${scenario}\n`);
  const client = net.connect(PORT, "localhost");
  watch(client, "client");

  client.on("connect", () => {
    log("client", "connect");
    client.write("hello");

    setTimeout(() => {
      if (scenario === "end") {
        log("client", ">>> end('bye')");
        client.end("bye");
      } else if (scenario === "destroy") {
        log("client", ">>> destroy()");
        client.write("this may never arrive");
        client.destroy();
      } else if (scenario === "reset") {
        log("client", ">>> resetAndDestroy()");
        client.resetAndDestroy();
      }
    }, 100);
  });
});
