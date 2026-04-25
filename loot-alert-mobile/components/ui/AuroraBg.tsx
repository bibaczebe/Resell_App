/**
 * Aurora background v6 — per-blob gesture detector with ANIMATED LAYOUT.
 *
 * Why this works where v5 didn't:
 *  - Reanimated's hit area for GestureDetector follows the wrapped view's
 *    layout, NOT its transform. Earlier versions positioned blobs via
 *    transform: translate which left the hit box pinned at top-left (0,0).
 *  - This version animates `left` and `top` in useAnimatedStyle.
 *    Hit area moves with the blob → tap anywhere on the visible blob works,
 *    in any position, after any drag, after merge, always.
 *  - Container is pointerEvents="box-none" so taps in empty space pass
 *    through to underlying UI. Each blob is pointerEvents="auto".
 *
 * Other features kept from v4/v5:
 *  - Water-drop deformation (inner View with transform stretch/squash)
 *  - Edge-based circle collision (true r1+r2 separation)
 *  - High-impact merge with weighted color mixing
 *  - Auto-respawn when fewer than 3 blobs alive
 *  - No snap-back home (very gentle damping only)
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
  alive: number;
  draggedBy: number;
}

const MERGE_VELOCITY = 5;
const MAX_BLOB_R = 360;

let nextId = 1;

function newBlob(x: number, y: number, r: number, color: string, opacity: number, vx = 0, vy = 0): BlobState {
  return { id: nextId++, x, y, r, color, opacity, vx, vy, alive: 1, draggedBy: 0 };
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
  const [ids, setIds] = useState<number[]>(() => blobs.value.map((b) => b.id));

  useEffect(() => {
    const t = setInterval(() => {
      const live = blobs.value.filter((b) => b.alive).map((b) => b.id);
      const same = live.length === ids.length && live.every((id, i) => id === ids[i]);
      if (!same) setIds(live);
    }, 200);
    return () => clearInterval(t);
  }, [ids]);

  // Physics on UI thread
  useFrameCallback((frame) => {
    "worklet";
    const dt = Math.min(frame.timeSincePreviousFrame ?? 16, 40) / 16;
    const arr = blobs.value;
    const next: BlobState[] = arr.map((b) => ({ ...b }));
    const n = next.length;

    for (let i = 0; i < n; i++) {
      const b = next[i];
      if (!b.alive || b.draggedBy) continue;

      b.vx *= 0.995;
      b.vy *= 0.995;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * 0.7; }
      if (b.x + b.r > SCREEN_W) { b.x = SCREEN_W - b.r; b.vx = -Math.abs(b.vx) * 0.7; }
      if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * 0.7; }
      if (b.y + b.r > SCREEN_H) { b.y = SCREEN_H - b.r; b.vy = -Math.abs(b.vy) * 0.7; }
    }

    // Pairwise edge collision + merge
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = next[i];
        const c = next[j];
        if (!a.alive || !c.alive) continue;

        const rA = a.r * 0.5;
        const rB = c.r * 0.5;
        const dx = (c.x + rB) - (a.x + rA);
        const dy = (c.y + rB) - (a.y + rA);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = rA + rB;

        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const an = a.vx * nx + a.vy * ny;
          const bn = c.vx * nx + c.vy * ny;
          const approach = an - bn;

          if (approach > MERGE_VELOCITY && !a.draggedBy && !c.draggedBy && (a.r + c.r) < MAX_BLOB_R * 1.5) {
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

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 9999 }]} pointerEvents="box-none">
      {ids.map((id) => (
        <Blob key={id} id={id} blobs={blobs} />
      ))}
    </View>
  );
}

interface BlobProps {
  id: number;
  blobs: Animated.SharedValue<BlobState[]>;
}

function Blob({ id, blobs }: BlobProps) {
  // Outer style animates LAYOUT (left, top, width, height) -> hit area follows
  const layoutStyle = useAnimatedStyle(() => {
    const arr = blobs.value;
    const b = arr.find((x) => x.id === id);
    if (!b || !b.alive) {
      return { left: 0, top: 0, width: 0, height: 0, opacity: 0 };
    }
    return {
      position: "absolute" as const,
      left: b.x,
      top: b.y,
      width: b.r,
      height: b.r,
      opacity: b.opacity,
    };
  });

  // Inner style applies the visual deformation (does not affect hit area)
  const visualStyle = useAnimatedStyle(() => {
    const arr = blobs.value;
    const b = arr.find((x) => x.id === id);
    if (!b || !b.alive) return { width: 0, height: 0 };
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const stretch = Math.min(1.3, 1 + speed * 0.03);
    const squash = Math.max(0.82, 1 - speed * 0.025);
    const angle = Math.atan2(b.vy, b.vx);
    return {
      width: "100%" as const,
      height: "100%" as const,
      borderRadius: b.r / 2,
      backgroundColor: b.color,
      transform: [
        { rotate: `${angle}rad` },
        { scaleX: stretch },
        { scaleY: squash },
        { rotate: `${-angle}rad` },
      ],
    };
  });

  const pan = Gesture.Pan()
    .onStart(() => {
      "worklet";
      const arr = blobs.value;
      const idx = arr.findIndex((b) => b.id === id);
      if (idx < 0) return;
      const next = arr.slice();
      next[idx] = { ...next[idx], draggedBy: 1, vx: 0, vy: 0 };
      blobs.value = next;
    })
    .onChange((e) => {
      "worklet";
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
      const arr = blobs.value;
      const idx = arr.findIndex((b) => b.id === id);
      if (idx < 0) return;
      const next = arr.slice();
      next[idx] = {
        ...next[idx],
        draggedBy: 0,
        vx: e.velocityX / 90,
        vy: e.velocityY / 90,
      };
      blobs.value = next;
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={layoutStyle}>
        <Animated.View style={visualStyle} pointerEvents="none" />
      </Animated.View>
    </GestureDetector>
  );
}
