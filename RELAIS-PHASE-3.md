# Relais autonome — Circular Strings Orchestrator, Phase 3

Travaille dans :

`/Users/axelfisch/Documents/Codex/2026-09-29/tu-m-aides-migrer-le-contexte/work/hybrid-v2-audit`

Ne commence que lorsque l’utilisateur écrit exactement :

`COMMENCE LA PHASE 3.`

## Contexte à lire avant toute modification

1. `MUSICAL-SOURCE-OF-TRUTH.md`
2. `PHASE-1-AUDIT-ARCHITECTURE.md`
3. `PHASE-2-IMPLEMENTATION.md`
4. `STYLE-V2.md`
5. `/Users/axelfisch/Downloads/axel-style-profile-v2.json`
6. Les modules de `src/features/circular/style-v2/`

## État attendu

- Branche locale : `codex/hybrid-v2-audit`.
- Base historique : `b3cca74f2ef08e81554f79c144e2ed4c429b74d7`.
- Un commit local de sauvegarde de Phase 2 doit être le commit de tête.
- Aucun push, aucune PR et aucun déploiement ne sont autorisés sans nouvelle permission.
- Le checkout principal distinct contient des fichiers non suivis appartenant à l’utilisateur; ne jamais les toucher.

## Première action

```text
git status --short --branch
git log -3 --oneline
npm run test:all
```

Si le portail n’est pas vert, corriger uniquement la régression démontrée avant de poursuivre.

## Mission de Phase 3

1. Revoir tous les nouveaux modules et le flux complet V1/V2.
2. Recalculer entièrement le rapport technique après compilation d’un candidat V2.
3. Vérifier que la mélodie n’est ni forcément au Violon I, ni forcément la voix supérieure, et qu’elle n’est pas transposée automatiquement d’une octave.
4. Vérifier le rôle plus harmonique du Violon II et la possibilité mélodique des deux Altos, du Violoncelle et exceptionnellement de la Contrebasse.
5. Exposer sans refonte graphique un flux minimal pour charger un index validé, activer V2, voir A/B/C, lire les explications et enregistrer une préférence.
6. Ne pas inclure une source dont les droits, le `workId`, le split ou le mapping ne sont pas confirmés.
7. Produire plusieurs candidats sur les mêmes grilles/graines et comparer V1 contre V2.
8. Exécuter `npm run test:all`.
9. Vérifier projets anciens/nouveaux, imports MIDI/MusicXML, transport, persistance et six exports.
10. Générer et inspecter au moins un MIDI et un MusicXML V2; utiliser un lecteur de partition pour le MusicXML si disponible.
11. Préparer un lot A/B réellement écoutable par Axel sans présenter le score technique comme une mesure de beauté.
12. Produire le rapport final avec commandes, fichiers, résultats, limites et état Git exact.

## Garde-fous

- Préserver exactement six voix, 24 familles, cinq gammes, basses slash et maximum deux harmonies par mesure.
- Garder le V2 désactivé par défaut tant que la validation globale n’est pas terminée.
- Ne pas modifier le design au-delà des contrôles fonctionnels minimaux.
- Ne pas installer de modèle audio lourd, louer de GPU, utiliser un service payant ou téléverser le corpus.
- Ne pas inventer des poids stylistiques, droits, auteurs, œuvres ou probabilités.
- Ne pas exécuter `npm audit fix` dans cette mission.
- Ne pas pousser, fusionner, ouvrir de PR ou déployer sans autorisation explicite.

