"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { ViewMode } from "@/lib/pyramid-volume-math";

const COLOR_OUTER = "#7DD3B0";
const COLOR_INNER = "#7EC8F5";
const COLOR_CUBE = "#8B5E3C";
const COLOR_PYRAMID = "#FFD76A";

type SceneProps = {
  n: number;
  viewMode: ViewMode;
  /** How many layers revealed from the bottom (0 = none, n = all for outer). */
  revealedLayers: number;
  showCube: boolean;
  showPyramid: boolean;
  cameraResetKey: number;
};

function CameraReset({ resetKey, n }: { resetKey: number; n: number }) {
  const { camera, controls } = useThree();
  const prev = useRef(resetKey);

  useLayoutEffect(() => {
    if (prev.current === resetKey && resetKey !== 0) return;
    prev.current = resetKey;
    const dist = Math.max(6, n * 1.55);
    camera.position.set(dist * 0.95, dist * 0.72, dist * 0.95);
    camera.lookAt(0, n / 2, 0);
    camera.updateProjectionMatrix();
    const orbit = controls as
      | { target: THREE.Vector3; update: () => void }
      | null
      | undefined;
    if (orbit?.target) {
      orbit.target.set(0, n / 2, 0);
      orbit.update();
    }
  }, [resetKey, n, camera, controls]);

  return null;
}

function LayerGrid({ side, y, unit }: { side: number; y: number; unit: number }) {
  const points = useMemo(() => {
    const w = side * unit;
    const half = w / 2;
    const topY = y + unit * 0.49;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= side; i++) {
      const t = -half + i * unit;
      pts.push([t, topY, -half], [t, topY, half]);
      pts.push([-half, topY, t], [half, topY, t]);
    }
    return pts;
  }, [side, y, unit]);

  if (side <= 0 || side > 12) return null;
  return <Line points={points} segments color="rgba(92,64,51,0.3)" lineWidth={1} />;
}

function StairLayer({
  side,
  y,
  color,
  opacity,
  showGrid,
  unit,
}: {
  side: number;
  y: number;
  color: string;
  opacity: number;
  showGrid: boolean;
  unit: number;
}) {
  if (side <= 0) return null;
  const w = side * unit;
  const h = unit * 0.98;

  return (
    <group>
      <mesh position={[0, y, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, w]} />
        <meshStandardMaterial
          color={color}
          roughness={0.42}
          metalness={0.06}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={opacity >= 0.95}
        />
        <Edges threshold={15} color="rgba(92,64,51,0.38)" />
      </mesh>
      {showGrid ? <LayerGrid side={side} y={y} unit={unit} /> : null}
    </group>
  );
}

function CubeWire({ n, unit }: { n: number; unit: number }) {
  const s = n * unit;
  return (
    <mesh position={[0, (n * unit) / 2, 0]}>
      <boxGeometry args={[s, s, s]} />
      <meshBasicMaterial visible={false} />
      <Edges color={COLOR_CUBE} />
    </mesh>
  );
}

function PyramidWire({ n, unit }: { n: number; unit: number }) {
  const half = (n * unit) / 2;
  const top = n * unit;
  const points = useMemo((): [number, number, number][] => {
    const apex: [number, number, number] = [0, top, 0];
    const b0: [number, number, number] = [-half, 0, -half];
    const b1: [number, number, number] = [half, 0, -half];
    const b2: [number, number, number] = [half, 0, half];
    const b3: [number, number, number] = [-half, 0, half];
    return [
      apex,
      b0,
      apex,
      b1,
      apex,
      b2,
      apex,
      b3,
      b0,
      b1,
      b1,
      b2,
      b2,
      b3,
      b3,
      b0,
    ];
  }, [half, top]);

  return <Line points={points} segments color={COLOR_PYRAMID} lineWidth={2} />;
}

function Staircases({
  n,
  viewMode,
  revealedLayers,
}: {
  n: number;
  viewMode: ViewMode;
  revealedLayers: number;
}) {
  const unit = 1;
  const showGrid = n <= 12;
  const layers = [];

  for (let i = 0; i < n; i++) {
    if (i >= revealedLayers) break;
    const y = i * unit + unit / 2;
    const outerSide = n - i;
    const innerSide = n - 1 - i;

    if (viewMode === "outer" || viewMode === "both") {
      layers.push(
        <StairLayer
          key={`o-${i}`}
          side={outerSide}
          y={y}
          color={COLOR_OUTER}
          opacity={viewMode === "both" ? 0.52 : 0.92}
          showGrid={showGrid && viewMode === "outer"}
          unit={unit}
        />,
      );
    }

    if ((viewMode === "inner" || viewMode === "both") && innerSide > 0) {
      layers.push(
        <StairLayer
          key={`i-${i}`}
          side={innerSide}
          y={y}
          color={COLOR_INNER}
          opacity={viewMode === "both" ? 0.9 : 0.92}
          showGrid={showGrid && viewMode === "inner"}
          unit={unit}
        />,
      );
    }
  }

  return <group>{layers}</group>;
}

function SceneContents({
  n,
  viewMode,
  revealedLayers,
  showCube,
  showPyramid,
  cameraResetKey,
}: SceneProps) {
  const unit = 1;
  const gridSize = Math.max(8, n + 4);

  return (
    <>
      <color attach="background" args={["#FEF9F0"]} />
      <ambientLight intensity={0.88} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} castShadow />
      <directionalLight position={[-4, 4, -5]} intensity={0.35} />

      <gridHelper
        args={[gridSize, gridSize * 2, "#c49a6c", "rgba(196,154,108,0.32)"]}
        position={[0, -0.02, 0]}
      />

      {showCube ? <CubeWire n={n} unit={unit} /> : null}
      {showPyramid ? <PyramidWire n={n} unit={unit} /> : null}

      <Staircases n={n} viewMode={viewMode} revealedLayers={revealedLayers} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={Math.max(4, n * 0.6)}
        maxDistance={Math.max(18, n * 3.2)}
        target={[0, n / 2, 0]}
      />
      <CameraReset resetKey={cameraResetKey} n={n} />
    </>
  );
}

export default function PyramidVolumeScene(props: SceneProps) {
  return (
    <div className="h-full min-h-[320px] w-full overflow-hidden rounded-2xl ring-1 ring-wood/10">
      <Canvas
        camera={{
          position: [12, 9, 12],
          fov: 42,
          near: 0.1,
          far: 200,
        }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <SceneContents {...props} />
      </Canvas>
    </div>
  );
}
