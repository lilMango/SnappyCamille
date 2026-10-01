# Birthday Music World

Interactive pixel-art music room for Camille's 33rd birthday. Walk around a decorated space and discover music playlists in different zones.

## Development

```bash
bun install             # Install dependencies
bun run dev             # Dev server at http://localhost:1337/bday33
bun run build           # Production build to /dist
bun run build:deploy    # Build + copy to ../public/bday33 + FTP deploy
```

## Architecture

**Grid-based game**: 32x32 tile grid at 16px per tile (512px total map). Four quadrants serve as music zones with different playlists.

**Music zones** (quadrant-based):
- Kitchen (top-left): Hawaiian Haven (Kolohe Kai)
- Dining (top-right): Study Sanctuary (JVKE)
- Lounge (bottom-left): R&B Retreat (Snoh Aalegra)
- Counter (bottom-right): Camille's Room (Olivia Dean)

**Spatial audio**: Web Audio API with GainNode for distance-based volume. All 4 tracks play simultaneously; volume fades by player distance. Web Audio API required because iOS ignores `audio.volume`.

## Tech Stack

- React 19 + Vite
- Tailwind CSS via CDN
- Lucide React
