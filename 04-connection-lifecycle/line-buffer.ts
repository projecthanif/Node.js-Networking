// The client sends 3 commands, but cut at awkward places.
// A naive server splits each chunk on "\n"; a buffered one keeps the leftovers.
import net from "node:net";

const PORT = 3042;
const CHUNKS = ["ti", "me\ncou", "nt\nupper hel", "lo\n"];

// The fix: remember the unfinished part of the last chunk.
function createLineSplitter(onLine: (line: string) => void) {
  let buffer = "";
  return (chunk: string) => {
    buffer += chunk;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      onLine(buffer.slice(0, newline).replace(/\r$/, "")); // strip \r from Windows clients
      buffer = buffer.slice(newline + 1);
    }
  };
}

const server = net.createServer((socket) => {
  socket.setEncoding("utf8");
  const splitLine = createLineSplitter((line) => console.log(`  buffered: ${JSON.stringify(line)}`));

  socket.on("data", (chunk: string) => {
    console.log(`chunk ${JSON.stringify(chunk)}`);
    for (const piece of chunk.split("\n").filter(Boolean)) {
      console.log(`  naive:    ${JSON.stringify(piece)}`);
    }
    splitLine(chunk);
  });
  socket.on("close", () => server.close());
});

server.listen(PORT, async () => {
  const client = net.connect(PORT, "localhost");
  await new Promise((r) => client.once("connect", r));
  for (const chunk of CHUNKS) {
    client.write(chunk);
    await new Promise((r) => setTimeout(r, 50)); // pause so each write arrives as its own chunk
  }
  client.end();
});
