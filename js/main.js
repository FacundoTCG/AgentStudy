// main.js — Regni d'Oriente MMORPG Boot & Main Loop
'use strict';

// ============================================================
// Global Game State
// ============================================================
const gameState = {
  player: null,
  mobs: [],
  stones: [],
  drops: [],
  projectiles: [],
  particles: [],
  floaters: [],
  effects: [],
  currentMap: null,
  currentDungeon: null,
  time: 0,
  running: false,
  paused: false,

  // System references (set during init)
  renderer: null,
  combat: null,
  monsterAI: null,
  inventory: null,
  quests: null,
  dungeon: null,
  saveSystem: null,
  ui: null,

  // Input state
  keys: {},
  mouse: { x: 0, y: 0, down: false, worldX: 0, worldZ: 0 },

  // Event bus
  _listeners: {},
  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  },
  emit(event, data) {
    (this._listeners[event] || []).forEach(cb => { try { cb(data); } catch (e) { console.error('[Event]', event, e); } });
  },
  off(event, cb) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(x => x !== cb);
  },
};

// ============================================================
// Player Factory
// ============================================================
function createPlayer(classKey, name) {
  const cls = window.GameData.CLASSES[classKey];
  const s = cls.baseStats;
  return {
    id: 'player',
    name: name || cls.name,
    classKey,
    className: cls.name,
    level: 1,
    xp: 0,
    hp: s.hp, maxHp: s.hp,
    mp: s.mp, maxMp: s.mp,
    atk: s.atk, matk: s.matk || 0,
    def: s.def, speed: s.speed, crit: s.crit,
    gold: 100,
    potions: 5,
    kills: 0,
    deaths: 0,
    // Position (world coords: x,y used as x,z in 3D)
    x: 1600, y: 1600,
    dir: 0,
    // Combat state
    atkCd: 0,
    skillCds: [0, 0, 0, 0],
    potCd: 0,
    // Targeting
    target: null,
    // Status effects
    buffs: [],
    debuffs: [],
    shield: 0,
    poisoned: false,
    // Movement
    moveTarget: null,
    velocity: { x: 0, y: 0 },
    // Equipment
    equipped: { weapon: null, chest: null, ring: null, necklace: null },
    // Inventory (30 slots)
    inventory: [],
    // Quest tracking
    activeQuests: [],
    completedQuests: [],
    // Dungeon tracking
    completedDungeons: [],
    // Animation
    animState: 'idle',
    dead: false,
  };
}

// ============================================================
// World Initialization
// ============================================================
function initWorld() {
  const mapData = window.GameData.MAPS.village;
  gameState.currentMap = mapData;

  // Build terrain in renderer
  gameState.renderer.buildTerrain(mapData);
  gameState.renderer.buildDecorations(mapData);

  // Spawn NPCs
  Object.values(window.GameData.NPCS).forEach(npcDef => {
    const mesh = gameState.renderer.createNPCMesh(npcDef);
    gameState.renderer.addEntity(npcDef.id, mesh, { type: 'npc', def: npcDef });
    gameState.renderer.updateEntityPosition(npcDef.id, npcDef.x, npcDef.y, 0, 'idle');
  });

  // Spawn Demon Stones
  const stonePositions = [
    { x: 700, y: 2300 }, { x: 2500, y: 600 }, { x: 400, y: 500 },
    { x: 2800, y: 2800 }, { x: 1100, y: 2700 }, { x: 2200, y: 1400 },
  ];
  stonePositions.forEach((pos, i) => {
    const id = `stone_${i}`;
    const mesh = gameState.renderer.createStoneMesh();
    const stone = {
      id, x: pos.x, y: pos.y,
      hp: 800, maxHp: 800,
      spawnTimer: 8, minions: 0,
      type: null, // not a mob
    };
    gameState.stones.push(stone);
    gameState.renderer.addEntity(id, mesh, { type: 'stone' });
    gameState.renderer.updateEntityPosition(id, pos.x, pos.y, 0, 'idle');
  });

  // Spawn initial mobs via MonsterAI
  mapData.zones.forEach(zone => {
    if (zone.safe || !zone.monsters) return;
    const count = Math.floor(zone.w * zone.h * (zone.density || 0.006));
    const cap = Math.min(count, 18);
    for (let i = 0; i < cap; i++) {
      const typeId = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
      const x = zone.x + Math.random() * zone.w;
      const y = zone.y + Math.random() * zone.h;
      gameState.monsterAI.spawnMob(typeId, x, y);
    }
  });
}

// ============================================================
// Input Handling
// ============================================================
function setupInput() {
  const canvas = document.getElementById('game-canvas');

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    // Don't capture keys while typing in chat
    if (document.activeElement?.id === 'chat-input') return;

    gameState.keys[k] = true;

    if (e.key === 'Escape') {
      if (gameState.ui.isAnyPanelOpen()) {
        ['inventory','quests','character','map'].forEach(n => gameState.ui.closePanel(n));
        gameState.ui.closeDialogue();
        gameState.ui.closeShop();
      } else {
        if (gameState.ui.isEscMenuOpen()) gameState.ui.closeEscMenu();
        else gameState.ui.openEscMenu();
      }
      return;
    }

    if (gameState.paused || gameState.player?.dead) return;

    if (k === '1') gameState.emit('useSkill', { index: 0 });
    if (k === '2') gameState.emit('useSkill', { index: 1 });
    if (k === '3') gameState.emit('useSkill', { index: 2 });
    if (k === '4') gameState.emit('useSkill', { index: 3 });
    if (k === ' ') { e.preventDefault(); gameState.emit('usePotion', {}); }
    if (k === 'tab') { e.preventDefault(); selectNearestEnemy(); }
    if (k === 'i') gameState.ui.togglePanel('inventory');
    if (k === 'j') gameState.ui.togglePanel('quests');
    if (k === 'c') gameState.ui.togglePanel('character');
    if (k === 'm') gameState.ui.togglePanel('map');
    if (k === 'enter') document.getElementById('chat-input')?.focus();
  });

  window.addEventListener('keyup', e => {
    gameState.keys[e.key.toLowerCase()] = false;
  });

  // Mouse for camera + click-to-attack
  let mouseDown = false, mouseMoved = false;
  let lastMouseX = 0, lastMouseY = 0;
  let isDraggingCamera = false;

  canvas?.addEventListener('mousedown', e => {
    mouseDown = true;
    mouseMoved = false;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (e.button === 2) isDraggingCamera = true;
  });

  canvas?.addEventListener('mousemove', e => {
    gameState.mouse.x = e.clientX;
    gameState.mouse.y = e.clientY;
    if (mouseDown) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      if (Math.abs(dx) + Math.abs(dy) > 3) mouseMoved = true;
      if (isDraggingCamera || e.buttons === 2) {
        gameState.renderer.rotateCameraBy(dx * 0.005, dy * 0.005);
      }
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  });

  canvas?.addEventListener('mouseup', e => {
    if (!mouseMoved && e.button === 0) {
      handleLeftClick(e);
    }
    mouseDown = false;
    isDraggingCamera = false;
  });

  canvas?.addEventListener('wheel', e => {
    gameState.renderer.zoomCamera(e.deltaY * 0.05);
    e.preventDefault();
  }, { passive: false });

  canvas?.addEventListener('contextmenu', e => e.preventDefault());
}

function handleLeftClick(e) {
  const p = gameState.player;
  if (!p || p.dead || gameState.paused) return;

  // Raycast to find clicked entity or ground position
  const result = gameState.renderer.raycastClick(e.clientX, e.clientY,
    [...gameState.mobs, ...gameState.stones]);

  if (result) {
    if (result.type === 'enemy') {
      p.target = result.entity;
      gameState.combat.playerBasicAttack();
    } else if (result.type === 'npc') {
      gameState.ui.openDialogue(result.entityId);
    } else if (result.type === 'ground') {
      // Click-to-move
      p.moveTarget = { x: result.x, y: result.z };
    } else if (result.type === 'dungeon') {
      gameState.ui.showDungeonPrompt(result.dungeonId);
    } else if (result.type === 'drop') {
      tryPickupDrop(result.dropId);
    }
  } else {
    // Click on ground -> move
    const groundPos = gameState.renderer.getGroundPosition(e.clientX, e.clientY);
    if (groundPos) p.moveTarget = { x: groundPos.x, y: groundPos.z };
  }
}

function selectNearestEnemy() {
  const p = gameState.player;
  if (!p) return;
  const all = [...gameState.mobs, ...gameState.stones];
  let best = null, bd = 600;
  for (const e of all) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) { bd = d; best = e; }
  }
  p.target = best;
}

function tryPickupDrop(dropId) {
  const drop = gameState.drops.find(d => d.id === dropId);
  if (!drop) return;
  const p = gameState.player;
  if (Math.hypot(drop.x - p.x, drop.y - p.y) > 60) return;
  if (drop.kind === 'gold') {
    p.gold += drop.amount;
    gameState.ui.logCombat(`+${drop.amount} oro`, 'loot');
  } else if (drop.kind === 'item') {
    const ok = gameState.inventory.addItem(drop.itemId, drop.qty || 1);
    if (ok) gameState.quests.onCollect(drop.itemId, drop.qty || 1);
    else gameState.ui.showNotification('Inventario pieno!', 'error');
  } else if (drop.kind === 'potion') {
    p.potions++;
    document.getElementById('potion-count').textContent = p.potions;
    gameState.ui.logCombat('Pozione raccolta', 'loot');
  }
  gameState.renderer.removeEntity(dropId);
  gameState.drops = gameState.drops.filter(d => d.id !== dropId);
}

// ============================================================
// Event Handlers (game logic events from systems)
// ============================================================
function setupEventHandlers() {
  const gs = gameState;

  gs.on('useSkill', ({ index }) => {
    if (index < 3) gs.combat.useSkill(index);
  });

  gs.on('usePotion', () => {
    const p = gs.player;
    if (!p || p.potCd > 0 || p.potions <= 0) return;
    const heal = Math.floor(p.maxHp * 0.5);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    p.potions--;
    p.potCd = 3;
    gs.renderer.spawnHitEffect(p.x, p.y, false);
    gs.renderer.createFloatingText(p.x, p.y, `+${heal} HP`, '#7df58a');
    gs.ui.logCombat(`Pozione usata: +${heal} HP`, '');
  });

  gs.on('equipItem', ({ slotIndex }) => {
    gs.inventory.equipItem(slotIndex);
    gs.ui.renderInventory();
  });

  gs.on('unequipItem', ({ slot }) => {
    gs.inventory.unequipItem(slot);
    gs.ui.renderInventory();
  });

  gs.on('sellItem', ({ slotIndex }) => {
    gs.inventory.sellItem(slotIndex);
    gs.ui.renderInventory();
  });

  gs.on('buyItem', ({ itemId, npcId }) => {
    const item = window.GameData.ITEMS[itemId];
    if (!item) return;
    const p = gs.player;
    if (p.gold < item.value) {
      gs.ui.showNotification('Oro insufficiente!', 'error');
      return;
    }
    const ok = gs.inventory.addItem(itemId, 1);
    if (ok) {
      p.gold -= item.value;
      gs.ui.showNotification(`Acquistato: ${item.name}`, 'success');
    } else {
      gs.ui.showNotification('Inventario pieno!', 'error');
    }
  });

  gs.on('healAtNPC', ({ npcId, cost }) => {
    const p = gs.player;
    if (p.gold < cost) { gs.ui.showNotification('Oro insufficiente!', 'error'); return; }
    p.gold -= cost;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    gs.ui.showNotification('Sei stato guarito!', 'success');
    gs.renderer.spawnLevelUpEffect(p.x, p.y);
  });

  gs.on('restAtInn', ({ cost }) => {
    const p = gs.player;
    if (p.gold < cost) { gs.ui.showNotification('Oro insufficiente!', 'error'); return; }
    p.gold -= cost;
    p.hp = p.maxHp; p.mp = p.maxMp;
    gs.ui.showNotification('Riposato! HP e MP al massimo.', 'success');
  });

  gs.on('requestTurnIn', ({ npcId }) => {
    const p = gs.player;
    const completable = (p.activeQuests || []).filter(q => {
      const def = window.GameData.QUESTS[q.id];
      return def?.npc === npcId && q.objectives?.every(o => o.current >= o.count);
    });
    if (!completable.length) {
      gs.ui.showNotification('Nessuna missione completabile con questo NPC', 'info');
      return;
    }
    completable.forEach(q => gs.quests.completeQuest(q.id, npcId));
  });

  gs.on('enterDungeon', ({ dungeonId }) => {
    gs.dungeon.enterDungeon(dungeonId);
  });

  gs.on('respawn', () => {
    const p = gs.player;
    p.dead = false;
    p.hp = Math.floor(p.maxHp * 0.5);
    p.mp = Math.floor(p.maxMp * 0.5);
    p.x = 1600; p.y = 1600;
    p.target = null;
    p.moveTarget = null;
    p.gold = Math.floor(p.gold * 0.9);
    p.deaths++;
    gs.renderer.updateEntityPosition('player', p.x, p.y, 0, 'idle');
    gs.renderer.setCameraTarget(p.x, p.y);
    gs.ui.hideDeathScreen();
    gs.ui.addSystemMessage('Sei risorto al villaggio (-10% oro)');
  });

  gs.on('questCompleted', ({ questId }) => {
    const def = window.GameData.QUESTS[questId];
    if (def) {
      gs.ui.showNotification(`Missione completata: ${def.name}!`, 'success');
      gs.ui.logCombat(`Missione completata: ${def.name}`, 'levelup');
      gs.renderer.spawnLevelUpEffect(gs.player.x, gs.player.y);
    }
    gs.ui.renderQuestList('active');
  });

  gs.on('entityDied', ({ entity, xp, gold }) => {
    gs.ui.logCombat(`${entity.type?.name || 'Nemico'} sconfitto! +${xp} XP · +${gold} oro`, 'combat');
  });

  gs.on('levelUp', ({ level }) => {
    gs.ui.showNotification(`Livello ${level} raggiunto!`, 'levelup');
    gs.ui.logCombat(`Livello ${level}!`, 'levelup');
    gs.renderer.spawnLevelUpEffect(gs.player.x, gs.player.y);
  });

  gs.on('chatMessage', ({ channel, text }) => {
    // In offline mode, echo back; in online mode, send to server
    // (handled by network.js if present)
  });
}

// ============================================================
// Player Movement Logic
// ============================================================
function updatePlayerMovement(dt) {
  const p = gameState.player;
  if (!p || p.dead) return;

  let dx = 0, dy = 0;

  // WASD input
  if (gameState.keys['w'] || gameState.keys['arrowup']) dy -= 1;
  if (gameState.keys['s'] || gameState.keys['arrowdown']) dy += 1;
  if (gameState.keys['a'] || gameState.keys['arrowleft']) dx -= 1;
  if (gameState.keys['d'] || gameState.keys['arrowright']) dx += 1;

  if (dx || dy) {
    // WASD takes priority over click-to-move
    p.moveTarget = null;
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    p.dir = Math.atan2(dy, dx);
  } else if (p.moveTarget) {
    // Click-to-move
    const tdx = p.moveTarget.x - p.x;
    const tdy = p.moveTarget.y - p.y;
    const dist = Math.hypot(tdx, tdy);
    if (dist < 8) {
      p.moveTarget = null;
    } else {
      dx = tdx / dist;
      dy = tdy / dist;
      p.dir = Math.atan2(dy, dx);
    }
  }

  if (dx || dy) {
    const spd = p.speed;
    p.x = clamp(p.x + dx * spd * dt, 20, 3180);
    p.y = clamp(p.y + dy * spd * dt, 20, 3180);
    p.animState = 'walk';
  } else {
    p.animState = p.atkCd > 0 ? 'attack' : 'idle';
  }

  // Regeneration (faster in village safe zone)
  const inVillage = Math.hypot(p.x - 1600, p.y - 1600) < 280;
  const regenMult = inVillage ? 5 : 1;
  p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.008 * regenMult * dt);
  p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.015 * regenMult * dt);

  // Update renderer
  gameState.renderer.updateEntityPosition('player', p.x, p.y, p.dir, p.animState);
  gameState.renderer.setCameraTarget(p.x, p.y);

  // Check proximity to NPCs for interaction hint
  checkNPCProximity();

  // Check proximity to dungeon entrances
  checkDungeonProximity();

  // Nearby drop pickup (auto-pickup gold when very close)
  checkDropProximity();
}

function checkNPCProximity() {
  const p = gameState.player;
  const INTERACT_RANGE = 80;
  for (const npc of Object.values(window.GameData.NPCS)) {
    if (Math.hypot(npc.x - p.x, npc.y - p.y) < INTERACT_RANGE) {
      gameState.ui._lastNearNPC = npc.id;
      return;
    }
  }
  gameState.ui._lastNearNPC = null;
}

function checkDungeonProximity() {
  const p = gameState.player;
  const ENTER_RANGE = 100;
  for (const dEntry of (window.GameData.MAPS.village.dungeons || [])) {
    if (Math.hypot(dEntry.x - p.x, dEntry.y - p.y) < ENTER_RANGE) {
      if (!gameState._dungeonPromptShown) {
        gameState._dungeonPromptShown = dEntry.id;
        gameState.ui.showDungeonPrompt(dEntry.id);
      }
      return;
    }
  }
  gameState._dungeonPromptShown = null;
}

function checkDropProximity() {
  const p = gameState.player;
  const AUTO_RANGE = 40;
  for (const drop of [...gameState.drops]) {
    if (Math.hypot(drop.x - p.x, drop.y - p.y) < AUTO_RANGE) {
      tryPickupDrop(drop.id);
    }
  }
}

// ============================================================
// Drops Spawner (called from combat system via events)
// ============================================================
let dropIdCounter = 0;

function spawnDrop(x, y, goldRange, dropTable) {
  // Gold drop
  const gold = goldRange[0] + Math.floor(Math.random() * (goldRange[1] - goldRange[0] + 1));
  const goldId = `drop_${++dropIdCounter}`;
  const goldDrop = { id: goldId, x: x + (Math.random() - 0.5) * 40, y: y + (Math.random() - 0.5) * 40, kind: 'gold', amount: gold, life: 30 };
  gameState.drops.push(goldDrop);
  const goldMesh = gameState.renderer.createDropMesh('gold');
  gameState.renderer.addEntity(goldId, goldMesh, { type: 'drop' });
  gameState.renderer.updateEntityPosition(goldId, goldDrop.x, goldDrop.y, 0, 'idle');

  // Item drops
  if (dropTable) {
    for (const entry of dropTable) {
      if (Math.random() < entry.chance) {
        const qty = entry.qty[0] + Math.floor(Math.random() * (entry.qty[1] - entry.qty[0] + 1));
        const id = `drop_${++dropIdCounter}`;
        const drop = { id, x: x + (Math.random() - 0.5) * 50, y: y + (Math.random() - 0.5) * 50, kind: 'item', itemId: entry.item, qty, life: 30 };
        gameState.drops.push(drop);
        const mesh = gameState.renderer.createDropMesh('item');
        gameState.renderer.addEntity(id, mesh, { type: 'drop' });
        gameState.renderer.updateEntityPosition(id, drop.x, drop.y, 0, 'idle');
      }
    }
  }
}
window.spawnDrop = spawnDrop;

// ============================================================
// Main Loop
// ============================================================
let lastTime = 0;
let autoSaveTimer = 0;
const AUTO_SAVE_INTERVAL = 60; // seconds

function mainLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (!gameState.running || gameState.paused) {
    requestAnimationFrame(mainLoop);
    return;
  }

  gameState.time += dt;
  autoSaveTimer += dt;

  // Update systems
  if (!gameState.player?.dead) {
    updatePlayerMovement(dt);
    gameState.combat.tick(dt);
    gameState.monsterAI.tick(dt);
  }

  // Drop lifetimes
  for (const d of gameState.drops) {
    d.life -= dt;
    if (d.life <= 0) {
      gameState.renderer.removeEntity(d.id);
    }
  }
  gameState.drops = gameState.drops.filter(d => d.life > 0);

  // Update HUD
  gameState.ui.updateHUD();
  gameState.ui.updateMinimap(gameState.player.x, gameState.player.y, gameState);

  // Auto-save
  if (autoSaveTimer >= AUTO_SAVE_INTERVAL) {
    autoSaveTimer = 0;
    gameState.saveSystem.save();
  }

  // Render scene
  gameState.renderer.render(dt);

  requestAnimationFrame(mainLoop);
}

// ============================================================
// Game Initialization Entry Point
// ============================================================
function startGame(classKey, playerName, savedState) {
  // Create player
  gameState.player = createPlayer(classKey, playerName);

  // Apply saved state if resuming
  if (savedState) {
    Object.assign(gameState.player, savedState);
  }

  // Initialize all systems
  gameState.combat = new window.CombatSystem(gameState);
  gameState.monsterAI = new window.MonsterAI(gameState);
  gameState.inventory = new window.InventorySystem(gameState);
  gameState.quests = new window.QuestSystem(gameState);
  gameState.dungeon = new window.DungeonSystem(gameState);
  gameState.saveSystem = new window.SaveSystem(gameState);

  // Setup event handlers
  setupEventHandlers();

  // Setup input
  setupInput();

  // Build UI
  gameState.ui.buildSkillBar(classKey);
  gameState.ui.addSystemMessage(`Benvenuto a Pietrascura, ${playerName}! Parla con Elara per le missioni.`);

  // Build world
  initWorld();

  // Place player mesh in scene
  const playerMesh = gameState.renderer.createPlayerMesh(gameState.player);
  gameState.renderer.addEntity('player', playerMesh, { type: 'player' });
  gameState.renderer.updateEntityPosition('player', gameState.player.x, gameState.player.y, 0, 'idle');
  gameState.renderer.setCameraTarget(gameState.player.x, gameState.player.y);

  // Start loop
  gameState.running = true;
  lastTime = performance.now();
  requestAnimationFrame(mainLoop);
}

// ============================================================
// Bootstrap: called from game.html
// ============================================================
window.bootstrapGame = function(canvas) {
  // Initialize renderer first (needs canvas)
  gameState.renderer = new window.GameRenderer(canvas);
  gameState.ui = new window.UIManager(gameState);
  window.addEventListener('resize', () => gameState.renderer.resize());

  // Check for existing save
  const save = window.SaveSystem ? null : null; // SaveSystem not constructed yet
  const savedRaw = localStorage.getItem('ro_save');

  if (savedRaw) {
    try {
      const saved = JSON.parse(savedRaw);
      // Show "continue" option (handled in index.html)
      window._savedGame = saved;
    } catch (_) {}
  }

  // Read from URL params (passed from character select)
  const params = new URLSearchParams(window.location.search);
  const classKey = params.get('class') || 'guerriero';
  const name = decodeURIComponent(params.get('name') || 'Avventuriero');
  const resume = params.get('resume') === '1';

  const savedState = (resume && window._savedGame) ? window._savedGame.player : null;
  startGame(classKey, name, savedState);
};

// Utility
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
window.clamp = clamp;
window.gameState = gameState;
