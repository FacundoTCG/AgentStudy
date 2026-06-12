// content.js — Procedural content expansion for Regni d'Oriente
// Runs AFTER data.js. Generates the full equipment catalogue, gems,
// mounts, hairstyles, scrolls, materials, food, extra skills and the
// bonus pool. All names are original Italian fantasy.
'use strict';

(function () {
  const D = window.GameData;
  if (!D) { console.error('[content] GameData missing'); return; }

  // ──────────────────────────────────────────────────────────
  // Constants shared with the new systems
  // ──────────────────────────────────────────────────────────
  D.ENHANCE_RATES = [95, 90, 85, 75, 65, 55, 45, 35, 25]; // +0→+1 ... +8→+9
  D.SOCKETS_BY_QUALITY = { common: 0, uncommon: 1, rare: 2, epic: 2, legendary: 3 };

  const QUALITY_AT = i => (i < 4 ? 'common' : i < 7 ? 'uncommon' : i < 10 ? 'rare' : i < 13 ? 'epic' : 'legendary');
  const WPN_LEVELS = [1, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56];
  const round3 = v => Math.round(v * 1000) / 1000;

  function add(item) { D.ITEMS[item.id] = item; return item; }
  const tierOf = lvl => Math.min(8, Math.max(1, Math.ceil(lvl / 7)));

  // Slot migration: old items used 'chest' — the expanded system uses 'body'
  for (const it of Object.values(D.ITEMS)) {
    if (it.slot === 'chest') it.slot = 'body';
  }
  for (const c of Object.values(D.CLASSES)) {
    c.equipSlots = ['weapon', 'body', 'head', 'shield', 'boots', 'bracelet', 'necklace', 'earring', 'ring'];
  }

  // ──────────────────────────────────────────────────────────
  // WEAPONS — 15 tiers × 4 classes = 60
  // ──────────────────────────────────────────────────────────
  const WEAPON_SETS = {
    guerriero: {
      subtype: 'sword', stat: 'atk', factor: 1.0,
      names: ['Spada di Bronzo', 'Lama del Soldato', 'Spada Lunga d\'Acciaio', 'Mannaia da Guerra',
        'Lama del Vento', 'Spada del Bastione', 'Flagello dei Predoni', 'Zanna di Ferro',
        'Spada Runica', 'Lama della Tempesta', 'Distruttore di Scudi', 'Spada del Crepuscolo',
        'Zanna di Drago', 'Lama del Re Caduto', 'Alba Spezzata'],
    },
    ninja: {
      subtype: 'dagger', stat: 'atk', factor: 0.85, critBonus: true,
      names: ['Pugnale Scheggiato', 'Lame Gemelle', 'Artiglio Notturno', 'Pungiglione',
        'Zanna del Serpente', 'Lama Silenziosa', 'Morso dell\'Ombra', 'Falce Minore',
        'Artiglio Runico', 'Lama del Vuoto', 'Sussurro Mortale', 'Zanna Cremisi',
        'Artiglio del Drago', 'Lama dell\'Eclissi', 'Ultimo Respiro'],
    },
    mago: {
      subtype: 'staff', stat: 'matk', factor: 1.1, mpBonus: true,
      names: ['Bastone di Quercia', 'Verga Ambrata', 'Bastone dell\'Apprendista', 'Scettro di Giada',
        'Verga delle Braci', 'Bastone delle Ombre', 'Scettro Tempestoso', 'Verga del Gelo',
        'Bastone Runico', 'Scettro del Vuoto', 'Verga delle Stelle', 'Bastone del Patto',
        'Scettro del Drago', 'Verga dell\'Abisso', 'Occhio della Notte'],
    },
    sciamano: {
      subtype: 'rod', stat: 'matk', factor: 0.95, mpBonus: true,
      names: ['Campana di Rame', 'Talismano Intagliato', 'Bastone Ancestrale', 'Campana del Vento',
        'Talismano del Tuono', 'Bastone degli Spiriti', 'Campana della Pioggia', 'Talismano Lunare',
        'Bastone Runico degli Avi', 'Campana del Fulmine', 'Talismano del Cielo', 'Bastone del Monsone',
        'Campana del Drago', 'Talismano dell\'Aurora', 'Voce degli Antenati'],
    },
  };

  for (const [classKey, set] of Object.entries(WEAPON_SETS)) {
    set.names.forEach((name, i) => {
      const lvl = WPN_LEVELS[i];
      const quality = QUALITY_AT(i);
      const stats = {};
      stats[set.stat] = Math.round((8 + lvl * 2.3) * set.factor);
      if (set.critBonus) stats.crit = round3(0.01 + lvl * 0.0012);
      if (set.mpBonus) stats.mp = Math.round(10 + lvl * 1.5);
      add({
        id: `wpn_${classKey}_${String(i + 1).padStart(2, '0')}`,
        name, type: 'weapon', subtype: set.subtype, quality,
        slot: 'weapon', class: classKey, level: lvl, stats,
        sockets: D.SOCKETS_BY_QUALITY[quality],
        value: 40 + lvl * lvl * 3,
      });
    });
  }

  // ──────────────────────────────────────────────────────────
  // BODY ARMOR — 10 tiers × 4 classes = 40
  // ──────────────────────────────────────────────────────────
  const ARMOR_LEVELS = [1, 6, 12, 18, 24, 30, 36, 42, 48, 54];
  const ARMOR_SETS = {
    guerriero: ['Corazza di Cuoio', 'Maglia di Ferro', 'Corazza del Soldato', 'Piastre Brunite',
      'Corazza del Bastione', 'Piastre Runiche', 'Corazza della Tempesta', 'Piastre del Crepuscolo',
      'Corazza di Scaglie di Drago', 'Egida del Re Caduto'],
    ninja: ['Tunica Leggera', 'Veste Notturna', 'Tunica del Vento', 'Veste dell\'Ombra',
      'Tunica Serpentina', 'Veste Runica', 'Tunica del Vuoto', 'Veste Cremisi',
      'Tunica di Pelle di Drago', 'Manto dell\'Eclissi'],
    mago: ['Veste di Lino', 'Tunica Ricamata', 'Veste dell\'Adepto', 'Tunica di Giada',
      'Veste delle Braci', 'Tunica Runica', 'Veste Tempestosa', 'Tunica del Vuoto',
      'Veste di Seta di Drago', 'Manto dell\'Abisso'],
    sciamano: ['Casacca Tribale', 'Veste Ancestrale', 'Casacca del Vento', 'Veste del Tuono',
      'Casacca degli Spiriti', 'Veste Runica degli Avi', 'Casacca del Monsone', 'Veste del Cielo',
      'Casacca di Piume di Drago', 'Manto dell\'Aurora'],
  };

  for (const [classKey, names] of Object.entries(ARMOR_SETS)) {
    names.forEach((name, i) => {
      const lvl = ARMOR_LEVELS[i];
      const quality = QUALITY_AT(Math.round(i * 1.4));
      add({
        id: `arm_body_${classKey}_${String(i + 1).padStart(2, '0')}`,
        name, type: 'armor', subtype: 'armor', quality,
        slot: 'body', class: classKey, level: lvl,
        stats: { def: Math.round(4 + lvl * 1.6), hp: Math.round(15 + lvl * 6) },
        sockets: D.SOCKETS_BY_QUALITY[quality],
        value: 35 + lvl * lvl * 2.5,
      });
    });
  }

  // ──────────────────────────────────────────────────────────
  // HELMETS (12), SHIELDS (10), BOOTS (10), BRACELETS (10) — universali
  // ──────────────────────────────────────────────────────────
  const HELMETS = ['Cappuccio di Stoffa', 'Elmetto di Cuoio', 'Elmo di Ferro', 'Cerchietto di Giada',
    'Elmo del Soldato', 'Cappuccio Runico', 'Elmo del Bastione', 'Corona di Spine',
    'Elmo della Tempesta', 'Cappuccio del Vuoto', 'Elmo di Scaglie di Drago', 'Diadema dell\'Aurora'];
  HELMETS.forEach((name, i) => {
    const lvl = [1, 5, 10, 15, 20, 25, 30, 36, 42, 48, 52, 56][i];
    const quality = QUALITY_AT(Math.round(i * 1.2));
    add({
      id: `arm_head_${String(i + 1).padStart(2, '0')}`,
      name, type: 'armor', subtype: 'helmet', quality, slot: 'head', level: lvl,
      stats: { def: Math.round(2 + lvl * 0.9), hp: Math.round(8 + lvl * 3) },
      sockets: D.SOCKETS_BY_QUALITY[quality],
      value: 25 + lvl * lvl * 2,
    });
  });

  const SHIELDS = ['Scudo di Legno', 'Brocchiere di Ferro', 'Scudo del Soldato', 'Scudo di Quercia Ferrata',
    'Scudo del Bastione', 'Scudo Runico', 'Scudo della Tempesta', 'Baluardo del Crepuscolo',
    'Scudo di Scaglie di Drago', 'Egida dell\'Alba'];
  SHIELDS.forEach((name, i) => {
    const lvl = [2, 7, 13, 19, 25, 31, 38, 44, 50, 56][i];
    const quality = QUALITY_AT(Math.round(i * 1.4));
    add({
      id: `arm_shield_${String(i + 1).padStart(2, '0')}`,
      name, type: 'armor', subtype: 'shield', quality, slot: 'shield', level: lvl,
      stats: { def: Math.round(3 + lvl * 1.2), hp: Math.round(5 + lvl * 2) },
      sockets: D.SOCKETS_BY_QUALITY[quality],
      value: 30 + lvl * lvl * 2,
    });
  });

  const BOOTS = ['Sandali di Corda', 'Stivali di Cuoio', 'Stivali Chiodati', 'Stivali del Viandante',
    'Stivali del Vento', 'Stivali Runici', 'Stivali della Tempesta', 'Stivali del Vuoto',
    'Stivali di Pelle di Drago', 'Passi dell\'Aurora'];
  BOOTS.forEach((name, i) => {
    const lvl = [1, 6, 12, 18, 24, 30, 37, 44, 50, 56][i];
    const quality = QUALITY_AT(Math.round(i * 1.4));
    add({
      id: `arm_boots_${String(i + 1).padStart(2, '0')}`,
      name, type: 'armor', subtype: 'boots', quality, slot: 'boots', level: lvl,
      stats: { def: Math.round(1 + lvl * 0.6), speed: Math.round(3 + lvl * 0.5) },
      sockets: D.SOCKETS_BY_QUALITY[quality],
      value: 22 + lvl * lvl * 2,
    });
  });

  const BRACELETS = ['Bracciale di Corda', 'Bracciale di Rame', 'Bracciale di Ferro', 'Bracciale di Giada',
    'Bracciale Inciso', 'Bracciale Runico', 'Bracciale Tempestoso', 'Bracciale del Vuoto',
    'Bracciale di Scaglie', 'Sigillo dell\'Aurora'];
  BRACELETS.forEach((name, i) => {
    const lvl = [3, 8, 14, 20, 26, 32, 39, 45, 51, 56][i];
    const quality = QUALITY_AT(Math.round(i * 1.4));
    add({
      id: `arm_bracelet_${String(i + 1).padStart(2, '0')}`,
      name, type: 'armor', subtype: 'bracelet', quality, slot: 'bracelet', level: lvl,
      stats: { atk: Math.round(1 + lvl * 0.7), matk: Math.round(1 + lvl * 0.7), def: Math.round(lvl * 0.3) },
      sockets: D.SOCKETS_BY_QUALITY[quality],
      value: 28 + lvl * lvl * 2.2,
    });
  });

  // ──────────────────────────────────────────────────────────
  // JEWELRY — necklaces (10), earrings (10), rings (10)
  // ──────────────────────────────────────────────────────────
  const NECKLACES = ['Collana di Conchiglie', 'Collana di Rame', 'Pendente di Giada', 'Collana d\'Argento',
    'Pendente Inciso', 'Collana Runica', 'Pendente Tempestoso', 'Collana del Vuoto',
    'Pendente di Zanna di Drago', 'Cuore dell\'Aurora'];
  NECKLACES.forEach((name, i) => {
    const lvl = [2, 7, 13, 19, 25, 31, 38, 44, 50, 56][i];
    const quality = QUALITY_AT(Math.round(i * 1.4));
    add({
      id: `jwl_necklace_${String(i + 1).padStart(2, '0')}`,
      name, type: 'jewelry', subtype: 'necklace', quality, slot: 'necklace', level: lvl,
      stats: { hp: Math.round(12 + lvl * 4), mp: Math.round(8 + lvl * 2.5) },
      sockets: 0,
      value: 30 + lvl * lvl * 2.4,
    });
  });

  const EARRINGS = ['Orecchini di Osso', 'Orecchini di Rame', 'Orecchini di Giada', 'Orecchini d\'Argento',
    'Orecchini Incisi', 'Orecchini Runici', 'Orecchini Tempestosi', 'Orecchini del Vuoto',
    'Orecchini di Scaglia', 'Lacrime dell\'Aurora'];
  EARRINGS.forEach((name, i) => {
    const lvl = [3, 8, 14, 20, 26, 32, 39, 45, 51, 56][i];
    const quality = QUALITY_AT(Math.round(i * 1.4));
    add({
      id: `jwl_earring_${String(i + 1).padStart(2, '0')}`,
      name, type: 'jewelry', subtype: 'earring', quality, slot: 'earring', level: lvl,
      stats: { crit: round3(0.005 + lvl * 0.0011), matk: Math.round(1 + lvl * 0.6) },
      sockets: 0,
      value: 32 + lvl * lvl * 2.4,
    });
  });

  const RINGS = ['Anello di Stagno', 'Anello di Rame', 'Anello di Giada', 'Anello d\'Argento',
    'Anello Inciso', 'Anello Runico', 'Anello Tempestoso', 'Anello del Vuoto',
    'Anello di Scaglia di Drago', 'Sigillo dell\'Alba'];
  RINGS.forEach((name, i) => {
    const lvl = [1, 6, 12, 18, 24, 30, 37, 44, 50, 56][i];
    const quality = QUALITY_AT(Math.round(i * 1.4));
    add({
      id: `jwl_ring_${String(i + 1).padStart(2, '0')}`,
      name, type: 'jewelry', subtype: 'ring', quality, slot: 'ring', level: lvl,
      stats: { atk: Math.round(1 + lvl * 0.5), def: Math.round(1 + lvl * 0.4) },
      sockets: 0,
      value: 26 + lvl * lvl * 2.2,
    });
  });

  // ──────────────────────────────────────────────────────────
  // GEMS — 5 types × 5 grades = 25 (alchimia)
  // ──────────────────────────────────────────────────────────
  const GEM_TYPES = {
    rubino:   { name: 'Rubino',   stat: 'atk',   base: 3,    color: '#e53935' },
    zaffiro:  { name: 'Zaffiro',  stat: 'def',   base: 2.5,  color: '#1e88e5' },
    smeraldo: { name: 'Smeraldo', stat: 'hp',    base: 18,   color: '#43a047' },
    ametista: { name: 'Ametista', stat: 'matk',  base: 3,    color: '#8e24aa' },
    topazio:  { name: 'Topazio',  stat: 'crit',  base: 0.006, color: '#fdd835' },
  };
  const GRADE_NAMES = ['Grezzo', 'Tagliato', 'Nobile', 'Perfetto', 'Leggendario'];
  const GRADE_QUALITY = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  for (const [key, g] of Object.entries(GEM_TYPES)) {
    for (let grade = 1; grade <= 5; grade++) {
      const mult = Math.pow(2.1, grade - 1);
      const val = g.stat === 'crit' ? round3(g.base * mult) : Math.round(g.base * mult);
      add({
        id: `gem_${key}_g${grade}`,
        name: `${g.name} ${GRADE_NAMES[grade - 1]}`,
        type: 'gem', quality: GRADE_QUALITY[grade - 1],
        gemType: key, grade, stackable: true,
        stats: { [g.stat]: val },
        value: 60 * Math.pow(3, grade - 1),
        desc: `Incastonabile. ${g.stat.toUpperCase()} +${val}. Combina 3 gemme uguali per il grado successivo.`,
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  // MOUNTS — 10 (cavalcature)
  // ──────────────────────────────────────────────────────────
  const MOUNTS = [
    { name: 'Pony Baio',            kind: 'horse', body: 0x8d6e63, mane: 0x4e342e, mult: 0.25, lvl: 5 },
    { name: 'Cavallo Sauro',        kind: 'horse', body: 0xa1887f, mane: 0x3e2723, mult: 0.32, lvl: 10 },
    { name: 'Destriero Grigio',     kind: 'horse', body: 0x90a4ae, mane: 0x455a64, mult: 0.40, lvl: 15 },
    { name: 'Destriero Nero',       kind: 'horse', body: 0x263238, mane: 0x000000, mult: 0.47, lvl: 20 },
    { name: 'Lupo della Tundra',    kind: 'wolf',  body: 0xb0bec5, mane: 0x78909c, mult: 0.55, lvl: 26 },
    { name: 'Lupo Cremisi',         kind: 'wolf',  body: 0x8e2f2f, mane: 0x4a1010, mult: 0.62, lvl: 32 },
    { name: 'Tigre delle Nevi',     kind: 'tiger', body: 0xeceff1, mane: 0x37474f, mult: 0.70, lvl: 38 },
    { name: 'Tigre Reale',          kind: 'tiger', body: 0xff8f00, mane: 0x212121, mult: 0.78, lvl: 44 },
    { name: 'Draghetto di Giada',   kind: 'drake', body: 0x2e7d32, mane: 0xa5d6a7, mult: 0.86, lvl: 50 },
    { name: 'Draghetto dell\'Alba', kind: 'drake', body: 0xbf360c, mane: 0xffcc80, mult: 0.95, lvl: 55 },
  ];
  MOUNTS.forEach((m, i) => {
    add({
      id: `mount_${String(i + 1).padStart(2, '0')}`,
      name: m.name, type: 'mount',
      quality: QUALITY_AT(Math.round(i * 1.5)),
      level: m.lvl,
      stats: { speedMult: m.mult },
      style: { kind: m.kind, body: m.body, mane: m.mane },
      value: 500 + i * i * 320,
      desc: `Cavalcatura: velocità +${Math.round(m.mult * 100)}%. Richiede livello ${m.lvl}. Premi R per evocarla.`,
    });
  });

  // ──────────────────────────────────────────────────────────
  // HAIRSTYLES — 6 shapes × 3 colors = 18 (capigliature)
  // ──────────────────────────────────────────────────────────
  const HAIR_SHAPES = [
    { shape: 'corto',   name: 'Taglio Corto' },
    { shape: 'lungo',   name: 'Chioma Lunga' },
    { shape: 'coda',    name: 'Coda di Cavallo' },
    { shape: 'cresta',  name: 'Cresta di Guerra' },
    { shape: 'treccia', name: 'Treccia Intrecciata' },
    { shape: 'rasato',  name: 'Rasato' },
  ];
  const HAIR_COLORS = [
    { color: 0x2c1b0e, label: 'Castano' },
    { color: 0xf1c40f, label: 'Biondo' },
    { color: 0x1a1a1a, label: 'Corvino' },
  ];
  let hairIdx = 0;
  for (const hs of HAIR_SHAPES) {
    for (const hc of HAIR_COLORS) {
      hairIdx++;
      add({
        id: `hair_${String(hairIdx).padStart(2, '0')}`,
        name: `${hs.name} (${hc.label})`,
        type: 'hair', quality: 'uncommon',
        style: { shape: hs.shape, color: hc.color },
        value: 150,
        desc: 'Acconciatura applicabile dal barbiere.',
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  // SCROLLS & ENHANCE MATERIALS
  // ──────────────────────────────────────────────────────────
  add({ id: 'pietra_raffinazione', name: 'Pietra di Raffinazione', type: 'material', quality: 'rare',
    stackable: true, value: 800, desc: 'Necessaria per potenziare oggetti oltre +4.' });
  add({ id: 'pergamena_benedizione', name: 'Pergamena della Benedizione', type: 'scroll', quality: 'epic',
    stackable: true, value: 1500, desc: 'Protegge l\'oggetto dalla perdita di livello se il potenziamento fallisce.' });
  add({ id: 'pergamena_incantamento', name: 'Pergamena dell\'Incantamento', type: 'scroll', quality: 'rare',
    stackable: true, value: 1200, desc: 'Ritira a sorte i bonus di un oggetto equipaggiabile.' });

  // ──────────────────────────────────────────────────────────
  // ZONE MATERIALS — 2 per zona × 8 (trofei dei mostri)
  // ──────────────────────────────────────────────────────────
  const ZONE_MATS = [
    ['Zanna Consunta', 'Piuma Dorata'],
    ['Pelliccia Cinerea', 'Ragnatela Spessa'],
    ['Sigillo dei Predoni', 'Fibbia Rubata'],
    ['Zanna di Sciacallo', 'Totem Spezzato'],
    ['Essenza Spettrale', 'Cenere Sussurrante'],
    ['Veleno Denso', 'Scaglia Palustre'],
    ['Aculeo Cremisi', 'Sabbia Vetrificata'],
    ['Corno Demoniaco', 'Scaglia del Tramonto'],
  ];
  ZONE_MATS.forEach((pair, zi) => {
    pair.forEach((name, mi) => {
      add({
        id: `mat_z${zi + 1}_${mi === 0 ? 'a' : 'b'}`,
        name, type: 'material', quality: zi < 3 ? 'common' : zi < 6 ? 'uncommon' : 'rare',
        stackable: true, value: 8 + zi * 14,
        desc: 'Trofeo di zona. Vendibile o richiesto da alcune missioni.',
      });
    });
  });

  // ──────────────────────────────────────────────────────────
  // FOOD — 6 piatti con buff temporanei
  // ──────────────────────────────────────────────────────────
  const FOODS = [
    { name: 'Riso al Vapore',       effect: { hp: 60 } },
    { name: 'Zuppa di Funghi',      effect: { mp: 50 } },
    { name: 'Spiedino di Cinghiale', effect: { buff: { stat: 'atk', mult: 1.12, dur: 90 } } },
    { name: 'Brodo della Nonna',    effect: { buff: { stat: 'def', mult: 1.15, dur: 90 } } },
    { name: 'Tè del Viandante',     effect: { buff: { stat: 'speed', mult: 1.10, dur: 90 } } },
    { name: 'Dolce di Loto',        effect: { hp: 120, mp: 80 } },
  ];
  FOODS.forEach((f, i) => {
    add({
      id: `cibo_${String(i + 1).padStart(2, '0')}`,
      name: f.name, type: 'consumable', subtype: 'food', quality: 'common',
      stackable: true, effect: f.effect, value: 25 + i * 20,
      desc: f.effect.buff ? `Buff temporaneo (${f.effect.buff.dur}s).` : 'Ristora salute o energia.',
    });
  });

  // ──────────────────────────────────────────────────────────
  // BONUS POOL — bonus casuali sugli oggetti equipaggiabili
  // ──────────────────────────────────────────────────────────
  const BONUS_DEFS = [
    ['atk', 'Attacco', [1, 4], [4, 9], [9, 18]],
    ['matk', 'Attacco Magico', [1, 4], [4, 9], [9, 18]],
    ['def', 'Difesa', [1, 3], [3, 7], [7, 14]],
    ['hp', 'HP Massimi', [10, 30], [30, 80], [80, 180]],
    ['mp', 'MP Massimi', [8, 20], [20, 50], [50, 110]],
    ['speed', 'Velocità', [2, 5], [5, 10], [10, 18]],
    ['crit', 'Critico', [0.005, 0.015], [0.015, 0.03], [0.03, 0.06]],
  ];
  const MAGNITUDE = ['Minore', 'Maggiore', 'Supremo'];
  D.BONUS_POOL = [];
  BONUS_DEFS.forEach(([stat, label, ...ranges]) => {
    ranges.forEach((range, m) => {
      D.BONUS_POOL.push({
        id: `bonus_${stat}_${m + 1}`,
        name: `${label} ${MAGNITUDE[m]}`,
        stat, min: range[0], max: range[1],
        weight: [6, 3, 1][m],
      });
    });
  });

  // ──────────────────────────────────────────────────────────
  // EXTRA SKILLS — +4 per classe → 8 totali a classe
  // ──────────────────────────────────────────────────────────
  const NEW_SKILLS = {
    colpo_devastante:   { name: 'Colpo Devastante', class: 'guerriero', mp: 22, cd: 9,  type: 'multi', hits: 1, mult: 3.2, icon: '💥', desc: 'Un singolo colpo dal danno enorme.' },
    muro_di_ferro:      { name: 'Muro di Ferro', class: 'guerriero', mp: 18, cd: 16, type: 'buff', stat: 'def', mult: 2.2, dur: 10, icon: '🛡️', desc: 'Difesa più che raddoppiata per 10s.' },
    grido_intimidatorio:{ name: 'Grido Intimidatorio', class: 'guerriero', mp: 14, cd: 11, type: 'aoe', radius: 150, mult: 0.6, icon: '📣', desc: 'Danno leggero a tutti i nemici vicini.' },
    lama_sanguinante:   { name: 'Lama Sanguinante', class: 'guerriero', mp: 16, cd: 10, type: 'dot', mult: 0.6, ticks: 6, tickRate: 1, icon: '🩸', desc: 'Emorragia: danni nel tempo per 6s.' },

    pioggia_di_shuriken:{ name: 'Pioggia di Shuriken', class: 'ninja', mp: 18, cd: 8, type: 'aoe', radius: 160, mult: 1.1, icon: '🌀', desc: 'Lame rotanti colpiscono tutti i nemici vicini.' },
    danza_delle_lame:   { name: 'Danza delle Lame', class: 'ninja', mp: 16, cd: 14, type: 'buff', stat: 'speed', mult: 1.5, dur: 8, icon: '💃', desc: 'Velocità +50% per 8 secondi.' },
    occultamento:       { name: 'Occultamento', class: 'ninja', mp: 20, cd: 18, type: 'buff', stat: 'crit', mult: 3, dur: 6, icon: '🌫️', desc: 'Critico triplicato per 6 secondi.' },
    lacerazione:        { name: 'Lacerazione', class: 'ninja', mp: 22, cd: 9, type: 'multi', hits: 6, mult: 0.55, icon: '⚔️', desc: 'Sei fendenti rapidissimi.' },

    lampo_oscuro:       { name: 'Lampo Oscuro', class: 'mago', mp: 18, cd: 6, type: 'projectile', mult: 2.4, icon: '🌑', desc: 'Dardo d\'ombra ad alto danno.' },
    muro_di_fiamme:     { name: 'Muro di Fiamme', class: 'mago', mp: 26, cd: 12, type: 'aoe_delayed', delay: 0.5, radius: 160, mult: 1.6, icon: '🔥', desc: 'Esplosione di fuoco ritardata sull\'area del bersaglio.' },
    implosione:         { name: 'Implosione', class: 'mago', mp: 30, cd: 14, type: 'aoe', radius: 110, mult: 2.6, icon: '🕳️', desc: 'Collasso arcano: danni enormi in area ridotta.' },
    barriera_temporale: { name: 'Barriera Temporale', class: 'mago', mp: 24, cd: 18, type: 'shield', amount: 0.5, icon: '⏳', desc: 'Scudo pari al 50% degli HP massimi.' },

    rigenerazione:        { name: 'Rigenerazione', class: 'sciamano', mp: 18, cd: 9, type: 'heal', mult: 0.3, icon: '🌿', desc: 'Cura il 30% degli HP massimi.' },
    collera_del_cielo:    { name: 'Collera del Cielo', class: 'sciamano', mp: 28, cd: 13, type: 'aoe', radius: 170, mult: 1.8, stun: 0.3, icon: '🌩️', desc: 'Fulmini su tutta l\'area, possono stordire.' },
    scarica_fulminante:   { name: 'Scarica Fulminante', class: 'sciamano', mp: 16, cd: 6, type: 'projectile', mult: 2.0, icon: '⚡', desc: 'Dardo di fulmine concentrato.' },
    benedizione_di_guerra:{ name: 'Benedizione di Guerra', class: 'sciamano', mp: 22, cd: 16, type: 'buff', stat: 'atk', mult: 1.5, dur: 10, icon: '🔱', desc: 'Attacco +50% per 10 secondi.' },
  };
  for (const [id, sk] of Object.entries(NEW_SKILLS)) {
    sk.id = id;
    D.SKILLS[id] = sk;
  }
  D.CLASSES.guerriero.skills.push('colpo_devastante', 'muro_di_ferro', 'grido_intimidatorio', 'lama_sanguinante');
  D.CLASSES.ninja.skills.push('pioggia_di_shuriken', 'danza_delle_lame', 'occultamento', 'lacerazione');
  D.CLASSES.mago.skills.push('lampo_oscuro', 'muro_di_fiamme', 'implosione', 'barriera_temporale');
  D.CLASSES.sciamano.skills.push('rigenerazione', 'collera_del_cielo', 'scarica_fulminante', 'benedizione_di_guerra');

  // ──────────────────────────────────────────────────────────
  // DROP POOLS — equipaggiamento per tier (usati dai mostri generati)
  // ──────────────────────────────────────────────────────────
  D.DROP_POOLS = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] };
  for (const it of Object.values(D.ITEMS)) {
    if ((it.type === 'weapon' || it.type === 'armor' || it.type === 'jewelry') && it.level) {
      D.DROP_POOLS[tierOf(it.level)].push(it.id);
    }
  }

  // ──────────────────────────────────────────────────────────
  // EXPAND SHOP — il fabbro vende anche le prime armi nuove
  // ──────────────────────────────────────────────────────────
  if (D.SHOPS.blacksmith_weapons) {
    ['wpn_guerriero_01', 'wpn_ninja_01', 'wpn_mago_01', 'wpn_sciamano_01',
     'arm_body_guerriero_01', 'arm_head_01', 'arm_shield_01', 'arm_boots_01']
      .forEach(id => D.SHOPS.blacksmith_weapons.items.push({ id, qty: 1 }));
  }

  console.log('[content] Catalogo generato:', Object.keys(D.ITEMS).length, 'oggetti totali,',
    Object.keys(D.SKILLS).length, 'abilità');
})();
