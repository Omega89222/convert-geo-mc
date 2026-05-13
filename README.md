# Convertisseur Geo Minecraft

Application web Vite + Three.js pour convertir des modèles Minecraft Java vers un fichier `.geo.json` Bedrock et prévisualiser le rendu 3D avec une texture.

## Démarrer

```bash
npm install
npm run dev
```

Ouvrir ensuite `http://127.0.0.1:5173/`.

## Formats pris en charge

- JSON Java block/item avec `elements`
- `.bbmodel` Blockbench à base de cubes
- `.geo.json` Bedrock/GeckoLib, normalisé en `format_version: "1.12.0"`

Les modèles avec mesh non cubique, héritage Java `parent` non résolu ou rotations UV peuvent nécessiter un export Blockbench aplati avant conversion.

## Vérifier

```bash
npm run build
npm run verify
```

La vérification Playwright contrôle que le canvas 3D n’est pas vide sur desktop et mobile.
