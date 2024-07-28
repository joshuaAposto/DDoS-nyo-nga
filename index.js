const express = require('express');
const helmet = require('helmet');
const path = require('path');
const cluster = require('cluster');
const os = require('os');
const { createProxyMiddleware } = require('http-proxy-middleware');

const numCPUs = os.cpus().length;
const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork();
    });
} else {
    app.listen(port, () => {
        console.log(`Worker ${process.pid} running at http://localhost:${port}`);
    });
}

app.use('/proxy', createProxyMiddleware({ 
    target: 'http://localhost:3000',
    changeOrigin: true,
    pathRewrite: { '^/proxy': '' },
    onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('X-Proxy-Request', 'true');
    }
}));

console.log(`Server running on http://localhost:${port}`);
