import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { SessionSummary } from "../api/types";
import NodeTooltip from "./NodeTooltip";

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function scoreToColor(score: number | null): THREE.Color {
  const s = score ?? 50;
  const hi  = new THREE.Color(0x22c55e);
  const mid = new THREE.Color(0xf59e0b);
  const lo  = new THREE.Color(0xef4444);
  if (s >= 80) return hi;
  if (s >= 50) return mid.clone().lerp(hi, (s - 50) / 30);
  return lo.clone().lerp(mid, s / 50);
}

interface NodeData {
  id: string;
  session: SessionSummary;
  position: THREE.Vector3;
  scale: number;
  color: THREE.Color;
}

function computeLayout(sessions: SessionSummary[]): NodeData[] {
  if (sessions.length === 0) return [];

  const times = sessions.map((s) => new Date(s.started_at).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeRange = maxTime - minTime || 1;

  const allLines = sessions.map((s) => s.lines_added + s.lines_removed);
  const maxLines = Math.max(...allLines, 1);

  return sessions.map((s) => {
    const t = (new Date(s.started_at).getTime() - minTime) / timeRange;
    const x = (t * 2 - 1) * 28;

    const hash = hashStr(s.id);
    const y = (((hash & 0xff) / 255) - 0.5) * 18;
    const z = ((((hash >> 8) & 0xff) / 255) - 0.5) * 18;

    const lines = s.lines_added + s.lines_removed;
    const scale = 0.45 + (lines / maxLines) * 2.2;

    return {
      id: s.id,
      session: s,
      position: new THREE.Vector3(x, y, z),
      scale,
      color: scoreToColor(s.score),
    };
  });
}

// ─── Starfield ───────────────────────────────────────────────────────────────

function Starfield() {
  const geom = useMemo(() => {
    const count = 500;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 100 + Math.random() * 80;
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, []);

  return (
    <points>
      <primitive object={geom} attach="geometry" />
      <pointsMaterial size={0.15} color="#dde2ea" transparent opacity={0.22} sizeAttenuation />
    </points>
  );
}

// ─── Grid floor ──────────────────────────────────────────────────────────────

function GridFloor() {
  const grid = useMemo(() => new THREE.GridHelper(200, 60, 0x1a1f28, 0x111520), []);
  return <primitive object={grid} position={[0, -15, 0]} />;
}

// ─── Chronological data threads ──────────────────────────────────────────────

function DataThreads({ nodes }: { nodes: NodeData[] }) {
  const lineObj = useMemo(() => {
    if (nodes.length < 2) return null;
    const sorted = [...nodes].sort(
      (a, b) =>
        new Date(a.session.started_at).getTime() -
        new Date(b.session.started_at).getTime()
    );
    const verts: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const nodeA = sorted[i];
      const nodeB = sorted[i + 1];
      if (!nodeA || !nodeB) continue;
      const a = nodeA.position;
      const b = nodeB.position;
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x1e2a3a,
      transparent: true,
      opacity: 0.5,
    });
    return new THREE.LineSegments(geom, mat);
  }, [nodes]);

  if (!lineObj) return null;
  return <primitive object={lineObj} />;
}

// ─── Drifting dust particles ──────────────────────────────────────────────────

function DustParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const COUNT = 80;
  const { geom, base, phases } = useMemo(() => {
    const base   = new Float32Array(COUNT * 3);
    const phases = new Float32Array(COUNT * 3);
    const pos    = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      base[i * 3]       = (Math.random() - 0.5) * 60;
      base[i * 3 + 1]   = (Math.random() - 0.5) * 35;
      base[i * 3 + 2]   = (Math.random() - 0.5) * 40;
      phases[i * 3]     = Math.random() * Math.PI * 2;
      phases[i * 3 + 1] = Math.random() * Math.PI * 2;
      phases[i * 3 + 2] = Math.random() * Math.PI * 2;
      pos[i * 3]     = base[i * 3]     ?? 0;
      pos[i * 3 + 1] = base[i * 3 + 1] ?? 0;
      pos[i * 3 + 2] = base[i * 3 + 2] ?? 0;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return { geom, base, phases };
  }, []);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime * 0.06;
    const attr = geom.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      attr.setX(i, (base[i * 3] ?? 0)     + Math.sin(t + (phases[i * 3] ?? 0))     * 1.2);
      attr.setY(i, (base[i * 3 + 1] ?? 0) + Math.cos(t + (phases[i * 3 + 1] ?? 0)) * 0.8);
      attr.setZ(i, (base[i * 3 + 2] ?? 0) + Math.sin(t + (phases[i * 3 + 2] ?? 0)) * 0.6);
    }
    attr.needsUpdate = true;
  });

  return (
    <points>
      <primitive object={geom} attach="geometry" />
      <pointsMaterial size={0.07} color="#7a8394" transparent opacity={0.18} sizeAttenuation />
    </points>
  );
}

// ─── Session node ─────────────────────────────────────────────────────────────

interface SessionNodeProps {
  data: NodeData;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  hovered: boolean;
  anyHovered: boolean;
  reducedMotion: boolean;
}

function SessionNode({ data, onSelect, onHover, hovered, anyHovered, reducedMotion }: SessionNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (!mat) return;

    // Emissive: bright on hover, dim others when focus is active
    const targetEmissive = hovered ? 1.2 : anyHovered ? 0.05 : 0.25;
    mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * 0.1;

    // Opacity fade for non-hovered nodes
    const targetOpacity = anyHovered && !hovered ? 0.45 : 1.0;
    if (Math.abs(mat.opacity - targetOpacity) > 0.002) {
      mat.opacity += (targetOpacity - mat.opacity) * 0.08;
    }

    // Gentle bob — unique phase per node from its ID hash
    if (!reducedMotion) {
      const phase = (hashStr(data.id) / 0xffffffff) * Math.PI * 2;
      const bob = hovered ? 0 : Math.sin(clock.elapsedTime * 0.38 + phase) * 0.28;
      mesh.position.y += (data.position.y + bob - mesh.position.y) * 0.04;
    }

    // Scale pop on hover
    const targetScale = hovered ? data.scale * 1.18 : data.scale;
    const cs = mesh.scale.x;
    if (Math.abs(cs - targetScale) > 0.001) {
      mesh.scale.setScalar(cs + (targetScale - cs) * 0.1);
    }
  });

  return (
    <mesh
      ref={meshRef}
      // Use array form so mesh.position is independent from data.position
      position={[data.position.x, data.position.y, data.position.z]}
      scale={data.scale}
      onClick={(e) => { e.stopPropagation(); onSelect(data.id); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(data.id); document.body.style.cursor = "pointer"; }}
      onPointerOut={(e) => { e.stopPropagation(); onHover(null); document.body.style.cursor = ""; }}
    >
      <sphereGeometry args={[1, 24, 24]} />
      <meshStandardMaterial
        color={data.color}
        emissive={data.color}
        emissiveIntensity={0.25}
        roughness={0.3}
        metalness={0.1}
        transparent
        opacity={1}
      />
    </mesh>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────

interface SceneProps {
  sessions: SessionSummary[];
  onSelect: (id: string) => void;
  reducedMotion: boolean;
}

function Scene({ sessions, onSelect, reducedMotion }: SceneProps) {
  const nodes = useMemo(() => computeLayout(sessions), [sessions]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoveredNode = nodes.find((n) => n.id === hoveredId);

  const pendingNav = useRef<{ id: string; target: THREE.Vector3 } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Camera ease toward clicked node before navigating
  useFrame(() => {
    const nav = pendingNav.current;
    if (!nav) return;
    const dest = new THREE.Vector3(nav.target.x, nav.target.y, nav.target.z + 22);
    camera.position.lerp(dest, 0.08);
    if (camera.position.distanceTo(dest) < 2.5) {
      pendingNav.current = null;
      if (controlsRef.current) controlsRef.current.enabled = true;
      onSelect(nav.id);
    }
  });

  function handleNodeClick(id: string, nodePos: THREE.Vector3) {
    if (pendingNav.current) return;
    if (reducedMotion) { onSelect(id); return; }
    if (controlsRef.current) controlsRef.current.enabled = false;
    pendingNav.current = { id, target: nodePos.clone() };
    setHoveredId(null);
  }

  return (
    <>
      <color attach="background" args={["#07080a"]} />
      <fog attach="fog" args={["#07080a", 80, 200]} />

      <ambientLight intensity={0.4} />
      <pointLight position={[30, 30, 30]} intensity={1.6} />
      <pointLight position={[-25, -20, -25]} intensity={0.5} color="#7a8394" />

      <OrbitControls
        ref={controlsRef}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.25}
        enablePan={false}
        minDistance={18}
        maxDistance={120}
        makeDefault
      />

      <Starfield />
      <GridFloor />
      <DataThreads nodes={nodes} />
      <DustParticles reducedMotion={reducedMotion} />

      {nodes.map((node) => (
        <SessionNode
          key={node.id}
          data={node}
          onSelect={(id) => handleNodeClick(id, node.position)}
          onHover={setHoveredId}
          hovered={hoveredId === node.id}
          anyHovered={hoveredId !== null}
          reducedMotion={reducedMotion}
        />
      ))}

      {hoveredNode && (
        <NodeTooltip
          session={hoveredNode.session}
          position={[
            hoveredNode.position.x,
            hoveredNode.position.y + hoveredNode.scale + 2.0,
            hoveredNode.position.z,
          ]}
        />
      )}

      {!reducedMotion && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.3} intensity={1.5} mipmapBlur radius={0.6} />
        </EffectComposer>
      )}
    </>
  );
}

// ─── Canvas wrapper ───────────────────────────────────────────────────────────

interface Props {
  sessions: SessionSummary[];
  onSelect: (id: string) => void;
  reducedMotion: boolean;
}

export default function SessionConstellation({ sessions, onSelect, reducedMotion }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 55], fov: 58 }}
      dpr={[1, 2]}
      style={{ width: "100%", height: "100%" }}
      aria-label="Session constellation — interactive 3D view"
    >
      <Scene sessions={sessions} onSelect={onSelect} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
