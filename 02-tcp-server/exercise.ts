import net from "node:net";

const PORT: number = 3001;

let clientCount: number = 0;

const server = net.createServer((socket) => {
  clientCount++;
  const client = `${socket.remoteAddress}:${socket.remotePort}`;
  socket.write(`welcome! ${clientCount} client(s) connected\n`);
  console.log(`Client ${client} connected`);

  socket.on("data", (chunk: Buffer) => {
    const [cmd, ...rest] = chunk.toString().trim().split(" ");
    const message = [...rest].join(" ");
    switch (cmd) {
      case "time": {
        const time = new Date().toTimeString();
        socket.write(`${time}\n`);
        console.log(`${time}\n`);
        break;
      }
      case "upper": {
        const text = message.toUpperCase();
        console.log(`${text}\n`);
        socket.write(`${text}\n`);
        break;
      }
      case "count": {
        console.log(`clients online: ${clientCount}\n`);
        socket.write(`clients online: ${clientCount}\n`);
        break;
      }
      case "quit": {
        console.log(`bye`);
        socket.end(`bye\n`);
        break;
      }
      default: {
        socket.write("unknown command\n");
        console.log("unknown command");
      }
    }
  });

  socket.on("close", () => clientCount--);
  socket.on("error", (error) => console.log(`Error ${error.message}`));
});

server.listen(PORT);

server.on("listening", () => {
  console.log(`Server listening to port: ${PORT}`);
});

server.on("error", (error: Error) => {
  console.log(`Error message ${error.message}`);
});
