// Phase 0 pipeline probe: proves a *module* worker loads under the /godzilla-verse
// base path on the deployed host, and that transferable ArrayBuffers round-trip —
// the exact mechanism the mesher (Phase 2) and city generator (Phase 4) rely on.
// Replaced by meshWorker.js once real meshing lands.

self.onmessage = (e) => {
  const { id, buffer } = e.data;
  const bytes = new Uint8Array(buffer);
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) sum = (sum + bytes[i]) | 0;
  // Echo the buffer back as a transferable (ownership moves, no copy).
  self.postMessage({ id, sum, length: bytes.length, buffer }, [buffer]);
};
