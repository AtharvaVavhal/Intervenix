import { useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";

// ─── Config ──────────────────────────────────────────────────────────────────
const ACCENT = "#3D5AFE";
const ACCENT_VEC = new THREE.Color(ACCENT);
const RIB_COUNT = 18;
const RIB_SPACING = 3.2;
const HALF_W = 3.2;
const FLOOR_Y = -1.6;
const CEIL_Y = 2.6;
const CORRIDOR_H = CEIL_Y - FLOOR_Y;
const PILLAR_W = 0.28;
const PILLAR_D = 0.20;
const BEAM_H = 0.16;
const DEPTH = RIB_COUNT * RIB_SPACING;
const CENTER_Y = (FLOOR_Y + CEIL_Y) / 2;

// ─── Noise texture factory ───────────────────────────────────────────────────
function makeNoiseTexture(w = 256, h = 256, lo = 48, hi = 82, repeatX = 10, repeatY = 10) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  const id = ctx.createImageData(w, h);
  for (let i = 0; i < w * h * 4; i += 4) {
    const v = lo + Math.random() * (hi - lo);
    id.data[i] = v; id.data[i + 1] = v; id.data[i + 2] = v; id.data[i + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

// ─── Camera — breathing only, slight offset ───────────────────────────────────
function CameraController({ mouse }) {
  const { camera } = useThree();
  const clock = useRef(0);
  const lookTarget = useMemo(() => new THREE.Vector3(0.18, -0.04, -25), []);

  useFrame((_, dt) => {
    clock.current += dt;
    const breathe = Math.sin(clock.current * 0.11) * 0.004;
    camera.position.x += (0.22 - camera.position.x) * 0.004;
    camera.position.y += (0.05 + breathe - camera.position.y) * 0.006;
    camera.position.z = 5.0 + Math.sin(clock.current * 0.045) * 1.2;
    camera.lookAt(lookTarget);
  });

  return null;
}

// ─── Floor — reflective, imperfect ──────────────────────────────────────────
function Floor() {
  const roughnessMap = useMemo(() => makeNoiseTexture(512, 512, 18, 52, 14, 14), []);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, -DEPTH / 2]}>
      <planeGeometry args={[HALF_W * 2 + 2, DEPTH + 14]} />
      <meshStandardMaterial
        color="#020208"
        metalness={0.72}
        roughness={0.08}
        roughnessMap={roughnessMap}
      />
    </mesh>
  );
}

// ─── Ceiling — nearly invisible ──────────────────────────────────────────────
function Ceiling() {
  return (
    <mesh rotation-x={Math.PI / 2} position={[0, CEIL_Y, -DEPTH / 2]}>
      <planeGeometry args={[HALF_W * 2 + 2, DEPTH + 14]} />
      <meshStandardMaterial color="#010101" metalness={0.0} roughness={1.0} />
    </mesh>
  );
}

// ─── Walls — fully matte, recede into dark ───────────────────────────────────
function Walls() {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#020208",
        metalness: 0.0,
        roughness: 0.96,
        side: THREE.DoubleSide,
      }),
    []
  );
  const inset = PILLAR_W / 2 + 0.04;
  return (
    <>
      <mesh rotation-y={Math.PI / 2} position={[-(HALF_W + inset), CENTER_Y, -DEPTH / 2]} material={mat}>
        <planeGeometry args={[DEPTH + 14, CORRIDOR_H]} />
      </mesh>
      <mesh rotation-y={-Math.PI / 2} position={[HALF_W + inset, CENTER_Y, -DEPTH / 2]} material={mat}>
        <planeGeometry args={[DEPTH + 14, CORRIDOR_H]} />
      </mesh>
    </>
  );
}

// ─── Structural Ribs — catch gradients ───────────────────────────────────────
function Ribs() {
  const pillarRef = useRef();
  const beamRef   = useRef();
  const baseRef   = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    for (let i = 0; i < RIB_COUNT; i++) {
      const z = -i * RIB_SPACING - 1.5;
      dummy.position.set(-HALF_W, CENTER_Y, z); dummy.scale.setScalar(1); dummy.updateMatrix();
      pillarRef.current.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.set(HALF_W, CENTER_Y, z); dummy.updateMatrix();
      pillarRef.current.setMatrixAt(i * 2 + 1, dummy.matrix);
      dummy.position.set(0, CEIL_Y - BEAM_H / 2, z); dummy.updateMatrix();
      beamRef.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(-HALF_W, FLOOR_Y + 0.045, z); dummy.updateMatrix();
      baseRef.current.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.set(HALF_W, FLOOR_Y + 0.045, z); dummy.updateMatrix();
      baseRef.current.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
    pillarRef.current.instanceMatrix.needsUpdate = true;
    beamRef.current.instanceMatrix.needsUpdate   = true;
    baseRef.current.instanceMatrix.needsUpdate   = true;
  }, [dummy]);

  const structMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#09090f",
        metalness: 0.28,
        roughness: 0.64,
        emissive: ACCENT_VEC,
        emissiveIntensity: 0.003,
      }),
    []
  );

  const baseMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#05050a",
        metalness: 0.38,
        roughness: 0.72,
      }),
    []
  );

  const beamSpan = HALF_W * 2 + PILLAR_W;
  return (
    <>
      <instancedMesh ref={pillarRef} args={[undefined, undefined, RIB_COUNT * 2]} material={structMat}>
        <boxGeometry args={[PILLAR_W, CORRIDOR_H, PILLAR_D]} />
      </instancedMesh>
      <instancedMesh ref={beamRef} args={[undefined, undefined, RIB_COUNT]} material={structMat}>
        <boxGeometry args={[beamSpan, BEAM_H, PILLAR_D]} />
      </instancedMesh>
      <instancedMesh ref={baseRef} args={[undefined, undefined, RIB_COUNT * 2]} material={baseMat}>
        <boxGeometry args={[PILLAR_W + 0.06, 0.09, PILLAR_D + 0.04]} />
      </instancedMesh>
    </>
  );
}

// ─── Edge Strips — barely there ──────────────────────────────────────────────
function EdgeStrips() {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#000000",
        emissive: ACCENT_VEC,
        emissiveIntensity: 0.18,
      }),
    []
  );
  const len = DEPTH + 10;
  const z   = -DEPTH / 2;
  return (
    <>
      <mesh position={[-HALF_W, FLOOR_Y + 0.006, z]} material={mat}>
        <boxGeometry args={[0.022, 0.010, len]} />
      </mesh>
      <mesh position={[HALF_W, FLOOR_Y + 0.006, z]} material={mat}>
        <boxGeometry args={[0.022, 0.010, len]} />
      </mesh>
    </>
  );
}

// ─── End Glow — minimal focal accent ─────────────────────────────────────────
function EndGlow() {
  const ref   = useRef();
  const clock = useRef(0);

  useFrame((_, dt) => {
    clock.current += dt;
    ref.current.material.opacity = 0.09 + Math.sin(clock.current * 0.18) * 0.012;
  });

  return (
    <mesh ref={ref} position={[0, CENTER_Y, -(DEPTH + 4)]}>
      <planeGeometry args={[HALF_W * 2, CORRIDOR_H]} />
      <meshBasicMaterial color={ACCENT_VEC} transparent opacity={0.09} />
    </mesh>
  );
}

// ─── Dominant Far Light — sole light source ───────────────────────────────────
function DominantLight() {
  const ref   = useRef();
  const clock = useRef(0);

  useFrame((_, dt) => {
    if (!ref.current) return;
    clock.current += dt;
    ref.current.intensity = 22 + Math.sin(clock.current * 0.14) * 0.44;
  });

  return (
    <pointLight
      ref={ref}
      position={[0, CENTER_Y + 0.5, -(DEPTH + 2)]}
      intensity={22}
      color={ACCENT}
      distance={110}
      decay={1.2}
    />
  );
}

// ─── Side Fill — reveals geometry only, no color ────────────────────────────
function SideFill() {
  return (
    <pointLight
      position={[-HALF_W * 0.6, CENTER_Y, -DEPTH * 0.4]}
      intensity={0.08}
      color="#0d0d18"
      distance={22}
      decay={2}
    />
  );
}

// ─── Foreground Silhouettes — frame the composition ──────────────────────────
function ForegroundSilhouettes() {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#010108", transparent: true, opacity: 0.92 }),
    []
  );

  return (
    <>
      <mesh position={[-HALF_W - 0.1, CENTER_Y, 3.8]} material={mat}>
        <boxGeometry args={[0.9, CORRIDOR_H * 1.1, 0.5]} />
      </mesh>
      <mesh position={[HALF_W + 0.1, CENTER_Y, 3.8]} material={mat}>
        <boxGeometry args={[0.9, CORRIDOR_H * 1.1, 0.5]} />
      </mesh>
      <mesh position={[0, CEIL_Y + 0.12, 3.6]} material={mat}>
        <boxGeometry args={[HALF_W * 2 + 2.2, 0.6, 0.5]} />
      </mesh>
      <mesh position={[0, FLOOR_Y - 0.1, 3.6]} material={mat}>
        <boxGeometry args={[HALF_W * 2 + 2.2, 0.5, 0.5]} />
      </mesh>
    </>
  );
}

// ─── Depth Silhouettes — infinite corridor illusion ───────────────────────────
function DepthSilhouettes() {
  const frames = [1, 2, 3, 4].map(i => ({
    z:  -(DEPTH + 4 + i * 5.5),
    sc: 1 - i * 0.06,
    op: Math.max(0.04, 0.32 - i * 0.07),
  }));

  return (
    <>
      {frames.map(({ z, sc, op }, i) => (
        <group key={i} position={[0, CENTER_Y, z]}>
          <mesh position={[0, CORRIDOR_H * 0.5 - 0.12, 0]}>
            <boxGeometry args={[HALF_W * 2 * sc, 0.14, 0.12]} />
            <meshBasicMaterial color="#020210" transparent opacity={op} />
          </mesh>
          <mesh position={[-HALF_W * sc, 0, 0]}>
            <boxGeometry args={[0.22, CORRIDOR_H * sc, 0.12]} />
            <meshBasicMaterial color="#020210" transparent opacity={op} />
          </mesh>
          <mesh position={[HALF_W * sc, 0, 0]}>
            <boxGeometry args={[0.22, CORRIDOR_H * sc, 0.12]} />
            <meshBasicMaterial color="#020210" transparent opacity={op} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, CENTER_Y, -(DEPTH + 38)]}>
        <planeGeometry args={[HALF_W * 2.8, CORRIDOR_H * 1.4]} />
        <meshBasicMaterial color="#010108" transparent opacity={0.82} />
      </mesh>
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
const CA_OFFSET = new THREE.Vector2(0.00012, 0.00012);

export default function CorridorCanvas({ mouseRef }) {
  return (
    <Canvas
      camera={{ position: [0, 0.05, 5.0], fov: 52, near: 0.1, far: 130 }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.05;
      }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
      }}
    >
      <fog attach="fog" args={["#01010a", 12, 54]} />
      <color attach="background" args={["#010106"]} />

      <CameraController mouse={mouseRef} />

      <ambientLight intensity={0.001} />
      <DominantLight />
      <SideFill />

      <Floor />
      <Ceiling />
      <Walls />
      <Ribs />
      <EdgeStrips />

      <ForegroundSilhouettes />
      <DepthSilhouettes />
      <EndGlow />

      <EffectComposer>
        <Bloom luminanceThreshold={0.12} luminanceSmoothing={0.92} intensity={0.46} mipmapBlur />
        <Vignette eskil={false} offset={0.08} darkness={1.55} />
        <ChromaticAberration offset={CA_OFFSET} />
      </EffectComposer>
    </Canvas>
  );
}