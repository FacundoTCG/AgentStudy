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
- **4 Classi** — Guerriero, Ninja, Mago Oscuro, Sciamano — ognuna con **8 abilità** potenziabili (Lv 1-10 con punti abilità)
- **32 Abilità** — AoE, multi-hit, scatti, buff, scudi, cure, fulmini a catena, veleno, esecuzione, meteorite...
- **Combattimento real-time** — attacchi normali, critici, status (veleno, stun, rallentamento)
- **81 Mostri** — 64 mob in 8 zone a tier crescente + 6 boss di zona + boss dei dungeon; AI per ruolo (minion, soldier, ranged_kite, elite/pack, champion/boss)
- **2 Dungeon** — Tana dei Banditi (lv6+) e Fortezza degli Orchi (lv11+)
- **Pietre Demoniache a 8 livelli** — da Pietra I (lv4) a Pietra VIII (lv54), evocano i mostri della loro zona

### Progressione
- **Livelli illimitati** — curva XP `100 × lvl^1.7`, +1 punto abilità a livello
- **298 Oggetti** — 76 armi, 93 armature, 30 gioielli, 25 gemme, 10 cavalcature, 18 capigliature, cibi, pergamene, materiali — 5 qualità
- **9 Slot equipaggiamento** — arma, corpo, testa, scudo, stivali, bracciale, collana, orecchini, anello
- **Potenziamento +0/+9** — alla Forgia: costi in oro, Pietre di Raffinazione da +4, Pergamena della Benedizione contro i fallimenti
- **Bonus casuali** — ogni oggetto equipaggiabile droppa con 0-3 bonus (21 tipi); rerollabili con la Pergamena dell'Incantamento
- **Alchimia** — 5 gemme × 5 gradi: combina 3 uguali per il grado successivo, incastonale negli alloggiamenti (0-3 per qualità)
- **Cavalcature** — 10 mount (+25% → +95% velocità), tasto R per evocarle
- **Capigliature** — 18 acconciature dal barbiere
- **Inventario 45 slot** — con istanze uniche per gli equipaggiabili (+enh, bonus, gemme)
- **12 Missioni** — kill, collect e obiettivi evento, ricompense in XP/oro/oggetti

### Online
- **13 NPC** — fabbro, mercante, guaritrice, oste, barbiera, alchimista, stalliere, incantatrice, maestro d'armi, capitano, cuoca, saggio, cercatrice — con dialoghi, accettazione/consegna missioni
- **8 Negozi** — armi, pozioni, gemme, cavalcature, acconciature, pergamene, cibo
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
