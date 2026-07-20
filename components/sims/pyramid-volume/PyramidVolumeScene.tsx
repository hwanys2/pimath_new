"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  CUBE_SIDE,
  type ViewMode,
  innerLayerSideLength,
  outerLayerSideLength,
} from "@/lib/pyramid-volume-math";

const COLOR_OUTER = "#7DD3B0";
const COLOR_INNER = "#7EC8F5";
const COLOR_CUBE = "#8B5E3C";
const COLOR_PYRAMID = "#FFD76A";

type SceneProps = {
  n: number;
  viewMode: ViewMode;
  /** How many layers revealed from the bottom (0 = none, n = all). */
  revealedLayers: number;
  showCube: boolean;
  showPyramid: boolean;
  cameraResetKey: number;
};

function CameraReset({ resetKey }: { resetKey: number }) {
  const { camera, controls } = useThree();
  const prev = useRef(resetKey);
  const half = CUBE_SIDE / 2;

  useLayoutEffect(() => {
    if (prev.current === resetKey && resetKey !== 0) return;
    prev.current = resetKey;
    camera.position.set(14, 11, 14);
    camera.lookAt(0, half, 0);
    camera.updateProjectionMatrix();
    const orbit = controls as
      | { target: THREE.Vector3; update: () => void }
      | null
      | undefined;
    if (orbit?.target) {
      orbit.target.set(0, half, 0);
      orbit.update();
    }
  }, [resetKey, camera, controls, half]);

  return null;
}

function LayerGrid({
  sideLength,
  y,
  cell,
  count,
}: {
  sideLength: number;
  y: number;
  cell: number;
  count: number;
}) {
  const points = useMemo(() => {
    const half = sideLength / 2;
    const topY = y + cell * 0.49;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= count; i++) {
      const t = -half + i * cell;
      pts.push([t, topY, -half], [t, topY, half]);
      pts.push([-half, topY, t], [half, topY, t]);
    }
    return pts;
  }, [sideLength, y, cell, count]);

  if (count <= 0 || count > 12) return null;
  return <Line points={points} segments color="rgba(92,64,51,0.3)" lineWidth={1} />;
}

function StairLayer({
  sideLength,
  y,
  height,
  color,
  opacity,
  showGrid,
  cell,
  count,
}: {
  sideLength: number;
  y: number;
  height: number;
  color: string;
  opacity: number;
  showGrid: boolean;
  cell: number;
  count: number;
}) {
  if (sideLength <= 0) return null;
  const h = height * 0.98;

  return (
    <group>
      <mesh position={[0, y, 0]} castShadow receiveShadow>
        <boxGeometry args={[sideLength, h, sideLength]} />
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
      {showGrid ? (
        <LayerGrid sideLength={sideLength} y={y} cell={cell} count={count} />
      ) : null}
    </group>
  );
}

function CubeWire() {
  const s = CUBE_SIDE;
  return (
    <mesh position={[0, s / 2, 0]}>
      <boxGeometry args={[s, s, s]} />
      <meshBasicMaterial visible={false} />
      <Edges color={COLOR_CUBE} />
    </mesh>
  );
}

function PyramidWire() {
  const half = CUBE_SIDE / 2;
  const top = CUBE_SIDE;
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
  const cell = CUBE_SIDE / n;
  const showGrid = n <= 12;
  const layers = [];

  for (let i = 0; i < n; i++) {
    if (i >= revealedLayers) break;
    const y = i * cell + cell / 2;
    const outerSide = outerLayerSideLength(n, i);
    const innerSide = innerLayerSideLength(n, i);
    const outerCount = n - i;
    const innerCount = n - 1 - i;

    if (viewMode === "outer" || viewMode === "both") {
      layers.push(
        <StairLayer
          key={`o-${i}`}
          sideLength={outerSide}
          y={y}
          height={cell}
          color={COLOR_OUTER}
          opacity={viewMode === "both" ? 0.52 : 0.92}
          showGrid={showGrid && viewMode === "outer"}
          cell={cell}
          count={outerCount}
        />,
      );
    }

    if ((viewMode === "inner" || viewMode === "both") && innerSide > 0) {
      layers.push(
        <StairLayer
          key={`i-${i}`}
          sideLength={innerSide}
          y={y}
          height={cell}
          color={COLOR_INNER}
          opacity={viewMode === "both" ? 0.9 : 0.92}
          showGrid={showGrid && viewMode === "inner"}
          cell={cell}
          count={innerCount}
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
  const half = CUBE_SIDE / 2;

  return (
    <>
      <color attach="background" args={["#FEF9F0"]} />
      <ambientLight intensity={0.88} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} castShadow />
      <directionalLight position={[-4, 4, -5]} intensity={0.35} />

      <gridHelper
        args={[16, 32, "#c49a6c", "rgba(196,154,108,0.32)"]}
        position={[0, -0.02, 0]}
      />

      {showCube ? <CubeWire /> : null}
      {showPyramid ? <PyramidWire /> : null}

      <Staircases n={n} viewMode={viewMode} revealedLayers={revealedLayers} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={36}
        target={[0, half, 0]}
      />
      <CameraReset resetKey={cameraResetKey} />
    </>
  );
}

export default function PyramidVolumeScene(props: SceneProps) {
  return (
    <div className="h-full min-h-[320px] w-full overflow-hidden rounded-2xl ring-1 ring-wood/10">
      <Canvas
        camera={{
          position: [14, 11, 14],
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
