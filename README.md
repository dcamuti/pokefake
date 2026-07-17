# VALMORA — Leggende della Regione Smeralda

Gioco di ruolo 2D in stile Game Boy Advance, giocabile nel browser: cattura, allena
e fai evolvere 54 creature (fakemon), sfida 8 palestre e conquista la Lega di Valmora.

## Come si gioca

| Tasto | Azione |
|---|---|
| Frecce / WASD | Movimento |
| Z / Spazio | Conferma, interagisci |
| X / Esc | Annulla |
| Invio | Menu (Dex, Squadra, Zaino, Salva) |
| M | Audio on/off |

Il salvataggio avviene dal menu (voce SALVA) ed è conservato nel browser.
Con i pulsanti sotto lo schermo puoi esportarlo/importarlo come file JSON.

## Pubblicazione su GitHub Pages

1. Crea un nuovo repository su GitHub (es. `valmora`).
2. Carica **tutto il contenuto di questa cartella** nella radice del repository
   (`index.html` deve stare nella radice).
3. Su GitHub: **Settings → Pages → Source: Deploy from a branch**,
   scegli il branch `main` e la cartella `/ (root)`, poi salva.
4. Dopo qualche minuto il gioco sarà online su `https://<tuo-utente>.github.io/valmora/`.

Per provarlo in locale basta aprire `index.html` nel browser, oppure servirlo con
`python -m http.server` per un ambiente identico a quello online.

## Struttura del progetto

```
valmora/
├── index.html               # pagina di gioco
├── css/style.css            # stile della pagina
├── js/game.js               # motore completo del gioco
├── assets/
│   ├── sprites/
│   │   ├── front/1..54.png  # sprite frontali delle 54 specie
│   │   ├── back/1..54.png   # sprite posteriori (battaglia)
│   │   └── icons/1..54.png  # icone per menu squadra/box
│   ├── audio/
│   │   ├── music/           # title/overworld/battle.mp3 (opzionali, vedi README)
│   │   └── sfx/             # effetti opzionali che sostituiscono i beep
│   ├── tiles/               # tileset.png opzionale per la mappa (vedi README)
│   └── ui/                  # predisposta: sprite menu e summary
├── .nojekyll                # disattiva Jekyll su GitHub Pages
└── README.md
```

## Crediti

- Sprite delle creature: "Fakemon Pack" (asset liberi, senza vincoli di licenza).
- Grafica della mappa, motore di gioco e contenuti: originali, creati con Claude.
