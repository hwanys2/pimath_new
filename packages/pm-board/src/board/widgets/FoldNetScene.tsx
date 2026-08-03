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
  viewportWidth: number;
  viewportHeight: number;
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
    <mesh geometry={geometry}>
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

/** Map canvas pixel coords (y-down) to Three.js scene coords (y-up). */
export function canvasToSceneY(y: number): number {
  return -y;
}

export function netCenter3D(
  tiles: FoldTile[],
  tileIds: string[],
): { x: number; y: number; z: number } {
  const bounds = flatNetBounds2D(tiles, tileIds);
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: canvasToSceneY((bounds.minY + bounds.maxY) / 2),
    z: 0,
  };
}

export default function FoldNetScene({
  tiles,
  joins,
  foldTileIds,
  rootTileId,
  unfoldT,
  hingeOverrides,
  orbit,
  viewportWidth,
  viewportHeight,
  onOrbitChange,
  className,
}: Props) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);

  const netCenter = useMemo(
    () =>
      netCenter3D(
        tiles,
        foldTileIds.length > 0 ? foldTileIds : tiles.map((t) => t.id),
      ),
    [tiles, foldTileIds],
  );

  const camFocus = useMemo(
    () => ({
      x: viewportWidth / 2,
      y: canvasToSceneY(viewportHeight / 2),
      z: 0,
    }),
    [viewportWidth, viewportHeight],
  );

  useLayoutEffect(() => {
    const cam = cameraRef.current;
    if (!cam || viewportWidth < 1 || viewportHeight < 1) return;
    cam.left = 0;
    cam.right = viewportWidth;
    cam.top = 0;
    cam.bottom = -viewportHeight;
    cam.near = -5000;
    cam.far = 5000;
    cam.position.set(camFocus.x, camFocus.y, 1000);
    cam.lookAt(camFocus.x, camFocus.y, 0);
    cam.updateProjectionMatrix();
  }, [viewportWidth, viewportHeight, camFocus]);

  useLayoutEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const target = unfoldT > 0.05 ? netCenter : camFocus;
    ctrl.target.set(target.x, target.y, target.z);
    if (unfoldT > 0.05) {
      ctrl.setAzimuthalAngle(orbit.azimuth);
      ctrl.setPolarAngle(orbit.polar);
    }
  }, [netCenter, camFocus, orbit, unfoldT]);

  return (
    <Canvas
      className={className}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
      orthographic
    >
      <OrthographicCamera
        ref={cameraRef}
        makeDefault
        position={[camFocus.x, camFocus.y, 1000]}
      />
      <ambientLight intensity={0.7} />
      <directionalLight intensity={0.9} position={[200, 400, 600]} />
      <SceneContent
        tiles={tiles}
        joins={joins}
        foldTileIds={foldTileIds}
        rootTileId={rootTileId}
        unfoldT={unfoldT}
        hingeOverrides={hingeOverrides}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        target={[camFocus.x, camFocus.y, 0]}
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
