// server.js — Regni d'Oriente MMORPG Multiplayer Server
// Node.js + Express + Socket.io + SQLite
'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// Database setup (SQLite via better-sqlite3)
// ============================================================
let db;
try {
  const Database = require('better-sqlite3');
  db = new Database(path.join(__dirname, '../db/game.db'));
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Apply schema
  const fs = require('fs');
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  if (fs.existsSync(schemaPath)) {
    db.exec(fs.readFileSync(schemaPath, 'utf8'));
  }
  console.log('[DB] SQLite ready');
} catch (e) {
  console.warn('[DB] SQLite not available, running in memory mode:', e.message);
  db = null;
}

// ============================================================
// In-memory fallback store (if DB unavailable)
// ============================================================
const memStore = {
  accounts: new Map(),
  characters: new Map(),
  sessions: new Map(),
};

// ============================================================
// Express + Socket.io
// ============================================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 20000,
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, '../index.html')));
app.get('/play', (_, res) => res.sendFile(path.join(__dirname, '../game.html')));

// REST: register
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Dati mancanti' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username deve essere 3-20 caratteri' });
  if (password.length < 6) return res.status(400).json({ error: 'Password minimo 6 caratteri' });

  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  try {
    if (db) {
      const exists = db.prepare('SELECT id FROM accounts WHERE username=?').get(username);
      if (exists) return res.status(409).json({ error: 'Username già in uso' });
      db.prepare('INSERT INTO accounts (id,username,email,password_hash) VALUES (?,?,?,?)').run(id, username, email || '', hash);
    } else {
      if (memStore.accounts.has(username)) return res.status(409).json({ error: 'Username già in uso' });
      memStore.accounts.set(username, { id, username, hash });
    }
    res.json({ ok: true, message: 'Account creato!' });
  } catch (e) {
    res.status(500).json({ error: 'Errore server' });
  }
});

// REST: login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Dati mancanti' });
  try {
    let account;
    if (db) {
      account = db.prepare('SELECT * FROM accounts WHERE username=?').get(username);
    } else {
      account = memStore.accounts.get(username);
      if (account) account = { ...account, password_hash: account.hash };
    }
    if (!account) return res.status(401).json({ error: 'Account non trovato' });
    const ok = await bcrypt.compare(password, account.password_hash);
    if (!ok) return res.status(401).json({ error: 'Password errata' });

    const token = uuidv4();
    memStore.sessions.set(token, { accountId: account.id, username: account.username, loginTime: Date.now() });
    if (db) db.prepare('UPDATE accounts SET last_login=CURRENT_TIMESTAMP WHERE id=?').run(account.id);
    res.json({ ok: true, token, accountId: account.id, username: account.username });
  } catch (e) {
    res.status(500).json({ error: 'Errore server' });
  }
});

// REST: get characters for account
app.get('/api/characters/:token', (req, res) => {
  const session = memStore.sessions.get(req.params.token);
  if (!session) return res.status(401).json({ error: 'Non autorizzato' });
  if (db) {
    const chars = db.prepare('SELECT * FROM characters WHERE account_id=?').all(session.accountId);
    res.json({ characters: chars });
  } else {
    const chars = [...memStore.characters.values()].filter(c => c.accountId === session.accountId);
    res.json({ characters: chars });
  }
});

// REST: create character
app.post('/api/characters', (req, res) => {
  const { token, name, classKey } = req.body;
  const session = memStore.sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Non autorizzato' });
  const validClasses = ['guerriero', 'ninja', 'mago', 'sciamano'];
  if (!validClasses.includes(classKey)) return res.status(400).json({ error: 'Classe non valida' });
  if (!name || name.length < 2 || name.length > 16) return res.status(400).json({ error: 'Nome 2-16 caratteri' });

  const id = uuidv4();
  const charData = { id, accountId: session.accountId, name, classKey, level: 1, xp: 0, hp: 100, mp: 50, x: 1600, y: 1600, mapId: 'village', gold: 100, kills: 0 };
  try {
    if (db) {
      const exists = db.prepare('SELECT id FROM characters WHERE name=?').get(name);
      if (exists) return res.status(409).json({ error: 'Nome già in uso' });
      db.prepare(`INSERT INTO characters (id,account_id,name,class,level,xp,hp,mp,x,y,map_id,gold)
        VALUES (?,?,?,?,1,0,100,50,1600,1600,'village',100)`).run(id, session.accountId, name, classKey);
    } else {
      const exists = [...memStore.characters.values()].find(c => c.name === name);
      if (exists) return res.status(409).json({ error: 'Nome già in uso' });
      memStore.characters.set(id, charData);
    }
    res.json({ ok: true, character: charData });
  } catch (e) {
    res.status(500).json({ error: 'Errore server' });
  }
});

// REST: save character state
app.post('/api/characters/save', (req, res) => {
  const { token, charId, state } = req.body;
  const session = memStore.sessions.get(token);
  if (!session) return res.status(401).json({ error: 'Non autorizzato' });
  try {
    if (db) {
      db.prepare(`UPDATE characters SET level=?,xp=?,hp=?,mp=?,x=?,y=?,gold=?,kills=?,last_save=CURRENT_TIMESTAMP
        WHERE id=? AND account_id=?`).run(
        state.level, state.xp, Math.floor(state.hp), Math.floor(state.mp),
        Math.floor(state.x), Math.floor(state.y), state.gold, state.kills || 0,
        charId, session.accountId
      );
      if (state.inventory) {
        db.prepare('DELETE FROM inventory WHERE character_id=?').run(charId);
        const insert = db.prepare('INSERT INTO inventory (id,character_id,item_id,slot_index,quantity,equipped,equip_slot) VALUES (?,?,?,?,?,?,?)');
        state.inventory.forEach((item, idx) => {
          if (item && item.id) insert.run(uuidv4(), charId, item.id, idx, item.qty || 1, 0, null);
        });
        if (state.equipped) {
          Object.entries(state.equipped).forEach(([slot, item]) => {
            if (item) insert.run(uuidv4(), charId, item.id, -1, 1, 1, slot);
          });
        }
      }
    } else {
      const existing = memStore.characters.get(charId);
      if (existing && existing.accountId === session.accountId) {
        memStore.characters.set(charId, { ...existing, ...state });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[Save]', e);
    res.status(500).json({ error: 'Errore salvataggio' });
  }
});

// REST: leaderboard
app.get('/api/leaderboard', (req, res) => {
  if (db) {
    const rows = db.prepare(`SELECT c.name, c.class, c.level, c.gold, c.kills,
      a.username FROM characters c JOIN accounts a ON c.account_id=a.id
      ORDER BY c.level DESC, c.xp DESC LIMIT 50`).all();
    res.json({ leaderboard: rows });
  } else {
    const rows = [...memStore.characters.values()]
      .sort((a, b) => b.level - a.level || b.xp - a.xp)
      .slice(0, 50)
      .map(c => ({ ...c, username: [...memStore.accounts.values()].find(a => a.id === c.accountId)?.username || '?' }));
    res.json({ leaderboard: rows });
  }
});

// ============================================================
// World State (shared across all connected players)
// ============================================================
const worldState = {
  players: new Map(),   // socketId -> player state
  mobs: new Map(),      // mobId -> mob state (server-authoritative)
  globalMobId: 0,
};

// Initialize some server-side mobs
function initServerMobs() {
  // Spawn a basic set of mobs across the world
  const mobDefs = [
    { type: 'wolf', count: 15, xRange: [200, 800], yRange: [200, 3000] },
    { type: 'boar', count: 10, xRange: [200, 900], yRange: [200, 3000] },
    { type: 'bandit', count: 8, xRange: [300, 900], yRange: [1900, 2700] },
    { type: 'orc_warrior', count: 6, xRange: [2000, 2900], yRange: [300, 1200] },
    { type: 'specter', count: 5, xRange: [800, 1500], yRange: [2300, 2900] },
  ];
  mobDefs.forEach(({ type, count, xRange, yRange }) => {
    for (let i = 0; i < count; i++) {
      const id = `mob_${++worldState.globalMobId}`;
      worldState.mobs.set(id, {
        id, type,
        x: xRange[0] + Math.random() * (xRange[1] - xRange[0]),
        y: yRange[0] + Math.random() * (yRange[1] - yRange[0]),
        hp: 100, maxHp: 100,
        state: 'idle',
        target: null,
        lastUpdate: Date.now(),
      });
    }
  });
  console.log(`[World] Spawned ${worldState.mobs.size} mobs`);
}
initServerMobs();

// ============================================================
// Socket.io — real-time multiplayer
// ============================================================
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Authenticate via token
  socket.on('authenticate', ({ token, charId }) => {
    const session = memStore.sessions.get(token);
    if (!session) { socket.emit('authError', { error: 'Token non valido' }); return; }

    socket.data.accountId = session.accountId;
    socket.data.charId = charId;
    socket.data.username = session.username;
    socket.join('world');

    // Load character
    let charData = null;
    if (db && charId) {
      charData = db.prepare('SELECT * FROM characters WHERE id=? AND account_id=?').get(charId, session.accountId);
    }

    socket.emit('authenticated', {
      character: charData,
      worldSnapshot: getWorldSnapshot(),
    });

    // Announce to others
    socket.to('world').emit('playerJoined', {
      id: socket.id,
      username: session.username,
      x: charData?.x || 1600,
      y: charData?.y || 1600,
      level: charData?.level || 1,
      classKey: charData?.class || 'guerriero',
    });

    console.log(`[WS] ${session.username} joined (char: ${charId})`);
  });

  // Player movement update
  socket.on('move', (data) => {
    const { x, y, dir } = data;
    if (typeof x !== 'number' || typeof y !== 'number') return;
    // Clamp to world bounds
    const cx = Math.max(20, Math.min(3180, x));
    const cy = Math.max(20, Math.min(3180, y));
    if (!worldState.players.has(socket.id)) {
      worldState.players.set(socket.id, { id: socket.id, x: cx, y: cy });
    } else {
      const p = worldState.players.get(socket.id);
      p.x = cx; p.y = cy; p.dir = dir;
    }
    // Broadcast movement to nearby players (within 1000 units)
    const pState = worldState.players.get(socket.id);
    socket.to('world').emit('playerMoved', { id: socket.id, x: cx, y: cy, dir });
  });

  // Combat event (client reports hit, server validates and broadcasts)
  socket.on('combatHit', (data) => {
    const { targetId, damage, crit } = data;
    if (typeof damage !== 'number' || damage < 0 || damage > 99999) return;
    // Broadcast the damage to all players for visual sync
    socket.to('world').emit('combatResult', {
      attackerId: socket.id,
      targetId,
      damage: Math.floor(damage),
      crit: !!crit,
    });
  });

  // Chat message
  socket.on('chatMessage', (data) => {
    const { channel, text } = data;
    if (!text || text.length > 200) return;
    const cleanText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const msg = {
      id: uuidv4(),
      from: socket.data.username || 'Anonimo',
      channel: ['local', 'global', 'party'].includes(channel) ? channel : 'local',
      text: cleanText,
      time: Date.now(),
    };
    if (msg.channel === 'global') {
      io.to('world').emit('chatMessage', msg);
    } else {
      socket.to('world').emit('chatMessage', msg);
    }
    if (db) {
      try {
        db.prepare('INSERT INTO chat_messages (id,character_id,channel,message) VALUES (?,?,?,?)').run(
          uuidv4(), socket.data.charId || null, msg.channel, cleanText
        );
      } catch (_) {}
    }
  });

  // Player killed enemy (for leaderboard/sync)
  socket.on('killed', (data) => {
    const { mobType } = data;
    socket.to('world').emit('mobKilled', { killerId: socket.id, mobType });
  });

  // Request world snapshot
  socket.on('requestWorld', () => {
    socket.emit('worldSnapshot', getWorldSnapshot());
  });

  socket.on('disconnect', () => {
    worldState.players.delete(socket.id);
    io.to('world').emit('playerLeft', { id: socket.id });
    console.log(`[WS] ${socket.data.username || socket.id} disconnected`);
  });
});

function getWorldSnapshot() {
  return {
    players: [...worldState.players.values()],
    mobCount: worldState.mobs.size,
  };
}

// ============================================================
// Server-side mob AI tick (broadcast updates to clients)
// ============================================================
setInterval(() => {
  if (worldState.players.size === 0) return;
  const updates = [];
  // Simplified server-side AI: just track state changes
  for (const [id, mob] of worldState.mobs) {
    const nearby = [...worldState.players.values()].find(p =>
      Math.hypot(p.x - mob.x, p.y - mob.y) < 200
    );
    if (nearby && mob.state === 'idle') {
      mob.state = 'chase';
      updates.push({ id, state: 'chase' });
    } else if (!nearby && mob.state === 'chase') {
      mob.state = 'idle';
      updates.push({ id, state: 'idle' });
    }
  }
  if (updates.length) io.to('world').emit('mobStateUpdate', updates);
}, 2000);

// ============================================================
// Pullo.io — attach game to shared Socket.io instance
// ============================================================
try {
  const { setupPulloGame } = require('./pullo-game');
  setupPulloGame(io, app);
} catch (e) {
  console.warn('[Pullo] Could not load pullo-game:', e.message);
}

// Route: serve pullo game page
app.get('/pullo', (_, res) => res.sendFile(path.join(__dirname, '../pullo.html')));

// ============================================================
// Start server
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════╗`);
  console.log(`║  Regni d'Oriente + Pullo.io — Server on   ║`);
  console.log(`║  http://localhost:${PORT}                       ║`);
  console.log(`║  Pullo.io  →  http://localhost:${PORT}/pullo   ║`);
  console.log(`╚════════════════════════════════════════════╝\n`);
});

module.exports = { app, server };
