# Phase 3 — Intégration et validation globale

Date : 2026-10-01  
Branche : `codex/hybrid-v2-audit`  
Point de départ Phase 2 : `ed4024102433aaa61c3d7bdb8b493dfe2f5e4e24`

## Résultat

Le moteur symbolique hybride V2 est intégré derrière son drapeau de fonctionnalité. Sans index valide, ou lorsqu'aucun candidat V2 ne respecte les contraintes, l'application conserve exactement le moteur V1. Avec un index local valide, elle expose des candidats V1/V2, une explication technique et une préférence locale, sans téléversement.

Le jeu de validation synthétique sert uniquement à vérifier le pipeline. Il ne représente pas le style d'Axel Fisch et ne remplace pas un corpus autorisé, correctement cartographié et séparé entre entraînement, validation et test.

## Corrections et intégration

- Recalcul intégral du rapport musical après compilation d'un candidat V2 : statistiques par voix, registres, croisements, parallèles, répétitions, densité, respiration, porteur mélodique et qualité technique.
- Passage manuel de la mélodie validé pour les six voix canoniques.
- Rebasage des hauteurs relatives lors du transfert de mélodie afin d'éviter de déplacer les voix intérieures de plusieurs octaves.
- Filtrage des candidats présentant plus de 24 croisements ; quelques croisements ponctuels restent signalés comme avertissements pour ne pas interdire un transfert mélodique volontaire.
- Validation des hauteurs produites contre les notes d'accord, la gamme choisie, la gamme adaptée à l'accord et la basse slash.
- Persistance du candidat choisi dans le projet.
- Import et stockage local d'un index V2 validé.
- Sélection A/B/C, explication du score et enregistrement local d'une préférence.
- Aucun changement de feuille de style ou de direction visuelle.

## Contrat musical vérifié

- Six voix : Violon I, Violon II, Alto I, Alto II, Violoncelle, Contrebasse.
- Mélodie non imposée au Violon I et testée sur chacune des six voix.
- Mélodie de violoncelle testée avec des voix supérieures réellement au-dessus : elle n'est pas forcée comme note supérieure.
- Une ou deux harmonies par mesure.
- Basses slash conservées.
- Cinq gammes officielles seulement.
- Les 24 familles harmoniques existantes restent inchangées.
- Les notes générées restent dans les tessitures absolues.

## Tests automatisés

`npm run test:all` passe entièrement :

- TypeScript : réussi.
- ESLint : réussi.
- moteur V1 : réussi.
- moteur Style V2 : réussi.
- imports MIDI/MusicXML : réussi.
- exports : réussi.
- contrôles musicaux : réussi.
- build Vite de production : réussi.

`git diff --check` passe également.

## Validation réelle dans Chromium

- Import de l'index synthétique `idx-7de9d132` (3 motifs) : réussi.
- Activation V2 automatique après import : réussie.
- Affichage et sélection de candidats V1/V2 : réussi.
- Explications techniques et provenance locale : réussies.
- Enregistrement d'une préférence locale et compteur à 1 : réussi.
- Persistance du projet, du candidat choisi, de l'index IndexedDB et des préférences après rechargement : réussie.
- Lecture, pause et arrêt : états du moteur et du transport vérifiés.
- Import réel du MIDI V2 produit : 7 pistes, 8 mesures, 72 BPM, résumé et avertissement harmonique affichés avant application.
- Repli V1 vérifié sur ce projet importé lorsqu'aucun candidat V2 ne satisfait toutes les contraintes ; l'index reste présent et actif.
- Exports réels téléchargés depuis l'interface : MIDI et MusicXML.
- Vue mobile 390 × 844 au bas de la page : le pied de page se termine à 700 px et le transport commence à 723 px ; la fin du contenu reste accessible et n'est pas masquée.
- Console : aucune erreur applicative ; seulement les messages d'information de React DevTools et Tone.js en développement.

La lecture sonore n'a pas été évaluée à l'oreille. Seuls le déclenchement, l'état du transport et les fichiers symboliques ont été vérifiés.

## Inspection des exports V2

Le paquet local ignoré par Git se trouve dans `output/phase3-ab/` :

- `candidate-A.mid` et `candidate-A.musicxml` : référence V1.
- `candidate-B.mid` et `candidate-B.musicxml` : Style V2.
- `README.md` : protocole d'écoute humaine.
- `answer-key.json` : clé A/B.
- `verification.json` : résultats de relecture automatique.

Les deux MIDI sont de format 1 avec 7 pistes au total, dont 6 pistes musicales nommées. Les deux MusicXML contiennent 6 parties musicales. `xmllint --noout` accepte les deux partitions. Les fichiers ont aussi été relus par `parseMidi` et `musicXmlToParsed` de l'application.

Le candidat A contient 77 événements MIDI et le candidat B 96. Dans les deux cas, la mélodie est confiée au violoncelle et le contrôle technique du jeu de 8 mesures est de 100/100. Ce nombre est un indicateur de contraintes, pas une note esthétique.

Un second export depuis l'interface, sur 32 mesures, a été relu avec succès : 7 pistes MIDI, 6 pistes sonores, 448 notes ; 6 parties MusicXML, toutes sonores. Le nombre de notes MusicXML est supérieur parce que l'exporteur découpe certaines durées et liaisons en plusieurs événements notés.

## Fichiers créés

- `PHASE-3-VALIDATION.md`
- `scripts/style-v2/build-ab-validation.ts`
- `scripts/style-v2/create-validation-index.ts`
- `src/features/circular/style-v2/report.ts`

## Fichiers modifiés

- `scripts/test-style-v2.ts`
- `src/features/circular/Studio.tsx`
- `src/features/circular/projects.ts`
- `src/features/circular/style-v2/candidate-generator.ts`
- `src/features/circular/style-v2/constraints.ts`
- `src/features/circular/style-v2/engine.ts`
- `src/features/circular/style-v2/index.ts`
- `src/features/circular/style-v2/pattern-compiler.ts`
- `src/features/circular/style-v2/transformations.ts`
- `src/features/circular/types.ts`

## Limites et prochaine décision humaine

- Le classement V2 est techniquement cohérent, mais la qualité musicale et la ressemblance au style d'Axel doivent être évaluées à l'oreille avec le paquet A/B.
- Aucun fichier réel du corpus n'a été téléversé ou incorporé pendant cette phase.
- Les métadonnées de droits, `workId`, découpage train/validation/test et cartographie des voix doivent être confirmées avant de construire un index réel.
- Aucun push, aucune PR, aucune fusion et aucun déploiement n'ont été effectués.
