# ⚔ Regni d'Oriente — MMORPG Desktop

Un MMORPG d'azione completo con client desktop Electron. Grafica 3D procedurale con Three.js, stile visivo Metin2.

---

## Avvio rapido (Desktop — Electron)

### Windows
```
start.bat          ← doppio clic per avviare
```

### Mac / Linux
```bash
chmod +x start.sh
./start.sh
```

### Manuale
```bash
npm install        # installa Electron + dipendenze (una volta sola)
npm start          # apre il launcher desktop
```

---

## Build distribuzione (.exe / .dmg / .AppImage)

```bash
npm install

# Windows installer (.exe)
npm run build:win

# Mac (.dmg)
npm run build:mac

# Linux (.AppImage)
npm run build:linux

# Tutte le piattaforme
npm run build
```

I file di output si trovano nella cartella `dist/`.

> **Note per la build**: la prima volta `npm run build` scarica Electron (~150 MB). Sono necessari i file icona in `assets/icon.ico` (Windows), `assets/icon.icns` (Mac), `assets/icon.png` (Linux). Se non presenti, la build prosegue senza icona.

---

## Server multiplayer (opzionale)

```bash
cd server
npm install
npm start
# → http://localhost:3000
```

---

## Architettura

```
regni-doriente/
├── electron-main.js      ← Processo principale Electron (launcher → gioco)
├── electron-preload.js   ← Bridge IPC sicuro
├── package.json          ← Configurazione Electron + electron-builder
├── start.bat / start.sh  ← Script di avvio rapido
│
├── launcher.html         ← Launcher (selezione classe, notizie, play)
├── index.html            ← Landing page browser
├── game.html             ← Client 3D di gioco
├── leaderboard.html      ← Classifiche
│
├── css/
│   ├── launcher.css      ← UI launcher (stile Metin2)
│   ├── game.css          ← HUD in-game Metin2 (barre HP/MP/XP, skill bar)
│   ├── game2.css         ← Pannelli estesi (forgia, alchimia, stalla, barbiere)
│   └── style.css         ← Stile landing + caricamento
│
├── js/
│   ├── data.js           ← Database di gioco (1230 righe)
│   ├── content.js        ← Catalogo oggetti procedurali (298 oggetti)
│   ├── content-world.js  ← Mondo, zone, NPC, missioni (768 righe)
│   ├── engine.js         ← Motore 3D Three.js (1130 righe)
│   ├── engine2.js        ← Cavalcature, capigliature, effetti (551 righe)
│   ├── systems.js        ← Sistemi di gioco (combat, AI, inventario, missioni)
│   ├── systems2.js       ← Forgia, alchimia, stalla, barbiere, abilità
│   ├── ui.js             ← HUD, inventario, dialoghi, negozio (~1025 righe)
│   ├── ui2.js            ← Pannelli Forgia/Alchimia/Stalla/Barbiere (~785 righe)
│   └── main.js           ← Loop di gioco + input + bootstrap (~720 righe)
│
├── server/
│   ├── package.json
│   └── server.js         ← Server Express + Socket.io (~395 righe)
│
└── db/
    └── schema.sql        ← Schema SQLite completo
```

---

## Contenuto di gioco

| Sistema | Dettagli |
|---|---|
| **Classi** | 4 (Guerriero, Ninja, Mago Oscuro, Sciamano) |
| **Abilità** | 32 (8 per classe, livelli 1-10 con punti abilità) |
| **Oggetti** | 298 (76 armi, 93 armature, 30 gioielli, 25 gemme, 10 cavalcature, 18 capigliature…) |
| **Mostri** | 81 (64 mob in 8 zone + 6 boss di zona + boss dungeon) |
| **Zone** | 8 zone a tier crescente (Prati di Levante → Picchi del Tramonto) |
| **Dungeon** | 2 (Tana dei Banditi lv6+, Fortezza degli Orchi lv11+) |
| **NPC** | 13 con dialoghi, missioni, negozi |
| **Potenziamento** | +0/+9 con probabilità decrescenti e Pietre di Raffinazione |
| **Alchimia** | 5 gemme × 5 gradi, incastonabili in 0-3 alloggiamenti |
| **Cavalcature** | 10 mount (+25% → +95% velocità), tasto R |
| **Capigliature** | 18 acconciature dal barbiere |
| **Inventario** | 45 slot, 9 slot equipaggiamento |
| **Salvataggio** | Automatico ogni 60s (localStorage offline / server online) |

---

## Controlli

| Tasto | Azione |
|---|---|
| `WASD` / Frecce | Movimento |
| `Click sinistro` | Muovi / Attacca / NPC |
| `Click destro + trascina` | Ruota camera |
| `Scroll` | Zoom |
| `1–8` | Abilità di classe |
| `Q` | Pozione di cura |
| `R` | Cavalcatura (evoca/rimanda) |
| `I` | Inventario |
| `J` | Missioni |
| `C` | Personaggio |
| `M` | Mappa |
| `F11` | Schermo intero |
| `Esc` | Menu pausa |

---

## Tecnologie

| Layer | Tecnologia |
|---|---|
| Desktop | Electron 28 |
| Build | electron-builder 24 |
| 3D Rendering | Three.js r128 |
| Server | Node.js + Express 4 |
| Realtime | Socket.io 4 |
| Database | SQLite (better-sqlite3) |
| Auth | bcryptjs + UUID |
| Persistenza offline | localStorage |
| Asset | 100% procedurale — nessun file binario |
