/**
 * Aurora background v5 — centralized gesture handler.
 *
 * All blobs are draggable through ONE Pan gesture on the full-screen container.
 * onStart we hit-test (e.x, e.y) against current blob positions and pick the
 * closest match within radius. This fixes v4's bug where each blob's
 * GestureDetector used its layout box (always at top-left 0,0) so only one
 * blob caught touches.
 *
 * Other features:
 *  - Bigger blobs, water-drop deformation along velocity vector
 *  - Edge-based circle collisions (true r1+r2 separation)
 *  - High-impact merge with mass-weighted color mixing (area conservation)
 *  - Auto-respawn when fewer than 3 blobs remain
 *  - No snap-back home, just very soft damping
 */

import { View, StyleSheet, Dimensions } from "react-native";
import { useState, useCallback, useEffect } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
} from "react-native-reanimated";
import { Colors } from "../../constants/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface BlobState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  opacity: number;
  alive: number;       // 1 = visible, 0 = absorbed
}

const MERGE_VELOCITY = 5;
const MIN_BLOB_R = 90;
const MAX_BLOB_R = 360;

let nextId = 1;

function newBlob(x: number, y: number, r: number, color: string, opacity: number, vx = 0, vy = 0): BlobState {
  return {
    id: nextId++, x, y, r, color, opacity, vx, vy, alive: 1,
  };
}

function initialBlobs(): BlobState[] {
  return [
    newBlob(30, 60, 220, Colors.violet, 0.32, 0.4, 0.2),
    newBlob(SCREEN_W - 240, SCREEN_H * 0.28, 200, Colors.fuchsia, 0.28, -0.5, 0.3),
    newBlob(40, SCREEN_H * 0.6, 190, Colors.indigo, 0.26, 0.3, -0.4),
  ];
}

function mixColors(a: string, b: string, weightA: number, weightB: number): string {
  "worklet";
  const parse = (c: string): [number, number, number] => {
    if (c.startsWith("#")) {
      const v = parseInt(c.slice(1), 16);
      return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
    }
    return [124, 58, 237];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const total = weightA + weightB;
  const r = Math.round((ar * weightA + br * weightB) / total);
  const g = Math.round((ag * weightA + bg * weightB) / total);
  const bl = Math.round((ab * weightA + bb * weightB) / total);
  return "#" + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0");
}

export function AuroraBg() {
  const blobs = useSharedValue<BlobState[]>(initialBlobs());
  const draggedId = useSharedValue<number>(-1);
  const [ids, setIds] = useState<number[]>(() => blobs.value.map((b) => b.id));

  // Sync alive blob ids to JS state for rendering list (cheap diff every 200 ms)
  useEffect(() => {
    const t = setInterval(() => {
      const live = blobs.value.filter((b) => b.alive).map((b) => b.id);
      const same = live.length === ids.length && live.every((id, i) => id === ids[i]);
      if (!same) setIds(live);
    }, 200);
    return () => clearInterval(t);
  }, [ids]);

  // ---------- Physics tick ----------
  useFrameCallback((frame) => {
    "worklet";
    const dt = Math.min(frame.timeSincePreviousFrame ?? 16, 40) / 16;
    const arr = blobs.value;
    const next: BlobState[] = arr.map((b) => ({ ...b }));
    const n = next.length;

    // Integrate motion + edge bounce (skip dragged blob)
    for (let i = 0; i < n; i++) {
      const b = next[i];
      if (!b.alive) continue;
      if (b.id === draggedId.value) continue;

      b.vx *= 0.995;
      b.vy *= 0.995;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * 0.7; }
      if (b.x + b.r > SCREEN_W) { b.x = SCREEN_W - b.r; b.vx = -Math.abs(b.vx) * 0.7; }
      if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * 0.7; }
      if (b.y + b.r > SCREEN_H) { b.y = SCREEN_H - b.r; b.vy = -Math.abs(b.vy) * 0.7; }
    }

    // Pairwise edge collisions + merge
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = next[i];
        const c = next[j];
        if (!a.alive || !c.alive) continue;

        const rA = a.r * 0.5;
        const rB = c.r * 0.5;
        const acx = a.x + rA;
        const acy = a.y + rA;
        const ccx = c.x + rB;
        const ccy = c.y + rB;
        const dx = ccx - acx;
        const dy = ccy - acy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = rA + rB;

        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const an = a.vx * nx + a.vy * ny;
          const bn = c.vx * nx + c.vy * ny;
          const approach = an - bn;

          // MERGE on energetic collision (neither being dragged)
          if (
            approach > MERGE_VELOCITY &&
            a.id !== draggedId.value && c.id !== draggedId.value &&
            (a.r + c.r) < MAX_BLOB_R * 1.5
          ) {
            const big = a.r >= c.r ? a : c;
            const small = a.r >= c.r ? c : a;
            const mA = big.r * big.r;
            const mB = small.r * small.r;
            big.r = Math.min(MAX_BLOB_R, Math.sqrt(mA + mB));
            big.color = mixColors(big.color, small.color, mA, mB);
            big.opacity = Math.min(0.4, (big.opacity * mA + small.opacity * mB) / (mA + mB));
            big.vx = (big.vx * mA + small.vx * mB) / (mA + mB);
            big.vy = (big.vy * mA + small.vy * mB) / (mA + mB);
            small.alive = 0;
            continue;
          }

          // Edge separation
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          c.x += nx * overlap;
          c.y += ny * overlap;

          if (approach > 0) {
            const mA = a.r * a.r;
            const mB = c.r * c.r;
            const p = (2 * approach) / (mA + mB);
            a.vx -= p * mB * nx;
            a.vy -= p * mB * ny;
            c.vx += p * mA * nx;
            c.vy += p * mA * ny;
          }
        }
      }
    }

    blobs.value = next;
  });

  // ---------- Auto-respawn ----------
  const respawnBlob = useCallback(() => {
    const arr = blobs.value;
    const live = arr.filter((b) => b.alive);
    if (live.length >= 3) return;
    arr.push(newBlob(
      Math.random() * (SCREEN_W - 200),
      Math.random() * (SCREEN_H - 200),
      150 + Math.random() * 50,
      [Colors.violet, Colors.fuchsia, Colors.indigo][Math.floor(Math.random() * 3)],
      0.27,
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5,
    ));
    blobs.value = [...arr];
  }, []);

  useEffect(() => {
    const t = setInterval(respawnBlob, 3000);
    return () => clearInterval(t);
  }, [respawnBlob]);

  // ---------- Centralized Pan with hit-testing ----------
  const pan = Gesture.Pan()
    .onStart((e) => {
      "worklet";
      const arr = blobs.value;
      // Find blob whose visual circle contains the touch point (smallest distance)
      let bestId = -1;
      let bestDist = Infinity;
      for (const b of arr) {
        if (!b.alive) continue;
        const cx = b.x + b.r / 2;
        const cy = b.y + b.r / 2;
        const dx = e.x - cx;
        const dy = e.y - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < b.r / 2 && d < bestDist) {
          bestDist = d;
          bestId = b.id;
        }
      }
      draggedId.value = bestId;
    })
    .onChange((e) => {
      "worklet";
      const id = draggedId.value;
      if (id < 0) return;
      const arr = blobs.value;
      const idx = arr.findIndex((b) => b.id === id);
      if (idx < 0) return;
      const next = arr.slice();
      next[idx] = {
        ...next[idx],
        x: next[idx].x + e.changeX,
        y: next[idx].y + e.changeY,
        vx: e.changeX * 0.8,
        vy: e.changeY * 0.8,
      };
      blobs.value = next;
    })
    .onEnd((e) => {
      "worklet";
      const id = draggedId.value;
      if (id < 0) return;
      const arr = blobs.value;
      const idx = arr.findIndex((b) => b.id === id);
      if (idx >= 0) {
        const next = arr.slice();
        next[idx] = {
          ...next[idx],
          vx: e.velocityX / 90,
          vy: e.velocityY / 90,
        };
        blobs.value = next;
      }
      draggedId.value = -1;
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={StyleSheet.absoluteFillObject} pointerEvents="box-only">
        {ids.map((id) => (
          <BlobView key={id} id={id} blobs={blobs} />
        ))}
      </Animated.View>
    </GestureDetector>
  );
}

interface BlobViewProps {
  id: number;
  blobs: Animated.SharedValue<BlobState[]>;
}

function BlobView({ id, blobs }: BlobViewProps) {
  const animStyle = useAnimatedStyle(() => {
    const arr = blobs.value;
    const b = arr.find((x) => x.id === id);
    if (!b || !b.alive) return { opacity: 0, width: 0, height: 0 };

    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const stretch = Math.min(1.3, 1 + speed * 0.03);
    const squash = Math.max(0.82, 1 - speed * 0.025);
    const angle = Math.atan2(b.vy, b.vx);

    return {
      position: "absolute" as const,
      left: 0,
      top: 0,
      width: b.r,
      height: b.r,
      borderRadius: b.r / 2,
      backgroundColor: b.color,
      opacity: b.opacity,
      transform: [
        { translateX: b.x },
        { translateY: b.y },
        { rotate: `${angle}rad` },
        { scaleX: stretch },
        { scaleY: squash },
        { rotate: `${-angle}rad` },
      ],
    };
  });

  return <Animated.View style={animStyle} pointerEvents="none" />;
}
