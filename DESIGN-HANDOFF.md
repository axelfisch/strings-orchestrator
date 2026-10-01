# DESIGN-HANDOFF — Circular Strings Orchestrator

Description du système de design **réellement implémenté** dans l’application React. La logique musicale vit dans `src/features/circular/*.ts` ; la peau vit dans `Studio.tsx`, `Circle.tsx`, `circular.css` et `src/features/circular/ui/`.

## Direction

Un atelier de composition pour cordes de chambre : fond bleu-noir, surfaces calmes, texte ivoire, un seul accent ambre réservé à l’action principale, à la sélection et à la lecture. Les titres en Cormorant Garamond donnent la voix « partition » ; Barlow porte l’interface et les chiffres (tabulaires). Pas de dégradés décoratifs, pas de néon, une élévation discrète. Le cercle harmonique reste l’élément central et affiche l’accord courant en son cœur.

## Organisation de l’écran unique

- **Barre d’application** (collante au-dessus de 720 px) : marque, projet ouvert, état de sauvegarde, Annuler / Rétablir.
- **Parcours** (bandeau masquable, mémorisé par `cso-ui-welcome-dismissed-v1`) : Choisir les accords → Construire la grille → Générer → Écouter → Ajuster → Exporter, chaque étape est un lien vers sa zone.
- **1 · Harmonie** : cercle (12 fondamentales, 5 groupes), cible courante (mesure, 1re/2e harmonie, verrou), 24 familles groupées par Majeur / Mineur / Dominante / Suspendu / Diminué, basse (étrangère, renversement, sans basse slash), placement, deux harmonies, écoute, édition texte des symboles et confiance d’import.
- **2 · Grille** : forme, métrique, tonalité, mode, style, genre, langage harmonique, graine, Générer la grille, Nouvelle prise, légende des états, grille groupée par section (A1, A2, B, A3 avec leur texture), verrou de mesure et de section.
- **3 · Arrangement à six voix** : gamme, passage de la mélodie, instrument mélodique, registre, résumé (mélodie de la section, voix verrouillées, influence du corpus), liste des voix avec rôle et verrou, piano-roll, mesures techniques, variantes A/B.
- **4 · Atelier** (onglets) : Projet, Import, Corpus, Export, Rapport. Les retours (succès, avertissement, erreur) s’affichent en tête de l’atelier.
- **Transport** fixe en bas de l’écran : Début, Lecture/Pause/Reprendre, Arrêt, Boucle, état, mesure sélectionnée ou jouée, tempo, métrique.

Points de rupture : ≥ 1280 px trois colonnes (Harmonie et Atelier collantes, défilement interne) ; 900–1279 px deux colonnes, Atelier en pleine largeur dessous ; < 900 px une colonne. ≤ 1023 px le projet passe sous la marque ; ≤ 720 px barres compactes ; ≤ 520 px grille à deux mesures par rangée, champs longs en pleine largeur, transport sur deux rangées.

## Jetons (`circular.css`, `:root`)

| Rôle | Jeton | Valeur |
| --- | --- | --- |
| Fond | `--color-void` | `#050B16` |
| Surface | `--color-surface` | `#0F172A` |
| Surface relevée / creusée | `--color-surface-raised` / `--color-surface-sunken` | `#152038` / `#0A1222` |
| Lignes / bord des contrôles | `--color-line` / `--color-line-strong` | `#22304A` / `#5B6B88` (3,3:1) |
| Texte | `--color-text` | `#ECE5D8` (14,3:1) |
| Texte secondaire / discret | `--color-text-muted` / `--color-text-faint` | `#A9B2C1` (8,4:1) / `#8691A4` (5,6:1) |
| Accent | `--color-accent` / `--color-accent-ink` | `#E8A45A` / `#24170A` (8,2:1) |
| Succès / avertissement / erreur / info | `--color-success` … `--color-info` | `#9CC9A8` / `#E9C46A` / `#EE9E8C` / `#9DBBE0`, chacun avec un fond `-soft` |

Contrastes mesurés sur `--color-surface`. Espacements `--space-1…7` = 4, 8, 12, 16, 24, 32, 48 px. Rayons `--radius-sm/md/lg/pill` = 6, 10, 14, 999 px. Contrôles `--control-sm/md/lg` = 36, 44, 52 px ; sur écran tactile (`pointer: coarse`) `--control-sm` passe à 44 px. Focus : `--focus-ring` (anneau ambre de 2 px détaché du fond). Durées `--dur-fast` 120 ms, `--dur-base` 180 ms.

## Voix

| Voix | Jeton | Couleur | Abrégé |
| --- | --- | --- | --- |
| Violon I | `--voice-vn1` | ambre `#E8A45A` | Vn I |
| Violon II | `--voice-vn2` | ivoire `#ECE5D8` | Vn II |
| Alto I | `--voice-va1` | brume `#7FA7C9` | Alt I |
| Alto II | `--voice-va2` | sauge `#8FAE9A` | Alt II |
| Violoncelle | `--voice-vc` | argile `#C4A484` | Vc |
| Contrebasse | `--voice-cb` | graphite `#8A8D93` | Cb |

La table `VOICE_COLOR` de `ui/labels.ts` pointe vers ces jetons ; la même couleur sert à la liste des voix, au piano-roll, à la gouttière des registres, au verrou et au tableau du rapport.

## Composants (`src/features/circular/ui/`)

- `TransportBar` — transport fixe ; états `Prêt · début`, `Prêt`, `Lecture`, `En pause`, `Chargement audio…` ; Boucle en `aria-pressed` avec mot « active ».
- `BarGrid` — mesures groupées par section ; focus itinérant (une seule tabulation, flèches, Début/Fin).
- `PianoRoll` — couche de notes mémorisée (rendu par mesure, pas par image), tête de lecture séparée, repères C2–C6, colonne sélectionnée et colonne jouée, gouttière des zones centrales mesurées par voix.
- `VoiceList` — couleur, nom, rôle de la section courante, étiquette Mélodie, zone centrale, verrou textuel.
- `Tabs` / `TabPanel` — onglets WAI-ARIA avec flèches.
- `DropZone` — zone de dépôt + sélecteur de fichier standard, état d’analyse.
- `Notice` — retour avec icône, titre écrit (Information, Succès, Avertissement, Erreur) et texte ; `role="alert"` pour les erreurs.
- `labels.ts` — libellés français (origine, rôle), couleurs de voix, nom de hauteur, durée.

## États implémentés

| État | Rendu (jamais par la couleur seule) |
| --- | --- |
| Premier lancement | bandeau « Le parcours de l’atelier » masquable |
| Chargement | audio : bouton Lecture désactivé + « Chargement audio… » ; corpus : « Chargement du corpus… » |
| Projet sauvegardé / modifications non sauvegardées / échec | « Enregistré localement · HH:MM » ✓ / « Modifications en cours… » (icône de chargement) / « Sauvegarde locale impossible » ⚠ |
| Mesure sélectionnée | bord ambre 2 px, numéro sur pastille pleine, `aria-pressed` |
| Mesure en lecture | filet ivoire supérieur, icône ▶, texte « En lecture » |
| Deuxième harmonie | second symbole sous un filet pointillé, marqué « 2 » |
| Origine | texte « Générée », « Manuelle », « Importée », « Vide » |
| Mesure / section verrouillée | icône cadenas, texte « Verrouillée », hachure discrète |
| Voix mélodique | étiquette « Mélodie » et bord à la couleur de la voix |
| Voix verrouillée | bouton « Verrouillée » + cadenas fermé, filet de couleur pointillé, notes du piano-roll en pointillés |
| Lecture / pause / arrêt / boucle | état écrit dans le transport, pastille, filet ambre en lecture, « Boucle active » |
| Arrangement non généré | message dans le piano-roll quand il n’y a aucune note |
| Variante | « Variante A/B affichée », A/B segmenté, B barré si absente, phrase d’état |
| Import en cours / refusé / résumé | zone de dépôt « Import en cours… » ; Notice erreur « Import refusé : … » ; fiche nom, format, pistes, mesures, durée, tempo, métrique, tonalité, longueur du projet, avertissements, accords détectés avec confiance |
| Corpus vide / actif / inactif / erreur | message d’absence ; étiquettes « Active », « Inactive », « Erreur de lecture » + filet latéral |
| Influence | curseur avec valeur écrite, rappel dans l’arrangement (« Corpus : influence 60 % · 9 réf. » ou « sans influence ») |
| Export en cours / réussi / impossible | ligne d’export : icône de chargement « … en préparation », ✓ « … prêt. », ⚠ « Export impossible : … » |

## Accessibilité

- Cercle navigable au clavier : fondamentales en `radiogroup` (flèches), groupes en `radio` (Entrée/Espace), anneau de focus visible.
- Toutes les commandes ont un nom accessible ; les boutons à icône seule ont un `aria-label` et, au-dessus de 720 px, un texte visible.
- Champs associés à leur libellé ; aides reliées par `aria-describedby`.
- Lien d’évitement « Aller à l’atelier ».
- Retours en `role="status"` ou `role="alert"`.
- `prefers-reduced-motion` coupe transitions et animations.
- Aucun texte essentiel uniquement en infobulle : les `title` du piano-roll et du registre ne font que compléter.

## Mouvement

Seulement : sélection de mesure (léger rebond de 180 ms), apparition des panneaux et retours (montée de 4 px), changements de fond et de bord (120 ms), rotation des icônes de chargement.

## Contraintes conservées

- Libellés français et crédit Axel Fisch.
- Les symboles d’accords ne sont jamais remplacés par des couleurs.
- « Rapport imprimable » ouvre le rapport HTML pour l’impression ou l’enregistrement PDF du navigateur ; pas de second moteur PDF.
- Le corpus est présenté comme des références locales et déterministes, jamais comme un entraînement neuronal.
- Les confirmations restent réservées à la suppression d’un projet et au vidage du corpus ; le renommage de référence utilise `window.prompt`.
- Identifiants de stockage inchangés (`cso-project-library-v2`, `cso-active-project-v2`, base IndexedDB `cso-corpus`). Seule clé ajoutée : `cso-ui-welcome-dismissed-v1`, préférence d’interface.

## Fonctions à ne pas casser

Cercle, 24 familles, basses slash, renversements, première/deuxième harmonie, grille de 8/16/32 mesures, six voix, choix et transfert de mélodie, verrous de voix, de mesure et de section, variantes A/B, Annuler/Rétablir, Lecture / Pause / Arrêt / Début / Boucle, tempo, métriques 4/4 3/4 6/8, cinq gammes, import MIDI ou MusicXML avec validation, corpus local, influence, inclusion/exclusion/renommage/suppression des références, profil importé ou calculé, projets locaux (nouveau, dupliquer, renommer, supprimer), exports MIDI/MusicXML/ABC/grille/rapport/projet JSON, import JSON et persistance locale.

## Règle pour les prochains passages

- Toute modification de `arrange.ts`, `theory.ts`, `midi.ts`, `importer.ts`, `exporters.ts`, `corpus.ts`, `projects.ts`, `playback.ts` ou `types.ts` sort du mandat visuel.
- Ajouter une couleur, un espacement ou un rayon d’abord comme jeton dans `:root`.
- Après chaque passage visuel : `npm run test:all`, puis vérification à 1440, 900 et 390 px.
