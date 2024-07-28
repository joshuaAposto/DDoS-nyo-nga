const express = require('express');
const helmet = require('helmet');
const path = require('path');
const compression = require('compression');
const cluster = require('cluster');
const os = require('os');
const rateLimit = require('express-rate-limit');
const memoryCache = require('memory-cache');
const LocalStorage = require('node-localstorage').LocalStorage;

const numCPUs = os.cpus().length;
const app = express();
const port = process.env.PORT || 3000;

const localStorage = new LocalStorage('./scratch');

app.use(helmet());
app.use(compression());

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    handler: (req, res) => {
        res.status(200).sendFile(path.join(__dirname, 'index.html'));
    }
});

const blockedIPs = new Set();

app.use((req, res, next) => {
    const ip = req.ip;
    if (blockedIPs.has(ip)) {
        res.status(403).send('Forbidden');
    } else {
        next();
    }
});

app.use(limiter);

const staticMiddleware = (req, res, next) => {
    const cachedContent = memoryCache.get(req.url);
    if (cachedContent) {
        res.send(cachedContent);
    } else {
        res.sendFile(path.join(__dirname, 'index.html'), (err) => {
            if (!err) {
                memoryCache.put(req.url, res._content, 60000);
            }
        });
    }
};

app.get('/', staticMiddleware);

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
