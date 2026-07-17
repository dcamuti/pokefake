# Tileset

`tileset.png`, `tree.png` e `buildings/` sono generati dai fogli FRLG presenti
in questa cartella e vengono caricati automaticamente dal gioco:

- `tileset.png` — striscia di 27 tile 16×16 (terreno, arredi interni, animazioni
  di acqua e fiori su due frame alternati);
- `tree.png` — albero 32×32 disegnato "a quadranti": le masse di alberi si
  compongono automaticamente in foresta continua;
- `buildings/{center,market,gym,house,lab,league}.png` — edifici interi con
  porta e collisioni gestite dal motore (ordinamento di profondità incluso:
  il personaggio passa davanti/dietro correttamente).

Se rimuovi questi file il gioco torna alla grafica procedurale integrata.
Ordine degli slot di tileset.png documentato nel motore (TILE_ORDER in game.js).

⚠️ I fogli sorgente sono asset estratti da FireRed/LeafGreen: uso strettamente
personale, non pubblicare il progetto con questi file inclusi.
