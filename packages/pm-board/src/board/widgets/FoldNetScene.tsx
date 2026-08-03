"use client";

import { Edges, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  SHAPE_DEFS,
  buildFoldRenderTree,
  connectedComponents,
  componentKey,
  pickFoldRoot,
  worldVertices,
  type FoldRenderTree,
  type FoldTile,
  type HingeOverride,
  type HingeRenderNode,
  type Join,
  type NetFoldState,
} from "../../lib/fold-net";

type Props = {
  tiles: FoldTile[];
  joins: Join[];
  netFolds: NetFoldState[];
  viewportWidth: number;
  viewportHeight: number;
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

function NetComponent({
  tiles,
  joins,
  tileIds,
  unfoldT,
  rootTileId,
  hingeOverrides,
}: {
  tiles: FoldTile[];
  joins: Join[];
  tileIds: string[];
  unfoldT: number;
  rootTileId: string;
  hingeOverrides: HingeOverride[];
}) {
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

  if (renderTree) {
    return <FoldedNet renderTree={renderTree} tiles={tiles} />;
  }

  return (
    <>
      {tileIds.map((id) => {
        const tile = tiles.find((t) => t.id === id);
        return tile ? <FlatTile key={id} tile={tile} /> : null;
      })}
    </>
  );
}

function SceneContent({
  tiles,
  joins,
  netFolds,
}: {
  tiles: FoldTile[];
  joins: Join[];
  netFolds: NetFoldState[];
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
            tiles={tiles}
            joins={joins}
            tileIds={comp}
            unfoldT={nf?.unfoldT ?? 0}
            rootTileId={root}
            hingeOverrides={nf?.hingeOverrides ?? []}
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
      <OrthographicCamera
        ref={cameraRef}
        makeDefault
        position={[camFocus.x, camFocus.y, 1000]}
      />
      <ambientLight intensity={0.7} />
      <directionalLight intensity={0.9} position={[200, 400, 600]} />
      <SceneContent tiles={tiles} joins={joins} netFolds={netFolds} />
    </Canvas>
  );
}
