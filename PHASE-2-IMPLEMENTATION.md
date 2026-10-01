# Phase 2 — Implémentation du moteur symbolique hybride V2

Date : 2026-10-01  
Branche locale : `codex/hybrid-v2-audit`  
Base : `b3cca74f2ef08e81554f79c144e2ed4c429b74d7`

## Résultat

Le noyau du moteur Axel Style V2 est implémenté derrière un drapeau de fonctionnalité désactivé par défaut. Le moteur V1 reste le repli exact quand le drapeau est désactivé, quand aucun index n’est associé au projet ou quand aucun candidat V2 valide n’est disponible.

Aucun fichier du corpus privé n’a été ajouté, téléversé ou indexé. Aucun modèle audio, GPU ou service payant n’a été utilisé. Aucun push, aucune PR, aucune fusion et aucun déploiement n’ont été effectués.

## Modules construits

Sous `src/features/circular/style-v2/` :

- `types.ts` : contrats versionnés pour manifeste, mapping, fragments, Pattern IR, index, candidats, scores et préférences.
- `schemas.ts` : validation du manifeste et des index.
- `profile.ts` : validation du contrat `axel-style-profile-v2.json` contre les six voix, 24 familles et cinq gammes du dépôt.
- `manifest.ts` : entrées conservatrices, hashes, droits, `workId`, splits, doublons exacts et détection des fuites entre splits.
- `voice-mapping.ts` : mapping explicable par noms, tessitures et monophonie, avec corrections manuelles prioritaires et avertissements de faible confiance.
- `features.ts` : extraction reproductible de caractéristiques de rythme, contour, registre, densité, silences, voix et rythme harmonique.
- `fragments.ts` : segmentation locale avec provenance et identité des voix préservée.
- `pattern-ir.ts` : représentation relative des hauteurs, positions, durées et vélocités.
- `pattern-compiler.ts` : compilation accord/gamme vers `NoteEvent[]` dans les tessitures absolues.
- `fragment-index.ts` : index local sérialisable et identifiant déterministe.
- `retrieval.ts` : recherche k-NN exacte, pondérée, déterministe et filtrée par œuvre/split/voix/fonction.
- `transformations.ts` : transposition de registre, variation rythmique et simplification déterministes avec trace.
- `constraints.ts` : tessitures, six voix, chronologie, mesures, basses slash, croisements et parallèles.
- `scoring.ts` : classement multicritère explicable sans prétention de mesurer la beauté.
- `candidate-generator.ts` : baseline V1 plus candidats dérivés de motifs locaux, filtrés puis classés.
- `feedback.ts` : comparaisons et préférences locales, notes, raisons et commentaires.
- `storage.ts` : stockage IndexedDB séparé `cso-style-v2` pour les index.
- `engine.ts` : façade V1/V2 et replis sûrs.
- `index.ts` : API publique du sous-système.

## Outils locaux construits

Sous `scripts/style-v2/` :

- `build-manifest.ts` : analyse récursive locale et manifeste en révision.
- `extract-corpus.ts` : extraction des sources explicitement incluses et construction d’index.
- `validate-artifacts.ts` : validation du manifeste, de l’index et de l’absence de fuite par œuvre.
- `validate-profile.ts` : validation du profil machine Axel Style V2.

Le profil fourni a été validé avec succès : 6 voix, 24 familles et 5 gammes.

Un essai réel de `build-manifest.ts` a été effectué sur les 11 fichiers du corpus de validation déjà versionnés dans `public/corpus`. Les 11 fichiers ont été parsés et mappés, mais aucun n’a été inclus automatiquement : droits, `workId` et split restent à confirmer. C’est le comportement de sécurité attendu.

## Intégration applicative

- `ProjectDocument` possède maintenant un réglage `styleV2` optionnel.
- Les projets anciens migrent vers `{ enabled: false, candidateCount: 3 }`.
- `Studio.tsx` appelle la façade V1/V2.
- Si `styleV2.enabled` et `styleV2.indexId` sont définis, le Studio tente de charger l’index dans IndexedDB.
- Sans index utilisable, le Studio revient exactement au moteur V1.
- La lecture et les exports continuent de consommer l’unique arrangement sélectionné.
- Aucun composant de design ou CSS n’a été remanié.

## Tests ajoutés

`scripts/test-style-v2.ts` couvre :

- mapping automatique et correction manuelle des six voix ;
- contrat du profil machine ;
- manifeste, droits, doublons et fuites entre splits ;
- extraction et provenance ;
- Pattern IR ;
- index et recherche k-NN ;
- exclusion du même `workId` ;
- transformations déterministes ;
- repli V1 exact quand le drapeau est désactivé ;
- repli V1 exact quand l’index manque ;
- génération et contraintes des candidats ;
- reproductibilité des candidats ;
- préférences et évaluations ;
- migration des projets.

La commande `test:style-v2` est intégrée à `npm run test:all`.

## Validation finale de la Phase 2

`npm run test:all` passe entièrement :

- typecheck ;
- lint ;
- moteur V1 ;
- moteur Style V2 ;
- imports ;
- exports ;
- contrôles musicaux ;
- build Vite de production.

Build : 2 472 modules transformés. L’avertissement préexistant concernant `caniuse-lite` demeure.

`git diff --check` passe.

## Fichiers existants modifiés

- `package.json`
- `src/features/circular/Studio.tsx`
- `src/features/circular/projects.ts`
- `src/features/circular/types.ts`

## Fichiers ajoutés

- `PHASE-1-AUDIT-ARCHITECTURE.md`
- `PHASE-2-IMPLEMENTATION.md`
- `STYLE-V2.md`
- `RELAIS-PHASE-3.md`
- `scripts/test-style-v2.ts`
- quatre scripts sous `scripts/style-v2/`
- vingt modules sous `src/features/circular/style-v2/`

## Limites connues et travail réservé à la Phase 3

1. Le corpus privé réel n’est pas ajusté : son manifeste doit d’abord recevoir les droits, `workId`, splits et corrections de voix confirmés.
2. Le navigateur peut charger un index déjà enregistré, mais l’interface ne propose pas encore d’import explicite de l’index.
3. Les corrections manuelles de mapping existent dans l’API, mais ne sont pas encore exposées dans l’interface.
4. Les candidats et leurs explications existent dans le moteur, mais la sélection A/B/C et l’enregistrement détaillé du choix ne sont pas encore reliés à l’atelier.
5. Les poids de score sont conservateurs et non ajustés; ils ne sont pas présentés comme des statistiques d’Axel.
6. Le rapport de l’arrangement dérivé réutilise encore certaines statistiques du baseline; la Phase 3 doit recalculer toutes les métriques après compilation.
7. Les tests utilisent des fixtures synthétiques; une validation musicale sur un lot réel autorisé, puis une écoute humaine en aveugle, restent nécessaires.
8. Les exports V2 passent par le même arrangement interne, mais un MIDI et un MusicXML V2 doivent encore être inspectés directement en Phase 3.
9. La dette de dépendances signalée par `npm audit` n’a pas été modifiée afin de ne pas mélanger maintenance technique et moteur musical.

## Raison de l’arrêt

L’utilisation disponible est tombée à environ 6 % dans la fenêtre courte. Conformément à la règle de gestion des limites, aucune nouvelle implémentation n’a été commencée après ce contrôle. Les tests complets, la documentation, le relais et le point de sauvegarde local ont été prioritaires.

