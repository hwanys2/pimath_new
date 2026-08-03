"use client";

import { Edges, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import {
  SHAPE_DEFS,
  buildFoldRenderTree,
  connectedComponents,
  componentKey,
  flatNetBounds2D,
  pickFoldRoot,
  worldVertices,
  type FoldRenderTree,
  type FoldTile,
  type HingeOverride,
  type HingeRenderNode,
  type Join,
  type NetFoldState,
  type OrbitState,
} from "../../lib/fold-net";

type Props = {
  tiles: FoldTile[];
  joins: Join[];
  netFolds: NetFoldState[];
  viewportWidth: number;
  viewportHeight: number;
  orbitEnabled: boolean;
  orbit: OrbitState;
  orbitTargetKey: string | null;
  onOrbitChange: (orbit: OrbitState) => void;
  className?: string;
};

function canvasToSceneY(y: number): number {
  return -y;
}

function netCenter3D(
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

function orbitToQuaternion(orbit: OrbitState): THREE.Quaternion {
  const euler = new THREE.Euler(
    orbit.polar - Math.PI / 2,
    orbit.azimuth,
    0,
    "YXZ",
  );
  return new THREE.Quaternion().setFromEuler(euler);
}

function TileMesh({
  tile,
  vertices,
  folded = false,
}: {
  tile: FoldTile;
  vertices: [number, number, number][];
  folded?: boolean;
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
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
      <Edges
        color={folded ? "#0f172a" : "#1e3a5f"}
        threshold={1}
      />
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
        <TileMesh tile={tile} vertices={hinge.vertices} folded />
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
      <TileMesh tile={rootTile} vertices={renderTree.rootVertices} folded />
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

function OrbitPivot({
  center,
  orbit,
  children,
}: {
  center: { x: number; y: number; z: number };
  orbit: OrbitState;
  children: ReactNode;
}) {
  const quat = useMemo(() => orbitToQuaternion(orbit), [orbit]);
  return (
    <group position={[center.x, center.y, center.z]}>
      <group quaternion={quat}>
        <group position={[-center.x, -center.y, -center.z]}>{children}</group>
      </group>
    </group>
  );
}

function NetComponent({
  tiles,
  joins,
  tileIds,
  unfoldT,
  rootTileId,
  hingeOverrides,
  compKey,
  orbit,
}: {
  tiles: FoldTile[];
  joins: Join[];
  tileIds: string[];
  unfoldT: number;
  rootTileId: string;
  hingeOverrides: HingeOverride[];
  compKey: string;
  orbit: OrbitState;
}) {
  const center = useMemo(
    () => netCenter3D(tiles, tileIds),
    [tiles, tileIds],
  );

  const renderTree = useMemo(
    () =>
      tileIds.length >= 2 && unfoldT > 0.005
        ? buildFoldRenderTree(
            tiles,
            joins,
            rootTileId,
            unfoldT,
            hingeOverrides,
            tileIds,
          )
        : null,
    [tiles, joins, rootTileId, unfoldT, hingeOverrides, tileIds],
  );

  if (!renderTree) {
    return (
      <>
        {tileIds.map((id) => {
          const tile = tiles.find((t) => t.id === id);
          return tile ? <FlatTile key={id} tile={tile} /> : null;
        })}
      </>
    );
  }

  const content = <FoldedNet renderTree={renderTree} tiles={tiles} />;

  if (unfoldT > 0.05) {
    return (
      <OrbitPivot center={center} orbit={orbit}>
        {content}
      </OrbitPivot>
    );
  }

  return <group key={compKey}>{content}</group>;
}

function SceneContent({
  tiles,
  joins,
  netFolds,
  orbit,
  orbitTargetKey,
}: {
  tiles: FoldTile[];
  joins: Join[];
  netFolds: NetFoldState[];
  orbit: OrbitState;
  orbitTargetKey: string | null;
}) {
  const components = useMemo(
    () => connectedComponents(tiles, joins),
    [tiles, joins],
  );

  const foldByKey = useMemo(() => {
    const map = new Map<string, NetFoldState>();
    for (const nf of netFolds) {
      map.set(nf.key, nf);
    }
    return map;
  }, [netFolds]);

  return (
    <group>
      {components.map((comp) => {
        const key = componentKey(comp);
        const nf = foldByKey.get(key);
        const root =
          nf?.foldRootId && comp.includes(nf.foldRootId)
            ? nf.foldRootId
            : pickFoldRoot(tiles, comp) ?? comp[0];
        return (
          <NetComponent
            key={key}
            compKey={key}
            tiles={tiles}
            joins={joins}
            tileIds={comp}
            unfoldT={nf?.unfoldT ?? 0}
            rootTileId={root}
            hingeOverrides={nf?.hingeOverrides ?? []}
            orbit={nf?.orbit ?? orbit}
          />
        );
      })}
    </group>
  );
}

export default function FoldNetScene({
  tiles,
  joins,
  netFolds,
  viewportWidth,
  viewportHeight,
  orbitEnabled,
  orbit,
  orbitTargetKey,
  onOrbitChange: _onOrbitChange,
  className,
}: Props) {
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);

  const camFocus = useMemo(
    () => ({
      x: viewportWidth / 2,
      y: -viewportHeight / 2,
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

  return (
    <Canvas
      className={className}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
      orthographic
    >
      <OrthographicCamera ref={cameraRef} makeDefault />
      <ambientLight intensity={0.7} />
      <directionalLight intensity={0.9} position={[200, 400, 600]} />
      <SceneContent
        tiles={tiles}
        joins={joins}
        netFolds={netFolds}
        orbit={orbit}
        orbitTargetKey={orbitEnabled ? orbitTargetKey : null}
      />
    </Canvas>
  );
}
