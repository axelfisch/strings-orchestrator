# Musical Source of Truth — Circular Strings Orchestrator

## Priority

1. Axel's direct requests in the working conversation.
2. `Axel-Fisch-Resume-Complet-Metadonnees.pdf` for documented musical facts.
3. Measured corpus statistics when their sample and method are named.
4. `AIXEL_MASTER_MODEL_2025_FULL.json` for historical names and supporting metadata.
5. Legacy code only as migration input, never as a second musical authority.

## Canonical ensemble

The six voices are Violin I, Violin II, Viola I, Viola II, Cello, and Contrabass. Piano is optional and is not one of the six voices. Canonical mode keeps Violin I as the primary melody carrier and Cello as secondary. Axel's direct extension adds controlled, manual, and import-preserving melody assignment to Violin II, both violas, Cello, and exceptionally Contrabass.

## Canonical harmonic core

The chamber language has exactly 24 ordered families. Their identifiers and interval formulas live only in `src/features/circular/types.ts` and `src/features/circular/theory.ts`. Historical spellings such as `11+`, `5+`, `7+`, and `9+` are import aliases. Pop-soft `sus2` and `sus4`, plus `min7(#5)`, are extensions outside the canonical 24.

The master JSON contains all 24 historical names in all 12 root groups, but its note arrays are not executable truth: an automated pitch-class audit found inconsistent transpositions. The engine therefore transposes one explicit interval table. In particular, the semantic label `7(#9#5)` uses a raised ninth and raised fifth even where a historical note list contains a natural ninth.

## Scales

There are exactly five documented scales: major, melodic minor, harmonic minor, diminished, and whole-tone. No chromatic sixth scale is created. Scale formulas are stored once in `theory.ts` and are transposed from the current harmonic center.

## Harmonic behavior

Generated progressions must contain Approach, Tension, and Resolution functions. A substituted dominant keeps the original functional bass after the slash when the method calls for it. Slash bass is never flattened into an extension or silently removed. One or two timed harmony events may occupy a bar.

## Measured central registers

The measured centers are stylistic zones, not absolute instrument limits:

- Violin I: MIDI 67–81
- Violin II: MIDI 63–76
- Viola I: MIDI 60–71
- Viola II: MIDI 58–69
- Cello: MIDI 44–58
- Contrabass: MIDI 33–46

The engine may leave these zones briefly for anacrusis, climax, cadence, transfer, bridge, or section contrast, but it must report every sustained departure.

## Descriptive measurements

Median adjacent spacing near five semitones, roughly one quarter of the time without all six voices, and about 1.8% observed fifth/octave parallels are corpus descriptions, not targets to force. Unmeasured percentages such as 60% major, 50% slow, or 30% six-violin instrumentation are not generation rules.

## Validation rule

Compilation or a visible button is not proof. Harmony, register, import, playback, persistence, and export claims require inspection of the produced musical events and files. Beauty remains an artistic listening decision by Axel; automated scores describe technical anomalies only.
