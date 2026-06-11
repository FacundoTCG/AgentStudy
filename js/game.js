// Regni d'Oriente — MMORPG d'azione 2D in canvas
// Gameplay ispirato agli MMORPG orientali classici, con codice e asset originali.

'use strict';

// ============================================================
// Costanti e configurazione
// ============================================================
const WORLD = { w: 3200, h: 3200 };
const TILE = 64;
const VILLAGE = { x: 1600, y: 1600, r: 280 };

const CLASSES = {
  guerriero: {
    name: 'Guerriero', color: '#c0392b',
    hp: 140, mp: 40, atk: 14, def: 6, speed: 165, range: 55, crit: 0.08,
    skills: [
      { name: 'Colpo Rotante', mp: 12, cd: 5, type: 'aoe', radius: 110, mult: 1.6 },
      { name: 'Urlo di Guerra', mp: 10, cd: 12, type: 'buff', stat: 'atk', mult: 1.4, dur: 8 },
      { name: 'Carica', mp: 8, cd: 7, type: 'dash', dist: 220, mult: 1.3 },
    ],
  },
  ninja: {
    name: 'Ninja', color: '#27ae60',
    hp: 95, mp: 55, atk: 12, def: 3, speed: 215, range: 50, crit: 0.25,
    skills: [
      { name: 'Raffica di Lame', mp: 14, cd: 6, type: 'multi', hits: 4, mult: 0.7 },
      { name: 'Passo Ombra', mp: 10, cd: 9, type: 'dash', dist: 300, mult: 1.0 },
      { name: 'Veleno', mp: 12, cd: 8, type: 'dot', mult: 0.5, ticks: 5 },
    ],
  },
  mago: {
    name: 'Mago Oscuro', color: '#8e44ad',
    hp: 80, mp: 110, atk: 16, def: 2, speed: 170, range: 240, crit: 0.1,
    skills: [
      { name: 'Sfera Infuocata', mp: 20, cd: 4, type: 'aoe', radius: 130, mult: 2.0 },
      { name: 'Lancia Gelida', mp: 14, cd: 6, type: 'multi', hits: 2, mult: 1.2 },
      { name: 'Scudo Arcano', mp: 16, cd: 14, type: 'buff', stat: 'def', mult: 2.5, dur: 10 },
    ],
  },
  sciamano: {
    name: 'Sciamano', color: '#2980b9',
    hp: 100, mp: 90, atk: 11, def: 4, speed: 180, range: 200, crit: 0.1,
    skills: [
      { name: 'Fulmine a Catena', mp: 16, cd: 5, type: 'chain', jumps: 3, mult: 1.3 },
      { name: 'Benedizione', mp: 20, cd: 10, type: 'heal', mult: 0.35 },
      { name: 'Tempesta', mp: 24, cd: 9, type: 'aoe', radius: 150, mult: 1.5 },
    ],
  },
};

const MOB_TYPES = [
  { name: 'Lupo Selvaggio',  color: '#7f8c8d', hp: 35,  atk: 6,  def: 0, speed: 110, xp: 18,  gold: [2, 8],   r: 14, minLvl: 1 },
  { name: 'Cinghiale Nero',  color: '#5d4037', hp: 55,  atk: 9,  def: 2, speed: 90,  xp: 28,  gold: [4, 12],  r: 16, minLvl: 1 },
  { name: 'Bandito',         color: '#b0712a', hp: 80,  atk: 13, def: 3, speed: 120, xp: 45,  gold: [8, 22],  r: 15, minLvl: 3 },
  { name: 'Orco Guerriero',  color: '#558b2f', hp: 130, atk: 18, def: 5, speed: 100, xp: 75,  gold: [15, 35], r: 19, minLvl: 5 },
  { name: 'Spettro',         color: '#9fa8da', hp: 100, atk: 24, def: 2, speed: 140, xp: 95,  gold: [18, 40], r: 14, minLvl: 8 },
  { name: 'Demone di Pietra',color: '#6d4c41', hp: 220, atk: 30, def: 9, speed: 80,  xp: 160, gold: [35, 70], r: 22, minLvl: 10 },
];

// Le "Pietre Demoniache": monoliti che evocano mostri finché non vengono distrutti.
const STONE = { hp: 600, xp: 400, gold: [80, 160], r: 30, spawnEvery: 5, maxMinions: 4 };

const XP_TABLE = lvl => Math.floor(80 * Math.pow(lvl, 1.6));

// ============================================================
// Stato di gioco
// ============================================================
const game = {
  running: false,
  time: 0,
  player: null,
  mobs: [],
  stones: [],
  drops: [],
  particles: [],
  floaters: [],
  projectiles: [],
  decor: [],
  keys: {},
  cam: { x: 0, y: 0 },
};

let canvas, ctx, minimap, mctx;

// ============================================================
// Utility
// ============================================================
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function log(text, cls = '') {
  const el = document.getElementById('log');
  const msg = document.createElement('div');
  msg.className = 'msg ' + cls;
  msg.textContent = text;
  el.prepend(msg);
  while (el.children.length > 8) el.lastChild.remove();
}

function floater(x, y, text, color) {
  game.floaters.push({ x, y, text, color, life: 1.2 });
}

function burst(x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(40, 140);
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), color });
  }
}

// ============================================================
// Creazione mondo
// ============================================================
function buildWorld() {
  game.decor = [];
  // Alberi e rocce sparsi (mai dentro il villaggio)
  for (let i = 0; i < 220; i++) {
    const x = rand(60, WORLD.w - 60);
    const y = rand(60, WORLD.h - 60);
    if (Math.hypot(x - VILLAGE.x, y - VILLAGE.y) < VILLAGE.r + 60) continue;
    game.decor.push({ x, y, type: Math.random() < 0.7 ? 'tree' : 'rock', s: rand(0.7, 1.3) });
  }
  // Case del villaggio
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    game.decor.push({
      x: VILLAGE.x + Math.cos(a) * (VILLAGE.r - 80),
      y: VILLAGE.y + Math.sin(a) * (VILLAGE.r - 80),
      type: 'house', s: 1,
    });
  }
}

function spawnMobs() {
  game.mobs = [];
  game.stones = [];
  for (let i = 0; i < 70; i++) spawnRandomMob();
  for (let i = 0; i < 8; i++) spawnStone();
}

function randomWildPos(minDistFromVillage = 150) {
  let x, y;
  do {
    x = rand(100, WORLD.w - 100);
    y = rand(100, WORLD.h - 100);
  } while (Math.hypot(x - VILLAGE.x, y - VILLAGE.y) < VILLAGE.r + minDistFromVillage);
  return { x, y };
}

function spawnRandomMob() {
  // I mob più forti compaiono lontano dal villaggio
  const pos = randomWildPos();
  const distV = Math.hypot(pos.x - VILLAGE.x, pos.y - VILLAGE.y);
  const tier = clamp(Math.floor((distV - VILLAGE.r) / 350), 0, MOB_TYPES.length - 1);
  const type = MOB_TYPES[randInt(0, tier)];
  spawnMob(type, pos.x, pos.y);
}

function spawnMob(type, x, y) {
  game.mobs.push({
    type, x, y,
    home: { x, y },
    hp: type.hp, maxHp: type.hp,
    state: 'idle',
    atkCd: 0,
    wanderT: rand(1, 4),
    dir: rand(0, Math.PI * 2),
    poison: null,
  });
}

function spawnStone() {
  const pos = randomWildPos(500);
  game.stones.push({
    x: pos.x, y: pos.y,
    hp: STONE.hp, maxHp: STONE.hp,
    spawnT: STONE.spawnEvery,
    minions: 0,
  });
}

// ============================================================
// Giocatore
// ============================================================
function createPlayer(classKey) {
  const c = CLASSES[classKey];
  return {
    classKey, cls: c,
    x: VILLAGE.x, y: VILLAGE.y,
    level: 1, xp: 0,
    hp: c.hp, maxHp: c.hp,
    mp: c.mp, maxMp: c.mp,
    atk: c.atk, def: c.def,
    gold: 0, potions: 3,
    atkCd: 0,
    skillCds: [0, 0, 0],
    potCd: 0,
    buffs: [],
    target: null,
    dir: 0,
    kills: 0,
    dead: false,
  };
}

function playerStat(stat) {
  const p = game.player;
  let v = p[stat];
  for (const b of p.buffs) if (b.stat === stat) v *= b.mult;
  return v;
}

function gainXp(amount) {
  const p = game.player;
  p.xp += amount;
  floater(p.x, p.y - 30, `+${amount} XP`, '#d4af37');
  while (p.xp >= XP_TABLE(p.level)) {
    p.xp -= XP_TABLE(p.level);
    p.level++;
    p.maxHp = Math.floor(p.maxHp * 1.12);
    p.maxMp = Math.floor(p.maxMp * 1.1);
    p.atk = Math.floor(p.atk * 1.1) + 1;
    p.def += 1;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    log(`Livello ${p.level} raggiunto!`, 'levelup');
    burst(p.x, p.y, '#d4af37', 24);
  }
}

function damagePlayer(amount) {
  const p = game.player;
  const dmg = Math.max(1, Math.floor(amount - playerStat('def')));
  p.hp -= dmg;
  floater(p.x, p.y - 25, `-${dmg}`, '#ff6655');
  if (p.hp <= 0 && !p.dead) {
    p.dead = true;
    document.getElementById('death-stats').textContent =
      `Livello ${p.level} · ${p.kills} nemici uccisi · ${p.gold} oro`;
    document.getElementById('death-screen').classList.remove('hidden');
  }
}

// ============================================================
// Combattimento
// ============================================================
function playerDamageRoll(mult = 1) {
  const p = game.player;
  let dmg = playerStat('atk') * mult * rand(0.85, 1.15);
  const crit = Math.random() < p.cls.crit;
  if (crit) dmg *= 2;
  return { dmg: Math.floor(dmg), crit };
}

function hitEntity(ent, dmg, crit) {
  const real = Math.max(1, dmg - (ent.type ? ent.type.def : 0));
  ent.hp -= real;
  floater(ent.x, ent.y - 25, crit ? `${real}!` : `${real}`, crit ? '#ffd75e' : '#fff');
  burst(ent.x, ent.y, '#ff6655', crit ? 10 : 5);
  if (ent.type) ent.state = 'chase'; // aggro
  if (ent.hp <= 0) killEntity(ent);
}

function killEntity(ent) {
  const p = game.player;
  if (ent.type) {
    // Mob
    game.mobs = game.mobs.filter(m => m !== ent);
    if (ent.fromStone) ent.fromStone.minions--;
    p.kills++;
    gainXp(ent.type.xp);
    dropLoot(ent.x, ent.y, ent.type.gold);
    if (p.target === ent) p.target = null;
    // Respawn ritardato per mantenere il mondo popolato
    setTimeout(spawnRandomMob, 8000);
  } else {
    // Pietra Demoniaca
    game.stones = game.stones.filter(s => s !== ent);
    gainXp(STONE.xp);
    dropLoot(ent.x, ent.y, STONE.gold);
    if (Math.random() < 0.8) dropPotion(ent.x + 20, ent.y);
    log('Hai distrutto una Pietra Demoniaca!', 'levelup');
    burst(ent.x, ent.y, '#b39ddb', 30);
    if (p.target === ent) p.target = null;
    setTimeout(spawnStone, 25000);
  }
}

function dropLoot(x, y, goldRange) {
  game.drops.push({ x: x + rand(-15, 15), y: y + rand(-15, 15), kind: 'gold', amount: randInt(goldRange[0], goldRange[1]), life: 30 });
  if (Math.random() < 0.18) dropPotion(x + rand(-20, 20), y + rand(-20, 20));
}

function dropPotion(x, y) {
  game.drops.push({ x, y, kind: 'potion', life: 30 });
}

function nearestEnemy(maxDist) {
  const p = game.player;
  let best = null, bd = maxDist;
  for (const e of [...game.mobs, ...game.stones]) {
    const d = dist(p, e);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function basicAttack() {
  const p = game.player;
  if (p.atkCd > 0 || p.dead) return;
  const range = p.cls.range;
  const target = (p.target && dist(p, p.target) <= range + 20) ? p.target : nearestEnemy(range);
  if (!target) return;
  p.atkCd = 0.55;
  p.target = target;
  p.dir = Math.atan2(target.y - p.y, target.x - p.x);

  if (range > 100) {
    // Attacco a distanza: proiettile
    game.projectiles.push({
      x: p.x, y: p.y,
      vx: Math.cos(p.dir) * 420, vy: Math.sin(p.dir) * 420,
      target, color: p.cls.color, life: 1.5,
      onHit: () => { const r = playerDamageRoll(); hitEntity(target, r.dmg, r.crit); },
    });
  } else {
    const r = playerDamageRoll();
    hitEntity(target, r.dmg, r.crit);
  }
}

function useSkill(idx) {
  const p = game.player;
  if (p.dead) return;
  const sk = p.cls.skills[idx];
  if (p.skillCds[idx] > 0) return;
  if (p.mp < sk.mp) { log('MP insufficienti', 'combat'); return; }
  p.mp -= sk.mp;
  p.skillCds[idx] = sk.cd;

  switch (sk.type) {
    case 'aoe': {
      burst(p.x, p.y, p.cls.color, 20);
      for (const e of [...game.mobs, ...game.stones]) {
        if (dist(p, e) <= sk.radius) {
          const r = playerDamageRoll(sk.mult);
          hitEntity(e, r.dmg, r.crit);
        }
      }
      break;
    }
    case 'multi': {
      const t = (p.target && dist(p, p.target) <= p.cls.range + 40) ? p.target : nearestEnemy(p.cls.range + 40);
      if (!t) { p.mp += sk.mp; p.skillCds[idx] = 0; return; }
      for (let i = 0; i < sk.hits; i++) {
        setTimeout(() => {
          if (t.hp > 0) { const r = playerDamageRoll(sk.mult); hitEntity(t, r.dmg, r.crit); }
        }, i * 120);
      }
      break;
    }
    case 'dash': {
      const nx = p.x + Math.cos(p.dir) * sk.dist;
      const ny = p.y + Math.sin(p.dir) * sk.dist;
      burst(p.x, p.y, p.cls.color, 12);
      p.x = clamp(nx, 30, WORLD.w - 30);
      p.y = clamp(ny, 30, WORLD.h - 30);
      const t = nearestEnemy(90);
      if (t) { const r = playerDamageRoll(sk.mult); hitEntity(t, r.dmg, r.crit); }
      break;
    }
    case 'buff': {
      p.buffs.push({ stat: sk.stat, mult: sk.mult, t: sk.dur });
      burst(p.x, p.y, '#7df58a', 14);
      log(`${sk.name} attivato`, 'levelup');
      break;
    }
    case 'heal': {
      const heal = Math.floor(p.maxHp * sk.mult);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      floater(p.x, p.y - 30, `+${heal}`, '#7df58a');
      burst(p.x, p.y, '#7df58a', 16);
      break;
    }
    case 'dot': {
      const t = (p.target && dist(p, p.target) <= p.cls.range + 40) ? p.target : nearestEnemy(p.cls.range + 40);
      if (!t || !t.type) { p.mp += sk.mp; p.skillCds[idx] = 0; return; }
      t.poison = { ticks: sk.ticks, dmg: Math.floor(playerStat('atk') * sk.mult), t: 1 };
      floater(t.x, t.y - 25, 'Avvelenato', '#9c27b0');
      break;
    }
    case 'chain': {
      let t = (p.target && dist(p, p.target) <= p.cls.range) ? p.target : nearestEnemy(p.cls.range);
      const hitSet = new Set();
      for (let i = 0; i <= sk.jumps && t; i++) {
        const r = playerDamageRoll(sk.mult * Math.pow(0.8, i));
        hitEntity(t, r.dmg, r.crit);
        burst(t.x, t.y, '#4fc3f7', 8);
        hitSet.add(t);
        const from = t;
        t = null;
        let bd = 180;
        for (const e of game.mobs) {
          if (hitSet.has(e)) continue;
          const d = dist(from, e);
          if (d < bd) { bd = d; t = e; }
        }
      }
      break;
    }
  }
}

function usePotion() {
  const p = game.player;
  if (p.potions <= 0 || p.potCd > 0 || p.dead) return;
  p.potions--;
  p.potCd = 3;
  const heal = Math.floor(p.maxHp * 0.5);
  p.hp = Math.min(p.maxHp, p.hp + heal);
  floater(p.x, p.y - 30, `+${heal}`, '#ff8a80');
  document.getElementById('potion-count').textContent = p.potions;
}

// ============================================================
// Aggiornamento logica
// ============================================================
function update(dt) {
  const p = game.player;
  game.time += dt;
  if (p.dead) return;

  // Movimento giocatore
  let dx = 0, dy = 0;
  if (game.keys['w'] || game.keys['arrowup']) dy -= 1;
  if (game.keys['s'] || game.keys['arrowdown']) dy += 1;
  if (game.keys['a'] || game.keys['arrowleft']) dx -= 1;
  if (game.keys['d'] || game.keys['arrowright']) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    p.x = clamp(p.x + (dx / len) * p.cls.speed * dt, 20, WORLD.w - 20);
    p.y = clamp(p.y + (dy / len) * p.cls.speed * dt, 20, WORLD.h - 20);
    p.dir = Math.atan2(dy, dx);
  }

  // Rigenerazione (più veloce nel villaggio)
  const inVillage = Math.hypot(p.x - VILLAGE.x, p.y - VILLAGE.y) < VILLAGE.r;
  const regenMult = inVillage ? 4 : 1;
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.01 * regenMult * dt);
  p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.025 * regenMult * dt);

  // Cooldown
  p.atkCd = Math.max(0, p.atkCd - dt);
  p.potCd = Math.max(0, p.potCd - dt);
  for (let i = 0; i < 3; i++) p.skillCds[i] = Math.max(0, p.skillCds[i] - dt);
  p.buffs = p.buffs.filter(b => (b.t -= dt) > 0);

  if (game.keys[' ']) basicAttack();

  // Mob AI
  for (const m of game.mobs) {
    m.atkCd = Math.max(0, m.atkCd - dt);
    const dp = dist(m, p);

    // Veleno
    if (m.poison) {
      m.poison.t -= dt;
      if (m.poison.t <= 0) {
        m.poison.t = 1;
        m.poison.ticks--;
        hitEntity(m, m.poison.dmg, false);
        if (m.poison && m.poison.ticks <= 0) m.poison = null;
      }
    }
    if (m.hp <= 0) continue;

    if (m.state === 'idle') {
      if (dp < 200) m.state = 'chase';
      else {
        m.wanderT -= dt;
        if (m.wanderT <= 0) { m.wanderT = rand(2, 5); m.dir = rand(0, Math.PI * 2); }
        m.x += Math.cos(m.dir) * m.type.speed * 0.3 * dt;
        m.y += Math.sin(m.dir) * m.type.speed * 0.3 * dt;
        if (dist(m, m.home) > 250) m.dir = Math.atan2(m.home.y - m.y, m.home.x - m.x);
      }
    } else if (m.state === 'chase') {
      if (dp > 600) { m.state = 'idle'; continue; }
      if (dp > m.type.r + 25) {
        const a = Math.atan2(p.y - m.y, p.x - m.x);
        m.x += Math.cos(a) * m.type.speed * dt;
        m.y += Math.sin(a) * m.type.speed * dt;
      } else if (m.atkCd === 0) {
        m.atkCd = 1.2;
        damagePlayer(m.type.atk * rand(0.8, 1.2));
      }
    }
    m.x = clamp(m.x, 20, WORLD.w - 20);
    m.y = clamp(m.y, 20, WORLD.h - 20);
  }

  // Pietre Demoniache: evocano mostri se il giocatore è vicino
  for (const s of game.stones) {
    if (dist(s, p) < 400 && s.minions < STONE.maxMinions) {
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        s.spawnT = STONE.spawnEvery;
        const type = MOB_TYPES[randInt(0, Math.min(3, MOB_TYPES.length - 1))];
        const a = rand(0, Math.PI * 2);
        spawnMob(type, s.x + Math.cos(a) * 60, s.y + Math.sin(a) * 60);
        const mob = game.mobs[game.mobs.length - 1];
        mob.fromStone = s;
        mob.state = 'chase';
        s.minions++;
        burst(s.x, s.y, '#b39ddb', 10);
      }
    }
  }

  // Proiettili
  for (const pr of game.projectiles) {
    pr.life -= dt;
    if (pr.target && pr.target.hp > 0) {
      const a = Math.atan2(pr.target.y - pr.y, pr.target.x - pr.x);
      pr.vx = Math.cos(a) * 420;
      pr.vy = Math.sin(a) * 420;
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.target && dist(pr, pr.target) < 20) {
      if (pr.target.hp > 0) pr.onHit();
      pr.life = 0;
    }
  }
  game.projectiles = game.projectiles.filter(pr => pr.life > 0);

  // Raccolta drop
  for (const d of game.drops) {
    d.life -= dt;
    if (dist(d, p) < 30) {
      if (d.kind === 'gold') {
        p.gold += d.amount;
        log(`+${d.amount} oro`, 'loot');
      } else {
        p.potions++;
        document.getElementById('potion-count').textContent = p.potions;
        log('Pozione raccolta', 'loot');
      }
      d.life = 0;
    }
  }
  game.drops = game.drops.filter(d => d.life > 0);

  // Particelle e numeri fluttuanti
  for (const pa of game.particles) {
    pa.life -= dt;
    pa.x += pa.vx * dt;
    pa.y += pa.vy * dt;
    pa.vx *= 0.95;
    pa.vy *= 0.95;
  }
  game.particles = game.particles.filter(pa => pa.life > 0);
  for (const f of game.floaters) { f.life -= dt; f.y -= 35 * dt; }
  game.floaters = game.floaters.filter(f => f.life > 0);

  // Camera
  game.cam.x = clamp(p.x - canvas.width / 2, 0, WORLD.w - canvas.width);
  game.cam.y = clamp(p.y - canvas.height / 2, 0, WORLD.h - canvas.height);

  updateHud();
}

// ============================================================
// HUD
// ============================================================
function updateHud() {
  const p = game.player;
  document.getElementById('hp-fill').style.width = `${(p.hp / p.maxHp) * 100}%`;
  document.getElementById('mp-fill').style.width = `${(p.mp / p.maxMp) * 100}%`;
  document.getElementById('xp-fill').style.width = `${(p.xp / XP_TABLE(p.level)) * 100}%`;
  document.getElementById('hp-text').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  document.getElementById('mp-text').textContent = `${Math.ceil(p.mp)} / ${p.maxMp}`;
  document.getElementById('xp-text').textContent = `Lv ${p.level}`;
  document.getElementById('gold').textContent = p.gold;
  document.getElementById('player-name').textContent = `${p.cls.name} — Livello ${p.level}`;

  // Cooldown abilità
  const slots = document.querySelectorAll('.skill-slot');
  for (let i = 0; i < 3; i++) {
    const frac = p.skillCds[i] / p.cls.skills[i].cd;
    slots[i].querySelector('.cooldown').style.transform = `scaleY(${frac})`;
  }
  slots[3].querySelector('.cooldown').style.transform = `scaleY(${p.potCd / 3})`;

  // Bersaglio
  const tf = document.getElementById('target-frame');
  if (p.target && p.target.hp > 0) {
    tf.classList.remove('hidden');
    document.getElementById('target-name').textContent = p.target.type ? p.target.type.name : 'Pietra Demoniaca';
    document.getElementById('target-hp-fill').style.width =
      `${(p.target.hp / p.target.maxHp) * 100}%`;
  } else {
    tf.classList.add('hidden');
  }
}

// ============================================================
// Rendering
// ============================================================
function draw() {
  const p = game.player;
  const cx = game.cam.x, cy = game.cam.y;
  const W = canvas.width, H = canvas.height;

  // Terreno
  ctx.fillStyle = '#2d4a22';
  ctx.fillRect(0, 0, W, H);
  // Variazione a tile
  const x0 = Math.floor(cx / TILE), y0 = Math.floor(cy / TILE);
  for (let ty = y0; ty <= y0 + H / TILE + 1; ty++) {
    for (let tx = x0; tx <= x0 + W / TILE + 1; tx++) {
      if ((tx * 7 + ty * 13) % 5 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillRect(tx * TILE - cx, ty * TILE - cy, TILE, TILE);
      }
    }
  }

  // Villaggio (zona sicura)
  ctx.beginPath();
  ctx.arc(VILLAGE.x - cx, VILLAGE.y - cy, VILLAGE.r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(212,175,55,0.07)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212,175,55,0.35)';
  ctx.setLineDash([12, 10]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Decorazioni
  for (const d of game.decor) {
    const x = d.x - cx, y = d.y - cy;
    if (x < -80 || y < -80 || x > W + 80 || y > H + 80) continue;
    if (d.type === 'tree') {
      ctx.fillStyle = '#3e2d1c';
      ctx.fillRect(x - 4 * d.s, y, 8 * d.s, 16 * d.s);
      ctx.beginPath();
      ctx.arc(x, y - 12 * d.s, 20 * d.s, 0, Math.PI * 2);
      ctx.fillStyle = '#1e3d1a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - 6 * d.s, y - 18 * d.s, 13 * d.s, 0, Math.PI * 2);
      ctx.fillStyle = '#2a5226';
      ctx.fill();
    } else if (d.type === 'rock') {
      ctx.beginPath();
      ctx.ellipse(x, y, 14 * d.s, 10 * d.s, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#555a5f';
      ctx.fill();
    } else if (d.type === 'house') {
      ctx.fillStyle = '#6d4c33';
      ctx.fillRect(x - 28, y - 18, 56, 36);
      ctx.beginPath();
      ctx.moveTo(x - 36, y - 18);
      ctx.lineTo(x, y - 44);
      ctx.lineTo(x + 36, y - 18);
      ctx.closePath();
      ctx.fillStyle = '#8c2f24';
      ctx.fill();
    }
  }

  // Drop
  for (const d of game.drops) {
    const x = d.x - cx, y = d.y - cy;
    if (d.kind === 'gold') {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd75e';
      ctx.fill();
      ctx.strokeStyle = '#aa8a20';
      ctx.stroke();
    } else {
      ctx.fillStyle = '#e53935';
      ctx.fillRect(x - 5, y - 7, 10, 14);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(x - 3, y - 10, 6, 4);
    }
  }

  // Pietre Demoniache
  for (const s of game.stones) {
    const x = s.x - cx, y = s.y - cy;
    if (x < -80 || y < -80 || x > W + 80 || y > H + 80) continue;
    const pulse = 1 + Math.sin(game.time * 3) * 0.05;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.moveTo(0, -38);
    ctx.lineTo(20, -8);
    ctx.lineTo(14, 26);
    ctx.lineTo(-14, 26);
    ctx.lineTo(-20, -8);
    ctx.closePath();
    ctx.fillStyle = '#4a3a6a';
    ctx.fill();
    ctx.strokeStyle = '#b39ddb';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = `rgba(179,157,219,${0.5 + Math.sin(game.time * 4) * 0.3})`;
    ctx.beginPath();
    ctx.arc(0, -5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawHpBar(x, y - 50, s.hp / s.maxHp, 50);
  }

  // Mob
  for (const m of game.mobs) {
    const x = m.x - cx, y = m.y - cy;
    if (x < -50 || y < -50 || x > W + 50 || y > H + 50) continue;
    // Ombra
    ctx.beginPath();
    ctx.ellipse(x, y + m.type.r * 0.8, m.type.r, m.type.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    // Corpo
    ctx.beginPath();
    ctx.arc(x, y, m.type.r, 0, Math.PI * 2);
    ctx.fillStyle = m.type.color;
    ctx.fill();
    ctx.strokeStyle = m.poison ? '#9c27b0' : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Occhi
    ctx.fillStyle = m.state === 'chase' ? '#ff5252' : '#ddd';
    ctx.beginPath();
    ctx.arc(x - 5, y - 4, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    drawHpBar(x, y - m.type.r - 12, m.hp / m.maxHp, 34);
    // Selezione bersaglio
    if (game.player.target === m) {
      ctx.beginPath();
      ctx.arc(x, y, m.type.r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#d4af37';
      ctx.stroke();
    }
  }

  // Proiettili
  for (const pr of game.projectiles) {
    ctx.beginPath();
    ctx.arc(pr.x - cx, pr.y - cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = pr.color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pr.x - cx, pr.y - cy, 10, 0, Math.PI * 2);
    ctx.strokeStyle = pr.color + '88';
    ctx.stroke();
  }

  // Giocatore
  if (!p.dead) {
    const x = p.x - cx, y = p.y - cy;
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 14, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    // Corpo
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = p.cls.color;
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Indicatore direzione (arma)
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(p.dir) * 16, y + Math.sin(p.dir) * 16);
    ctx.lineTo(x + Math.cos(p.dir) * 30, y + Math.sin(p.dir) * 30);
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Aura buff
    if (p.buffs.length) {
      ctx.beginPath();
      ctx.arc(x, y, 22 + Math.sin(game.time * 6) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(125,245,138,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Particelle
  for (const pa of game.particles) {
    ctx.globalAlpha = clamp(pa.life * 2, 0, 1);
    ctx.fillStyle = pa.color;
    ctx.fillRect(pa.x - cx - 2, pa.y - cy - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  // Numeri fluttuanti
  ctx.font = 'bold 14px Segoe UI';
  ctx.textAlign = 'center';
  for (const f of game.floaters) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x - cx, f.y - cy);
  }
  ctx.globalAlpha = 1;

  drawMinimap();
}

function drawHpBar(x, y, frac, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - w / 2, y, w, 5);
  ctx.fillStyle = frac > 0.5 ? '#66bb6a' : frac > 0.25 ? '#ffa726' : '#ef5350';
  ctx.fillRect(x - w / 2, y, w * clamp(frac, 0, 1), 5);
}

function drawMinimap() {
  const p = game.player;
  const s = minimap.width / WORLD.w;
  mctx.clearRect(0, 0, minimap.width, minimap.height);
  mctx.fillStyle = 'rgba(20,30,18,0.9)';
  mctx.fillRect(0, 0, minimap.width, minimap.height);
  // Villaggio
  mctx.beginPath();
  mctx.arc(VILLAGE.x * s, VILLAGE.y * s, VILLAGE.r * s, 0, Math.PI * 2);
  mctx.fillStyle = 'rgba(212,175,55,0.3)';
  mctx.fill();
  // Pietre
  mctx.fillStyle = '#b39ddb';
  for (const st of game.stones) mctx.fillRect(st.x * s - 2, st.y * s - 2, 4, 4);
  // Mob
  mctx.fillStyle = '#e57373';
  for (const m of game.mobs) mctx.fillRect(m.x * s - 1, m.y * s - 1, 2, 2);
  // Giocatore
  mctx.beginPath();
  mctx.arc(p.x * s, p.y * s, 3, 0, Math.PI * 2);
  mctx.fillStyle = '#fff';
  mctx.fill();
}

// ============================================================
// Input
// ============================================================
function setupInput() {
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    game.keys[k] = true;
    if (k === '1') useSkill(0);
    if (k === '2') useSkill(1);
    if (k === '3') useSkill(2);
    if (k === '4') usePotion();
    if (k === 'tab') {
      e.preventDefault();
      game.player.target = nearestEnemy(500);
    }
    if (k === ' ') e.preventDefault();
  });
  window.addEventListener('keyup', e => { game.keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const wx = e.clientX - rect.left + game.cam.x;
    const wy = e.clientY - rect.top + game.cam.y;
    // Seleziona il nemico cliccato
    let clicked = null;
    for (const ent of [...game.mobs, ...game.stones]) {
      const r = ent.type ? ent.type.r : STONE.r;
      if (Math.hypot(ent.x - wx, ent.y - wy) < r + 10) { clicked = ent; break; }
    }
    if (clicked) game.player.target = clicked;
    basicAttack();
  });

  document.querySelectorAll('.skill-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      const s = slot.dataset.slot;
      if (s === 'pot') usePotion();
      else useSkill(parseInt(s, 10));
    });
  });
}

// ============================================================
// Avvio
// ============================================================
function startGame(classKey) {
  document.getElementById('class-select').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');

  game.player = createPlayer(classKey);
  buildWorld();
  spawnMobs();

  // Nomi abilità nella barra
  const slots = document.querySelectorAll('.skill-slot');
  for (let i = 0; i < 3; i++) {
    slots[i].querySelector('.skill-name').textContent = game.player.cls.skills[i].name;
  }

  log(`Benvenuto, ${game.player.cls.name}! Distruggi le Pietre Demoniache.`, 'levelup');
  game.running = true;
}

function respawn() {
  const p = game.player;
  p.dead = false;
  p.hp = p.maxHp;
  p.mp = p.maxMp;
  p.x = VILLAGE.x;
  p.y = VILLAGE.y;
  p.gold = Math.floor(p.gold * 0.9); // piccola penalità
  p.target = null;
  document.getElementById('death-screen').classList.add('hidden');
  log('Sei risorto al villaggio.', '');
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  minimap = document.getElementById('minimap');
  mctx = minimap.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  setupInput();

  document.querySelectorAll('.class-card').forEach(card => {
    card.addEventListener('click', () => startGame(card.dataset.class));
  });
  document.getElementById('respawn-btn').addEventListener('click', respawn);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (game.running) {
      update(dt);
      draw();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
