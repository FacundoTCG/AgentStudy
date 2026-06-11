// ui.js — All UI panels for Regni d'Oriente MMORPG
'use strict';

class UIManager {
  constructor(gameState) {
    this.gs = gameState;
    this.panels = {};
    this._openPanel = null;
    this._dialogueNpc = null;
    this._shopNpc = null;
    this._chatHistory = [];
    this._buildDOM();
    this._bindEvents();
  }

  // ============================================================
  // DOM construction
  // ============================================================
  _buildDOM() {
    const root = document.getElementById('ui-root');
    if (!root) return;

    root.innerHTML = `
<!-- HUD bars -->
<div id="hud">
  <div id="player-frame">
    <div id="player-name">—</div>
    <div class="bar-row">
      <span class="bar-label">HP</span>
      <div class="bar hp-bar"><div id="hp-fill" class="fill"></div></div>
      <span id="hp-text" class="bar-num">0/0</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">MP</span>
      <div class="bar mp-bar"><div id="mp-fill" class="fill"></div></div>
      <span id="mp-text" class="bar-num">0/0</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">XP</span>
      <div class="bar xp-bar"><div id="xp-fill" class="fill"></div></div>
      <span id="xp-text" class="bar-num">Lv1</span>
    </div>
  </div>
  <div id="gold-display">💰 <span id="gold-value">0</span></div>
  <div id="zone-name"></div>
</div>

<!-- Target frame -->
<div id="target-frame" class="hidden">
  <div id="target-name"></div>
  <div id="target-level"></div>
  <div class="bar hp-bar target-hp"><div id="target-hp-fill" class="fill"></div></div>
  <div id="target-hp-num"></div>
</div>

<!-- Skill bar -->
<div id="skill-bar">
  <div class="skill-group" id="skills-main"></div>
  <div class="skill-sep"></div>
  <div class="skill-group" id="skills-potion">
    <div class="skill-slot" id="slot-potion" data-key="4">
      <div class="skill-icon">🧪</div>
      <div class="skill-name">Pozione</div>
      <div class="skill-count" id="potion-count">3</div>
      <div class="skill-cd-overlay" id="cd-potion"></div>
      <div class="slot-key">4</div>
    </div>
  </div>
</div>

<!-- Minimap -->
<canvas id="minimap" width="180" height="180"></canvas>

<!-- Combat log -->
<div id="combat-log"></div>

<!-- Notifications -->
<div id="notifications"></div>

<!-- Status effects bar -->
<div id="status-effects"></div>

<!-- Open panel buttons -->
<div id="panel-buttons">
  <button class="panel-btn" data-panel="inventory" title="Inventario (I)">🎒</button>
  <button class="panel-btn" data-panel="quests" title="Missioni (J)">📜</button>
  <button class="panel-btn" data-panel="character" title="Personaggio (C)">👤</button>
  <button class="panel-btn" data-panel="map" title="Mappa (M)">🗺</button>
</div>

<!-- ===================== PANELS ===================== -->

<!-- Inventory Panel -->
<div id="panel-inventory" class="game-panel hidden">
  <div class="panel-header">Inventario <button class="close-btn" data-panel="inventory">✕</button></div>
  <div id="equipment-slots">
    <div class="panel-section-title">Equipaggiamento</div>
    <div id="equip-grid">
      <div class="equip-slot" data-slot="weapon" title="Arma">⚔<span class="slot-label">Arma</span></div>
      <div class="equip-slot" data-slot="chest" title="Petto">🛡<span class="slot-label">Petto</span></div>
      <div class="equip-slot" data-slot="ring" title="Anello">💍<span class="slot-label">Anello</span></div>
      <div class="equip-slot" data-slot="necklace" title="Collana">📿<span class="slot-label">Collana</span></div>
    </div>
    <div id="equipped-stats"></div>
  </div>
  <div class="panel-section-title">Zaino (30 slot)</div>
  <div id="inv-grid"></div>
  <div id="item-tooltip" class="hidden"></div>
</div>

<!-- Quest Log Panel -->
<div id="panel-quests" class="game-panel hidden">
  <div class="panel-header">Registro Missioni <button class="close-btn" data-panel="quests">✕</button></div>
  <div id="quest-tabs">
    <button class="qtab active" data-tab="active">Attive</button>
    <button class="qtab" data-tab="completed">Completate</button>
  </div>
  <div id="quest-list"></div>
  <div id="quest-detail"></div>
</div>

<!-- Character Panel -->
<div id="panel-character" class="game-panel hidden">
  <div class="panel-header">Personaggio <button class="close-btn" data-panel="character">✕</button></div>
  <div id="char-info"></div>
  <div class="panel-section-title">Statistiche</div>
  <div id="char-stats"></div>
  <div class="panel-section-title">Abilità</div>
  <div id="char-skills"></div>
</div>

<!-- Map Panel -->
<div id="panel-map" class="game-panel hidden">
  <div class="panel-header">Mappa del Mondo <button class="close-btn" data-panel="map">✕</button></div>
  <canvas id="world-map-canvas" width="600" height="600"></canvas>
  <div id="map-legend"></div>
</div>

<!-- ===================== NPC DIALOGUE ===================== -->
<div id="dialogue-box" class="hidden">
  <div id="dialogue-portrait">👤</div>
  <div id="dialogue-content">
    <div id="dialogue-npc-name"></div>
    <div id="dialogue-text"></div>
    <div id="dialogue-options"></div>
  </div>
</div>

<!-- ===================== SHOP ===================== -->
<div id="shop-panel" class="game-panel hidden" style="width:680px">
  <div class="panel-header"><span id="shop-title">Negozio</span> <button class="close-btn" id="shop-close">✕</button></div>
  <div id="shop-body">
    <div id="shop-items-col">
      <div class="panel-section-title">In vendita</div>
      <div id="shop-items-list"></div>
    </div>
    <div id="shop-sell-col">
      <div class="panel-section-title">Vendi oggetti</div>
      <div id="shop-sell-list"></div>
    </div>
  </div>
  <div id="shop-footer">Oro: 💰 <span id="shop-gold">0</span></div>
</div>

<!-- ===================== DUNGEON ENTER ===================== -->
<div id="dungeon-prompt" class="hidden">
  <div class="dprompt-box">
    <div id="dprompt-name"></div>
    <div id="dprompt-info"></div>
    <button id="dprompt-enter">Entra nel Dungeon</button>
    <button id="dprompt-cancel">Annulla</button>
  </div>
</div>

<!-- ===================== CHAT ===================== -->
<div id="chat-box">
  <div id="chat-messages"></div>
  <div id="chat-input-row">
    <input type="text" id="chat-input" placeholder="Premi INVIO per chattare..." maxlength="200">
    <select id="chat-channel">
      <option value="local">Locale</option>
      <option value="global">Globale</option>
      <option value="party">Gruppo</option>
    </select>
  </div>
</div>

<!-- ===================== DEATH SCREEN ===================== -->
<div id="death-screen" class="hidden">
  <div class="death-box">
    <h2>Sei Caduto in Battaglia</h2>
    <div id="death-stats"></div>
    <button id="respawn-btn">⚔ Risorgi al Villaggio</button>
  </div>
</div>

<!-- ===================== ESC MENU ===================== -->
<div id="esc-menu" class="hidden">
  <div class="esc-box">
    <h2>Pausa</h2>
    <button id="esc-continue">Continua</button>
    <button id="esc-settings">Impostazioni</button>
    <button id="esc-save">Salva e Esci</button>
  </div>
</div>

<!-- Controls hint -->
<div id="controls-hint">WASD: muovi · Spazio/Click: attacca · 1-4: abilità/pozione · Tab: bersaglio · I/J/C/M: pannelli · Esc: menu</div>
`;
  }

  // ============================================================
  // Event bindings
  // ============================================================
  _bindEvents() {
    // Panel open buttons
    document.querySelectorAll('.panel-btn').forEach(btn => {
      btn.addEventListener('click', () => this.togglePanel(btn.dataset.panel));
    });
    // Close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closePanel(btn.dataset.panel));
    });
    document.getElementById('shop-close')?.addEventListener('click', () => this.closeShop());

    // Quest tabs
    document.querySelectorAll('.qtab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.qtab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        this.renderQuestList(t.dataset.tab);
      });
    });

    // Chat input
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          this.sendChat(chatInput.value.trim());
          chatInput.value = '';
        }
      });
    }

    // Death screen
    document.getElementById('respawn-btn')?.addEventListener('click', () => {
      this.gs.emit('respawn', {});
    });

    // ESC menu
    document.getElementById('esc-continue')?.addEventListener('click', () => this.closeEscMenu());
    document.getElementById('esc-save')?.addEventListener('click', () => {
      this.gs.saveSystem?.save();
      window.location.href = 'index.html';
    });

    // Dungeon prompt
    document.getElementById('dprompt-enter')?.addEventListener('click', () => {
      if (this._pendingDungeon) this.gs.emit('enterDungeon', { dungeonId: this._pendingDungeon });
      document.getElementById('dungeon-prompt').classList.add('hidden');
    });
    document.getElementById('dprompt-cancel')?.addEventListener('click', () => {
      document.getElementById('dungeon-prompt').classList.add('hidden');
    });

    // Inventory events
    this._setupInventoryEvents();
  }

  _setupInventoryEvents() {
    const panel = document.getElementById('panel-inventory');
    if (!panel) return;
    panel.addEventListener('contextmenu', e => {
      e.preventDefault();
      const slot = e.target.closest('.inv-slot');
      if (!slot || slot.dataset.empty === 'true') return;
      this._showItemContextMenu(parseInt(slot.dataset.index), e.clientX, e.clientY);
    });
    panel.addEventListener('click', e => {
      const ctx = document.getElementById('item-context-menu');
      if (ctx) ctx.remove();
      const slot = e.target.closest('.inv-slot');
      if (slot && slot.dataset.empty !== 'true') {
        this._showItemTooltip(parseInt(slot.dataset.index), slot);
      } else {
        this._hideItemTooltip();
      }
    });
    // Equip slots
    panel.addEventListener('click', e => {
      const es = e.target.closest('.equip-slot[data-equipped]');
      if (es) this.gs.emit('unequipItem', { slot: es.dataset.slot });
    });
  }

  // ============================================================
  // HUD Update (called every frame)
  // ============================================================
  updateHUD() {
    const p = this.gs.player;
    if (!p) return;

    document.getElementById('hp-fill').style.width = `${(p.hp / p.maxHp) * 100}%`;
    document.getElementById('mp-fill').style.width = `${(p.mp / p.maxMp) * 100}%`;
    document.getElementById('xp-fill').style.width = `${(p.xp / window.GameData.levelXP(p.level)) * 100}%`;
    document.getElementById('hp-text').textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
    document.getElementById('mp-text').textContent = `${Math.ceil(p.mp)}/${p.maxMp}`;
    document.getElementById('xp-text').textContent = `Lv ${p.level}`;
    document.getElementById('gold-value').textContent = p.gold;
    document.getElementById('player-name').textContent = `${p.name} — ${p.className}`;

    // Skill cooldowns
    const skills = window.GameData.CLASSES[p.classKey].skills;
    skills.forEach((skId, i) => {
      const sk = window.GameData.SKILLS[skId];
      if (!sk) return;
      const overlay = document.getElementById(`cd-skill-${i}`);
      if (overlay) {
        const frac = p.skillCds[i] > 0 ? p.skillCds[i] / sk.cd : 0;
        overlay.style.transform = `scaleY(${frac})`;
        const timeEl = overlay.querySelector('.cd-time');
        if (timeEl) timeEl.textContent = frac > 0 ? Math.ceil(p.skillCds[i]) : '';
      }
    });
    const potCd = document.getElementById('cd-potion');
    if (potCd) potCd.style.transform = `scaleY(${Math.min(1, (p.potCd || 0) / 3)})`;
    document.getElementById('potion-count').textContent = p.potions;

    // Target frame
    const tf = document.getElementById('target-frame');
    const t = p.target;
    if (t && t.hp > 0) {
      tf.classList.remove('hidden');
      document.getElementById('target-name').textContent = t.type ? t.type.name : 'Pietra Demoniaca';
      document.getElementById('target-level').textContent = `Lv ${t.type ? t.type.level : '—'}`;
      document.getElementById('target-hp-fill').style.width = `${(t.hp / t.maxHp) * 100}%`;
      document.getElementById('target-hp-num').textContent = `${Math.ceil(t.hp)} / ${t.maxHp}`;
    } else {
      tf.classList.add('hidden');
      if (p.target && p.target.hp <= 0) p.target = null;
    }

    // Status effects
    this._renderStatusEffects();
  }

  _renderStatusEffects() {
    const el = document.getElementById('status-effects');
    if (!el || !this.gs.player) return;
    const buffs = this.gs.player.buffs || [];
    el.innerHTML = buffs.map(b =>
      `<div class="status-icon" title="${b.name || b.stat}: ${Math.ceil(b.t)}s">
        ${b.icon || '✨'}
        <span class="status-dur">${Math.ceil(b.t)}s</span>
      </div>`
    ).join('');
  }

  // ============================================================
  // Skill bar setup
  // ============================================================
  buildSkillBar(classKey) {
    const container = document.getElementById('skills-main');
    if (!container) return;
    const cls = window.GameData.CLASSES[classKey];
    container.innerHTML = cls.skills.map((skId, i) => {
      const sk = window.GameData.SKILLS[skId];
      return `<div class="skill-slot" data-skill-index="${i}" data-key="${i + 1}">
        <div class="skill-icon">${sk.icon}</div>
        <div class="skill-name">${sk.name}</div>
        <div class="skill-mp">MP: ${sk.mp}</div>
        <div class="skill-cd-overlay" id="cd-skill-${i}"><span class="cd-time"></span></div>
        <div class="slot-key">${i + 1}</div>
      </div>`;
    }).join('');

    container.querySelectorAll('.skill-slot').forEach(s => {
      s.addEventListener('click', () => {
        this.gs.emit('useSkill', { index: parseInt(s.dataset.skillIndex) });
      });
    });
  }

  // ============================================================
  // Inventory Panel
  // ============================================================
  renderInventory() {
    const grid = document.getElementById('inv-grid');
    if (!grid || !this.gs.player) return;
    const inv = this.gs.player.inventory || [];
    const slots = 30;
    let html = '';
    for (let i = 0; i < slots; i++) {
      const entry = inv[i];
      if (entry && entry.id) {
        const item = window.GameData.ITEMS[entry.id];
        const q = item ? window.GameData.ITEM_QUALITY[item.quality] : '#aaa';
        html += `<div class="inv-slot" data-index="${i}" data-empty="false" style="border-color:${q}">
          <div class="inv-icon">${this._itemIcon(item)}</div>
          ${entry.qty > 1 ? `<div class="inv-qty">${entry.qty}</div>` : ''}
        </div>`;
      } else {
        html += `<div class="inv-slot empty" data-index="${i}" data-empty="true"></div>`;
      }
    }
    grid.innerHTML = html;
    this._renderEquipSlots();
    this._renderEquippedStats();
  }

  _renderEquipSlots() {
    const p = this.gs.player;
    if (!p) return;
    document.querySelectorAll('.equip-slot').forEach(el => {
      const slot = el.dataset.slot;
      const item = p.equipped ? p.equipped[slot] : null;
      if (item) {
        const d = window.GameData.ITEMS[item.id];
        const q = d ? window.GameData.ITEM_QUALITY[d.quality] : '#aaa';
        el.style.borderColor = q;
        el.dataset.equipped = 'true';
        el.innerHTML = `<div class="inv-icon">${this._itemIcon(d)}</div><span class="slot-label">${d ? d.name : slot}</span>`;
      } else {
        el.style.borderColor = '';
        delete el.dataset.equipped;
        el.innerHTML = `${this._slotEmoji(slot)}<span class="slot-label">${this._slotLabel(slot)}</span>`;
      }
    });
  }

  _renderEquippedStats() {
    const p = this.gs.player;
    if (!p) return;
    const el = document.getElementById('equipped-stats');
    if (!el) return;
    el.innerHTML = `
      <div class="stat-row"><span>ATK</span><span>${Math.floor(p.atk)}</span></div>
      <div class="stat-row"><span>M.ATK</span><span>${Math.floor(p.matk || 0)}</span></div>
      <div class="stat-row"><span>DEF</span><span>${Math.floor(p.def)}</span></div>
      <div class="stat-row"><span>VEL</span><span>${Math.floor(p.speed)}</span></div>
      <div class="stat-row"><span>CRIT</span><span>${Math.floor((p.crit || 0) * 100)}%</span></div>
    `;
  }

  _showItemTooltip(index, anchor) {
    const p = this.gs.player;
    const entry = p?.inventory?.[index];
    if (!entry) return;
    const item = window.GameData.ITEMS[entry.id];
    if (!item) return;
    const tip = document.getElementById('item-tooltip');
    if (!tip) return;
    const q = window.GameData.ITEM_QUALITY[item.quality];
    const statsStr = Object.entries(item.stats || {}).map(([k, v]) =>
      `<div class="tip-stat">${this._statLabel(k)}: <b>${v > 0 ? '+' : ''}${typeof v === 'number' && v < 1 && v > 0 ? (v * 100).toFixed(1) + '%' : v}</b></div>`
    ).join('');
    tip.innerHTML = `
      <div class="tip-name" style="color:${q}">${item.name}</div>
      <div class="tip-quality">${item.quality.charAt(0).toUpperCase() + item.quality.slice(1)}</div>
      ${item.level ? `<div class="tip-level">Livello min: ${item.level}</div>` : ''}
      ${statsStr}
      ${item.desc ? `<div class="tip-desc">${item.desc}</div>` : ''}
      <div class="tip-value">Valore: ${item.value} oro</div>
      ${entry.qty > 1 ? `<div class="tip-qty">Quantità: ${entry.qty}</div>` : ''}
    `;
    tip.classList.remove('hidden');
    const rect = anchor.getBoundingClientRect();
    tip.style.left = `${rect.right + 8}px`;
    tip.style.top = `${rect.top}px`;
  }

  _hideItemTooltip() {
    document.getElementById('item-tooltip')?.classList.add('hidden');
  }

  _showItemContextMenu(index, x, y) {
    const existing = document.getElementById('item-context-menu');
    if (existing) existing.remove();
    const p = this.gs.player;
    const entry = p?.inventory?.[index];
    if (!entry) return;
    const item = window.GameData.ITEMS[entry.id];
    if (!item) return;
    const menu = document.createElement('div');
    menu.id = 'item-context-menu';
    menu.className = 'context-menu';
    menu.style.cssText = `left:${x}px;top:${y}px`;
    const actions = [];
    if (item.slot) actions.push({ label: 'Equipaggia', action: () => this.gs.emit('equipItem', { slotIndex: index }) });
    if (item.type === 'consumable') actions.push({ label: 'Usa', action: () => this.gs.emit('useItem', { itemId: entry.id }) });
    actions.push({ label: 'Vendi', action: () => { this.gs.emit('sellItem', { slotIndex: index }); menu.remove(); this.renderInventory(); } });
    actions.push({ label: 'Annulla', action: () => menu.remove() });
    menu.innerHTML = actions.map(a => `<div class="ctx-item">${a.label}</div>`).join('');
    menu.querySelectorAll('.ctx-item').forEach((el, i) => {
      el.addEventListener('click', () => { actions[i].action(); menu.remove(); });
    });
    document.body.appendChild(menu);
  }

  // ============================================================
  // Quest Panel
  // ============================================================
  renderQuestList(tab = 'active') {
    const list = document.getElementById('quest-list');
    if (!list || !this.gs.player) return;
    const active = this.gs.player.activeQuests || [];
    const done = this.gs.player.completedQuests || [];
    const quests = tab === 'active' ? active : done;
    if (!quests.length) {
      list.innerHTML = `<div class="quest-empty">${tab === 'active' ? 'Nessuna missione attiva' : 'Nessuna missione completata'}</div>`;
      return;
    }
    list.innerHTML = quests.map(q => {
      const def = window.GameData.QUESTS[q.id];
      if (!def) return '';
      const done = q.objectives?.every(o => o.current >= o.count);
      return `<div class="quest-item ${done ? 'completable' : ''}" data-quest-id="${q.id}">
        <div class="quest-title">${def.name} ${done ? '✅' : ''}</div>
        <div class="quest-level">Lv ${def.level}</div>
      </div>`;
    }).join('');
    list.querySelectorAll('.quest-item').forEach(el => {
      el.addEventListener('click', () => this.renderQuestDetail(el.dataset.questId));
    });
  }

  renderQuestDetail(questId) {
    const detail = document.getElementById('quest-detail');
    if (!detail) return;
    const def = window.GameData.QUESTS[questId];
    const active = this.gs.player?.activeQuests?.find(q => q.id === questId);
    if (!def || !active) return;
    const objHtml = active.objectives.map(o =>
      `<div class="obj-row ${o.current >= o.count ? 'done' : ''}">
        ${o.current >= o.count ? '✅' : '⬜'} ${o.text.replace(/\d+\/\d+/, `${o.current}/${o.count}`)}
      </div>`
    ).join('');
    const rewHtml = `XP: ${def.rewards.xp} · Oro: ${def.rewards.gold}` +
      (def.rewards.items?.length ? ' · ' + def.rewards.items.map(i => `${window.GameData.ITEMS[i.id]?.name || i.id} x${i.qty}`).join(', ') : '');
    detail.innerHTML = `
      <div class="qd-title">${def.name}</div>
      <div class="qd-desc">${def.description}</div>
      <div class="qd-section">Obiettivi:</div>
      ${objHtml}
      <div class="qd-section">Ricompense:</div>
      <div class="qd-rewards">${rewHtml}</div>
    `;
  }

  // ============================================================
  // Character Panel
  // ============================================================
  renderCharacterPanel() {
    const p = this.gs.player;
    if (!p) return;
    const cls = window.GameData.CLASSES[p.classKey];
    document.getElementById('char-info').innerHTML = `
      <div class="char-class-icon">${cls.icon}</div>
      <div class="char-class-name" style="color:${cls.color}">${p.name}</div>
      <div class="char-class-desc">${cls.description}</div>
      <div class="char-meta">Livello ${p.level} · ${p.kills || 0} nemici uccisi</div>
    `;
    document.getElementById('char-stats').innerHTML = `
      <div class="stat-row"><span>HP Max</span><span>${p.maxHp}</span></div>
      <div class="stat-row"><span>MP Max</span><span>${p.maxMp}</span></div>
      <div class="stat-row"><span>Attacco</span><span>${Math.floor(p.atk)}</span></div>
      <div class="stat-row"><span>Attacco Magico</span><span>${Math.floor(p.matk || 0)}</span></div>
      <div class="stat-row"><span>Difesa</span><span>${Math.floor(p.def)}</span></div>
      <div class="stat-row"><span>Velocità</span><span>${Math.floor(p.speed)}</span></div>
      <div class="stat-row"><span>Critico</span><span>${Math.floor((p.crit || 0) * 100)}%</span></div>
      <div class="stat-row"><span>Oro</span><span>${p.gold}</span></div>
    `;
    const skillsEl = document.getElementById('char-skills');
    skillsEl.innerHTML = cls.skills.map(skId => {
      const sk = window.GameData.SKILLS[skId];
      return `<div class="skill-info">
        <span class="sk-icon">${sk.icon}</span>
        <div class="sk-details">
          <div class="sk-name">${sk.name}</div>
          <div class="sk-desc">${sk.desc}</div>
          <div class="sk-meta">MP: ${sk.mp} · CD: ${sk.cd}s</div>
        </div>
      </div>`;
    }).join('');
  }

  // ============================================================
  // Map Panel
  // ============================================================
  renderWorldMap() {
    const canvas = document.getElementById('world-map-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const mapData = window.GameData.MAPS.village;
    const sx = W / mapData.width, sy = H / mapData.height;

    ctx.fillStyle = '#2a3d1c';
    ctx.fillRect(0, 0, W, H);

    mapData.zones.forEach(z => {
      ctx.fillStyle = z.safe ? 'rgba(212,175,55,0.25)' :
        z.id.includes('dungeon') ? 'rgba(100,0,0,0.3)' :
        z.id.includes('haunted') ? 'rgba(70,0,100,0.3)' :
        z.id.includes('demon') ? 'rgba(120,0,0,0.4)' :
        'rgba(255,255,255,0.05)';
      ctx.fillRect(z.x * sx, z.y * sy, z.w * sx, z.h * sy);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.strokeRect(z.x * sx, z.y * sy, z.w * sx, z.h * sy);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '10px sans-serif';
      ctx.fillText(z.name, z.x * sx + 4, z.y * sy + 14);
    });

    // Dungeons
    mapData.dungeons?.forEach(d => {
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(d.x * sx - 4, d.y * sy - 4, 8, 8);
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.fillText(d.entryIcon || '🏚', d.x * sx - 5, d.y * sy + 4);
    });

    // NPCs in village
    Object.values(window.GameData.NPCS).forEach(npc => {
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(npc.x * sx, npc.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Player
    const p = this.gs.player;
    if (p) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d4af37';
      ctx.stroke();
    }

    // Legend
    document.getElementById('map-legend').innerHTML = `
      <span style="color:#d4af37">⬤ Tu</span>
      <span style="color:#00e5ff">⬤ NPC</span>
      <span style="color:#ff1744">⬤ Dungeon</span>
    `;
  }

  // ============================================================
  // NPC Dialogue
  // ============================================================
  openDialogue(npcId) {
    const npc = window.GameData.NPCS[npcId];
    if (!npc) return;
    this._dialogueNpc = npcId;
    const box = document.getElementById('dialogue-box');
    box.classList.remove('hidden');
    document.getElementById('dialogue-portrait').textContent = npc.icon;
    document.getElementById('dialogue-npc-name').textContent = npc.name;
    document.getElementById('dialogue-text').textContent = npc.dialogue.greeting;
    const optEl = document.getElementById('dialogue-options');
    optEl.innerHTML = '';
    npc.dialogue.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'dialogue-opt';
      btn.textContent = opt.text;
      btn.addEventListener('click', () => this._handleDialogueAction(opt, npc));
      optEl.appendChild(btn);
    });
  }

  _handleDialogueAction(opt, npc) {
    switch (opt.action) {
      case 'shop':
        this.closeDialogue();
        this.openShop(opt.shopId || npc.shop, npc.id);
        break;
      case 'heal':
        this.gs.emit('healAtNPC', { npcId: npc.id, cost: opt.cost });
        this.closeDialogue();
        break;
      case 'rest':
        this.gs.emit('restAtInn', { npcId: npc.id, cost: opt.cost });
        this.closeDialogue();
        break;
      case 'quests':
        this.closeDialogue();
        this.togglePanel('quests');
        break;
      case 'turnin':
        this.closeDialogue();
        this.gs.emit('requestTurnIn', { npcId: npc.id });
        break;
      case 'info':
        document.getElementById('dialogue-text').textContent =
          "A ovest c'è la foresta dei lupi. A nord i banditi. Più lontani dal villaggio, nemici più forti. Ci sono anche dungeon per eroi coraggiosi.";
        break;
      case 'close':
      default:
        this.closeDialogue();
    }
  }

  closeDialogue() {
    document.getElementById('dialogue-box').classList.add('hidden');
    this._dialogueNpc = null;
  }

  // ============================================================
  // Shop
  // ============================================================
  openShop(shopId, npcId) {
    const shop = window.GameData.SHOPS[shopId];
    if (!shop) return;
    this._shopNpc = npcId;
    document.getElementById('shop-title').textContent = shop.name;
    document.getElementById('shop-gold').textContent = this.gs.player?.gold || 0;

    const itemsList = document.getElementById('shop-items-list');
    itemsList.innerHTML = shop.items.map(entry => {
      const item = window.GameData.ITEMS[entry.id];
      if (!item) return '';
      const q = window.GameData.ITEM_QUALITY[item.quality];
      const statsStr = Object.entries(item.stats || {}).map(([k, v]) =>
        `${this._statLabel(k)}: +${typeof v === 'number' && v < 1 ? (v * 100).toFixed(1) + '%' : v}`
      ).join(', ');
      return `<div class="shop-item" data-item-id="${item.id}">
        <span class="shop-item-icon">${this._itemIcon(item)}</span>
        <div class="shop-item-info">
          <div class="shop-item-name" style="color:${q}">${item.name}</div>
          <div class="shop-item-stats">${statsStr}</div>
        </div>
        <div class="shop-item-price">💰 ${item.value}</div>
      </div>`;
    }).join('');

    itemsList.querySelectorAll('.shop-item').forEach(el => {
      el.addEventListener('click', () => {
        this.gs.emit('buyItem', { itemId: el.dataset.itemId, npcId });
        setTimeout(() => { document.getElementById('shop-gold').textContent = this.gs.player?.gold || 0; }, 50);
      });
    });

    // Sell list: player's sellable inventory
    this._refreshShopSellList();
    document.getElementById('shop-panel').classList.remove('hidden');
  }

  _refreshShopSellList() {
    const list = document.getElementById('shop-sell-list');
    const p = this.gs.player;
    if (!list || !p) return;
    const inv = (p.inventory || []).map((e, i) => ({ e, i })).filter(x => x.e && x.e.id);
    if (!inv.length) { list.innerHTML = '<div class="shop-empty">Inventario vuoto</div>'; return; }
    list.innerHTML = inv.map(({ e, i }) => {
      const item = window.GameData.ITEMS[e.id];
      if (!item) return '';
      const sellPrice = Math.floor(item.value * 0.4 * (e.qty || 1));
      return `<div class="shop-sell-item" data-slot="${i}">
        <span>${this._itemIcon(item)} ${item.name}</span>
        ${e.qty > 1 ? `<span>x${e.qty}</span>` : ''}
        <span class="sell-price">💰 ${sellPrice}</span>
      </div>`;
    }).join('');
    list.querySelectorAll('.shop-sell-item').forEach(el => {
      el.addEventListener('click', () => {
        this.gs.emit('sellItem', { slotIndex: parseInt(el.dataset.slot) });
        setTimeout(() => {
          document.getElementById('shop-gold').textContent = this.gs.player?.gold || 0;
          this._refreshShopSellList();
        }, 50);
      });
    });
  }

  closeShop() {
    document.getElementById('shop-panel').classList.add('hidden');
    this._shopNpc = null;
  }

  // ============================================================
  // Dungeon Prompt
  // ============================================================
  showDungeonPrompt(dungeonId) {
    const dungeon = window.GameData.DUNGEONS[dungeonId];
    if (!dungeon) return;
    this._pendingDungeon = dungeonId;
    document.getElementById('dprompt-name').textContent = dungeon.name;
    document.getElementById('dprompt-info').textContent =
      `Livello minimo: ${dungeon.minLevel} · Giocatori: fino a ${dungeon.maxPlayers}`;
    document.getElementById('dungeon-prompt').classList.remove('hidden');
  }

  // ============================================================
  // Chat
  // ============================================================
  sendChat(text) {
    if (!text) return;
    const channel = document.getElementById('chat-channel')?.value || 'local';
    this._addChatMessage({ channel, from: this.gs.player?.name || '?', text });
    this.gs.emit('chatMessage', { channel, text });
  }

  _addChatMessage({ channel, from, text }) {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    const colors = { local: '#ccc', global: '#80d8ff', party: '#b9f6ca', system: '#ffe082' };
    const color = colors[channel] || '#ccc';
    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `<span class="chat-channel" style="color:${color}">[${channel}]</span> <span class="chat-from">${from}:</span> ${text}`;
    el.appendChild(msg);
    el.scrollTop = el.scrollHeight;
    while (el.children.length > 60) el.firstChild.remove();
  }

  addSystemMessage(text) {
    this._addChatMessage({ channel: 'system', from: 'Sistema', text });
  }

  // ============================================================
  // Notifications
  // ============================================================
  showNotification(text, type = 'info') {
    const el = document.getElementById('notifications');
    if (!el) return;
    const n = document.createElement('div');
    n.className = `notification notif-${type}`;
    n.textContent = text;
    el.appendChild(n);
    setTimeout(() => n.classList.add('fade-out'), 2500);
    setTimeout(() => n.remove(), 3200);
  }

  // ============================================================
  // Combat log
  // ============================================================
  logCombat(text, cls = '') {
    const el = document.getElementById('combat-log');
    if (!el) return;
    const msg = document.createElement('div');
    msg.className = `clog-msg ${cls}`;
    msg.textContent = text;
    el.prepend(msg);
    while (el.children.length > 10) el.lastChild.remove();
  }

  // ============================================================
  // Death / Respawn
  // ============================================================
  showDeathScreen(stats) {
    document.getElementById('death-stats').innerHTML =
      `Livello ${stats.level} · ${stats.kills} nemici · ${stats.gold} oro`;
    document.getElementById('death-screen').classList.remove('hidden');
  }

  hideDeathScreen() {
    document.getElementById('death-screen').classList.add('hidden');
  }

  // ============================================================
  // ESC Menu
  // ============================================================
  openEscMenu() { document.getElementById('esc-menu').classList.remove('hidden'); }
  closeEscMenu() { document.getElementById('esc-menu').classList.add('hidden'); }
  isEscMenuOpen() { return !document.getElementById('esc-menu').classList.contains('hidden'); }

  // ============================================================
  // Panel toggle
  // ============================================================
  togglePanel(name) {
    const panel = document.getElementById(`panel-${name}`);
    if (!panel) return;
    if (panel.classList.contains('hidden')) this.openPanel(name);
    else this.closePanel(name);
  }

  openPanel(name) {
    // Close any open panel (only one at a time except chat)
    ['inventory', 'quests', 'character', 'map'].forEach(n => {
      if (n !== name) document.getElementById(`panel-${n}`)?.classList.add('hidden');
    });
    const panel = document.getElementById(`panel-${name}`);
    if (!panel) return;
    panel.classList.remove('hidden');
    this._openPanel = name;
    // Refresh content
    if (name === 'inventory') this.renderInventory();
    if (name === 'quests') this.renderQuestList('active');
    if (name === 'character') this.renderCharacterPanel();
    if (name === 'map') this.renderWorldMap();
  }

  closePanel(name) {
    document.getElementById(`panel-${name}`)?.classList.add('hidden');
    if (this._openPanel === name) this._openPanel = null;
    document.getElementById('item-tooltip')?.classList.add('hidden');
  }

  isAnyPanelOpen() {
    return !!(this._openPanel ||
      !document.getElementById('dialogue-box').classList.contains('hidden') ||
      !document.getElementById('shop-panel').classList.contains('hidden'));
  }

  // ============================================================
  // Minimap
  // ============================================================
  updateMinimap(playerX, playerZ, entities) {
    const canvas = document.getElementById('minimap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const mapW = window.GameData.MAPS.village.width;
    const mapH = window.GameData.MAPS.village.height;
    const sx = W / mapW, sz = H / mapH;

    ctx.fillStyle = 'rgba(15,25,15,0.85)';
    ctx.fillRect(0, 0, W, H);

    // Village area
    const vx = 1600 * sx, vy = 1600 * sz;
    ctx.beginPath();
    ctx.arc(vx, vy, 280 * sx, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(212,175,55,0.15)';
    ctx.fill();

    // Dungeon markers
    window.GameData.MAPS.village.dungeons?.forEach(d => {
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(d.x * sx - 3, d.y * sz - 3, 6, 6);
    });

    // NPCs
    Object.values(window.GameData.NPCS).forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x * sx, n.y * sz, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5ff';
      ctx.fill();
    });

    // Mobs
    for (const m of (entities.mobs || [])) {
      ctx.fillStyle = m.state === 'chase' ? '#ef5350' : '#888';
      ctx.fillRect(m.x * sx - 1, m.y * sz - 1, 2, 2);
    }

    // Player
    ctx.beginPath();
    ctx.arc(playerX * sx, playerZ * sz, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Border
    ctx.strokeStyle = '#3a3a50';
    ctx.strokeRect(0, 0, W, H);
  }

  // ============================================================
  // Helpers
  // ============================================================
  _itemIcon(item) {
    if (!item) return '?';
    const icons = {
      sword: '⚔', dagger: '🗡', staff: '🔮', rod: '⚡',
      armor: '🛡', consumable: '🧪', material: '📦',
      ring: '💍', necklace: '📿',
    };
    return icons[item.subtype] || icons[item.type] || '📦';
  }

  _slotEmoji(slot) {
    const m = { weapon: '⚔', chest: '🛡', ring: '💍', necklace: '📿' };
    return m[slot] || '?';
  }

  _slotLabel(slot) {
    const m = { weapon: 'Arma', chest: 'Petto', ring: 'Anello', necklace: 'Collana' };
    return m[slot] || slot;
  }

  _statLabel(stat) {
    const m = { atk: 'ATK', matk: 'M.ATK', def: 'DEF', hp: 'HP', mp: 'MP', speed: 'VEL', crit: 'CRIT' };
    return m[stat] || stat;
  }
}

window.UIManager = UIManager;
