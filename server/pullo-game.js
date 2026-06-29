'use strict';

// ─── Pack Definitions ────────────────────────────────────────────────────────
const PACK_DEFS = {
  great:    { id: 'great',    name: 'GreatPullo',    price: 25,  cards: 5,  game: 'pokemon',    rarityBoost: 1.0 },
  arcane:   { id: 'arcane',   name: 'Arcane Tin',    price: 25,  cards: 5,  game: 'magic',      rarityBoost: 1.0 },
  mera:     { id: 'mera',     name: 'MeraPullo',     price: 50,  cards: 8,  game: 'onepiece',   rarityBoost: 1.6 },
  ultra:    { id: 'ultra',    name: 'UltraPullo',    price: 50,  cards: 8,  game: 'dragonball', rarityBoost: 1.6 },
  football: { id: 'football', name: 'FootballPullo', price: 25,  cards: 6,  game: 'football',   rarityBoost: 1.0 },
  master:   { id: 'master',   name: 'MasterPullo',   price: 100, cards: 12, game: 'pokemon',    rarityBoost: 2.2, guaranteeRare: true },
  dream:    { id: 'dream',    name: 'DreamPullo',    price: 250, cards: 20, game: 'all',        rarityBoost: 3.5, guaranteeUltra: true },
};

// ─── Card Database ───────────────────────────────────────────────────────────
const CARDS = {
  pokemon: [
    // Common (10)
    { id: 'pk01', name: 'Ignitar',           type: 'fire',     rarity: 'common',   value: 0.50 },
    { id: 'pk02', name: 'Aquafin',           type: 'water',    rarity: 'common',   value: 0.50 },
    { id: 'pk03', name: 'Voltail',           type: 'electric', rarity: 'common',   value: 0.60 },
    { id: 'pk04', name: 'Leafling',          type: 'grass',    rarity: 'common',   value: 0.50 },
    { id: 'pk05', name: 'Stonewing',         type: 'normal',   rarity: 'common',   value: 0.40 },
    { id: 'pk06', name: 'Psyshade',          type: 'psychic',  rarity: 'common',   value: 0.70 },
    { id: 'pk07', name: 'Fairydust',         type: 'fairy',    rarity: 'common',   value: 0.55 },
    { id: 'pk08', name: 'Mudpuddle',         type: 'water',    rarity: 'common',   value: 0.45 },
    { id: 'pk09', name: 'Sparklette',        type: 'electric', rarity: 'common',   value: 0.50 },
    { id: 'pk10', name: 'Rootpaw',           type: 'grass',    rarity: 'common',   value: 0.40 },
    // Uncommon (7)
    { id: 'pk11', name: 'Darkfang',          type: 'dark',     rarity: 'uncommon', value: 1.50 },
    { id: 'pk12', name: 'Fernus',            type: 'fire',     rarity: 'uncommon', value: 2.00 },
    { id: 'pk13', name: 'Crystaleon',        type: 'psychic',  rarity: 'uncommon', value: 2.50 },
    { id: 'pk14', name: 'Glacistream',       type: 'water',    rarity: 'uncommon', value: 2.00 },
    { id: 'pk15', name: 'Metallix',          type: 'metal',    rarity: 'uncommon', value: 1.80 },
    { id: 'pk16', name: 'Spirafrost',        type: 'fairy',    rarity: 'uncommon', value: 2.20 },
    { id: 'pk17', name: 'Shadowing',         type: 'dark',     rarity: 'uncommon', value: 1.60 },
    // Rare (4)
    { id: 'pk18', name: 'Drakemor',          type: 'dragon',   rarity: 'rare',     value: 8.00 },
    { id: 'pk19', name: 'Aeonian',           type: 'psychic',  rarity: 'rare',     value: 9.00 },
    { id: 'pk20', name: 'Stormjaw',          type: 'electric', rarity: 'rare',     value: 7.50 },
    { id: 'pk21', name: 'Blazecore',         type: 'fire',     rarity: 'rare',     value: 10.00 },
    // Ultra (3)
    { id: 'pk22', name: 'Voltempest EX',     type: 'electric', rarity: 'ultra',    value: 35.00 },
    { id: 'pk23', name: 'Emberfury EX',      type: 'fire',     rarity: 'ultra',    value: 42.00 },
    { id: 'pk24', name: 'Psiclone V',        type: 'psychic',  rarity: 'ultra',    value: 50.00 },
    // Secret (2)
    { id: 'pk25', name: 'Dragonlord VMAX',   type: 'dragon',   rarity: 'secret',   value: 120.00 },
    { id: 'pk26', name: 'Aeonian Prime',     type: 'psychic',  rarity: 'secret',   value: 180.00 },
  ],

  onepiece: [
    // Common (5)
    { id: 'op01', name: 'Cutlass Rookie',       type: 'sword',  rarity: 'common',   value: 0.50 },
    { id: 'op02', name: 'Marine Ensign',        type: 'marine', rarity: 'common',   value: 0.50 },
    { id: 'op03', name: 'Cannonball Brute',     type: 'pirate', rarity: 'common',   value: 0.60 },
    { id: 'op04', name: 'Navigator Scout',      type: 'pirate', rarity: 'common',   value: 0.40 },
    { id: 'op05', name: 'Deckhand Brawler',     type: 'pirate', rarity: 'common',   value: 0.45 },
    // Uncommon (5)
    { id: 'op06', name: 'Tidal Witch',          type: 'fruit',  rarity: 'uncommon', value: 1.80 },
    { id: 'op07', name: 'Thunder Knuckle',      type: 'haki',   rarity: 'uncommon', value: 2.20 },
    { id: 'op08', name: 'Sea Sergeant',         type: 'marine', rarity: 'uncommon', value: 1.90 },
    { id: 'op09', name: 'Cursed Blade',         type: 'sword',  rarity: 'uncommon', value: 2.00 },
    { id: 'op10', name: 'Flame Fruit User',     type: 'fruit',  rarity: 'uncommon', value: 2.50 },
    // Rare (3)
    { id: 'op11', name: "Warlord's Blade",      type: 'sword',  rarity: 'rare',     value: 9.00 },
    { id: 'op12', name: 'Shadow Devil Fruit',   type: 'fruit',  rarity: 'rare',     value: 11.00 },
    { id: 'op13', name: 'Iron Will Haki',       type: 'haki',   rarity: 'rare',     value: 8.50 },
    // Ultra (2)
    { id: 'op14', name: 'Admiral Surge',        type: 'marine', rarity: 'ultra',    value: 40.00 },
    { id: 'op15', name: "Emperor's Haki",       type: 'haki',   rarity: 'ultra',    value: 55.00 },
    // Secret (2)
    { id: 'op16', name: 'King of Pirates',      type: 'pirate', rarity: 'secret',   value: 150.00 },
    { id: 'op17', name: 'Conqueror of the Sea', type: 'haki',   rarity: 'secret',   value: 200.00 },
  ],

  magic: [
    // Common (5)
    { id: 'mg01', name: 'Forest Sprite',        type: 'forest', rarity: 'common',   value: 0.30 },
    { id: 'mg02', name: 'Mountain Golem',       type: 'fire',   rarity: 'common',   value: 0.40 },
    { id: 'mg03', name: 'Island Merfolk',       type: 'water',  rarity: 'common',   value: 0.50 },
    { id: 'mg04', name: 'Plains Paladin',       type: 'plains', rarity: 'common',   value: 0.40 },
    { id: 'mg05', name: 'Swamp Skeleton',       type: 'swamp',  rarity: 'common',   value: 0.35 },
    // Uncommon (5)
    { id: 'mg06', name: 'Swamp Wraith',         type: 'swamp',  rarity: 'uncommon', value: 2.00 },
    { id: 'mg07', name: 'Sea Witch',            type: 'water',  rarity: 'uncommon', value: 2.50 },
    { id: 'mg08', name: 'Lava Elemental',       type: 'fire',   rarity: 'uncommon', value: 2.20 },
    { id: 'mg09', name: 'Dryad Ranger',         type: 'forest', rarity: 'uncommon', value: 1.80 },
    { id: 'mg10', name: 'Runed Crusader',       type: 'plains', rarity: 'uncommon', value: 2.10 },
    // Rare (3)
    { id: 'mg11', name: 'Lightning Strike',     type: 'fire',   rarity: 'rare',     value: 8.00 },
    { id: 'mg12', name: 'Arcane Dragon',        type: 'multi',  rarity: 'rare',     value: 12.00 },
    { id: 'mg13', name: 'Void Reaper',          type: 'swamp',  rarity: 'rare',     value: 9.50 },
    // Ultra (2)
    { id: 'mg14', name: "Planeswalker's Call",  type: 'multi',  rarity: 'ultra',    value: 45.00 },
    { id: 'mg15', name: 'Chromatic Titan',      type: 'multi',  rarity: 'ultra',    value: 38.00 },
    // Secret (2)
    { id: 'mg16', name: 'Eternal Dragon',       type: 'multi',  rarity: 'secret',   value: 160.00 },
    { id: 'mg17', name: 'The All-Seeing Eye',   type: 'multi',  rarity: 'secret',   value: 220.00 },
  ],

  dragonball: [
    // Common (4)
    { id: 'db01', name: 'Namekian Warrior',     type: 'namekian', rarity: 'common',   value: 0.50 },
    { id: 'db02', name: 'Earthling Fighter',    type: 'saiyan',   rarity: 'common',   value: 0.50 },
    { id: 'db03', name: 'Frieza Soldier',       type: 'frieza',   rarity: 'common',   value: 0.45 },
    { id: 'db04', name: 'Android Scout',        type: 'android',  rarity: 'common',   value: 0.55 },
    // Uncommon (4)
    { id: 'db05', name: 'Saiyan Soldier',       type: 'saiyan',   rarity: 'uncommon', value: 2.00 },
    { id: 'db06', name: 'Android Unit',         type: 'android',  rarity: 'uncommon', value: 1.80 },
    { id: 'db07', name: 'Namekian Elder',       type: 'namekian', rarity: 'uncommon', value: 2.10 },
    { id: 'db08', name: 'Frieza\'s Elite',      type: 'frieza',   rarity: 'uncommon', value: 1.90 },
    // Rare (2)
    { id: 'db09', name: 'Super Saiyan Rising',  type: 'saiyan',   rarity: 'rare',     value: 9.00 },
    { id: 'db10', name: 'Frieza\'s Fury',       type: 'frieza',   rarity: 'rare',     value: 10.00 },
    // Ultra (2)
    { id: 'db11', name: 'God of Destruction',   type: 'god',      rarity: 'ultra',    value: 48.00 },
    { id: 'db12', name: 'Super Saiyan Blue',    type: 'god',      rarity: 'ultra',    value: 52.00 },
    // Secret (2)
    { id: 'db13', name: 'Ultra Instinct',       type: 'ultra',    rarity: 'secret',   value: 200.00 },
    { id: 'db14', name: 'Mastered Ultra Ego',   type: 'ultra',    rarity: 'secret',   value: 175.00 },
  ],

  football: [
    // Common (4)
    { id: 'fb01', name: 'Marco Striketti',      type: 'attack',     rarity: 'common',   value: 0.50 },
    { id: 'fb02', name: 'Luca Defendini',       type: 'defense',    rarity: 'common',   value: 0.50 },
    { id: 'fb03', name: 'Carlo Terzinori',      type: 'defense',    rarity: 'common',   value: 0.45 },
    { id: 'fb04', name: 'Piero Centrocampi',    type: 'attack',     rarity: 'common',   value: 0.40 },
    // Uncommon (4)
    { id: 'fb05', name: 'Enzo Portacci',        type: 'goalkeeper', rarity: 'uncommon', value: 2.00 },
    { id: 'fb06', name: 'Sergio Rapidini',      type: 'attack',     rarity: 'uncommon', value: 1.80 },
    { id: 'fb07', name: 'Bruno Muragli',        type: 'defense',    rarity: 'uncommon', value: 1.70 },
    { id: 'fb08', name: 'Matteo Volante',       type: 'attack',     rarity: 'uncommon', value: 2.10 },
    // Rare (2)
    { id: 'fb09', name: 'Gianluca Reteoro',     type: 'attack',     rarity: 'rare',     value: 8.00 },
    { id: 'fb10', name: 'Roberto Paratutti',    type: 'goalkeeper', rarity: 'rare',     value: 9.00 },
    // Gold / Icon (2)
    { id: 'fb11', name: 'Silvio Goleador',      type: 'gold',       rarity: 'ultra',    value: 38.00 },
    { id: 'fb12', name: 'Diego Fantasma',       type: 'gold',       rarity: 'ultra',    value: 42.00 },
    // Legend / Secret (2)
    { id: 'fb13', name: 'Il Fenomeno Rossetti', type: 'legend',     rarity: 'secret',   value: 130.00 },
    { id: 'fb14', name: 'La Pulce Dorata',      type: 'icon',       rarity: 'secret',   value: 160.00 },
  ],
};

// ─── Rarity System ───────────────────────────────────────────────────────────
// Base weights: common 62%, uncommon 22%, rare 10%, ultra 4.5%, secret 1.5%
const BASE_WEIGHTS = { common: 62, uncommon: 22, rare: 10, ultra: 4.5, secret: 1.5 };
const RARITY_ORDER = { secret: 4, ultra: 3, rare: 2, uncommon: 1, common: 0 };

/**
 * Pick a rarity at random, applying rarityBoost to shift weight toward rarer cards.
 * @param {number} boost - multiplier (1.0 = no boost)
 * @returns {string} rarity key
 */
function weightedRarity(boost) {
  const b = boost - 1; // delta above baseline
  const w = {
    common:   Math.max(5,  BASE_WEIGHTS.common   - b * 18),
    uncommon: BASE_WEIGHTS.uncommon + b * 6,
    rare:     BASE_WEIGHTS.rare     + b * 8,
    ultra:    BASE_WEIGHTS.ultra    + b * 3.5,
    secret:   BASE_WEIGHTS.secret   + b * 0.5,
  };
  const total = Object.values(w).reduce((a, v) => a + v, 0);
  let r = Math.random() * total;
  for (const [rarity, weight] of Object.entries(w)) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return 'common';
}

/**
 * Pick a random card matching the given rarity from the pool.
 * Falls back to any card in the pool if no match exists.
 * @param {Array} pool
 * @param {string} rarity
 * @returns {object} card
 */
function pickCard(pool, rarity) {
  const available = pool.filter(c => c.rarity === rarity);
  if (!available.length) return pool[Math.floor(Math.random() * pool.length)];
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Generate a full pack of cards for the given packId.
 * @param {string} packId
 * @returns {Array|null} array of card objects, or null on invalid packId
 */
function generatePack(packId) {
  const def = PACK_DEFS[packId];
  if (!def) return null;

  const games = def.game === 'all' ? Object.keys(CARDS) : [def.game];
  const pool = games.flatMap(g => CARDS[g]);

  const result = [];
  let hasRare = false;
  let hasUltra = false;

  for (let i = 0; i < def.cards; i++) {
    let rarity = weightedRarity(def.rarityBoost);

    // Apply guarantees on the last card slot if not yet met
    if (i === def.cards - 1) {
      if (def.guaranteeUltra && !hasUltra) rarity = Math.random() < 0.5 ? 'ultra' : 'secret';
      else if (def.guaranteeRare && !hasRare) rarity = 'rare';
    }

    if (RARITY_ORDER[rarity] >= RARITY_ORDER.rare)  hasRare  = true;
    if (RARITY_ORDER[rarity] >= RARITY_ORDER.ultra) hasUltra = true;

    const card = pickCard(pool, rarity);
    const game = games.find(g => CARDS[g].some(c => c.id === card.id)) || games[0];

    result.push({
      ...card,
      game,
      uid: `${card.id}_${Date.now()}_${i}`,
    });
  }

  return result;
}

// ─── Promo Code Registry ──────────────────────────────────────────────────────
const PROMO_CODES = {
  FIRST: { discount: 0.10, description: '10% off your first purchase', oneTime: true },
};

// In-memory tracker for used one-time codes per player (playerName → Set of codes)
const usedPromoCodes = new Map();

/**
 * Validate a promo code for a given player and pack.
 * Returns { valid, discount, message }.
 */
function validatePromo(code, packId, playerName) {
  if (!code || typeof code !== 'string') {
    return { valid: false, discount: 0, message: 'No promo code provided.' };
  }

  const upper = code.trim().toUpperCase();
  const promo = PROMO_CODES[upper];

  if (!promo) {
    return { valid: false, discount: 0, message: 'Promo code not recognized.' };
  }

  if (!PACK_DEFS[packId]) {
    return { valid: false, discount: 0, message: 'Invalid pack selected.' };
  }

  if (promo.oneTime) {
    const key = (playerName || '').toLowerCase().trim();
    const used = usedPromoCodes.get(key) || new Set();
    if (used.has(upper)) {
      return { valid: false, discount: 0, message: `Promo code ${upper} already used.` };
    }
    // Mark as used
    used.add(upper);
    usedPromoCodes.set(key, used);
  }

  return {
    valid: true,
    discount: promo.discount,
    message: `Promo code ${upper} applied: ${promo.description}.`,
  };
}

// ─── Setup Function ──────────────────────────────────────────────────────────
/**
 * Attach the Pullo card platform to the Socket.io server and Express app.
 * @param {import('socket.io').Server} io
 * @param {import('express').Application} app
 */
function setupPulloGame(io, app) {
  // ── REST endpoint: promo code validation ──────────────────────────────────
  if (app) {
    app.post('/api/pullo/validate-promo', (req, res) => {
      const { code, packId, playerName } = req.body || {};
      const result = validatePromo(code, packId, playerName);
      res.json(result);
    });
    console.log('[Pullo] REST route ready: POST /api/pullo/validate-promo');
  }

  // ── Socket.io namespace /pullo ─────────────────────────────────────────────
  const ns = io.of('/pullo');
  const recentPulls = [];
  const MAX_RECENT = 40;

  ns.on('connection', (socket) => {
    // Send current live feed to newly connected client
    socket.on('recentPulls', () => {
      socket.emit('recentPulls', recentPulls.slice().reverse());
    });

    // Also push on connect without waiting for the client event
    socket.emit('recentPulls', recentPulls.slice().reverse());

    // Client requests to open a pack
    socket.on('openPack', ({ packId, playerName } = {}) => {
      const def = PACK_DEFS[packId];
      if (!def) {
        return socket.emit('packError', { error: 'Invalid pack ID.' });
      }
      if (!playerName || typeof playerName !== 'string') {
        return socket.emit('packError', { error: 'Invalid player name.' });
      }

      const name = playerName.slice(0, 24).replace(/[<>"'&]/g, '');
      const cards = generatePack(packId);
      if (!cards) {
        return socket.emit('packError', { error: 'Pack generation failed.' });
      }

      // Send full result to the requesting socket
      socket.emit('packResult', { packId, packName: def.name, cards });

      // Determine the best card to broadcast on the live feed
      const best = cards.slice().sort(
        (a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0)
      )[0];

      const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        playerName: name,
        packId,
        packName: def.name,
        bestCard: best,
        cardCount: cards.length,
        ts: Date.now(),
      };

      recentPulls.push(entry);
      if (recentPulls.length > MAX_RECENT) recentPulls.shift();

      // Broadcast the best pull to everyone in the namespace
      ns.emit('livePull', entry);
    });
  });

  console.log('[Pullo] Card platform server ready on /pullo namespace');
}

module.exports = { setupPulloGame, PACK_DEFS, CARDS, generatePack, validatePromo };
