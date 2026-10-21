// Turns dist/index.html (single-file build) into an Artifact page body:
// the host wraps it in its own <!doctype>/<html>/<head>/<body>.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , src = 'dist/index.html', out = 'dist/outrun-dhaka.artifact.html'] = process.argv;
let html = readFileSync(src, 'utf8');
html = html
  .replace(/<!doctype html>/i, '')
  .replace(/<html[^>]*>/i, '')
  .replace(/<\/html>/i, '')
  .replace(/<head>/i, '')
  .replace(/<\/head>/i, '')
  .replace(/<body[^>]*>/i, '')
  .replace(/<\/body>/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '');
// title first, so the host finds it in the first 8KB
const title = html.match(/<title>[\s\S]*?<\/title>/i)?.[0] || '<title>Outrun Dhaka</title>';
html = title + '\n' + html.replace(title, '').trim() + '\n';
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
