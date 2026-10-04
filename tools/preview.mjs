import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = new Set(['handdrawn-preview.html','src/app.js','src/styles.css','src/life.css','src/journal.js','src/weather-ui.js','src/weather.mjs','src/schedule.mjs','src/data.mjs','assets/mascots/handdrawn-cat-v1.png']);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const port = Number(process.env.PORT || 8767);
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const file = url.pathname === '/' ? 'handdrawn-preview.html' : decodeURIComponent(url.pathname.slice(1));
    if (!['GET','HEAD'].includes(request.method) || !files.has(file)) { response.writeHead(404).end('Not found'); return; }
    const content = await fs.readFile(path.join(root, file));
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(404).end('Not found'); }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the other preview or set PORT to another port.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`Shixu preview: http://127.0.0.1:${port}/handdrawn-preview.html`));
