import net from "node:net";

const PORT = Number(process.argv[2] ?? 3001);

// Returns immediately. The connection happens in the background.
const socket = net.connect(PORT, "localhost");

// Get strings instead of Buffers in 'data'.
socket.setEncoding("utf8");

socket.on("connect", () => {
  // Our port is random (chosen by the OS); the server's port is the one we asked for.
  console.log(`connected: me ${socket.localPort} -> server ${socket.remotePort}`);

  // Send a few commands, spaced out so each reply arrives separately.
  const commands = ["time", "upper hello from my own client", "count", "quit"];
  commands.forEach((cmd, i) => {
    setTimeout(() => {
      console.log(`> ${cmd}`);
      socket.write(`${cmd}\n`);
    }, (i + 1) * 300);
  });
});

socket.on("data", (text: string) => process.stdout.write(`< ${text}`));

// The SERVER said it's done sending (it called socket.end()).
socket.on("end", () => console.log("server ended the connection"));

socket.on("error", (err: NodeJS.ErrnoException) => console.log(`error: ${err.code}`));

socket.on("close", (hadError) => console.log(`closed (error: ${hadError})`));
