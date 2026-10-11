// This is exactly the pattern net.Socket uses internally:
// a class that extends EventEmitter and emits events when its state changes.
import { EventEmitter } from 'node:events';

class FakeConnection extends EventEmitter {
  constructor(public readonly id: number) {
    super();
    // simulate the network: things happen LATER, not now
    setTimeout(() => this.emit('connect'), 100);
    setTimeout(() => this.emit('data', 'hello'), 200);
    setTimeout(() => this.emit('data', 'world'), 300);
    setTimeout(() => this.emit('end'), 400);
    setTimeout(() => this.emit('close'), 450);
  }
}

const conn = new FakeConnection(1);
conn.on('connect', () => console.log('connected'));
conn.on('data', (chunk: string) => console.log('got data:', chunk));
conn.on('end', () => console.log('other side said: no more data'));
conn.on('close', () => console.log('connection fully closed'));

console.log('listeners attached — nothing has happened yet');
