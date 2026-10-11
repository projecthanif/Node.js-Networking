import { EventEmitter } from 'node:events';

const door = new EventEmitter();

// 1. on: runs every time
door.on('knock', (who: string) => console.log(`[on]   ${who} knocked`));

// 2. once: runs only the first time
door.once('knock', (who: string) => console.log(`[once] first knock was ${who}`));

// 3. emit is SYNCHRONOUS — watch the order of the logs
console.log('before emit');
door.emit('knock', 'Alice');
console.log('after emit');   // printed AFTER the listeners ran

door.emit('knock', 'Bob');   // the 'once' listener is gone now

// 4. off: removing needs the same function reference
const logger = () => console.log('[logger] knock');
door.on('knock', logger);
door.emit('knock', 'Carol');
door.off('knock', logger);
door.emit('knock', 'Dave');  // logger no longer runs

console.log('listeners on knock:', door.listenerCount('knock'));

// Note: a plain EventEmitter is untyped — this compiles fine even though it's a typo:
door.emit('knok', 123);
// See typed-emitter.ts for the fix.
