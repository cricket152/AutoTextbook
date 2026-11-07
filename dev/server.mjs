// 本地开发服务器
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] ?? 8000);

// 导入本地模拟模块
const { createApplication } = await import(resolve(__dirname, '../../functions/routes.mjs'));
const { createDatabaseClient } = await import('./database.mjs');
const { createStorageClient } = await import('./storage.mjs');
const { getUser, requireUser, UserContextError } = await import('./auth.mjs');

const handle = createApplication({
  db: createDatabaseClient(),
  storage: createStorageClient(),
  requireUser: (ctx) => requireUser(ctx.request),
  BackendError: UserContextError
});

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    // CORS headers for local dev
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 静态文件服务（前端）
    if (!url.pathname.startsWith('/functions/')) {
      const filePath = resolve(__dirname, '../../dist', url.pathname === '/' ? 'index.html' : url.pathname);
      try {
        const content = await readFile(filePath);
        const ext = filePath.split('.').pop();
        const mimeTypes = {
          html: 'text/html',
          js: 'application/javascript',
          css: 'text/css',
          json: 'application/json',
          png: 'image/png',
          svg: 'image/svg+xml'
        };
        res.writeHead(200, { 'content-type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(content);
      } catch {
        // SPA fallback
        const indexHtml = await readFile(resolve(__dirname, '../../dist/index.html'));
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(indexHtml);
      }
      return;
    }

    // API 请求
    const request = new Request(`http://127.0.0.1${url.pathname}${url.search}`, {
      method: req.method,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(([k]) => k !== 'host')
      ),
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise((resolve) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
      })
    });

    const ctx = {
      request,
      requestId: crypto.randomUUID()
    };

    const response = await handle(ctx);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    const buffer = Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal_error' }));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`课本工坊本地开发服务器: http://127.0.0.1:${port}`);
});
