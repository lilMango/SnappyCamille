# Music zone audio

Drop looping `.mp3` files here with these exact names (referenced in
`src/constants/zoneConfig.js`). The names are placeholders — rename them there
if you prefer different filenames:

- `lanikai-beach.mp3` (the sand around the spawn)
- `kualoa-valley.mp3` (the valley floor between the two cliff ridges)
- `mokolii-point.mp3` (the stretch of beach facing the Mokoli'i hat islet)
- `ranch-uplands.mp3` (the far side of the globe, around the big peak)

Each plays when you walk into that part of the island, crossfading with
neighbours (equal-power fade based on great-circle distance). Any missing file
simply stays silent — the app won't error (you'll just see a 404 in the console).
