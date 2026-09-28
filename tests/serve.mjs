// 테스트용 정적 서버: 게임 폴더를 빈 포트에 서빙하고 index.html 주소를 돌려준다.
// BASE 환경변수를 주면 그 주소를 그대로 쓴다(예: BASE=http://127.0.0.1:8765/index.html).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };

export async function base() {
  if (process.env.BASE) return process.env.BASE;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  server.unref();
  return `http://127.0.0.1:${server.address().port}/index.html`;
}
