import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { SessionSummary } from "../api/types";
import NodeTooltip from "./NodeTooltip";

// Deterministic hash from a string (session id) for stable jitter
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

interface SessionNodeProps {
  data: NodeData;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  hovered: boolean;
}

function SessionNode({ data, onSelect, onHover, hovered }: SessionNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const mat = meshRef.current?.material as THREE.MeshStandardMaterial | undefined;
    if (!mat) return;
    const target = hovered ? 0.65 : 0.18;
    mat.emissiveIntensity += (target - mat.emissiveIntensity) * 0.1;
  });

  return (
    <mesh
      ref={meshRef}
      position={data.position}
      scale={data.scale}
      onClick={(e) => { e.stopPropagation(); onSelect(data.id); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(data.id); document.body.style.cursor = "pointer"; }}
      onPointerOut={(e) => { e.stopPropagation(); onHover(null); document.body.style.cursor = ""; }}
    >
      <sphereGeometry args={[1, 20, 20]} />
      <meshStandardMaterial
        color={data.color}
        emissive={data.color}
        emissiveIntensity={0.18}
        roughness={0.35}
        metalness={0.05}
      />
    </mesh>
  );
}

interface SceneProps {
  sessions: SessionSummary[];
  onSelect: (id: string) => void;
  reducedMotion: boolean;
}

function Scene({ sessions, onSelect, reducedMotion }: SceneProps) {
  const nodes = useMemo(() => computeLayout(sessions), [sessions]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoveredNode = nodes.find((n) => n.id === hoveredId);

  return (
    <>
      <color attach="background" args={["#0a0c0f"]} />
      <fog attach="fog" args={["#0a0c0f", 70, 190]} />

      <ambientLight intensity={0.5} />
      <pointLight position={[25, 25, 25]} intensity={1.3} />
      <pointLight position={[-20, -15, -20]} intensity={0.4} color="#7a8394" />

      <OrbitControls
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.28}
        enablePan={false}
        minDistance={18}
        maxDistance={110}
        makeDefault
      />

      {nodes.map((node) => (
        <SessionNode
          key={node.id}
          data={node}
          onSelect={onSelect}
          onHover={setHoveredId}
          hovered={hoveredId === node.id}
        />
      ))}

      {hoveredNode && (
        <NodeTooltip
          session={hoveredNode.session}
          position={[
            hoveredNode.position.x,
            hoveredNode.position.y + hoveredNode.scale + 1.8,
            hoveredNode.position.z,
          ]}
        />
      )}

      {!reducedMotion && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.45} intensity={0.75} mipmapBlur />
        </EffectComposer>
      )}
    </>
  );
}

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
