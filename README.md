# Node.js Networking

Goal: understand what's *underneath* frameworks like NestJS/Express.
Written in TypeScript, using only Node built-ins (no frameworks).
Setup: `npm install` once. Run a lesson file with `npx tsx <file>.ts`; check types with `npm run typecheck`.
`tsx` runs .ts files directly (Node 20 can't do that natively).

## Roadmap

Order matters — each lesson builds on the previous one.

| #  | Lesson                         | Covers from the list                          |
|----|--------------------------------|-----------------------------------------------|
| 01 | `events/`                      | events, EventEmitter                           |
| 02 | `tcp-server/`                  | what a server is, ports, sockets              |
| 03 | `tcp-client/`                  | client/server communication                   |
| 04 | `connection-lifecycle/`        | connections, connection lifecycle             |
| 05 | `streams/`                     | streams, backpressure, piping                 |
| 06 | `http-by-hand/`                | TCP vs HTTP (write HTTP over raw TCP)         |
| 07 | `graceful-shutdown/`           | signals, draining connections, timeouts       |
| 08 | capstone                       | tiny chat server or mini HTTP framework       |

Why events first: servers, sockets, and streams in Node are **all** EventEmitters.
If you understand `.on()` / `.emit()`, the rest of the `net` module reads like plain English.

## Progress
- [x] 01 events
- [x] 02 tcp-server
- [x] 03 tcp-client
- [ ] 04 connection-lifecycle
- [ ] 05 streams
- [ ] 06 http-by-hand
- [ ] 07 graceful-shutdown
- [ ] 08 capstone
