import Anchor from './Anchor';
import { Palm, Ironwood } from './island/Trees';
import Islet from './island/Islets';
import { TREES, ISLETS } from '../constants/islandLayout';

/**
 * Island scenery covering the globe: a palm fringe along the back of Lanikai
 * Beach (leaning out over the water), an ironwood windbreak behind it, a few
 * trees on the Kualoa valley floor and the far-side uplands, and the offshore
 * landmark islets (Mokoli'i + Na Mokulua) as non-walkable backdrop. Placement
 * data is the deterministic scatter in constants/islandLayout.js; everything
 * sits on the analytic terrain via terrain-aware Anchors.
 */
export default function Island() {
  return (
    <group>
      {TREES.map((t, i) => (
        <Anchor key={`tree-${i}`} lat={t.lat} lon={t.lon} yaw={t.yaw}>
          {t.kind === 'palm' ? (
            <Palm scale={t.scale} alt={i % 3 === 0} />
          ) : (
            <Ironwood scale={t.scale} alt={i % 2 === 0} />
          )}
        </Anchor>
      ))}

      {ISLETS.map((s, i) => (
        <Anchor key={`islet-${i}`} lat={s.lat} lon={s.lon}>
          <Islet kind={s.kind} />
        </Anchor>
      ))}
    </group>
  );
}
