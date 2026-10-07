"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * The empty stage's picture in 3D (Mario, 7 Oct 2026): the Cover Flow row of
 * SkeletonDrift redrawn as clay, in the style of a soft 3D document icon.
 * White paper slides with a rounded edge, glossy blue bars standing out of
 * them, studio light and a soft shadow under the row. Same rhythm as the CSS
 * version: three in view, the middle one larger and facing you, a step to
 * the right every 4.2s, and the middle slide builds its bars in as it lands
 * (the ones arriving from the left are blank, those leaving keep theirs).
 * The place in the row runs on the session's clock (sessionEpoch), so a
 * reload picks up where it was. Loaded only where WebGL and motion are on;
 * SkeletonDrift draws the flat version otherwise.
 */

const STEP_MS = 4200;
const MOVE_S = 1.2;
const N = 7;
const HALF = 3;
const SPACING = 2.45;
const W = 2.0;
const H = 1.125;
const BLUE = "#1C7CFF";

type Bar = { x: number; y: number; w: number; h: number };

/** Each slide's bars, in slide units from the top-left corner (W x H). */
const LAYOUTS: Bar[][] = [
  // Cover: title lines at the bottom.
  [
    { x: 0.18, y: 0.62, w: 1.3, h: 0.13 },
    { x: 0.18, y: 0.8, w: 0.9, h: 0.13 },
    { x: 0.18, y: 0.97, w: 0.55, h: 0.07 },
  ],
  // Bullets: a heading and three points.
  [
    { x: 0.18, y: 0.18, w: 0.8, h: 0.12 },
    { x: 0.18, y: 0.44, w: 0.09, h: 0.09 },
    { x: 0.34, y: 0.44, w: 1.3, h: 0.09 },
    { x: 0.18, y: 0.62, w: 0.09, h: 0.09 },
    { x: 0.34, y: 0.62, w: 1.05, h: 0.09 },
    { x: 0.18, y: 0.8, w: 0.09, h: 0.09 },
    { x: 0.34, y: 0.8, w: 1.2, h: 0.09 },
  ],
  // Chart: a heading and five columns.
  [
    { x: 0.18, y: 0.18, w: 0.7, h: 0.12 },
    ...[0.32, 0.55, 0.42, 0.72, 0.6].map((h, i) => ({ x: 0.2 + i * 0.33, y: 0.98 - h * 0.62, w: 0.22, h: h * 0.62 })),
  ],
  // Columns: a heading and three short columns of text.
  [
    { x: 0.18, y: 0.18, w: 0.65, h: 0.12 },
    ...[0, 1, 2].flatMap((c) => [
      { x: 0.18 + c * 0.58, y: 0.5, w: 0.42, h: 0.09 },
      { x: 0.18 + c * 0.58, y: 0.66, w: 0.5, h: 0.06 },
      { x: 0.18 + c * 0.58, y: 0.78, w: 0.44, h: 0.06 },
    ]),
  ],
];
const CARDS = [0, 1, 2, 3, 0, 1, 2];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
/** Row place -half..half of card i at step s. */
const placeOf = (i: number, s: number) => ((((i + s) % N) + N) % N) - HALF;

function pose(pos: number) {
  const d = Math.abs(pos);
  return {
    x: pos * SPACING,
    z: d === 0 ? 0.35 : -0.25 * Math.min(d, 2),
    rotY: pos === 0 ? 0 : pos < 0 ? 0.3 : -0.3,
    scale: d === 0 ? 1.12 : 0.88,
  };
}

function Slide({ index, epoch, paper }: { index: number; epoch: number; paper: string }) {
  const group = useRef<THREE.Group>(null);
  const bars = useRef<THREE.Group>(null);
  const layout = LAYOUTS[CARDS[index]];
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = (Date.now() - epoch) / STEP_MS;
    const step = Math.floor(t);
    const p = Math.min(1, ((t - step) * STEP_MS) / 1000 / MOVE_S);
    const from = placeOf(index, step - 1);
    const to = placeOf(index, step);
    // The card that wraps from the right end to the left one jumps unseen.
    const wrap = from === HALF && to === -HALF;
    const k = wrap ? 1 : ease(p);
    const a = pose(from);
    const b = pose(to);
    g.position.set(a.x + (b.x - a.x) * k, 0, a.z + (b.z - a.z) * k);
    g.rotation.y = a.rotY + (b.rotY - a.rotY) * k;
    g.scale.setScalar(a.scale + (b.scale - a.scale) * k);
    g.visible = Math.abs(to) <= 1 || (Math.abs(from) <= 1 && !wrap && p < 1);
    // Bars: none left of the middle, built in at the middle, kept to the right.
    const bs = bars.current;
    if (!bs) return;
    bs.children.forEach((bar, j) => {
      let s = 1;
      if (to < 0) s = 0;
      else if (to === 0) {
        const local = ((t - step) * STEP_MS) / 1000 - 0.55 - j * 0.08;
        s = local <= 0 ? 0 : local >= 0.45 ? 1 : backOut(local / 0.45);
      }
      bar.scale.set(1, 1, Math.max(0.001, s));
      bar.visible = s > 0.001;
    });
  });
  return (
    <group ref={group}>
      {/* The sheet: soft clay paper with a rounded edge. */}
      <RoundedBox args={[W, H, 0.035]} radius={0.017} smoothness={4} castShadow>
        <meshPhysicalMaterial color={paper} roughness={0.5} clearcoat={0.3} clearcoatRoughness={0.45} />
      </RoundedBox>
      {/* A second sheet behind, a little turned: a deck, not a card. */}
      <RoundedBox args={[W, H, 0.03]} radius={0.014} smoothness={4} position={[0.06, -0.045, -0.07]} rotation={[0, 0, -0.03]}>
        <meshPhysicalMaterial color={paper} roughness={0.5} clearcoat={0.2} />
      </RoundedBox>
      <group ref={bars} position={[-W / 2, H / 2, 0.0175]}>
        {layout.map((bar, j) => (
          <group key={j} position={[bar.x + bar.w / 2, -(bar.y + bar.h / 2), 0]}>
            <RoundedBox args={[bar.w, bar.h, 0.07]} radius={Math.min(bar.h, bar.w, 0.13) / 2.2} smoothness={5} position={[0, 0, 0.035]}>
              <meshPhysicalMaterial color={BLUE} roughness={0.18} clearcoat={1} clearcoatRoughness={0.12} />
            </RoundedBox>
          </group>
        ))}
      </group>
    </group>
  );
}

export default function SkeletonDrift3D({ epoch, dark }: { epoch: number; dark: boolean }) {
  const paper = dark ? "#EEF2F8" : "#F7F9FC";
  const slides = useMemo(() => Array.from({ length: N }, (_, i) => i), []);
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.25, 6.2], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={dark ? 0.8 : 0.9} />
      <directionalLight position={[-3, 4, 5]} intensity={1.9} />
      <directionalLight position={[4, -1, 3]} intensity={0.35} color="#cfe6ff" />
      {slides.map((i) => (
        <Slide key={i} index={i} epoch={epoch} paper={paper} />
      ))}
      <ContactShadows position={[0, -0.95, 0]} opacity={dark ? 0.55 : 0.28} scale={12} blur={2.6} far={2.2} resolution={512} color="#000000" />
      {/* Studio light from shapes, no HDR file to fetch. */}
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={2.2} position={[0, 3, 4]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-5, 0, 2]} rotation-y={Math.PI / 2.5} scale={[4, 3, 1]} />
        <Lightformer form="circle" intensity={1.5} position={[4, 1, 3]} scale={2} />
      </Environment>
    </Canvas>
  );
}
