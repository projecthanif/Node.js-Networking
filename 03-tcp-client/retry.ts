// Connecting to a port where nothing is listening, with retries.
import net from "node:net";

const PORT = 3009; // nothing should be listening here
const MAX_ATTEMPTS = 3;

function connect(attempt: number) {
  console.log(`attempt ${attempt}...`);
  const socket = net.connect(PORT, "localhost");

  socket.once("connect", () => {
    console.log("connected!");
    socket.end();
  });

  socket.once("error", (err: NodeJS.ErrnoException) => {
    console.log(`  failed: ${err.code}`);
    if (attempt < MAX_ATTEMPTS) {
      const delay = attempt * 5000; // wait a bit longer each time ("backoff")
      console.log(`  retrying in ${delay}ms`);
      setTimeout(() => connect(attempt + 1), delay);
    } else {
      console.log("giving up");
      process.exitCode = 1;
    }
  });
}

connect(1);

// Try it: while the retries are running, start a server on 3009 in another terminal
// and watch a later attempt succeed:
//   node -e "require('node:net').createServer().listen(3009)"
