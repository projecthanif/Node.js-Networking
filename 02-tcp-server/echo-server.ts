import net from "node:net";

const PORT = 3000;

let clients: number = 0;

// The callback runs once for EACH new client, with a socket just for that client.
const server = net.createServer((socket) => {
  // Every connection has its own client address + random client port.
  clients++;
  const who = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[+] ${who} connected`);

  console.log(`Clients online: ${clients}`);

  socket.write("hi! type something and I'll echo it back\n");

  socket.on("data", (chunk: Buffer) => {
    // chunk is raw bytes. Look at both forms:
    console.log(`[${who}] bytes:`, chunk);
    console.log(`[${who}] text: `, JSON.stringify(chunk.toString()));
    socket.write(`echo: ${chunk}`);
  });

  // The client said "I'm done sending" (e.g. nc closed its side).
  socket.on("end", () => console.log(`[${who}] ended`));

  // Without this listener, one misbehaving client would crash the whole server
  // (remember lesson 01: an unhandled 'error' event throws).
  socket.on("error", (err) => console.log(`[${who}] error: ${err.message}`));

  // Always fires last, however the connection ended.
  socket.on("close", (hadError) =>
    console.log(`[-] ${who} closed (error: ${hadError})`),
  );
});

server.on("listening", () => console.log(`listening on port ${PORT}`));
server.on("error", (err) => console.error("server error:", err.message));

server.listen(PORT);
