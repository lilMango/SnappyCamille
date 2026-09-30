import * as THREE from 'three';

export const Y_AXIS = new THREE.Vector3(0, 1, 0);
export const X_AXIS = new THREE.Vector3(1, 0, 0);

/**
 * lat/lon (degrees) on a sphere of `radius` -> world position Vector3.
 * lat in [-90, 90] (0 = equator), lon in [-180, 180].
 */
export function latLonToVec3(latDeg, lonDeg, radius = 1) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const cosLat = Math.cos(lat);
  return new THREE.Vector3(
    radius * cosLat * Math.cos(lon),
    radius * Math.sin(lat),
    radius * cosLat * Math.sin(lon)
  );
}

/** Unit surface normal ("up") at a lat/lon. */
export function latLonToDir(latDeg, lonDeg) {
  return latLonToVec3(latDeg, lonDeg, 1).normalize();
}

/**
 * Build an orthonormal tangent frame at a point whose surface normal is `up`.
 * Returns { east, north } spanning the tangent plane. Falls back near the poles
 * to avoid a degenerate cross product.
 */
export function tangentFrame(up, outEast = new THREE.Vector3(), outNorth = new THREE.Vector3()) {
  const ref = Math.abs(up.dot(Y_AXIS)) > 0.999 ? X_AXIS : Y_AXIS;
  outEast.crossVectors(ref, up).normalize();
  outNorth.crossVectors(up, outEast).normalize();
  return { east: outEast, north: outNorth };
}

/** Great-circle angular distance (radians) between two unit vectors. */
export function angularDistance(a, b) {
  return Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
}

/** Unit direction -> { lat, lon } in degrees. */
export function dirToLatLon(dir) {
  return {
    lat: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1))),
    lon: THREE.MathUtils.radToDeg(Math.atan2(dir.z, dir.x)),
  };
}

/**
 * Yaw (degrees) at `fromDir` so that an Anchor's local +Z points along the
 * great circle toward `toDir`. Matches orientOnSurface's basis:
 * +Z(yaw) = cos(yaw)*north - sin(yaw)*east.
 */
export function yawToward(fromDir, toDir) {
  const e = new THREE.Vector3();
  const n = new THREE.Vector3();
  tangentFrame(fromDir, e, n);
  const f = toDir.clone().addScaledVector(fromDir, -toDir.dot(fromDir)); // tangent component
  if (f.lengthSq() < 1e-8) return 0;
  f.normalize();
  return THREE.MathUtils.radToDeg(Math.atan2(-f.dot(e), f.dot(n)));
}

/**
 * Move `dir` along its surface by `angle` radians toward the given tangent
 * direction ('right' = up × forward, etc.). Returns a new unit vector.
 */
export function moveAlong(dir, tangent, angle) {
  return dir
    .clone()
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(tangent, Math.sin(angle))
    .normalize();
}

const _e = new THREE.Vector3();
const _n = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _basis = new THREE.Matrix4();

/**
 * Quaternion orienting an object to STAND on the surface (local +Y -> `up`) with
 * its local +Z ("forward") pointing along geographic north rotated by `yaw`
 * about the up axis. This gives a consistent basis shared by the character
 * (heading) and every villa Anchor (yaw), so authored +Z = north(+yaw) always.
 */
export function orientOnSurface(up, yaw, out = new THREE.Quaternion()) {
  tangentFrame(up, _e, _n);
  _fwd.copy(_n).applyAxisAngle(up, yaw).normalize(); // local +Z
  _right.crossVectors(up, _fwd).normalize(); // local +X = up × forward (right-handed)
  _basis.makeBasis(_right, up, _fwd);
  return out.setFromRotationMatrix(_basis);
}

// Back-compat alias.
export const surfaceQuaternion = orientOnSurface;

/**
 * Position + orient an Object3D so it stands on the sphere at lat/lon, facing
 * `yawDeg` around its local up. `radius` is distance from center to the object's origin.
 */
export function anchorOnSphere(obj, latDeg, lonDeg, radius, yawDeg = 0) {
  const up = latLonToDir(latDeg, lonDeg);
  obj.position.copy(up).multiplyScalar(radius);
  surfaceQuaternion(up, THREE.MathUtils.degToRad(yawDeg), obj.quaternion);
}
