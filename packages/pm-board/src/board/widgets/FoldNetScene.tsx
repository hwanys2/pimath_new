"use client";

import { Bounds, Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  buildBoxFaceKeyframes,
  hingeAngleRad,
  type FaceNode,
  type FoldTree,
  type OrbitState,
} from "../../lib/fold-net";

type Props = {
  tree: FoldTree;
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
  const unfoldPos = useRef(new THREE.Vector3());
  const unfoldQuat = useRef(new THREE.Quaternion());
  const unfoldScale = useRef(new THREE.Vector3());
  const foldPos = useRef(new THREE.Vector3());
  const foldQuat = useRef(new THREE.Quaternion());
  const foldScale = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3());
  const quat = useRef(new THREE.Quaternion());
  const scale = useRef(new THREE.Vector3(1, 1, 1));

  useLayoutEffect(() => {
    mat4ToThree(face.unfold).decompose(
      unfoldPos.current,
      unfoldQuat.current,
      unfoldScale.current,
    );
    mat4ToThree(face.folded).decompose(
      foldPos.current,
      foldQuat.current,
      foldScale.current,
    );
  }, [face]);

  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    pos.current.lerpVectors(unfoldPos.current, foldPos.current, unfoldT);
    quat.current.slerpQuaternions(unfoldQuat.current, foldQuat.current, unfoldT);
    scale.current.lerpVectors(unfoldScale.current, foldScale.current, unfoldT);
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
          color={face.color}
          side={THREE.DoubleSide}
          roughness={0.55}
          metalness={0.05}
        />
        <Edges color="#1e3a5f" threshold={15} />
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
      const positions = new Float32Array(verts.length * 3);
      for (let i = 0; i < verts.length; i++) {
        positions[i * 3] = verts[i][0];
        positions[i * 3 + 1] = verts[i][1];
        positions[i * 3 + 2] = verts[i][2];
      }
      const indices: number[] = [];
      for (let i = 1; i < verts.length - 1; i++) {
        indices.push(0, i, i + 1);
      }
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
    }
    return geo;
  }, [node]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <meshStandardMaterial
        color={node.color ?? "#7ec8f5"}
        side={THREE.DoubleSide}
        roughness={0.55}
        metalness={0.05}
      />
      <Edges color="#1e3a5f" threshold={15} />
    </mesh>
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

function HingeChild({ child, unfoldT }: { child: FaceNode; unfoldT: number }) {
  const hinge = child.hinge;
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const pivot = pivotRef.current;
    if (!pivot || !hinge) return;
    const angle = hingeAngleRad(hinge.angleFolded, unfoldT);
    pivot.position.set(...hinge.pivot);
    pivot.rotation.set(0, 0, 0);
    pivot.rotateOnAxis(new THREE.Vector3(...hinge.axis).normalize(), angle);
    const inner = groupRef.current;
    if (inner) inner.position.set(...hinge.childOffset);
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

function SolidContent({ tree, unfoldT }: { tree: FoldTree; unfoldT: number }) {
  if (tree.useBoxKeyframes && tree.boxSize) {
    const [w, d, h] = tree.boxSize;
    return <BoxKeyframeSolid width={w} depth={d} height={h} unfoldT={unfoldT} />;
  }
  return <FaceBranch node={tree.root} unfoldT={unfoldT} />;
}

export default function FoldNetScene({
  tree,
  unfoldT,
  orbit,
  onOrbitChange,
  className,
}: Props) {
  return (
    <Canvas
      className={className}
      camera={{ position: [3.2, 2.4, 3.2], fov: 42 }}
      shadows
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#14201c"]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        intensity={1.1}
        position={[4, 8, 3]}
        shadow-mapSize={[1024, 1024]}
      />
      <Bounds fit clip observe margin={1.35}>
        <SolidContent tree={tree} unfoldT={unfoldT} />
      </Bounds>
      <OrbitControls
        makeDefault
        enablePan={false}
        target={[0, 0, 0]}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI - 0.2}
        onEnd={(e) => {
          const ctrl = e.target;
          onOrbitChange({
            azimuth: ctrl.getAzimuthalAngle(),
            polar: ctrl.getPolarAngle(),
          });
        }}
        // Apply saved orbit once via key remount parent if needed
        {...(Number.isFinite(orbit.azimuth)
          ? {}
          : {})}
      />
    </Canvas>
  );
}
