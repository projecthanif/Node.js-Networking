// Two servers try to listen on the same port. Only one can win.
import net from "node:net";

const PORT = 3002;

const first = net.createServer();
first.listen(PORT, () => {
  console.log(`first server got port ${PORT}`);

  const second = net.createServer();
  second.on("error", (err: NodeJS.ErrnoException) => {
    console.log(`second server failed: ${err.code}`); // EADDRINUSE
    first.close(() => console.log("first server closed, port is free again"));
  });
  second.listen(PORT);
});
