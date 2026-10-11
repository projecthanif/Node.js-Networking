// TypeScript bonus: @types/node lets you pass an "event map" as a generic.
// Now event names AND listener argument types are checked.
import { EventEmitter } from 'node:events';

type ConnectionEvents = {
  connect: [];
  data: [chunk: string];
  error: [err: Error];
  close: [hadError: boolean];
};

class Connection extends EventEmitter<ConnectionEvents> {}

const c = new Connection();

c.on('data', (chunk) => console.log('data:', chunk.toUpperCase())); // chunk: string
c.on('close', (hadError) => console.log('closed, error?', hadError)); // hadError: boolean

c.emit('connect');
c.emit('data', 'hello');
c.emit('close', false);

// Uncomment each line and run `npm run typecheck` — both are compile errors:
// c.emit('dta', 'hello');   // unknown event name
// c.emit('data', 42);       // wrong argument type
