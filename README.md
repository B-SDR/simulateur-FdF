# Simulateur de feux de forêt — 3D

Simulateur interactif de propagation de feux de forêt : terrain 3D procédural, feu animé
(particules de flammes et de fumée, lueur dynamique), et pilotage des conditions météo
et de l'état de la végétation en temps réel.

![three.js](https://img.shields.io/badge/three.js-r160-blue) ![node](https://img.shields.io/badge/tests-node--test-green)

## Lancement

Le projet n'a **aucune dépendance à installer** (Three.js est chargé via CDN, une connexion
internet est nécessaire au premier chargement).

```bash
python3 -m http.server 8000
# ou
npx serve .
```

Puis ouvrir <http://localhost:8000>.

**Lancer les tests du modèle de propagation :**

```bash
npm test
```

## Cartes réelles (MNT + orthophotos)

Le panneau **« Carte réelle »** permet de simuler sur un site réel, sans aucune clé API :

- **Relief** : MNT global [Mapzen Terrarium](https://registry.opendata.aws/terrain-tiles/) (tuiles PNG, décodage `R×256 + G + B/256 − 32768`), jusqu'au zoom 14 (~10 m/px).
- **Végétation** : orthophotos IGN (`data.geopf.fr`, WMTS public) — la couleur de chaque cellule (indice de verdissement + luminance) estime le combustible : forêt dense, garrigue, vignes, roche, zone urbaine ; la mer (altitude < 0) est incombustible et colorée en bleu.
- **Texture satellite** plaquée sur le terrain (activable/désactivable), exagération verticale réglable.

Présets : Massif de la Clape, Massif de Fontfroide, Corbières (Peyrepertuse), Cévennes (Mont Aigoual), Sainte-Victoire — ou zone personnalisée (latitude/longitude/taille). Le chargement télécharge ~30–70 tuiles (une à deux dizaines de secondes).

La physique (vent, pente issue du vrai relief en mètres/mètres, hygrométrie) s'applique à l'identique sur terrain réel ou procédural.

## Utilisation

- **Clic gauche** sur le terrain : allumer un feu au point visé.
- **Clic gauche glissé** : orbiter, **molette** : zoom, **clic droit glissé** : déplacer la vue.
- Panneau de contrôle `Simulateur de feux de forêt` (en haut à droite) :
  - **Hygrométrie (%)** : humidité de l'air et des combustibles — au-delà de ~85 % le feu ne prend plus.
  - **Vent (km/h)** et **Direction du vent (°)** : étirent le front (0° = soufflant vers l'est, +x).
  - **Densité végétation (%)** : recharge en combustible de la forêt (appliquée en direct).
  - **Effet de la pente (%)** : accélération de la montée du feu sur les reliefs.
  - **Vitesse (ticks/s)** et **Pause** : contrôle du temps.
  - Boutons : réinitialiser le feu, générer un nouveau terrain, allumer au centre.

Indicateurs temps réel : surface brûlée, foyers actifs, temps simulé (1 tick ≈ 2 min).

## Modèle de propagation

Automate cellulaire stochastique sur une grille 128×128 superposée à un relief bruité (fBm).
Chaque cellule porte : altitude, combustible, humidité et un état
(`intact → en feu → brûlé`).

À chaque tick, une cellule voisine d'un foyer s'enflamme avec la probabilité :

```
P = P₀ × f(combustible) × sécheresse × effet_vent × effet_pente
```

- **Sécheresse** = `1.15 − 1.15 × humidité locale` (l'humidité locale décroît avec l'altitude).
- **Effet du vent** = `1 + (direction_feu → cellule ⋅ vecteur_vent) × 2.3 × v`, où
  `v = vitesse/80` : front étiré dans le sens du vent, freiné à contre-vent,
  borné à 5 % vers l'amont du vent.
- **Effet de la pente** = `1 + gain × Δh × échelle`, proportionnel à la dénivelée entre
  cellules : les flammes grimpent plus vite qu'elles ne descendent.
- Une cellule en feu consomme son combustible pendant `≈ 6 + 14 × combustible` ticks avant
  de passer à l'état « brûlé » (le sol brûlé est incombustible — coupe-feu naturel).

Le modèle est isolé dans [`src/simulation.js`](src/simulation.js), sans dépendance au rendu ;
les tests (`test/simulation.test.js`) vérifient la propagation nominale, l'anisotropie due
au vent, l'extinction à forte hygrométrie et la réinitialisation.

## Structure

```
├── index.html              page unique + styles + import map Three.js (CDN)
├── src/
│   ├── main.js             rendu 3D, particules, interface, interactions
│   ├── simulation.js       modèle de propagation (pur, testable)
│   └── realMap.js          cartes réelles : MNT Terrarium + orthophotos IGN
└── test/
    ├── simulation.test.js  tests du modèle (node --test)
    └── realMap.test.js     tests de la chaîne cartographique
```
