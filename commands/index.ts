// yes, this requires a bit of maintenance
// however, I believe this is a much more elegant solution
// than the nasty filesystem-scanning code DJS suggests

import * as fcc from './fcc.js';

const commands = new Map();

commands.set('fcc', fcc);

export default commands;
