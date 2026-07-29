"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { FaceNode, SolidNetTree } from "../../lib/solid-nets/types";
import { hingeAngleRad } from "../../lib/solid-nets/fold-math";

const FACE_COLOR = "#7ec8f5";
const EDGE_COLOR = "#1e3a5f";

type OrbitState = { azimuth: number; polar: number };

type SceneProps = {
  tree: SolidNetTree;
  unfoldT: number;
  orbit: OrbitState;
  onOrbitChange: (orbit: OrbitState) => void;
  className?: string;
};

function FaceMesh({ node }: { node: FaceNode }) {
  const geometry = useMemo(() => {
    if (node.shape === "rect") {
      const [w, d] = node.size;
      return new THREE.PlaneGeometry(w, d);
    }
    const verts = node.vertices ?? [];
    const geo = new THREE.BufferGeometry();
    if (verts.length >= 3) {
      const positions = new Float32Array([
        verts[0][0],
        verts[0][1],
        verts[0][2],
        verts[1][0],
        verts[1][1],
        verts[1][2],
        verts[2][0],
        verts[2][1],
        verts[2][2],
      ]);
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.computeVertexNormals();
    }
    return geo;
  }, [node]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial
        color={FACE_COLOR}
        side={THREE.DoubleSide}
        roughness={0.55}
        metalness={0.05}
      />
      <Edges color={EDGE_COLOR} threshold={15} />
    </mesh>
  );
}

function HingeChild({
  child,
  unfoldT,
}: {
  child: FaceNode;
  unfoldT: number;
}) {
  const hinge = child.hinge;
  const pivot = useMemo(
    () => (hinge ? new THREE.Vector3(...hinge.pivot) : new THREE.Vector3()),
    [hinge],
  );
  const offset = useMemo(
    () =>
      hinge
        ? new THREE.Vector3(...hinge.childOffset)
        : new THREE.Vector3(),
    [hinge],
  );
  const axis = useMemo(
    () =>
      hinge
        ? new THREE.Vector3(...hinge.axis).normalize()
        : new THREE.Vector3(0, 1, 0),
    [hinge],
  );
  const angle = hinge ? hingeAngleRad(hinge, unfoldT) : 0;
  const quat = useMemo(
    () => new THREE.Quaternion().setFromAxisAngle(axis, angle),
    [axis, angle],
  );

  if (!hinge) return null;

  return (
    <group position={pivot}>
      <group quaternion={quat}>
        <group position={offset}>
          <FaceBranch node={child} unfoldT={unfoldT} />
        </group>
      </group>
    </group>
  );
}

function FaceBranch({ node, unfoldT }: { node: FaceNode; unfoldT: number }) {
  return (
    <group>
      <FaceMesh node={node} />
      {node.children.map((child) => (
        <HingeChild key={child.id} child={child} unfoldT={unfoldT} />
      ))}
    </group>
  );
}

function OrbitSync({
  orbit,
  onOrbitChange,
}: {
  orbit: OrbitState;
  onOrbitChange: (o: OrbitState) => void;
}) {
  const { controls } = useThree();
  const applied = useRef(false);

  useLayoutEffect(() => {
    const oc = controls as
      | {
          setAzimuthalAngle: (v: number) => void;
          setPolarAngle: (v: number) => void;
          update: () => void;
        }
      | null
      | undefined;
    if (!oc?.setAzimuthalAngle) return;
    oc.setAzimuthalAngle(orbit.azimuth);
    oc.setPolarAngle(orbit.polar);
    oc.update();
    applied.current = true;
  }, [orbit.azimuth, orbit.polar, controls]);

  useEffect(() => {
    const oc = controls as
      | {
          getAzimuthalAngle: () => number;
          getPolarAngle: () => number;
          addEventListener: (e: string, fn: () => void) => void;
          removeEventListener: (e: string, fn: () => void) => void;
        }
      | null
      | undefined;
    if (!oc?.addEventListener) return;
    const onChange = () => {
      if (!applied.current) return;
      onOrbitChange({
        azimuth: oc.getAzimuthalAngle(),
        polar: oc.getPolarAngle(),
      });
    };
    oc.addEventListener("change", onChange);
    return () => oc.removeEventListener("change", onChange);
  }, [controls, onOrbitChange]);

  return null;
}

function SolidContent({
  tree,
  unfoldT,
  orbit,
  onOrbitChange,
}: Omit<SceneProps, "className">) {
  const groupRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    const box = new THREE.Box3().setFromObject(g);
    const center = box.getCenter(new THREE.Vector3());
    g.position.sub(center);
  }, [tree, unfoldT]);

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 10, 4]} intensity={0.85} castShadow />
      <group
        ref={groupRef}
        rotation={[-(Math.PI / 2) * unfoldT, 0, 0]}
      >
        <FaceBranch node={tree.root} unfoldT={unfoldT} />
      </group>
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={24}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI - 0.15}
      />
      <OrbitSync orbit={orbit} onOrbitChange={onOrbitChange} />
    </>
  );
}

export default function SolidNetScene({
  tree,
  unfoldT,
  orbit,
  onOrbitChange,
  className,
}: SceneProps) {
  return (
    <div
      className={className ?? "h-full w-full min-h-[200px]"}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Canvas
        camera={{ position: [5, 4, 6], fov: 42, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <SolidContent
          tree={tree}
          unfoldT={unfoldT}
          orbit={orbit}
          onOrbitChange={onOrbitChange}
        />
      </Canvas>
    </div>
  );
}

export type { OrbitState };
