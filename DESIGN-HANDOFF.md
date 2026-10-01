# DESIGN-HANDOFF — Circular Strings Orchestrator

Document fonctionnel pour l’harmonisation visuelle. Ne pas changer la logique musicale en même temps que la peau.

## Écran unique à conserver

Il n’y a plus deux onglets. Trois colonnes à partir de 1100 px, une colonne empilée en dessous.

1. En-tête — bibliothèque locale et nom du projet.
2. Barre de préparation — forme, style, genre, tonalité, mode, métrique, tempo, graine et génération.
3. Cercle — fondamentale, 24 familles, basse étrangère ou renversement, moitié active, placement et audition.
4. Arrangement — langage harmonique, cinq gammes, mode mélodique, registre, timeline, piano-roll et transport.
5. Colonne de travail — projets, import musical, rapport par voix et Axel Style Data.

## États à prévoir

- Mesure active (sélection) distincte de la mesure en lecture.
- Une mesure peut porter une seconde harmonie sur la deuxième moitié. Les deux symboles restent distincts.
- Un accord importé affiche sa confiance et reste éditable avant et après application.
- Voix verrouillée.
- Transport : arrêté, lecture, pause.
- Loop actif.
- Corpus vide, fichier valide, doublon, rejeté.
- Source importée en attente : résumé, pistes, mélodie proposée, accords détectés et avertissements.
- Projet nouveau, actif, dupliqué, importé ou supprimé.
- Variante B absente ou présente.
- Influence 0 et 100.

## Contraintes

- Conserver les libellés français et le crédit Axel Fisch.
- Ne pas remplacer les symboles d’accords par des couleurs seules.
- Le bouton Imprimer ouvre le rapport HTML conçu pour l’impression ou l’enregistrement PDF; ne pas inventer un second moteur PDF.
- Ne pas présenter l’analyse de corpus comme un entraînement neuronal.
- Tokens actuels : void `#050B16`, panel `#0F172A`, ivoire `#ECE5D8`, ambre `#E8A45A`.
- Voix : ambre, ivoire, brume, sauge, argile, graphite. Ce sont des identités de voix, pas une seconde marque.
- Typo : Cormorant Garamond + Barlow.
- Cibles tactiles au moins 44 px.
- La logique musicale vit dans `src/features/circular/*.ts`, pas dans `circular.css`.

## Fonctions à ne pas casser

Cercle, 24 familles, basses slash, première/deuxième harmonie, grille générée, six voix, choix et transfert de mélodie, Play / Pause / Stop / Début / Loop, tempo, métriques 4/4 3/4 6/8, cinq gammes, exports MIDI/MusicXML/ABC/grille/rapport/projet JSON, import MIDI ou MusicXML avec validation, corpus local, influence, inclusion/exclusion/renommage/suppression des références, projets locaux, verrous, variante A/B, annuler/rétablir et persistance locale.

## Frontière du prochain passage Claude Design

- Le moteur, les modèles de données et les formats sont terminés et testés; Claude peut travailler sur la hiérarchie, l’espacement, la lisibilité et les états visuels.
- Les textes peuvent être raccourcis sans changer leur sens musical.
- Les composants peuvent être déplacés ou scindés, mais les actions et leurs libellés doivent rester accessibles.
- Toute modification de `arrange.ts`, `theory.ts`, `midi.ts`, `importer.ts`, `exporters.ts`, `corpus.ts`, `projects.ts` ou `types.ts` doit rester hors du mandat purement visuel.
- Après chaque passage visuel, exécuter `npm run test:all` et vérifier le bureau ainsi qu’une largeur de 390 px.
