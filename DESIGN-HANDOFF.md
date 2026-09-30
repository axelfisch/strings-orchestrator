# DESIGN-HANDOFF — Circular Strings Orchestrator

Document fonctionnel pour l’harmonisation visuelle. Ne pas changer la logique musicale en même temps que la peau.

## Écran unique

Il n’y a plus deux onglets. Trois colonnes à partir de 1100 px, une colonne empilée en dessous.

1. Cercle — fondamentale, famille, qualité, basse étrangère ou renversement, placer, écouter l’accord.
2. Timeline — 8 / 16 / 32, carte harmonique, piano-roll, transport.
3. Rapport + Axel Style Data.

## États à prévoir

- Mesure active (sélection) distincte de la mesure en lecture.
- Une mesure peut porter une seconde harmonie sur la deuxième moitié. Les deux symboles restent distincts.
- Voix verrouillée.
- Transport : arrêté, lecture, pause.
- Loop actif.
- Corpus vide, fichier valide, doublon, rejeté.
- Variante B absente ou présente.
- Influence 0 et 100.

## Contraintes

- Conserver les libellés français et le crédit Axel Fisch.
- Ne pas remplacer les symboles d’accords par des couleurs seules.
- Ne pas ajouter de bouton PDF.
- Ne pas présenter l’analyse de corpus comme un entraînement neuronal.
- Tokens actuels : void `#050B16`, panel `#0F172A`, ivoire `#ECE5D8`, ambre `#E8A45A`.
- Voix : ambre, ivoire, brume, sauge, argile, graphite. Ce sont des identités de voix, pas une seconde marque.
- Typo : Cormorant Garamond + Barlow.
- Cibles tactiles au moins 44 px.
- La logique musicale vit dans `src/features/circular/*.ts`, pas dans `circular.css`.

## Fonctions à ne pas casser

Cercle, placement d’accord, grille générée, six voix, Play / Pause / Stop / Début / Loop, tempo, métriques 4/4 3/4 6/8, exports MIDI MusicXML et grille texte, import MIDI ou MusicXML, corpus local, influence, verrous, annuler / rétablir, persistance locale.
