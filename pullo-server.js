'use strict';
// Minimal standalone server for Pullo.io preview (no SQLite required)

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Stub login/register so auth buttons don't 404
app.post('/api/login', (req, res) => {
  const { username } = req.body || {};
  res.json({ username: username || 'guest', token: 'demo', accountId: 1 });
});
app.post('/api/register', (req, res) => {
  const { username } = req.body || {};
  res.json({ username: username || 'guest', token: 'demo', accountId: 1 });
});

// Mount Pullo game
const { setupPulloGame } = require('./server/pullo-game');
setupPulloGame(io, app);

// Serve Pullo page
app.get('/pullo', (_, res) => res.sendFile(path.join(__dirname, 'pullo.html')));
app.get('/', (_, res) => res.redirect('/pullo'));

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\n  Pullo.io preview → http://localhost:${PORT}/pullo\n`);
});
