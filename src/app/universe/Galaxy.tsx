"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, advance, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Sparkles, Line } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

// NOTE: drei <Text> (troika) force-loses the WebGL context on three r184, so
// all labels are canvas-texture sprites instead.
const labelCache = new Map<string, { texture: THREE.Texture; aspect: number }>();

function makeLabel(text: string, color: string, sub?: string) {
  const key = `${text}|${color}|${sub ?? ""}`;
  const cached = labelCache.get(key);
  if (cached) return cached;
  const font = 64;
  const subFont = 34;
  const pad = 24;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `600 ${font}px ui-monospace, Menlo, monospace`;
  const w = Math.ceil(ctx.measureText(text).width);
  ctx.font = `500 ${subFont}px ui-monospace, Menlo, monospace`;
  const subW = sub ? Math.ceil(ctx.measureText(sub).width) : 0;
  canvas.width = Math.max(w, subW) + pad * 2;
  canvas.height = font + (sub ? subFont + 18 : 0) + pad * 2;
  const c2 = canvas.getContext("2d")!;
  c2.textAlign = "center";
  c2.textBaseline = "top";
  c2.shadowColor = "rgba(0,0,0,0.9)";
  c2.shadowBlur = 12;
  c2.font = `600 ${font}px ui-monospace, Menlo, monospace`;
  c2.fillStyle = color;
  c2.fillText(text, canvas.width / 2, pad);
  if (sub) {
    c2.font = `500 ${subFont}px ui-monospace, Menlo, monospace`;
    c2.fillStyle = "#aeb7c6";
    c2.fillText(sub, canvas.width / 2, pad + font + 18);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const entry = { texture, aspect: canvas.width / canvas.height };
  labelCache.set(key, entry);
  return entry;
}

function TextSprite({
  text,
  color,
  sub,
  height = 1,
  position = [0, 0, 0] as [number, number, number],
  opacity = 1,
  screenSpace = false,
}: {
  text: string;
  color: string;
  sub?: string;
  height?: number;
  position?: [number, number, number];
  opacity?: number;
  /** Constant on-screen size regardless of camera distance. */
  screenSpace?: boolean;
}) {
  const { texture, aspect } = useMemo(() => makeLabel(text, color, sub), [text, color, sub]);
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={false}
        sizeAttenuation={!screenSpace}
      />
    </sprite>
  );
}
import type { UniverseSkill } from "@/lib/universe";

// ── deterministic layout ──────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shared radial-gradient glow texture (replaces bloom postprocessing, which
 *  is incompatible with three r184). Additive sprites read as light halos. */
let glowTexture: THREE.Texture | null = null;
function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.45)");
  g.addColorStop(0.6, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

function Glow({
  color,
  scale,
  opacity = 1,
}: {
  color: string;
  scale: number;
  opacity?: number;
}) {
  const texture = useMemo(() => getGlowTexture(), []);
  return (
    <sprite scale={[scale, scale, 1]} renderOrder={-1}>
      <spriteMaterial
        map={texture}
        color={color}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        opacity={opacity}
      />
    </sprite>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  framework: "#a8ff60",
  library: "#7cc7ff",
  api: "#ffb547",
  platform: "#c792ea",
  tool: "#64ffda",
  language: "#ff6e6e",
  concept: "#f8f4a6",
  "job-search": "#ff9ff3",
  "prompt-pack": "#ffd166",
  other: "#9aa7bd",
};

interface NodeLayout {
  skill: UniverseSkill;
  position: THREE.Vector3;
  color: string;
  size: number;
  /** Top-starred skills keep a permanent label as wayfinding landmarks. */
  landmark: boolean;
}

interface ClusterLayout {
  category: string;
  center: THREE.Vector3;
  color: string;
  radius: number;
  count: number;
}

function buildLayout(skills: UniverseSkill[]): {
  nodes: NodeLayout[];
  clusters: ClusterLayout[];
  byName: Map<string, NodeLayout>;
} {
  const byCategory = new Map<string, UniverseSkill[]>();
  for (const s of skills) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }
  const bySize = [...byCategory.keys()].sort(
    (a, b) => (byCategory.get(b)?.length ?? 0) - (byCategory.get(a)?.length ?? 0)
  );
  // Interleave large and small clusters around the ring so the two biggest
  // constellations never sit next to each other and visually merge.
  const categories: string[] = [];
  for (let lo = 0, hi = bySize.length - 1; lo <= hi; lo++, hi--) {
    categories.push(bySize[lo]);
    if (lo !== hi) categories.push(bySize[hi]);
  }

  const clusters: ClusterLayout[] = [];
  const nodes: NodeLayout[] = [];

  categories.forEach((cat, ci) => {
    const members = byCategory.get(cat) ?? [];
    const rng = mulberry32(hashStr(cat));
    const angle = (ci / categories.length) * Math.PI * 2 + rng() * 0.3;
    const radius = 3.5 + Math.sqrt(members.length) * 1.55;
    // Distance scales with the cluster's own radius so big constellations
    // push outward and clear both the core and their neighbors.
    const dist = 15 + radius * 1.7;
    // Halo placement: big constellations hug the galactic plane, small ones
    // float above/below it (alternating), so their labels stop crowding the
    // central band.
    const ySign = ci % 2 === 0 ? 1 : -1;
    const yMag = 3 + Math.max(0, 14 - radius) * 0.9 + rng() * 3;
    const center = new THREE.Vector3(
      Math.cos(angle) * dist,
      ySign * yMag,
      Math.sin(angle) * dist
    );
    const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other;
    clusters.push({ category: cat, center, color, radius, count: members.length });
  });

  // Relaxation pass: push any two constellations apart in the galactic plane
  // until each one (plus label headroom) has clear sky around it.
  for (let iter = 0; iter < 24; iter++) {
    let moved = false;
    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        const ca = clusters[a];
        const cb = clusters[b];
        const minDist = ca.radius + cb.radius + 9;
        const delta = new THREE.Vector3().subVectors(cb.center, ca.center);
        delta.y *= 0.45; // vertical offset only partly relieves visual overlap
        const d = delta.length();
        if (d < minDist && d > 0.001) {
          const push = delta.setY(0).normalize().multiplyScalar((minDist - d) / 2);
          ca.center.sub(push);
          cb.center.add(push);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  clusters.forEach((cluster) => {
    const { center, radius, color } = cluster;
    const members = byCategory.get(cluster.category) ?? [];

    // Golden-spiral sphere scatter inside the cluster.
    const golden = Math.PI * (3 - Math.sqrt(5));
    members.forEach((skill, i) => {
      const r2 = mulberry32(hashStr(skill.name));
      const t = members.length === 1 ? 0.5 : i / (members.length - 1);
      const y = 1 - t * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const jitter = 0.55 + r2() * 0.5;
      const p = new THREE.Vector3(
        Math.cos(theta) * rad * radius * jitter,
        y * radius * 0.7 * jitter,
        Math.sin(theta) * rad * radius * jitter
      ).add(center);
      const stars = skill.stars ?? 0;
      const size = 0.42 + Math.min(0.6, Math.log10(stars + 1) * 0.17) + r2() * 0.08;
      // Real constellations aren't monochrome: jitter each star's hue and
      // lightness a touch around the cluster color so neighborhoods shimmer
      // instead of reading as flat color blocks. Deterministic per skill.
      const tint = new THREE.Color(color);
      tint.offsetHSL((r2() - 0.5) * 0.06, (r2() - 0.5) * 0.12, (r2() - 0.5) * 0.14);
      nodes.push({ skill, position: p, color: `#${tint.getHexString()}`, size, landmark: false });
    });

    // Only the single brightest skill per constellation keeps a permanent
    // label — enough wayfinding without label soup at the home view.
    const clusterNodes = nodes.slice(-members.length);
    const brightest = [...clusterNodes].sort(
      (a, b) => (b.skill.stars ?? 0) - (a.skill.stars ?? 0)
    )[0];
    if (brightest) brightest.landmark = true;
  });

  // Recenter the whole galaxy on its star-weighted centroid so the home view
  // frames it symmetrically instead of drifting to one side.
  if (nodes.length > 0) {
    const centroid = new THREE.Vector3();
    for (const n of nodes) centroid.add(n.position);
    centroid.divideScalar(nodes.length);
    centroid.y = 0; // keep the galactic plane where the core sits
    for (const n of nodes) n.position.sub(centroid);
    for (const c of clusters) c.center.sub(centroid);
  }

  const byName = new Map(nodes.map((n) => [n.skill.name, n]));
  return { nodes, clusters, byName };
}

// ── camera rig ────────────────────────────────────────────────────────────

interface ViewRequest {
  id: number;
  target: THREE.Vector3;
  position: THREE.Vector3;
}

const HOME_VIEW = {
  target: new THREE.Vector3(0, 0, 0),
  position: new THREE.Vector3(0, 46, 100),
};

function CameraRig({
  view,
  controlsRef,
}: {
  view: ViewRequest;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const flying = useRef(false);
  const lastId = useRef(-1);

  useEffect(() => {
    if (view.id !== lastId.current) {
      lastId.current = view.id;
      flying.current = true;
    }
  }, [view]);

  // User grabbing the controls cancels the flight so orbiting never fights
  // the rig — the target stays pinned wherever the flight got to.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const stop = () => {
      flying.current = false;
    };
    c.addEventListener("start", stop);
    return () => c.removeEventListener("start", stop);
  });

  useFrame((_, dt) => {
    if (!flying.current) return;
    const c = controlsRef.current;
    if (!c) return;
    // Exponential damping in real time, so the flight converges identically
    // at 120fps or on a throttled background tab at 1fps.
    const k = 1 - Math.exp(-2.6 * dt);
    camera.position.lerp(view.position, k);
    c.target.lerp(view.target, k);
    c.update();
    if (
      camera.position.distanceTo(view.position) < 0.05 &&
      c.target.distanceTo(view.target) < 0.05
    ) {
      flying.current = false;
    }
  });
  return null;
}

// ── scene pieces ──────────────────────────────────────────────────────────

function SkillNode({
  node,
  state,
  onSelect,
}: {
  node: NodeLayout;
  state: "normal" | "focused" | "related" | "dimmed";
  onSelect: (s: UniverseSkill) => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const glowMat = useRef<THREE.SpriteMaterial>(null);
  const glowSprite = useRef<THREE.Sprite>(null);
  const [hovered, setHovered] = useState(false);
  const phase = useMemo(() => hashStr(node.skill.name) % 1000, [node.skill.name]);
  const glowTex = useMemo(() => getGlowTexture(), []);
  // Current visibility fade — interaction handlers consult this so players
  // can't click/hover stars that have melted away near the camera.
  const fadeRef = useRef(1);

  useFrame(({ clock, camera }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime + phase;
    const active = state === "focused" || hovered;
    const pulse = 1 + Math.sin(t * 2.1) * 0.05;
    // Dimmed siblings shrink to faint distant stars instead of lingering as
    // full-size translucent blobs around the focused skill.
    const targetScale =
      (state === "focused"
        ? 1.9
        : hovered
          ? 1.5
          : state === "related"
            ? 1.15
            : state === "dimmed"
              ? 0.45
              : 1) * pulse;
    m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, targetScale, 0.12));
    // Nodes drifting close to the camera melt away instead of blocking the
    // view as giant blobs (skip the focused node — that's the destination).
    const camDist = camera.position.distanceTo(node.position);
    // Focused and related (orbit) nodes stay visible; everything else melts
    // away over a generous range so the inside of a cluster never becomes a
    // wall of washed-out blobs.
    const nearFade =
      state === "focused" || state === "related"
        ? 1
        : THREE.MathUtils.smoothstep(camDist, 10, 26);
    // Universal "windshield" fade: ANY node (even a related one in orbit)
    // that ends up almost on top of the camera would fill the frame with a
    // giant blocky halo. Melt it away inside ~7 units. The focused node is
    // exempt — the camera parks ~10 units from it anyway.
    const closeFade =
      state === "focused" ? 1 : THREE.MathUtils.smoothstep(camDist, 3.5, 7.5);
    const fade = nearFade * closeFade;
    fadeRef.current = fade;
    // If the star melts away mid-hover, drop the hover state so its label and
    // pointer cursor don't haunt the empty sky.
    if (fade < 0.25 && hovered) {
      setHovered(false);
      document.body.style.cursor = "auto";
    }
    // Idle twinkle: each star shimmers on its own rhythm (phase-offset sine
    // pair so it never looks metronomic). Muted for focused/hovered states
    // where steady brightness reads better.
    const twinkle =
      state === "normal" && !hovered
        ? 1 + (Math.sin(t * 1.7) * 0.6 + Math.sin(t * 2.9 + 1.3) * 0.4) * 0.22
        : 1;
    if (mat.current) {
      const targetGlow =
        (state === "dimmed" && !hovered ? 0.3 : active ? 2.8 : state === "related" ? 1.9 : 1.1) *
        twinkle;
      mat.current.emissiveIntensity = THREE.MathUtils.lerp(
        mat.current.emissiveIntensity,
        targetGlow,
        0.1
      );
      const targetOpacity = (state === "dimmed" && !hovered ? 0.3 : 1) * fade;
      mat.current.opacity = THREE.MathUtils.lerp(mat.current.opacity, targetOpacity, 0.12);
    }
    if (glowMat.current) {
      const targetHalo =
        (state === "dimmed" && !hovered ? 0.08 : active ? 0.95 : state === "related" ? 0.65 : 0.4) *
        fade *
        twinkle;
      glowMat.current.opacity = THREE.MathUtils.lerp(
        glowMat.current.opacity,
        targetHalo,
        0.1
      );
    }
    if (glowSprite.current) {
      const haloScale = node.size * (active ? 9 : 5.5) * pulse;
      const cur = glowSprite.current.scale.x;
      const next = THREE.MathUtils.lerp(cur, haloScale, 0.1);
      glowSprite.current.scale.set(next, next, 1);
    }
  });

  const showLabel =
    hovered || state === "focused" || state === "related" || (node.landmark && state === "normal");
  const isLandmarkOnly =
    node.landmark && state === "normal" && !hovered;

  return (
    <group position={node.position}>
      <mesh
        ref={mesh}
        onClick={(e) => {
          if (fadeRef.current < 0.25) return;
          e.stopPropagation();
          onSelect(node.skill);
        }}
        onPointerOver={(e) => {
          if (fadeRef.current < 0.25) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <icosahedronGeometry args={[node.size, 1]} />
        <meshStandardMaterial
          ref={mat}
          color={node.color}
          emissive={node.color}
          emissiveIntensity={1.1}
          roughness={0.25}
          metalness={0.1}
          transparent
          opacity={1}
        />
      </mesh>
      <sprite ref={glowSprite} scale={[node.size * 5.5, node.size * 5.5, 1]} renderOrder={-1}>
        <spriteMaterial
          ref={glowMat}
          map={glowTex}
          color={node.color}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={0.4}
        />
      </sprite>
      {/* invisible bigger hit-target so small nodes are easy to click */}
      <mesh
        visible={false}
        onClick={(e) => {
          if (fadeRef.current < 0.25) return;
          e.stopPropagation();
          onSelect(node.skill);
        }}
        onPointerOver={(e) => {
          if (fadeRef.current < 0.25) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[Math.max(node.size * 2.2, 1.05), 8, 8]} />
      </mesh>
      {showLabel && (
        <TextSprite
          text={node.skill.name}
          color={state === "focused" || hovered ? "#ffffff" : node.color}
          // Hover/focus reveals a context line under the name — which
          // constellation it lives in and its star count, so you can judge a
          // skill before committing to the flight over.
          sub={
            hovered || state === "focused"
              ? `${node.skill.category}${node.skill.stars ? `  ·  ★ ${node.skill.stars}` : ""}`
              : undefined
          }
          // Two-line labels need extra sprite height or the name shrinks to
          // make room for the sub line.
          height={
            state === "focused"
              ? 0.072
              : hovered
                ? 0.05
                : isLandmarkOnly
                  ? 0.02
                  : 0.03
          }
          // Two-line labels anchor higher so the sub line clears the halo glow.
          position={[
            0,
            node.size + (hovered || state === "focused" ? 2.3 : 1.4),
            0,
          ]}
          opacity={isLandmarkOnly ? 0.55 : 1}
          screenSpace
        />
      )}
    </group>
  );
}

function ClusterDecor({ cluster, muted }: { cluster: ClusterLayout; muted: boolean }) {
  const decor = useRef<THREE.Group>(null);
  // Hide the nebula haze + sparkles when the camera flies inside the
  // constellation — up close they just wash out the whole frame. While a
  // skill is focused, mute every constellation's haze so neighboring nebula
  // sprites (they're huge) can't bleed washed-out bands into the close-up.
  useFrame(({ camera }) => {
    if (!decor.current) return;
    const d = camera.position.distanceTo(cluster.center);
    const vis =
      THREE.MathUtils.smoothstep(d, cluster.radius * 1.1, cluster.radius * 2.2) *
      (muted ? 0.18 : 1);
    decor.current.visible = vis > 0.02;
    decor.current.scale.setScalar(Math.max(vis, 0.001));
  });
  return (
    <group position={cluster.center}>
      <group ref={decor}>
        <Sparkles
          count={Math.min(60, 14 + cluster.count * 3)}
          scale={cluster.radius * 2.4}
          size={2.6}
          speed={0.32}
          color={cluster.color}
          opacity={0.55}
        />
        {/* soft nebula haze behind the cluster */}
        <Glow color={cluster.color} scale={cluster.radius * 3.6} opacity={0.16} />
        {/* Label weight follows constellation size: big clusters announce
            themselves, 1-skill categories whisper and stop colliding. Inside
            the decor group so the banner melts away with the haze when the
            camera dives into the constellation (labels skip depth testing, so
            up close it would otherwise stamp itself over the whole frame). */}
        <TextSprite
          text={cluster.category.toUpperCase()}
          sub={`${cluster.count} skill${cluster.count === 1 ? "" : "s"}`}
          color={cluster.color}
          height={1.1 + cluster.radius * 0.19}
          position={[0, cluster.radius + 2.6, 0]}
          opacity={cluster.count <= 2 ? 0.6 : 0.92}
        />
      </group>
    </group>
  );
}

function GalacticCore({ muted }: { muted: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const aura = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.12;
      ref.current.rotation.z = clock.elapsedTime * 0.05;
    }
    // The bright wireframe sun pokes into focused close-ups from the frame
    // edge — let it cool to an ember while a skill is selected.
    if (coreMat.current) {
      coreMat.current.opacity = THREE.MathUtils.lerp(
        coreMat.current.opacity,
        muted ? 0.25 : 1,
        0.1
      );
      coreMat.current.emissiveIntensity = THREE.MathUtils.lerp(
        coreMat.current.emissiveIntensity,
        muted ? 0.6 : 2.2,
        0.1
      );
    }
    // While a skill is focused, the core's huge halo reads as a washed-out
    // band across the close-up — shrink it to a distant pinpoint instead.
    const target = muted ? 0.18 : 1;
    if (aura.current) {
      const s = THREE.MathUtils.lerp(aura.current.scale.x, target, 0.1);
      aura.current.scale.setScalar(s);
    }
    if (light.current) {
      light.current.intensity = THREE.MathUtils.lerp(
        light.current.intensity,
        muted ? 120 : 420,
        0.1
      );
    }
  });
  return (
    <group>
      <mesh ref={ref}>
        <icosahedronGeometry args={[2.4, 2]} />
        <meshStandardMaterial
          ref={coreMat}
          color="#a8ff60"
          emissive="#a8ff60"
          emissiveIntensity={2.2}
          wireframe
          transparent
          opacity={1}
        />
      </mesh>
      <group ref={aura}>
        <Glow color="#a8ff60" scale={26} opacity={0.8} />
        <Glow color="#ffffff" scale={9} opacity={0.9} />
        <Sparkles count={80} scale={10} size={4} speed={0.5} color="#a8ff60" opacity={0.7} />
      </group>
      <pointLight ref={light} intensity={420} distance={140} color="#cfffa8" />
    </group>
  );
}

function RelationWaypoint({
  name,
  color,
  position,
  onHop,
}: {
  name: string;
  color: string;
  position: THREE.Vector3;
  onHop: (name: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const fadeRef = useRef(1);
  // Windshield fade: a waypoint whose direction points back at the camera ends
  // up almost in our face — its label would blow up across the whole frame.
  useFrame(({ camera }) => {
    if (!group.current) return;
    const camDist = camera.position.distanceTo(position);
    const fade = THREE.MathUtils.smoothstep(camDist, 4.5, 9);
    fadeRef.current = fade;
    group.current.scale.setScalar(THREE.MathUtils.lerp(group.current.scale.x, fade, 0.2));
    group.current.visible = fade > 0.04;
    if (fade < 0.25 && hovered) {
      setHovered(false);
      document.body.style.cursor = "auto";
    }
  });
  return (
    <group ref={group} position={position}>
      <mesh
        onClick={(e) => {
          if (fadeRef.current < 0.25) return;
          e.stopPropagation();
          onHop(name);
        }}
        onPointerOver={(e) => {
          if (fadeRef.current < 0.25) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[hovered ? 0.3 : 0.2, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 1 : 0.85} />
      </mesh>
      {/* generous invisible hit target */}
      <mesh
        visible={false}
        onClick={(e) => {
          if (fadeRef.current < 0.25) return;
          e.stopPropagation();
          onHop(name);
        }}
        onPointerOver={(e) => {
          if (fadeRef.current < 0.25) return;
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.9, 8, 8]} />
      </mesh>
      <Glow color={color} scale={hovered ? 1.6 : 1.1} opacity={0.45} />
      <TextSprite
        text={name}
        color={color}
        height={hovered ? 0.62 : 0.5}
        position={[0, 0.72, 0]}
        opacity={hovered ? 1 : 0.75}
      />
    </group>
  );
}

function RelationLines({
  focusNode,
  byName,
  onHop,
}: {
  focusNode: NodeLayout | null;
  byName: Map<string, NodeLayout>;
  onHop: (name: string) => void;
}) {
  if (!focusNode) return null;
  return (
    <>
      {focusNode.skill.related.map((name) => {
        const other = byName.get(name);
        if (!other) return null;
        const dist = focusNode.position.distanceTo(other.position);
        // Distant relations vanish off-frame — park a clickable waypoint star a
        // few units down the line so every relation has a visible, hoppable end.
        const far = dist > 18;
        const waypoint = far
          ? other.position
              .clone()
              .sub(focusNode.position)
              .normalize()
              .multiplyScalar(6.5)
              .add(focusNode.position)
          : null;
        return (
          <group key={name}>
            <Line
              points={[focusNode.position, other.position]}
              color={focusNode.color}
              transparent
              opacity={0.4}
              lineWidth={1.4}
              dashed
              dashSize={0.8}
              gapSize={0.4}
            />
            {waypoint && (
              <RelationWaypoint name={name} color={other.color} position={waypoint} onHop={onHop} />
            )}
          </group>
        );
      })}
    </>
  );
}

// ── overlay UI ────────────────────────────────────────────────────────────

function InstallBlock({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const origin =
    typeof window !== "undefined" && window.location.hostname !== "localhost"
      ? window.location.origin
      : "https://skillmake.xyz";
  const cmd = `curl --create-dirs -fsSL ${origin}/i/${name} -o ~/.claude/skills/${name}/SKILL.md`;
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(cmd).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="w-full text-left mono text-[11px] leading-relaxed bg-[#0b0d10] border border-[#2f3540] rounded-lg px-3 py-2.5 text-[#a8ff60] hover:border-[#a8ff60]/60 transition break-all"
      title="Copy install command"
    >
      <span className="text-[#5a6271] select-none">$ </span>
      {cmd}
      <span className="block mt-1 text-[10px] text-[#5a6271]">
        {copied ? "copied ✓" : "click to copy"}
      </span>
    </button>
  );
}

function DetailPanel({
  skill,
  color,
  onClose,
  onHop,
}: {
  skill: UniverseSkill;
  color: string;
  onClose: () => void;
  onHop: (name: string) => void;
}) {
  const [shared, setShared] = useState(false);
  return (
    <aside className="absolute top-16 right-4 bottom-4 w-[min(400px,calc(100vw-2rem))] z-10 flex flex-col rounded-xl border border-[#232830] bg-[#111418]/90 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/60">
      <div className="px-5 pt-5 pb-4 border-b border-[#232830] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mono text-[17px] font-semibold break-words" style={{ color }}>
            {skill.name}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span
              className="mono text-[10px] px-2 py-0.5 rounded-full border"
              style={{ color, borderColor: `${color}55`, background: `${color}14` }}
            >
              {skill.category}
            </span>
            <span className="mono text-[10px] px-2 py-0.5 rounded-full border border-[#2f3540] text-[#8b94a3]">
              {skill.audience}
            </span>
            {skill.stars != null && (
              <span className="mono text-[10px] px-2 py-0.5 rounded-full border border-[#2f3540] text-[#ffb547]">
                ★ {skill.stars.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              const url = `${window.location.origin}/universe?skill=${encodeURIComponent(skill.name)}`;
              navigator.clipboard.writeText(url).catch(() => {});
              setShared(true);
              setTimeout(() => setShared(false), 1500);
            }}
            className={`mono text-xs border rounded-md px-2 py-1 transition ${
              shared
                ? "text-[#0b0d10] bg-[#a8ff60] border-[#a8ff60]"
                : "text-[#5a6271] hover:text-[#a8ff60] border-[#232830]"
            }`}
            aria-label="Copy link to this skill"
            title="Copy link to this skill"
          >
            {shared ? "copied!" : "share"}
          </button>
          <button
            onClick={onClose}
            className="mono text-xs text-[#5a6271] hover:text-[#e8ecf1] border border-[#232830] rounded-md px-2 py-1 transition"
            aria-label="Close panel"
          >
            esc
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <p className="text-[13px] leading-relaxed text-[#c7cedb]">{skill.description}</p>

        <InstallBlock name={skill.name} />

        {skill.whenToUse.length > 0 && (
          <section>
            <h3 className="mono text-[10px] tracking-widest text-[#5a6271] mb-2">WHEN TO USE</h3>
            <ul className="space-y-1.5">
              {skill.whenToUse.map((w, i) => (
                <li key={i} className="text-[12px] leading-snug text-[#aeb7c6] flex gap-2">
                  <span style={{ color }} className="shrink-0">
                    ▸
                  </span>
                  {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        {skill.concepts.length > 0 && (
          <section>
            <h3 className="mono text-[10px] tracking-widest text-[#5a6271] mb-2">KEY CONCEPTS</h3>
            <div className="space-y-2.5">
              {skill.concepts.slice(0, 4).map((c) => (
                <div key={c.term}>
                  <div className="mono text-[11px] text-[#e8ecf1]">{c.term}</div>
                  <div className="text-[11px] leading-snug text-[#8b94a3] mt-0.5 line-clamp-3">
                    {c.explanation}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {skill.gotchas.length > 0 && (
          <section>
            <h3 className="mono text-[10px] tracking-widest text-[#5a6271] mb-2">
              GOTCHAS ({skill.gotchas.length})
            </h3>
            <ul className="space-y-1.5">
              {skill.gotchas.slice(0, 3).map((g, i) => (
                <li key={i} className="text-[11px] leading-snug text-[#8b94a3] flex gap-2">
                  <span className="text-[#ffb547] shrink-0">!</span>
                  {g}
                </li>
              ))}
            </ul>
          </section>
        )}

        {skill.related.length > 0 && (
          <section>
            <h3 className="mono text-[10px] tracking-widest text-[#5a6271] mb-2">
              KEEP EXPLORING →
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {skill.related.map((r) => (
                <button
                  key={r}
                  onClick={() => onHop(r)}
                  className="mono text-[11px] px-2.5 py-1 rounded-md border border-[#2f3540] text-[#aeb7c6] hover:text-[#0b0d10] hover:bg-[#a8ff60] hover:border-[#a8ff60] transition"
                >
                  {r}
                </button>
              ))}
            </div>
          </section>
        )}

        {skill.sourceUrl && (
          <a
            href={skill.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mono text-[11px] text-[#7cc7ff] hover:underline"
          >
            source ↗
          </a>
        )}
      </div>
    </aside>
  );
}

// ── main component ────────────────────────────────────────────────────────

export default function Galaxy({ skills }: { skills: UniverseSkill[] }) {
  const { nodes, clusters, byName } = useMemo(() => buildLayout(skills), [skills]);
  const [selected, setSelected] = useState<UniverseSkill | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  // Legend hover → spotlight that constellation, dim everything else.
  const [hoverCat, setHoverCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<ViewRequest>({
    id: 0,
    target: HOME_VIEW.target.clone(),
    position: HOME_VIEW.position.clone(),
  });
  const viewId = useRef(0);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const flyTo = useCallback((target: THREE.Vector3, position: THREE.Vector3) => {
    viewId.current += 1;
    setView({ id: viewId.current, target, position });
  }, []);

  const selectSkill = useCallback(
    (skill: UniverseSkill) => {
      const node = byName.get(skill.name);
      if (!node) return;
      setSelected(skill);
      setTrail((t) => [...t.filter((n) => n !== skill.name), skill.name].slice(-7));
      const cluster = clusters.find((c) => c.category === skill.category);
      const away = node.position
        .clone()
        .sub(cluster ? cluster.center : new THREE.Vector3())
        .normalize();
      if (away.lengthSq() < 0.01) away.set(0, 0.3, 1).normalize();
      // Park distance scales with the star: big landmarks get more breathing
      // room so their 1.9x focus scale + halo never dominates the frame.
      const park = 9 + node.size * 3.5;
      const camPos = node.position
        .clone()
        .add(away.multiplyScalar(park))
        .add(new THREE.Vector3(0, 2.6, 0));
      flyTo(node.position.clone(), camPos);
      // Shareable deep link — /universe?skill=name
      const url = new URL(window.location.href);
      url.searchParams.set("skill", skill.name);
      window.history.replaceState(null, "", url);
    },
    [byName, clusters, flyTo]
  );

  const goHome = useCallback(() => {
    setSelected(null);
    flyTo(HOME_VIEW.target.clone(), HOME_VIEW.position.clone());
    const url = new URL(window.location.href);
    url.searchParams.delete("skill");
    window.history.replaceState(null, "", url);
  }, [flyTo]);

  // Deep link: /universe?skill=name auto-focuses that star on arrival.
  // The "already fired" guard is set inside the timeout (not at effect run) so
  // StrictMode's mount→cleanup→remount cycle doesn't strand the deep link.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current) return;
    const name = new URLSearchParams(window.location.search).get("skill");
    if (!name) return;
    const node = byName.get(name);
    if (!node) return;
    // Small delay so the canvas mounts and the flight is visible.
    const t = setTimeout(() => {
      deepLinked.current = true;
      selectSkill(node.skill);
    }, 600);
    return () => clearTimeout(t);
  }, [byName, selectSkill]);

  // Type-to-fly search: substring match on name/category, prefix matches first.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return skills
      .filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
      .sort((a, b) => {
        const ap = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        return ap - bp || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [query, skills]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      } else if (e.key === "Enter" && document.activeElement === searchRef.current) {
        if (matches[0]) {
          selectSkill(matches[0]);
          setQuery("");
          searchRef.current?.blur();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [matches, selectSkill]);

  const flyToCluster = useCallback(
    (cluster: ClusterLayout) => {
      setSelected(null);
      const dir = cluster.center.clone().normalize();
      const camPos = cluster.center
        .clone()
        .add(dir.multiplyScalar(cluster.radius * 2.4))
        .add(new THREE.Vector3(0, cluster.radius * 0.9, 0));
      flyTo(cluster.center.clone(), camPos);
    },
    [flyTo]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") goHome();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goHome]);

  // Debug/automation hook: lets QA tooling drive the universe.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__skillUniverse = {
      select: (name: string) => {
        const n = byName.get(name);
        if (n) selectSkill(n.skill);
      },
      home: goHome,
      skills: () => [...byName.keys()],
      // Manually advance + render N frames. Lets tooling capture screenshots
      // while the tab is occluded and requestAnimationFrame is paused.
      frame: (n = 1) => {
        for (let i = 0; i < n; i++) advance(performance.now() + i * 16.7);
      },
      debug: () => {
        const c = controlsRef.current;
        const cam = c?.object;
        const node = selected ? byName.get(selected.name) : null;
        return {
          cam: cam ? cam.position.toArray().map((v) => +v.toFixed(1)) : null,
          target: c ? c.target.toArray().map((v) => +v.toFixed(1)) : null,
          wantPos: view.position.toArray().map((v) => +v.toFixed(1)),
          wantTarget: view.target.toArray().map((v) => +v.toFixed(1)),
          nodePos: node ? node.position.toArray().map((v) => +v.toFixed(1)) : null,
          selected: selected?.name ?? null,
        };
      },
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__skillUniverse;
    };
  }, [byName, selectSkill, goHome, selected, view]);

  const focusNode = selected ? byName.get(selected.name) ?? null : null;
  const relatedSet = useMemo(
    () => new Set(selected ? selected.related : []),
    [selected]
  );

  return (
    <div className="fixed inset-0 z-20 bg-[#06070a]">
      <Canvas
        camera={{ position: HOME_VIEW.position.toArray(), fov: 55, near: 0.1, far: 600 }}
        dpr={1}
        onPointerMissed={() => setSelected(null)}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#06070a"]} />
        <fog attach="fog" args={["#06070a", 90, 320]} />
        <ambientLight intensity={0.35} />
        <Stars radius={260} depth={80} count={4500} factor={5} saturation={0.4} fade speed={0.6} />

        <GalacticCore muted={!!selected} />
        {clusters.map((c) => (
          <ClusterDecor
            key={c.category}
            cluster={c}
            muted={!!selected || (!!hoverCat && c.category !== hoverCat)}
          />
        ))}
        {nodes.map((n) => {
          const state = !selected
            ? hoverCat && n.skill.category !== hoverCat
              ? "dimmed"
              : "normal"
            : n.skill.name === selected.name
              ? "focused"
              : relatedSet.has(n.skill.name)
                ? "related"
                : "dimmed";
          return <SkillNode key={n.skill.name} node={n} state={state} onSelect={selectSkill} />;
        })}
        <RelationLines
          focusNode={focusNode}
          byName={byName}
          onHop={(name) => {
            const n = byName.get(name);
            if (n) selectSkill(n.skill);
          }}
        />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          autoRotate={!selected}
          autoRotateSpeed={0.35}
          minDistance={4}
          maxDistance={220}
          makeDefault
        />
        <CameraRig view={view} controlsRef={controlsRef} />
      </Canvas>

      {/* CSS vignette (postprocessing-free) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 52%, rgba(3,4,6,0.55) 100%)",
        }}
      />

      {/* top-left: title + legend */}
      <div className="absolute top-16 left-4 z-10 max-w-[240px] space-y-3 pointer-events-none">
        <div className="pointer-events-auto rounded-xl border border-[#232830] bg-[#111418]/85 backdrop-blur-md px-4 py-3">
          <div className="mono text-[13px] font-semibold text-[#e8ecf1]">
            skill <span className="text-[#a8ff60]">universe</span>
          </div>
          <div className="mono text-[10px] text-[#5a6271] mt-1 leading-relaxed">
            {skills.length} skills · {clusters.length} constellations
            <br />
            drag to orbit · scroll to zoom
            <br />
            click any star to explore
          </div>
          <div className="relative mt-2.5">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search skills…  ( / )"
              className="w-full mono text-[11px] bg-[#0b0d10] border border-[#2f3540] rounded-lg px-2.5 py-1.5 text-[#e8ecf3] placeholder-[#5a6271] outline-none focus:border-[#a8ff60]/60 transition"
            />
            {matches.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-[#2f3540] bg-[#0e1114]/95 backdrop-blur-md overflow-hidden z-20">
                {matches.map((s, i) => {
                  const color = byName.get(s.name)?.color ?? "#aeb7c6";
                  return (
                    <button
                      key={s.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectSkill(s);
                        setQuery("");
                        searchRef.current?.blur();
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-white/5 transition ${
                        i === 0 ? "bg-white/[0.03]" : ""
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: color, boxShadow: `0 0 5px ${color}` }}
                      />
                      <span className="mono text-[10px] text-[#e8ecf3] truncate flex-1">
                        {s.name}
                      </span>
                      <span className="mono text-[9px] text-[#5a6271] shrink-0">{s.category}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="pointer-events-auto rounded-xl border border-[#232830] bg-[#111418]/85 backdrop-blur-md px-3 py-2.5 space-y-0.5">
          {clusters.map((c) => (
            <button
              key={c.category}
              onClick={() => flyToCluster(c)}
              onMouseEnter={() => setHoverCat(c.category)}
              onMouseLeave={() => setHoverCat(null)}
              className="w-full flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-white/5 transition text-left"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }}
              />
              <span className="mono text-[11px] text-[#aeb7c6] flex-1 truncate">{c.category}</span>
              <span className="mono text-[10px] text-[#5a6271]">{c.count}</span>
            </button>
          ))}
          <button
            onClick={goHome}
            className="w-full mt-1 mono text-[10px] text-[#5a6271] hover:text-[#a8ff60] border-t border-[#232830] pt-1.5 transition text-center"
          >
            ⌂ reset view
          </button>
        </div>
      </div>

      {/* breadcrumb trail */}
      {trail.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 max-w-[90vw]">
          <div className="flex items-center gap-1.5 rounded-full border border-[#232830] bg-[#111418]/85 backdrop-blur-md px-3 py-1.5 overflow-x-auto">
            <span className="mono text-[10px] text-[#5a6271] shrink-0">trail</span>
            {trail.map((name, i) => {
              const nodeColor = byName.get(name)?.color ?? "#aeb7c6";
              const isCurrent = selected?.name === name;
              return (
                <span key={name} className="flex items-center gap-1.5 shrink-0">
                  {i > 0 && <span className="text-[#2f3540] text-[10px]">→</span>}
                  <button
                    onClick={() => {
                      const n = byName.get(name);
                      if (n) selectSkill(n.skill);
                    }}
                    className={`mono text-[10px] px-1.5 py-0.5 rounded-full transition flex items-center gap-1.5 border ${
                      isCurrent
                        ? "text-[#e8ecf3] border-transparent"
                        : "text-[#aeb7c6] border-transparent hover:border-[#2f3540] hover:text-[#e8ecf3]"
                    }`}
                    style={isCurrent ? { background: `${nodeColor}26`, borderColor: `${nodeColor}66` } : undefined}
                  >
                    {/* constellation-colored star dot — instant wayfinding */}
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: nodeColor, boxShadow: `0 0 5px ${nodeColor}` }}
                    />
                    {name}
                  </button>
                </span>
              );
            })}
            <button
              onClick={() => setTrail([])}
              title="Clear trail"
              className="mono text-[10px] text-[#5a6271] hover:text-[#ff7a7a] shrink-0 pl-1 border-l border-[#232830] transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {selected && focusNode && (
        <DetailPanel
          skill={selected}
          color={focusNode.color}
          onClose={goHome}
          onHop={(name) => {
            const n = byName.get(name);
            if (n) selectSkill(n.skill);
          }}
        />
      )}
    </div>
  );
}
