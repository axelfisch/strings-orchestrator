# Phase 1 — Audit et architecture du moteur symbolique hybride V2

Date de l’audit : 2026-10-01  
Périmètre : audit seulement, sans implémentation du moteur V2  
Projet : Circular Strings Orchestrator

## 1. Résumé exécutable

Le véritable dépôt est `axelfisch/strings-orchestrator`. La base fonctionnelle la plus récente à conserver est le commit `b3cca74f2ef08e81554f79c144e2ed4c429b74d7` de la branche de refonte `claude/ux-ui-refonte-xdiv22`, actuellement présent dans une pull request brouillon et non fusionnée. Ce commit contient les deux commits de refonte validés, sans modification des neuf moteurs protégés.

L’audit a été effectué dans un worktree isolé afin de ne pas toucher au checkout principal, qui contient six fichiers non suivis appartenant à l’utilisateur. La branche locale d’audit est `codex/hybrid-v2-audit` et pointe sur `b3cca74f2ef08e81554f79c144e2ed4c429b74d7`.

Le portail `npm run test:all` passe entièrement sur cette base. Le moteur actuel est déterministe, explicable et techniquement cohérent, mais son usage du corpus est encore limité à un profil agrégé de registres. Il ne possède ni manifeste fiable, ni provenance par fragment, ni représentation intermédiaire de motifs, ni recherche k-NN, ni génération multicandidat, ni apprentissage local des préférences A/B.

Le V2 doit être ajouté comme une chaîne parallèle et réversible derrière un drapeau de fonctionnalité désactivé par défaut. Le moteur V1, les projets existants, les imports, la lecture et les exports restent la référence de repli.

## 2. Dépôt, branche, commit et état Git

### Dépôt autoritaire

- Dépôt local de référence : `/Users/axelfisch/Documents/Codex/2026-09-29/stay-with-us-my-friend-pdf/work/strings-orchestrator`
- Dépôt distant : `https://github.com/axelfisch/strings-orchestrator.git`
- Branche distante principale : `main`
- Commit de `main` et `origin/main` au moment de l’audit : `29a88ffd653518cd8b734f69251b5b419ab75761`
- Branche de refonte validée : `claude/ux-ui-refonte-xdiv22`
- Commit de tête de la refonte : `b3cca74f2ef08e81554f79c144e2ed4c429b74d7`
- Commit antérieur de la refonte : `6240155aff2e11fe6c4aec0d4a519cc20aa2bff4`
- Pull request existante : `https://github.com/axelfisch/strings-orchestrator/pull/1`, ouverte en brouillon vers `main`

### Worktree d’audit

- Chemin : `/Users/axelfisch/Documents/Codex/2026-09-29/tu-m-aides-migrer-le-contexte/work/hybrid-v2-audit`
- Branche : `codex/hybrid-v2-audit`
- Base : avance rapide jusqu’à `b3cca74f2ef08e81554f79c144e2ed4c429b74d7`
- Aucune branche distante créée.
- Aucun push, aucune PR supplémentaire, aucune fusion et aucun déploiement n’ont été effectués.

### Protection des changements existants

Le checkout principal contenait déjà six fichiers non suivis, laissés intacts :

- `scripts/check-engine 2.ts`
- `src/features/circular/Studio 2.tsx`
- `src/features/circular/arrange 2.ts`
- `src/features/circular/corpus 2.ts`
- `src/features/circular/exporters 2.ts`
- `src/features/circular/midi 2.ts`

La différence entre `29a88ffd` et `b3cca74f` porte uniquement sur la refonte UI, `DESIGN-HANDOFF.md` et les composants de présentation. Le diff des neuf modules protégés est vide :

- `arrange.ts`
- `theory.ts`
- `midi.ts`
- `importer.ts`
- `exporters.ts`
- `corpus.ts`
- `projects.ts`
- `playback.ts`
- `types.ts`

## 3. Sources auditées et ordre d’autorité

### Sources lues intégralement

- `PROMPT-CODEX-WORK-MOTEUR-SYMBOLIQUE-HYBRIDE-V2.md`
- `axel-style-profile-v2.json`
- `AxelFisch-Arrangement-Style-2025.pdf`, 30 pages
- `README.md`
- `MUSICAL-SOURCE-OF-TRUTH.md`
- `DESIGN-HANDOFF.md`
- `package.json`
- Les neuf moteurs protégés et leurs scripts de test

Le fichier nommé `Axel-Fisch-style-moteur-symbolique-2026.docx` dans la consigne n’a pas été trouvé dans les emplacements accessibles. Il n’a donc pas servi de preuve. Le PDF fourni a été analysé comme référence complémentaire, pas comme source exécutable.

### Hiérarchie de preuve retenue

1. Demandes directes d’Axel dans la mission actuelle.
2. `MUSICAL-SOURCE-OF-TRUTH.md` et contrats exécutables du dépôt.
3. `axel-style-profile-v2.json`, avec ses niveaux de preuve A, B et C.
4. Mesures reproductibles accompagnées de leur source et méthode.
5. `AxelFisch-Arrangement-Style-2025.pdf`, uniquement pour ses principes qualitatifs vérifiables.
6. Documents et modèles historiques comme pistes, jamais comme vérité musicale autonome.

### Conclusion sur le PDF 2025

Le PDF contient beaucoup de répétitions, d’estimations et d’hypothèses formulées comme des pourcentages ou déduites de titres de fichiers. Les proportions telles que 60 % majeur, 50 % lent, 30 % sextuor, ainsi que le modèle générique « 2 + 2 + 2 », ne doivent pas devenir des règles de production.

Les éléments conservables sont :

- la logique Approche → Tension → Résolution ;
- l’usage d’extensions et de substitutions avec fonction harmonique lisible ;
- les cinq gammes documentées ;
- la priorité donnée aux intervalles, au rythme, au mouvement des voix et à la musicalité plutôt qu’à une simple gamme linéaire ;
- les correspondances accord–gamme comme hypothèses à tester, pas comme probabilités établies.

`axel-style-profile-v2.json` corrige justement cette faiblesse en séparant les faits autoritaires, les mesures et les hypothèses. Son statut `blueprint_not_fitted` signifie qu’il définit le schéma et les garde-fous, mais qu’il ne contient pas encore de poids stylistiques ajustés sur un corpus propre.

## 4. Inventaire local constaté sans ingestion

Les fichiers n’ont été ni ouverts en masse, ni copiés, ni téléversés, ni ajoutés au dépôt.

- `/Users/axelfisch/MusicTheory-AXELFISCH-2026` : 43 fichiers, aucun MIDI ou MusicXML détecté par extension.
- `/Users/axelfisch/Documents/AllNonClassé-StringsOrchestrator-2026/StringsOrchestrator-BOLTV2-2026` : 219 fichiers, dont 113 MIDI et 34 MusicXML/XML.

Ces nombres sont un inventaire de fichiers, pas un nombre d’œuvres indépendantes. Avant toute mesure stylistique, les variantes, doublons, exports multiples d’une même œuvre et droits d’utilisation doivent être identifiés dans un manifeste.

## 5. Tests et état de la base

### Commandes exécutées

```text
npm ci
npm run test:all
npm audit --json
git diff --exit-code 29a88ffd... b3cca74f... -- <neuf moteurs protégés>
```

### Résultat de `npm run test:all`

Tous les contrôles passent :

- TypeScript sans émission ;
- ESLint ;
- tests du moteur ;
- tests d’import MIDI et MusicXML ;
- tests d’export ;
- contrôles musicaux ;
- build Vite de production.

Le build a traité 2 453 modules et produit les fichiers de production. Un avertissement indique que la base `caniuse-lite` est ancienne, sans faire échouer le build.

### Dette de dépendances constatée

`npm audit` signale actuellement 20 vulnérabilités dans l’arbre de dépendances : 3 faibles, 5 modérées et 12 élevées, aucune critique. Les dépendances directes signalées incluent notamment `postcss` et `vite`; plusieurs autres alertes sont transitives.

Cette dette n’est pas un défaut musical et ne doit pas être corrigée automatiquement pendant la construction du moteur. Elle doit faire l’objet d’une tâche séparée avec mise à niveau contrôlée et réexécution de tout le portail. Aucun `npm audit fix` n’a été lancé.

### Limites de la validation effectuée

- Aucun jugement esthétique à l’oreille n’a été réalisé pendant cet audit.
- Aucun nouveau MIDI ou MusicXML n’a été généré par un moteur V2, puisqu’il n’existe pas encore.
- Aucun modèle audio, service payant ou GPU n’a été utilisé.

## 6. Architecture actuelle

### Contrats et théorie

`types.ts` définit le schéma de projet V2, les événements de notes et d’harmonie, les arrangements, le profil stylistique agrégé, les 24 familles et les cinq gammes.

`theory.ts` contient les formules exécutables des familles, les cinq gammes, les tessitures absolues, l’orthographe, le traitement des basses slash et les utilitaires d’une ou deux harmonies par mesure. Le choix accord–gamme actuel est volontairement simple.

### Génération

`arrange.ts` produit un seul arrangement déterministe à partir de la grille, de la forme, du style, du genre, de la graine et des options mélodiques. Les modes canonique, contrôlé, manuel et préservation de l’import existent.

Le profil du corpus n’influence actuellement que les centres de registre par interpolation. Les métriques de rythme, densité, espacement, articulation et mouvement mesurées par le corpus ne sont pas consommées par le générateur. Il n’y a ni fragments référencés, ni candidats multiples, ni score stylistique, ni explication de provenance.

Le pool contrôlé de mélodie comprend Violon I, Violon II, Alto I, Alto II et Violoncelle. La Contrebasse reste exceptionnelle et n’appartient pas à la rotation contrôlée; elle peut néanmoins être choisie manuellement selon le contrat actuel.

### Corpus

`corpus.ts` stocke localement les fichiers dans IndexedDB `cso-corpus`, les analyse et calcule un `StyleProfile` agrégé pondéré par nombre de notes. La déduplication est limitée au hash exact du fichier.

La répartition des pistes vers les voix repose largement sur la hauteur médiane. Cette méthode est précisément l’une des causes connues des mauvaises attributions : une mélodie de violoncelle peut être classée comme voix haute, et un Violon II très aigu peut être confondu avec le Violon I.

La métrique de croisement vertical mérite une correction : les hauteurs sont triées avant le calcul, ce qui élimine l’identité des voix et rend le test `gap < 0` inopérant dans cette forme. Une nouvelle extraction V2 doit préserver l’ordre canonique des voix.

Il n’existe pas encore de `work_id`, de groupement par œuvre, de séparation entraînement/validation/test, de droits, de provenance au niveau du fragment, de déduplication transposée ou de validation des références.

### Imports

`importer.ts` privilégie les noms de pistes, puis utilise une solution de repli fondée sur les médianes. La mélodie est estimée par nom, monophonie, registre et durée; la basse par la piste la plus grave.

Les harmonies sont soit reprises explicitement du MusicXML avec confiance 1, soit estimées par couverture de classes de hauteurs sur 12 fondamentales × 24 familles. Jusqu’à deux harmonies peuvent être retenues par mesure.

Le V2 doit réutiliser ce pipeline comme source d’événements, mais remplacer le repli naïf de mapping des voix par un module explicable qui combine noms, tessitures, continuité, chevauchement, rôle mélodique et possibilité de correction manuelle.

### Lecture, exports et projets

`playback.ts` lit les mêmes `Arrangement.notes` que les exports. Cette unicité doit être préservée.

`exporters.ts` produit MIDI type 1, MusicXML 4.0, ABC, grille, rapport et JSON de projet. Il doit rester consommateur de l’arrangement final et ne pas contenir de logique de style.

`projects.ts` sauvegarde les projets sous les clés `cso-project-library-v2` et `cso-active-project-v2`. Les extensions V2 doivent être optionnelles, migrées avec valeurs sûres et ne jamais rendre illisibles les projets existants.

### Point d’intégration principal

`Studio.tsx` calcule actuellement le profil avec `importedProfile ?? profileFrom(corpus)`, puis appelle directement `arrange(...)`. C’est le point naturel pour introduire une façade de moteur qui choisit entre V1 et V2 selon un drapeau de fonctionnalité.

La variante A/B actuelle mémorise deux états de projet. Elle ne conserve ni l’identité des candidats, ni la préférence, ni les motifs utilisés, ni les scores. Le V2 doit garder la simplicité de cette interface tout en enregistrant localement une observation de préférence explicable.

## 7. Défauts à corriger par le V2

1. Empêcher que la mélodie soit systématiquement confiée au Violon I ou placée une octave trop haut.
2. Empêcher que le Violon II soit traité comme un doublage aigu quasi constant de la mélodie.
3. Permettre à Violon II, Alto I, Alto II, Violoncelle et exceptionnellement Contrebasse de porter une mélodie selon une logique contrôlée.
4. Ne jamais supposer que la mélodie est la note supérieure de chaque accord.
5. Apprendre des gestes mesurables — rythme, contour, intervalles, texture, mouvement interne, respiration — sans recopier une pièce source.
6. Préserver les 24 familles, les cinq gammes, les basses slash, les deux harmonies par mesure et les six voix canoniques.
7. Fournir plusieurs candidats déterministes et comparables au lieu d’une seule sortie.
8. Expliquer pourquoi un candidat a été retenu et de quelles références autorisées proviennent ses caractéristiques.
9. Enregistrer les préférences A/B uniquement en local, sans transfert du corpus.
10. Conserver un repli bit-à-bit ou structurellement stable vers V1 quand le drapeau est désactivé ou le corpus insuffisant.

## 8. Architecture cible V2

### Principe général

```text
Sources locales autorisées
        ↓
Manifeste + droits + work_id + hash
        ↓
Parsing MIDI/MusicXML existant
        ↓
Mapping explicable des six voix
        ↓
Extraction de caractéristiques et fragments
        ↓
Pattern IR versionné
        ↓
Index local + recherche k-NN déterministe
        ↓
Transformations contrôlées
        ↓
Compilation vers NoteEvent[]
        ↓
Contraintes absolues
        ↓
Scores techniques + stylistiques + diversité
        ↓
Candidats A/B/C + explications + provenance
        ↓
Arrangement final unique → lecture et six exports existants
```

### Séparation hors ligne / navigateur

Deux couches sont nécessaires :

- une couche d’outillage Node locale pour inventorier un grand dossier, créer le manifeste, extraire les fragments et générer un index dérivé sans téléversement ;
- une couche navigateur pour charger des artefacts dérivés, utiliser le corpus IndexedDB existant, rechercher des motifs et produire des candidats.

Les chemins absolus de l’ordinateur ne doivent pas être exportés dans un projet partageable. Les artefacts du navigateur ne conservent que des identifiants stables, hashes, métadonnées autorisées et statistiques dérivées.

### Manifeste

Chaque entrée doit contenir au minimum :

- `schemaVersion`, `sourceId`, `workId`, `variantId` ;
- nom original, format, hash SHA-256, taille ;
- statut des droits : `owned`, `licensed`, `reference_only`, `unknown`, `excluded` ;
- statut d’inclusion et motif d’exclusion ;
- compositeur/arrangeur seulement si fourni ou confirmé ;
- tonalité, mesure, tempo et nombre de mesures détectés ;
- pistes détectées, mapping proposé, corrections manuelles ;
- split au niveau `workId` : `train`, `validation`, `test`, `holdout` ;
- liens vers les fragments et version de l’extracteur ;
- avertissements et niveau de confiance.

Les droits, le `workId` et l’auteur ne doivent jamais être inventés. Leur valeur par défaut est `unknown` ou `review_required`.

### Pattern IR

Le Pattern IR représente un geste musical indépendant d’un fichier :

- rôle de voix et rôle de texture ;
- position métrique normalisée ;
- durée en temps et en fraction de mesure ;
- contour relatif et intervalles plutôt que hauteurs absolues ;
- relation aux tons d’accord, extensions et tensions ;
- relation à une ou deux harmonies dans la mesure ;
- articulation, densité, silences et anacrouse ;
- mouvement contraire, oblique ou parallèle avec les voix voisines ;
- zone de registre relative à la tessiture de la voix ;
- fonction formelle : approche, tension, résolution, transition, cadence ;
- provenance, confiance et version du schéma.

Le compilateur transforme un motif relatif en `NoteEvent[]` pour une grille, une voix et une tonalité données. Il doit échouer proprement si les contraintes ne peuvent pas être satisfaites, sans forcer des notes hors tessiture.

### Recherche locale k-NN

L’index est exact et déterministe dans la première version. Un corpus de cette taille ne justifie pas encore une base vectorielle distante.

Le vecteur peut inclure :

- fonction harmonique et famille d’accord ;
- position dans la forme ;
- métrique et densité ;
- rôle de voix ;
- histogramme d’intervalles ;
- contour ;
- ratio notes d’accord/tensions ;
- espace avant/après ;
- registre relatif ;
- mouvement avec les voisins.

La distance doit combiner des composantes normalisées, avec poids versionnés. Les références du même `workId` que l’exemple de validation ou de test doivent être exclues de la recherche pour prévenir les fuites.

### Transformations déterministes

Les transformations autorisées doivent être explicites et testables :

- transposition diatonique/chromatique compatible avec l’accord ;
- adaptation à une nouvelle harmonie ;
- transfert de registre dans la tessiture de la voix ;
- compression ou expansion rythmique mesurée ;
- rotation ou permutation limitée des voix internes ;
- inversion de contour seulement si la fonction harmonique demeure valide ;
- simplification/densification bornée ;
- ajout ou retrait de notes de passage compatible avec l’échelle choisie ;
- variation d’articulation et de respiration ;
- adaptation d’une mesure à deux harmonies.

Chaque transformation reçoit une graine, produit une trace et ne modifie jamais la source stockée.

### Contraintes absolues

Les candidats invalides sont rejetés avant classement :

- exactement les six voix canoniques ;
- aucune note hors tessiture absolue ;
- basses slash conservées ;
- au plus deux harmonies chronométrées par mesure ;
- aucune note en dehors du vocabulaire accord/échelle sauf exception explicitement annotée ;
- pas de collision de durée ou de mesure ;
- pas de mélodie artificiellement forcée en note supérieure ;
- pas de parallèles ou croisements persistants au-delà des seuils techniques ;
- même source d’événements pour lecture et exports ;
- résultat reproductible avec la même graine, le même profil et le même index.

### Classement multicritère

Le score n’est pas une prétendue mesure de beauté. Il sert à ordonner des candidats techniquement valides :

- validité dure ;
- adéquation harmonique ;
- conduite des voix ;
- registre et équilibre des six voix ;
- cohérence de la mélodie assignée ;
- proximité stylistique des caractéristiques mesurées ;
- cohérence formelle ;
- diversité par rapport aux autres candidats ;
- pénalité de proximité excessive avec une référence ;
- préférence locale A/B, seulement après un nombre suffisant d’observations.

Chaque composante doit être exposée dans un `CandidateExplanation`. Les poids initiaux sont conservateurs et documentés; ils ne sont pas présentés comme des statistiques d’Axel tant qu’ils ne sont pas ajustés et validés.

## 9. Modules exacts proposés

### Nouveaux modules d’exécution navigateur

Créer sous `src/features/circular/style-v2/` :

- `types.ts` — schémas versionnés du manifeste, fragments, Pattern IR, index, candidats, scores et préférences.
- `schemas.ts` — validation et migrations des artefacts JSON V2.
- `voice-mapping.ts` — proposition et correction explicable du mapping vers les six voix.
- `features.ts` — extraction de caractéristiques par piste, voix, mesure et fragment.
- `fragments.ts` — segmentation musicale et provenance.
- `pattern-ir.ts` — construction et validation du Pattern IR.
- `pattern-compiler.ts` — compilation vers `NoteEvent[]` selon grille, voix et graine.
- `fragment-index.ts` — index local sérialisable et distance exacte.
- `retrieval.ts` — filtrage par contexte, exclusion des fuites et sélection k-NN.
- `transformations.ts` — transformations déterministes avec trace.
- `constraints.ts` — contraintes dures et diagnostics.
- `scoring.ts` — scores techniques, stylistiques et diversité.
- `candidate-generator.ts` — génération de plusieurs candidats et déduplication.
- `feedback.ts` — préférences A/B locales versionnées.
- `storage.ts` — stockage IndexedDB V2 distinct et migrations sûres.
- `engine.ts` — façade unique `runStyleEngineV2`, avec repli contrôlé vers V1.
- `index.ts` — API publique minimale du sous-système.

### Nouvel outillage local

Créer sous `scripts/style-v2/` :

- `build-manifest.ts` — inventaire explicite des dossiers autorisés, sans transfert réseau.
- `inspect-manifest.ts` — rapport des droits inconnus, doublons, mappings faibles et œuvres sans split.
- `extract-corpus.ts` — parsing, mapping, fragments et caractéristiques.
- `build-index.ts` — génération de l’index dérivé reproductible.
- `validate-artifacts.ts` — validation des schémas, hashes, provenance et absence de fuite.

### Nouveaux tests

Créer sous `scripts/style-v2/` ou `src/features/circular/style-v2/__tests__/`, selon le mécanisme retenu sans ajouter inutilement un framework :

- `test-manifest.ts`
- `test-voice-mapping.ts`
- `test-features.ts`
- `test-pattern-ir.ts`
- `test-pattern-compiler.ts`
- `test-retrieval.ts`
- `test-transformations.ts`
- `test-constraints.ts`
- `test-scoring.ts`
- `test-candidates.ts`
- `test-feedback.ts`
- `test-integration.ts`

### Fichiers existants à modifier avec parcimonie

- `src/features/circular/types.ts` — ajouter seulement des réglages V2 optionnels au projet, avec valeur par défaut désactivée; ne pas dupliquer les 24 familles, cinq gammes ou tessitures.
- `src/features/circular/projects.ts` — migration tolérante des nouveaux champs optionnels et conservation des clés existantes.
- `src/features/circular/Studio.tsx` — appeler une façade V1/V2, exposer le drapeau, les candidats et leurs explications avec le minimum d’interface nécessaire.
- `src/features/circular/corpus.ts` — fournir un adaptateur vers l’extraction V2, sans casser le profil V1 ni migrer brutalement la base existante.
- `src/features/circular/importer.ts` — déléguer le mapping avancé quand V2 est actif, tout en conservant le repli V1.
- `src/features/circular/arrange.ts` — rester le générateur V1 et le candidat de référence; n’extraire des utilitaires que si un test démontre la nécessité.
- `package.json` — ajouter les commandes V2 et les intégrer au portail seulement après stabilisation.
- `README.md` et un nouveau `STYLE-V2.md` — documenter le flux local, les limites, les droits et les artefacts.

### Fichiers à préserver comme consommateurs

Sauf incompatibilité démontrée par un test, ne pas modifier pendant la Phase 2 :

- `theory.ts`, qui reste la source musicale exécutable ;
- `midi.ts`, qui reste le parseur ;
- `exporters.ts`, qui consomme l’arrangement final ;
- `playback.ts`, qui consomme les mêmes notes ;
- les composants de refonte graphique, hors contrôle minimal du drapeau et des candidats.

## 10. Ordre d’implémentation de la Phase 2

### Étape 0 — Garde-fous et fixtures

- Geler des sorties V1 de référence avec plusieurs graines, styles et modes mélodiques.
- Ajouter un test prouvant que `styleV2.enabled = false` conserve le comportement V1.
- Créer les schémas V2 et des fixtures synthétiques sans utiliser le corpus privé.

Critère de sortie : aucun changement des sorties V1 et portail actuel toujours vert.

### Étape 1 — Manifeste et provenance

- Implémenter le manifeste et le validateur.
- Grouper les fichiers par `workId` seulement après confirmation ou preuve explicite.
- Détecter les doublons exacts puis préparer une empreinte musicale transposition-invariante.
- Séparer train/validation/test au niveau de l’œuvre.

Critère de sortie : aucun fragment sans source, hash, droits et split explicites.

### Étape 2 — Mapping robuste des voix

- Combiner nom, tessiture, continuité, chevauchement, rôle mélodique, densité et possibilité de correction.
- Conserver un score et des raisons par piste.
- Refuser l’automatisme quand la confiance est insuffisante.

Critère de sortie : tests couvrant mélodie au Violoncelle, Violon II aigu, pistes sans nom, doublages et Contrebasse mélodique exceptionnelle.

### Étape 3 — Caractéristiques et fragments

- Extraire les métriques sans perdre l’identité des voix.
- Corriger le calcul des croisements.
- Segmenter par forme, cadence, silences, motifs et fenêtres mesurées.

Critère de sortie : extraction déterministe et résultats invariants aux changements de nom de fichier.

### Étape 4 — Pattern IR et compilateur

- Encoder les motifs relativement à la voix, à la métrique et à l’harmonie.
- Compiler vers les événements canoniques.
- Tester les deux harmonies par mesure, les basses slash et les cinq gammes.

Critère de sortie : round-trip structurel et aucun événement hors contrat.

### Étape 5 — Index, recherche et transformations

- Construire l’index exact local.
- Appliquer les filtres de contexte et anti-fuite.
- Ajouter progressivement les transformations déterministes avec traces.

Critère de sortie : mêmes voisins et mêmes transformations avec la même graine.

### Étape 6 — Contraintes, score et candidats

- Produire plusieurs candidats à partir de V1, du retrieval et de transformations contrôlées.
- Rejeter les invalides avant classement.
- Exposer toutes les composantes du score.
- Garantir une diversité minimale entre A, B et C.

Critère de sortie : tous les candidats passent les contraintes et sont reproductibles.

### Étape 7 — Préférences locales

- Enregistrer choix, contexte, candidats comparés et versions.
- N’ajuster que des poids bornés après un nombre minimum d’observations.
- Permettre remise à zéro et export local explicite.

Critère de sortie : aucune préférence implicite, aucune donnée envoyée hors du navigateur.

### Étape 8 — Intégration derrière le drapeau

- Ajouter `styleV2.enabled`, désactivé par défaut.
- Intégrer la façade dans `Studio.tsx`.
- Préserver la lecture et les exports depuis l’arrangement sélectionné.
- Afficher provenance, diagnostics et comparaison sans refaire le design.

Critère de sortie : un projet ancien s’ouvre sans migration destructive; le mode V1 reste identique.

### Étape 9 — Portail et documentation

- Ajouter `test:style-v2` puis l’inclure dans `test:all` lorsque stable.
- Documenter la construction du manifeste, l’index, les droits et les limites.
- Produire `PHASE-2-IMPLEMENTATION.md`.

## 11. Matrice minimale de tests V2

### Contrats immuables

- Exactement 24 familles et cinq gammes.
- Six voix canoniques dans toutes les sorties.
- Une ou deux harmonies par mesure.
- Bass slash conservée du choix jusqu’au MIDI/MusicXML/rapport.
- Même liste de notes pour lecture et exports.

### Mélodie et registres

- Violon I non systématique en mode contrôlé.
- Mélodie de Violon I sans transposition automatique d’une octave.
- Violon II non systématiquement au-dessus de son rôle.
- Mélodie possible pour Violon II, les deux Altos et Violoncelle.
- Contrebasse possible en mode manuel exceptionnel.
- La voix mélodique peut être sous une autre voix sans perdre son identité.

### Corpus et provenance

- Doublon exact rejeté.
- Variantes d’une œuvre gardées dans le même split.
- Référence sans droits exclusible.
- Aucun voisin de validation/test issu du même `workId`.
- Chaque candidat indique les fragments ou seulement le V1 utilisés.

### Déterminisme et repli

- Même graine + mêmes artefacts = mêmes candidats et mêmes scores.
- Drapeau désactivé = sortie V1 de référence.
- Index absent ou corpus insuffisant = repli V1 explicite, sans crash.
- Artefact d’une version future = refus lisible, pas de corruption.

### Transformations et contraintes

- Transposition compatible avec l’accord et la gamme.
- Adaptation correcte sur deux harmonies.
- Aucun dépassement de tessiture après transformation.
- Pas de notes ou durées négatives, chevauchements incohérents ou mesures incomplètes.
- Les parallèles, croisements et écarts sont calculés en conservant l’identité des voix.

### Intégration

- Projet ancien, nouveau, dupliqué et importé en JSON.
- Import MIDI et MusicXML avec mapping corrigible.
- Play, pause, stop, début et boucle.
- Six exports.
- Persistance après rechargement.
- Comparaison A/B et conservation de la préférence locale.

## 12. Décisions à ne pas prendre automatiquement

- Aucun poids stylistique chiffré ne doit être présenté comme celui d’Axel sans mesure reproductible et validation humaine.
- Aucun droit, auteur, œuvre ou relation entre variantes ne doit être inféré silencieusement.
- Aucun modèle audio ou grand modèle génératif n’est nécessaire pour le V2 symbolique.
- Aucun fichier du corpus ne doit être téléversé.
- Aucun nettoyage automatique des dépendances ne doit être mélangé à la construction musicale.
- Aucun changement esthétique ou refonte graphique n’appartient à cette phase.
- Aucun push, merge, PR ou déploiement ne doit être effectué sans autorisation.

## 13. Instructions précises pour la Phase 2

Lorsque l’utilisateur écrit exactement `COMMENCE LA PHASE 2.` :

1. repartir de ce worktree et vérifier que la branche pointe toujours sur `b3cca74f2ef08e81554f79c144e2ed4c429b74d7` plus ce rapport seulement ;
2. relire `MUSICAL-SOURCE-OF-TRUTH.md`, `axel-style-profile-v2.json` et ce rapport ;
3. ne pas modifier les fichiers non suivis du checkout principal ;
4. exécuter le portail avant toute modification ;
5. réaliser les étapes 0 à 9 dans l’ordre, par petites unités testées ;
6. commencer avec des fixtures synthétiques, puis analyser uniquement les dossiers locaux explicitement autorisés ;
7. ne jamais inclure les fichiers sources du corpus, leurs chemins absolus ou des données privées dans Git ;
8. conserver le moteur V1 intact comme référence et repli ;
9. maintenir le drapeau V2 désactivé par défaut jusqu’à la validation complète ;
10. consigner chaque hypothèse et la remplacer par une mesure ou la laisser marquée comme hypothèse ;
11. arrêter la Phase 2 après tests, documentation, état Git exact et éventuel commit local autorisé ;
12. ne pas commencer la Phase 3 sans le message explicite de l’utilisateur.

## 14. État à la fin de la Phase 1

- Audit du dépôt, des moteurs, des types, des intégrations et des sources terminé.
- Portail de tests existant entièrement passant sur la base de refonte.
- Neuf moteurs protégés identiques à `main`.
- Architecture V2, modules, ordre et tests définis.
- Aucune ligne du moteur modifiée.
- Aucun fichier du corpus ingéré ou téléversé.
- Aucun push, aucune PR, aucune fusion et aucun déploiement.
- Utilisation Codex vérifiée pendant l’audit : 28 % restants dans la fenêtre de cinq heures et 73 % restants dans la fenêtre hebdomadaire au moment du contrôle; les seuils d’arrêt de 15 % et 8 % n’étaient pas atteints.

