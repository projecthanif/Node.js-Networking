# 02 — TCP Server: servers, ports, sockets

## What a server is
A server is just **a program that waits for other programs to connect to it**.
Nothing magic: no special hardware, and your laptop can be one. "Server" is a role,
not a machine. The program that starts the conversation is the **client**; the one
that was waiting is the **server**.

## Ports
An IP address gets data to the right **machine**. A port gets it to the right
**program** on that machine.

```
192.168.1.20 : 3000
└─ machine ─┘  └─ which program on it
```

- A port is a number from 0 to 65535.
- Only **one** program can listen on a given port at a time. Try a second one and
  you get `EADDRINUSE` (see `port-in-use.ts`).
- Ports below 1024 are reserved (80 = HTTP, 443 = HTTPS, 22 = SSH) and need admin
  rights. For learning, use something like 3000.
- `localhost` / `127.0.0.1` means "this same machine". Traffic never leaves your laptop.
  You may see it logged as `::1`, which is the IPv6 spelling of the same thing.

## TCP
TCP is the protocol that gives you a **reliable, ordered, two-way stream of bytes**
between two programs. It handles lost packets, retries and ordering for you.
What TCP does **not** give you: messages. It's a byte pipe, like a phone call, not
a series of letters. If the client sends `hello` then `world`, you might receive
`helloworld` in one chunk, or `hel` + `loworld`. Deciding where one message ends
(e.g. "one message per line") is **your** job. That's what HTTP does on top of TCP
(lesson 06).

## Sockets
A socket is **one end of one connection**. Each client that connects gives the
server a brand-new socket object for talking to that client only.

```
              server (listening on :3000)
             /            |            \
     socket A         socket B        socket C     ← one per client
        |                |               |
     client 1        client 2        client 3
```

A connection is identified by 4 values: client IP, client port, server IP, server
port. The client's port is random (chosen by the OS), which is why two clients on
the same machine never get mixed up.

## In Node
```ts
const server = net.createServer((socket) => { ... }); // runs once per new connection
server.listen(3000);
```
- `net.Server` is an EventEmitter: `'listening'`, `'connection'`, `'error'`, `'close'`.
- `net.Socket` is an EventEmitter (and a stream, lesson 05): `'data'`, `'end'`,
  `'error'`, `'close'`.
- `socket.write(data)` sends bytes. `socket.end()` says "I'm done sending".
- `'data'` gives you a **Buffer** (raw bytes), not a string. Call `.toString()` or
  `socket.setEncoding('utf8')`.

## Run
Terminal 1:
```
npx tsx 02-tcp-server/echo-server.ts
```
Terminal 2 (and 3, 4… for more clients):
```
nc localhost 3000
```
Type something and press Enter. Ctrl+C in the nc terminal disconnects.
Then try:
```
npx tsx 02-tcp-server/port-in-use.ts
```

## Exercise
Write `02-tcp-server/exercise.ts`, a "command server" on port 3001:
- On connect, send `welcome! N client(s) connected\n` (N = current count).
- Each line the client sends is a command:
  - `time`  → reply with the current time
  - `upper <text>` → reply with the text in uppercase
  - `count` → reply with how many clients are connected right now
  - `quit`  → reply `bye` and close **that** client's connection
  - anything else → `unknown command`
- Keep the count correct when clients disconnect, **including** when they
  just Ctrl+C instead of typing `quit`. (Which event fires in both cases?)
- Don't let one client's error crash the server.

Test with two `nc` windows open at once.
