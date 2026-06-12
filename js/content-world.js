// =============================================================================
// Regni d'Oriente — content-world.js
// Eseguito DOPO data.js e content.js. Arricchisce window.GameData in-place.
// =============================================================================
'use strict';

(function (GD) {

  // ===========================================================================
  // A) GENERATORE DI MOSTRI — 64 mob di zona + 6 world boss
  // ===========================================================================

  // Moltiplicatori per ruolo
  var ROLE_MULT = {
    minion:   { hp: 0.8,  atk: 0.9,  def: 0.7,  xp: 0.9,  speed: 100, aggro: 180, r: 13, ai: 'basic'        },
    soldier:  { hp: 1.0,  atk: 1.0,  def: 1.0,  xp: 1.0,  speed: 95,  aggro: 180, r: 16, ai: 'basic'        },
    ranged:   { hp: 0.7,  atk: 1.2,  def: 0.6,  xp: 1.1,  speed: 85,  aggro: 230, r: 14, ai: 'ranged_kite'  },
    elite:    { hp: 1.7,  atk: 1.3,  def: 1.4,  xp: 1.8,  speed: 105, aggro: 180, r: 20, ai: 'pack'         },
    champion: { hp: 2.8,  atk: 1.6,  def: 1.8,  xp: 3.0,  speed: 90,  aggro: 240, r: 24, ai: 'boss'         }
  };

  function makeMob(id, name, lvl, role, zoneTier, matA, matB, colors, idx) {
    var m = ROLE_MULT[role];
    var hp  = Math.round((30 + lvl * 14) * m.hp);
    var atk = Math.round((4  + lvl * 2.1) * m.atk);
    var def = Math.round(lvl * 0.8 * m.def);
    var xp  = Math.round((12 + lvl * 7) * m.xp);
    var gold = [Math.round(lvl * 1.2), Math.round(lvl * 4)];
    var pool = (GD.DROP_POOLS && GD.DROP_POOLS[zoneTier]) ? GD.DROP_POOLS[zoneTier] : null;
    var gems = ['gem_rubino_g1','gem_zaffiro_g1','gem_smeraldo_g1','gem_ametista_g1','gem_topazio_g1'];
    var gemId = gems[idx % gems.length];

    var attacks;
    if (role === 'ranged') {
      attacks = [{ name: 'Attacco a Distanza', mult: 1.0, cd: 2.2 }];
    } else if (role === 'champion') {
      attacks = [
        { name: 'Attacco', mult: 1.0, cd: 1.6 },
        { name: 'Colpo Devastante', mult: 1.8, cd: 3.0 }
      ];
    } else {
      attacks = [{ name: 'Attacco', mult: 1.0, cd: 1.4 }];
    }

    var drops = [
      { item: matA, chance: 0.35, qty: [1, 2] },
      { item: matB, chance: 0.25, qty: [1, 2] },
      { item: 'hp_potion_medium', chance: 0.12, qty: [1, 1] },
      { item: gemId, chance: role === 'champion' ? 0.10 : 0.02, qty: [1, 1] }
    ];
    if (pool) {
      drops.push({ item: pool[idx % pool.length], chance: role === 'champion' ? 0.15 : 0.04, qty: [1, 1] });
    }

    return {
      id: id,
      name: name,
      color: colors[idx % colors.length],
      level: lvl,
      baseHp: hp,
      baseAtk: atk,
      baseDef: def,
      speed: m.speed,
      aggroRange: m.aggro,
      leashRange: 700,
      r: m.r,
      xp: xp,
      gold: gold,
      drops: drops,
      attacks: attacks,
      ai: m.ai
    };
  }

  // ---------------------------------------------------------------------------
  // Definizione delle 8 zone
  // Ordine ruoli per zona: [minion,minion,minion,soldier,soldier,ranged,elite,champion] (indici 0-7)
  // ---------------------------------------------------------------------------
  var ZONE_DEFS = [
    {
      id: 'prati_di_levante',
      tier: 1,
      levels: [1,2,2,3,4,3,5,6],
      matA: 'mat_z1_a', matB: 'mat_z1_b',
      colors: ['#a8d5a2','#7ec07a','#b5c98e','#c8e6a0','#d4e8b4','#8fbf8b','#6aaa65','#4e9a49'],
      creatures: ['Lepracino','Saltasterpre','Volpino','Cinghialetto','Erbacide','Strillador','Grufador','Ursling'],
      epithets: ['','','','Veterano','Veterano','Cacciatore','Feroce','Alfa']
    },
    {
      id: 'foresta_cinerea',
      tier: 2,
      levels: [6,7,8,9,10,8,11,12],
      matA: 'mat_z2_a', matB: 'mat_z2_b',
      colors: ['#9e9e9e','#757575','#8d8d8d','#616161','#bdbdbd','#546e7a','#455a64','#37474f'],
      creatures: ['Ragnoselva','Lupocinere','Brigantello','Arciere Grigio','Boscaiolo Nero','Velaturno','Lupferro','Signore della Foresta'],
      epithets: ['','','','Veterano','Veterano','Cacciatore','Feroce','Signore']
    },
    {
      id: 'colline_dei_predoni',
      tier: 3,
      levels: [12,13,14,15,16,13,17,18],
      matA: 'mat_z3_a', matB: 'mat_z3_b',
      colors: ['#a1887f','#8d6e63','#795548','#6d4c41','#bcaaa4','#7b6057','#5d4037','#4e342e'],
      creatures: ['Scorridore','Predone di Strada','Assaltatore','Armigero Ramingo','Razziator','Balista Nomade','Guerriero delle Colline','Campione dei Predoni'],
      epithets: ['','','','Veterano','Veterano','Cacciatore','Feroce','Signore']
    },
    {
      id: 'steppa_rovente',
      tier: 4,
      levels: [18,20,21,22,23,19,24,25],
      matA: 'mat_z4_a', matB: 'mat_z4_b',
      colors: ['#ffb74d','#ffa726','#ff8f00','#e65100','#ffcc80','#f57c00','#bf360c','#8d4c0a'],
      creatures: ['Sciacallo Arido','Orco Selvatico','Pillager','Raknar','Iena Steppa','Lanciasassi Orco','Campione Bruciante','Karag il Conquistatore'],
      epithets: ['','','','Veterano','Veterano','Cacciatore','Feroce','Alfa']
    },
    {
      id: 'valle_dei_sussurri',
      tier: 5,
      levels: [25,26,28,29,30,27,31,32],
      matA: 'mat_z5_a', matB: 'mat_z5_b',
      colors: ['#ce93d8','#ba68c8','#ab47bc','#9c27b0','#e1bee7','#7b1fa2','#6a1b9a','#4a148c'],
      creatures: ['Ombralente','Spirito Errante','Larva Oscura','Spettroarmato','Mortelame','Banshee Urlante','Eterno Tormento','Sovrano delle Ombre'],
      epithets: ['','','','Veterano','Veterano','Cacciatore','Feroce','Signore']
    },
    {
      id: 'palude_morgana',
      tier: 6,
      levels: [32,33,35,36,37,34,38,40],
      matA: 'mat_z6_a', matB: 'mat_z6_b',
      colors: ['#80cbc4','#4db6ac','#26a69a','#00897b','#b2dfdb','#00796b','#004d40','#1a3c38'],
      creatures: ['Viperango','Ranarcia','Sanguisuga Gigante','Golem di Fango','Scorpioide','Velenofante','Idra Paludosa','Signora del Pantano'],
      epithets: ['','','','Veterano','Veterano','Cacciatore','Feroce','Signora']
    },
    {
      id: 'deserto_cremisi',
      tier: 7,
      levels: [40,41,43,44,45,42,46,48],
      matA: 'mat_z7_a', matB: 'mat_z7_b',
      colors: ['#ef9a9a','#e57373','#ef5350','#e53935','#ffcdd2','#c62828','#b71c1c','#7f0000'],
      creatures: ['Scorpione Cremisi','Elementale Sabbioso','Golem Lavico','Soldato del Deserto','Fuoco Vagante','Arciere del Sole','Titan Ardente','Re del Deserto'],
      epithets: ['','','','Veterano','Veterano','Cacciatore','Feroce','Alfa']
    },
    {
      id: 'picchi_del_tramonto',
      tier: 8,
      levels: [48,50,51,53,54,49,56,58],
      matA: 'mat_z8_a', matB: 'mat_z8_b',
      colors: ['#ff8a65','#ff7043','#f4511e','#e64a19','#ffccbc','#bf360c','#870000','#4e0000'],
      creatures: ['Demonetto Alato','Draghetto Minore','Sentinella Oscura','Orco Demoniaco','Signore del Fuoco','Arcere Infernale','Drago delle Vette','Imperatore delle Fiamme'],
      epithets: ['','','','Veterano','Veterano','Cacciatore','Feroce','Imperatore']
    }
  ];

  // Ruoli nell'ordine degli indici 0-7
  var ROLE_ORDER = ['minion','minion','minion','soldier','soldier','ranged','elite','champion'];

  // Genera tutti i mob di zona e li inserisce in GD.MONSTERS
  ZONE_DEFS.forEach(function (z) {
    z.levels.forEach(function (lvl, idx) {
      var role    = ROLE_ORDER[idx];
      var base    = z.creatures[idx];
      var epithet = z.epithets[idx];
      var fullName = epithet ? base + ' ' + epithet : base;
      var mobId   = 'mob_' + z.id + '_' + (idx + 1);
      GD.MONSTERS[mobId] = makeMob(mobId, fullName, lvl, role, z.tier, z.matA, z.matB, z.colors, idx);
    });
  });

  // ---------------------------------------------------------------------------
  // 6 World Boss (tier 3-8)
  // ---------------------------------------------------------------------------
  var WORLD_BOSS_DEFS = [
    { zoneId: 'colline_dei_predoni', tier: 3, lvl: 18, name: 'Gorvar il Divoratore',    matA: 'mat_z3_a', matB: 'mat_z3_b' },
    { zoneId: 'steppa_rovente',      tier: 4, lvl: 25, name: 'Kragash Sangue di Lava',  matA: 'mat_z4_a', matB: 'mat_z4_b' },
    { zoneId: 'valle_dei_sussurri',  tier: 5, lvl: 32, name: 'Morthane l\'Eterno',      matA: 'mat_z5_a', matB: 'mat_z5_b' },
    { zoneId: 'palude_morgana',      tier: 6, lvl: 40, name: 'Valdra la Pestilenza',    matA: 'mat_z6_a', matB: 'mat_z6_b' },
    { zoneId: 'deserto_cremisi',     tier: 7, lvl: 48, name: 'Solkarath il Bruciante',  matA: 'mat_z7_a', matB: 'mat_z7_b' },
    { zoneId: 'picchi_del_tramonto', tier: 8, lvl: 58, name: 'Zharukael Signore Oscuro',matA: 'mat_z8_a', matB: 'mat_z8_b' }
  ];

  WORLD_BOSS_DEFS.forEach(function (b) {
    var lvl = b.lvl;
    var champ = ROLE_MULT.champion;
    var hp  = Math.round((30 + lvl * 14) * champ.hp * 8);
    var atk = Math.round((4  + lvl * 2.1) * champ.atk);
    var def = Math.round(lvl * 0.8 * champ.def);
    var xp  = Math.round((12 + lvl * 7) * champ.xp * 6);
    var pool = (GD.DROP_POOLS && GD.DROP_POOLS[b.tier]) ? GD.DROP_POOLS[b.tier] : null;
    var gems = ['gem_rubino_g1','gem_zaffiro_g1','gem_smeraldo_g1','gem_ametista_g1','gem_topazio_g1'];
    var drops = [
      { item: b.matA, chance: 1.0,  qty: [1, 2] },
      { item: b.matB, chance: 1.0,  qty: [1, 2] },
      { item: gems[b.tier % gems.length], chance: 0.4, qty: [1, 1] }
    ];
    if (pool) {
      drops.push({ item: pool[0], chance: 0.5, qty: [1, 1] });
      if (pool.length > 1) {
        drops.push({ item: pool[1], chance: 0.3, qty: [1, 1] });
      }
    }

    var bossId = 'boss_' + b.zoneId;
    GD.MONSTERS[bossId] = {
      id: bossId,
      name: b.name,
      color: '#cc0000',
      level: lvl,
      boss: true,
      baseHp: hp,
      baseAtk: atk,
      baseDef: def,
      speed: 90,
      aggroRange: 300,
      leashRange: 9999,
      r: 30,
      xp: xp,
      gold: [Math.round(lvl * 20), Math.round(lvl * 45)],
      drops: drops,
      attacks: [
        { name: 'Colpo del Boss',    mult: 1.0, cd: 1.6  },
        { name: 'Furia Devastante',  mult: 1.8, cd: 3.0  }
      ],
      ai: 'boss'
    };
  });


  // ===========================================================================
  // B) ZONE — sostituisce GameData.MAPS.village.zones con 9 voci
  // ===========================================================================

  // Genera la lista di mob id per ogni zona
  function zoneMobIds(zoneId) {
    var ids = [];
    for (var i = 1; i <= 8; i++) {
      ids.push('mob_' + zoneId + '_' + i);
    }
    return ids;
  }

  GD.MAPS.village.zones = [
    // 0 — Villaggio sicuro (centro circa 1600,1600; rettangolo 1320-1880 / 1320-1880)
    {
      id: 'villaggio',
      name: 'Villaggio di Pietrascura',
      x: 1320, y: 1320, w: 560, h: 560,
      safe: true,
      monsters: [],
      density: 0,
      tier: 0,
      minLevel: 0
    },
    // 1 — t1: Prati di Levante — est del villaggio
    {
      id: 'prati_di_levante',
      name: 'Prati di Levante',
      x: 1900, y: 1320, w: 900, h: 900,
      monsters: zoneMobIds('prati_di_levante'),
      boss: undefined,
      density: 0.000008,
      tier: 1,
      minLevel: 1
    },
    // 2 — t2: Foresta Cinerea — nord-est
    {
      id: 'foresta_cinerea',
      name: 'Foresta Cinerea',
      x: 1900, y: 380, w: 900, h: 900,
      monsters: zoneMobIds('foresta_cinerea'),
      boss: undefined,
      density: 0.000008,
      tier: 2,
      minLevel: 6
    },
    // 3 — t3: Colline dei Predoni — nord
    {
      id: 'colline_dei_predoni',
      name: 'Colline dei Predoni',
      x: 1150, y: 200, w: 900, h: 900,
      monsters: zoneMobIds('colline_dei_predoni'),
      boss: 'boss_colline_dei_predoni',
      density: 0.000008,
      tier: 3,
      minLevel: 12
    },
    // 4 — t4: Steppa Rovente — nord-ovest
    {
      id: 'steppa_rovente',
      name: 'Steppa Rovente',
      x: 200, y: 200, w: 900, h: 900,
      monsters: zoneMobIds('steppa_rovente'),
      boss: 'boss_steppa_rovente',
      density: 0.000008,
      tier: 4,
      minLevel: 18
    },
    // 5 — t5: Valle dei Sussurri — ovest
    {
      id: 'valle_dei_sussurri',
      name: 'Valle dei Sussurri',
      x: 200, y: 1150, w: 900, h: 900,
      monsters: zoneMobIds('valle_dei_sussurri'),
      boss: 'boss_valle_dei_sussurri',
      density: 0.000008,
      tier: 5,
      minLevel: 25
    },
    // 6 — t6: Palude Morgana — sud-ovest
    {
      id: 'palude_morgana',
      name: 'Palude Morgana',
      x: 200, y: 2100, w: 900, h: 900,
      monsters: zoneMobIds('palude_morgana'),
      boss: 'boss_palude_morgana',
      density: 0.000008,
      tier: 6,
      minLevel: 32
    },
    // 7 — t7: Deserto Cremisi — sud
    {
      id: 'deserto_cremisi',
      name: 'Deserto Cremisi',
      x: 1150, y: 2100, w: 900, h: 900,
      monsters: zoneMobIds('deserto_cremisi'),
      boss: 'boss_deserto_cremisi',
      density: 0.000008,
      tier: 7,
      minLevel: 40
    },
    // 8 — t8: Picchi del Tramonto — sud-est
    {
      id: 'picchi_del_tramonto',
      name: 'Picchi del Tramonto',
      x: 2100, y: 2100, w: 900, h: 900,
      monsters: zoneMobIds('picchi_del_tramonto'),
      boss: 'boss_picchi_del_tramonto',
      density: 0.000008,
      tier: 8,
      minLevel: 48
    }
  ];

  // GD.MAPS.village.dungeons rimane invariato (già definito in data.js)


  // ===========================================================================
  // C) STONE TIERS
  // ===========================================================================
  var STONE_LEVELS = [4, 10, 16, 22, 30, 38, 46, 54];
  var ROMAN        = ['I','II','III','IV','V','VI','VII','VIII'];

  GD.STONE_TIERS = STONE_LEVELS.map(function (lvl, i) {
    var tier = i + 1;
    return {
      tier: tier,
      name: 'Pietra Demoniaca ' + ROMAN[i],
      level: lvl,
      hp: 400 + tier * 450,
      xp: 150 + tier * 180,
      gold: [tier * 40, tier * 90],
      maxMinions: 3 + Math.min(3, tier)
    };
  });


  // ===========================================================================
  // D) NUOVI NPC
  // ===========================================================================

  GD.NPCS.barbiere_zara = {
    id: 'barbiere_zara',
    name: 'Zara la Forbice',
    x: 1500, y: 1650,
    icon: '💇',
    shop: 'barber_shop',
    quests: [],
    dialogue: {
      greeting: 'Benvenuto nel mio salone! Un bel taglio di capelli può cambiare la vita, che ne dici?',
      options: [
        { text: 'Mostrami gli stili disponibili.',     action: 'open_shop',  shopId: 'barber_shop' },
        { text: 'Voglio cambiare il mio aspetto.',     action: 'open_barber' },
        { text: 'Come mai sei finita in questo villaggio?', action: 'dialogue_line', line: 'Ho viaggiato per tutta Khoristan affinando la mia arte. Pietrascura ha i clienti più interessanti.' },
        { text: 'Arrivederci.',                        action: 'close' }
      ]
    }
  };

  GD.NPCS.alchimista_morvan = {
    id: 'alchimista_morvan',
    name: 'Morvan l\'Alchimista',
    x: 1700, y: 1480,
    icon: '⚗️',
    shop: 'alchemy_shop',
    quests: ['reagenti_rari'],
    dialogue: {
      greeting: 'Ah, un avventuriero! Forse cerchi elisir, gemme o qualche pergamena arcana? Ho di tutto.',
      options: [
        { text: 'Vedi cosa hai in vendita.',            action: 'open_shop',    shopId: 'alchemy_shop' },
        { text: 'Posso usare il tuo laboratorio?',      action: 'open_alchemy' },
        { text: 'Hai bisogno di materiali?',            action: 'dialogue_line', line: 'Sempre! Le radici delle paludi e i cristalli del deserto sono la mia valuta. Ho una missione per te se interessato.' },
        { text: 'Arrivederci.',                         action: 'close' }
      ]
    }
  };

  GD.NPCS.stalliere_rocco = {
    id: 'stalliere_rocco',
    name: 'Rocco lo Stalliere',
    x: 1450, y: 1500,
    icon: '🐎',
    shop: 'stable_shop',
    quests: [],
    dialogue: {
      greeting: 'Ehilà! Cerchi una cavalcatura veloce? Ho le migliori bestie di tutto il regno, parola di Rocco!',
      options: [
        { text: 'Mostrami le cavalcature disponibili.', action: 'open_shop',   shopId: 'stable_shop' },
        { text: 'Voglio gestire la mia scuderia.',       action: 'open_stable' },
        { text: 'Dove trovi questi animali?',            action: 'dialogue_line', line: 'Giro i mercati di tutta Khoristan. Alcuni li catturo io stesso nelle steppe a nord. Non è un lavoro per i timidi.' },
        { text: 'Arrivederci.',                          action: 'close' }
      ]
    }
  };

  GD.NPCS.incantatrice_lyra = {
    id: 'incantatrice_lyra',
    name: 'Lyra l\'Incantatrice',
    x: 1720, y: 1620,
    icon: '✨',
    shop: 'enchant_shop',
    quests: [],
    dialogue: {
      greeting: 'Le stelle mi hanno detto che saresti venuto. Vuoi potenziare le tue armi con magia antica?',
      options: [
        { text: 'Mostrami i tuoi materiali arcani.',    action: 'open_shop',   shopId: 'enchant_shop' },
        { text: 'Incanta un mio oggetto.',              action: 'open_forge' },
        { text: 'Come hai imparato l\'incantamento?',  action: 'dialogue_line', line: 'Ho studiato nelle biblioteche segrete di Valdranoth per vent\'anni. Ogni runa ha il suo costo.' },
        { text: 'Arrivederci.',                         action: 'close' }
      ]
    }
  };

  GD.NPCS.maestro_khan = {
    id: 'maestro_khan',
    name: 'Maestro Khan',
    x: 1550, y: 1720,
    icon: '🥋',
    shop: null,
    quests: [],
    dialogue: {
      greeting: 'Chi cerca la forza senza disciplina trova soltanto la morte. Parla, discepolo.',
      options: [
        { text: 'Voglio imparare nuove abilità.',       action: 'open_skills' },
        { text: 'Parlami dell\'addestramento.',         action: 'dialogue_line', line: 'Il corpo è uno strumento. Per affilarlo servono sacrificio, sudore e mille ripetizioni. Non esistono scorciatoie.' },
        { text: 'Cosa sai delle terre oscure?',         action: 'dialogue_line', line: 'Ho combattuto nei Picchi del Tramonto vent\'anni fa. Ciò che dorme là non deve essere risvegliato. Allenati bene prima di avvicinarti.' },
        { text: 'Arrivederci.',                         action: 'close' }
      ]
    }
  };

  GD.NPCS.capitano_dorn = {
    id: 'capitano_dorn',
    name: 'Capitano Dorn',
    x: 1650, y: 1700,
    icon: '🛡️',
    shop: null,
    quests: ['purge_foresta','predoni_taglia','steppa_offensiva','sussurri_silenzio'],
    dialogue: {
      greeting: 'Avventuriero! Il villaggio è minacciato da ogni lato. Ho compiti urgenti per chiunque abbia coraggio.',
      options: [
        { text: 'Mostrami le missioni disponibili.',    action: 'open_quests' },
        { text: 'Come vanno le cose al confine?',       action: 'dialogue_line', line: 'Male. I predoni delle colline stanno diventando audaci. E ci sono voci di non-morti nella Valle dei Sussurri. Tieniti pronto.' },
        { text: 'Arrivederci.',                         action: 'close' }
      ]
    }
  };

  GD.NPCS.nonna_mei = {
    id: 'nonna_mei',
    name: 'Nonna Mei',
    x: 1480, y: 1580,
    icon: '🍜',
    shop: 'food_shop',
    quests: ['sapori_di_palude'],
    dialogue: {
      greeting: 'Figliolo! Sei pallido come un lenzuolo. Siediti, mangia qualcosa di caldo!',
      options: [
        { text: 'Vedi il menu.',                        action: 'open_shop',   shopId: 'food_shop' },
        { text: 'Hai una missione per me?',             action: 'dialogue_line', line: 'Sì! Ho bisogno di erbe speciali dalla palude di Morgana per la mia ricetta segreta. Pagherò bene.' },
        { text: 'Arrivederci.',                         action: 'close' }
      ]
    }
  };

  GD.NPCS.thane_il_saggio = {
    id: 'thane_il_saggio',
    name: 'Thane il Saggio',
    x: 1620, y: 1450,
    icon: '📖',
    shop: null,
    quests: ['caccia_grossa_t6','signore_dei_picchi'],
    dialogue: {
      greeting: 'Ah, un cercatore di verità. Siediti. Ho storie che potrebbero cambiare il tuo destino.',
      options: [
        { text: 'Vedi le missioni disponibili.',        action: 'open_quests' },
        { text: 'Parlami di questo mondo.',             action: 'dialogue_line', line: 'Khoristan era una terra pacifica fino a mille anni fa, quando i Demoni del Tramonto attraversarono i Picchi. Sconfitti a caro prezzo, dormono ancora. Qualcuno li sta risvegliando.' },
        { text: 'Chi è Zharukael?',                    action: 'dialogue_line', line: 'Il più antico dei signori demoniaci. Non è mai stato distrutto, solo imprigionato nella roccia dei Picchi del Tramonto. Se si libera, nessuno di noi è al sicuro.' },
        { text: 'Arrivederci.',                         action: 'close' }
      ]
    }
  };


  // ===========================================================================
  // E) NUOVI NEGOZI
  // ===========================================================================

  GD.SHOPS.barber_shop = {
    id: 'barber_shop',
    name: 'Salone di Zara',
    items: (function () {
      var list = [];
      for (var i = 1; i <= 18; i++) {
        list.push({ id: 'hair_' + (i < 10 ? '0' + i : '' + i), qty: 1 });
      }
      return list;
    }())
  };

  GD.SHOPS.alchemy_shop = {
    id: 'alchemy_shop',
    name: 'Laboratorio di Morvan',
    items: [
      { id: 'gem_rubino_g1',          qty: 5  },
      { id: 'gem_zaffiro_g1',         qty: 5  },
      { id: 'gem_smeraldo_g1',        qty: 5  },
      { id: 'gem_ametista_g1',        qty: 5  },
      { id: 'gem_topazio_g1',         qty: 5  },
      { id: 'pergamena_incantamento', qty: 10 },
      { id: 'antidote',               qty: 99 }
    ]
  };

  GD.SHOPS.stable_shop = {
    id: 'stable_shop',
    name: 'Scuderia di Rocco',
    items: (function () {
      var list = [];
      for (var i = 1; i <= 10; i++) {
        list.push({ id: 'mount_' + (i < 10 ? '0' + i : '' + i), qty: 1 });
      }
      return list;
    }())
  };

  GD.SHOPS.enchant_shop = {
    id: 'enchant_shop',
    name: 'Emporio Arcano',
    items: [
      { id: 'pietra_raffinazione',    qty: 20 },
      { id: 'pergamena_benedizione',  qty: 10 },
      { id: 'pergamena_incantamento', qty: 10 },
      { id: 'elixir_speed',           qty: 20 }
    ]
  };

  GD.SHOPS.food_shop = {
    id: 'food_shop',
    name: 'Cucina di Nonna Mei',
    items: [
      { id: 'cibo_01', qty: 99 },
      { id: 'cibo_02', qty: 99 },
      { id: 'cibo_03', qty: 50 },
      { id: 'cibo_04', qty: 50 },
      { id: 'cibo_05', qty: 20 },
      { id: 'cibo_06', qty: 20 }
    ]
  };


  // ===========================================================================
  // F) NUOVE MISSIONI
  // ===========================================================================

  // Helper: primo mob id di una zona
  function zMob(zoneId, idx) {
    return 'mob_' + zoneId + '_' + idx;
  }

  // purge_foresta — uccidi 12 mob della Foresta Cinerea (tipi 1 e 2)
  GD.QUESTS.purge_foresta = {
    id: 'purge_foresta',
    name: 'Purga della Foresta Cinerea',
    description: 'Le bestie della Foresta Cinerea minacciano i viandanti. Elimina 12 tra Ragnoselva e Lupocinere.',
    npc: 'capitano_dorn',
    level: 7,
    repeatable: false,
    objectives: [
      { type: 'kill', target: zMob('foresta_cinerea', 1), count: 6,  current: 0, text: 'Uccidi Ragnoselva (0/6)'   },
      { type: 'kill', target: zMob('foresta_cinerea', 2), count: 6,  current: 0, text: 'Uccidi Lupocinere (0/6)'   }
    ],
    rewards: {
      xp: 840,
      gold: 280,
      items: [
        { id: 'hp_potion_medium', qty: 4 }
      ]
    }
  };

  // predoni_taglia — uccidi 10 mob colline + 1 champion
  GD.QUESTS.predoni_taglia = {
    id: 'predoni_taglia',
    name: 'Taglia sui Predoni',
    description: 'Il Capitano offre una taglia per i predoni delle colline. Elimina 10 scorridori e il loro campione.',
    npc: 'capitano_dorn',
    level: 13,
    repeatable: false,
    objectives: [
      { type: 'kill', target: zMob('colline_dei_predoni', 1), count: 10, current: 0, text: 'Uccidi Scorridori (0/10)' },
      { type: 'kill', target: zMob('colline_dei_predoni', 8), count: 1,  current: 0, text: 'Uccidi il Campione dei Predoni' }
    ],
    rewards: {
      xp: 1560,
      gold: 520,
      items: [
        { id: 'hp_potion_medium', qty: 5 },
        { id: 'mat_z3_a',         qty: 3 }
      ]
    }
  };

  // steppa_offensiva — uccidi 14 mob della steppa
  GD.QUESTS.steppa_offensiva = {
    id: 'steppa_offensiva',
    name: 'Offensiva nella Steppa Rovente',
    description: 'Gli orchi della steppa si radunano. Distruggi 14 tra sciacalli e guerrieri prima che attacchino il villaggio.',
    npc: 'capitano_dorn',
    level: 19,
    repeatable: false,
    objectives: [
      { type: 'kill', target: zMob('steppa_rovente', 1), count: 7, current: 0, text: 'Uccidi Sciacalli Aridi (0/7)'  },
      { type: 'kill', target: zMob('steppa_rovente', 2), count: 7, current: 0, text: 'Uccidi Orchi Selvatici (0/7)'  }
    ],
    rewards: {
      xp: 2280,
      gold: 760,
      items: [
        { id: 'hp_potion_large',  qty: 3 },
        { id: 'mp_potion_medium', qty: 2 }
      ]
    }
  };

  // sussurri_silenzio — uccidi 12 non-morti + raccogli 4 mat_z5_a
  GD.QUESTS.sussurri_silenzio = {
    id: 'sussurri_silenzio',
    name: 'Il Silenzio dei Sussurri',
    description: 'Gli spiriti della Valle dei Sussurri sono troppo numerosi. Metti a tacere 12 non-morti e raccogli le lacrime ectoplasmatiche.',
    npc: 'capitano_dorn',
    level: 26,
    repeatable: false,
    objectives: [
      { type: 'kill',    target: zMob('valle_dei_sussurri', 1), count: 12, current: 0, text: 'Uccidi Ombrealenti (0/12)'       },
      { type: 'collect', item:   'mat_z5_a',                    count: 4,  current: 0, text: 'Raccogli Lacrime Ectoplasmatiche (0/4)' }
    ],
    rewards: {
      xp: 3120,
      gold: 1040,
      items: [
        { id: 'hp_potion_large',  qty: 4 },
        { id: 'elixir_speed',     qty: 2 }
      ]
    }
  };

  // reagenti_rari — raccolta ripetibile per l'alchimista
  GD.QUESTS.reagenti_rari = {
    id: 'reagenti_rari',
    name: 'Reagenti Rari per Morvan',
    description: 'L\'alchimista Morvan ha bisogno di materiali della Foresta Cinerea per i suoi esperimenti.',
    npc: 'alchimista_morvan',
    level: 10,
    repeatable: true,
    objectives: [
      { type: 'collect', item: 'mat_z2_a', count: 5, current: 0, text: 'Raccogli Spore Cineree (0/5)'   },
      { type: 'collect', item: 'mat_z2_b', count: 5, current: 0, text: 'Raccogli Resina Grigia (0/5)'    }
    ],
    rewards: {
      xp: 1200,
      gold: 400,
      items: [
        { id: 'gem_rubino_g1',    qty: 1 },
        { id: 'hp_potion_medium', qty: 3 }
      ]
    }
  };

  // sapori_di_palude — raccolta ripetibile per nonna mei
  GD.QUESTS.sapori_di_palude = {
    id: 'sapori_di_palude',
    name: 'Sapori della Palude',
    description: 'Nonna Mei vuole erbe e funghi rari dalla Palude Morgana per la sua zuppa segreta.',
    npc: 'nonna_mei',
    level: 30,
    repeatable: true,
    objectives: [
      { type: 'collect', item: 'mat_z6_a', count: 8, current: 0, text: 'Raccogli Erbe di Morgana (0/8)' }
    ],
    rewards: {
      xp: 3600,
      gold: 1200,
      items: [
        { id: 'cibo_04', qty: 3 },
        { id: 'cibo_05', qty: 2 }
      ]
    }
  };

  // caccia_grossa_t6 — uccidi world boss palude
  GD.QUESTS.caccia_grossa_t6 = {
    id: 'caccia_grossa_t6',
    name: 'La Caccia Grossa di Thane',
    description: 'Thane il Saggio chiede la testa di Valdra la Pestilenza, la signora delle paludi che corrompe le acque di Pietrascura.',
    npc: 'thane_il_saggio',
    level: 34,
    repeatable: false,
    objectives: [
      { type: 'kill', target: 'boss_palude_morgana', count: 1, current: 0, text: 'Sconfiggi Valdra la Pestilenza' }
    ],
    rewards: {
      xp: 4080,
      gold: 1360,
      items: [
        { id: 'hp_potion_large',  qty: 5 },
        { id: 'gem_smeraldo_g1',  qty: 2 },
        { id: 'pergamena_benedizione', qty: 1 }
      ]
    }
  };

  // signore_dei_picchi — uccidi world boss tier 8 (grande ricompensa)
  GD.QUESTS.signore_dei_picchi = {
    id: 'signore_dei_picchi',
    name: 'Il Signore dei Picchi del Tramonto',
    description: 'Zharukael Signore Oscuro è stato risvegliato nei Picchi del Tramonto. Thane il Saggio ti chiede di affrontarlo e di porre fine alla minaccia demoniaca una volta per tutte.',
    npc: 'thane_il_saggio',
    level: 50,
    repeatable: false,
    objectives: [
      { type: 'kill', target: 'boss_picchi_del_tramonto', count: 1, current: 0, text: 'Sconfiggi Zharukael Signore Oscuro' }
    ],
    rewards: {
      xp: 6000,
      gold: 2000,
      items: (function () {
        var r = [{ id: 'demon_stone_shard', qty: 5 }];
        var pool8 = GD.DROP_POOLS && GD.DROP_POOLS[8];
        if (pool8 && pool8.length > 0) {
          r.push({ id: pool8[0], qty: 1 });
        } else {
          r.push({ id: 'demon_stone_shard', qty: 3 });
        }
        return r;
      }())
    }
  };

}(window.GameData));
