const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8085;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const url = require('url');

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Rota da API Serverless
    if (pathname === '/api/sync') {
        const syncHandler = require('./api/sync.js');
        
        // Mock res.status e res.json para compatibilidade com Vercel Functions
        res.status = function(code) {
            res.statusCode = code;
            return res;
        };
        res.json = function(data) {
            if (!res.headersSent) {
                res.setHeader('Content-Type', 'application/json');
            }
            res.end(JSON.stringify(data));
            return res;
        };

        req.query = parsedUrl.query;

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    req.body = JSON.parse(body);
                } catch (e) {
                    req.body = {};
                }
                syncHandler(req, res).catch(err => {
                    console.error("Erro no manipulador API local:", err);
                    if (!res.writableEnded) {
                        res.status(500).json({ success: false, error: err.message });
                    }
                });
            });
        } else {
            syncHandler(req, res).catch(err => {
                console.error("Erro no manipulador API local:", err);
                if (!res.writableEnded) {
                    res.status(500).json({ success: false, error: err.message });
                }
            });
        }
        return;
    }

    // Evita ler arquivos fora do diretório de trabalho por segurança
    const safeUrl = req.url.split('?')[0];
    let filePath = path.join(__dirname, safeUrl === '/' ? 'index.html' : safeUrl);
    
    // Verifica se o caminho final está dentro de __dirname
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    const extname = path.extname(filePath);
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Erro no servidor: ${error.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}/`);
});
