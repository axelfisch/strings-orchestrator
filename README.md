# StringsOrchestrator - AiXEL 32-Bar Chamber Strings

An Axel Fisch-inspired modern chamber-string arranger for Violin I, Violin II,
Viola I, Viola II, Cello and Contrabass.

## What it generates

- A complete 32-bar AABA arrangement in major or minor mode.
- Six style profiles: ECM Ballad, Jazz Waltz, Rain of Notes, Pop-Jazz Drive,
  Lilting 6/8, and Distanced Perspectives.
- Extended harmony with 9ths, #11ths, 13ths and altered dominant movement.
- Register-aware sextet writing, active upper lines, cello answers, and bass.
- MIDI, MusicXML and text-chart downloads generated in the browser.

The voicing policy keeps guide tones (3rd and 7th) in the centre, places colour
tones in the upper strings, and uses section-specific textures rather than
repeating static block chords for 32 bars.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

Netlify builds with `npm run build` and publishes `dist`.
