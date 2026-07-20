"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import {
  type Pt,
  degToRad,
  toLatheProfile,
} from "@/lib/solid-of-revolution-math";

type SceneProps = {
  points: Pt[];
  angleDeg: number;
  wireframe: boolean;
  cameraResetKey: number;
};

function AxisHelper() {
  return (
    <group>
      <Line
        points={[
          [0, -3.2, 0],
          [0, 3.2, 0],
        ]}
        color="#8B5E3C"
        lineWidth={2}
      />
      <mesh position={[0, 3.35, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.12, 0.28, 12]} />
        <meshStandardMaterial color="#8B5E3C" />
      </mesh>
    </group>
  );
}

function ProfileRibbon({ points }: { points: Pt[] }) {
  const linePoints = useMemo(() => {
    const sealed = toLatheProfile(points);
    return sealed.map((p) => [p.x, p.y, 0] as [number, number, number]);
  }, [points]);

  if (linePoints.length < 2) return null;
  return <Line points={linePoints} color="#FFD76A" lineWidth={3} />;
}

function RevolutionSolid({
  points,
  angleDeg,
  wireframe,
}: {
  points: Pt[];
  angleDeg: number;
  wireframe: boolean;
}) {
  const geometry = useMemo(() => {
    const profile = toLatheProfile(points);
    if (profile.length < 3 || angleDeg < 1) return null;
    const vectors = profile.map((p) => new THREE.Vector2(p.x, p.y));
    const segments = Math.max(8, Math.ceil(angleDeg / 6));
    return new THREE.LatheGeometry(
      vectors,
      segments,
      0,
      degToRad(Math.max(1, angleDeg)),
    );
  }, [points, angleDeg]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#7DD3B0"
        roughness={0.45}
        metalness={0.08}
        transparent
        opacity={wireframe ? 0.25 : 0.72}
        side={THREE.DoubleSide}
        wireframe={wireframe}
        depthWrite={!wireframe}
      />
    </mesh>
  );
}

function CameraReset({ resetKey }: { resetKey: number }) {
  const { camera, controls } = useThree();
  const prev = useRef(resetKey);

  useLayoutEffect(() => {
    if (prev.current === resetKey) return;
    prev.current = resetKey;
    camera.position.set(4.2, 2.4, 4.2);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const orbit = controls as
      | { target: THREE.Vector3; update: () => void }
      | null
      | undefined;
    if (orbit?.target) {
      orbit.target.set(0, 0, 0);
      orbit.update();
    }
  }, [resetKey, camera, controls]);

  return null;
}

function SceneContents({
  points,
  angleDeg,
  wireframe,
  cameraResetKey,
}: SceneProps) {
  return (
    <>
      <color attach="background" args={["#FEF9F0"]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[5, 8, 4]} intensity={1.15} castShadow />
      <directionalLight position={[-3, 2, -4]} intensity={0.35} />

      <gridHelper
        args={[10, 20, "#c49a6c", "rgba(196,154,108,0.35)"]}
        position={[0, -3.05, 0]}
      />

      <AxisHelper />
      <ProfileRibbon points={points} />
      <RevolutionSolid
        points={points}
        angleDeg={angleDeg}
        wireframe={wireframe}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2.5}
        maxDistance={14}
        target={[0, 0, 0]}
      />
      <CameraReset resetKey={cameraResetKey} />
    </>
  );
}

export default function RevolutionScene(props: SceneProps) {
  return (
    <div className="h-full min-h-[280px] w-full overflow-hidden rounded-2xl ring-1 ring-wood/10">
      <Canvas
        camera={{ position: [4.2, 2.4, 4.2], fov: 42, near: 0.1, far: 80 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <SceneContents {...props} />
      </Canvas>
    </div>
  );
}
