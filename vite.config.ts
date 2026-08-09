import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'local-materials-api',
      configureServer(server) {
        server.middlewares.use('/api/materials', (req, res, next) => {
          const filePath = path.resolve(__dirname, 'src/data/materials.json');
          if (req.method === 'GET') {
            if (fs.existsSync(filePath)) {
              const data = fs.readFileSync(filePath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'File not found' }));
            }
          } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                fs.writeFileSync(filePath, body, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to write file' }));
              }
            });
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    port: 3001
  }
});

