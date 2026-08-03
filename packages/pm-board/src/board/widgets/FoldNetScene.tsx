"use client";

import { Bounds, Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  SHAPE_DEFS,
  computeTileTransforms,
  netBounds3D,
  type FoldTile,
  type HingeOverride,
  type Join,
  type OrbitState,
} from "../../lib/fold-net";

type Props = {
  tiles: FoldTile[];
  joins: Join[];
  tileIds: string[];
  rootTileId: string;
  unfoldT: number;
  hingeOverrides: HingeOverride[];
  orbit: OrbitState;
  onOrbitChange: (orbit: OrbitState) => void;
  className?: string;
};

function TileMesh({
  tile,
  transform,
}: {
  tile: FoldTile;
  transform: { vertices: { x: number; y: number; z: number }[] };
}) {
  const ref = useRef<THREE.Group>(null);
  const def = SHAPE_DEFS[tile.kind];
  const verts3 = transform.vertices;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(verts3.length * 3);
    for (let i = 0; i < verts3.length; i++) {
      positions[i * 3] = verts3[i].x;
      positions[i * 3 + 1] = verts3[i].y;
      positions[i * 3 + 2] = verts3[i].z;
    }
    const indices: number[] = [];
    for (let i = 1; i < verts3.length - 1; i++) {
      indices.push(0, i, i + 1);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [verts3]);

  useLayoutEffect(() => {
    ref.current?.position.set(0, 0, 0);
  }, []);

  return (
    <group ref={ref}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={def.color}
          side={THREE.DoubleSide}
          roughness={0.5}
          metalness={0.05}
        />
        <Edges color="#1e3a5f" threshold={15} />
      </mesh>
    </group>
  );
}

function NetSolid({
  tiles,
  joins,
  tileIds,
  rootTileId,
  unfoldT,
  hingeOverrides,
}: {
  tiles: FoldTile[];
  joins: Join[];
  tileIds: string[];
  rootTileId: string;
  unfoldT: number;
  hingeOverrides: HingeOverride[];
}) {
  const activeTiles = useMemo(
    () => tiles.filter((t) => tileIds.includes(t.id)),
    [tiles, tileIds],
  );
  const transforms = useMemo(
    () =>
      computeTileTransforms(
        tiles,
        joins,
        rootTileId,
        unfoldT,
        hingeOverrides,
        tileIds,
      ),
    [tiles, joins, rootTileId, unfoldT, hingeOverrides, tileIds],
  );

  return (
    <group>
      {activeTiles.map((tile) => {
        const tr = transforms.get(tile.id);
        if (!tr) return null;
        return <TileMesh key={tile.id} tile={tile} transform={tr} />;
      })}
    </group>
  );
}

export default function FoldNetScene({
  tiles,
  joins,
  tileIds,
  rootTileId,
  unfoldT,
  hingeOverrides,
  orbit,
  onOrbitChange,
  className,
}: Props) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const initialized = useRef(false);

  const activeTiles = useMemo(
    () => tiles.filter((t) => tileIds.includes(t.id)),
    [tiles, tileIds],
  );

  const transforms = useMemo(
    () =>
      computeTileTransforms(
        tiles,
        joins,
        rootTileId,
        unfoldT,
        hingeOverrides,
        tileIds,
      ),
    [tiles, joins, rootTileId, unfoldT, hingeOverrides, tileIds],
  );

  const bounds = useMemo(() => netBounds3D(transforms), [transforms]);

  const center = useMemo(
    () => ({
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    }),
    [bounds],
  );

  const cameraPos = useMemo(() => {
    const span = Math.max(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ,
      120,
    );
    const dist = span * 1.8;
    const az = orbit.azimuth;
    const pol = orbit.polar;
    return [
      center.x + dist * Math.sin(pol) * Math.cos(az),
      center.y + dist * Math.cos(pol),
      center.z + dist * Math.sin(pol) * Math.sin(az),
    ] as [number, number, number];
  }, [bounds, center, orbit]);

  useLayoutEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl || initialized.current) return;
    ctrl.target.set(center.x, center.y, center.z);
    ctrl.setAzimuthalAngle(orbit.azimuth);
    ctrl.setPolarAngle(orbit.polar);
    initialized.current = true;
  }, [center, orbit]);

  return (
    <Canvas
      className={className}
      camera={{ position: cameraPos, fov: 42, near: 1, far: 5000 }}
      shadows
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight
        castShadow
        intensity={1.0}
        position={[center.x + 200, center.y + 400, center.z + 200]}
      />
      <group position={[-center.x, -center.y, -center.z]}>
        <Bounds fit clip observe margin={1.2}>
          <NetSolid
            tiles={tiles}
            joins={joins}
            tileIds={tileIds}
            rootTileId={rootTileId}
            unfoldT={unfoldT}
            hingeOverrides={hingeOverrides}
          />
        </Bounds>
      </group>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        target={[0, 0, 0]}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI - 0.15}
        enabled={unfoldT > 0.02}
        onEnd={() => {
          const ctrl = controlsRef.current;
          if (!ctrl) return;
          onOrbitChange({
            azimuth: ctrl.getAzimuthalAngle(),
            polar: ctrl.getPolarAngle(),
          });
        }}
      />
    </Canvas>
  );
}
