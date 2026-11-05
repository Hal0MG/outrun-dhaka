// A trained driver in Node: the browser-safe Brain (src/game/brain.js) plus loading from a file.

import { readFileSync } from 'node:fs';
import { Brain as Net } from '../src/game/brain.js';

export class Brain extends Net {
  static load(path) {
    return new Brain(JSON.parse(readFileSync(path, 'utf8')));
  }
}
