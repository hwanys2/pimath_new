"use client";

import { Bounds, Edges, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  buildBoxFaceKeyframes,
} from "../../lib/solid-nets/box-fold-keyframes";
import type { SolidNetTree } from "../../lib/solid-nets/types";
import { hingeAngleRad } from "../../lib/solid-nets/fold-math";
import type { FaceNode } from "../../lib/solid-nets/types";
import { boxDimensionsFromParams } from "../../lib/solid-nets/catalog";
import type { SolidType } from "../geometry-types";

const FACE_COLOR = "#7ec8f5";
const EDGE_COLOR = "#1e3a5f";

type OrbitState = { azimuth: number; polar: number };

type SceneProps = {
  solidType: SolidType;
  params: { a?: number; b?: number; c?: number; height?: number };
  tree: SolidNetTree;
  unfoldT: number;
  orbit: OrbitState;
  onOrbitChange: (orbit: OrbitState) => void;
  className?: string;
};

function mat4ToThree(m: readonly number[]): THREE.Matrix4 {
  const t = new THREE.Matrix4();
  t.set(
    m[0], m[1], m[2], m[3],
    m[4], m[5], m[6], m[7],
    m[8], m[9], m[10], m[11],
    m[12], m[13], m[14], m[15],
  );
  return t;
}

function BoxFaceMesh({
  face,
  unfoldT,
}: {
  face: ReturnType<typeof buildBoxFaceKeyframes>[number];
  unfoldT: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3());
  const quat = useRef(new THREE.Quaternion());
  const scale = useRef(new THREE.Vector3(1, 1, 1));
  const unfoldM = useRef(new THREE.Matrix4());
  const foldedM = useRef(new THREE.Matrix4());
  const unfoldPos = useRef(new THREE.Vector3());
  const unfoldQuat = useRef(new THREE.Quaternion());
  const foldPos = useRef(new THREE.Vector3());
  const foldQuat = useRef(new THREE.Quaternion());
  const foldScale = useRef(new THREE.Vector3());
  const unfoldScale = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    unfoldM.current.copy(mat4ToThree(face.unfold));
    foldedM.current.copy(mat4ToThree(face.folded));
    unfoldM.current.decompose(
      unfoldPos.current,
      unfoldQuat.current,
      unfoldScale.current,
    );
    foldedM.current.decompose(
      foldPos.current,
      foldQuat.current,
      foldScale.current,
    );
  }, [face]);

  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    pos.current.lerpVectors(unfoldPos.current, foldPos.current, unfoldT);
    quat.current.slerpQuaternions(
      unfoldQuat.current,
      foldQuat.current,
      unfoldT,
    );
    scale.current.lerpVectors(
      unfoldScale.current,
      foldScale.current,
      unfoldT,
    );
    g.position.copy(pos.current);
    g.quaternion.copy(quat.current);
    g.scale.copy(scale.current);
  }, [unfoldT, face]);

  const [w, d] = face.size;
  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={FACE_COLOR}
          side={THREE.DoubleSide}
          roughness={0.55}
          metalness={0.05}
        />
        <Edges color={EDGE_COLOR} threshold={15} />
      </mesh>
    </group>
  );
}

function BoxKeyframeSolid({
  width,
  depth,
  height,
  unfoldT,
}: {
  width: number;
  depth: number;
  height: number;
  unfoldT: number;
}) {
  const faces = useMemo(
    () => buildBoxFaceKeyframes(width, depth, height),
    [width, depth, height],
  );

  return (
    <group>
      {faces.map((f) => (
        <BoxFaceMesh key={f.id} face={f} unfoldT={unfoldT} />
      ))}
    </group>
  );
}

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
        verts[0][0], verts[0][1], verts[0][2],
        verts[1][0], verts[1][1], verts[1][2],
        verts[2][0], verts[2][1], verts[2][2],
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

function HingeChild({ child, unfoldT }: { child: FaceNode; unfoldT: number }) {
  const hinge = child.hinge;
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const pivot = pivotRef.current;
    if (!pivot || !hinge) return;
    const angle = hingeAngleRad(hinge, unfoldT);
    pivot.position.set(...hinge.pivot);
    pivot.rotation.set(0, 0, 0);
    pivot.rotateOnAxis(
      new THREE.Vector3(...hinge.axis).normalize(),
      angle,
    );
    const inner = groupRef.current;
    if (inner) {
      inner.position.set(...hinge.childOffset);
    }
  }, [hinge, unfoldT]);

  if (!hinge) return null;

  return (
    <group ref={pivotRef}>
      <group ref={groupRef}>
        <FaceBranch node={child} unfoldT={unfoldT} />
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
  solidType,
  params,
  tree,
  unfoldT,
  orbit,
  onOrbitChange,
}: Omit<SceneProps, "className">) {
  const box = boxDimensionsFromParams(solidType, params);

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 10, 4]} intensity={0.85} castShadow />
      <Bounds fit clip observe margin={1.2}>
        {box ? (
          <BoxKeyframeSolid
            width={box.width}
            depth={box.depth}
            height={box.height}
            unfoldT={unfoldT}
          />
        ) : (
          <FaceBranch node={tree.root} unfoldT={unfoldT} />
        )}
      </Bounds>
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
  solidType,
  params,
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
          solidType={solidType}
          params={params}
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
