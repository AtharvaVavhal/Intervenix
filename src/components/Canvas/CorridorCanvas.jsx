import { useRef, useEffect, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT       = "#3D5AFE";
const ACCENT_VEC   = new THREE.Color(ACCENT);
const RIB_COUNT    = 22;
const RIB_SPACING  = 3.2;
const HALF_W       = 3.2;
const FLOOR_Y      = -1.6;
const CEIL_Y       = 2.6;
const CORRIDOR_H   = CEIL_Y - FLOOR_Y;
const PILLAR_W     = 0.28;
const PILLAR_D     = 0.20;
const BEAM_H       = 0.16;
const DEPTH        = RIB_COUNT * RIB_SPACING;
const CENTER_Y     = (FLOOR_Y + CEIL_Y) / 2;
const CA_OFFSET    = new THREE.Vector2(0.00012, 0.00012);

// Pipeline zone Z boundaries (world space)
const ZONE = {
  INGEST:   { start: 4,    end: -8  },
  FEATURE:  { start: -8,   end: -22 },
  MODEL:    { start: -22,  end: -34 },
  DECISION: { start: -34,  end: -48 },
  OUTPUT:   { start: -48,  end: -65 },
};

// ─── Particle config ──────────────────────────────────────────────────────────
const PARTICLE_COUNT   = 180;
const SPAWN_Z          = 6.0;
const KILL_Z           = -68;
const LANE_SPREAD      = 1.8;   // x spread
const LANE_Y_SPREAD    = 0.6;   // y spread around center

// ─── Color helpers ────────────────────────────────────────────────────────────
const LOW_RISK  = new THREE.Color("#4ade80");
const MID_RISK  = new THREE.Color("#facc15");
const HIGH_RISK = new THREE.Color("#f87171");
const EV_POS    = new THREE.Color("#60a5fa");
const EV_NEG    = new THREE.Color("#f87171");

function riskColor(p) {
  const c = new THREE.Color();
  if (p < 0.4) c.lerpColors(LOW_RISK, MID_RISK, p / 0.4);
  else         c.lerpColors(MID_RISK, HIGH_RISK, (p - 0.4) / 0.6);
  return c;
}

// ─── Particle data (CPU side) ─────────────────────────────────────────────────
function initParticles() {
  const arr = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    arr.push(spawnParticle(i));
  }
  return arr;
}

function spawnParticle(i) {
  const p_default    = Math.random();                          // P(default)
  const effectiveness = 0.3 + Math.random() * 0.6;
  const recovery     = 0.2 + Math.random() * 0.5;
  const cost         = 0.05 + Math.random() * 0.15;
  const ev           = p_default * effectiveness * recovery - cost;
  const confidence   = 0.4 + Math.random() * 0.6;

  return {
    id:           i,
    x:            (Math.random() - 0.5) * LANE_SPREAD * 2,
    y:            CENTER_Y + (Math.random() - 0.5) * LANE_Y_SPREAD,
    z:            SPAWN_Z - Math.random() * DEPTH * 0.6,     // stagger spawn
    p_default,
    ev,
    confidence,
    speed:        0.018 + Math.abs(ev) * 0.04 + Math.random() * 0.01,
    alive:        true,
    opacity:      1.0,
    scale:        0.5 + confidence * 0.8,
    phase:        Math.random() * Math.PI * 2,               // for oscillation
    eliminated:   false,
    elimT:        0,
    // lane assigned in feature zone
    lane:         Math.floor(Math.random() * 3) - 1,         // -1, 0, 1
  };
}

// ─── Noise texture ────────────────────────────────────────────────────────────
function makeNoiseTexture(w = 256, h = 256, lo = 48, hi = 82, rx = 10, ry = 10) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  const id  = ctx.createImageData(w, h);
  for (let i = 0; i < w * h * 4; i += 4) {
    const v = lo + Math.random() * (hi - lo);
    id.data[i] = v; id.data[i+1] = v; id.data[i+2] = v; id.data[i+3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
}

// ─── Camera Intelligence ──────────────────────────────────────────────────────
// Behaves like an AI observer — breathes, drifts, focuses toward high-EV zones
function CameraController({ activityRef }) {
  const { camera } = useThree();
  const clock      = useRef(0);
  const lookTarget = useMemo(() => new THREE.Vector3(0, -0.04, -25), []);
  const camTarget  = useMemo(() => new THREE.Vector3(0.22, 0.05, 5.0), []);

  useFrame((_, dt) => {
    clock.current += dt;
    const t        = clock.current;
    const activity = activityRef.current; // 0..1 system intensity

    // Breathing
    const breathe  = Math.sin(t * 0.11) * 0.004;
    const sway     = Math.sin(t * 0.073) * 0.06 * (1 + activity * 0.5);

    // During high activity, camera leans slightly left (toward decision zone)
    camTarget.x = 0.22 + activity * -0.15;
    camTarget.y = 0.05 + breathe;
    camTarget.z = 5.0 + Math.sin(t * 0.045) * 1.2;

    camera.position.lerp(camTarget, 0.004);
    camera.position.x += sway * 0.01;

    // Look target drifts toward model/decision zone during high activity
    lookTarget.x = activity * -0.08;
    lookTarget.y = -0.04 + activity * 0.04;
    camera.lookAt(lookTarget);
  });

  return null;
}

// ─── Particle System ──────────────────────────────────────────────────────────
// Core visualization: each particle = one borrower entity
function ParticleSystem({ systemPhaseRef, activityRef }) {
  const meshRef    = useRef();
  const trailRef   = useRef();
  const particles  = useRef(initParticles());
  const dummy      = useMemo(() => new THREE.Object3D(), []);
  const colorArr   = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const trailDummy = useMemo(() => new THREE.Object3D(), []);

  // Particle geometry: small octahedron for borrower entities
  const geo = useMemo(() => new THREE.OctahedronGeometry(0.045, 0), []);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors:     true,
    metalness:        0.1,
    roughness:        0.3,
    transparent:      true,
    emissive:         new THREE.Color("#ffffff"),
    emissiveIntensity: 0.4,
  }), []);

  // Trail material — elongated spheres behind fast particles
  const trailMat = useMemo(() => new THREE.MeshBasicMaterial({
    color:       new THREE.Color("#3D5AFE"),
    transparent: true,
    opacity:     0.08,
  }), []);

  useFrame((_, dt) => {
    if (!meshRef.current) return;

    const phase    = systemPhaseRef.current; // 0..3
    const activity = activityRef.current;
    let   aliveCount = 0;

    particles.current.forEach((p, i) => {
      // Respawn dead particles
      if (p.z < KILL_Z || (p.eliminated && p.elimT > 1.2)) {
        const fresh = spawnParticle(i);
        particles.current[i] = fresh;
        return;
      }

      // Elimination fade
      if (p.eliminated) {
        p.elimT += dt * 1.8;
        p.opacity = Math.max(0, 1 - p.elimT);
        p.y      += dt * 0.4; // float up and disappear (rejected)
        p.scale  *= 0.97;
      } else {
        aliveCount++;

        // Zone-aware behavior
        const z = p.z;

        if (z > ZONE.INGEST.end) {
          // ── INGESTION ZONE: gentle spread, random drift ──
          p.x += Math.sin(p.phase + p.z * 0.1) * 0.002;
          p.y += Math.cos(p.phase * 1.3 + p.z * 0.08) * 0.001;
          p.speed = 0.018 + Math.abs(p.ev) * 0.02;

        } else if (z > ZONE.FEATURE.end) {
          // ── FEATURE ENGINEERING ZONE: snap to lanes, organize ──
          const targetX = p.lane * 0.9;
          p.x += (targetX - p.x) * 0.04;
          p.y += (CENTER_Y - p.y) * 0.025;
          // Grid-like structured motion
          p.x += Math.sin(p.phase + z * 0.3) * 0.003;

        } else if (z > ZONE.MODEL.end) {
          // ── MODEL ZONE: converge to center, slow down (inference) ──
          p.x += (0 - p.x) * 0.06;
          p.y += (CENTER_Y - p.y) * 0.06;
          p.speed *= 0.985; // decelerate during scoring
          // Slight spiral (model processing feel)
          const angle = z * 0.15 + p.phase;
          p.x += Math.cos(angle) * 0.005;
          p.y += Math.sin(angle) * 0.003;

        } else if (z > ZONE.DECISION.end) {
          // ── DECISION ENGINE ZONE: EV branching ──
          if (!p.eliminated) {
            if (p.ev <= 0) {
              // Negative EV → eliminate
              p.eliminated = true;
              p.elimT      = 0;
            } else {
              // Positive EV → rank and accelerate
              const evScore = Math.max(0, p.ev);
              p.speed = 0.022 + evScore * 0.06;
              // Separate by EV: high EV center, lower EV edges
              const targetX = (1 - Math.min(evScore * 4, 1)) * (p.lane * 0.6);
              p.x += (targetX - p.x) * 0.05;
            }
          }

        } else {
          // ── OUTPUT ZONE: survivors accelerate forward cleanly ──
          p.speed = Math.min(p.speed * 1.01, 0.12);
          p.x += (0 - p.x) * 0.03; // converge to center
        }

        p.z -= p.speed * (1 + activity * 0.3);
        p.phase += dt * 0.8;
      }

      // Build instance matrix
      dummy.position.set(p.x, p.y, p.z);
      const s = p.scale * (p.eliminated ? Math.max(0.01, 1 - p.elimT) : 1);
      dummy.scale.setScalar(s * 0.045);
      dummy.rotation.y = p.phase;
      dummy.rotation.x = p.phase * 0.7;
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Color: risk in ingestion/feature, EV in decision/output
      let col;
      if (p.z > ZONE.DECISION.start) {
        col = riskColor(p.p_default);
      } else {
        // Transition to EV color
        col = p.ev > 0
          ? EV_POS.clone().lerp(riskColor(p.p_default), 0.3)
          : EV_NEG.clone();
      }
      if (p.eliminated) col.multiplyScalar(p.opacity);

      colorArr[i * 3]     = col.r;
      colorArr[i * 3 + 1] = col.g;
      colorArr[i * 3 + 2] = col.b;

      // Trail (fast particles)
      if (trailRef.current) {
        trailDummy.position.set(p.x, p.y, p.z + p.speed * 8);
        trailDummy.scale.set(0.02, 0.02, p.speed * 6);
        trailDummy.updateMatrix();
        trailRef.current.setMatrixAt(i, trailDummy.matrix);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.geometry.setAttribute(
      "color",
      new THREE.InstancedBufferAttribute(colorArr, 3)
    );

    if (trailRef.current) trailRef.current.instanceMatrix.needsUpdate = true;

    // Update global activity based on alive particle count
    activityRef.current = THREE.MathUtils.lerp(
      activityRef.current,
      aliveCount / PARTICLE_COUNT,
      0.05
    );
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[geo, mat, PARTICLE_COUNT]} frustumCulled={false} />
      <instancedMesh ref={trailRef} args={[
        new THREE.CylinderGeometry(1, 1, 1, 4),
        trailMat,
        PARTICLE_COUNT
      ]} frustumCulled={false} />
    </group>
  );
}

// ─── Model Core ───────────────────────────────────────────────────────────────
// Glowing XGBoost prediction sphere — pulses with system activity
function ModelCore({ activityRef }) {
  const coreRef  = useRef();
  const ringRef  = useRef();
  const glowRef  = useRef();
  const clock    = useRef(0);

  const modelZ   = (ZONE.MODEL.start + ZONE.MODEL.end) / 2;

  const coreMat  = useMemo(() => new THREE.MeshStandardMaterial({
    color:             new THREE.Color("#0a0a1a"),
    emissive:          ACCENT_VEC,
    emissiveIntensity: 0.6,
    metalness:         0.9,
    roughness:         0.1,
    transparent:       true,
    opacity:           0.92,
    wireframe:         false,
  }), []);

  const ringMat  = useMemo(() => new THREE.MeshBasicMaterial({
    color:       ACCENT_VEC,
    transparent: true,
    opacity:     0.15,
    side:        THREE.DoubleSide,
  }), []);

  useFrame((_, dt) => {
    clock.current += dt;
    const t        = clock.current;
    const activity = activityRef.current;

    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 2.4) * 0.06 + activity * 0.12;
      coreRef.current.scale.setScalar(pulse);
      coreRef.current.rotation.y += dt * 0.4;
      coreRef.current.rotation.x += dt * 0.15;
      coreMat.emissiveIntensity = 0.5 + activity * 0.8 + Math.sin(t * 1.8) * 0.15;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z += dt * 0.6;
      ringRef.current.rotation.x  = Math.PI / 2 + Math.sin(t * 0.4) * 0.2;
      ringMat.opacity = 0.08 + activity * 0.18;
    }
  });

  return (
    <group position={[0, CENTER_Y, modelZ]}>
      {/* Core sphere */}
      <mesh ref={coreRef} material={coreMat}>
        <icosahedronGeometry args={[0.38, 2]} />
      </mesh>

      {/* Orbital ring */}
      <mesh ref={ringRef} material={ringMat}>
        <torusGeometry args={[0.72, 0.018, 8, 64]} />
      </mesh>

      {/* Second ring, perpendicular */}
      <mesh material={ringMat} rotation={[0, Math.PI / 3, 0]}>
        <torusGeometry args={[0.58, 0.012, 8, 64]} />
      </mesh>

      {/* Point light from core */}
      <pointLight color={ACCENT} intensity={2.2} distance={14} decay={2} />
    </group>
  );
}

// ─── Decision Layer ───────────────────────────────────────────────────────────
// Visual boundary where EV branching happens — glowing gate
function DecisionLayer() {
  const gateRef = useRef();
  const clock   = useRef(0);
  const decZ    = ZONE.DECISION.start;

  const gateMat = useMemo(() => new THREE.MeshBasicMaterial({
    color:       ACCENT_VEC,
    transparent: true,
    opacity:     0.06,
    side:        THREE.DoubleSide,
  }), []);

  const edgeMat = useMemo(() => new THREE.MeshBasicMaterial({
    color:       ACCENT_VEC,
    transparent: true,
    opacity:     0.28,
  }), []);

  useFrame((_, dt) => {
    clock.current += dt;
    if (gateRef.current) {
      gateMat.opacity = 0.04 + Math.sin(clock.current * 1.2) * 0.02;
    }
  });

  return (
    <group position={[0, CENTER_Y, decZ]}>
      {/* Gate plane */}
      <mesh ref={gateRef} material={gateMat}>
        <planeGeometry args={[HALF_W * 2, CORRIDOR_H]} />
      </mesh>

      {/* Top edge */}
      <mesh position={[0, CORRIDOR_H / 2, 0]} material={edgeMat}>
        <boxGeometry args={[HALF_W * 2, 0.012, 0.012]} />
      </mesh>
      {/* Bottom edge */}
      <mesh position={[0, -CORRIDOR_H / 2, 0]} material={edgeMat}>
        <boxGeometry args={[HALF_W * 2, 0.012, 0.012]} />
      </mesh>
      {/* Left edge */}
      <mesh position={[-HALF_W, 0, 0]} material={edgeMat}>
        <boxGeometry args={[0.012, CORRIDOR_H, 0.012]} />
      </mesh>
      {/* Right edge */}
      <mesh position={[HALF_W, 0, 0]} material={edgeMat}>
        <boxGeometry args={[0.012, CORRIDOR_H, 0.012]} />
      </mesh>

      {/* Label light */}
      <pointLight color="#facc15" intensity={0.5} distance={6} decay={2} />
    </group>
  );
}

// ─── Zone Labels (floor projections) ─────────────────────────────────────────
// Subtle glowing lines on floor marking pipeline zones
function ZoneMarkers() {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color:       ACCENT_VEC,
    transparent: true,
    opacity:     0.07,
  }), []);

  const zones = [
    { z: (ZONE.INGEST.start + ZONE.INGEST.end) / 2,     label: "INGEST"   },
    { z: (ZONE.FEATURE.start + ZONE.FEATURE.end) / 2,   label: "FEATURE"  },
    { z: (ZONE.MODEL.start + ZONE.MODEL.end) / 2,       label: "MODEL"    },
    { z: (ZONE.DECISION.start + ZONE.DECISION.end) / 2, label: "DECISION" },
    { z: (ZONE.OUTPUT.start + ZONE.OUTPUT.end) / 2,     label: "OUTPUT"   },
  ];

  return (
    <group>
      {zones.map(({ z }) => (
        <mesh key={z} position={[0, FLOOR_Y + 0.002, z]} rotation-x={-Math.PI / 2} material={mat}>
          <planeGeometry args={[HALF_W * 1.8, 0.006]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Feature Grid ─────────────────────────────────────────────────────────────
// Structured grid in the feature engineering zone
function FeatureGrid() {
  const gridRef = useRef();
  const clock   = useRef(0);

  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    color:       new THREE.Color("#1a2060"),
    transparent: true,
    opacity:     0.12,
    wireframe:   true,
  }), []);

  const featureZ = (ZONE.FEATURE.start + ZONE.FEATURE.end) / 2;

  useFrame((_, dt) => {
    clock.current += dt;
    if (gridRef.current) {
      mat.opacity = 0.08 + Math.sin(clock.current * 0.6) * 0.04;
    }
  });

  return (
    <group ref={gridRef} position={[0, CENTER_Y, featureZ]}>
      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_W * 1.6, CORRIDOR_H * 0.8, 12, 8]} />
      </mesh>
    </group>
  );
}

// ─── Structural Elements (from original) ──────────────────────────────────────
function Floor() {
  const roughnessMap = useMemo(() => makeNoiseTexture(512, 512, 18, 52, 14, 14), []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, -DEPTH / 2]}>
      <planeGeometry args={[HALF_W * 2 + 2, DEPTH + 14]} />
      <meshStandardMaterial color="#020208" metalness={0.72} roughness={0.08} roughnessMap={roughnessMap} />
    </mesh>
  );
}

function Ceiling() {
  return (
    <mesh rotation-x={Math.PI / 2} position={[0, CEIL_Y, -DEPTH / 2]}>
      <planeGeometry args={[HALF_W * 2 + 2, DEPTH + 14]} />
      <meshStandardMaterial color="#010101" metalness={0.0} roughness={1.0} />
    </mesh>
  );
}

function Walls() {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#020208", metalness: 0.0, roughness: 0.96, side: THREE.DoubleSide,
    }), []
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

function Ribs({ activityRef }) {
  const pillarRef = useRef();
  const beamRef   = useRef();
  const baseRef   = useRef();
  const dummy     = useMemo(() => new THREE.Object3D(), []);
  const clock     = useRef(0);

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
    () => new THREE.MeshStandardMaterial({
      color: "#09090f", metalness: 0.28, roughness: 0.64,
      emissive: ACCENT_VEC, emissiveIntensity: 0.003,
    }), []
  );

  const baseMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#05050a", metalness: 0.38, roughness: 0.72 }), []
  );

  // Pulse ribs with activity
  useFrame((_, dt) => {
    clock.current += dt;
    structMat.emissiveIntensity = 0.003 + activityRef.current * 0.018 + Math.sin(clock.current * 1.1) * 0.004;
  });

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

function EdgeStrips({ activityRef }) {
  const mat   = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#000000", emissive: ACCENT_VEC, emissiveIntensity: 0.18,
    }), []
  );
  const clock = useRef(0);
  const len   = DEPTH + 10;
  const z     = -DEPTH / 2;

  useFrame((_, dt) => {
    clock.current += dt;
    mat.emissiveIntensity = 0.12 + activityRef.current * 0.3 + Math.sin(clock.current * 0.9) * 0.06;
  });

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

function DominantLight({ activityRef }) {
  const ref   = useRef();
  const clock = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    clock.current += dt;
    ref.current.intensity = 18 + activityRef.current * 8 + Math.sin(clock.current * 0.14) * 0.8;
  });
  return (
    <pointLight ref={ref} position={[0, CENTER_Y + 0.5, -(DEPTH + 2)]}
      intensity={18} color={ACCENT} distance={110} decay={1.2} />
  );
}

function ForegroundSilhouettes() {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#010108", transparent: true, opacity: 0.92 }), []
  );
  return (
    <>
      <mesh position={[-HALF_W - 0.1, CENTER_Y, 3.8]} material={mat}><boxGeometry args={[0.9, CORRIDOR_H * 1.1, 0.5]} /></mesh>
      <mesh position={[HALF_W + 0.1, CENTER_Y, 3.8]} material={mat}><boxGeometry args={[0.9, CORRIDOR_H * 1.1, 0.5]} /></mesh>
      <mesh position={[0, CEIL_Y + 0.12, 3.6]} material={mat}><boxGeometry args={[HALF_W * 2 + 2.2, 0.6, 0.5]} /></mesh>
      <mesh position={[0, FLOOR_Y - 0.1, 3.6]} material={mat}><boxGeometry args={[HALF_W * 2 + 2.2, 0.5, 0.5]} /></mesh>
    </>
  );
}

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

// ─── Scene root ───────────────────────────────────────────────────────────────
function Scene({ mouseRef }) {
  // Shared mutable refs — no re-renders
  const activityRef    = useRef(0.5);
  const systemPhaseRef = useRef(0);
  const clock          = useRef(0);

  // Advance system phase over time (0→3 loop, ~60s cycle)
  useFrame((_, dt) => {
    clock.current       += dt;
    systemPhaseRef.current = (clock.current / 15) % 4;
  });

  return (
    <>
      <fog attach="fog" args={["#01010a", 12, 58]} />
      <color attach="background" args={["#010106"]} />

      <CameraController activityRef={activityRef} />

      <ambientLight intensity={0.001} />
      <DominantLight activityRef={activityRef} />
      <pointLight position={[-HALF_W * 0.6, CENTER_Y, -DEPTH * 0.4]}
        intensity={0.08} color="#0d0d18" distance={22} decay={2} />

      {/* Structure */}
      <Floor />
      <Ceiling />
      <Walls />
      <Ribs activityRef={activityRef} />
      <EdgeStrips activityRef={activityRef} />
      <ForegroundSilhouettes />
      <DepthSilhouettes />
      <EndGlow />

      {/* Pipeline-aware overlays */}
      <ZoneMarkers />
      <FeatureGrid />
      <ModelCore activityRef={activityRef} />
      <DecisionLayer />

      {/* Particle system — the core visualization */}
      <ParticleSystem systemPhaseRef={systemPhaseRef} activityRef={activityRef} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.08} luminanceSmoothing={0.88} intensity={0.55} mipmapBlur />
        <Vignette eskil={false} offset={0.08} darkness={1.55} />
        <ChromaticAberration offset={CA_OFFSET} />
      </EffectComposer>
    </>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function CorridorCanvas({ mouseRef }) {
  return (
    <Canvas
      camera={{ position: [0, 0.05, 5.0], fov: 52, near: 0.1, far: 140 }}
      dpr={[1, 1.5]}
      gl={{
        antialias:        true,
        alpha:            false,
        powerPreference:  "high-performance",
        toneMapping:      THREE.ACESFilmicToneMapping,
      }}
      onCreated={({ gl }) => { gl.toneMappingExposure = 1.08; }}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}
    >
      <Scene mouseRef={mouseRef} />
    </Canvas>
  );
}