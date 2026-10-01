# Photos

Reserved for later. v1 of lanikai-galaxy is scenic-only, so nothing in the
scene loads from this folder yet.

If framed photos are added in a future pass (camille-galaxy's `PhotoFrame`
pattern), drop jpg/png files here and reference them by filename from a `PHOTOS`
array in `src/constants/islandLayout.js`; they'd load at runtime from
`import.meta.env.BASE_URL + 'photos/<file>'` so they aren't bundled.
