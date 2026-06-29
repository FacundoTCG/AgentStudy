// pullo-client.js — Pullo.io Clone Client
'use strict';

// ─── Card data (mirrors server) ─────────────────────────────────
const GAMES = {
  pokemon:     { name: 'Pokémon TCG',         icon: '⚡', color: '#FFCB05' },
  onepiece:    { name: 'One Piece',            icon: '☠️', color: '#E8171F' },
  magic:       { name: 'Magic: The Gathering', icon: '✦',  color: '#9333ea' },
  dragonball:  { name: 'Dragon Ball Super',    icon: '🐉', color: '#FF6B35' },
};

const RARITY_META = {
  common:   { label: 'Common',      stars: '',    color: '#9ca3af', glow: '#9ca3af' },
  uncommon: { label: 'Uncommon',    stars: '★',   color: '#10b981', glow: '#10b981' },
  rare:     { label: 'Rare',        stars: '★★',  color: '#60a5fa', glow: '#3b82f6' },
  ultra:    { label: 'Ultra Rare',  stars: '★★★', color: '#fbbf24', glow: '#f59e0b' },
  secret:   { label: 'Secret Rare', stars: '✦✦✦', color: '#e879f9', glow: '#d946ef' },
};

const TYPE_ICONS = {
  fire:'🔥', water:'💧', electric:'⚡', grass:'🌿', psychic:'🔮',
  dragon:'🐉', dark:'🌑', metal:'⚙️', normal:'⭐', fairy:'✨',
  sword:'⚔️', fruit:'🍎', haki:'💫', marine:'⚓', pirate:'☠️',
  forest:'🌲', plains:'☀️', swamp:'💀', multi:'🌈',
  saiyan:'⚡', namekian:'🌿', frieza:'❄️', android:'🤖', god:'🌟', ultra:'✨',
};

const PACK_DEFS = {
  great:  { id:'great',  name:'GreatPullo',   price:25,  cards:5,  game:'pokemon',     icon:'📦', rarityBoost:1.0 },
  arcane: { id:'arcane', name:'Arcane Tin',   price:25,  cards:5,  game:'magic',       icon:'🗂️', rarityBoost:1.0 },
  mera:   { id:'mera',   name:'MeraPullo',    price:50,  cards:8,  game:'onepiece',    icon:'📫', rarityBoost:1.6 },
  ultra:  { id:'ultra',  name:'UltraPullo',   price:50,  cards:8,  game:'dragonball',  icon:'🌠', rarityBoost:1.6 },
  master: { id:'master', name:'MasterPullo',  price:100, cards:12, game:'pokemon',     icon:'🏆', rarityBoost:2.2, guaranteeRare:true },
  dream:  { id:'dream',  name:'DreamPullo',   price:250, cards:20, game:'all',         icon:'💎', rarityBoost:3.5, guaranteeUltra:true },
};

const ODDS = { // approximate display %
  great:  { common:'62%', uncommon:'22%', rare:'10%', ultra:'5%', secret:'1%' },
  arcane: { common:'62%', uncommon:'22%', rare:'10%', ultra:'5%', secret:'1%' },
  mera:   { common:'50%', uncommon:'26%', rare:'16%', ultra:'7%', secret:'1%' },
  ultra:  { common:'50%', uncommon:'26%', rare:'16%', ultra:'7%', secret:'1%' },
  master: { common:'35%', uncommon:'28%', rare:'24%', ultra:'11%', secret:'2%' },
  dream:  { common:'15%', uncommon:'25%', rare:'32%', ultra:'22%', secret:'6%' },
};

// ─── App State ──────────────────────────────────────────────────
let socket = null;
let playerName = localStorage.getItem('pullo_name') || '';
let credits = parseInt(localStorage.getItem('pullo_credits') || '500', 10);
let vault = JSON.parse(localStorage.getItem('pullo_vault') || '[]');
let vaultFilter = 'all';
let currentPack = null;
let pendingCards = [];
let revealedCount = 0;

// ─── DOM Refs ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderShop();
  renderVault();
  updateCredits();
  connectSocket();

  // Nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // Opening overlay close
  $('btn-close-opening').addEventListener('click', closeOpening);
});

// ─── Socket ──────────────────────────────────────────────────────
function connectSocket() {
  socket = io('/pullo', { transports: ['websocket', 'polling'] });

  socket.on('recentPulls', pulls => {
    for (const pull of pulls) appendFeedItem(pull, false);
  });

  socket.on('livePull', pull => {
    appendFeedItem(pull, true);
  });

  socket.on('packResult', ({ packId, cards }) => {
    startReveal(packId, cards);
  });

  socket.on('packError', ({ error }) => {
    toast(error, 'error');
  });
}

// ─── Views ───────────────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const view = $(`view-${id}`);
  const btn = document.querySelector(`[data-view="${id}"]`);
  if (view) view.classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'vault') renderVault();
}

// ─── Shop ────────────────────────────────────────────────────────
function renderShop() {
  const grid = $('pack-grid');
  grid.innerHTML = '';

  for (const def of Object.values(PACK_DEFS)) {
    const game = GAMES[def.game] || GAMES.pokemon;
    const card = document.createElement('div');
    card.className = `pack-card game-${def.game}`;
    card.innerHTML = `
      <div class="pack-art" style="font-size:4rem">${def.icon}</div>
      <div class="pack-info">
        <div class="pack-game-tag">${def.game === 'all' ? 'All Games' : (GAMES[def.game]?.name || def.game)}</div>
        <div class="pack-name">${def.name}</div>
        <div class="pack-meta">
          <span class="pack-cards-count">${def.cards} carte</span>
          <span class="pack-price">€${def.price}</span>
        </div>
        <button class="pack-open-btn" onclick="showPackModal('${def.id}')">Apri ora →</button>
      </div>
    `;
    grid.appendChild(card);
  }
}

// ─── Pack Modal ───────────────────────────────────────────────────
function showPackModal(packId) {
  const def = PACK_DEFS[packId];
  if (!def) return;
  currentPack = def;

  $('modal-pack-name').textContent = def.name;
  $('modal-pack-game').textContent = def.game === 'all' ? 'Tutti i giochi' : (GAMES[def.game]?.name || def.game);
  $('modal-pack-icon').textContent = def.icon;
  $('modal-pack-price').textContent = `€${def.price}`;
  $('modal-pack-cards').textContent = `${def.cards} carte`;

  const odds = ODDS[packId];
  $('modal-odds-body').innerHTML = Object.entries(odds).map(([r, pct]) => {
    const m = RARITY_META[r];
    return `<div class="odds-row">
      <span>${m.label}</span>
      <span style="color:${m.color};font-weight:700">${pct}</span>
    </div>`;
  }).join('');

  const canAfford = credits >= def.price;
  $('btn-open-pack').disabled = !canAfford;
  $('btn-open-pack').textContent = canAfford ? `Apri — €${def.price}` : 'Crediti insufficienti';

  $('modal-overlay').classList.add('active');
}

function closeModal() {
  $('modal-overlay').classList.remove('active');
}

window.showPackModal = showPackModal;
window.closeModal = closeModal;

// ─── Pack Opening ─────────────────────────────────────────────────
function openPack() {
  if (!currentPack) return;
  if (credits < currentPack.price) { toast('Crediti insufficienti!'); return; }

  const name = playerName || 'Anonimo';

  credits -= currentPack.price;
  saveCredits();
  updateCredits();
  closeModal();

  // Show opening overlay
  $('opening-overlay').classList.add('active');
  $('opening-title').textContent = `Apertura ${currentPack.name}…`;
  $('pack-burst').style.display = 'flex';
  $('cards-stage').classList.remove('active');
  $('burst-emoji').textContent = currentPack.icon;
  $('burst-pack').classList.remove('shaking', 'exploding');

  // Ask server to generate pack
  socket.emit('openPack', { packId: currentPack.id, playerName: name });
}

window.openPack = openPack;

function startReveal(packId, cards) {
  pendingCards = cards;
  revealedCount = 0;

  const burstPack = $('burst-pack');
  burstPack.classList.add('shaking');
  setTimeout(() => {
    burstPack.classList.add('exploding');
    setTimeout(() => {
      $('pack-burst').style.display = 'none';
      showCardsStage(cards);
    }, 400);
  }, 600);
}

function showCardsStage(cards) {
  const stage = $('cards-stage');
  stage.classList.add('active');
  const row = $('cards-row');
  row.innerHTML = '';
  $('cards-progress').textContent = `Clicca le carte per rivelare`;
  $('cards-actions').style.display = 'none';

  cards.forEach((card, i) => {
    const el = buildCardElement(card, false);
    el.style.animationDelay = `${i * 80}ms`;
    el.classList.add('incoming');
    el.addEventListener('click', () => flipCard(el, card, i, cards.length));
    row.appendChild(el);
  });
}

function flipCard(el, card, idx, total) {
  if (el.classList.contains('flipped')) return;
  el.classList.add('flipped');
  revealedCount++;

  // Rarity reveal effect
  if (card.rarity === 'ultra' || card.rarity === 'secret') {
    flashScreen(card.rarity === 'secret' ? '#d946ef' : '#f59e0b');
  }

  const progress = $('cards-progress');
  const remaining = total - revealedCount;
  if (remaining > 0) {
    progress.textContent = `${remaining} carte rimaste — clicca per rivelare`;
  } else {
    progress.textContent = 'Tutte le carte rivelate!';
    $('cards-actions').style.display = 'flex';

    // Save to vault
    pendingCards.forEach(c => vault.push({ ...c, openedAt: Date.now() }));
    saveVault();
  }
}

function closeOpening() {
  $('opening-overlay').classList.remove('active');
  $('cards-stage').classList.remove('active');
  $('pack-burst').style.display = 'flex';
  pendingCards = [];
}

window.closeOpening = closeOpening;

function flashScreen(color) {
  const flash = document.createElement('div');
  flash.style.cssText = `
    position:fixed;inset:0;z-index:9000;pointer-events:none;
    background:${color};opacity:0.35;
    animation:flashFade 0.5s ease-out forwards;
  `;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 600);
}

// ─── Card Builder ─────────────────────────────────────────────────
function buildCardElement(card, flipped = false) {
  const meta = RARITY_META[card.rarity] || RARITY_META.common;
  const icon = TYPE_ICONS[card.type] || '✦';
  const gameName = GAMES[card.game]?.name?.replace(' TCG','').replace(': The Gathering','') || card.game;

  const el = document.createElement('div');
  el.className = `card rarity-${card.rarity}${flipped ? ' flipped' : ''}`;
  el.innerHTML = `
    <div class="card-inner">
      <div class="card-back">
        <div class="card-back-pattern"></div>
        <span>✦</span>
      </div>
      <div class="card-front">
        <div class="card-art-area">
          <span style="font-size:2.6rem;filter:drop-shadow(0 0 12px ${meta.glow})">${icon}</span>
          <div class="card-shine"></div>
        </div>
        <div class="card-body">
          <div class="card-name">${card.name}</div>
          <div class="card-sub">
            <span class="card-game-label">${gameName}</span>
            <span class="card-rarity-badge" style="color:${meta.color}">${meta.stars || '○'}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  return el;
}

// ─── Vault ────────────────────────────────────────────────────────
function renderVault() {
  const filtered = vaultFilter === 'all'
    ? vault
    : vault.filter(c => c.rarity === vaultFilter);

  // Stats
  const total = vault.length;
  const totalValue = vault.reduce((s, c) => s + (c.value || 0), 0);
  const rares = vault.filter(c => ['rare','ultra','secret'].includes(c.rarity)).length;
  $('vault-total').textContent = total;
  $('vault-value').textContent = `€${totalValue.toFixed(0)}`;
  $('vault-rares').textContent = rares;

  const grid = $('vault-grid');
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="vault-empty" style="grid-column:1/-1">
      <div class="icon">📦</div>
      <p>${vault.length === 0 ? 'Apri il tuo primo pacco per iniziare la collezione!' : 'Nessuna carta con questo filtro.'}</p>
    </div>`;
    return;
  }

  grid.innerHTML = '';
  // Show newest first
  const sorted = [...filtered].sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
  for (const card of sorted) {
    const el = buildCardElement(card, true);
    grid.appendChild(el);
  }
}

function filterVault(rarity) {
  vaultFilter = rarity;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.rarity === rarity);
  });
  renderVault();
}

window.filterVault = filterVault;

// ─── Feed ─────────────────────────────────────────────────────────
function appendFeedItem(pull, prepend = false) {
  const list = $('feed-list');
  const meta = RARITY_META[pull.bestCard?.rarity] || RARITY_META.common;
  const icon = TYPE_ICONS[pull.bestCard?.type] || '✦';
  const gameColor = GAMES[pull.bestCard?.game]?.color || '#8b5cf6';

  const initials = (pull.playerName || '?').slice(0, 2).toUpperCase();
  const ago = timeAgo(pull.ts);

  const item = document.createElement('div');
  item.className = 'feed-item';
  item.innerHTML = `
    <div class="feed-avatar" style="background:${gameColor}20;color:${gameColor}">${initials}</div>
    <div class="feed-content">
      <div class="feed-player">${escHtml(pull.playerName)}</div>
      <div class="feed-desc">ha aperto ${escHtml(pull.packName)} · ${icon} ${escHtml(pull.bestCard?.name || '?')}</div>
    </div>
    <span class="feed-card-badge" style="background:${meta.color}20;color:${meta.color}">${meta.label}</span>
    <span class="feed-time">${ago}</span>
  `;

  if (prepend && list.firstChild) {
    list.insertBefore(item, list.firstChild);
    // Keep max 40
    while (list.children.length > 40) list.removeChild(list.lastChild);
  } else {
    list.appendChild(item);
  }

  // If secret rare, highlight
  if (pull.bestCard?.rarity === 'secret') {
    item.style.borderColor = 'rgba(217,70,239,0.4)';
    item.style.background = 'rgba(217,70,239,0.05)';
  } else if (pull.bestCard?.rarity === 'ultra') {
    item.style.borderColor = 'rgba(245,158,11,0.3)';
  }
}

// ─── Credits ──────────────────────────────────────────────────────
function updateCredits() {
  $('credits-display').textContent = `€${credits}`;
}

function addCredits() {
  credits += 250;
  saveCredits();
  updateCredits();
  toast('€250 crediti aggiunti!');
}

window.addCredits = addCredits;

function saveCredits() { localStorage.setItem('pullo_credits', credits); }
function saveVault() { localStorage.setItem('pullo_vault', JSON.stringify(vault)); }

// ─── Player Name ──────────────────────────────────────────────────
function saveName(name) {
  playerName = name.trim() || 'Anonimo';
  localStorage.setItem('pullo_name', playerName);
}

window.saveName = saveName;

// ─── Toast ────────────────────────────────────────────────────────
function toast(msg) {
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─── Helpers ──────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return 'adesso';
  if (diff < 60) return `${diff}s fa`;
  if (diff < 3600) return `${Math.floor(diff/60)}m fa`;
  return `${Math.floor(diff/3600)}h fa`;
}

// Flash keyframe
const flashStyle = document.createElement('style');
flashStyle.textContent = `@keyframes flashFade { from{opacity:0.35} to{opacity:0} }`;
document.head.appendChild(flashStyle);
