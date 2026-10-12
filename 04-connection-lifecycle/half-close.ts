// "Send me everything, then I'll answer." The client ends its side first,
// and the server replies AFTER it has received 'end'.
// Usage: npx tsx half-close.ts [--no-half-open]
import net from "node:net";

const PORT = 3041;
const allowHalfOpen = !process.argv.includes("--no-half-open");
console.log(`allowHalfOpen: ${allowHalfOpen}\n`);

const server = net.createServer({ allowHalfOpen }, (socket) => {
  let received = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => (received += chunk));

  socket.on("end", () => {
    console.log("server: client finished sending, working on a reply...");
    // Simulate real work (a database query, a file read...) before answering.
    setTimeout(() => {
      const words = received.trim().split(/\s+/).length;
      socket.end(`you sent ${received.length} chars, ${words} words\n`);
    }, 100);
  });

  socket.on("error", (e) => console.log(`server: error: ${e.message}`));
  socket.on("close", () => server.close());
});

server.listen(PORT, () => {
  const client = net.connect(PORT, "localhost");
  client.setEncoding("utf8");

  client.on("connect", () => {
    client.write("the quick brown fox ");
    client.write("jumps over the lazy dog");
    client.end(); // "I'm done sending" — but I still want the answer
  });

  client.on("data", (d: string) => console.log(`client: got reply: ${d.trim()}`));
  client.on("end", () => console.log("client: server finished too"));
  client.on("close", () => console.log("client: closed"));
});
