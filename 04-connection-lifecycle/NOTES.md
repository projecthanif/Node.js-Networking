# 04 — Connection Lifecycle

## The whole life of one connection
```
 CLIENT                                         SERVER
   |  net.connect()                               | server.listen()
   |  ---------- SYN (can I connect?) --------->  |
   |  <--------- SYN-ACK (yes) -----------------  |
   |  ---------- ACK ---------------------------> |   3-way handshake
 'connect'                                    'connection'
   |                                              |
   |  <========== data both ways ==============>  |   'data' on both sides
   |                                              |
   |  end()  ---- FIN ("done sending") -------->  |
   |                                            'end'   (server can still write!)
   |  <---------- more data, if any -----------   |
   |  <---------- FIN --------------------------  | end()
 'end'                                            |
 'close'                                       'close'
```
TCP has **two independent directions**. Closing is done per direction: each side
sends a FIN when it's done *sending*. The connection is fully closed only when
both directions are.

## Three ways to hang up
| Call                     | What goes on the wire          | Other side sees                  |
|--------------------------|--------------------------------|----------------------------------|
| `socket.end(data?)`      | remaining data, then FIN       | `'data'`… `'end'` → `'close'`    |
| `socket.destroy()`       | FIN right away, unsent data dropped | `'end'` → `'close'`         |
| `socket.resetAndDestroy()` | RST ("abort!")               | `'error'` ECONNRESET → `'close'` |

Use `end()` normally. `destroy()` when you don't care about pending data (or after a
timeout). RST is what happens when a process crashes or a connection is killed.

## Half-close and `allowHalfOpen`
Receiving `'end'` means the other side is done **sending**. It may still be waiting
to **receive** a reply. That's "half-open" (or half-closed).

Node's default is `allowHalfOpen: false`: when your socket gets `'end'`, Node
**automatically calls `end()` on your side too** (right after your `'end'` listeners
run). Usually fine, but it means any reply that takes time (a DB query, a timer)
can't be sent after the other side has finished sending. If you need that ("send me
everything, then I'll answer"), create the server with `{ allowHalfOpen: true }` and
call `end()` yourself. See `half-close.ts`.

## Events in order
| Event       | Means                                                              |
|-------------|--------------------------------------------------------------------|
| `'connect'` | (client only) handshake done                                       |
| `'data'`    | bytes arrived                                                      |
| `'end'`     | other side sent FIN: no more data will arrive                       |
| `'finish'`  | *my* `end()` has been fully flushed to the OS                      |
| `'error'`   | something broke; `'close'` follows                                 |
| `'close'`   | everything is gone. Always last, always exactly once.               |

## The silent killer: peers that just vanish
If a client's laptop sleeps or its Wi-Fi drops, **no FIN and no RST are sent**.
From your server's view, the connection is simply quiet — forever. No `'end'`, no
`'close'`. Your client count is wrong and the socket leaks.

Two defenses:
1. **TCP keepalive** (`socket.setKeepAlive(true, 60_000)`): the OS sends tiny probes
   when idle and errors the socket if nobody answers. Cheap, but slow (minutes).
2. **Application-level idle timeout / heartbeat**: "if I hear nothing for 30 s,
   close it" — or send `ping` and expect `pong`. This is what real servers do
   (HTTP servers' keep-alive timeout, WebSocket ping/pong).

## Framing: turning a byte stream back into messages
TCP doesn't preserve your `write()` boundaries. One command may arrive in pieces
(`"ti"` + `"me\n"`), several may arrive together (`"time\ncount\n"`). Fix: keep a
**buffer** per connection. Append each chunk, cut out every complete line, keep the
unfinished remainder for next time. See `line-buffer.ts`.

## Run
```
npx tsx 04-connection-lifecycle/lifecycle.ts end
npx tsx 04-connection-lifecycle/lifecycle.ts destroy
npx tsx 04-connection-lifecycle/lifecycle.ts reset
npx tsx 04-connection-lifecycle/half-close.ts
npx tsx 04-connection-lifecycle/half-close.ts --no-half-open
npx tsx 04-connection-lifecycle/line-buffer.ts
```

## Exercise
Copy your lesson 02 command server to `04-connection-lifecycle/exercise.ts`,
change it to port **3004**, and upgrade it:

1. **Line buffer.** Commands split across chunks and several commands in one chunk
   both work. Test: `printf 'time\ncount\n' | nc localhost 3004` → two replies.
2. **Idle timeout.** If a client sends no complete command for 30 s (use a constant,
   test with 5 s), send `idle timeout, bye\n` and close the connection.
3. **Line too long.** If the buffer grows past 1000 characters without a newline,
   send `line too long\n` and drop the client (which hang-up call fits?).
4. **Close log.** When a client goes, log one line:
   `::1:51234 left after 12.3s (quit)` — reason is one of
   `quit`, `timeout`, `too long`, `client closed`, `error`.
5. **Bonus — half-close:** `printf 'time\ncount' | nc localhost 3004` (note: no
   newline after `count`). The client stops sending before finishing the line.
   Treat whatever's left in the buffer as a final command, still reply to it, then
   close. (What do you need to change so you're still allowed to write?)
