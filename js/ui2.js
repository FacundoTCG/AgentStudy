'use strict';

class UIExtensions {
  constructor(gs) {
    this.gs = gs;
    this._openExtPanel = null;
    this._forgeSelectedSlot = null;
    this._alchEquipIndex = null;
    this._alchGemIndex = null;

    this._buildDOM();
    this._bindEvents();
    this._bindGameEvents();
  }

  // ============================================================
  // DOM Construction
  // ============================================================
  _buildDOM() {
    const root = document.getElementById('ui-root');
    if (!root) return;

    const container = document.createElement('div');
    container.id = 'ext-panels-container';
    container.innerHTML = `
<!-- PANEL: FORGIA -->
<div id="panel-forge" class="game-panel ext-panel hidden">
  <div class="panel-header">
    ⚒ Forgia
    <button class="close-btn ext-close-btn" data-extpanel="forge">✕</button>
  </div>
  <div class="ext-panel-body">
    <div class="panel-section-title">Oro disponibile: <span id="forge-gold" class="forge-gold-value">0</span> 💰</div>
    <div class="panel-section-title">Seleziona un oggetto da potenziare</div>
    <div id="forge-item-list" class="forge-item-list"></div>
    <div id="forge-selected-info" class="forge-selected-info hidden">
      <div class="panel-section-title">Dettaglio oggetto selezionato</div>
      <div id="forge-bonus-list" class="forge-bonus-list"></div>
      <div id="forge-gem-info" class="forge-gem-info"></div>
      <button id="forge-enhance-btn" class="forge-enhance-btn">⚒ POTENZIA</button>
    </div>
  </div>
</div>

<!-- PANEL: ALCHIMIA -->
<div id="panel-alchemy" class="game-panel ext-panel hidden">
  <div class="panel-header">
    💎 Alchimia
    <button class="close-btn ext-close-btn" data-extpanel="alchemy">✕</button>
  </div>
  <div class="ext-panel-body">
    <div class="panel-section-title">Le tue gemme</div>
    <div id="alchemy-gem-grid" class="gem-grid"></div>
    <div class="panel-section-title">Incastona gemma</div>
    <div class="alchemy-socket-row">
      <div class="alchemy-socket-col">
        <div class="alchemy-socket-label">Equipaggiamento (con slot liberi)</div>
        <div id="alchemy-equip-list" class="alchemy-select-list"></div>
      </div>
      <div class="alchemy-socket-col">
        <div class="alchemy-socket-label">Gemma da incastonare</div>
        <div id="alchemy-gem-list" class="alchemy-select-list"></div>
      </div>
    </div>
    <button id="alchemy-socket-btn" class="alchemy-socket-btn">💎 INCASTONA</button>
  </div>
</div>

<!-- PANEL: SCUDERIA -->
<div id="panel-stable" class="game-panel ext-panel hidden">
  <div class="panel-header">
    🐎 Scuderia
    <button class="close-btn ext-close-btn" data-extpanel="stable">✕</button>
  </div>
  <div class="ext-panel-body">
    <div class="panel-section-title">Le tue cavalcature</div>
    <div id="stable-mount-list" class="mount-list"></div>
    <div id="stable-empty" class="ext-empty-msg hidden">Nessuna cavalcatura posseduta.</div>
  </div>
</div>

<!-- PANEL: BARBIERE -->
<div id="panel-barber" class="game-panel ext-panel hidden">
  <div class="panel-header">
    💇 Barbiere
    <button class="close-btn ext-close-btn" data-extpanel="barber">✕</button>
  </div>
  <div class="ext-panel-body">
    <div class="panel-section-title">Acconciature disponibili</div>
    <div id="barber-hair-grid" class="hair-grid"></div>
    <div id="barber-empty" class="ext-empty-msg hidden">Nessuna acconciatura posseduta.</div>
  </div>
</div>

<!-- PANEL: ABILITÀ -->
<div id="panel-skills" class="game-panel ext-panel hidden">
  <div class="panel-header">
    ✨ Abilità
    <button class="close-btn ext-close-btn" data-extpanel="skills">✕</button>
  </div>
  <div class="ext-panel-body">
    <div class="skills-points-bar">
      Punti abilità: <span id="skills-points-value" class="skills-points-num">0</span>
    </div>
    <div id="skills-upgrade-list" class="skills-upgrade-list"></div>
  </div>
</div>
`;
    root.appendChild(container);
  }

  // ============================================================
  // Event Bindings
  // ============================================================
  _bindEvents() {
    // Close buttons for ext panels
    document.querySelectorAll('.ext-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.extpanel;
        if (name) this.closeExtPanel(name);
      });
    });

    // Forge enhance button
    const forgeBtn = document.getElementById('forge-enhance-btn');
    if (forgeBtn) {
      forgeBtn.addEventListener('click', () => {
        if (this._forgeSelectedSlot !== null) {
          this.gs.emit('enhanceItem', { slotIndex: this._forgeSelectedSlot });
        }
      });
    }

    // Alchemy socket button
    const socketBtn = document.getElementById('alchemy-socket-btn');
    if (socketBtn) {
      socketBtn.addEventListener('click', () => {
        if (this._alchEquipIndex !== null && this._alchGemIndex !== null) {
          this.gs.emit('socketGem', {
            equipIndex: this._alchEquipIndex,
            gemIndex: this._alchGemIndex
          });
        }
      });
    }
  }

  _bindGameEvents() {
    const gs = this.gs;

    gs.on('inventoryChanged', () => {
      this._rerenderOpenPanel();
    });

    gs.on('uiRefresh', () => {
      this._rerenderOpenPanel();
    });

    gs.on('enhanceItem', () => {
      // Refresh forge after enhancement attempt (slight delay for state to settle)
      setTimeout(() => this.renderForge(), 50);
    });

    gs.on('socketGem', () => {
      setTimeout(() => {
        this._alchEquipIndex = null;
        this._alchGemIndex = null;
        this.renderAlchemy();
      }, 50);
    });

    gs.on('combineGems', () => {
      setTimeout(() => this.renderAlchemy(), 50);
    });

    gs.on('summonMount', () => {
      setTimeout(() => this.renderStable(), 50);
    });

    gs.on('dismissMount', () => {
      setTimeout(() => this.renderStable(), 50);
    });

    gs.on('applyHair', () => {
      setTimeout(() => this.renderBarber(), 50);
    });

    gs.on('upgradeSkill', () => {
      setTimeout(() => this.renderSkills(), 50);
    });
  }

  _rerenderOpenPanel() {
    switch (this._openExtPanel) {
      case 'forge':    this.renderForge();   break;
      case 'alchemy':  this.renderAlchemy(); break;
      case 'stable':   this.renderStable();  break;
      case 'barber':   this.renderBarber();  break;
      case 'skills':   this.renderSkills();  break;
    }
  }

  // ============================================================
  // Panel Management
  // ============================================================
  openExtPanel(name) {
    // Close all other ext panels
    ['forge', 'alchemy', 'stable', 'barber', 'skills'].forEach(n => {
      if (n !== name) {
        const p = document.getElementById(`panel-${n}`);
        if (p) p.classList.add('hidden');
      }
    });

    // Close base UI panels
    const ui = this.gs.ui;
    if (ui) {
      ['inventory', 'quests', 'character', 'map'].forEach(n => ui.closePanel(n));
    }

    const panel = document.getElementById(`panel-${name}`);
    if (!panel) return;
    panel.classList.remove('hidden');
    this._openExtPanel = name;

    // Render the panel content
    switch (name) {
      case 'forge':   this.renderForge();   break;
      case 'alchemy': this.renderAlchemy(); break;
      case 'stable':  this.renderStable();  break;
      case 'barber':  this.renderBarber();  break;
      case 'skills':  this.renderSkills();  break;
    }
  }

  closeExtPanel(name) {
    const panel = document.getElementById(`panel-${name}`);
    if (panel) panel.classList.add('hidden');
    if (this._openExtPanel === name) this._openExtPanel = null;
  }

  toggleExtPanel(name) {
    const panel = document.getElementById(`panel-${name}`);
    if (!panel) return;
    if (panel.classList.contains('hidden')) {
      this.openExtPanel(name);
    } else {
      this.closeExtPanel(name);
    }
  }

  // ============================================================
  // PANEL 1 — FORGIA
  // ============================================================
  renderForge() {
    const p = this.gs.player;

    // Update gold display
    const goldEl = document.getElementById('forge-gold');
    if (goldEl) goldEl.textContent = p ? (p.gold || 0) : 0;

    const list = document.getElementById('forge-item-list');
    if (!list) return;

    const inv = p?.inventory || [];
    const equipEntries = [];
    inv.forEach((entry, idx) => {
      if (!entry || !entry.id) return;
      const item = window.GameData.ITEMS[entry.id];
      if (!item) return;
      if (item.type === 'weapon' || item.type === 'armor' || item.type === 'jewelry') {
        equipEntries.push({ entry, item, idx });
      }
    });

    if (!equipEntries.length) {
      list.innerHTML = '<div class="ext-empty-msg">Nessun oggetto potenziabile nell\'inventario.</div>';
      this._hideForgeInfo();
      return;
    }

    const rates = window.GameData?.ENHANCE_RATES || [95,90,85,75,65,55,45,35,25];

    list.innerHTML = equipEntries.map(({ entry, item, idx }) => {
      const enh = entry.enh || 0;
      const qualColor = window.GameData.ITEM_QUALITY[item.quality] || '#aaa';
      const nextRate = enh < rates.length ? rates[enh] : null;
      const cost = Math.floor(item.value * 0.5 * (enh + 1));
      const needsPietra = enh >= 4;
      const rateClass = nextRate !== null ? (nextRate >= 65 ? 'rate-good' : nextRate >= 35 ? 'rate-mid' : 'rate-bad') : '';
      const isSelected = this._forgeSelectedSlot === idx;
      const enhSuffix = enh > 0 ? `<span class="enh-level">+${enh}</span>` : '';

      return `<div class="forge-item${isSelected ? ' selected' : ''}" data-slot="${idx}" style="border-color:${qualColor}">
        <span class="forge-item-icon">${this._itemIcon(item)}</span>
        <div class="forge-item-info">
          <div class="forge-item-name">${item.name}${enhSuffix}</div>
          <div class="forge-item-meta">
            ${item.quality.charAt(0).toUpperCase() + item.quality.slice(1)}
            ${item.level ? ` · Lv ${item.level}` : ''}
          </div>
        </div>
        <div class="forge-item-right">
          ${nextRate !== null
            ? `<div class="forge-rate ${rateClass}">${nextRate}%</div>`
            : '<div class="forge-rate rate-max">MAX</div>'
          }
          <div class="forge-cost">💰 ${cost}</div>
          ${needsPietra ? '<div class="forge-needs-mat" title="Richiede Pietra di Raffinazione">📦 Pietra</div>' : ''}
        </div>
      </div>`;
    }).join('');

    // Bind click on forge items
    list.querySelectorAll('.forge-item').forEach(el => {
      el.addEventListener('click', () => {
        const slot = parseInt(el.dataset.slot);
        if (this._forgeSelectedSlot === slot) {
          this._forgeSelectedSlot = null;
          this._hideForgeInfo();
          el.classList.remove('selected');
        } else {
          this._forgeSelectedSlot = slot;
          list.querySelectorAll('.forge-item').forEach(x => x.classList.remove('selected'));
          el.classList.add('selected');
          this._showForgeInfo(slot);
        }
      });
    });

    // Re-show selected info if still valid
    if (this._forgeSelectedSlot !== null) {
      const stillValid = equipEntries.some(({ idx }) => idx === this._forgeSelectedSlot);
      if (stillValid) {
        this._showForgeInfo(this._forgeSelectedSlot);
      } else {
        this._forgeSelectedSlot = null;
        this._hideForgeInfo();
      }
    }
  }

  _showForgeInfo(slotIndex) {
    const infoEl = document.getElementById('forge-selected-info');
    if (!infoEl) return;
    const p = this.gs.player;
    const entry = p?.inventory?.[slotIndex];
    if (!entry || !entry.id) { this._hideForgeInfo(); return; }
    const item = window.GameData.ITEMS[entry.id];
    if (!item) { this._hideForgeInfo(); return; }

    infoEl.classList.remove('hidden');

    // Bonuses
    const bonusList = document.getElementById('forge-bonus-list');
    if (bonusList) {
      const bonuses = entry.bonuses || [];
      const baseStats = Object.entries(item.stats || {});
      let html = '';
      if (baseStats.length) {
        html += '<div class="forge-bonus-section">Stats base:</div>';
        html += baseStats.map(([stat, val]) =>
          `<div class="forge-bonus-row"><span class="forge-bonus-stat">${this._statLabel(stat)}</span><span class="forge-bonus-val">+${typeof val === 'number' && val < 1 && val > 0 ? (val * 100).toFixed(1) + '%' : val}</span></div>`
        ).join('');
      }
      if (bonuses.length) {
        html += '<div class="forge-bonus-section">Bonus potenziamento:</div>';
        html += bonuses.map(b =>
          `<div class="forge-bonus-row"><span class="forge-bonus-stat">${this._statLabel(b.stat)}</span><span class="forge-bonus-val enh-bonus">+${typeof b.val === 'number' && b.val < 1 && b.val > 0 ? (b.val * 100).toFixed(1) + '%' : b.val}</span></div>`
        ).join('');
      }
      if (!baseStats.length && !bonuses.length) {
        html = '<div class="ext-empty-msg">Nessun bonus.</div>';
      }
      bonusList.innerHTML = html;
    }

    // Gem info
    const gemInfo = document.getElementById('forge-gem-info');
    if (gemInfo) {
      const gems = entry.gems || [];
      const sockets = item.sockets || 0;
      if (sockets > 0) {
        const gemNames = gems.map(gId => {
          const g = window.GameData.ITEMS[gId];
          return g ? `<span class="forge-gem-chip">${this._itemIcon(g)} ${g.name}</span>` : '<span class="forge-gem-chip">?</span>';
        }).join('');
        const emptySlots = sockets - gems.length;
        const emptyHtml = emptySlots > 0
          ? Array(emptySlots).fill('<span class="forge-gem-empty">○ vuoto</span>').join('')
          : '';
        gemInfo.innerHTML = `<div class="forge-gem-row">
          <span class="forge-gem-label">Incastonature ${gems.length}/${sockets}:</span>
          ${gemNames}${emptyHtml}
        </div>`;
      } else {
        gemInfo.innerHTML = '<div class="forge-gem-row"><span class="forge-gem-label">Nessuno slot gemma.</span></div>';
      }
    }
  }

  _hideForgeInfo() {
    const el = document.getElementById('forge-selected-info');
    if (el) el.classList.add('hidden');
  }

  // ============================================================
  // PANEL 2 — ALCHIMIA
  // ============================================================
  renderAlchemy() {
    this._renderAlchemyGems();
    this._renderAlchemySocket();
  }

  _renderAlchemyGems() {
    const grid = document.getElementById('alchemy-gem-grid');
    if (!grid) return;
    const p = this.gs.player;
    const inv = p?.inventory || [];

    // Group gems by id
    const gemMap = {};
    inv.forEach((entry, idx) => {
      if (!entry || !entry.id) return;
      const item = window.GameData.ITEMS[entry.id];
      if (!item || item.type !== 'gem') return;
      if (!gemMap[entry.id]) gemMap[entry.id] = { item, qty: 0, invIdx: idx };
      gemMap[entry.id].qty += (entry.qty || 1);
    });

    const gems = Object.values(gemMap);
    if (!gems.length) {
      grid.innerHTML = '<div class="ext-empty-msg">Nessuna gemma nell\'inventario.</div>';
      return;
    }

    const gemTypeColors = {
      rubino:   '#e53935',
      zaffiro:  '#1e88e5',
      smeraldo: '#43a047',
      ametista: '#8e24aa',
      topazio:  '#fdd835'
    };

    grid.innerHTML = gems.map(({ item, qty }) => {
      const grade = item.grade || 1;
      const gradeRoman = this._toRoman(grade);
      const typeColor = gemTypeColors[item.gemType] || '#aaa';
      const canCombine = qty >= 3 && grade < 5;

      return `<div class="gem-card" style="border-color:${typeColor}">
        <div class="gem-icon">💎</div>
        <div class="gem-grade" style="background:${typeColor}">${gradeRoman}</div>
        <div class="gem-name" style="color:${typeColor}">${item.name}</div>
        <div class="gem-qty">x${qty}</div>
        ${canCombine
          ? `<button class="gem-combine-btn" data-gemid="${item.id}" style="border-color:${typeColor};color:${typeColor}">Combina 3→1</button>`
          : grade >= 5
            ? '<div class="gem-max-badge">MAX</div>'
            : `<div class="gem-need-more">Serve x${3 - qty}</div>`
        }
      </div>`;
    }).join('');

    grid.querySelectorAll('.gem-combine-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.gs.emit('combineGems', { gemId: btn.dataset.gemid });
      });
    });
  }

  _renderAlchemySocket() {
    const equipList = document.getElementById('alchemy-equip-list');
    const gemList = document.getElementById('alchemy-gem-list');
    if (!equipList || !gemList) return;

    const p = this.gs.player;
    const inv = p?.inventory || [];

    // Equipment with free socket slots
    const equipEntries = [];
    inv.forEach((entry, idx) => {
      if (!entry || !entry.id) return;
      const item = window.GameData.ITEMS[entry.id];
      if (!item) return;
      if (item.type !== 'weapon' && item.type !== 'armor' && item.type !== 'jewelry') return;
      const sockets = item.sockets || 0;
      const gemsUsed = (entry.gems || []).length;
      if (sockets > gemsUsed) equipEntries.push({ entry, item, idx, freeSlots: sockets - gemsUsed });
    });

    // Gems in inventory
    const gemEntries = [];
    inv.forEach((entry, idx) => {
      if (!entry || !entry.id) return;
      const item = window.GameData.ITEMS[entry.id];
      if (item && item.type === 'gem') gemEntries.push({ entry, item, idx });
    });

    // Render equip list
    if (!equipEntries.length) {
      equipList.innerHTML = '<div class="alchemy-select-empty">Nessun oggetto con slot liberi.</div>';
    } else {
      equipList.innerHTML = equipEntries.map(({ item, idx, freeSlots }) => {
        const qColor = window.GameData.ITEM_QUALITY[item.quality] || '#aaa';
        const isSelected = this._alchEquipIndex === idx;
        return `<div class="alchemy-select-item${isSelected ? ' selected' : ''}" data-idx="${idx}" style="border-color:${isSelected ? '#d4af37' : qColor}">
          <span class="alchemy-si-icon">${this._itemIcon(item)}</span>
          <span class="alchemy-si-name" style="color:${qColor}">${item.name}</span>
          <span class="alchemy-si-slots">${freeSlots} slot</span>
        </div>`;
      }).join('');

      equipList.querySelectorAll('.alchemy-select-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx);
          this._alchEquipIndex = this._alchEquipIndex === idx ? null : idx;
          this._renderAlchemySocket();
        });
      });
    }

    // Render gem list
    if (!gemEntries.length) {
      gemList.innerHTML = '<div class="alchemy-select-empty">Nessuna gemma.</div>';
    } else {
      const gemTypeColors = {
        rubino: '#e53935', zaffiro: '#1e88e5', smeraldo: '#43a047',
        ametista: '#8e24aa', topazio: '#fdd835'
      };
      gemList.innerHTML = gemEntries.map(({ item, idx }) => {
        const typeColor = gemTypeColors[item.gemType] || '#aaa';
        const gradeRoman = this._toRoman(item.grade || 1);
        const isSelected = this._alchGemIndex === idx;
        return `<div class="alchemy-select-item${isSelected ? ' selected' : ''}" data-idx="${idx}" style="border-color:${isSelected ? '#d4af37' : typeColor}">
          <span class="alchemy-si-icon">💎</span>
          <span class="alchemy-si-name" style="color:${typeColor}">${item.name}</span>
          <span class="alchemy-si-slots gem-grade-badge" style="background:${typeColor}">${gradeRoman}</span>
        </div>`;
      }).join('');

      gemList.querySelectorAll('.alchemy-select-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx);
          this._alchGemIndex = this._alchGemIndex === idx ? null : idx;
          this._renderAlchemySocket();
        });
      });
    }

    // Update socket button state
    const socketBtn = document.getElementById('alchemy-socket-btn');
    if (socketBtn) {
      const enabled = this._alchEquipIndex !== null && this._alchGemIndex !== null;
      socketBtn.disabled = !enabled;
      socketBtn.classList.toggle('disabled', !enabled);
    }
  }

  // ============================================================
  // PANEL 3 — SCUDERIA
  // ============================================================
  renderStable() {
    const list = document.getElementById('stable-mount-list');
    const emptyMsg = document.getElementById('stable-empty');
    if (!list) return;

    const p = this.gs.player;
    const inv = p?.inventory || [];
    const activeMount = p?.activeMount || null;

    const mounts = [];
    inv.forEach((entry, idx) => {
      if (!entry || !entry.id) return;
      const item = window.GameData.ITEMS[entry.id];
      if (item && item.type === 'mount') mounts.push({ entry, item, idx });
    });

    if (!mounts.length) {
      list.innerHTML = '';
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      return;
    }

    if (emptyMsg) emptyMsg.classList.add('hidden');

    list.innerHTML = mounts.map(({ entry, item }) => {
      const isActive = activeMount === entry.id;
      const speedPct = item.speedMult !== undefined
        ? Math.round(item.speedMult * 100)
        : null;
      const reqLevel = item.level || 1;

      return `<div class="mount-card${isActive ? ' active' : ''}" data-itemid="${entry.id}">
        <div class="mount-icon">🐎</div>
        <div class="mount-info">
          <div class="mount-name">${item.name}</div>
          <div class="mount-meta">
            ${speedPct !== null ? `<span class="mount-speed">+${speedPct}% velocità</span>` : ''}
            <span class="mount-level">Lv min ${reqLevel}</span>
          </div>
        </div>
        <div class="mount-action">
          ${isActive
            ? '<span class="mount-active-badge">ATTIVA</span>'
            : '<span class="mount-inactive-badge">Inattiva</span>'
          }
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('.mount-card').forEach(el => {
      el.addEventListener('click', () => {
        const itemId = el.dataset.itemid;
        if (activeMount === itemId) {
          this.gs.emit('dismissMount', {});
        } else {
          this.gs.emit('summonMount', { itemId });
        }
      });
    });
  }

  // ============================================================
  // PANEL 4 — BARBIERE
  // ============================================================
  renderBarber() {
    const grid = document.getElementById('barber-hair-grid');
    const emptyMsg = document.getElementById('barber-empty');
    if (!grid) return;

    const p = this.gs.player;
    const inv = p?.inventory || [];
    const currentHair = p?.hairstyle || null;

    const hairItems = [];
    inv.forEach((entry) => {
      if (!entry || !entry.id) return;
      const item = window.GameData.ITEMS[entry.id];
      if (item && item.type === 'hair') hairItems.push({ entry, item });
    });

    if (!hairItems.length) {
      grid.innerHTML = '';
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      return;
    }

    if (emptyMsg) emptyMsg.classList.add('hidden');

    grid.innerHTML = hairItems.map(({ entry, item }) => {
      const isCurrent = currentHair === entry.id;
      const swatchColor = item.style?.color || '#888';

      return `<div class="hair-card${isCurrent ? ' active' : ''}" data-itemid="${entry.id}">
        <div class="hair-icon">💇</div>
        <div class="hair-swatch" style="background:${swatchColor}" title="${swatchColor}"></div>
        <div class="hair-name">${item.name}</div>
        ${isCurrent ? '<div class="hair-active-badge">Attuale</div>' : ''}
      </div>`;
    }).join('');

    grid.querySelectorAll('.hair-card').forEach(el => {
      el.addEventListener('click', () => {
        const itemId = el.dataset.itemid;
        if (currentHair !== itemId) {
          this.gs.emit('applyHair', { itemId });
        }
      });
    });
  }

  // ============================================================
  // PANEL 5 — ABILITÀ
  // ============================================================
  renderSkills() {
    const listEl = document.getElementById('skills-upgrade-list');
    const pointsEl = document.getElementById('skills-points-value');
    if (!listEl) return;

    const p = this.gs.player;
    const skillPoints = p?.skillPoints || 0;
    if (pointsEl) pointsEl.textContent = skillPoints;

    const classKey = p?.classKey;
    if (!classKey || !window.GameData?.CLASSES?.[classKey]) {
      listEl.innerHTML = '<div class="ext-empty-msg">Classe non trovata.</div>';
      return;
    }

    const cls = window.GameData.CLASSES[classKey];
    const classSkills = cls.skills || [];
    const skillLevels = p?.skillLevels || {};

    listEl.innerHTML = classSkills.map(skillId => {
      const sk = window.GameData.SKILLS?.[skillId];
      if (!sk) return '';
      const level = skillLevels[skillId] || 0;
      const canUpgrade = skillPoints > 0 && level < 10;

      return `<div class="skill-upgrade-row">
        <div class="skill-upgrade-icon">${sk.icon || '✨'}</div>
        <div class="skill-upgrade-info">
          <div class="skill-upgrade-name">${sk.name}</div>
          <div class="skill-upgrade-desc">${sk.desc || ''}</div>
          <div class="skill-upgrade-meta">
            <span class="skill-mp-cost">MP: ${sk.mp}</span>
            <span class="skill-cd-info">CD: ${sk.cd}s</span>
          </div>
        </div>
        <div class="skill-upgrade-right">
          <div class="skill-upgrade-level">Lv <span class="skill-lv-num">${level}</span>/10</div>
          <button class="plus-btn${canUpgrade ? '' : ' disabled'}"
            data-skillid="${skillId}"
            ${canUpgrade ? '' : 'disabled'}
          >+</button>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.plus-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        this.gs.emit('upgradeSkill', { skillId: btn.dataset.skillid });
      });
    });
  }

  // ============================================================
  // Helpers
  // ============================================================
  _itemIcon(item) {
    if (!item) return '?';
    const map = {
      weapon:     '⚔',
      armor:      '🛡',
      jewelry:    '💍',
      gem:        '💎',
      mount:      '🐎',
      hair:       '💇',
      scroll:     '📜',
      consumable: '🧪',
      material:   '📦'
    };
    return map[item.type] || '📦';
  }

  _statLabel(stat) {
    const m = {
      atk: 'ATK', matk: 'M.ATK', def: 'DEF',
      hp: 'HP', mp: 'MP', speed: 'VEL', crit: 'CRIT',
      hp_regen: 'HP Regen', mp_regen: 'MP Regen',
      dodge: 'Schivata', res: 'Resistenza'
    };
    return m[stat] || stat.toUpperCase();
  }

  _toRoman(n) {
    const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
    return map[n] || String(n);
  }
}

// ============================================================
// Monkey-patch UIManager._handleDialogueAction
// ============================================================
if (window.UIManager) {
  const origHandle = window.UIManager.prototype._handleDialogueAction;
  window.UIManager.prototype._handleDialogueAction = function(opt, npc) {
    const map = {
      open_forge:   'forge',
      open_alchemy: 'alchemy',
      open_stable:  'stable',
      open_barber:  'barber',
      open_skills:  'skills'
    };
    if (map[opt.action]) {
      this.closeDialogue();
      window.gameState?.ui2?.toggleExtPanel(map[opt.action]);
      return;
    }
    return origHandle.call(this, opt, npc);
  };
}

window.UIExtensions = UIExtensions;
