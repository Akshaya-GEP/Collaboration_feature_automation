import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'dashboard')));

// Serve the report file if it exists
app.use('/reports', express.static(path.resolve(ROOT, 'test-results')));

let activeProcess = null;

io.on('connection', (socket) => {
    console.log('Client connected to dashboard');

    socket.on('run-test', ({ command, args }) => {
        if (activeProcess) {
            socket.emit('log', { type: 'error', text: '\n⚠️ A test is already running. Please wait or stop it first.\n' });
            return;
        }

        socket.emit('log', { type: 'system', text: `🚀 Starting: npm run ${command}\n` });

        // Build command
        const fullArgs = ['run', command, ...args];

        activeProcess = spawn('npm.cmd', fullArgs, {
            cwd: ROOT,
            env: { ...process.env, FORCE_COLOR: 'true' },
            shell: true
        });

        activeProcess.stdout.on('data', (data) => {
            socket.emit('log', { type: 'stdout', text: data.toString() });
        });

        activeProcess.stderr.on('data', (data) => {
            socket.emit('log', { type: 'stderr', text: data.toString() });
        });

        activeProcess.on('close', (code) => {
            activeProcess = null;
            socket.emit('log', { type: 'system', text: `\n🏁 Process finished with exit code ${code}\n` });
            socket.emit('finished', { code });
        });
    });

    socket.on('stop-test', () => {
        if (activeProcess) {
            activeProcess.kill();
            activeProcess = null;
            socket.emit('log', { type: 'system', text: '\n🛑 Test stopped by user.\n' });
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`\n✨ Automation Dashboard running at http://localhost:${PORT}`);
    console.log(`Press Ctrl+C to stop the dashboard server.\n`);
});
