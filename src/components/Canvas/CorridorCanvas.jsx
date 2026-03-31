/**
 * CorridorCanvas.jsx — Intervenix Decision Intelligence Engine
 * Principal-level ML pipeline visualization
 *
 * Architecture:
 * - Z-axis = pipeline time (ingestion → features → model → decision → output)
 * - Particle slots 0..N-1    = intervention path (real)
 * - Particle slots N..2N-1   = counterfactual twins (ghost)
 * - Single instancedMesh, double buffer = 1 draw call for causal pairs
 * - Custom ShaderMaterial encodes EV/confidence/state in GLSL
 * - Force field = continuous EV gradient (not binary logic)
 * - Near-miss tension = stochastic resolution accumulator
 * - Feedback loop = survivors recycled back (simulates retraining)
 */

import { useRef, useEffect, useMemo } from "react";
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

const PARTICLE_COUNT = 140;
const TOTAL_SLOTS    = PARTICLE_COUNT * 2; // real + ghost twins
const SPAWN_Z        = 6.0;
const KILL_Z         = -72;
const EV_THRESHOLD   = 0.0;
const NEAR_MISS_BAND = 0.04; // |EV| < this triggers tension system

const ZONE = {
  INGEST:   { start: 4,    end: -8  },
  FEATURE:  { start: -8,   end: -22 },
  MODEL:    { start: -22,  end: -34 },
  DECISION: { start: -34,  end: -50 },
  OUTPUT:   { start: -50,  end: -72 },
};

// ─── Custom Particle Shader ── NEW ────────────────────────────────────────────
const PARTICLE_VERT = /* glsl */`
  attribute float aEV;
  attribute float aConfidence;
  attribute float aState;
  attribute float aZoneT;

  varying float vEV;
  varying float vConfidence;
  varying float vState;
  varying float vZoneT;
  varying vec3  vWorldPos;

  void main() {
    vEV         = aEV;
    vConfidence = aConfidence;
    vState      = aState;
    vZoneT      = aZoneT;
    vec4 mvPos  = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos   = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const PARTICLE_FRAG = /* glsl */`
  uniform float uTime;
  uniform float uActivity;

  varying float vEV;
  varying float vConfidence;
  varying float vState;
  varying float vZoneT;
  varying vec3  vWorldPos;

  vec3 riskColor(float p) {
    vec3 lo  = vec3(0.29, 0.87, 0.50);
    vec3 mid = vec3(0.98, 0.80, 0.08);
    vec3 hi  = vec3(0.97, 0.44, 0.44);
    if (p < 0.5) return mix(lo, mid, p * 2.0);
    return mix(mid, hi, (p - 0.5) * 2.0);
  }

  vec3 evColor(float ev) {
    vec3 pos = vec3(0.38, 0.65, 0.98);
    vec3 neg = vec3(0.97, 0.44, 0.44);
    return mix(neg, pos, clamp(ev * 8.0 + 0.5, 0.0, 1.0));
  }

  void main() {
    float pDefault = clamp(1.0 - vEV * 4.0, 0.0, 1.0);
    vec3  baseCol  = mix(riskColor(pDefault), evColor(vEV), vZoneT);

    // Ghost: desaturate
    float isGhost  = step(0.5, mod(vState + 0.1, 2.0));
    baseCol        = mix(baseCol, vec3(0.28, 0.30, 0.42), isGhost * 0.72);

    // Near-miss: yellow flicker
    float isNear   = step(1.5, vState) * step(vState, 2.5);
    float flicker  = sin(uTime * 18.0 + vWorldPos.z * 2.2) * 0.5 + 0.5;
    baseCol        = mix(baseCol, vec3(0.95, 0.85, 0.18), isNear * flicker * 0.55);

    // Glow: EV magnitude drives brightness
    float glow     = 0.4 + abs(vEV) * 1.8 + sin(uTime * 2.2 + vWorldPos.z) * 0.08 * uActivity;

    // Confidence: low = unstable alpha
    float noise    = sin(uTime * 14.0 + vWorldPos.x * 8.0) * (1.0 - vConfidence) * 0.35;
    float alpha    = clamp(0.85 + noise, 0.0, 1.0);
    alpha         *= mix(1.0, 0.16, isGhost);
    alpha         *= mix(1.0, 0.0, step(3.5, vState));

    gl_FragColor   = vec4(baseCol * glow, alpha);
  }
`;

// ─── Particle factory ─────────────────────────────────────────────────────────
function makeParticle(i) {
  const p_default    = 0.05 + Math.random() * 0.9;
  const effectiveness = 0.25 + Math.random() * 0.65;
  const recovery     = 0.15 + Math.random() * 0.55;
  const cost         = 0.04 + Math.random() * 0.14;
  const ev           = p_default * effectiveness * recovery - cost;
  const confidence   = 0.3 + Math.random() * 0.7;
  return {
    id: i,
    x: (Math.random() - 0.5) * HALF_W * 1.1,
    y: CENTER_Y + (Math.random() - 0.5) * 0.8,
    z: SPAWN_Z - Math.random() * DEPTH * 0.55,
    p_default, ev, confidence,
    vx: 0, vy: 0,
    speed: 0.016 + Math.random() * 0.008,
    phase: Math.random() * Math.PI * 2,
    lane:  Math.floor(Math.random() * 3) - 1,
    // 0=alive, 1=ghost(unused on real), 2=near-miss, 3=eliminated
    state: 0,
    tensionT:  0,
    resolveT:  0.4 + Math.random() * 0.8,
    elimT:     0,
    zoneT:     0,
  };
}

function makeBuffers() {
  return {
    ev:         new Float32Array(TOTAL_SLOTS),
    confidence: new Float32Array(TOTAL_SLOTS),
    state:      new Float32Array(TOTAL_SLOTS),
    zoneT:      new Float32Array(TOTAL_SLOTS),
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

// ─── Camera ───────────────────────────────────────────────────────────────────
function CameraController({ activityRef }) {
  const { camera } = useThree();
  const clock      = useRef(0);
  const lookTarget = useMemo(() => new THREE.Vector3(0, -0.04, -25), []);
  const camTarget  = useMemo(() => new THREE.Vector3(0.22, 0.05, 5.0), []);

  useFrame((_, dt) => {
    clock.current += dt;
    const t        = clock.current;
    const activity = activityRef.current;
    camTarget.x    = 0.22 + activity * -0.12;
    camTarget.y    = 0.05 + Math.sin(t * 0.11) * 0.004;
    camTarget.z    = 5.0  + Math.sin(t * 0.045) * 1.1;
    camera.position.lerp(camTarget, 0.004);
    lookTarget.x   = activity * -0.06;
    lookTarget.y   = -0.04 + activity * 0.04;
    camera.lookAt(lookTarget);
  });
  return null;
}

// ─── Particle System ── NEW ───────────────────────────────────────────────────
function ParticleSystem({ activityRef }) {
  const meshRef   = useRef();
  const particles = useRef(Array.from({ length: PARTICLE_COUNT }, (_, i) => makeParticle(i)));
  const buffers   = useRef(makeBuffers());
  const dummy     = useMemo(() => new THREE.Object3D(), []);
  const clock     = useRef(0);

  const geo = useMemo(() => new THREE.OctahedronGeometry(0.052, 0), []);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent:    true,
    depthWrite:     false,
    uniforms: {
      uTime:     { value: 0 },
      uActivity: { value: 0 },
    },
  }), []);

  // Attach instanced buffer attributes once
  useEffect(() => {
    if (!meshRef.current) return;
    const g = meshRef.current.geometry;
    g.setAttribute("aEV",         new THREE.InstancedBufferAttribute(buffers.current.ev,         1));
    g.setAttribute("aConfidence", new THREE.InstancedBufferAttribute(buffers.current.confidence, 1));
    g.setAttribute("aState",      new THREE.InstancedBufferAttribute(buffers.current.state,      1));
    g.setAttribute("aZoneT",      new THREE.InstancedBufferAttribute(buffers.current.zoneT,      1));
  }, []);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    clock.current += dt;
    const t        = clock.current;
    mat.uniforms.uTime.value     = t;
    mat.uniforms.uActivity.value = activityRef.current;

    let aliveCount = 0;

    particles.current.forEach((p, i) => {
      // Respawn
      const dead = p.z < KILL_Z || (p.state === 3 && p.elimT > 1.4);
      if (dead) {
        const next = makeParticle(i);
        // Feedback loop: survivors re-enter with slightly improved EV
        if (p.state !== 3) next.ev = Math.min(p.ev * 1.04, 0.38);
        particles.current[i] = next;
        return;
      }

      const z     = p.z;
      p.zoneT     = THREE.MathUtils.clamp(
        (z - ZONE.DECISION.start) / (ZONE.OUTPUT.start - ZONE.DECISION.start), 0, 1
      );

      // ── Force field: EV → spatial attraction/repulsion ── NEW ─────────────
      const evForce  = THREE.MathUtils.clamp(p.ev * 6, -1, 1);
      const targetX  = evForce > 0 ? 0 : p.lane * HALF_W * 0.72;
      const targetY  = CENTER_Y + (evForce > 0 ? 0 : (p.lane % 2 === 0 ? 0.3 : -0.3));
      const forceMag = Math.abs(evForce) * 0.06;

      // ── Uncertainty jitter: low confidence = noisy path ── NEW ────────────
      const jitter = (1 - p.confidence) * 0.018;
      const flick  = Math.sin(t * 16 + p.phase) * (1 - p.confidence) * 0.012;

      p.vx += (targetX - p.x) * forceMag + (Math.random() - 0.5) * jitter;
      p.vy += (targetY - p.y) * forceMag + (Math.random() - 0.5) * jitter;
      p.vx *= 0.88;
      p.vy *= 0.88;
      p.x  += p.vx + flick;
      p.y  += p.vy;
      p.x   = THREE.MathUtils.clamp(p.x, -HALF_W + 0.15, HALF_W - 0.15);
      p.y   = THREE.MathUtils.clamp(p.y, FLOOR_Y + 0.1,  CEIL_Y - 0.1);

      // Zone speed logic
      if (z > ZONE.FEATURE.end && z <= ZONE.INGEST.end) {
        p.x += (p.lane * 0.85 - p.x) * 0.02;
        p.speed = 0.016 + p.confidence * 0.006;
      }
      if (z > ZONE.MODEL.end && z <= ZONE.FEATURE.end) {
        p.speed *= 0.993;
        const angle = z * 0.18 + p.phase;
        p.x += Math.cos(angle) * 0.004 * p.confidence;
        p.y += Math.sin(angle) * 0.003 * p.confidence;
      }

      // ── Near-miss tension ── NEW ──────────────────────────────────────────
      const inDecision = z <= ZONE.DECISION.start && z > ZONE.DECISION.end;
      const nearMiss   = Math.abs(p.ev - EV_THRESHOLD) < NEAR_MISS_BAND;
      if (inDecision && nearMiss && p.state === 0) {
        p.state    = 2;
        p.tensionT += dt;
        p.speed   *= 0.94;
        if (p.tensionT > p.resolveT) {
          p.state    = p.ev > 0 ? 0 : 3;
          p.tensionT = 0;
        }
      } else if (p.state === 2 && !nearMiss) {
        p.state = 0;
      }

      // ── Decision engine ───────────────────────────────────────────────────
      if (inDecision && p.state === 0) {
        if (p.ev <= EV_THRESHOLD) {
          p.state = 3; p.elimT = 0;
        } else {
          p.speed = 0.022 + Math.max(0, p.ev) * 0.055;
        }
      }

      // ── Elimination ───────────────────────────────────────────────────────
      if (p.state === 3) {
        p.elimT += dt * 1.6;
        p.y     += dt * 0.35;
      } else {
        aliveCount++;
        p.z -= p.speed;
      }
      p.phase += dt * 0.9;

      // Write real particle (slot i)
      const ef        = p.state === 3 ? Math.max(0, 1 - p.elimT) : 1;
      const baseScale = (0.45 + p.confidence * 0.7) * ef;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(baseScale);
      dummy.rotation.y = p.phase;
      dummy.rotation.x = p.phase * 0.5;
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      buffers.current.ev[i]         = p.ev;
      buffers.current.confidence[i] = p.confidence;
      buffers.current.state[i]      = p.state;
      buffers.current.zoneT[i]      = p.zoneT;

      // ── Counterfactual twin (ghost) — slot i + PARTICLE_COUNT ── NEW ──────
      // Ghost = no-intervention outcome
      // Visible when real is eliminated (shows what would have happened anyway)
      const gi       = i + PARTICLE_COUNT;
      const gVisible = p.state === 3;
      const gx       = THREE.MathUtils.clamp(p.x + p.lane * HALF_W * 0.55, -HALF_W + 0.1, HALF_W - 0.1);
      const gy       = p.y - 0.12;
      const gz       = gVisible ? p.z - p.elimT * 0.3 : p.z + 0.3;
      dummy.position.set(gx, gy, gz);
      dummy.scale.setScalar(gVisible ? 0.28 + Math.sin(t * 3 + p.phase) * 0.04 : 0.001);
      dummy.rotation.y = p.phase * 1.4;
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(gi, dummy.matrix);
      buffers.current.ev[gi]         = p.ev * -1; // ghost carries inverted EV
      buffers.current.confidence[gi] = p.confidence * 0.5;
      buffers.current.state[gi]      = 1;
      buffers.current.zoneT[gi]      = p.zoneT;
    });

    meshRef.current.instanceMatrix.needsUpdate            = true;
    const g = meshRef.current.geometry;
    if (g.attributes.aEV)         g.attributes.aEV.needsUpdate         = true;
    if (g.attributes.aConfidence) g.attributes.aConfidence.needsUpdate = true;
    if (g.attributes.aState)      g.attributes.aState.needsUpdate      = true;
    if (g.attributes.aZoneT)      g.attributes.aZoneT.needsUpdate      = true;

    activityRef.current = THREE.MathUtils.lerp(activityRef.current, aliveCount / PARTICLE_COUNT, 0.04);
  });

  return (
    <instancedMesh ref={meshRef} args={[geo, mat, TOTAL_SLOTS]} frustumCulled={false} />
  );
}

// ─── Decision Boundary ── NEW ─────────────────────────────────────────────────
function DecisionBoundary({ activityRef }) {
  const clock    = useRef(0);
  const planeMat = useMemo(() => new THREE.MeshBasicMaterial({
    color:      new THREE.Color("#3D5AFE"),
    transparent: true, opacity: 0.04, side: THREE.DoubleSide, depthWrite: false,
  }), []);
  const edgeMat  = useMemo(() => new THREE.MeshBasicMaterial({
    color:      new THREE.Color("#facc15"),
    transparent: true, opacity: 0.35,
  }), []);

  useFrame((_, dt) => {
    clock.current += dt;
    const t        = clock.current;
    const activity = activityRef.current;
    planeMat.opacity = 0.025 + Math.sin(t * 1.4) * 0.015 + activity * 0.04;
    edgeMat.opacity  = 0.18  + Math.sin(t * 4.5) * 0.18  + activity * 0.15;
    edgeMat.color.setHSL(0.12 + Math.sin(t * 2) * 0.04, 0.9, 0.65);
  });

  return (
    <group position={[0, CENTER_Y, ZONE.DECISION.start]}>
      <mesh material={planeMat}>
        <planeGeometry args={[HALF_W * 2, CORRIDOR_H]} />
      </mesh>
      <mesh position={[0,  CORRIDOR_H / 2 - 0.01, 0]} material={edgeMat}><boxGeometry args={[HALF_W * 2, 0.014, 0.014]} /></mesh>
      <mesh position={[0, -CORRIDOR_H / 2 + 0.01, 0]} material={edgeMat}><boxGeometry args={[HALF_W * 2, 0.014, 0.014]} /></mesh>
      <mesh position={[-HALF_W, 0, 0]} material={edgeMat}><boxGeometry args={[0.014, CORRIDOR_H, 0.014]} /></mesh>
      <mesh position={[ HALF_W, 0, 0]} material={edgeMat}><boxGeometry args={[0.014, CORRIDOR_H, 0.014]} /></mesh>
      <pointLight color="#facc15" intensity={0.8} distance={8} decay={2} />
    </group>
  );
}

// ─── Model Core ───────────────────────────────────────────────────────────────
function ModelCore({ activityRef }) {
  const coreRef = useRef();
  const ringRef = useRef();
  const clock   = useRef(0);
  const coreMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color("#0a0a1a"), emissive: ACCENT_VEC, emissiveIntensity: 0.6,
    metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.92,
  }), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: ACCENT_VEC, transparent: true, opacity: 0.15, side: THREE.DoubleSide,
  }), []);

  useFrame((_, dt) => {
    clock.current += dt;
    const t = clock.current; const a = activityRef.current;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.06 + a * 0.12);
      coreRef.current.rotation.y += dt * 0.4;
      coreRef.current.rotation.x += dt * 0.15;
      coreMat.emissiveIntensity   = 0.5 + a * 0.8 + Math.sin(t * 1.8) * 0.15;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += dt * 0.55;
      ringRef.current.rotation.x  = Math.PI / 2 + Math.sin(t * 0.4) * 0.2;
      ringMat.opacity              = 0.08 + a * 0.18;
    }
  });

  return (
    <group position={[0, CENTER_Y, (ZONE.MODEL.start + ZONE.MODEL.end) / 2]}>
      <mesh ref={coreRef} material={coreMat}><icosahedronGeometry args={[0.38, 2]} /></mesh>
      <mesh ref={ringRef} material={ringMat}><torusGeometry args={[0.72, 0.018, 8, 64]} /></mesh>
      <mesh material={ringMat} rotation={[0, Math.PI / 3, 0]}><torusGeometry args={[0.58, 0.012, 8, 64]} /></mesh>
      <pointLight color={ACCENT} intensity={2.2} distance={14} decay={2} />
    </group>
  );
}

// ─── Feature Grid ─────────────────────────────────────────────────────────────
function FeatureGrid() {
  const clock = useRef(0);
  const mat   = useMemo(() => new THREE.MeshBasicMaterial({
    color: new THREE.Color("#1a2060"), transparent: true, opacity: 0.10, wireframe: true,
  }), []);
  useFrame((_, dt) => { clock.current += dt; mat.opacity = 0.07 + Math.sin(clock.current * 0.5) * 0.04; });
  return (
    <group position={[0, CENTER_Y, (ZONE.FEATURE.start + ZONE.FEATURE.end) / 2]}>
      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_W * 1.6, CORRIDOR_H * 0.8, 12, 8]} />
      </mesh>
    </group>
  );
}

// ─── Structure ────────────────────────────────────────────────────────────────
function Floor() {
  const rm = useMemo(() => makeNoiseTexture(512, 512, 18, 52, 14, 14), []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, -DEPTH / 2]}>
      <planeGeometry args={[HALF_W * 2 + 2, DEPTH + 14]} />
      <meshStandardMaterial color="#020208" metalness={0.72} roughness={0.08} roughnessMap={rm} />
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
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#020208", metalness: 0.0, roughness: 0.96, side: THREE.DoubleSide,
  }), []);
  const inset = PILLAR_W / 2 + 0.04;
  return (
    <>
      <mesh rotation-y={Math.PI / 2}  position={[-(HALF_W + inset), CENTER_Y, -DEPTH / 2]} material={mat}><planeGeometry args={[DEPTH + 14, CORRIDOR_H]} /></mesh>
      <mesh rotation-y={-Math.PI / 2} position={[ (HALF_W + inset), CENTER_Y, -DEPTH / 2]} material={mat}><planeGeometry args={[DEPTH + 14, CORRIDOR_H]} /></mesh>
    </>
  );
}
function Ribs({ activityRef }) {
  const pillarRef = useRef(); const beamRef = useRef(); const baseRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const clock = useRef(0);
  const structMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#09090f", metalness: 0.28, roughness: 0.64, emissive: ACCENT_VEC, emissiveIntensity: 0.003,
  }), []);
  const baseMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#05050a", metalness: 0.38, roughness: 0.72 }), []);

  useEffect(() => {
    for (let i = 0; i < RIB_COUNT; i++) {
      const z = -i * RIB_SPACING - 1.5;
      dummy.position.set(-HALF_W, CENTER_Y, z); dummy.scale.setScalar(1); dummy.updateMatrix(); pillarRef.current.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.set( HALF_W, CENTER_Y, z); dummy.updateMatrix(); pillarRef.current.setMatrixAt(i * 2 + 1, dummy.matrix);
      dummy.position.set(0, CEIL_Y - BEAM_H / 2, z); dummy.updateMatrix(); beamRef.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(-HALF_W, FLOOR_Y + 0.045, z); dummy.updateMatrix(); baseRef.current.setMatrixAt(i * 2, dummy.matrix);
      dummy.position.set( HALF_W, FLOOR_Y + 0.045, z); dummy.updateMatrix(); baseRef.current.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
    pillarRef.current.instanceMatrix.needsUpdate = true;
    beamRef.current.instanceMatrix.needsUpdate   = true;
    baseRef.current.instanceMatrix.needsUpdate   = true;
  }, [dummy]);

  useFrame((_, dt) => {
    clock.current += dt;
    structMat.emissiveIntensity = 0.003 + activityRef.current * 0.018 + Math.sin(clock.current * 1.1) * 0.004;
  });

  const beamSpan = HALF_W * 2 + PILLAR_W;
  return (
    <>
      <instancedMesh ref={pillarRef} args={[undefined, undefined, RIB_COUNT * 2]} material={structMat}><boxGeometry args={[PILLAR_W, CORRIDOR_H, PILLAR_D]} /></instancedMesh>
      <instancedMesh ref={beamRef}   args={[undefined, undefined, RIB_COUNT]}     material={structMat}><boxGeometry args={[beamSpan, BEAM_H, PILLAR_D]} /></instancedMesh>
      <instancedMesh ref={baseRef}   args={[undefined, undefined, RIB_COUNT * 2]} material={baseMat}><boxGeometry args={[PILLAR_W + 0.06, 0.09, PILLAR_D + 0.04]} /></instancedMesh>
    </>
  );
}
function EdgeStrips({ activityRef }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#000000", emissive: ACCENT_VEC, emissiveIntensity: 0.18 }), []);
  const clk = useRef(0);
  useFrame((_, dt) => { clk.current += dt; mat.emissiveIntensity = 0.12 + activityRef.current * 0.3 + Math.sin(clk.current * 0.9) * 0.06; });
  const len = DEPTH + 10; const z = -DEPTH / 2;
  return (
    <>
      <mesh position={[-HALF_W, FLOOR_Y + 0.006, z]} material={mat}><boxGeometry args={[0.022, 0.010, len]} /></mesh>
      <mesh position={[ HALF_W, FLOOR_Y + 0.006, z]} material={mat}><boxGeometry args={[0.022, 0.010, len]} /></mesh>
    </>
  );
}
function EndGlow() {
  const ref = useRef(); const clk = useRef(0);
  useFrame((_, dt) => { clk.current += dt; ref.current.material.opacity = 0.09 + Math.sin(clk.current * 0.18) * 0.012; });
  return (
    <mesh ref={ref} position={[0, CENTER_Y, -(DEPTH + 4)]}>
      <planeGeometry args={[HALF_W * 2, CORRIDOR_H]} />
      <meshBasicMaterial color={ACCENT_VEC} transparent opacity={0.09} />
    </mesh>
  );
}
function ForegroundSilhouettes() {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#010108", transparent: true, opacity: 0.92 }), []);
  return (
    <>
      <mesh position={[-HALF_W - 0.1, CENTER_Y, 3.8]} material={mat}><boxGeometry args={[0.9, CORRIDOR_H * 1.1, 0.5]} /></mesh>
      <mesh position={[ HALF_W + 0.1, CENTER_Y, 3.8]} material={mat}><boxGeometry args={[0.9, CORRIDOR_H * 1.1, 0.5]} /></mesh>
      <mesh position={[0, CEIL_Y + 0.12, 3.6]} material={mat}><boxGeometry args={[HALF_W * 2 + 2.2, 0.6, 0.5]} /></mesh>
      <mesh position={[0, FLOOR_Y - 0.1,  3.6]} material={mat}><boxGeometry args={[HALF_W * 2 + 2.2, 0.5, 0.5]} /></mesh>
    </>
  );
}
function DepthSilhouettes() {
  return (
    <>
      {[1,2,3,4].map(i => {
        const z = -(DEPTH + 4 + i * 5.5); const sc = 1 - i * 0.06; const op = Math.max(0.04, 0.32 - i * 0.07);
        return (
          <group key={i} position={[0, CENTER_Y, z]}>
            <mesh position={[0, CORRIDOR_H * 0.5 - 0.12, 0]}><boxGeometry args={[HALF_W * 2 * sc, 0.14, 0.12]} /><meshBasicMaterial color="#020210" transparent opacity={op} /></mesh>
            <mesh position={[-HALF_W * sc, 0, 0]}><boxGeometry args={[0.22, CORRIDOR_H * sc, 0.12]} /><meshBasicMaterial color="#020210" transparent opacity={op} /></mesh>
            <mesh position={[ HALF_W * sc, 0, 0]}><boxGeometry args={[0.22, CORRIDOR_H * sc, 0.12]} /><meshBasicMaterial color="#020210" transparent opacity={op} /></mesh>
          </group>
        );
      })}
      <mesh position={[0, CENTER_Y, -(DEPTH + 38)]}><planeGeometry args={[HALF_W * 2.8, CORRIDOR_H * 1.4]} /><meshBasicMaterial color="#010108" transparent opacity={0.82} /></mesh>
    </>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene() {
  const activityRef = useRef(0.5);
  return (
    <>
      <fog attach="fog" args={["#01010a", 12, 60]} />
      <color attach="background" args={["#010106"]} />
      <CameraController activityRef={activityRef} />
      <ambientLight intensity={0.001} />
      <pointLight position={[0, CENTER_Y + 0.5, -(DEPTH + 2)]} intensity={18} color={ACCENT} distance={110} decay={1.2} />
      <pointLight position={[-HALF_W * 0.6, CENTER_Y, -DEPTH * 0.4]} intensity={0.08} color="#0d0d18" distance={22} decay={2} />
      <Floor /><Ceiling /><Walls />
      <Ribs activityRef={activityRef} />
      <EdgeStrips activityRef={activityRef} />
      <ForegroundSilhouettes /><DepthSilhouettes /><EndGlow />
      <FeatureGrid />
      <ModelCore activityRef={activityRef} />
      <DecisionBoundary activityRef={activityRef} />
      <ParticleSystem activityRef={activityRef} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.06} luminanceSmoothing={0.88} intensity={0.62} mipmapBlur />
        <Vignette eskil={false} offset={0.08} darkness={1.55} />
        <ChromaticAberration offset={CA_OFFSET} />
      </EffectComposer>
    </>
  );
}

export default function CorridorCanvas({ mouseRef }) {
  return (
    <Canvas
      camera={{ position: [0, 0.05, 5.0], fov: 52, near: 0.1, far: 140 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => { gl.toneMappingExposure = 1.08; }}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}
    >
      <Scene />
    </Canvas>
  );
}