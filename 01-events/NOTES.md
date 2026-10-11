# 01 — Events & EventEmitter

## The idea
Node is single-threaded. It can't sit and *wait* for a network packet — so instead
you register a function ("listener") and Node calls it **when something happens**.
That "something" is an **event**.

```
you:   "when data arrives, run this function"   ->  socket.on('data', fn)
Node:  ...packet arrives...                      ->  socket.emit('data', chunk)  -> fn(chunk)
```

`EventEmitter` is the class that implements this. `net.Server`, `net.Socket`,
`http.Server`, every stream, and `process` all extend it.

## The API you actually need
| Method                     | What it does                                           |
|----------------------------|--------------------------------------------------------|
| `on(name, fn)`             | add listener (runs every time)                         |
| `once(name, fn)`           | add listener that removes itself after first call      |
| `emit(name, ...args)`      | call all listeners for `name`, **synchronously**, in order |
| `off(name, fn)`            | remove a listener (needs the same function reference)  |
| `listenerCount(name)`      | how many listeners are attached                        |

## Three things that trip people up
1. **`emit` is synchronous.** Listeners run immediately, before `emit()` returns.
   Events don't make code async — the *source* of the event (network, timer) does.
2. **The `'error'` event is special.** If you emit `'error'` and nobody is listening,
   Node **throws and crashes the process**. On sockets this is the #1 cause of
   "my server died randomly". Always attach `.on('error', ...)` to sockets.
3. **Memory leak warning.** Adding >10 listeners to one event prints a warning.
   Usually means you're calling `.on()` inside a loop / per-request by mistake.

## Run
```
npx tsx 01-events/basics.ts
npx tsx 01-events/error-event.ts
npx tsx 01-events/custom-class.ts
npx tsx 01-events/typed-emitter.ts   # TS bonus: typed event maps
npm run typecheck
```

## Exercise (do this yourself)
Write `01-events/exercise.ts`: a `Timer` class extending EventEmitter.
- `start(seconds)` emits `'tick'` every second with the remaining count
- emits `'done'` at zero
- `stop()` clears it and emits `'stopped'`
Use the typed form `EventEmitter<TimerEvents>` so event names and args are checked.
Then use `once('done', ...)` and print something. Bonus: what happens if you
call `stop()` from inside a `'tick'` listener?
