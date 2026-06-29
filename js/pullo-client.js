'use strict';
// ─── pullo-client.js — Clone di pullo.io ─────────────────────────────────────

// ─── Dati statici (specchio del server) ─────────────────────────────────────
const PACK_DEFS = {
  great:    { id:'great',    name:'GreatPullo',    price:25,  cards:5,  game:'pokemon',    icon:'🔴', color1:'#3B4CCA', color2:'#FFCB05', artClass:'pack-artwork--pokemon' },
  arcane:   { id:'arcane',   name:'Arcane Tin',    price:25,  cards:5,  game:'magic',      icon:'✦',  color1:'#1e1b4b', color2:'#7c3aed', artClass:'pack-artwork--yugioh' },
  mera:     { id:'mera',     name:'MeraPullo',     price:50,  cards:8,  game:'onepiece',   icon:'☠️', color1:'#1B1464', color2:'#E8171F', artClass:'pack-artwork--onepiece' },
  ultra:    { id:'ultra',    name:'UltraPullo',    price:50,  cards:8,  game:'dragonball', icon:'🐉', color1:'#1c1917', color2:'#FF6B35', artClass:'pack-artwork--dragonball' },
  football: { id:'football', name:'FootballPullo', price:25,  cards:6,  game:'football',   icon:'⚽', color1:'#064e3b', color2:'#10b981', artClass:'pack-artwork--football' },
  master:   { id:'master',   name:'MasterPullo',   price:100, cards:12, game:'pokemon',    icon:'🏆', color1:'#7f1d1d', color2:'#FFCB05', artClass:'pack-artwork--pokemon' },
  dream:    { id:'dream',    name:'DreamPullo',    price:250, cards:20, game:'all',        icon:'💎', color1:'#312e81', color2:'#a855f7', artClass:'pack-artwork--generic' },
};

const GAMES = {
  pokemon:    { name:'Pokémon TCG',          short:'Pokémon',     icon:'⚡', color:'#FFCB05' },
  onepiece:   { name:'One Piece',            short:'One Piece',   icon:'☠️', color:'#E8171F' },
  magic:      { name:'Magic: The Gathering', short:'Magic',       icon:'✦',  color:'#7c3aed' },
  dragonball: { name:'Dragon Ball Super',    short:'Dragon Ball', icon:'🐉', color:'#FF6B35' },
  football:   { name:'Football Cards',       short:'Football',    icon:'⚽', color:'#10b981' },
  all:        { name:'Tutti i giochi',       short:'All',         icon:'🌟', color:'#a855f7' },
};

const RARITY = {
  common:   { label:'Common',      symbol:'',    color:'#9ca3af', bg:'rgba(156,163,175,0.12)' },
  uncommon: { label:'Uncommon',    symbol:'★',   color:'#22c55e', bg:'rgba(34,197,129,0.12)'  },
  rare:     { label:'Rare',        symbol:'★★',  color:'#3b82f6', bg:'rgba(59,130,246,0.15)'  },
  ultra:    { label:'Ultra Rare',  symbol:'★★★', color:'#f59e0b', bg:'rgba(245,158,11,0.15)'  },
  secret:   { label:'Secret Rare', symbol:'✦✦✦', color:'#e879f9', bg:'rgba(232,121,249,0.15)' },
};

const TYPE_ICON = {
  fire:'🔥',water:'💧',electric:'⚡',grass:'🌿',psychic:'🔮',dragon:'🐉',
  dark:'🌑',metal:'⚙️',normal:'⭐',fairy:'✨',sword:'⚔️',fruit:'🍎',
  haki:'💫',marine:'⚓',pirate:'☠️',forest:'🌲',plains:'☀️',swamp:'💀',
  multi:'🌈',saiyan:'⚡',namekian:'🌿',frieza:'❄️',android:'🤖',god:'🌟',
  ultra:'✨',attack:'⚡',defense:'🛡️',goalkeeper:'🥅',legend:'👑',gold:'🥇',icon:'💎',
};

const ODDS = {
  great:    { common:'62%', uncommon:'22%', rare:'11%', ultra:'4%',  secret:'1%' },
  arcane:   { common:'62%', uncommon:'22%', rare:'11%', ultra:'4%',  secret:'1%' },
  football: { common:'62%', uncommon:'22%', rare:'11%', ultra:'4%',  secret:'1%' },
  mera:     { common:'48%', uncommon:'28%', rare:'16%', ultra:'7%',  secret:'1%' },
  ultra:    { common:'48%', uncommon:'28%', rare:'16%', ultra:'7%',  secret:'1%' },
  master:   { common:'32%', uncommon:'28%', rare:'24%', ultra:'13%', secret:'3%' },
  dream:    { common:'12%', uncommon:'22%', rare:'34%', ultra:'25%', secret:'7%' },
};

// ─── Stato app ───────────────────────────────────────────────────────────────
let socket = null;
let user    = JSON.parse(localStorage.getItem('pullo_user')    || 'null');
let credits = parseInt(localStorage.getItem('pullo_credits')   || '500', 10);
let vault   = JSON.parse(localStorage.getItem('pullo_vault')   || '[]');
let vaultRarityFilter = 'all';
let vaultGameFilter   = 'all';
let shopGameFilter    = 'all';
let currentPackId     = null;
let pendingCards      = [];
let promoApplied      = false;
let promoDiscount     = 0;
let heroSlider  = null;
let shopSlider  = null;

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function toast(msg, type = 'info') {
  const c = $('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span class="toast__icon">${type==='error'?'✕':type==='success'?'✓':'ℹ'}</span><div class="toast__body"><span class="toast__title">${esc(msg)}</span></div>`;
  c.appendChild(el);
  setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 250); }, 3000);
}

function saveState() {
  localStorage.setItem('pullo_credits', credits);
  localStorage.setItem('pullo_vault',   JSON.stringify(vault));
  if (user) localStorage.setItem('pullo_user', JSON.stringify(user));
}

function updateHeader() {
  const loginBtn    = $('btn-login');
  const signupBtn   = $('btn-signup');
  const userBadge   = $('user-badge');
  const userNameEl  = $('user-name');
  const creditsEl   = $('credits-display');
  const vaultCredEl = $('vault-credits');

  if (user) {
    if (loginBtn)  loginBtn.style.display  = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
    if (userBadge) { userBadge.style.display = 'flex'; if (userNameEl) userNameEl.textContent = user.username; }
  } else {
    if (loginBtn)  loginBtn.style.display  = '';
    if (signupBtn) signupBtn.style.display = '';
    if (userBadge) userBadge.style.display = 'none';
  }
  if (creditsEl)   creditsEl.textContent   = `€${credits}`;
  if (vaultCredEl) vaultCredEl.textContent = `€${credits}`;
}

// ─── Modals ──────────────────────────────────────────────────────────────────
function openModal(id)  { const el = $(id); if (el) el.classList.remove('hidden'); }
function closeModal(id) { const el = $(id); if (el) el.classList.add('hidden'); }
window.openModal  = openModal;
window.closeModal = closeModal;

// ─── Router ──────────────────────────────────────────────────────────────────
const VIEWS = ['home','shop','collection','how-it-works','odds','conditions','faq','about','contact'];

function navigate(route) {
  history.pushState(null, '', `/pullo#${route}`);
  showView(route);
}

function showView(route) {
  if (!VIEWS.includes(route)) route = 'home';

  VIEWS.forEach(v => {
    const el = $(`view-${v}`);
    if (!el) return;
    el.style.display = (v === route) ? '' : 'none';
  });

  document.querySelectorAll('.header__nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.route === route);
  });
  window.scrollTo(0, 0);

  if (route === 'home')       { renderFeaturedPacks(); }
  if (route === 'shop')       { renderShop(); }
  if (route === 'collection') { renderVault(); }
  if (route === 'odds')       { renderOddsTable(); }
}

window.addEventListener('popstate', () => {
  showView(location.hash.slice(1) || 'home');
});

// ─── HeroSlider — track-translate approach ───────────────────────────────────
class HeroSlider {
  constructor(containerId) {
    this.el = $(containerId);
    if (!this.el) return;
    this.track  = this.el.querySelector('.hero-slider__track');
    this.slides = this.el.querySelectorAll('.hero-slide');
    this.dots   = this.el.querySelectorAll('.hero-slider__dot');
    this.cur    = 0;
    this.timer  = null;
    if (this.slides.length) { this.show(0); this.start(); }
  }
  show(i) {
    if (this.track) this.track.style.transform = `translateX(-${i * 100}%)`;
    this.dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
    this.cur = i;
  }
  next() { this.show((this.cur + 1) % this.slides.length); }
  prev() { this.show((this.cur - 1 + this.slides.length) % this.slides.length); }
  start() { this.timer = setInterval(() => this.next(), 5000); }
  stop()  { clearInterval(this.timer); }
  goTo(i) { this.stop(); this.show(i); this.start(); }
}

// ─── Auth ────────────────────────────────────────────────────────────────────
async function doLogin(e) {
  e.preventDefault();
  const username = $('login-username')?.value.trim();
  const password = $('login-password')?.value;
  if (!username || !password) return toast('Inserisci username e password', 'error');
  try {
    const res  = await fetch('/api/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Errore login', 'error');
    user = { username: data.username, token: data.token, accountId: data.accountId };
    saveState();
    closeModal('modal-login');
    updateHeader();
    toast(`Benvenuto, ${user.username}!`, 'success');
  } catch { toast('Errore di connessione', 'error'); }
}

async function doRegister(e) {
  e.preventDefault();
  const username = $('reg-username')?.value.trim();
  const email    = $('reg-email')?.value.trim();
  const password = $('reg-password')?.value;
  if (!username || !password) return toast('Compila tutti i campi obbligatori', 'error');
  try {
    const res  = await fetch('/api/register', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username, password, email }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Errore registrazione', 'error');
    toast('Account creato! Accedi ora.', 'success');
    closeModal('modal-register');
    openModal('modal-login');
    if ($('login-username')) $('login-username').value = username;
  } catch { toast('Errore di connessione', 'error'); }
}

function doLogout() {
  user = null;
  localStorage.removeItem('pullo_user');
  updateHeader();
  toast('Disconnesso');
}
window.doLogout = doLogout;

// ─── Pack detail modal ────────────────────────────────────────────────────────
function openPackDetail(packId) {
  const def = PACK_DEFS[packId];
  if (!def) return;
  currentPackId = packId;
  promoApplied  = false;
  promoDiscount = 0;

  const odds = ODDS[packId];

  // Artwork
  const art = $('pd-artwork');
  if (art) art.className = `pack-artwork ${def.artClass}`;

  // Info
  const titleEl = $('pd-title');
  if (titleEl) titleEl.textContent = def.name;

  const descEl = $('pd-desc');
  if (descEl) descEl.textContent = `${def.cards} carte · ${GAMES[def.game]?.name || ''} · Prezzo: €${def.price}`;

  const priceEl = $('pd-price-display');
  if (priceEl) priceEl.textContent = `€${def.price}`;

  // Odds table
  const oddsBody = $('pd-odds-body');
  if (oddsBody && odds) {
    oddsBody.innerHTML = Object.entries(odds).map(([r, pct]) => {
      const rm = RARITY[r] || RARITY.common;
      return `<tr>
        <td><span class="rarity-dot rarity-dot--${r}"></span><span style="color:${rm.color}">${rm.label}</span></td>
        <td style="text-align:right;font-weight:700;color:${rm.color}">${pct}</td>
      </tr>`;
    }).join('');
  }

  // Reset promo
  const promoInput = $('pd-promo-input');
  const promoMsg   = $('pd-promo-msg');
  if (promoInput) promoInput.value = '';
  if (promoMsg)   { promoMsg.textContent = ''; promoMsg.style.color = ''; }

  // Buy button
  const buyBtn = $('pd-buy-btn');
  if (buyBtn) {
    buyBtn.textContent = `Acquista — €${def.price}`;
    buyBtn.disabled    = (credits < def.price);
  }

  openModal('modal-pack-detail');
}
window.openPackDetail = openPackDetail;

async function applyPromo() {
  const code  = $('pd-promo-input')?.value.trim().toUpperCase();
  const def   = PACK_DEFS[currentPackId];
  const msgEl = $('pd-promo-msg');
  if (!code || !def) return;
  try {
    const res  = await fetch('/api/pullo/validate-promo', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ code, packId: currentPackId, playerName: user?.username || 'guest' }),
    });
    const data = await res.json();
    if (data.valid) {
      promoApplied  = true;
      promoDiscount = data.discount;
      const final   = Math.floor(def.price * (1 - promoDiscount));
      if (msgEl)  { msgEl.textContent = data.message; msgEl.style.color = '#22c55e'; }
      const priceEl = $('pd-price-display');
      if (priceEl) priceEl.textContent = `€${final}`;
      const buyBtn  = $('pd-buy-btn');
      if (buyBtn)  { buyBtn.textContent = `Acquista — €${final}`; buyBtn.disabled = (credits < final); }
    } else {
      if (msgEl) { msgEl.textContent = data.message; msgEl.style.color = '#f87171'; }
    }
  } catch { toast('Errore verifica codice', 'error'); }
}
window.applyPromo = applyPromo;

function buyPack() {
  const def = PACK_DEFS[currentPackId];
  if (!def) return;
  const finalPrice = promoApplied ? Math.floor(def.price * (1 - promoDiscount)) : def.price;
  if (credits < finalPrice) return toast('Crediti insufficienti!', 'error');
  credits -= finalPrice;
  saveState();
  updateHeader();
  closeModal('modal-pack-detail');
  startOpening(currentPackId);
}
window.buyPack = buyPack;

// ─── Opening flow ─────────────────────────────────────────────────────────────
function startOpening(packId) {
  const def = PACK_DEFS[packId];
  currentPackId = packId;
  pendingCards  = [];

  // Show opening overlay
  const nameEl = $('opening-pack-name');
  if (nameEl) nameEl.textContent = def.name;

  const revNameEl = $('reveal-pack-name');
  if (revNameEl) revNameEl.textContent = def.name;

  const art = $('burst-pack-art');
  if (art) art.style.background = `linear-gradient(135deg, ${def.color1} 0%, ${def.color2} 100%)`;

  const icon = $('burst-pack-icon');
  if (icon) icon.textContent = def.icon;

  $('opening-overlay').classList.remove('hidden');
  $('reveal-overlay').classList.add('hidden');

  // Emit to server
  socket.emit('openPack', { packId, playerName: user?.username || 'Ospite' });
}

// Server sends pack cards → animate burst → show reveal
function onPackResult({ cards }) {
  pendingCards = cards;

  const art = $('burst-pack-art');
  if (art) art.classList.add('shake');

  setTimeout(() => {
    if (art) { art.classList.remove('shake'); art.classList.add('exploding'); }
    setTimeout(() => {
      $('opening-overlay').classList.add('hidden');
      if (art) art.classList.remove('exploding');

      // Build reveal grid
      const grid = $('reveal-grid');
      if (grid) {
        grid.innerHTML = '';
        cards.forEach((card, i) => {
          const el = buildRevealCard(card, i);
          grid.appendChild(el);
        });
      }

      $('reveal-overlay').classList.remove('hidden');
    }, 500);
  }, 700);
}

function buildRevealCard(card, index) {
  const rm   = RARITY[card.rarity]  || RARITY.common;
  const gm   = GAMES[card.game]     || GAMES.pokemon;
  const def  = PACK_DEFS[card.game] || PACK_DEFS.great;
  const icon = TYPE_ICON[card.type] || '✦';
  const uid  = card.uid || card.id;

  const wrapper = document.createElement('div');
  wrapper.className = 'reveal-card';
  wrapper.dataset.uid = uid;

  const flipWrap = document.createElement('div');
  flipWrap.className = 'card-flip-wrapper';
  flipWrap.style.animationDelay = `${index * 70}ms`;

  flipWrap.innerHTML = `
    <div class="card-flip-inner">
      <div class="card-face card-face--back">PULLO.IO</div>
      <div class="card-face card-face--front rarity-${card.rarity}">
        <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px;">
          <div style="font-size:2.5rem;opacity:.85">${icon}</div>
          <div style="font-size:.75rem;font-weight:700;color:#fff;text-align:center;line-height:1.3">${esc(card.name)}</div>
          <div style="font-size:.65rem;color:${gm.color};font-weight:600">${gm.short}</div>
          <div style="font-size:.7rem;color:${rm.color};font-weight:700">${rm.label}</div>
          <div style="font-size:.85rem;color:var(--green);font-weight:800;margin-top:4px">€${card.value.toFixed(2)}</div>
        </div>
      </div>
    </div>`;

  flipWrap.addEventListener('click', () => {
    if (flipWrap.classList.contains('flipped')) return;
    flipWrap.classList.add('flipped');

    // Flash for rare+ cards
    if (card.rarity === 'secret') flashScreen('#d946ef');
    else if (card.rarity === 'ultra') flashScreen('#f59e0b');

    // Show keep/sell after flip completes
    setTimeout(() => {
      const actEl = wrapper.querySelector('.reveal-card__actions');
      if (actEl) actEl.style.display = 'grid';
    }, 650);
  });

  const actions = document.createElement('div');
  actions.className = 'reveal-card__actions';
  actions.style.display = 'none';
  actions.innerHTML = `
    <button class="btn-keep" onclick="keepCard('${uid}', this)">Tieni</button>
    <button class="btn-sell" onclick="sellCard('${uid}', ${card.value}, this)">Vendi €${card.value.toFixed(2)}</button>`;

  wrapper.appendChild(flipWrap);
  wrapper.appendChild(actions);
  return wrapper;
}

function keepCard(uid, btn) {
  const wrapper = document.querySelector(`.reveal-card[data-uid="${uid}"]`);
  if (!wrapper) return;
  const actEl = wrapper.querySelector('.reveal-card__actions');
  if (actEl) actEl.innerHTML = '<span style="grid-column:1/-1;text-align:center;color:var(--text-dim);font-size:.78rem">✓ Tenuta</span>';
}
window.keepCard = keepCard;

function sellCard(uid, value, btn) {
  const wrapper = document.querySelector(`.reveal-card[data-uid="${uid}"]`);
  if (!wrapper) return;
  const actEl = wrapper.querySelector('.reveal-card__actions');
  if (actEl) actEl.innerHTML = `<span style="grid-column:1/-1;text-align:center;color:var(--green);font-size:.78rem">€${Number(value).toFixed(2)} ricevuti</span>`;
  credits += Number(value);
  saveState();
  updateHeader();
}
window.sellCard = sellCard;

function revealAll() {
  document.querySelectorAll('#reveal-grid .card-flip-wrapper:not(.flipped)').forEach(w => {
    w.classList.add('flipped');
    setTimeout(() => {
      const actEl = w.parentElement?.querySelector('.reveal-card__actions');
      if (actEl) actEl.style.display = 'grid';
    }, 650);
  });
}
window.revealAll = revealAll;

function keepAll() {
  document.querySelectorAll('#reveal-grid .reveal-card').forEach(wrapper => {
    const actEl = wrapper.querySelector('.reveal-card__actions');
    if (!actEl) return;
    // Only process cards that haven't been sold (no green text)
    if (!actEl.querySelector('[style*="var(--green)"]')) {
      actEl.innerHTML = '<span style="grid-column:1/-1;text-align:center;color:var(--text-dim);font-size:.78rem">✓ Tenuta</span>';
    }
  });
}
window.keepAll = keepAll;

function finishOpening() {
  // Add all non-sold cards to vault
  const sold = new Set();
  document.querySelectorAll('#reveal-grid .reveal-card').forEach(wrapper => {
    const actEl = wrapper.querySelector('.reveal-card__actions');
    if (actEl?.querySelector('[style*="var(--green)"]')) {
      sold.add(wrapper.dataset.uid);
    }
  });

  const toAdd = pendingCards
    .filter(c => !sold.has(c.uid || c.id))
    .map(c => ({ ...c, openedAt: Date.now() }));

  vault.push(...toAdd);
  saveState();
  closeOpening();
  navigate('collection');
  toast(`${toAdd.length} carte aggiunte al Vault!`, 'success');
}
window.finishOpening = finishOpening;

function closeOpening() {
  $('opening-overlay').classList.add('hidden');
  $('reveal-overlay').classList.add('hidden');
  const art = $('burst-pack-art');
  if (art) { art.classList.remove('shake','exploding'); }
}
window.closeOpening = closeOpening;

function flashScreen(color) {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position:'fixed', inset:'0', zIndex:'9999', pointerEvents:'none',
    background: color, opacity:'0.35',
    animation: 'fadeIn .1s ease-out, slideOutToast .5s ease-out .15s forwards',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

// ─── Pack card builder (shop + home grids) ────────────────────────────────────
function buildPackCard(def) {
  const gm   = GAMES[def.game] || GAMES.pokemon;
  const card = document.createElement('div');
  card.className = 'pack-card';
  card.role = 'listitem';
  card.innerHTML = `
    <div class="pack-artwork ${def.artClass}"></div>
    <div class="pack-card__info">
      <p class="pack-card__tag">${gm.name}</p>
      <h3 class="pack-card__name">${esc(def.name)}</h3>
      <div class="pack-card__footer">
        <span class="pack-card__price">€${def.price}</span>
        <button class="pack-card__buy" onclick="openPackDetail('${def.id}')">Acquista</button>
      </div>
    </div>`;
  return card;
}

// ─── Home page ───────────────────────────────────────────────────────────────
function renderFeaturedPacks() {
  const grid = $('featured-packs-grid');
  if (!grid) return;
  const featured = ['dream','master','mera','ultra','great','football'];
  grid.innerHTML = '';
  featured.forEach(id => {
    const def = PACK_DEFS[id];
    if (def) grid.appendChild(buildPackCard(def));
  });
}

// ─── Shop ────────────────────────────────────────────────────────────────────
function renderShop(filter) {
  if (filter !== undefined) shopGameFilter = filter;

  document.querySelectorAll('.shop-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.game === shopGameFilter);
  });

  const all      = Object.values(PACK_DEFS);
  const filtered = shopGameFilter === 'all'
    ? all
    : all.filter(p => p.game === shopGameFilter);

  const grid = $('all-packs-grid');
  if (!grid) return;
  grid.innerHTML = '';
  filtered.forEach(def => grid.appendChild(buildPackCard(def)));
}
window.renderShop = renderShop;

// ─── Vault card builder ───────────────────────────────────────────────────────
function buildVaultCard(card) {
  const rm   = RARITY[card.rarity] || RARITY.common;
  const def  = PACK_DEFS[card.game] || Object.values(PACK_DEFS)[0];
  const icon = TYPE_ICON[card.type] || '✦';

  const el = document.createElement('div');
  el.className = 'vault-card';
  el.role = 'listitem';
  el.innerHTML = `
    <div class="vault-card__art" style="background:linear-gradient(135deg,${def.color1},${def.color2})">
      <span style="font-size:2rem">${icon}</span>
    </div>
    <div class="vault-card__meta">
      <p class="vault-card__name">${esc(card.name)}</p>
      <p style="font-size:.68rem;color:${rm.color};font-weight:700;margin-bottom:2px">${rm.label}</p>
      <p class="vault-card__value">€${card.value.toFixed(2)}</p>
    </div>`;
  return el;
}

// ─── Vault/Collection ─────────────────────────────────────────────────────────
function renderVault() {
  const totalVal = vault.reduce((s, c) => s + (c.value || 0), 0);
  const rares    = vault.filter(c => ['rare','ultra','secret'].includes(c.rarity)).length;

  const totEl = $('vault-total'); if (totEl) totEl.textContent = vault.length;
  const valEl = $('vault-value'); if (valEl) valEl.textContent = `€${totalVal.toFixed(0)}`;
  const rarEl = $('vault-rares'); if (rarEl) rarEl.textContent = rares;

  document.querySelectorAll('.vault-rarity-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.rarity === vaultRarityFilter));
  document.querySelectorAll('.vault-game-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.game === vaultGameFilter));

  let filtered = vault;
  if (vaultRarityFilter !== 'all') filtered = filtered.filter(c => c.rarity === vaultRarityFilter);
  if (vaultGameFilter   !== 'all') filtered = filtered.filter(c => c.game   === vaultGameFilter);

  const grid = $('collection-grid');
  if (!grid) return;

  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 24px">
      <div style="font-size:3rem;margin-bottom:16px">📦</div>
      <p style="color:var(--text-dim);margin-bottom:20px">${vault.length ? 'Nessuna carta con questo filtro.' : 'Apri il tuo primo pacco per iniziare la collezione!'}</p>
      <button class="btn-primary" onclick="navigate('shop')">Vai allo Shop</button>
    </div>`;
    return;
  }

  grid.innerHTML = '';
  [...filtered]
    .sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0))
    .forEach(card => grid.appendChild(buildVaultCard(card)));
}

function filterVaultRarity(r) { vaultRarityFilter = r; renderVault(); }
function filterVaultGame(g)   { vaultGameFilter   = g; renderVault(); }
window.filterVaultRarity = filterVaultRarity;
window.filterVaultGame   = filterVaultGame;

// ─── Live Feed ────────────────────────────────────────────────────────────────
function appendFeedItem(pull, prepend = false) {
  const list = $('just-pulled-list');
  if (!list) return;
  const bc   = pull.bestCard;
  if (!bc) return;
  const rm   = RARITY[bc.rarity] || RARITY.common;
  const gm   = GAMES[bc.game]    || GAMES.pokemon;
  const icon = TYPE_ICON[bc.type] || '✦';
  const init = (pull.playerName || '?').slice(0, 2).toUpperCase();

  // Remove placeholder
  list.querySelector('.feed-placeholder')?.remove();

  const item = document.createElement('div');
  item.className = 'pull-card';
  item.innerHTML = `
    <div class="pull-card__avatar" style="background:${gm.color}22;color:${gm.color}">${init}</div>
    <div class="pull-card__info">
      <span class="pull-card__user">${esc(pull.playerName)}</span>
      <span class="pull-card__desc">ha aperto ${esc(pull.packName)}</span>
      <span class="pull-card__rarity pull-card__rarity--${bc.rarity}" style="color:${rm.color}">${icon} ${esc(bc.name)} · ${rm.label}</span>
    </div>`;

  if (prepend && list.firstChild) list.insertBefore(item, list.firstChild);
  else list.appendChild(item);

  while (list.children.length > 30) list.removeChild(list.lastChild);
}

// ─── Odds page ────────────────────────────────────────────────────────────────
function renderOddsTable() {
  const el = $('odds-table-body');
  if (!el) return;
  el.innerHTML = Object.entries(PACK_DEFS).map(([id, def]) => {
    const o = ODDS[id] || {};
    return `<tr>
      <td><strong>${esc(def.name)}</strong></td>
      <td>€${def.price}</td>
      <td>${def.cards}</td>
      <td>${o.common   || '—'}</td>
      <td style="color:var(--green)">${o.uncommon || '—'}</td>
      <td style="color:var(--blue)">${o.rare     || '—'}</td>
      <td style="color:var(--gold)">${o.ultra    || '—'}</td>
      <td style="color:#e879f9">${o.secret  || '—'}</td>
    </tr>`;
  }).join('');
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
function initFaq() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
      btn.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
    });
  });
}

// ─── Socket ──────────────────────────────────────────────────────────────────
function connectSocket() {
  socket = io('/pullo', { transports:['websocket','polling'] });

  socket.on('connect', () => {});
  socket.on('recentPulls', pulls => {
    const list = $('just-pulled-list');
    if (list) list.innerHTML = '';
    [...pulls].reverse().forEach(p => appendFeedItem(p, false));
  });
  socket.on('livePull',   pull => appendFeedItem(pull, true));
  socket.on('packResult', data => onPackResult(data));
  socket.on('packError',  data => {
    closeOpening();
    toast(data.error || 'Errore apertura pacco', 'error');
    // Refund credits
    if (currentPackId) {
      const def = PACK_DEFS[currentPackId];
      if (def) { credits += def.price; saveState(); updateHeader(); }
    }
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  connectSocket();

  // ── Nav links (header + footer)
  document.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', e => {
      const route = el.dataset.route;
      if (!route) return;
      e.preventDefault();
      navigate(route);
    });
  });

  // ── Hero slider
  heroSlider = new HeroSlider('hero-slider');
  $('slider-prev')?.addEventListener('click', () => heroSlider.prev());
  $('slider-next')?.addEventListener('click', () => heroSlider.next());
  document.querySelectorAll('#hero-slider .hero-slider__dot').forEach((d, i) => {
    d.addEventListener('click', () => heroSlider.goTo(i));
  });

  // ── Shop slider
  shopSlider = new HeroSlider('shop-slider');
  $('shop-slider-prev')?.addEventListener('click', () => shopSlider?.prev());
  $('shop-slider-next')?.addEventListener('click', () => shopSlider?.next());
  document.querySelectorAll('#shop-slider .hero-slider__dot').forEach((d, i) => {
    d.addEventListener('click', () => shopSlider?.goTo(i));
  });

  // ── Shop filters
  document.querySelectorAll('.shop-filter-btn').forEach(b => {
    b.addEventListener('click', () => renderShop(b.dataset.game));
  });

  // ── Vault filters
  document.querySelectorAll('.vault-rarity-btn').forEach(b => {
    b.addEventListener('click', () => filterVaultRarity(b.dataset.rarity));
  });
  document.querySelectorAll('.vault-game-btn').forEach(b => {
    b.addEventListener('click', () => filterVaultGame(b.dataset.game));
  });

  // ── Auth buttons
  $('btn-login')?.addEventListener('click',  () => openModal('modal-login'));
  $('btn-signup')?.addEventListener('click', () => openModal('modal-register'));
  $('btn-logout')?.addEventListener('click', doLogout);

  $('hero-cta-register')?.addEventListener('click', () => openModal('modal-register'));

  // ── Modal close buttons
  $('modal-login-close')?.addEventListener('click',    () => closeModal('modal-login'));
  $('modal-register-close')?.addEventListener('click', () => closeModal('modal-register'));
  $('modal-pack-close')?.addEventListener('click',     () => closeModal('modal-pack-detail'));

  // ── Switch login ↔ register
  $('switch-to-register')?.addEventListener('click', () => { closeModal('modal-login');    openModal('modal-register'); });
  $('switch-to-login')?.addEventListener('click',    () => { closeModal('modal-register'); openModal('modal-login');    });
  $('link-to-register')?.addEventListener('click', e => { e.preventDefault(); closeModal('modal-login');    openModal('modal-register'); });
  $('link-to-login')?.addEventListener('click',    e => { e.preventDefault(); closeModal('modal-register'); openModal('modal-login');    });

  // ── Close modals on backdrop click
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
  });

  // ── Auth forms
  $('login-form')?.addEventListener('submit',    doLogin);
  $('register-form')?.addEventListener('submit', doRegister);

  // ── Pack detail
  $('btn-apply-promo')?.addEventListener('click', applyPromo);
  $('pd-buy-btn')?.addEventListener('click',      buyPack);

  // ── Reveal overlay actions
  $('btn-reveal-all')?.addEventListener('click',     revealAll);
  $('btn-keep-all')?.addEventListener('click',       keepAll);
  $('btn-finish-opening')?.addEventListener('click', finishOpening);

  // ── Add credits
  $('btn-add-credits')?.addEventListener('click', () => {
    credits += 250; saveState(); updateHeader(); toast('€250 crediti aggiunti!', 'success');
  });

  // ── FAQ
  initFaq();

  // ── Contact form
  $('contact-form')?.addEventListener('submit', e => {
    e.preventDefault();
    toast('Messaggio inviato! Ti risponderemo presto.', 'success');
    e.target.reset();
  });

  // ── Mobile hamburger
  $('mobile-menu-toggle')?.addEventListener('click', () => {
    const nav     = document.getElementById('main-nav');
    const actions = document.getElementById('header-actions');
    const isOpen  = nav?.classList.toggle('open');
    if (actions) actions.classList.toggle('open', isOpen);
    $('mobile-menu-toggle')?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // ── Initial state
  updateHeader();

  // ── Route from hash
  const route = location.hash.slice(1) || 'home';
  showView(route);
  if (route === 'home') renderFeaturedPacks();
  if (route === 'shop') renderShop();
  if (route === 'odds') renderOddsTable();
});

// ── Expose globals needed by inline event handlers
window.navigate      = navigate;
window.openPackDetail = openPackDetail;
