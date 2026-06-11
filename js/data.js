// =============================================================================
// Regni d'Oriente — Game Data
// =============================================================================
'use strict';

const GameData = {};

// ---------------------------------------------------------------------------
// ITEM QUALITY
// ---------------------------------------------------------------------------
GameData.ITEM_QUALITY = {
  common:    '#aaaaaa',
  uncommon:  '#4CAF50',
  rare:      '#2196F3',
  epic:      '#9C27B0',
  legendary: '#FF9800'
};

// ---------------------------------------------------------------------------
// CLASSES
// ---------------------------------------------------------------------------
GameData.CLASSES = {
  guerriero: {
    id: 'guerriero',
    name: 'Guerriero',
    icon: '⚔️',
    color: '#e53935',
    description: 'Combattente frontale corazzato. Domina il campo con forza bruta e resistenza sovrumana.',
    baseStats: { hp: 220, mp: 60,  atk: 18, matk: 4,  def: 14, speed: 200, crit: 5  },
    hpPerLevel:   22,
    mpPerLevel:   3,
    atkPerLevel:  2.2,
    defPerLevel:  1.6,
    equipmentSlots: ['weapon','helmet','chest','legs','gloves','boots','ring','necklace'],
    skills: ['spinning_slash','war_cry','charge','berserker'],
    weaponTypes: ['sword','axe','mace']
  },

  ninja: {
    id: 'ninja',
    name: 'Ninja',
    icon: '🗡️',
    color: '#7B1FA2',
    description: 'Assassino nell\'ombra. Colpisce veloci come il vento prima che il nemico possa reagire.',
    baseStats: { hp: 160, mp: 90,  atk: 22, matk: 6,  def: 8,  speed: 270, crit: 15 },
    hpPerLevel:   14,
    mpPerLevel:   5,
    atkPerLevel:  2.8,
    defPerLevel:  0.8,
    equipmentSlots: ['weapon','chest','gloves','boots','ring','necklace'],
    skills: ['blade_storm','shadow_step','poison_blade','assassination'],
    weaponTypes: ['dagger','sword']
  },

  mago: {
    id: 'mago',
    name: 'Mago',
    icon: '🔥',
    color: '#1565C0',
    description: 'Maestro degli arcani. Piega la realtà con magie distruttive capaci di annientare intere orde.',
    baseStats: { hp: 130, mp: 180, atk: 7,  matk: 26, def: 5,  speed: 210, crit: 8  },
    hpPerLevel:   10,
    mpPerLevel:   14,
    atkPerLevel:  0.6,
    defPerLevel:  0.5,
    matkPerLevel: 3.2,
    equipmentSlots: ['weapon','helmet','chest','gloves','boots','ring','necklace'],
    skills: ['fireball','ice_lance','arcane_shield','meteor'],
    weaponTypes: ['staff']
  },

  sciamano: {
    id: 'sciamano',
    name: 'Sciamano',
    icon: '⚡',
    color: '#00897B',
    description: 'Canale degli spiriti. Scaglia fulmini contro i nemici e sostiene i compagni con benedizioni ancestrali.',
    baseStats: { hp: 150, mp: 160, atk: 9,  matk: 22, def: 7,  speed: 220, crit: 6  },
    hpPerLevel:   12,
    mpPerLevel:   12,
    atkPerLevel:  0.8,
    defPerLevel:  0.7,
    matkPerLevel: 2.8,
    equipmentSlots: ['weapon','helmet','chest','gloves','boots','ring','necklace'],
    skills: ['chain_lightning','healing_wave','thunder_storm','spirit_buff'],
    weaponTypes: ['rod','staff']
  }
};

// ---------------------------------------------------------------------------
// SKILLS
// ---------------------------------------------------------------------------
GameData.SKILLS = {

  // — Guerriero —
  spinning_slash: {
    id: 'spinning_slash',
    name: 'Fendente Rotante',
    class: 'guerriero',
    mp: 18,
    cd: 4000,
    type: 'aoe',
    mult: 1.4,
    radius: 120,
    desc: 'Ruota su te stesso colpendo tutti i nemici nel raggio. Danno fisico 140% ATK.',
    icon: '🌀'
  },

  war_cry: {
    id: 'war_cry',
    name: 'Grido di Guerra',
    class: 'guerriero',
    mp: 25,
    cd: 12000,
    type: 'buff',
    buffStat: 'atk',
    buffMult: 0.50,
    duration: 8000,
    desc: 'Emetti un grido belluino aumentando il tuo ATK del 50% per 8 secondi.',
    icon: '📣'
  },

  charge: {
    id: 'charge',
    name: 'Carica',
    class: 'guerriero',
    mp: 20,
    cd: 7000,
    type: 'dash_damage',
    mult: 1.8,
    dashRange: 350,
    stunDuration: 600,
    desc: 'Scatta verso il bersaglio, infliggendo 180% ATK e stordendo per 0.6s.',
    icon: '💨'
  },

  berserker: {
    id: 'berserker',
    name: 'Furia Berserker',
    class: 'guerriero',
    mp: 35,
    cd: 20000,
    type: 'buff',
    buffStats: { speed: 0.30, atk: 0.30 },
    duration: 10000,
    desc: 'Entra in uno stato di furia aumentando velocità e ATK del 30% per 10 secondi.',
    icon: '😤'
  },

  // — Ninja —
  blade_storm: {
    id: 'blade_storm',
    name: 'Tempesta di Lame',
    class: 'ninja',
    mp: 22,
    cd: 5000,
    type: 'multi_hit',
    hits: 5,
    multPerHit: 0.55,
    desc: 'Colpisce il bersaglio 5 volte rapidissimamente, ciascun colpo al 55% ATK.',
    icon: '🌪️'
  },

  shadow_step: {
    id: 'shadow_step',
    name: 'Passo Ombra',
    class: 'ninja',
    mp: 28,
    cd: 9000,
    type: 'teleport_behind',
    mult: 2.0,
    desc: 'Teletrasporti dietro al bersaglio e colpisci per 200% ATK con attacco critico garantito.',
    guaranteedCrit: true,
    icon: '👤'
  },

  poison_blade: {
    id: 'poison_blade',
    name: 'Lama Avvelenata',
    class: 'ninja',
    mp: 20,
    cd: 8000,
    type: 'dot',
    tickDamage: 0.35,
    ticks: 6,
    tickInterval: 1000,
    desc: 'Avvelena il bersaglio: infligge 35% ATK ogni secondo per 6 secondi.',
    icon: '☠️'
  },

  assassination: {
    id: 'assassination',
    name: 'Assassinio',
    class: 'ninja',
    mp: 40,
    cd: 16000,
    type: 'execute',
    mult: 3.5,
    hpThreshold: 0.30,
    desc: 'Colpo mortale: infligge 350% ATK. Se il bersaglio ha meno del 30% HP, danno triplicato.',
    icon: '💀'
  },

  // — Mago —
  fireball: {
    id: 'fireball',
    name: 'Palla di Fuoco',
    class: 'mago',
    mp: 24,
    cd: 3500,
    type: 'projectile_aoe',
    mult: 1.6,
    radius: 100,
    projectileSpeed: 400,
    desc: 'Lancia una palla di fuoco che esplode all\'impatto, colpendo in un\'area. 160% MATK.',
    icon: '🔥'
  },

  ice_lance: {
    id: 'ice_lance',
    name: 'Lancia di Ghiaccio',
    class: 'mago',
    mp: 20,
    cd: 5000,
    type: 'projectile_slow',
    mult: 1.3,
    slowAmount: 0.40,
    slowDuration: 3000,
    projectileSpeed: 600,
    desc: 'Proiettile di ghiaccio che infligge 130% MATK e rallenta il bersaglio del 40% per 3s.',
    icon: '🧊'
  },

  arcane_shield: {
    id: 'arcane_shield',
    name: 'Scudo Arcano',
    class: 'mago',
    mp: 35,
    cd: 15000,
    type: 'shield',
    shieldMult: 1.5,
    duration: 8000,
    desc: 'Crea uno scudo magico che assorbe danni pari al 150% del tuo MATK per 8 secondi.',
    icon: '🛡️'
  },

  meteor: {
    id: 'meteor',
    name: 'Meteora',
    class: 'mago',
    mp: 55,
    cd: 20000,
    type: 'aoe_delayed',
    mult: 3.0,
    radius: 160,
    delay: 1500,
    desc: 'Evoca una meteora che cade dopo 1.5s. Infligge 300% MATK in una vasta area.',
    icon: '☄️'
  },

  // — Sciamano —
  chain_lightning: {
    id: 'chain_lightning',
    name: 'Fulmine a Catena',
    class: 'sciamano',
    mp: 28,
    cd: 4500,
    type: 'chain',
    mult: 1.2,
    jumps: 4,
    jumpRange: 200,
    desc: 'Scaglia un fulmine che rimbalza su 4 bersagli, infliggendo 120% MATK a ciascuno.',
    icon: '⚡'
  },

  healing_wave: {
    id: 'healing_wave',
    name: 'Onda Risanatrice',
    class: 'sciamano',
    mp: 40,
    cd: 10000,
    type: 'heal',
    healMult: 0.45,
    desc: 'Canalizza le energie spirituali per curarti o curare un alleato del 45% degli HP massimi.',
    icon: '💚'
  },

  thunder_storm: {
    id: 'thunder_storm',
    name: 'Tempesta di Tuoni',
    class: 'sciamano',
    mp: 50,
    cd: 18000,
    type: 'aoe_stun',
    mult: 1.8,
    radius: 180,
    stunDuration: 1200,
    desc: 'Scatena una tempesta di fulmini che colpisce tutti i nemici vicini per 180% MATK e li stordisce per 1.2s.',
    icon: '🌩️'
  },

  spirit_buff: {
    id: 'spirit_buff',
    name: 'Aura degli Spiriti',
    class: 'sciamano',
    mp: 45,
    cd: 25000,
    type: 'aura_buff',
    buffStats: { atk: 0.20, matk: 0.20, def: 0.15 },
    radius: 300,
    duration: 12000,
    desc: 'Risveglia gli spiriti ancestrali, potenziando ATK e MATK del 20% e DEF del 15% per tutti i vicini per 12s.',
    icon: '✨'
  }
};

// ---------------------------------------------------------------------------
// ITEMS
// ---------------------------------------------------------------------------
GameData.ITEMS = {

  // ── Weapons: Guerriero (swords) ──────────────────────────────────────────
  iron_sword: {
    id: 'iron_sword', name: 'Spada di Ferro', type: 'weapon', subtype: 'sword',
    quality: 'common', slot: 'weapon',
    stats: { atk: 10 }, value: 80, stackable: false, level: 1,
    desc: 'Una spada di ferro semplice ma affidabile.'
  },
  steel_sword: {
    id: 'steel_sword', name: 'Spada d\'Acciaio', type: 'weapon', subtype: 'sword',
    quality: 'uncommon', slot: 'weapon',
    stats: { atk: 20, crit: 2 }, value: 300, stackable: false, level: 5,
    desc: 'Spada forgiata in acciaio pregiato, bilancio eccellente.'
  },
  knights_sword: {
    id: 'knights_sword', name: 'Spada del Cavaliere', type: 'weapon', subtype: 'sword',
    quality: 'rare', slot: 'weapon',
    stats: { atk: 35, def: 4, crit: 4 }, value: 800, stackable: false, level: 10,
    desc: 'Lama usata dai cavalieri d\'élite del regno. Equilibrio tra offesa e difesa.'
  },
  blazing_greatsword: {
    id: 'blazing_greatsword', name: 'Grande Spada Ardente', type: 'weapon', subtype: 'sword',
    quality: 'epic', slot: 'weapon',
    stats: { atk: 60, crit: 8, speed: 10 }, value: 2500, stackable: false, level: 14,
    desc: 'Incisa con rune infuocate, risplende di luce rossa in battaglia.'
  },

  // ── Weapons: Ninja (daggers) ─────────────────────────────────────────────
  rusty_dagger: {
    id: 'rusty_dagger', name: 'Pugnale Arrugginito', type: 'weapon', subtype: 'dagger',
    quality: 'common', slot: 'weapon',
    stats: { atk: 8, speed: 5 }, value: 60, stackable: false, level: 1,
    desc: 'Un vecchio pugnale ancora funzionale.'
  },
  shadow_dagger: {
    id: 'shadow_dagger', name: 'Pugnale Oscuro', type: 'weapon', subtype: 'dagger',
    quality: 'uncommon', slot: 'weapon',
    stats: { atk: 16, crit: 5, speed: 8 }, value: 280, stackable: false, level: 5,
    desc: 'Forgiato in metallo oscuro; agile e letale.'
  },
  venom_fang: {
    id: 'venom_fang', name: 'Zanna Velenosa', type: 'weapon', subtype: 'dagger',
    quality: 'rare', slot: 'weapon',
    stats: { atk: 28, crit: 9, speed: 12 }, value: 750, stackable: false, level: 10,
    desc: 'Il canale interno porta veleno puro direttamente nella ferita.'
  },
  midnight_kris: {
    id: 'midnight_kris', name: 'Kris di Mezzanotte', type: 'weapon', subtype: 'dagger',
    quality: 'epic', slot: 'weapon',
    stats: { atk: 50, crit: 16, speed: 18 }, value: 2200, stackable: false, level: 14,
    desc: 'Lama serrata forgiata durante un\'eclissi totale. Critico micidiale.'
  },

  // ── Weapons: Mago (staffs) ───────────────────────────────────────────────
  apprentice_staff: {
    id: 'apprentice_staff', name: 'Bastone dell\'Apprendista', type: 'weapon', subtype: 'staff',
    quality: 'common', slot: 'weapon',
    stats: { matk: 12 }, value: 70, stackable: false, level: 1,
    desc: 'Bastone di legno semplice con un cristallo scheggiato.'
  },
  flame_rod: {
    id: 'flame_rod', name: 'Bastone delle Fiamme', type: 'weapon', subtype: 'staff',
    quality: 'uncommon', slot: 'weapon',
    stats: { matk: 24, crit: 3 }, value: 320, stackable: false, level: 5,
    desc: 'L\'orbe ardente canalizza il fuoco con efficienza superiore.'
  },
  crystal_staff: {
    id: 'crystal_staff', name: 'Bastone di Cristallo', type: 'weapon', subtype: 'staff',
    quality: 'rare', slot: 'weapon',
    stats: { matk: 40, mp: 30, crit: 5 }, value: 900, stackable: false, level: 10,
    desc: 'Cristallo magico grezzo incastonato in legno antico di quercia nera.'
  },
  arcane_catalyst: {
    id: 'arcane_catalyst', name: 'Catalizzatore Arcano', type: 'weapon', subtype: 'staff',
    quality: 'epic', slot: 'weapon',
    stats: { matk: 70, mp: 60, crit: 9 }, value: 2800, stackable: false, level: 14,
    desc: 'Inciso con tutti gli alfabeti magici conosciuti. Amplifica ogni incantesimo.'
  },

  // ── Weapons: Sciamano (rods) ─────────────────────────────────────────────
  wooden_rod: {
    id: 'wooden_rod', name: 'Bastone di Legno', type: 'weapon', subtype: 'rod',
    quality: 'common', slot: 'weapon',
    stats: { matk: 10, hp: 10 }, value: 65, stackable: false, level: 1,
    desc: 'Un nodoso ramo inciso con simboli tribali.'
  },
  spirit_rod: {
    id: 'spirit_rod', name: 'Bastone degli Spiriti', type: 'weapon', subtype: 'rod',
    quality: 'uncommon', slot: 'weapon',
    stats: { matk: 20, hp: 20, def: 2 }, value: 300, stackable: false, level: 5,
    desc: 'Canalizza le energie spirituali con maggiore efficacia.'
  },
  thunder_totem: {
    id: 'thunder_totem', name: 'Totem del Tuono', type: 'weapon', subtype: 'rod',
    quality: 'rare', slot: 'weapon',
    stats: { matk: 36, hp: 40, crit: 4 }, value: 820, stackable: false, level: 10,
    desc: 'Scolpito dalle mani di un anziano sciamano, vibra di elettricità.'
  },
  ancestral_scepter: {
    id: 'ancestral_scepter', name: 'Scettro Ancestrale', type: 'weapon', subtype: 'rod',
    quality: 'epic', slot: 'weapon',
    stats: { matk: 62, hp: 70, def: 8, crit: 6 }, value: 2600, stackable: false, level: 14,
    desc: "Tramandato tra i grandi sciamani per generazioni. Emana un'aura di potere antico."
  },

  // ── Armor: Chest ─────────────────────────────────────────────────────────
  leather_vest: {
    id: 'leather_vest', name: 'Giaco di Cuoio', type: 'armor', subtype: 'chest',
    quality: 'common', slot: 'chest',
    stats: { def: 6 }, value: 90, stackable: false, level: 1,
    desc: 'Leggera protezione in cuoio, adatta a tutti.'
  },
  chainmail: {
    id: 'chainmail', name: 'Cotta di Maglia', type: 'armor', subtype: 'chest',
    quality: 'uncommon', slot: 'chest',
    stats: { def: 14, hp: 25 }, value: 350, stackable: false, level: 5,
    desc: 'Anelli intrecciati di acciaio offrono buona protezione senza limitare i movimenti.'
  },
  plate_cuirass: {
    id: 'plate_cuirass', name: 'Corazza a Piastre', type: 'armor', subtype: 'chest',
    quality: 'rare', slot: 'chest', classReq: 'guerriero',
    stats: { def: 26, hp: 55 }, value: 950, stackable: false, level: 10,
    desc: 'Piastre d\'acciaio ben temperate. Solo il guerriero più forte può portarla.'
  },
  dragonscale_armor: {
    id: 'dragonscale_armor', name: 'Armatura di Scaglie', type: 'armor', subtype: 'chest',
    quality: 'epic', slot: 'chest',
    stats: { def: 42, hp: 100, speed: 5 }, value: 3000, stackable: false, level: 14,
    desc: 'Costruita da scaglie di un giovane drago. Leggera e quasi indistruttibile.'
  },

  // ── Armor: Helmet ─────────────────────────────────────────────────────────
  leather_cap: {
    id: 'leather_cap', name: 'Cuffia di Cuoio', type: 'armor', subtype: 'helmet',
    quality: 'common', slot: 'helmet',
    stats: { def: 3 }, value: 50, stackable: false, level: 1,
    desc: 'Semplice protezione per la testa.'
  },
  iron_helm: {
    id: 'iron_helm', name: 'Elmo di Ferro', type: 'armor', subtype: 'helmet',
    quality: 'uncommon', slot: 'helmet',
    stats: { def: 9, hp: 15 }, value: 200, stackable: false, level: 5,
    desc: 'Elmo di ferro grezzo ma efficace.'
  },
  runic_helm: {
    id: 'runic_helm', name: 'Elmo Runico', type: 'armor', subtype: 'helmet',
    quality: 'rare', slot: 'helmet',
    stats: { def: 16, hp: 30, mp: 20 }, value: 700, stackable: false, level: 10,
    desc: 'Iscrizioni runiche aumentano la capacità di concentrazione.'
  },

  // ── Armor: Legs / Gloves / Boots ─────────────────────────────────────────
  leather_pants: {
    id: 'leather_pants', name: 'Pantaloni di Cuoio', type: 'armor', subtype: 'legs',
    quality: 'common', slot: 'legs',
    stats: { def: 4, speed: 3 }, value: 70, stackable: false, level: 1,
    desc: 'Comodi e resistenti.'
  },
  iron_greaves: {
    id: 'iron_greaves', name: 'Schinieri di Ferro', type: 'armor', subtype: 'legs',
    quality: 'uncommon', slot: 'legs',
    stats: { def: 10 }, value: 220, stackable: false, level: 5,
    desc: 'Protezione solida per le gambe.'
  },
  swift_boots: {
    id: 'swift_boots', name: 'Stivali Agili', type: 'armor', subtype: 'boots',
    quality: 'uncommon', slot: 'boots',
    stats: { def: 5, speed: 15 }, value: 240, stackable: false, level: 5,
    desc: 'Costruiti per chi ha fretta.'
  },
  battle_gloves: {
    id: 'battle_gloves', name: 'Guanti da Battaglia', type: 'armor', subtype: 'gloves',
    quality: 'uncommon', slot: 'gloves',
    stats: { def: 6, atk: 4, crit: 2 }, value: 230, stackable: false, level: 5,
    desc: 'Rinforzi in metallo sul dorso aumentano la potenza dei pugni.'
  },

  // ── Accessories: Rings ────────────────────────────────────────────────────
  copper_ring: {
    id: 'copper_ring', name: 'Anello di Rame', type: 'accessory', subtype: 'ring',
    quality: 'common', slot: 'ring',
    stats: { hp: 20 }, value: 40, stackable: false, level: 1,
    desc: 'Un semplice anello di rame con una gemma opaca.'
  },
  silver_ring: {
    id: 'silver_ring', name: 'Anello d\'Argento', type: 'accessory', subtype: 'ring',
    quality: 'uncommon', slot: 'ring',
    stats: { hp: 45, mp: 15 }, value: 200, stackable: false, level: 5,
    desc: 'L\'argento puro amplifica leggermente le energie vitali.'
  },
  ruby_ring: {
    id: 'ruby_ring', name: 'Anello di Rubino', type: 'accessory', subtype: 'ring',
    quality: 'rare', slot: 'ring',
    stats: { atk: 8, crit: 5 }, value: 600, stackable: false, level: 10,
    desc: 'Il rubino incandescente aumenta la ferocia in combattimento.'
  },
  sapphire_ring: {
    id: 'sapphire_ring', name: 'Anello di Zaffiro', type: 'accessory', subtype: 'ring',
    quality: 'rare', slot: 'ring',
    stats: { matk: 10, mp: 40 }, value: 620, stackable: false, level: 10,
    desc: 'Lo zaffiro amplifica la conduzione magica.'
  },

  // ── Accessories: Necklaces ────────────────────────────────────────────────
  bone_necklace: {
    id: 'bone_necklace', name: 'Collana di Osso', type: 'accessory', subtype: 'necklace',
    quality: 'common', slot: 'necklace',
    stats: { def: 2 }, value: 35, stackable: false, level: 1,
    desc: 'Denti di lupo infilati su un filo di cuoio. Grezzo ma portafortuna.'
  },
  jade_pendant: {
    id: 'jade_pendant', name: 'Pendente di Giada', type: 'accessory', subtype: 'necklace',
    quality: 'uncommon', slot: 'necklace',
    stats: { hp: 35, def: 4 }, value: 220, stackable: false, level: 5,
    desc: 'La pietra verde smorza i colpi nemici.'
  },
  warriors_torque: {
    id: 'warriors_torque', name: 'Torque del Guerriero', type: 'accessory', subtype: 'necklace',
    quality: 'rare', slot: 'necklace',
    stats: { atk: 6, def: 6, hp: 50 }, value: 700, stackable: false, level: 10,
    desc: 'Collare cerimoniale indossato dai campioni delle arene orientali.'
  },

  // ── Consumables ───────────────────────────────────────────────────────────
  hp_potion_small: {
    id: 'hp_potion_small', name: 'Pozione di Cura (S)', type: 'consumable', subtype: 'potion',
    quality: 'common', slot: null,
    stats: { heal: 80 }, value: 15, stackable: true, maxStack: 99,
    desc: 'Ripristina 80 HP immediatamente.'
  },
  hp_potion_medium: {
    id: 'hp_potion_medium', name: 'Pozione di Cura (M)', type: 'consumable', subtype: 'potion',
    quality: 'uncommon', slot: null,
    stats: { heal: 200 }, value: 40, stackable: true, maxStack: 99,
    desc: 'Ripristina 200 HP immediatamente.'
  },
  hp_potion_large: {
    id: 'hp_potion_large', name: 'Pozione di Cura (L)', type: 'consumable', subtype: 'potion',
    quality: 'rare', slot: null,
    stats: { heal: 500 }, value: 100, stackable: true, maxStack: 99,
    desc: 'Ripristina 500 HP immediatamente.'
  },
  mp_potion_small: {
    id: 'mp_potion_small', name: 'Pozione di Mana (S)', type: 'consumable', subtype: 'potion',
    quality: 'common', slot: null,
    stats: { restoreMp: 60 }, value: 18, stackable: true, maxStack: 99,
    desc: 'Ripristina 60 MP immediatamente.'
  },
  mp_potion_medium: {
    id: 'mp_potion_medium', name: 'Pozione di Mana (M)', type: 'consumable', subtype: 'potion',
    quality: 'uncommon', slot: null,
    stats: { restoreMp: 150 }, value: 45, stackable: true, maxStack: 99,
    desc: 'Ripristina 150 MP immediatamente.'
  },
  antidote: {
    id: 'antidote', name: 'Antidoto', type: 'consumable', subtype: 'potion',
    quality: 'common', slot: null,
    stats: { curePoison: true }, value: 25, stackable: true, maxStack: 99,
    desc: 'Rimuove immediatamente l\'avvelenamento.'
  },
  elixir_speed: {
    id: 'elixir_speed', name: 'Elisir della Velocità', type: 'consumable', subtype: 'elixir',
    quality: 'uncommon', slot: null,
    stats: { speedBuff: 0.20, duration: 30000 }, value: 80, stackable: true, maxStack: 20,
    desc: 'Aumenta la velocità di movimento del 20% per 30 secondi.'
  },

  // ── Materials ─────────────────────────────────────────────────────────────
  wolf_fur: {
    id: 'wolf_fur', name: 'Pelliccia di Lupo', type: 'material',
    quality: 'common', slot: null,
    stats: {}, value: 8, stackable: true, maxStack: 99,
    desc: 'Pelliccia morbida e calda, usata dai conciatori.'
  },
  boar_tusk: {
    id: 'boar_tusk', name: 'Zanna di Cinghiale', type: 'material',
    quality: 'common', slot: null,
    stats: {}, value: 10, stackable: true, maxStack: 99,
    desc: 'Dura e affilata, usata per creare ornamenti e strumenti.'
  },
  bandit_badge: {
    id: 'bandit_badge', name: 'Distintivo dei Banditi', type: 'material',
    quality: 'uncommon', slot: null,
    stats: {}, value: 18, stackable: true, maxStack: 99,
    desc: 'Il simbolo inconfondibile dell\'organizzazione criminale locale.'
  },
  orc_heart: {
    id: 'orc_heart', name: 'Cuore di Orco', type: 'material',
    quality: 'uncommon', slot: null,
    stats: {}, value: 25, stackable: true, maxStack: 99,
    desc: 'Ancora pulsante di energia brutale. Utilizzato in alchimia avanzata.'
  },
  demon_stone_shard: {
    id: 'demon_stone_shard', name: 'Scheggia di Pietra Demoniaca', type: 'material',
    quality: 'rare', slot: null,
    stats: {}, value: 50, stackable: true, maxStack: 50,
    desc: 'Frammento di un antico artefatto demoniaco. Emana un bagliore viola inquietante.'
  },
  dragon_scale_mat: {
    id: 'dragon_scale_mat', name: 'Scaglia di Drago', type: 'material',
    quality: 'epic', slot: null,
    stats: {}, value: 150, stackable: true, maxStack: 20,
    desc: 'Quasi indistruttibile. I fabbri migliori possono forgiare armature leggendarie.'
  },
  gold_coin: {
    id: 'gold_coin', name: 'Moneta d\'Oro', type: 'material',
    quality: 'common', slot: null,
    stats: {}, value: 1, stackable: true, maxStack: 9999,
    desc: 'Valuta corrente del regno.'
  }
};

// ---------------------------------------------------------------------------
// MONSTERS
// ---------------------------------------------------------------------------
GameData.MONSTERS = {

  wolf: {
    id: 'wolf', name: 'Lupo', color: '#78909C',
    level: 1, baseHp: 60, baseAtk: 6, baseDef: 2, speed: 180,
    aggroRange: 150, leashRange: 500, r: 18,
    xp: 15, gold: [1, 4],
    drops: [
      { item: 'wolf_fur',        chance: 0.55, qty: [1, 2] },
      { item: 'hp_potion_small', chance: 0.10, qty: [1, 1] }
    ],
    attacks: [
      { name: 'Morso', mult: 1.0, cd: 1500, type: 'melee' }
    ],
    ai: 'basic'
  },

  wolf_alpha: {
    id: 'wolf_alpha', name: 'Lupo Alpha', color: '#455A64',
    level: 3, baseHp: 130, baseAtk: 12, baseDef: 5, speed: 200,
    aggroRange: 180, leashRange: 550, r: 22,
    xp: 40, gold: [3, 8],
    drops: [
      { item: 'wolf_fur',        chance: 0.80, qty: [2, 3] },
      { item: 'hp_potion_small', chance: 0.20, qty: [1, 2] },
      { item: 'copper_ring',     chance: 0.05, qty: [1, 1] }
    ],
    attacks: [
      { name: 'Morso Feroce', mult: 1.2, cd: 1400, type: 'melee' },
      { name: 'Ululato', mult: 0, cd: 8000, type: 'buff', extra: { buffSelf: { atk: 0.20 }, duration: 6000 } }
    ],
    ai: 'basic'
  },

  boar: {
    id: 'boar', name: 'Cinghiale', color: '#8D6E63',
    level: 2, baseHp: 90, baseAtk: 9, baseDef: 4, speed: 160,
    aggroRange: 120, leashRange: 480, r: 20,
    xp: 25, gold: [2, 5],
    drops: [
      { item: 'boar_tusk',       chance: 0.50, qty: [1, 2] },
      { item: 'hp_potion_small', chance: 0.12, qty: [1, 1] }
    ],
    attacks: [
      { name: 'Carica', mult: 1.3, cd: 4000, type: 'dash', extra: { stunDuration: 500 } },
      { name: 'Zannata', mult: 0.9, cd: 1800, type: 'melee' }
    ],
    ai: 'basic'
  },

  bandit: {
    id: 'bandit', name: 'Bandito', color: '#795548',
    level: 5, baseHp: 200, baseAtk: 18, baseDef: 8, speed: 190,
    aggroRange: 200, leashRange: 600, r: 20,
    xp: 80, gold: [8, 18],
    drops: [
      { item: 'bandit_badge',    chance: 0.45, qty: [1, 1] },
      { item: 'hp_potion_small', chance: 0.20, qty: [1, 2] },
      { item: 'iron_sword',      chance: 0.04, qty: [1, 1] }
    ],
    attacks: [
      { name: 'Colpo di Spada', mult: 1.0, cd: 1600, type: 'melee' },
      { name: 'Lancio di Coltello', mult: 0.8, cd: 5000, type: 'ranged', range: 300 }
    ],
    ai: 'basic'
  },

  bandit_chief: {
    id: 'bandit_chief', name: 'Capo Bandito', color: '#4E342E',
    level: 8, baseHp: 500, baseAtk: 28, baseDef: 14, speed: 180,
    aggroRange: 250, leashRange: 700, r: 26,
    xp: 220, gold: [25, 50],
    drops: [
      { item: 'bandit_badge',    chance: 1.00, qty: [2, 3] },
      { item: 'chainmail',       chance: 0.25, qty: [1, 1] },
      { item: 'steel_sword',     chance: 0.15, qty: [1, 1] },
      { item: 'hp_potion_medium',chance: 0.50, qty: [1, 2] }
    ],
    attacks: [
      { name: 'Fendente Pesante', mult: 1.4, cd: 2000, type: 'melee' },
      { name: 'Grido di Raduno', mult: 0, cd: 12000, type: 'summon', extra: { summon: 'bandit', count: 2 } },
      { name: 'Parata', mult: 0, cd: 8000, type: 'buff', extra: { buffSelf: { def: 0.30 }, duration: 5000 } }
    ],
    ai: 'boss_lite'
  },

  orc_warrior: {
    id: 'orc_warrior', name: 'Guerriero Orco', color: '#558B2F',
    level: 10, baseHp: 380, baseAtk: 32, baseDef: 16, speed: 175,
    aggroRange: 200, leashRange: 650, r: 24,
    xp: 200, gold: [15, 35],
    drops: [
      { item: 'orc_heart',       chance: 0.35, qty: [1, 1] },
      { item: 'iron_greaves',    chance: 0.08, qty: [1, 1] },
      { item: 'hp_potion_medium',chance: 0.15, qty: [1, 1] }
    ],
    attacks: [
      { name: 'Martellata', mult: 1.3, cd: 1800, type: 'melee' },
      { name: 'Colpo Sismico', mult: 1.8, cd: 6000, type: 'aoe', radius: 80 }
    ],
    ai: 'basic'
  },

  orc_shaman: {
    id: 'orc_shaman', name: 'Sciamano Orco', color: '#2E7D32',
    level: 11, baseHp: 280, baseAtk: 14, baseDef: 10, speed: 165,
    aggroRange: 280, leashRange: 700, r: 22,
    xp: 180, gold: [12, 28],
    drops: [
      { item: 'orc_heart',       chance: 0.25, qty: [1, 1] },
      { item: 'demon_stone_shard',chance: 0.12, qty: [1, 1] },
      { item: 'mp_potion_small', chance: 0.20, qty: [1, 2] }
    ],
    attacks: [
      { name: 'Fulmine Tribale', mult: 1.5, cd: 2500, type: 'ranged', range: 350 },
      { name: 'Benedizione Oscura', mult: 0, cd: 10000, type: 'buff', extra: { buffNearby: { atk: 0.25 }, radius: 200, duration: 8000 } }
    ],
    ai: 'ranged_kite'
  },

  specter: {
    id: 'specter', name: 'Spettro', color: '#7E57C2',
    level: 12, baseHp: 320, baseAtk: 38, baseDef: 8, speed: 230,
    aggroRange: 250, leashRange: 600, r: 20,
    xp: 260, gold: [20, 40],
    drops: [
      { item: 'demon_stone_shard',chance: 0.30, qty: [1, 2] },
      { item: 'mp_potion_medium', chance: 0.18, qty: [1, 1] },
      { item: 'sapphire_ring',    chance: 0.05, qty: [1, 1] }
    ],
    attacks: [
      { name: 'Tocco Spettrale', mult: 1.2, cd: 1400, type: 'melee', extra: { drain: true } },
      { name: 'Urlo Terrificante', mult: 0.5, cd: 8000, type: 'aoe', radius: 150, extra: { fear: 2000 } }
    ],
    ai: 'aggressive'
  },

  stone_demon: {
    id: 'stone_demon', name: 'Demone di Pietra', color: '#616161',
    level: 14, baseHp: 600, baseAtk: 45, baseDef: 30, speed: 140,
    aggroRange: 200, leashRange: 600, r: 30,
    xp: 420, gold: [35, 70],
    drops: [
      { item: 'demon_stone_shard',chance: 0.65, qty: [1, 3] },
      { item: 'dragon_scale_mat', chance: 0.08, qty: [1, 1] },
      { item: 'hp_potion_large',  chance: 0.25, qty: [1, 2] }
    ],
    attacks: [
      { name: 'Pungo Lavico', mult: 1.6, cd: 2200, type: 'melee' },
      { name: 'Terremoto', mult: 2.0, cd: 10000, type: 'aoe', radius: 200, extra: { stun: 1000 } },
      { name: 'Guardia di Pietra', mult: 0, cd: 15000, type: 'buff', extra: { buffSelf: { def: 0.50 }, duration: 5000 } }
    ],
    ai: 'basic'
  },

  dungeon_boss_1: {
    id: 'dungeon_boss_1', name: 'Assassino Cremisi', color: '#B71C1C', boss: true,
    level: 8, baseHp: 1800, baseAtk: 35, baseDef: 18, speed: 200,
    aggroRange: 400, leashRange: 9999, r: 36,
    xp: 1200, gold: [80, 150],
    drops: [
      { item: 'bandit_badge',     chance: 1.00, qty: [3, 5] },
      { item: 'knights_sword',    chance: 0.30, qty: [1, 1] },
      { item: 'venom_fang',       chance: 0.30, qty: [1, 1] },
      { item: 'crystal_staff',    chance: 0.25, qty: [1, 1] },
      { item: 'thunder_totem',    chance: 0.25, qty: [1, 1] },
      { item: 'chainmail',        chance: 0.50, qty: [1, 1] },
      { item: 'hp_potion_large',  chance: 0.80, qty: [2, 3] }
    ],
    attacks: [
      { name: 'Doppia Lama', mult: 1.5, cd: 1500, type: 'melee' },
      { name: 'Ombra Mortale', mult: 2.5, cd: 8000, type: 'teleport_behind' },
      { name: 'Pioggia di Coltelli', mult: 0.8, cd: 12000, type: 'aoe', radius: 250 },
      { name: 'Fuga', mult: 0, cd: 20000, type: 'buff', extra: { buffSelf: { speed: 0.60 }, duration: 4000 } }
    ],
    ai: 'boss',
    phaseThreshold: 0.50
  },

  dungeon_boss_2: {
    id: 'dungeon_boss_2', name: 'Grande Sciamano Gror\'nak', color: '#1B5E20', boss: true,
    level: 13, baseHp: 3500, baseAtk: 52, baseDef: 28, speed: 160,
    aggroRange: 400, leashRange: 9999, r: 40,
    xp: 2800, gold: [180, 320],
    drops: [
      { item: 'orc_heart',         chance: 1.00, qty: [2, 4] },
      { item: 'demon_stone_shard', chance: 1.00, qty: [3, 5] },
      { item: 'blazing_greatsword',chance: 0.25, qty: [1, 1] },
      { item: 'midnight_kris',     chance: 0.25, qty: [1, 1] },
      { item: 'arcane_catalyst',   chance: 0.20, qty: [1, 1] },
      { item: 'ancestral_scepter', chance: 0.20, qty: [1, 1] },
      { item: 'dragonscale_armor', chance: 0.35, qty: [1, 1] },
      { item: 'hp_potion_large',   chance: 1.00, qty: [3, 5] },
      { item: 'dragon_scale_mat',  chance: 0.50, qty: [1, 2] }
    ],
    attacks: [
      { name: 'Bastone Arcano', mult: 1.4, cd: 1800, type: 'melee' },
      { name: 'Fulmine Triplo', mult: 1.6, cd: 5000, type: 'chain', jumps: 3, jumpRange: 200 },
      { name: 'Tempesta Spirituale', mult: 2.2, cd: 15000, type: 'aoe', radius: 300, extra: { stun: 1500 } },
      { name: 'Evoca Guardiani', mult: 0, cd: 25000, type: 'summon', extra: { summon: 'orc_warrior', count: 3 } },
      { name: 'Rinascita Tribale', mult: 0, cd: 30000, type: 'heal_self', extra: { healPct: 0.20 } }
    ],
    ai: 'boss',
    phaseThreshold: 0.40
  }
};

// ---------------------------------------------------------------------------
// MAPS
// ---------------------------------------------------------------------------
GameData.MAPS = {
  village: {
    id: 'village',
    name: 'Pianure di Khoristan',
    width: 3200,
    height: 3200,
    spawnPoint: { x: 1600, y: 1600 },
    bgColor: '#4a7c3f',
    zones: [
      {
        id: 'village_center',
        name: 'Villaggio di Azaran',
        x: 1400, y: 1400, w: 400, h: 400,
        monsters: [],
        density: 0,
        safe: true
      },
      {
        id: 'wolf_plains',
        name: 'Pianura dei Lupi',
        x: 400, y: 400, w: 900, h: 700,
        monsters: ['wolf', 'wolf_alpha'],
        density: 6,
        minLevel: 1
      },
      {
        id: 'boar_grove',
        name: 'Boschetto dei Cinghiali',
        x: 200, y: 1200, w: 700, h: 800,
        monsters: ['boar', 'wolf'],
        density: 5,
        minLevel: 2
      },
      {
        id: 'bandit_road',
        name: 'Strada dei Briganti',
        x: 1200, y: 200, w: 1200, h: 600,
        monsters: ['bandit', 'bandit_chief'],
        density: 5,
        minLevel: 5
      },
      {
        id: 'orc_highlands',
        name: 'Altopiani degli Orchi',
        x: 1800, y: 1100, w: 1100, h: 1000,
        monsters: ['orc_warrior', 'orc_shaman'],
        density: 5,
        minLevel: 10
      },
      {
        id: 'cursed_ruins',
        name: 'Rovine Maledette',
        x: 700, y: 2100, w: 900, h: 900,
        monsters: ['specter', 'stone_demon'],
        density: 4,
        minLevel: 12
      }
    ],
    dungeons: [
      { id: 'bandit_den',       name: 'Tana dei Banditi',      x: 1800, y: 500,  minLevel: 6  },
      { id: 'orc_stronghold',   name: 'Fortezza degli Orchi',  x: 2600, y: 1800, minLevel: 11 }
    ]
  }
};

// ---------------------------------------------------------------------------
// DUNGEONS
// ---------------------------------------------------------------------------
GameData.DUNGEONS = {
  bandit_den: {
    id: 'bandit_den',
    name: 'Tana dei Banditi',
    minLevel: 6,
    boss: 'dungeon_boss_1',
    bgColor: '#3e2723',
    floors: [
      {
        floorNum: 1,
        name: 'Ingresso Oscuro',
        width: 1200, height: 900,
        rooms: [
          { id: 'entry',   x: 50,  y: 400, w: 220, h: 160, type: 'entry'  },
          { id: 'room_1',  x: 300, y: 250, w: 250, h: 200, type: 'combat', monsters: ['bandit','bandit'], density: 2 },
          { id: 'room_2',  x: 300, y: 500, w: 250, h: 200, type: 'combat', monsters: ['bandit','bandit','bandit'], density: 3 },
          { id: 'corridor',x: 580, y: 300, w: 120, h: 400, type: 'corridor' },
          { id: 'room_3',  x: 730, y: 200, w: 280, h: 220, type: 'combat', monsters: ['bandit_chief'], density: 1 },
          { id: 'exit',    x: 1050,y: 380, w: 120, h: 120, type: 'stairs_down' }
        ]
      },
      {
        floorNum: 2,
        name: 'Sala del Capo',
        width: 1200, height: 900,
        rooms: [
          { id: 'entry',    x: 50,  y: 380, w: 120, h: 120, type: 'entry'   },
          { id: 'ante',     x: 220, y: 300, w: 300, h: 280, type: 'combat', monsters: ['bandit','bandit','bandit','bandit_chief'], density: 4 },
          { id: 'boss_room',x: 600, y: 250, w: 500, h: 400, type: 'boss',   boss: 'dungeon_boss_1' }
        ]
      }
    ]
  },

  orc_stronghold: {
    id: 'orc_stronghold',
    name: 'Fortezza degli Orchi',
    minLevel: 11,
    boss: 'dungeon_boss_2',
    bgColor: '#1b5e20',
    floors: [
      {
        floorNum: 1,
        name: 'Bastioni Esterni',
        width: 1400, height: 1000,
        rooms: [
          { id: 'entry',   x: 50,  y: 450, w: 200, h: 160, type: 'entry'  },
          { id: 'room_1',  x: 290, y: 280, w: 300, h: 220, type: 'combat', monsters: ['orc_warrior','orc_warrior','orc_shaman'], density: 3 },
          { id: 'room_2',  x: 290, y: 540, w: 300, h: 220, type: 'combat', monsters: ['orc_warrior','orc_warrior','orc_warrior'], density: 3 },
          { id: 'hall',    x: 640, y: 350, w: 200, h: 360, type: 'corridor' },
          { id: 'room_3',  x: 880, y: 240, w: 320, h: 260, type: 'combat', monsters: ['orc_shaman','orc_shaman','orc_warrior'], density: 3 },
          { id: 'exit',    x: 1220,y: 430, w: 140, h: 140, type: 'stairs_down' }
        ]
      },
      {
        floorNum: 2,
        name: 'Sala del Trono',
        width: 1400, height: 1000,
        rooms: [
          { id: 'entry',    x: 50,   y: 430, w: 140, h: 140, type: 'entry' },
          { id: 'guard',    x: 240,  y: 300, w: 350, h: 300, type: 'combat', monsters: ['orc_warrior','orc_warrior','orc_shaman','orc_shaman'], density: 4 },
          { id: 'boss_room',x: 650,  y: 200, w: 700, h: 600, type: 'boss',  boss: 'dungeon_boss_2' }
        ]
      }
    ]
  }
};

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------
GameData.NPCS = {
  blacksmith_torrin: {
    id: 'blacksmith_torrin',
    name: 'Torrin il Fabbro',
    x: 1580, y: 1480,
    icon: '🔨',
    shop: 'blacksmith_weapons',
    quests: [],
    dialogue: {
      greeting: 'Benvenuto nella mia fucina! Ho le armi migliori di tutta Khoristan. Cosa cerchi?',
      options: [
        { text: 'Mostrami la tua merce.',           action: 'open_shop',   shopId: 'blacksmith_weapons' },
        { text: 'Potresti riparare la mia armatura?',action: 'dialogue_line', line: 'Portami quello che hai bisogno di riparare, ci penso io.' },
        { text: 'Dove trovo mostri più forti?',      action: 'dialogue_line', line: 'A nord ci sono i briganti. A est gli orchi. Attenzione, non sono per i deboli di cuore.' },
        { text: 'Arrivederci.',                      action: 'close' }
      ]
    }
  },

  merchant_livia: {
    id: 'merchant_livia',
    name: 'Livia la Mercante',
    x: 1620, y: 1520,
    icon: '🛒',
    shop: 'merchant_goods',
    quests: [],
    dialogue: {
      greeting: 'Salve, viaggiatore! Ho tutto ciò di cui potresti aver bisogno per il tuo viaggio.',
      options: [
        { text: 'Fammi vedere la tua merce.',       action: 'open_shop', shopId: 'merchant_goods' },
        { text: 'Compri materiali?',                action: 'dialogue_line', line: 'Certo! Porto a casa qualsiasi cosa troviate in giro. I prezzi sono onesti.' },
        { text: 'Ci sono notizie dalla capitale?',  action: 'dialogue_line', line: 'Ho sentito che le rotte commerciali a est sono pericolose per via degli orchi. State attenti.' },
        { text: 'Arrivederci.',                     action: 'close' }
      ]
    }
  },

  quest_giver_elara: {
    id: 'quest_giver_elara',
    name: 'Elara la Cercatrice',
    x: 1540, y: 1560,
    icon: '📋',
    shop: null,
    quests: ['hunt_wolves', 'clear_bandits', 'demon_stones', 'dungeon_clear'],
    dialogue: {
      greeting: 'Avventuriero! Il villaggio ha bisogno di eroi come te. Ho compiti urgenti da assegnarti.',
      options: [
        { text: 'Quali missioni hai per me?',        action: 'open_quests' },
        { text: 'Come va il villaggio?',             action: 'dialogue_line', line: 'Male, purtroppo. I lupi attaccano il bestiame e i banditi bloccano le strade. Abbiamo bisogno di aiuto.' },
        { text: 'Cosa sai dei demoni di pietra?',   action: 'dialogue_line', line: 'Creature antichissime. Le loro schegge hanno proprietà magiche straordinarie. Sii cauto.' },
        { text: 'Arrivederci.',                     action: 'close' }
      ]
    }
  },

  healer_mira: {
    id: 'healer_mira',
    name: 'Mira la Guaritrice',
    x: 1660, y: 1580,
    icon: '💊',
    shop: 'healer_potions',
    quests: [],
    dialogue: {
      greeting: 'Che gli spiriti ti proteggano! Sei ferito? Posso curarti o vendere pozioni.',
      options: [
        { text: 'Guariscimi (50 oro).',             action: 'heal_service', cost: 50 },
        { text: 'Voglio comprare pozioni.',         action: 'open_shop',   shopId: 'healer_potions' },
        { text: 'Come funziona la tua magia?',      action: 'dialogue_line', line: 'Attingo alle energie naturali del mondo. Ogni pianta, ogni pietra ha la sua medicina.' },
        { text: 'Arrivederci.',                     action: 'close' }
      ]
    }
  },

  innkeeper_baldo: {
    id: 'innkeeper_baldo',
    name: 'Baldo l\'Oste',
    x: 1600, y: 1640,
    icon: '🍺',
    shop: null,
    quests: [],
    dialogue: {
      greeting: 'Benvenuto alla Locanda delle Stelle Cadenti! Posso offrirti riposo e ristoro, amico.',
      options: [
        { text: 'Voglio riposare (rigenerazione completa, 30 oro).', action: 'rest_service', cost: 30 },
        { text: 'Un boccale di birra (5 oro).',     action: 'buy_drink', cost: 5, buff: { hp: 20, duration: 60000 } },
        { text: 'Hai sentito qualcosa di interessante?', action: 'dialogue_line', line: 'Un mercante di passaggio parlava di una fortezza degli orchi a nord-est. Nessuno di quelli che ci sono andati è tornato sano.' },
        { text: 'Arrivederci.',                     action: 'close' }
      ]
    }
  }
};

// ---------------------------------------------------------------------------
// SHOPS
// ---------------------------------------------------------------------------
GameData.SHOPS = {
  blacksmith_weapons: {
    id: 'blacksmith_weapons',
    name: 'Fucina di Torrin',
    items: [
      { id: 'iron_sword',       qty: 99 },
      { id: 'steel_sword',      qty: 5  },
      { id: 'rusty_dagger',     qty: 99 },
      { id: 'shadow_dagger',    qty: 5  },
      { id: 'apprentice_staff', qty: 99 },
      { id: 'flame_rod',        qty: 5  },
      { id: 'wooden_rod',       qty: 99 },
      { id: 'spirit_rod',       qty: 5  },
      { id: 'leather_vest',     qty: 99 },
      { id: 'chainmail',        qty: 5  },
      { id: 'leather_cap',      qty: 99 },
      { id: 'iron_helm',        qty: 5  },
      { id: 'leather_pants',    qty: 99 },
      { id: 'battle_gloves',    qty: 10 },
      { id: 'swift_boots',      qty: 10 }
    ]
  },

  merchant_goods: {
    id: 'merchant_goods',
    name: 'Bottega di Livia',
    items: [
      { id: 'hp_potion_small',  qty: 99 },
      { id: 'hp_potion_medium', qty: 30 },
      { id: 'mp_potion_small',  qty: 99 },
      { id: 'mp_potion_medium', qty: 30 },
      { id: 'antidote',         qty: 50 },
      { id: 'elixir_speed',     qty: 20 },
      { id: 'copper_ring',      qty: 10 },
      { id: 'bone_necklace',    qty: 10 },
      { id: 'jade_pendant',     qty: 5  }
    ]
  },

  healer_potions: {
    id: 'healer_potions',
    name: 'Rimedi di Mira',
    items: [
      { id: 'hp_potion_small',  qty: 99 },
      { id: 'hp_potion_medium', qty: 50 },
      { id: 'hp_potion_large',  qty: 15 },
      { id: 'mp_potion_small',  qty: 99 },
      { id: 'mp_potion_medium', qty: 50 },
      { id: 'antidote',         qty: 99 }
    ]
  }
};

// ---------------------------------------------------------------------------
// QUESTS
// ---------------------------------------------------------------------------
GameData.QUESTS = {
  hunt_wolves: {
    id: 'hunt_wolves',
    name: 'La Minaccia dei Lupi',
    description: 'I lupi attaccano sempre più spesso il bestiame del villaggio. Elimina 10 lupi nelle pianure vicine.',
    npc: 'quest_giver_elara',
    level: 1,
    repeatable: false,
    objectives: [
      { type: 'kill', target: 'wolf', count: 10, current: 0, text: 'Uccidi Lupi (0/10)' }
    ],
    rewards: {
      xp: 250,
      gold: 80,
      items: [
        { id: 'hp_potion_medium', qty: 3 },
        { id: 'mp_potion_small',  qty: 2 }
      ]
    }
  },

  clear_bandits: {
    id: 'clear_bandits',
    name: 'Pulizia della Strada',
    description: 'I banditi rendono impossibile il commercio. Elimina 8 banditi e il loro capo per riaprire le strade.',
    npc: 'quest_giver_elara',
    level: 5,
    repeatable: false,
    objectives: [
      { type: 'kill', target: 'bandit',       count: 8, current: 0, text: 'Uccidi Banditi (0/8)'   },
      { type: 'kill', target: 'bandit_chief', count: 1, current: 0, text: 'Uccidi il Capo Bandito' }
    ],
    rewards: {
      xp: 600,
      gold: 200,
      items: [
        { id: 'chainmail',        qty: 1 },
        { id: 'hp_potion_medium', qty: 5 }
      ]
    }
  },

  demon_stones: {
    id: 'demon_stones',
    name: 'Raccolta di Pietre Demoniache',
    description: 'Le schegge di pietra demoniaca hanno proprietà alchemiche preziose. Raccogline 5 dalle creature delle rovine.',
    npc: 'quest_giver_elara',
    level: 10,
    repeatable: true,
    objectives: [
      { type: 'collect', item: 'demon_stone_shard', count: 5, current: 0, text: 'Raccogli Schegge Demoniache (0/5)' }
    ],
    rewards: {
      xp: 400,
      gold: 150,
      items: [
        { id: 'hp_potion_large', qty: 2 },
        { id: 'mp_potion_medium',qty: 2 }
      ]
    }
  },

  dungeon_clear: {
    id: 'dungeon_clear',
    name: 'Pulizia della Tana',
    description: 'L\'Assassino Cremisi terrorizza i dintorni dalla sua tana. Entra nel dungeon e metti fine alla sua esistenza.',
    npc: 'quest_giver_elara',
    level: 6,
    repeatable: false,
    objectives: [
      { type: 'kill', target: 'dungeon_boss_1', count: 1, current: 0, text: 'Sconfiggi l\'Assassino Cremisi' }
    ],
    rewards: {
      xp: 1500,
      gold: 400,
      items: [
        { id: 'steel_sword',      qty: 1 },
        { id: 'hp_potion_large',  qty: 5 },
        { id: 'mp_potion_medium', qty: 3 }
      ]
    }
  }
};

// ---------------------------------------------------------------------------
// LEVEL XP TABLE
// ---------------------------------------------------------------------------
GameData.levelXP = function(lvl) {
  return Math.floor(100 * Math.pow(lvl, 1.7));
};

// ---------------------------------------------------------------------------
// Export to window
// ---------------------------------------------------------------------------
window.GameData = GameData;
