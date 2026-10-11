# 03 — TCP Client: the other end of the socket

## Client vs server, in code
The only difference is **who starts the conversation**:

| Server                                   | Client                                  |
|------------------------------------------|-----------------------------------------|
| `net.createServer(fn)` + `server.listen(port)` | `net.connect(port, host)`         |
| waits for `'connection'`                 | waits for `'connect'`                   |
| gets one socket **per client**           | gets **one** socket                     |
| fixed, known port (3001)                 | random port picked by the OS            |

Once connected, both sides hold a `net.Socket` and use the **same** API:
`write()`, `end()`, `'data'`, `'end'`, `'error'`, `'close'`. TCP is symmetric —
either side can send at any time, either side can hang up.

## What `net.connect` does
```ts
const socket = net.connect(3001, "localhost");
```
1. Returns a socket **immediately**, not yet connected (like `setInterval` in lesson 01).
2. The OS does the TCP handshake in the background.
3. Then exactly one of these happens:
   - `'connect'` → you're connected
   - `'error'` with `ECONNREFUSED` → nobody is listening on that port
   - nothing for a long time → host unreachable / firewall dropping packets (see timeouts)

You *can* call `socket.write()` before `'connect'`; Node buffers it and sends it once
connected. Handy, but it hides connection failures, so for learning, wait for `'connect'`.

## Errors you'll actually see on the client
| Code           | Meaning                                                         |
|----------------|-----------------------------------------------------------------|
| `ECONNREFUSED` | the machine answered: "nothing is listening on that port"       |
| `ECONNRESET`   | the other side killed the connection abruptly                    |
| `ETIMEDOUT`    | no answer at all (OS gave up, can take a long time)             |
| `ENOTFOUND`    | DNS couldn't resolve the hostname                               |
| `EPIPE`        | you wrote to a connection that's already closed                 |

## Timeouts: the event that does nothing
```ts
socket.setTimeout(2000);
socket.on("timeout", () => socket.destroy(new Error("timed out")));
```
`'timeout'` only **tells** you the socket has been idle for 2 s. It does **not** close
anything — you must call `destroy()` yourself. (Same lesson as your Timer's `stop()`:
an event is a notification, not an action.)

## Who closes first: `end` vs `close`
- `'end'` on your socket = **the other side** said "I'm done sending".
- Your `socket.end()` = **you** say "I'm done sending".
- `'close'` = the connection is completely gone, both directions. Always last.

When your command server does `socket.end("bye\n")`, the client sees `data: "bye\n"`,
then `'end'`, then `'close'`.

## Run
`client.ts` talks to your lesson 02 command server — start it first:
```
npx tsx 02-tcp-server/exercise.ts            # terminal 1
npx tsx 03-tcp-client/client.ts              # terminal 2
npx tsx 03-tcp-client/retry.ts               # nothing on that port → ECONNREFUSED + retries
npx tsx 03-tcp-client/timeout.ts             # unreachable address → timeout
```

## Exercise
Write `03-tcp-client/exercise.ts`: your own replacement for `nc`.
- Connect to `localhost:3001` (port can be overridden: `npx tsx exercise.ts 3101`).
- Whatever you type + Enter is sent to the server; whatever the server sends is printed.
  Use `readline` for the keyboard:
  ```ts
  import readline from "node:readline";
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", (line) => { /* ... */ });
  ```
- If the server isn't running, retry up to 3 times (1 s apart), then print
  `server unavailable` and exit with code 1.
- When the server closes the connection (`quit`, or you Ctrl+C the server), print
  `disconnected` and exit cleanly. Hint: the program won't exit while `readline` is
  still listening to the keyboard. What do you need to close?
- Bonus: if the server sends nothing for 10 s, print `server idle` (don't disconnect).
