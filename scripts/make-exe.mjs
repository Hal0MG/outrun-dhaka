// Builds dist/OutrunDhaka.exe: a small launcher with the single-file game embedded (run `npm run build` first).
// Uses the C# compiler that ships with Windows, so nothing needs installing.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const csc = path.join(process.env.windir || 'C:/Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const html = path.resolve('dist', 'index.html');
const out = path.resolve('dist', 'OutrunDhaka.exe');
if (!existsSync(csc)) throw new Error('csc.exe not found: ' + csc);
if (!existsSync(html)) throw new Error('dist/index.html missing: run npm run build first');
execFileSync(csc, [
  '/nologo', '/target:winexe', '/optimize+', '/out:' + out,
  '/resource:' + html + ',index.html',
  '/reference:System.Windows.Forms.dll',
  path.resolve('tools', 'launcher', 'Launcher.cs'),
], { stdio: 'inherit' });
console.log('dist/OutrunDhaka.exe');
