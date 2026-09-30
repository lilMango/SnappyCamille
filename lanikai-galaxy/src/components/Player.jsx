import { useRef } from 'react';
import Character from './Character';
import { useSphereWalker } from '../hooks/useSphereWalker';

/**
 * Wires the character mesh to the spherical walker. `inputRef` is the shared
 * { forward, strafe, turn } input written by keyboard + touch controls.
 */
export default function Player({ inputRef }) {
  const groupRef = useRef();
  useSphereWalker(groupRef, inputRef);
  return <Character ref={groupRef} />;
}
