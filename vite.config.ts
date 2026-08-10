import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'local-databases-api',
      configureServer(server) {
        const handleJsonApi = (route: string, relPath: string) => {
          server.middlewares.use(route, (req, res, next) => {
            const filePath = path.resolve(__dirname, relPath);
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
        };

        handleJsonApi('/api/materials', 'src/data/materials.json');
        handleJsonApi('/api/activities', 'src/data/activities.json');
        handleJsonApi('/api/equipment', 'src/data/equipment.json');
      }
    }
  ],
  server: {
    port: 3001
  }
});

