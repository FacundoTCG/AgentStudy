# ⚔ Regni d'Oriente — MMORPG Test

Un MMORPG d'azione completo giocabile direttamente nel browser, ispirato al gameplay degli MMORPG orientali classici. Tutto il codice e gli asset sono originali (grafica procedurale 3D con Three.js).

## Avvio rapido

```bash
# Per giocare offline: apri semplicemente
index.html   ← nel browser (nessun server necessario)

# Per il server multiplayer:
cd server
npm install
npm start
# poi vai su http://localhost:3000
```

## Architettura del progetto

```
regni-doriente/
├── index.html              ← Landing page con selezione classe
├── game.html               ← Client di gioco 3D
├── leaderboard.html        ← Classifiche globali
│
├── css/
│   ├── style.css           ← Stile sito + componenti condivisi
│   └── game.css            ← UI di gioco (HUD, pannelli, chat)
│
├── js/
│   ├── data.js             ← Database di gioco (1230 righe)
│   │                         classi, abilità, oggetti, mostri, mappe,
│   │                         dungeon, NPC, negozi, missioni
│   ├── engine.js           ← Motore 3D Three.js (1070 righe)
│   │                         terreno, decorazioni, mesh personaggi,
│   │                         effetti particellari, camera, minimap
│   ├── systems.js          ← Sistemi di gioco (~900 righe)
│   │                         CombatSystem, MonsterAI, InventorySystem,
│   │                         QuestSystem, DungeonSystem, SaveSystem
│   ├── ui.js               ← Interfaccia (~1000 righe)
│   │                         HUD, inventario, missioni, personaggio,
│   │                         mappa, dialoghi NPC, negozio, chat
│   └── main.js             ← Loop di gioco + input + eventi (~700 righe)
│
├── server/
│   ├── package.json        ← Node.js dependencies
│   └── server.js           ← Server Express + Socket.io (~400 righe)
│                             auth, personaggi, salvataggio, chat,
│                             sessioni, classifiche API
│
└── db/
    └── schema.sql          ← Schema SQLite completo
                              accounts, characters, inventory, quests,
                              dungeon_completions, chat_messages, views
```

## Sistemi implementati

### Gioco
- **Motore 3D** — Three.js, vista in terza persona, camera rotante, fog, ombre
- **4 Classi** — Guerriero, Ninja, Mago Oscuro, Sciamano — ognuna con 4 abilità uniche
- **16 Abilità** — AoE, multi-hit, scatti, buff, scudi, cure, fulmini a catena, veleno, esecuzione, meteorite...
- **Combattimento real-time** — attacchi normali, critici, status (veleno, stun, rallentamento)
- **12+ Mostri** — AI per tipo (basic, pack, ranged\_kite, aggressive, tank, boss)
- **2 Dungeon** — Tana dei Banditi (lv6+) e Fortezza degli Orchi (lv11+), boss con fasi multiple
- **Pietre Demoniache** — evocano mostri finché non vengono distrutte

### Progressione
- **20 Livelli** — curva XP `100 × lvl^1.7`
- **40+ Oggetti** — 5 qualità (Comune/Non-comune/Raro/Epico/Leggendario)
- **Inventario 30 slot** — equipaggiamento (arma, petto, anello, collana)
- **4 Missioni** — obiettivi kill e collect, ricompense in XP/oro/oggetti

### Online
- **5 NPC** — con dialoghi, negozi, servizi (guarigione, osteria, quest)
- **3 Negozi** — fabbro, mercante, guaritrice
- **Chat** — locale/globale/gruppo
- **Salvataggio automatico** — ogni 60s in localStorage (offline) o server (online)

## Controlli

| Tasto | Azione |
|---|---|
| `WASD` / Frecce | Movimento |
| `Click sinistro` | Muovi / Attacca / Seleziona NPC |
| `Click destro + trascina` | Ruota camera |
| `Scroll` | Zoom camera |
| `1 2 3` | Abilità di classe |
| `Spazio` | Pozione di cura |
| `Tab` | Seleziona nemico più vicino |
| `I` | Inventario |
| `J` | Registro missioni |
| `C` | Scheda personaggio |
| `M` | Mappa del mondo |
| `Invio` | Apri chat |
| `Esc` | Menu di pausa |

## Server (opzionale per multiplayer)

Il server Node.js aggiunge:
- Registrazione e login con password hashate (bcryptjs)
- Salvataggio personaggi su database SQLite
- Sessioni WebSocket (Socket.io) per posizioni in tempo reale
- Chat globale sincronizzata
- API REST per le classifiche
- Stato mondo condiviso (mob aggro broadcastato)

```bash
cd server && npm install && npm start
# Server in ascolto su http://localhost:3000
```

## Tecnologie

| Layer | Tecnologia |
|---|---|
| 3D Rendering | Three.js r128 (CDN) |
| Server | Node.js + Express 4 |
| Realtime | Socket.io 4 |
| Database | SQLite (better-sqlite3) |
| Auth | bcryptjs + UUID |
| Persistenza offline | localStorage |
| Asset | 100% procedurale — nessun file binario |
