import { EventEmitter } from 'node:events';

const e = new EventEmitter();

// Comment this block out and re-run: the process will CRASH on the emit below.
e.on('error', (err: Error) => {
  console.log('handled error:', err.message);
});

e.emit('error', new Error('connection reset'));
console.log('still alive 👍');
