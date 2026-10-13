import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { KAIJU } from '../../constants/kaijuConfig';
import { godzillaSpec, ghidorahSpec } from '../../utils/kaiju/rigParts';
import { assemble, kaijuMaterial, addCenteredOutlines } from '../../utils/kaiju/rigKit';
import { poseGodzilla, poseGhidorah } from '../../utils/kaiju/rigAnim';

// A kaiju's body: the rig spec turned into joint groups (one merged mesh per joint), scaled x10 and
// driven every frame from its controller's `motion` object. The rig never touches the simulation;
// it only reads `ctl.motion` and writes back `ctl.view` (world positions of the jaw/heads, which the
// beam and lightning start from).

const _v = new THREE.Vector3();
const _frustum = new THREE.Frustum();
const _pv = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

export default function KaijuRig({ ctl }) {
  const group = useRef();
  const mid = useRef();
  const flying = ctl.flying;
  // pivot height (authoring units) and the pose when lying down: Godzilla falls on his back, Ghidorah belly-down with a wing splayed
  const COM = flying ? 0 : 3.5;
  const LIE_CENTER = flying ? 0 : 1.3;
  const LIE_X = flying ? 0.5 : -1.45;
  const LIE_Z = flying ? 0.6 : 0;

  const rig = useMemo(() => {
    const material = flying ? kaijuMaterial('#ffd45a', { doubleSided: true }) : kaijuMaterial('#4cc7ff');
    const built = assemble(flying ? ghidorahSpec() : godzillaSpec(), material);
    built.material = material;
    return built;
  }, [flying]);

  useEffect(() => {
    const removeOutlines = addCenteredOutlines(rig.root, flying ? 0.07 : 0.05, 0.9);
    return () => {
      removeOutlines();
      rig.root.traverse((o) => o.isMesh && !o.userData.isOutline && o.geometry.dispose());
      rig.material.dispose();
    };
  }, [rig, flying]);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const m = ctl.motion;
    const t = ctl.time;
    g.position.set(ctl.x, ctl.y, ctl.z);
    g.rotation.y = ctl.yaw + Math.PI; // rigs are authored facing +z; yaw 0 faces -z

    // tumbling (thrown) and lying down (downed) rotate about the centre of mass, which sinks as it lies
    const lie = m.lie;
    mid.current.position.y = COM * (1 - lie) + LIE_CENTER * lie;
    mid.current.rotation.set(m.pitch + lie * LIE_X, 0, m.roll + lie * LIE_Z);

    const u = rig.material.userData.uniforms;
    if (flying) {
      poseGhidorah(rig.joints, m, t);
      u.uCharge.value = m.charge;
      u.uVein.value = Math.max(m.charge * 0.95, m.hit * 0.6);
      u.uEye.value = 0.45 + m.charge * 0.55;
    } else {
      poseGodzilla(rig.joints, m, t);
      u.uCharge.value = m.charge;
      u.uVein.value = Math.max(m.charge * 0.95, m.hit * 0.6);
      u.uEye.value = 0.1 + m.charge * 0.9;
    }

    // the whole kaiju is one cull unit (its joints' bounds are static, so they aren't culled one by one):
    // skip drawing ~60 meshes when it's behind the camera or out of range
    _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    _sphere.center.set(ctl.x, ctl.y + (flying ? 0 : 35), ctl.z);
    _sphere.radius = flying ? 110 : 95;
    g.visible = _frustum.intersectsSphere(_sphere);

    // where the weapon comes from, in world space (read by KaijuPair / Beams one frame later)
    g.updateMatrixWorld(true);
    const view = ctl.view;
    if (flying) {
      for (let k = 0; k < 3; k++) rig.joints[`head${k}`].localToWorld(_v.set(0, 0.1, 1.0)).toArray(view.heads[k]);
    } else {
      rig.joints.jaw.localToWorld(_v.set(0, 0, 1.45));
      view.muzzle.x = _v.x;
      view.muzzle.y = _v.y;
      view.muzzle.z = _v.z;
      view.valid = true;
    }
  });

  return (
    <group ref={group} scale={KAIJU.scale}>
      <group ref={mid} position={[0, COM, 0]}>
        <group position={[0, -COM, 0]}>
          <primitive object={rig.root} />
        </group>
      </group>
    </group>
  );
}
