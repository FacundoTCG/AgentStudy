// systems2.js — Extended systems: enhancement (+0/+9), item bonuses,
// alchemy (gems), mounts, cosmetics, skill points, consumable effects.
// Loads after systems.js. Wire-up via window.initExtendedSystems(gs).
'use strict';

(function () {

  // ──────────────────────────────────────────────────────────
  // ItemForge — bonus rolling + enhancement helpers
  // ──────────────────────────────────────────────────────────
  const ItemForge = {
    bonusCount(quality) {
      switch (quality) {
        case 'uncommon': return 1;
        case 'rare': return 1 + (Math.random() < 0.5 ? 1 : 0);
        case 'epic': return 2;
        case 'legendary': return 2 + (Math.random() < 0.6 ? 1 : 0);
        default: return Math.random() < 0.25 ? 1 : 0;
      }
    },

    rollBonuses(itemDef) {
      const pool = window.GameData.BONUS_POOL || [];
      if (!pool.length || !itemDef || !itemDef.slot) return [];
      const n = this.bonusCount(itemDef.quality);
      const picked = [];
      const usedStats = new Set();
      let guard = 40;
      while (picked.length < n && guard-- > 0) {
        const totalW = pool.reduce((s, b) => s + b.weight, 0);
        let roll = Math.random() * totalW;
        let chosen = pool[0];
        for (const b of pool) { roll -= b.weight; if (roll <= 0) { chosen = b; break; } }
        if (usedStats.has(chosen.stat)) continue;
        usedStats.add(chosen.stat);
        const raw = chosen.min + Math.random() * (chosen.max - chosen.min);
        const val = chosen.stat === 'crit' ? Math.round(raw * 1000) / 1000 : Math.round(raw);
        picked.push({ stat: chosen.stat, val, name: chosen.name });
      }
      return picked;
    },

    enhanceCost(itemDef, enh) {
      return Math.floor(itemDef.value * 0.5 * (enh + 1));
    },
  };
  window.ItemForge = ItemForge;

  // ──────────────────────────────────────────────────────────
  // EnhancementSystem — la Forgia (+0 → +9)
  // ──────────────────────────────────────────────────────────
  class EnhancementSystem {
    constructor(gs) { this.gs = gs; }

    enhance(slotIndex) {
      const gs = this.gs;
      const p = gs.player;
      const entry = p.inventory?.[slotIndex];
      if (!entry || !entry.id) return;
      const def = window.GameData.ITEMS[entry.id];
      if (!def || !def.slot) { gs.ui.showNotification('Oggetto non potenziabile', 'error'); return; }

      const enh = entry.enh || 0;
      if (enh >= 9) { gs.ui.showNotification('Già al massimo (+9)!', 'info'); return; }

      const cost = ItemForge.enhanceCost(def, enh);
      if (p.gold < cost) { gs.ui.showNotification(`Servono ${cost} oro`, 'error'); return; }

      if (enh >= 4) {
        if (!this._hasItem('pietra_raffinazione')) {
          gs.ui.showNotification('Serve una Pietra di Raffinazione', 'error');
          return;
        }
        gs.inventory.removeItem('pietra_raffinazione', 1);
      }
      p.gold -= cost;

      const rate = (window.GameData.ENHANCE_RATES || [95, 90, 85, 75, 65, 55, 45, 35, 25])[enh] || 25;
      if (Math.random() * 100 < rate) {
        entry.enh = enh + 1;
        gs.ui.showNotification(`✨ ${def.name} +${entry.enh}!`, 'success');
        gs.renderer.spawnLevelUpEffect(p.x, p.y);
        gs.quests.onEvent?.('enhance_success');
      } else {
        // Fail: blessing scroll protects from level loss
        if (this._hasItem('pergamena_benedizione')) {
          gs.inventory.removeItem('pergamena_benedizione', 1);
          gs.ui.showNotification(`Fallito... ma la Pergamena della Benedizione ha protetto ${def.name}`, 'info');
        } else if (Math.random() < 0.5 && enh > 0) {
          entry.enh = enh - 1;
          gs.ui.showNotification(`💔 Fallito! ${def.name} scende a +${entry.enh}`, 'error');
        } else {
          gs.ui.showNotification(`Fallito! ${def.name} resta +${enh}`, 'error');
        }
      }
      gs.inventory.save();
      gs.inventory.recalcStats();
      gs.emit('inventoryChanged', {});
      gs.emit('uiRefresh', {});
    }

    rerollBonuses(slotIndex) {
      const gs = this.gs;
      const p = gs.player;
      const entry = p.inventory?.[slotIndex];
      if (!entry || !entry.id) return;
      const def = window.GameData.ITEMS[entry.id];
      if (!def || !def.slot) return;
      if (!this._hasItem('pergamena_incantamento')) {
        gs.ui.showNotification('Serve una Pergamena dell\'Incantamento', 'error');
        return;
      }
      gs.inventory.removeItem('pergamena_incantamento', 1);
      entry.bonuses = ItemForge.rollBonuses(def);
      gs.ui.showNotification(`Bonus ritirati per ${def.name}`, 'success');
      gs.inventory.save();
      gs.emit('inventoryChanged', {});
      gs.emit('uiRefresh', {});
    }

    _hasItem(id) {
      return (this.gs.player.inventory || []).some(e => e && e.id === id && (e.qty || 1) > 0);
    }
  }

  // ──────────────────────────────────────────────────────────
  // AlchemySystem — gemme: combinazione 3→1 e incastonatura
  // ──────────────────────────────────────────────────────────
  class AlchemySystem {
    constructor(gs) { this.gs = gs; }

    combine(gemId) {
      const gs = this.gs;
      const def = window.GameData.ITEMS[gemId];
      if (!def || def.type !== 'gem') return;
      if (def.grade >= 5) { gs.ui.showNotification('Grado massimo raggiunto', 'info'); return; }

      const owned = (gs.player.inventory || []).find(e => e && e.id === gemId);
      if (!owned || (owned.qty || 1) < 3) {
        gs.ui.showNotification('Servono 3 gemme uguali', 'error');
        return;
      }
      const nextId = gemId.replace(/_g\d$/, `_g${def.grade + 1}`);
      if (!window.GameData.ITEMS[nextId]) return;

      gs.inventory.removeItem(gemId, 3);
      gs.inventory.addItem(nextId, 1);
      gs.ui.showNotification(`⚗️ Creato: ${window.GameData.ITEMS[nextId].name}!`, 'success');
      gs.emit('inventoryChanged', {});
      gs.emit('uiRefresh', {});
    }

    socket(equipIndex, gemIndex) {
      const gs = this.gs;
      const p = gs.player;
      const equipEntry = p.inventory?.[equipIndex];
      const gemEntry = p.inventory?.[gemIndex];
      if (!equipEntry || !gemEntry) return;
      const equipDef = window.GameData.ITEMS[equipEntry.id];
      const gemDef = window.GameData.ITEMS[gemEntry.id];
      if (!equipDef || !gemDef || gemDef.type !== 'gem') return;

      const sockets = equipDef.sockets || 0;
      equipEntry.gems = equipEntry.gems || [];
      if (equipEntry.gems.length >= sockets) {
        gs.ui.showNotification('Nessun alloggiamento libero', 'error');
        return;
      }
      equipEntry.gems.push(gemEntry.id);
      gs.inventory.removeItem(gemEntry.id, 1);
      gs.ui.showNotification(`💎 ${gemDef.name} incastonato in ${equipDef.name}`, 'success');
      gs.inventory.save();
      gs.inventory.recalcStats();
      gs.emit('inventoryChanged', {});
      gs.emit('uiRefresh', {});
    }
  }

  // ──────────────────────────────────────────────────────────
  // MountSystem — cavalcature (tasto R)
  // ──────────────────────────────────────────────────────────
  class MountSystem {
    constructor(gs) { this.gs = gs; }

    summon(itemId) {
      const gs = this.gs;
      const p = gs.player;
      const def = window.GameData.ITEMS[itemId];
      if (!def || def.type !== 'mount') return;
      const owned = (p.inventory || []).some(e => e && e.id === itemId);
      if (!owned) { gs.ui.showNotification('Non possiedi questa cavalcatura', 'error'); return; }
      if (def.level && p.level < def.level) {
        gs.ui.showNotification(`Richiede livello ${def.level}`, 'error');
        return;
      }
      p.activeMount = itemId;
      gs.inventory.recalcStats();
      gs.renderer.attachMountToPlayer?.(def.style || null);
      gs.ui.showNotification(`🐎 ${def.name} evocato! Velocità +${Math.round((def.stats?.speedMult || 0) * 100)}%`, 'success');
      gs.quests.onEvent?.('mount_summon');
      gs.emit('uiRefresh', {});
    }

    dismiss() {
      const gs = this.gs;
      if (!gs.player.activeMount) return;
      gs.player.activeMount = null;
      gs.inventory.recalcStats();
      gs.renderer.attachMountToPlayer?.(null);
      gs.ui.showNotification('Cavalcatura congedata', 'info');
      gs.emit('uiRefresh', {});
    }

    toggle() {
      const gs = this.gs;
      const p = gs.player;
      if (p.activeMount) { this.dismiss(); return; }
      // Best usable owned mount
      const candidates = (p.inventory || [])
        .filter(e => e && e.id && window.GameData.ITEMS[e.id]?.type === 'mount')
        .map(e => window.GameData.ITEMS[e.id])
        .filter(d => !d.level || p.level >= d.level)
        .sort((a, b) => (b.stats?.speedMult || 0) - (a.stats?.speedMult || 0));
      if (!candidates.length) {
        gs.ui.showNotification('Nessuna cavalcatura utilizzabile — visita la Scuderia di Rocco!', 'info');
        return;
      }
      this.summon(candidates[0].id);
    }
  }

  // ──────────────────────────────────────────────────────────
  // CosmeticsSystem — capigliature (barbiere)
  // ──────────────────────────────────────────────────────────
  class CosmeticsSystem {
    constructor(gs) { this.gs = gs; }

    applyHair(itemId) {
      const gs = this.gs;
      const p = gs.player;
      const def = window.GameData.ITEMS[itemId];
      if (!def || def.type !== 'hair') return;
      const owned = (p.inventory || []).some(e => e && e.id === itemId);
      if (!owned) { gs.ui.showNotification('Acquista prima questa acconciatura', 'error'); return; }
      p.hairstyle = itemId;
      gs.renderer.applyHairstyle?.('player', def.style || null);
      gs.ui.showNotification(`💇 Nuova acconciatura: ${def.name}`, 'success');
      gs.emit('uiRefresh', {});
    }
  }

  // ──────────────────────────────────────────────────────────
  // SkillProgressSystem — punti abilità (1 per livello)
  // ──────────────────────────────────────────────────────────
  class SkillProgressSystem {
    constructor(gs) { this.gs = gs; }

    init() {
      const p = this.gs.player;
      p.skillLevels = p.skillLevels || {};
      if (typeof p.skillPoints !== 'number') {
        const spent = Object.values(p.skillLevels).reduce((s, lv) => s + Math.max(0, lv - 1), 0);
        p.skillPoints = Math.max(0, (p.level - 1) - spent);
      }
      // Award on future level-ups
      this.gs.on('levelUp', () => {
        p.skillPoints = (p.skillPoints || 0) + 1;
        this.gs.ui.showNotification('+1 Punto Abilità! (pannello Abilità dal Maestro Khan)', 'info');
        this.gs.emit('uiRefresh', {});
      });
    }

    upgrade(skillId) {
      const gs = this.gs;
      const p = gs.player;
      const cls = window.GameData.CLASSES[p.classKey];
      if (!cls.skills.includes(skillId)) return;
      if ((p.skillPoints || 0) <= 0) { gs.ui.showNotification('Nessun punto abilità', 'error'); return; }
      const cur = p.skillLevels[skillId] || 1;
      if (cur >= 10) { gs.ui.showNotification('Abilità già al massimo', 'info'); return; }
      p.skillLevels[skillId] = cur + 1;
      p.skillPoints--;
      const sk = window.GameData.SKILLS[skillId];
      gs.ui.showNotification(`${sk?.name} → Lv ${cur + 1} (danno +${(cur) * 8 + 8}%)`, 'success');
      gs.emit('uiRefresh', {});
    }

    static levelOf(player, skillId) {
      return (player.skillLevels && player.skillLevels[skillId]) || 1;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Consumable use (potions, food, elixirs, antidotes)
  // ──────────────────────────────────────────────────────────
  function useConsumable(gs, itemId) {
    const p = gs.player;
    const def = window.GameData.ITEMS[itemId];
    if (!def) return;
    const owned = (p.inventory || []).some(e => e && e.id === itemId && (e.qty || 1) > 0);
    if (!owned) return;

    // Effect shape: { hp, mp, buff:{stat,mult,dur}, cure } — with legacy
    // fallback to stats:{hp,mp} used by the original potions in data.js
    const fx = def.effect || def.stats || {};
    let used = false;

    if (fx.hp) { p.hp = Math.min(p.maxHp, p.hp + fx.hp); gs.renderer.createFloatingText(p.x, p.y, `+${fx.hp} HP`, '#7df58a'); used = true; }
    if (fx.mp) { p.mp = Math.min(p.maxMp, p.mp + fx.mp); gs.renderer.createFloatingText(p.x, p.y, `+${fx.mp} MP`, '#64b5f6'); used = true; }
    if (fx.heal) { const h = Math.floor(p.maxHp * fx.heal); p.hp = Math.min(p.maxHp, p.hp + h); used = true; }
    if (fx.buff) {
      p.buffs = p.buffs.filter(b => b.id !== 'food_' + fx.buff.stat);
      p.buffs.push({ id: 'food_' + fx.buff.stat, name: def.name, stat: fx.buff.stat, mult: fx.buff.mult, t: fx.buff.dur, icon: '🍜' });
      gs.inventory.recalcStats();
      used = true;
    }
    if (fx.cure || def.id === 'antidote') {
      p.debuffs = [];
      gs.ui.showNotification('Veleni curati', 'success');
      used = true;
    }
    if (fx.speedMult && def.type !== 'mount') {
      p.buffs.push({ id: 'elixir_speed', name: def.name, stat: 'speed', mult: 1 + fx.speedMult, t: fx.dur || 60, icon: '⚗️' });
      gs.inventory.recalcStats();
      used = true;
    }

    if (used) {
      gs.inventory.removeItem(itemId, 1);
      gs.ui.logCombat(`Usato: ${def.name}`, 'loot');
      gs.emit('inventoryChanged', {});
    } else {
      gs.ui.showNotification('Questo oggetto non è utilizzabile', 'info');
    }
  }

  // ──────────────────────────────────────────────────────────
  // Wire everything to the event bus
  // ──────────────────────────────────────────────────────────
  function initExtendedSystems(gs) {
    gs.enhancement = new EnhancementSystem(gs);
    gs.alchemy = new AlchemySystem(gs);
    gs.mounts = new MountSystem(gs);
    gs.cosmetics = new CosmeticsSystem(gs);
    gs.skillProgress = new SkillProgressSystem(gs);
    gs.skillProgress.init();

    gs.on('enhanceItem', ({ slotIndex }) => gs.enhancement.enhance(slotIndex));
    gs.on('rerollBonuses', ({ slotIndex }) => gs.enhancement.rerollBonuses(slotIndex));
    gs.on('combineGems', ({ gemId }) => gs.alchemy.combine(gemId));
    gs.on('socketGem', ({ equipIndex, gemIndex }) => gs.alchemy.socket(equipIndex, gemIndex));
    gs.on('summonMount', ({ itemId }) => gs.mounts.summon(itemId));
    gs.on('dismissMount', () => gs.mounts.dismiss());
    gs.on('toggleMount', () => gs.mounts.toggle());
    gs.on('applyHair', ({ itemId }) => gs.cosmetics.applyHair(itemId));
    gs.on('upgradeSkill', ({ skillId }) => gs.skillProgress.upgrade(skillId));
    gs.on('useItem', ({ itemId }) => useConsumable(gs, itemId));

    // Restore persisted visuals (mount + hair) after the player mesh exists
    const p = gs.player;
    setTimeout(() => {
      if (p.activeMount) {
        const d = window.GameData.ITEMS[p.activeMount];
        if (d) gs.renderer.attachMountToPlayer?.(d.style || null);
      }
      if (p.hairstyle) {
        const d = window.GameData.ITEMS[p.hairstyle];
        if (d) gs.renderer.applyHairstyle?.('player', d.style || null);
      }
    }, 300);
  }
  window.initExtendedSystems = initExtendedSystems;

  window.EnhancementSystem = EnhancementSystem;
  window.AlchemySystem = AlchemySystem;
  window.MountSystem = MountSystem;
  window.CosmeticsSystem = CosmeticsSystem;
  window.SkillProgressSystem = SkillProgressSystem;
})();
