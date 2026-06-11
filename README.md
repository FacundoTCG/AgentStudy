# Regni d'Oriente — MMORPG Test

Un MMORPG d'azione 2D giocabile direttamente nel browser, ispirato al gameplay
degli MMORPG orientali classici. Tutto il codice e gli asset sono originali
(grafica procedurale in canvas, nessuna risorsa esterna).

## Come giocare

Apri `index.html` nel browser — non serve alcun server né dipendenza.
Funziona anche su GitHub Pages.

## Caratteristiche

- **4 classi**: Guerriero, Ninja, Mago Oscuro, Sciamano — ognuna con statistiche
  e 3 abilità uniche (AoE, scatti, buff, cure, fulmine a catena, veleno...)
- **Mondo aperto** 3200×3200 con villaggio (zona sicura con rigenerazione
  accelerata), foreste e zone a difficoltà crescente man mano che ci si allontana
- **Pietre Demoniache**: monoliti che evocano mostri finché non vengono
  distrutti — ricompense in XP e oro elevate
- **6 tipi di mostri** con AI (pattugliamento, aggro, inseguimento, attacco)
- **Progressione**: livelli, XP, oro, pozioni, drop dei nemici
- **HUD completo**: barre HP/MP/XP, frame del bersaglio, barra abilità con
  cooldown, minimappa, log di combattimento

## Comandi

| Tasto | Azione |
|---|---|
| `WASD` / frecce | Movimento |
| `Spazio` / click | Attacco base |
| `1` `2` `3` | Abilità di classe |
| `4` | Pozione di cura |
| `Tab` | Seleziona il nemico più vicino |
| Click su nemico | Seleziona bersaglio |

## Struttura del progetto

```
index.html      — markup e UI (HUD, selezione classe, schermata morte)
css/style.css   — stile dell'interfaccia
js/game.js      — motore di gioco (loop, AI, combattimento, rendering)
```
