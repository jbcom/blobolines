import { palette } from "@/styles/tokens";

/**
 * Scene lighting for the dreamy painterly look from the cover art: warm key light
 * (cream sun shafts), cool ambient fill (blue-teal sky bounce), and a soft rim.
 * Real final lighting — not a placeholder.
 */
export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.9} color={palette.sky.top} />
      <hemisphereLight
        intensity={1.1}
        color={palette.sky.top}
        groundColor={palette.sky.deep}
      />
      <directionalLight
        position={[6, 14, 8]}
        intensity={2.2}
        color={palette.cream}
        castShadow
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.6} color={palette.sky.mid} />
    </>
  );
}
