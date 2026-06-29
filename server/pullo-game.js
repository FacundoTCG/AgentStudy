// pullo-game.js — Pullo.io Clone: card pack platform server
'use strict';

const PACK_DEFS = {
  great:  { id: 'great',  name: 'GreatPullo',   price: 25,  cards: 5,  game: 'pokemon',     rarityBoost: 1.0 },
  arcane: { id: 'arcane', name: 'Arcane Tin',    price: 25,  cards: 5,  game: 'magic',       rarityBoost: 1.0 },
  mera:   { id: 'mera',   name: 'MeraPullo',     price: 50,  cards: 8,  game: 'onepiece',    rarityBoost: 1.6 },
  ultra:  { id: 'ultra',  name: 'UltraPullo',    price: 50,  cards: 8,  game: 'dragonball',  rarityBoost: 1.6 },
  master: { id: 'master', name: 'MasterPullo',   price: 100, cards: 12, game: 'pokemon',     rarityBoost: 2.2, guaranteeRare: true },
  dream:  { id: 'dream',  name: 'DreamPullo',    price: 250, cards: 20, game: 'all',         rarityBoost: 3.5, guaranteeUltra: true },
};

const CARDS = {
  pokemon: [
    { id:'pk01', name:'Ignitar',         type:'fire',     rarity:'common',   value:0.5  },
    { id:'pk02', name:'Aquafin',         type:'water',    rarity:'common',   value:0.5  },
    { id:'pk03', name:'Voltail',         type:'electric', rarity:'common',   value:0.6  },
    { id:'pk04', name:'Leafling',        type:'grass',    rarity:'common',   value:0.5  },
    { id:'pk05', name:'Stonewing',       type:'normal',   rarity:'common',   value:0.4  },
    { id:'pk06', name:'Psyshade',        type:'psychic',  rarity:'common',   value:0.7  },
    { id:'pk07', name:'Darkfang',        type:'dark',     rarity:'uncommon', value:1.5  },
    { id:'pk08', name:'Fernus',          type:'fire',     rarity:'uncommon', value:2.0  },
    { id:'pk09', name:'Crystaleon',      type:'psychic',  rarity:'uncommon', value:2.5  },
    { id:'pk10', name:'Glacistream',     type:'water',    rarity:'uncommon', value:2.0  },
    { id:'pk11', name:'Metallix',        type:'metal',    rarity:'uncommon', value:1.8  },
    { id:'pk12', name:'Drakemor',        type:'dragon',   rarity:'rare',     value:8.0  },
    { id:'pk13', name:'Aeonian',         type:'psychic',  rarity:'rare',     value:9.0  },
    { id:'pk14', name:'Stormjaw',        type:'electric', rarity:'rare',     value:7.5  },
    { id:'pk15', name:'Blazecore',       type:'fire',     rarity:'rare',     value:10.0 },
    { id:'pk16', name:'Voltempest EX',   type:'electric', rarity:'ultra',    value:35.0 },
    { id:'pk17', name:'Emberfury EX',    type:'fire',     rarity:'ultra',    value:42.0 },
    { id:'pk18', name:'Psiclone V',      type:'psychic',  rarity:'ultra',    value:50.0 },
    { id:'pk19', name:'Dragonlord VMAX', type:'dragon',   rarity:'secret',   value:120.0 },
    { id:'pk20', name:'Aeonian Prime',   type:'psychic',  rarity:'secret',   value:180.0 },
  ],
  onepiece: [
    { id:'op01', name:'Cutlass Rookie',      type:'sword',  rarity:'common',   value:0.5  },
    { id:'op02', name:'Marine Ensign',       type:'marine', rarity:'common',   value:0.5  },
    { id:'op03', name:'Cannonball Brute',    type:'pirate', rarity:'common',   value:0.6  },
    { id:'op04', name:'Navigator Scout',     type:'pirate', rarity:'common',   value:0.4  },
    { id:'op05', name:'Tidal Witch',         type:'fruit',  rarity:'uncommon', value:1.8  },
    { id:'op06', name:'Thunder Knuckle',     type:'haki',   rarity:'uncommon', value:2.2  },
    { id:'op07', name:'Warlord\'s Blade',    type:'sword',  rarity:'rare',     value:9.0  },
    { id:'op08', name:'Shadow Devil Fruit',  type:'fruit',  rarity:'rare',     value:11.0 },
    { id:'op09', name:'Admiral Surge',       type:'marine', rarity:'ultra',    value:40.0 },
    { id:'op10', name:'Emperor\'s Haki',     type:'haki',   rarity:'ultra',    value:55.0 },
    { id:'op11', name:'King of Pirates',     type:'pirate', rarity:'secret',   value:150.0 },
  ],
  magic: [
    { id:'mg01', name:'Forest Sprite',       type:'forest', rarity:'common',   value:0.3  },
    { id:'mg02', name:'Mountain Golem',      type:'fire',   rarity:'common',   value:0.4  },
    { id:'mg03', name:'Island Merfolk',      type:'water',  rarity:'common',   value:0.5  },
    { id:'mg04', name:'Plains Paladin',      type:'plains', rarity:'common',   value:0.4  },
    { id:'mg05', name:'Swamp Wraith',        type:'swamp',  rarity:'uncommon', value:2.0  },
    { id:'mg06', name:'Sea Witch',           type:'water',  rarity:'uncommon', value:2.5  },
    { id:'mg07', name:'Lightning Strike',    type:'fire',   rarity:'rare',     value:8.0  },
    { id:'mg08', name:'Arcane Dragon',       type:'multi',  rarity:'rare',     value:12.0 },
    { id:'mg09', name:'Planeswalker\'s Call',type:'multi',  rarity:'ultra',    value:45.0 },
    { id:'mg10', name:'Eternal Dragon',      type:'multi',  rarity:'secret',   value:160.0 },
  ],
  dragonball: [
    { id:'db01', name:'Namekian Warrior',    type:'namekian',rarity:'common',   value:0.5  },
    { id:'db02', name:'Earthling Fighter',   type:'saiyan', rarity:'common',   value:0.5  },
    { id:'db03', name:'Saiyan Soldier',      type:'saiyan', rarity:'uncommon', value:2.0  },
    { id:'db04', name:'Android Unit',        type:'android',rarity:'uncommon', value:1.8  },
    { id:'db05', name:'Super Saiyan Rising', type:'saiyan', rarity:'rare',     value:9.0  },
    { id:'db06', name:'Frieza\'s Fury',      type:'frieza', rarity:'rare',     value:10.0 },
    { id:'db07', name:'God of Destruction',  type:'god',    rarity:'ultra',    value:48.0 },
    { id:'db08', name:'Ultra Instinct',      type:'ultra',  rarity:'secret',   value:200.0 },
  ],
};

// Rarity weights (base)
const RARITY_WEIGHTS = { common: 62, uncommon: 22, rare: 11, ultra: 4, secret: 1 };

function weightedRarity(boost) {
  const w = {
    common:   Math.max(5,  RARITY_WEIGHTS.common   - (boost - 1) * 18),
    uncommon: RARITY_WEIGHTS.uncommon + (boost - 1) * 6,
    rare:     RARITY_WEIGHTS.rare     + (boost - 1) * 8,
    ultra:    RARITY_WEIGHTS.ultra    + (boost - 1) * 3.5,
    secret:   RARITY_WEIGHTS.secret   + (boost - 1) * 0.5,
  };
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [rarity, weight] of Object.entries(w)) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return 'common';
}

function pickCard(pool, rarity) {
  const available = pool.filter(c => c.rarity === rarity);
  if (!available.length) {
    // Fallback to any rarity in pool
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

function generatePack(packId) {
  const def = PACK_DEFS[packId];
  if (!def) return null;

  const games = def.game === 'all' ? Object.keys(CARDS) : [def.game];
  const pool = games.flatMap(g => CARDS[g]);

  const result = [];
  let hasRare = false, hasUltra = false;

  for (let i = 0; i < def.cards; i++) {
    let rarity = weightedRarity(def.rarityBoost);

    // Guarantees on last card
    if (i === def.cards - 1) {
      if (def.guaranteeUltra && !hasUltra) rarity = 'ultra';
      else if (def.guaranteeRare && !hasRare) rarity = 'rare';
    }

    if (rarity === 'rare' || rarity === 'ultra' || rarity === 'secret') hasRare = true;
    if (rarity === 'ultra' || rarity === 'secret') hasUltra = true;

    const card = pickCard(pool, rarity);
    const game = games.find(g => CARDS[g].some(c => c.id === card.id)) || games[0];
    result.push({ ...card, game, uid: `${card.id}_${Date.now()}_${i}` });
  }

  return result;
}

// ─── Socket.io Live Feed ─────────────────────────────────────────
function setupPulloGame(io) {
  const ns = io.of('/pullo');

  // Recent pulls for new connections
  const recentPulls = [];
  const MAX_RECENT = 40;

  ns.on('connection', (socket) => {
    // Send recent pulls on connect
    socket.emit('recentPulls', recentPulls.slice().reverse());

    // Client opens a pack: validate & generate server-side, broadcast to feed
    socket.on('openPack', ({ packId, playerName }) => {
      const def = PACK_DEFS[packId];
      if (!def) return socket.emit('packError', { error: 'Invalid pack' });
      if (!playerName || typeof playerName !== 'string') return;

      const name = playerName.slice(0, 16).replace(/[<>]/g, '');
      const cards = generatePack(packId);
      if (!cards) return;

      // Send result to requester
      socket.emit('packResult', { packId, cards });

      // Broadcast best card to live feed
      const best = cards.slice().sort((a, b) => {
        const order = { secret: 4, ultra: 3, rare: 2, uncommon: 1, common: 0 };
        return (order[b.rarity] || 0) - (order[a.rarity] || 0);
      })[0];

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

      ns.emit('livePull', entry);
    });
  });

  console.log('[Pullo] Card platform server ready on /pullo');
}

module.exports = { setupPulloGame, PACK_DEFS, CARDS, generatePack };
