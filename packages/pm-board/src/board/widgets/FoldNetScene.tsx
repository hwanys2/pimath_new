"use client";

import { Edges, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  SHAPE_DEFS,
  buildFoldRenderTree,
  flatNetBounds2D,
  worldVertices,
  type FoldRenderTree,
  type FoldTile,
  type HingeOverride,
  type HingeRenderNode,
  type Join,
  type OrbitState,
} from "../../lib/fold-net";

type Props = {
  tiles: FoldTile[];
  joins: Join[];
  foldTileIds: string[];
  rootTileId: string;
  unfoldT: number;
  hingeOverrides: HingeOverride[];
  orbit: OrbitState;
  onOrbitChange: (orbit: OrbitState) => void;
  className?: string;
};

function TileMesh({
  tile,
  vertices,
}: {
  tile: FoldTile;
  vertices: [number, number, number][];
}) {
  const def = SHAPE_DEFS[tile.kind];

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(vertices.length * 3);
    for (let i = 0; i < vertices.length; i++) {
      positions[i * 3] = vertices[i][0];
      positions[i * 3 + 1] = vertices[i][1];
      positions[i * 3 + 2] = vertices[i][2];
    }
    const indices: number[] = [];
    for (let i = 1; i < vertices.length - 1; i++) {
      indices.push(0, i, i + 1);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [vertices]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={def.color}
        side={THREE.DoubleSide}
        roughness={0.5}
        metalness={0.05}
      />
      <Edges color="#1e3a5f" threshold={15} />
    </mesh>
  );
}

function HingeSubtree({
  hinge,
  tiles,
}: {
  hinge: HingeRenderNode;
  tiles: FoldTile[];
}) {
  const tile = tiles.find((t) => t.id === hinge.tileId);
  if (!tile) return null;

  const quat = useMemo(() => {
    const axis = new THREE.Vector3(hinge.axis[0], hinge.axis[1], hinge.axis[2]);
    if (axis.lengthSq() < 1e-12) return new THREE.Quaternion();
    axis.normalize();
    return new THREE.Quaternion().setFromAxisAngle(axis, hinge.angle);
  }, [hinge.axis, hinge.angle]);

  return (
    <group position={[hinge.pivot[0], hinge.pivot[1], hinge.pivot[2]]}>
      <group quaternion={quat}>
        <TileMesh tile={tile} vertices={hinge.vertices} />
        {hinge.children.map((child) => (
          <HingeSubtree key={child.joinId} hinge={child} tiles={tiles} />
        ))}
      </group>
    </group>
  );
}

function FoldedNet({
  renderTree,
  tiles,
}: {
  renderTree: FoldRenderTree;
  tiles: FoldTile[];
}) {
  const rootTile = tiles.find((t) => t.id === renderTree.rootTileId);
  if (!rootTile) return null;

  return (
    <group>
      <TileMesh tile={rootTile} vertices={renderTree.rootVertices} />
      {renderTree.hinges.map((h) => (
        <HingeSubtree key={h.joinId} hinge={h} tiles={tiles} />
      ))}
    </group>
  );
}

function FlatTile({ tile }: { tile: FoldTile }) {
  const verts = useMemo(
    () =>
      worldVertices(tile).map(
        (v) => [v.x, -v.y, 0] as [number, number, number],
      ),
    [tile],
  );
  return <TileMesh tile={tile} vertices={verts} />;
}

function SceneContent({
  tiles,
  joins,
  foldTileIds,
  rootTileId,
  unfoldT,
  hingeOverrides,
}: {
  tiles: FoldTile[];
  joins: Join[];
  foldTileIds: string[];
  rootTileId: string;
  unfoldT: number;
  hingeOverrides: HingeOverride[];
}) {
  const foldSet = useMemo(() => new Set(foldTileIds), [foldTileIds]);

  const renderTree = useMemo(
    () =>
      foldTileIds.length >= 2
        ? buildFoldRenderTree(
            tiles,
            joins,
            rootTileId,
            unfoldT,
            hingeOverrides,
            foldTileIds,
          )
        : null,
    [tiles, joins, rootTileId, unfoldT, hingeOverrides, foldTileIds],
  );

  const isolatedTiles = useMemo(
    () => tiles.filter((t) => !foldSet.has(t.id)),
    [tiles, foldSet],
  );

  return (
    <group>
      {renderTree ? (
        <FoldedNet renderTree={renderTree} tiles={tiles} />
      ) : (
        foldTileIds.map((id) => {
          const tile = tiles.find((t) => t.id === id);
          return tile ? <FlatTile key={id} tile={tile} /> : null;
        })
      )}
      {isolatedTiles.map((t) => (
        <FlatTile key={t.id} tile={t} />
      ))}
    </group>
  );
}

export default function FoldNetScene({
  tiles,
  joins,
  foldTileIds,
  rootTileId,
  unfoldT,
  hingeOverrides,
  orbit,
  onOrbitChange,
  className,
}: Props) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);

  const bounds = useMemo(
    () => flatNetBounds2D(tiles, tiles.map((t) => t.id)),
    [tiles],
  );

  const center = useMemo(
    () => ({
      x: (bounds.minX + bounds.maxX) / 2,
      y: -((bounds.minY + bounds.maxY) / 2),
      z: 0,
    }),
    [bounds],
  );

  const span = useMemo(
    () =>
      Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 120),
    [bounds],
  );

  const orthoHalf = span * 0.65;

  useLayoutEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.left = -orthoHalf;
    cam.right = orthoHalf;
    cam.top = orthoHalf * 0.75;
    cam.bottom = -orthoHalf * 0.75;
    cam.near = -2000;
    cam.far = 2000;
    cam.position.set(center.x, center.y, 500);
    cam.lookAt(center.x, center.y, 0);
    cam.updateProjectionMatrix();
  }, [center, orthoHalf]);

  useLayoutEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    ctrl.target.set(center.x, center.y, 0);
    if (unfoldT > 0.05) {
      ctrl.setAzimuthalAngle(orbit.azimuth);
      ctrl.setPolarAngle(orbit.polar);
    }
  }, [center, orbit, unfoldT]);

  return (
    <Canvas
      className={className}
      shadows
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <OrthographicCamera
        ref={cameraRef}
        makeDefault
        position={[center.x, center.y, 500]}
        zoom={1}
      />
      <ambientLight intensity={0.65} />
      <directionalLight
        castShadow
        intensity={1.0}
        position={[center.x + 200, center.y + 400, 600]}
      />
      <group position={[center.x, center.y, 0]}>
        <SceneContent
            tiles={tiles}
            joins={joins}
            foldTileIds={foldTileIds}
            rootTileId={rootTileId}
            unfoldT={unfoldT}
            hingeOverrides={hingeOverrides}
          />
      </group>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        target={[center.x, center.y, 0]}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI - 0.15}
        enabled={unfoldT > 0.05}
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
