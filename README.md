# Circular Strings Orchestrator

Application locale de composition et d’orchestration pour le sextuor canonique d’Axel Fisch : Violon I, Violon II, Alto I, Alto II, Violoncelle et Contrebasse.

## Fonctions

- Projet unifié de 8, 16 ou 32 mesures, sauvegardé automatiquement dans le navigateur.
- Bibliothèque locale de projets, duplication et transfert par JSON versionné.
- Grille automatique Pop douce ou Chambre, avec édition manuelle et une ou deux harmonies par mesure.
- Dictionnaire canonique de 24 familles d’accords, basses slash et renversements.
- Cinq gammes Live Thinking documentées : majeure, mineure mélodique, mineure harmonique, diminuée et par tons.
- Modes mélodiques canonique AABA, rotation contrôlée, instrument manuel et préservation d’une mélodie importée.
- Registres centraux mesurés, tessitures techniques, rôle indépendant des six voix et rapport vérifiable.
- Import MIDI et MusicXML avec aperçu des pistes, détection d’accords, confiance et correction avant application.
- Corpus Axel Style Data local, versionné et explicable; il mesure les références sans prétendre entraîner un réseau neuronal.
- Lecture Play / Pause / Stop / Début / Loop depuis les mêmes événements que les exports.
- Exports MIDI format 1, MusicXML 4.0, ABC, grille texte, rapport imprimable HTML/PDF et projet JSON.

La source musicale exécutable et les décisions conservatrices sont décrites dans `MUSICAL-SOURCE-OF-TRUTH.md`.

## Development

```bash
npm install
npm run test:all
npm run build
```

`npm run test:all` contrôle le typage, le lint, les 24 familles, les cinq gammes, les six voix, les tessitures, les imports réels et les formats d’export.

Netlify construit avec `npm run build` et publie `dist`.
