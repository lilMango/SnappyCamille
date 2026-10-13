import { meshSection } from './mesher';

// Mesh worker. Stateless: the main thread is authoritative for voxel data and sends a
// padded copy of one section; this returns the packed geometry. Everything crosses the
// boundary as transferable ArrayBuffers (no copies, and no SharedArrayBuffer — an FTP
// static host cannot send the COOP/COEP headers that needs).
//
// in:  { id, key, pad: ArrayBuffer }
// out: { id, key, opaque: MeshPart|null, cutout: MeshPart|null }

self.onmessage = (e) => {
  const { id, key, pad } = e.data;
  const { opaque, cutout } = meshSection(new Uint8Array(pad));

  const transfer = [];
  for (const part of [opaque, cutout]) {
    if (!part) continue;
    transfer.push(part.position.buffer, part.uv.buffer, part.color.buffer, part.index.buffer);
  }
  self.postMessage({ id, key, opaque, cutout }, transfer);
};
