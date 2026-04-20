const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const DATA_DIR = '/bot-data';
const ENV_FILE = path.join(DATA_DIR, '.env');
const BOT_FILE = path.join(DATA_DIR, 'bot.js');
const LOG_FILE = path.join(DATA_DIR, 'bot.log');
const MAX_LOG_LINES = 500;

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '');

let botProcess = null;
let logBuffer = [];
let clients = new Set();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load existing log
try {
  const existing = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
  logBuffer = existing.slice(-MAX_LOG_LINES);
} catch {}

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
}

function appendLog(line) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const entry = `[${ts}] ${line}`;
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();
  fs.appendFileSync(LOG_FILE, entry + '\n');
  broadcast('log', entry);
}

function getBotStatus() {
  return botProcess && !botProcess.killed ? 'running' : 'stopped';
}

wss.on('connection', ws => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'history', data: logBuffer }));
  ws.send(JSON.stringify({ type: 'status', data: getBotStatus() }));
  ws.on('close', () => clients.delete(ws));
});

// --- ENV VARS ---
app.get('/api/env', (req, res) => {
  const vars = {};
  try {
    const raw = fs.readFileSync(ENV_FILE, 'utf8');
    raw.split('\n').forEach(line => {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) vars[m[1].trim()] = m[2].trim();
    });
  } catch {}
  res.json(vars);
});

app.post('/api/env', (req, res) => {
  const vars = req.body;
  const content = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n');
  fs.writeFileSync(ENV_FILE, content);
  res.json({ ok: true });
});

// --- BOT CODE ---
app.get('/api/code', (req, res) => {
  try {
    res.json({ code: fs.readFileSync(BOT_FILE, 'utf8') });
  } catch {
    res.json({ code: '// Paste your Discord bot code here\n' });
  }
});

app.post('/api/code', (req, res) => {
  fs.writeFileSync(BOT_FILE, req.body.code);
  res.json({ ok: true });
});

// --- BOT CONTROL ---
function loadEnv() {
  const env = { ...process.env };
  try {
    fs.readFileSync(ENV_FILE, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    });
  } catch {}
  return env;
}

app.post('/api/bot/start', (req, res) => {
  if (botProcess && !botProcess.killed) return res.json({ ok: false, msg: 'Already running' });
  if (!fs.existsSync(BOT_FILE)) return res.json({ ok: false, msg: 'No bot.js found. Upload code first.' });

  const env = loadEnv();
  botProcess = spawn('node', [BOT_FILE], { env, cwd: DATA_DIR });
  appendLog('▶ Bot started (PID ' + botProcess.pid + ')');
  broadcast('status', 'running');

  botProcess.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(appendLog));
  botProcess.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => appendLog('ERR ' + l)));
  botProcess.on('exit', (code) => {
    appendLog(`■ Bot exited (code ${code})`);
    broadcast('status', 'stopped');
    botProcess = null;
  });

  res.json({ ok: true });
});

app.post('/api/bot/stop', (req, res) => {
  if (!botProcess || botProcess.killed) return res.json({ ok: false, msg: 'Not running' });
  botProcess.kill('SIGTERM');
  res.json({ ok: true });
});

app.post('/api/bot/restart', async (req, res) => {
  if (botProcess && !botProcess.killed) {
    botProcess.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 1000));
  }
  // trigger start
  const fakeReq = { body: {} };
  const fakeRes = { json: () => {} };
  // inline start
  if (!fs.existsSync(BOT_FILE)) return res.json({ ok: false, msg: 'No bot.js found.' });
  const env = loadEnv();
  botProcess = spawn('node', [BOT_FILE], { env, cwd: DATA_DIR });
  appendLog('🔄 Bot restarted (PID ' + botProcess.pid + ')');
  broadcast('status', 'running');
  botProcess.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(appendLog));
  botProcess.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => appendLog('ERR ' + l)));
  botProcess.on('exit', (code) => {
    appendLog(`■ Bot exited (code ${code})`);
    broadcast('status', 'stopped');
    botProcess = null;
  });
  res.json({ ok: true });
});

app.get('/api/bot/status', (req, res) => res.json({ status: getBotStatus() }));

app.delete('/api/logs', (req, res) => {
  logBuffer = [];
  fs.writeFileSync(LOG_FILE, '');
  broadcast('log_clear', null);
  res.json({ ok: true });
});

server.listen(3000, () => console.log('Discord Bot Host running on :3000'));
