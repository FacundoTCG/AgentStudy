// systems.js — All game logic systems for Regni d'Oriente
// Depends on: window.GameData (data.js), window.gameState (main.js after init)
'use strict';

// ============================================================
// Combat System
// ============================================================
class CombatSystem {
  constructor(gs) { this.gs = gs; }

  // Core damage formula
  calcDamage(atk, def, mult = 1.0, isMagic = false) {
    const base = isMagic ? (atk * mult) : (atk * mult);
    const reduced = isMagic ? Math.max(1, base - def * 0.35) : Math.max(1, base - def);
    const rolled = reduced * (0.88 + Math.random() * 0.24);
    return Math.floor(rolled);
  }

  // Player attacks with basic hit
  playerBasicAttack() {
    const p = this.gs.player;
    if (!p || p.dead || p.atkCd > 0) return;

    const cls = window.GameData.CLASSES[p.classKey];
    const range = cls.baseStats.range || (cls.weaponTypes.includes('staff') || cls.weaponTypes.includes('rod') ? 250 : 60);
    const isRanged = range > 100;

    const t = this._getTarget(range + 30);
    if (!t) return;

    p.atkCd = 0.55;
    p.dir = Math.atan2(t.y - p.y, t.x - p.x);
    p.animState = 'attack';

    const isMagic = cls.weaponTypes.includes('staff') || cls.weaponTypes.includes('rod');
    const atkVal = isMagic ? (p.matk || 0) : p.atk;
    let dmg = this.calcDamage(atkVal, t.type ? t.type.baseDef : 0, 1.0, isMagic);
    const crit = Math.random() < (p.crit || 0.05);
    if (crit) dmg = Math.floor(dmg * 2);

    if (isRanged) {
      this._spawnProjectile(t, dmg, crit);
    } else {
      this._applyDamage(t, dmg, crit);
    }
  }

  _getTarget(range) {
    const p = this.gs.player;
    if (p.target && p.target.hp > 0 && Math.hypot(p.target.x - p.x, p.target.y - p.y) <= range + 20) {
      return p.target;
    }
    let best = null, bd = range;
    for (const e of [...this.gs.mobs, ...this.gs.stones]) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) p.target = best;
    return best;
  }

  _spawnProjectile(target, dmg, crit) {
    const p = this.gs.player;
    const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const cls = window.GameData.CLASSES[p.classKey];
    const projType = cls.weaponTypes.includes('staff') ? 'fire' : 'lightning';
    const mesh = this.gs.renderer.createProjectileMesh(projType);
    this.gs.renderer.addEntity(id, mesh, { type: 'projectile' });

    this.gs.projectiles.push({
      id, target, dmg, crit,
      x: p.x, y: p.y,
      speed: 420, life: 1.8,
      color: cls.color,
    });
    this.gs.renderer.updateEntityPosition(id, p.x, p.y, p.dir, 'idle');
  }

  _applyDamage(entity, dmg, crit) {
    entity.hp -= dmg;
    this.gs.renderer.spawnHitEffect(entity.x, entity.y, crit);
    this.gs.renderer.createFloatingText(entity.x, entity.y, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd75e' : '#fff');
    this.gs.ui.logCombat(`Colpito ${entity.type?.name || 'bersaglio'} per ${dmg}${crit ? ' (CRITICO)' : ''} danni`, 'combat');
    if (entity.type) entity.state = 'chase';
    if (entity.hp <= 0) this._killEntity(entity);
  }

  // Use a skill by index (0-7); damage scales with skill level (+8%/lv)
  useSkill(index) {
    const p = this.gs.player;
    if (!p || p.dead) return;
    const cls = window.GameData.CLASSES[p.classKey];
    const skId = cls.skills[index];
    if (!skId) return;
    let sk = window.GameData.SKILLS[skId];
    if (!sk) return;
    const skillLv = (p.skillLevels && p.skillLevels[skId]) || 1;
    if (skillLv > 1 && sk.mult) {
      sk = { ...sk, mult: sk.mult * (1 + 0.08 * (skillLv - 1)) };
    }
    if (p.skillCds[index] > 0) {
      this.gs.ui.showNotification(`${sk.name}: in ricarica (${Math.ceil(p.skillCds[index])}s)`, 'info');
      return;
    }
    if (p.mp < sk.mp) {
      this.gs.ui.showNotification('MP insufficienti!', 'error');
      return;
    }
    p.mp -= sk.mp;
    p.skillCds[index] = sk.cd;
    p.animState = 'attack';
    this._executeSkill(sk, p);
  }

  _executeSkill(sk, p) {
    const allEnemies = [...this.gs.mobs, ...this.gs.stones];

    switch (sk.type) {
      case 'aoe': {
        let hits = 0;
        for (const e of allEnemies) {
          if (Math.hypot(e.x - p.x, e.y - p.y) <= sk.radius) {
            const isMag = sk.name.includes('Fulmine') || sk.name.includes('Tempesta') || sk.name.includes('Infuocata');
            const dmg = this.calcDamage(isMag ? (p.matk || p.atk) : p.atk, e.type?.baseDef || 0, sk.mult, isMag);
            const crit = Math.random() < (p.crit || 0.05);
            this._applyDamage(e, crit ? dmg * 2 : dmg, crit);
            if (sk.stun && Math.random() < sk.stun) e.stunTimer = 1.5;
            hits++;
          }
        }
        this.gs.renderer.spawnSkillEffect(sk, p.x, p.y, p.x, p.y);
        if (!hits) this.gs.ui.showNotification('Nessun bersaglio nell\'area', 'info');
        break;
      }

      case 'multi': {
        const t = p.target && p.target.hp > 0 ? p.target : this._getTarget(p.cls?.range || 80);
        if (!t) return;
        for (let i = 0; i < sk.hits; i++) {
          setTimeout(() => {
            if (t.hp <= 0) return;
            const dmg = this.calcDamage(p.atk, t.type?.baseDef || 0, sk.mult);
            const crit = Math.random() < (p.crit || 0.05);
            this._applyDamage(t, crit ? dmg * 2 : dmg, crit);
          }, i * 110);
        }
        break;
      }

      case 'dash':
      case 'teleport': {
        const t = p.target;
        const oldX = p.x, oldY = p.y;
        if (t && t.hp > 0) {
          const a = Math.atan2(t.y - p.y, t.x - p.x);
          const dist = sk.dist || 260;
          p.x = window.clamp(p.x + Math.cos(a) * dist, 20, 3180);
          p.y = window.clamp(p.y + Math.sin(a) * dist, 20, 3180);
        } else {
          p.x = window.clamp(p.x + Math.cos(p.dir) * (sk.dist || 260), 20, 3180);
          p.y = window.clamp(p.y + Math.sin(p.dir) * (sk.dist || 260), 20, 3180);
        }
        this.gs.renderer.spawnParticles(oldX, oldY, '#ffffff', 12, 30);
        this.gs.renderer.spawnParticles(p.x, p.y, '#ffffff', 12, 30);
        // Deal damage at landing position
        if (sk.mult > 0) {
          const nearby = allEnemies.filter(e => Math.hypot(e.x - p.x, e.y - p.y) < 80);
          for (const e of nearby) {
            const dmg = this.calcDamage(p.atk, e.type?.baseDef || 0, sk.mult);
            this._applyDamage(e, dmg, false);
          }
        }
        this.gs.renderer.updateEntityPosition('player', p.x, p.y, p.dir, 'attack');
        this.gs.renderer.setCameraTarget(p.x, p.y);
        break;
      }

      case 'buff': {
        p.buffs = p.buffs.filter(b => b.id !== sk.id);
        p.buffs.push({ id: sk.id, name: sk.name, stat: sk.stat, mult: sk.mult, t: sk.dur, icon: sk.icon });
        this.gs.inventory.recalcStats();
        this.gs.renderer.spawnLevelUpEffect(p.x, p.y);
        this.gs.ui.showNotification(`${sk.name} attivato!`, 'success');
        break;
      }

      case 'shield': {
        p.shield = Math.floor(p.maxHp * sk.amount);
        this.gs.renderer.spawnSkillEffect(sk, p.x, p.y, p.x, p.y);
        this.gs.ui.showNotification(`Scudo: ${p.shield} HP`, 'info');
        break;
      }

      case 'heal': {
        const heal = Math.floor(p.maxHp * sk.mult);
        p.hp = Math.min(p.maxHp, p.hp + heal);
        this.gs.renderer.createFloatingText(p.x, p.y, `+${heal}`, '#7df58a');
        this.gs.renderer.spawnParticles(p.x, p.y, '#7df58a', 20, 50);
        break;
      }

      case 'dot': {
        const t = p.target && p.target.hp > 0 && p.target.type ? p.target : null;
        if (!t) { p.mp += sk.mp; p.skillCds[window.GameData.CLASSES[p.classKey].skills.indexOf(sk.id)] = 0; return; }
        t.poison = { dmg: Math.floor(p.atk * sk.mult), ticks: sk.ticks, tickTimer: sk.tickRate || 1 };
        this.gs.renderer.createFloatingText(t.x, t.y, 'Avvelenato!', '#9c27b0');
        break;
      }

      case 'chain': {
        let cur = p.target && p.target.hp > 0 ? p.target : this._getTarget(p.cls?.range || 200);
        const hit = new Set();
        for (let i = 0; i <= (sk.jumps || 3); i++) {
          if (!cur || hit.has(cur)) break;
          const mult = sk.mult * Math.pow(sk.falloff || 0.75, i);
          const dmg = this.calcDamage(p.matk || p.atk, cur.type?.baseDef || 0, mult, true);
          const crit = Math.random() < (p.crit || 0.05);
          this._applyDamage(cur, crit ? dmg * 2 : dmg, crit);
          this.gs.renderer.spawnParticles(cur.x, cur.y, '#64b5f6', 10, 40);
          hit.add(cur);
          // Find next jump target
          let next = null, bd = 220;
          for (const e of this.gs.mobs) {
            if (hit.has(e) || e.hp <= 0) continue;
            const d = Math.hypot(e.x - cur.x, e.y - cur.y);
            if (d < bd) { bd = d; next = e; }
          }
          cur = next;
        }
        break;
      }

      case 'projectile': {
        const t = p.target && p.target.hp > 0 ? p.target : this._getTarget(300);
        if (!t) return;
        const dmg = this.calcDamage(p.matk || p.atk, t.type?.baseDef || 0, sk.mult, true);
        const crit = Math.random() < (p.crit || 0.05);
        this._spawnProjectile(t, crit ? dmg * 2 : dmg, crit);
        if (sk.freeze && t.type) t.slowTimer = (t.slowTimer || 0) + 2;
        break;
      }

      case 'projectile_aoe': {
        const t = p.target && p.target.hp > 0 ? p.target : this._getTarget(300);
        if (!t) return;
        const id = `proj_${Date.now()}`;
        const mesh = this.gs.renderer.createProjectileMesh('fire');
        this.gs.renderer.addEntity(id, mesh, { type: 'projectile' });
        this.gs.projectiles.push({
          id, target: t, x: p.x, y: p.y, speed: 380, life: 2,
          onHit: () => {
            for (const e of [...this.gs.mobs, ...this.gs.stones]) {
              if (Math.hypot(e.x - t.x, e.y - t.y) <= (sk.radius || 130)) {
                const dmg = this.calcDamage(p.matk || p.atk, e.type?.baseDef || 0, sk.mult, true);
                const crit = Math.random() < (p.crit || 0.05);
                this._applyDamage(e, crit ? dmg * 2 : dmg, crit);
              }
            }
            this.gs.renderer.spawnSkillEffect(sk, t.x, t.y, t.x, t.y);
          },
          color: '#ff5722',
        });
        break;
      }

      case 'aoe_delayed': {
        const t = p.target && p.target.hp > 0 ? p.target : this._getTarget(400);
        const tx = t ? t.x : p.x + Math.cos(p.dir) * 200;
        const ty = t ? t.y : p.y + Math.sin(p.dir) * 200;
        this.gs.ui.showNotification('☄ Meteorite in arrivo!', 'info');
        setTimeout(() => {
          this.gs.renderer.spawnSkillEffect(sk, tx, ty, tx, ty);
          for (const e of [...this.gs.mobs, ...this.gs.stones]) {
            if (Math.hypot(e.x - tx, e.y - ty) <= (sk.radius || 200)) {
              const dmg = this.calcDamage(p.matk || p.atk, e.type?.baseDef || 0, sk.mult, true);
              this._applyDamage(e, dmg, false);
              if (e.type) e.stunTimer = 2;
            }
          }
        }, (sk.delay || 1.5) * 1000);
        break;
      }

      case 'execute': {
        const t = p.target && p.target.hp > 0 ? p.target : this._getTarget(80);
        if (!t || !t.type) return;
        if (t.hp / t.maxHp > (sk.hpThreshold || 0.3)) {
          this.gs.ui.showNotification('Bersaglio HP troppo alti per l\'esecuzione!', 'error');
          return;
        }
        const dmg = this.calcDamage(p.atk, t.type.baseDef, sk.mult);
        this._applyDamage(t, dmg, true);
        break;
      }

      case 'aura': {
        // Buff player and nearby allies (currently single player, so just player)
        if (sk.buffAll) {
          Object.entries(sk.buffAll).forEach(([stat, mult]) => {
            p.buffs = p.buffs.filter(b => b.stat !== stat || b.id !== sk.id + '_' + stat);
            p.buffs.push({ id: sk.id + '_' + stat, name: sk.name, stat, mult, t: sk.dur || 15, icon: sk.icon });
          });
          this.gs.inventory.recalcStats();
        }
        this.gs.renderer.spawnLevelUpEffect(p.x, p.y);
        break;
      }
    }
  }

  // Kill entity, give rewards
  _killEntity(entity) {
    const p = this.gs.player;
    if (entity.hp > 0) return; // double-check

    let xp = 0, goldAmount = 0;

    if (entity.type) {
      // Mob
      const type = entity.type;
      xp = type.xp || 0;
      const gr = type.gold || [0,0];
      goldAmount = gr[0] + Math.floor(Math.random() * (gr[1] - gr[0] + 1));
      p.gold += goldAmount;
      p.kills++;

      // Loot drop
      window.spawnDrop(entity.x, entity.y, gr, type.drops || []);

      // Quest update
      this.gs.quests.onKill(type.id);

      // Remove from world
      const mobIdx = this.gs.mobs.indexOf(entity);
      if (mobIdx !== -1) this.gs.mobs.splice(mobIdx, 1);
      this.gs.renderer.removeEntity(entity.id);
      if (entity.fromStone) entity.fromStone.minions--;

      // Respawn
      setTimeout(() => this.gs.monsterAI.respawnMob(type.id), 8000 + Math.random() * 4000);
    } else {
      // Demon stone (tiered: entity carries its own xp/gold from STONE_TIERS)
      xp = entity.xp || window.GameData.STONE?.xp || 400;
      const sr = entity.goldRange || window.GameData.STONE?.gold || [50, 150];
      goldAmount = sr[0] + Math.floor(Math.random() * (sr[1] - sr[0] + 1));
      p.gold += goldAmount;
      window.spawnDrop(entity.x, entity.y, sr, [
        { item: 'demon_stone_shard', chance: 0.8, qty: [1, 2] },
        { item: 'gold_coin', chance: 0.5, qty: [1, 3] },
        { item: 'hp_potion_medium', chance: 0.6, qty: [1, 2] },
        { item: 'pietra_raffinazione', chance: 0.15 + (entity.tier || 1) * 0.03, qty: [1, 1] },
      ]);
      this.gs.ui.showNotification(`${entity.name || 'Pietra Demoniaca'} distrutta!`, 'levelup');
      const stIdx = this.gs.stones.indexOf(entity);
      if (stIdx !== -1) this.gs.stones.splice(stIdx, 1);
      this.gs.renderer.removeEntity(entity.id);
      setTimeout(() => this.gs.monsterAI.respawnStone(), 30000);
    }

    if (p.target === entity) p.target = null;

    // Give XP
    const levelBefore = p.level;
    this._giveXP(xp);

    this.gs.emit('entityDied', { entity, xp, gold: goldAmount });

    // Boss check
    if (entity.type?.boss) {
      this.gs.dungeon.onBossKilled(entity.type.id);
    }
  }

  _giveXP(amount) {
    const p = this.gs.player;
    p.xp += amount;
    this.gs.renderer.createFloatingText(p.x, p.y - 30, `+${amount} XP`, '#d4af37');

    let leveled = false;
    while (p.xp >= window.GameData.levelXP(p.level)) {
      p.xp -= window.GameData.levelXP(p.level);
      p.level++;
      this._applyLevelUp();
      leveled = true;
    }
    if (leveled) this.gs.emit('levelUp', { level: p.level });
  }

  _applyLevelUp() {
    const p = this.gs.player;
    const cls = window.GameData.CLASSES[p.classKey];
    p.maxHp += cls.hpPerLevel || 15;
    p.maxMp += cls.mpPerLevel || 8;
    p.atk += cls.atkPerLevel || 2;
    if (cls.matkPerLevel) p.matk = (p.matk || 0) + cls.matkPerLevel;
    p.def += cls.defPerLevel || 1;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    this.gs.renderer.spawnLevelUpEffect(p.x, p.y);
  }

  // Monster attacks player
  monsterAttack(mob) {
    const p = this.gs.player;
    if (!p || p.dead) return;
    const atk = mob.type.baseAtk * (0.9 + Math.random() * 0.2);
    let dmg = Math.max(1, atk - p.def);

    // Absorb shield first
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed;
      dmg -= absorbed;
    }

    if (dmg > 0) {
      p.hp -= dmg;
      this.gs.renderer.createFloatingText(p.x, p.y, `-${Math.floor(dmg)}`, '#ff4444');
      this.gs.ui.logCombat(`${mob.type.name} ti ha colpito per ${Math.floor(dmg)} danni`, 'combat');
    }

    if (p.hp <= 0 && !p.dead) {
      p.hp = 0;
      p.dead = true;
      p.deaths++;
      this.gs.ui.showDeathScreen({ level: p.level, kills: p.kills, gold: p.gold });
      this.gs.saveSystem.save();
    }
  }

  // Tick: update cooldowns + projectiles + dots
  tick(dt) {
    const p = this.gs.player;
    if (!p) return;

    p.atkCd = Math.max(0, (p.atkCd || 0) - dt);
    p.potCd = Math.max(0, (p.potCd || 0) - dt);
    for (let i = 0; i < 8; i++) p.skillCds[i] = Math.max(0, (p.skillCds[i] || 0) - dt);

    // Buff durations
    p.buffs = p.buffs.filter(b => {
      b.t -= dt;
      return b.t > 0;
    });

    // Mob DOTs (poison/bleed)
    for (const mob of this.gs.mobs) {
      if (mob.poison && mob.hp > 0) {
        mob.poison.tickTimer -= dt;
        if (mob.poison.tickTimer <= 0) {
          mob.poison.tickTimer = 1;
          mob.poison.ticks--;
          mob.hp -= mob.poison.dmg;
          this.gs.renderer.createFloatingText(mob.x, mob.y, `${mob.poison.dmg}☠`, '#9c27b0');
          if (mob.hp <= 0) this._killEntity(mob);
          if (mob.poison && mob.poison.ticks <= 0) mob.poison = null;
        }
      }
      // Status timers
      if (mob.stunTimer > 0) mob.stunTimer -= dt;
      if (mob.slowTimer > 0) mob.slowTimer -= dt;
    }

    // Projectile movement
    for (const pr of this.gs.projectiles) {
      pr.life -= dt;
      if (pr.target && pr.target.hp > 0) {
        const a = Math.atan2(pr.target.y - pr.y, pr.target.x - pr.x);
        pr.vx = Math.cos(a) * pr.speed;
        pr.vy = Math.sin(a) * pr.speed;
      }
      pr.x += (pr.vx || 0) * dt;
      pr.y += (pr.vy || 0) * dt;
      this.gs.renderer.updateEntityPosition(pr.id, pr.x, pr.y, 0, 'idle');
      if (pr.target && Math.hypot(pr.x - pr.target.x, pr.y - pr.target.y) < 22) {
        if (pr.onHit) { pr.onHit(); }
        else if (pr.target.hp > 0) { this._applyDamage(pr.target, pr.dmg, pr.crit); }
        pr.life = 0;
        this.gs.renderer.removeEntity(pr.id);
      }
    }
    this.gs.projectiles = this.gs.projectiles.filter(pr => pr.life > 0);
  }
}

// ============================================================
// Monster AI
// ============================================================
class MonsterAI {
  constructor(gs) { this.gs = gs; this._mobId = 0; }

  tick(dt) {
    const p = this.gs.player;
    if (!p || p.dead) return;
    for (const mob of [...this.gs.mobs]) {
      if (mob.hp <= 0) continue;
      this._updateMob(mob, dt);
    }
    for (const stone of this.gs.stones) {
      this._updateStone(stone, dt);
    }
  }

  _updateMob(mob, dt) {
    const p = this.gs.player;
    const dp = Math.hypot(mob.x - p.x, mob.y - p.y);
    const ai = mob.type.ai || 'basic';
    mob.atkCd = Math.max(0, (mob.atkCd || 0) - dt);
    if (mob.stunTimer > 0) return; // stunned — skip movement

    if (mob.state === 'idle' || mob.state === 'wander') {
      // Aggro check
      const aggroRange = mob.type.aggroRange || 200;
      if (dp < aggroRange) {
        mob.state = 'chase';
        // Pack aggro: alert nearby same-type mobs
        if (ai === 'pack' || ai === 'group') {
          for (const other of this.gs.mobs) {
            if (other !== mob && other.type.id === mob.type.id && other.state === 'idle') {
              if (Math.hypot(other.x - mob.x, other.y - mob.y) < 220) other.state = 'chase';
            }
          }
        }
      } else {
        // Wander
        mob.wanderT = (mob.wanderT || 0) - dt;
        if (mob.wanderT <= 0) {
          mob.wanderT = 2 + Math.random() * 4;
          mob.wanderDir = Math.random() * Math.PI * 2;
        }
        const spd = mob.type.speed * 0.25;
        mob.x += Math.cos(mob.wanderDir || 0) * spd * dt;
        mob.y += Math.sin(mob.wanderDir || 0) * spd * dt;
        // Leash to home
        if (mob.home && Math.hypot(mob.x - mob.home.x, mob.y - mob.home.y) > 280) {
          mob.wanderDir = Math.atan2(mob.home.y - mob.y, mob.home.x - mob.x);
        }
        mob.x = window.clamp(mob.x, 20, 3180);
        mob.y = window.clamp(mob.y, 20, 3180);
        this.gs.renderer.updateEntityPosition(mob.id, mob.x, mob.y, mob.wanderDir || 0, 'walk');
      }
    } else if (mob.state === 'chase') {
      const leash = mob.type.leashRange || 700;
      if (mob.home && Math.hypot(mob.x - mob.home.x, mob.y - mob.home.y) > leash) {
        mob.state = 'idle';
        mob.hp = Math.min(mob.maxHp, mob.hp + mob.maxHp * 0.1); // regen on leash
        return;
      }
      // Ranged kite: maintain range
      const minRange = (ai === 'ranged_kite') ? 160 : 0;
      const atkRange = mob.type.r ? mob.type.r + 22 : 30;

      if (dp < atkRange + 5) {
        // In melee range: attack
        if (mob.atkCd <= 0) {
          this.gs.combat.monsterAttack(mob);
          const cd = (mob.type.attacks?.[0]?.cd) || 1.4;
          mob.atkCd = cd * (0.8 + Math.random() * 0.4);
          this.gs.renderer.updateEntityPosition(mob.id, mob.x, mob.y, Math.atan2(p.y - mob.y, p.x - mob.x), 'attack');
        }
      } else if (ai === 'ranged_kite' && dp < minRange) {
        // Too close: back away
        const a = Math.atan2(mob.y - p.y, mob.x - p.x);
        mob.x = window.clamp(mob.x + Math.cos(a) * mob.type.speed * dt, 20, 3180);
        mob.y = window.clamp(mob.y + Math.sin(a) * mob.type.speed * dt, 20, 3180);
      } else if (dp > atkRange + 5) {
        // Chase player
        const spd = mob.slowTimer > 0 ? mob.type.speed * 0.5 : mob.type.speed;
        const a = Math.atan2(p.y - mob.y, p.x - mob.x);
        mob.x = window.clamp(mob.x + Math.cos(a) * spd * dt, 20, 3180);
        mob.y = window.clamp(mob.y + Math.sin(a) * spd * dt, 20, 3180);
        this.gs.renderer.updateEntityPosition(mob.id, mob.x, mob.y, a, 'walk');

        // Ranged attack from distance
        if (ai === 'ranged_kite' && mob.atkCd <= 0 && dp < (mob.type.aggroRange || 200)) {
          this.gs.combat.monsterAttack(mob);
          mob.atkCd = ((mob.type.attacks?.[0]?.cd) || 2.5) * (0.8 + Math.random() * 0.4);
        }
      }
    }
  }

  _updateStone(stone, dt) {
    const p = this.gs.player;
    if (Math.hypot(stone.x - p.x, stone.y - p.y) > 420) return;
    stone.spawnTimer = (stone.spawnTimer || 8) - dt;
    const cap = stone.maxMinions || 4;
    if (stone.spawnTimer <= 0 && (stone.minions || 0) < cap) {
      stone.spawnTimer = 8 + Math.random() * 4;
      // Evoca mostri della zona della pietra (fallback: mob base)
      const types = (stone.zoneMonsters && stone.zoneMonsters.length)
        ? stone.zoneMonsters : ['wolf', 'bandit', 'boar'];
      const typeId = types[Math.floor(Math.random() * Math.min(3, types.length))];
      const a = Math.random() * Math.PI * 2;
      this.spawnMob(typeId, stone.x + Math.cos(a) * 70, stone.y + Math.sin(a) * 70, { fromStone: stone });
      stone.minions = (stone.minions || 0) + 1;
    }
  }

  spawnMob(typeId, x, y, opts = {}) {
    const type = window.GameData.MONSTERS[typeId];
    if (!type) return;
    const id = `mob_${++this._mobId}`;
    // Scale HP/ATK with player level proximity
    const p = this.gs.player;
    const lvlMult = p ? Math.max(1, 1 + (p.level - type.level) * 0.06) : 1;
    const mob = {
      id, type,
      x: window.clamp(x, 20, 3180),
      y: window.clamp(y, 20, 3180),
      home: { x, y },
      hp: Math.floor(type.baseHp * lvlMult),
      maxHp: Math.floor(type.baseHp * lvlMult),
      state: 'idle',
      atkCd: 0,
      wanderT: 1 + Math.random() * 3,
      wanderDir: Math.random() * Math.PI * 2,
      poison: null,
      stunTimer: 0,
      slowTimer: 0,
      fromStone: opts.fromStone || null,
    };
    this.gs.mobs.push(mob);
    const mesh = this.gs.renderer.createMonsterMesh(type);
    this.gs.renderer.addEntity(id, mesh, { type: 'mob', mobData: mob });
    this.gs.renderer.updateEntityPosition(id, mob.x, mob.y, 0, 'idle');
    return mob;
  }

  respawnMob(typeId) {
    const map = window.GameData.MAPS.village;
    const suitableZones = map.zones.filter(z => z.monsters?.includes(typeId) && !z.safe);
    if (!suitableZones.length) return;
    const zone = suitableZones[Math.floor(Math.random() * suitableZones.length)];
    const x = zone.x + Math.random() * zone.w;
    const y = zone.y + Math.random() * zone.h;
    this.spawnMob(typeId, x, y);
  }

  respawnStone() {
    // Pick a random combat zone and spawn a stone of its tier
    const map = window.GameData.MAPS.village;
    const zones = (map.zones || []).filter(z => !z.safe && z.monsters?.length);
    if (!zones.length) return;
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const x = zone.x + 100 + Math.random() * Math.max(100, zone.w - 200);
    const y = zone.y + 100 + Math.random() * Math.max(100, zone.h - 200);
    const tiers = window.GameData.STONE_TIERS;
    const tier = tiers ? tiers[Math.min((zone.tier || 1) - 1, tiers.length - 1)] : null;
    const hp = tier ? tier.hp : 800;
    const id = `stone_${Date.now()}`;
    const mesh = this.gs.renderer.createStoneMesh();
    const stone = {
      id, x, y, hp, maxHp: hp, spawnTimer: 8, minions: 0, type: null,
      tier: zone.tier || 1,
      name: tier ? tier.name : 'Pietra Demoniaca',
      xp: tier ? tier.xp : 400,
      goldRange: tier ? tier.gold : [80, 160],
      maxMinions: tier ? tier.maxMinions : 4,
      zoneMonsters: zone.monsters,
    };
    this.gs.stones.push(stone);
    this.gs.renderer.addEntity(id, mesh, { type: 'stone' });
    this.gs.renderer.updateEntityPosition(id, x, y, 0, 'idle');
  }
}

// ============================================================
// Inventory System
// ============================================================
class InventorySystem {
  constructor(gs) { this.gs = gs; }

  addItem(itemId, quantity = 1) {
    const p = this.gs.player;
    const itemDef = window.GameData.ITEMS[itemId];
    if (!itemDef) return false;
    const inv = p.inventory || (p.inventory = []);
    const SLOTS = 45;

    // Try to stack
    if (itemDef.stackable) {
      const existing = inv.find(e => e && e.id === itemId);
      if (existing) { existing.qty = (existing.qty || 1) + quantity; this.save(); return true; }
      for (let i = 0; i < SLOTS; i++) {
        if (!inv[i] || !inv[i].id) {
          inv[i] = { id: itemId, qty: quantity };
          this.save();
          return true;
        }
      }
      return false;
    }

    // Non-stackable: each unit is an instance with enh/bonuses/gems
    let added = 0;
    for (let q = 0; q < quantity; q++) {
      let placed = false;
      for (let i = 0; i < SLOTS; i++) {
        if (!inv[i] || !inv[i].id) {
          inv[i] = {
            id: itemId, qty: 1, enh: 0,
            bonuses: (itemDef.slot && window.ItemForge) ? window.ItemForge.rollBonuses(itemDef) : [],
            gems: [],
          };
          placed = true; added++;
          break;
        }
      }
      if (!placed) break;
    }
    if (added > 0) { this.save(); this.gs.emit('inventoryChanged', {}); }
    return added === quantity;
  }

  removeItem(itemId, quantity = 1) {
    const p = this.gs.player;
    const inv = p.inventory || [];
    const idx = inv.findIndex(e => e && e.id === itemId);
    if (idx === -1) return false;
    const entry = inv[idx];
    entry.qty = (entry.qty || 1) - quantity;
    if (entry.qty <= 0) inv[idx] = null;
    this.save();
    return true;
  }

  equipItem(slotIndex) {
    const p = this.gs.player;
    const entry = p.inventory?.[slotIndex];
    if (!entry || !entry.id) return;
    const itemDef = window.GameData.ITEMS[entry.id];
    if (!itemDef || !itemDef.slot) return;
    if (itemDef.class && itemDef.class !== p.classKey) {
      this.gs.ui.showNotification(`Solo i ${itemDef.class} possono equipaggiare questo!`, 'error');
      return;
    }
    if (itemDef.level && p.level < itemDef.level) {
      this.gs.ui.showNotification(`Richiede livello ${itemDef.level}`, 'error');
      return;
    }

    const equip = p.equipped || (p.equipped = {});
    const slot = itemDef.slot;

    // Swap: previous equipped instance (with its enh/bonuses/gems) goes
    // back to the inventory slot, the new instance is equipped whole
    if (equip[slot]) {
      p.inventory[slotIndex] = { ...equip[slot] };
    } else {
      p.inventory[slotIndex] = null;
    }

    equip[slot] = { ...entry };
    this.recalcStats();
    this.save();
    this.gs.emit('inventoryChanged', {});
    this.gs.ui.showNotification(`Equipaggiato: ${itemDef.name}${entry.enh ? ' +' + entry.enh : ''}`, 'success');
  }

  unequipItem(slot) {
    const p = this.gs.player;
    const equip = p.equipped || {};
    if (!equip[slot]) return;
    // Preserve the instance data (enh/bonuses/gems) when unequipping
    const inv = p.inventory || (p.inventory = []);
    let placed = false;
    for (let i = 0; i < 45; i++) {
      if (!inv[i] || !inv[i].id) { inv[i] = { ...equip[slot] }; placed = true; break; }
    }
    if (!placed) { this.gs.ui.showNotification('Inventario pieno!', 'error'); return; }
    equip[slot] = null;
    this.recalcStats();
    this.save();
    this.gs.emit('inventoryChanged', {});
  }

  recalcStats() {
    const p = this.gs.player;
    const cls = window.GameData.CLASSES[p.classKey];
    const base = cls.baseStats;
    const lvl = p.level;

    // Base stats
    p.maxHp = base.hp + (cls.hpPerLevel || 15) * (lvl - 1);
    p.maxMp = base.mp + (cls.mpPerLevel || 8) * (lvl - 1);
    p.atk = base.atk + (cls.atkPerLevel || 2) * (lvl - 1);
    p.matk = (base.matk || 0) + (cls.matkPerLevel || 0) * (lvl - 1);
    p.def = base.def + (cls.defPerLevel || 1) * (lvl - 1);
    p.speed = base.speed;
    p.crit = base.crit || 0.05;

    // Equipment: base stats scaled by enhancement (+10% per livello),
    // plus random bonuses and socketed gems
    const applyStat = (stat, val) => {
      if (stat === 'hp') p.maxHp += val;
      else if (stat === 'mp') p.maxMp += val;
      else if (p[stat] !== undefined) p[stat] += val;
    };
    const equip = p.equipped || {};
    for (const [, item] of Object.entries(equip)) {
      if (!item) continue;
      const def = window.GameData.ITEMS[item.id];
      if (!def) continue;
      const enhMult = 1 + 0.1 * (item.enh || 0);
      for (const [stat, val] of Object.entries(def.stats || {})) {
        if (stat === 'speedMult') continue;
        const scaled = stat === 'crit' ? val * enhMult : Math.round(val * enhMult);
        applyStat(stat, scaled);
      }
      for (const b of (item.bonuses || [])) applyStat(b.stat, b.val);
      for (const gemId of (item.gems || [])) {
        const gem = window.GameData.ITEMS[gemId];
        for (const [stat, val] of Object.entries(gem?.stats || {})) applyStat(stat, val);
      }
    }

    // Active mount: speed multiplier
    if (p.activeMount) {
      const mount = window.GameData.ITEMS[p.activeMount];
      p.speed = Math.round(p.speed * (1 + (mount?.stats?.speedMult || 0)));
    }

    // Active buffs
    for (const buff of (p.buffs || [])) {
      if (buff.stat && p[buff.stat] !== undefined) {
        p[buff.stat] = Math.floor(p[buff.stat] * buff.mult);
      }
    }

    // Clamp HP/MP to new max
    p.hp = Math.min(p.hp, p.maxHp);
    p.mp = Math.min(p.mp, p.maxMp);
  }

  sellItem(slotIndex, qty = 1) {
    const p = this.gs.player;
    const entry = p.inventory?.[slotIndex];
    if (!entry || !entry.id) return;
    const itemDef = window.GameData.ITEMS[entry.id];
    if (!itemDef) return;
    const actualQty = Math.min(qty, entry.qty || 1);
    const price = Math.floor(itemDef.value * 0.4 * actualQty);
    this.removeItem(entry.id, actualQty);
    p.gold += price;
    this.gs.ui.showNotification(`Venduto ${itemDef.name} per ${price} oro`, 'success');
  }

  save() {
    const p = this.gs.player;
    try {
      localStorage.setItem('ro_inv', JSON.stringify({ inventory: p.inventory, equipped: p.equipped }));
    } catch (_) {}
  }

  load() {
    try {
      const raw = localStorage.getItem('ro_inv');
      if (!raw) return;
      const data = JSON.parse(raw);
      const p = this.gs.player;
      if (data.inventory) p.inventory = data.inventory;
      if (data.equipped) p.equipped = data.equipped;
      this.recalcStats();
    } catch (_) {}
  }
}

// ============================================================
// Quest System
// ============================================================
class QuestSystem {
  constructor(gs) { this.gs = gs; }

  getAvailable(npcId) {
    const p = this.gs.player;
    const active = (p.activeQuests || []).map(q => q.id);
    const done = (p.completedQuests || []);
    return Object.values(window.GameData.QUESTS).filter(q => {
      if (q.npc !== npcId) return false;
      if (p.level < q.level) return false;
      if (active.includes(q.id)) return false;
      if (!q.repeatable && done.includes(q.id)) return false;
      return true;
    });
  }

  startQuest(questId) {
    const p = this.gs.player;
    const def = window.GameData.QUESTS[questId];
    if (!def) return;
    if ((p.activeQuests || []).find(q => q.id === questId)) return;
    const quest = {
      id: questId,
      objectives: def.objectives.map(o => ({ ...o, current: 0 })),
    };
    p.activeQuests = p.activeQuests || [];
    p.activeQuests.push(quest);
    this.gs.ui.showNotification(`Missione iniziata: ${def.name}`, 'info');
    this.save();
  }

  onKill(mobTypeId) {
    const p = this.gs.player;
    let updated = false;
    for (const q of (p.activeQuests || [])) {
      for (const obj of q.objectives) {
        if (obj.type === 'kill' && obj.target === mobTypeId && obj.current < obj.count) {
          obj.current++;
          updated = true;
          this.gs.ui.logCombat(`${window.GameData.QUESTS[q.id]?.name}: ${obj.current}/${obj.count}`, '');
        }
      }
    }
    if (updated) {
      this._checkCompletions();
      this.save();
    }
  }

  // Generic game events (e.g. 'enhance_success', 'mount_summon')
  onEvent(eventId) {
    const p = this.gs.player;
    let updated = false;
    for (const q of (p.activeQuests || [])) {
      for (const obj of q.objectives) {
        if (obj.type === 'event' && obj.target === eventId && obj.current < obj.count) {
          obj.current++;
          updated = true;
        }
      }
    }
    if (updated) { this._checkCompletions(); this.save(); }
  }

  onCollect(itemId, qty = 1) {
    const p = this.gs.player;
    let updated = false;
    for (const q of (p.activeQuests || [])) {
      for (const obj of q.objectives) {
        if (obj.type === 'collect' && obj.item === itemId && obj.current < obj.count) {
          obj.current = Math.min(obj.count, obj.current + qty);
          updated = true;
        }
      }
    }
    if (updated) { this._checkCompletions(); this.save(); }
  }

  _checkCompletions() {
    const p = this.gs.player;
    for (const q of (p.activeQuests || [])) {
      if (q.objectives.every(o => o.current >= o.count)) {
        const def = window.GameData.QUESTS[q.id];
        if (!q._notified) {
          q._notified = true;
          this.gs.ui.showNotification(`Missione completabile: ${def?.name}! Parla con l'NPC`, 'success');
        }
      }
    }
  }

  completeQuest(questId, npcId) {
    const p = this.gs.player;
    const def = window.GameData.QUESTS[questId];
    if (!def) return;
    const qIdx = (p.activeQuests || []).findIndex(q => q.id === questId);
    if (qIdx === -1) return;
    const q = p.activeQuests[qIdx];
    if (!q.objectives.every(o => o.current >= o.count)) return;
    if (def.npc !== npcId) return;

    // Remove from active
    p.activeQuests.splice(qIdx, 1);
    // Mark as completed (unless repeatable)
    if (!def.repeatable) {
      p.completedQuests = p.completedQuests || [];
      p.completedQuests.push(questId);
    }

    // Give rewards
    const r = def.rewards;
    if (r.xp) this.gs.combat._giveXP(r.xp);
    if (r.gold) p.gold += r.gold;
    if (r.items) {
      for (const ri of r.items) {
        for (let i = 0; i < ri.qty; i++) this.gs.inventory.addItem(ri.id, 1);
      }
    }

    this.gs.emit('questCompleted', { questId });
    this.save();
  }

  save() {
    const p = this.gs.player;
    try {
      localStorage.setItem('ro_quests', JSON.stringify({
        active: p.activeQuests || [],
        completed: p.completedQuests || [],
      }));
    } catch (_) {}
  }

  load() {
    try {
      const raw = localStorage.getItem('ro_quests');
      if (!raw) return;
      const data = JSON.parse(raw);
      const p = this.gs.player;
      if (data.active) p.activeQuests = data.active;
      if (data.completed) p.completedQuests = data.completed;
    } catch (_) {}
  }
}

// ============================================================
// Dungeon System
// ============================================================
class DungeonSystem {
  constructor(gs) { this.gs = gs; }

  enterDungeon(dungeonId) {
    const def = window.GameData.DUNGEONS[dungeonId];
    if (!def) return;
    const p = this.gs.player;
    if (p.level < def.minLevel) {
      this.gs.ui.showNotification(`Richiede livello ${def.minLevel}`, 'error');
      return;
    }

    // Save world position
    this.gs._worldPos = { x: p.x, y: p.y };
    this.gs.currentDungeon = dungeonId;

    // Clear overworld mobs from renderer (they stay in array but hidden)
    for (const mob of this.gs.mobs) this.gs.renderer.removeEntity(mob.id);
    for (const stone of this.gs.stones) this.gs.renderer.removeEntity(stone.id);

    // Lay out all floors side by side in world space, centred on the map
    const gap = 150;
    const totalW = def.floors.reduce((s, f) => s + (f.width || 1200), 0) + gap * (def.floors.length - 1);
    let floorOffX = 1600 - totalW / 2;
    let entryPos = null;

    def.floors.forEach((floor, fi) => {
      const offY = 1600 - (floor.height || 900) / 2;
      for (const room of floor.rooms) {
        const cx = floorOffX + room.x + room.w / 2;
        const cy = offY + room.y + room.h / 2;
        if (fi === 0 && room.type === 'entry' && !entryPos) entryPos = { x: cx, y: cy };
        // room.monsters is a flat array of monster type ids
        for (const monsterId of (room.monsters || [])) {
          const mx = cx + (Math.random() - 0.5) * room.w * 0.7;
          const my = cy + (Math.random() - 0.5) * room.h * 0.7;
          this.gs.monsterAI.spawnMob(monsterId, mx, my);
        }
        if (room.boss) this.gs.monsterAI.spawnMob(room.boss, cx, cy);
      }
      floorOffX += (floor.width || 1200) + gap;
    });

    // Teleport player to the entry room
    const start = entryPos || { x: 1600, y: 1600 };
    p.x = start.x; p.y = start.y;
    p.moveTarget = null;
    this.gs.renderer.updateEntityPosition('player', p.x, p.y, 0, 'idle');
    this.gs.renderer.setCameraTarget(p.x, p.y);

    this.gs.ui.addSystemMessage(`Sei entrato in: ${def.name}!`);
    this.gs.ui.showNotification(`Dungeon: ${def.name}`, 'info');
  }

  onBossKilled(bossId) {
    const p = this.gs.player;
    const dungeonId = this.gs.currentDungeon;
    if (!dungeonId) return;
    const def = window.GameData.DUNGEONS[dungeonId];
    if (!def) return;

    const r = def.rewards || {};
    if (r.xp) this.gs.combat._giveXP(r.xp);
    if (r.gold) {
      const g = r.gold[0] + Math.floor(Math.random() * (r.gold[1] - r.gold[0] + 1));
      p.gold += g;
    }
    if (r.items) {
      for (const ri of r.items) {
        for (let i = 0; i < ri.qty; i++) this.gs.inventory.addItem(ri.id, 1);
      }
    }

    this.gs.quests.onKill(bossId);
    p.completedDungeons = p.completedDungeons || [];
    if (!p.completedDungeons.includes(dungeonId)) p.completedDungeons.push(dungeonId);

    this.gs.ui.showNotification(`Boss sconfitto! ${def.name} completato!`, 'levelup');
    setTimeout(() => this.exitDungeon(), 5000);
  }

  exitDungeon() {
    const p = this.gs.player;
    this.gs.currentDungeon = null;

    // Clear dungeon mobs
    for (const mob of [...this.gs.mobs]) this.gs.renderer.removeEntity(mob.id);
    this.gs.mobs.length = 0;

    // Restore world position
    const wPos = this.gs._worldPos || { x: 1600, y: 1700 };
    p.x = wPos.x; p.y = wPos.y;

    // Re-show world entities
    for (const stone of this.gs.stones) {
      const mesh = this.gs.renderer.createStoneMesh();
      this.gs.renderer.addEntity(stone.id, mesh, { type: 'stone' });
      this.gs.renderer.updateEntityPosition(stone.id, stone.x, stone.y, 0, 'idle');
    }
    // Re-spawn world mobs
    const map = window.GameData.MAPS.village;
    map.zones.forEach(zone => {
      if (zone.safe || !zone.monsters) return;
      const count = Math.min(12, Math.floor(zone.w * zone.h * (zone.density || 0.006)));
      for (let i = 0; i < count; i++) {
        const typeId = zone.monsters[Math.floor(Math.random() * zone.monsters.length)];
        const x = zone.x + Math.random() * zone.w;
        const y = zone.y + Math.random() * zone.h;
        this.gs.monsterAI.spawnMob(typeId, x, y);
      }
    });

    this.gs.renderer.updateEntityPosition('player', p.x, p.y, 0, 'idle');
    this.gs.renderer.setCameraTarget(p.x, p.y);
    this.gs.ui.addSystemMessage('Sei uscito dal dungeon');
  }
}

// ============================================================
// Save System
// ============================================================
class SaveSystem {
  constructor(gs) { this.gs = gs; }

  save() {
    const p = this.gs.player;
    if (!p) return;
    try {
      const data = {
        version: 2,
        savedAt: Date.now(),
        player: {
          name: p.name, classKey: p.classKey, level: p.level, xp: p.xp,
          hp: p.hp, mp: p.mp, maxHp: p.maxHp, maxMp: p.maxMp,
          atk: p.atk, matk: p.matk, def: p.def, speed: p.speed, crit: p.crit,
          gold: p.gold, kills: p.kills, deaths: p.deaths,
          x: p.x, y: p.y,
          potions: p.potions,
          inventory: p.inventory || [],
          equipped: p.equipped || {},
          activeQuests: p.activeQuests || [],
          completedQuests: p.completedQuests || [],
          completedDungeons: p.completedDungeons || [],
          skillLevels: p.skillLevels || {},
          skillPoints: p.skillPoints,
          activeMount: p.activeMount || null,
          hairstyle: p.hairstyle || null,
        },
      };
      localStorage.setItem('ro_save', JSON.stringify(data));
    } catch (e) {
      console.warn('[Save]', e);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem('ro_save');
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data;
    } catch (_) { return null; }
  }

  deleteSave() {
    ['ro_save', 'ro_inv', 'ro_quests'].forEach(k => localStorage.removeItem(k));
  }
}

// ============================================================
// Exports
// ============================================================
window.CombatSystem = CombatSystem;
window.MonsterAI = MonsterAI;
window.InventorySystem = InventorySystem;
window.QuestSystem = QuestSystem;
window.DungeonSystem = DungeonSystem;
window.SaveSystem = SaveSystem;
