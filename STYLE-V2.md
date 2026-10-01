# Moteur symbolique hybride Axel Style V2

## Statut

Le moteur V2 est expérimental, local et désactivé par défaut. Le moteur V1 reste le repli autoritaire. Aucun modèle audio, GPU, service payant ou transfert du corpus n’est utilisé.

## Contrat musical préservé

- six voix : Violon I, Violon II, Alto I, Alto II, Violoncelle, Contrebasse ;
- 24 familles harmoniques canoniques ;
- cinq gammes documentées ;
- une ou deux harmonies par mesure ;
- conservation des basses slash ;
- mêmes événements pour la lecture et les exports ;
- contraintes de tessiture absolues ;
- génération reproductible à graine identique.

## Chaîne V2

1. Un manifeste local associe chaque fichier à un hash, des droits, un `workId`, une variante, un split et un mapping des voix.
2. L’extracteur segmente les sources autorisées en fragments sans perdre l’identité des six voix.
3. Le Pattern IR représente rythme, contour et intervalles relativement au contexte.
4. Un index exact local permet une recherche k-NN déterministe.
5. Les motifs retrouvés sont transformés et compilés vers les événements internes.
6. Les contraintes dures rejettent les candidats invalides.
7. Le classement expose ses composantes et sa provenance; il ne prétend pas mesurer la beauté.
8. Les préférences A/B peuvent être conservées localement et remises à zéro.

## Confidentialité et droits

Le manifeste initial classe les droits comme `unknown`, n’infère jamais un auteur ou une œuvre depuis un nom de fichier et exclut ces sources de l’index. Une source devient admissible seulement lorsque :

- ses droits sont `owned` ou `licensed` ;
- son `workId` est confirmé ;
- son split est attribué au niveau de l’œuvre ;
- son mapping des voix est vérifié.

Les chemins absolus ne font pas partie des artefacts partageables. Seuls des noms relatifs, hashes, identifiants et caractéristiques dérivées sont écrits. Les fichiers MIDI et MusicXML sources ne doivent jamais être ajoutés au dépôt par ces outils.

## Outils locaux

Créer un manifeste de révision, sans inclure automatiquement les fichiers :

```text
npx tsx scripts/style-v2/build-manifest.ts <dossier-corpus> <manifest.json>
```

Valider le contrat machine lisible fourni par Axel :

```text
npx tsx scripts/style-v2/validate-profile.ts <axel-style-profile-v2.json>
```

Après révision manuelle des droits, `workId`, splits et mappings, construire l’index :

```text
npx tsx scripts/style-v2/extract-corpus.ts <dossier-corpus> <manifest.json> <index.json>
```

Valider le manifeste et l’index :

```text
npx tsx scripts/style-v2/validate-artifacts.ts <manifest.json> <index.json>
```

## Drapeau de fonctionnalité

Les nouveaux projets reçoivent :

```json
{
  "styleV2": {
    "enabled": false,
    "candidateCount": 3
  }
}
```

Pour activer le moteur, un index validé doit d’abord être enregistré dans IndexedDB `cso-style-v2`, puis son `indexId` doit être associé au projet. Sans index, avec un index vide ou avec le drapeau désactivé, la sortie est exactement celle du V1.

## Tests

`npm run test:style-v2` vérifie notamment :

- le mapping des six voix et les corrections manuelles ;
- le manifeste, les doublons exacts et les fuites entre splits ;
- l’extraction, le Pattern IR et l’index ;
- la recherche déterministe et l’exclusion par `workId` ;
- les transformations à graine fixe ;
- le repli V1 exact ;
- les candidats, contraintes et préférences ;
- la migration sûre des projets.

Ce test est inclus dans `npm run test:all`.
