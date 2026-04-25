/**
 * Aurora background v4 — water-drop blobs with elastic collisions and merge.
 *
 * - Each blob has its own pan gesture detector (independently draggable)
 * - Soft water-drop deformation: scaleX/scaleY follows velocity direction
 * - Edge-based circle collision (proper r1 + r2 separation)
 * - High-speed collisions merge blobs into a bigger one with mixed color
 * - No snap-back home (blobs keep momentum, just gentle damping)
 */

import { View, StyleSheet, Dimensions } from "react-native";
import { useState, useCallback, useEffect } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  runOnJS,
} from "react-native-reanimated";
import { Colors } from "../../constants/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface BlobState {
  id: number;
  x: number;          // top-left of bounding box
  y: number;
  vx: number;
  vy: number;
  r: number;          // bounding box size (visual diameter)
  color: string;
  opacity: number;
  draggedBy: number;  // 1 = being dragged, 0 = free
  alive: number;      // 1 = present, 0 = absorbed (skip render)
}

const MERGE_VELOCITY = 6;     // |v| above which collision absorbs smaller blob
const MIN_BLOB_R = 90;
const MAX_BLOB_R = 350;
const MAX_BLOBS = 10;

let nextId = 1;

function initialBlobs(): BlobState[] {
  return [
    {
      id: nextId++, x: 30, y: 60, vx: 0.4, vy: 0.2, r: 200,
      color: Colors.violet, opacity: 0.32, draggedBy: 0, alive: 1,
    },
    {
      id: nextId++, x: SCREEN_W - 230, y: SCREEN_H * 0.28, vx: -0.5, vy: 0.3, r: 180,
      color: Colors.fuchsia, opacity: 0.28, draggedBy: 0, alive: 1,
    },
    {
      id: nextId++, x: 40, y: SCREEN_H * 0.6, vx: 0.3, vy: -0.4, r: 170,
      color: Colors.indigo, opacity: 0.26, draggedBy: 0, alive: 1,
    },
  ];
}

// Mix two RGB colors (hex strings) weighted by mass
function mixColors(a: string, b: string, weightA: number, weightB: number): string {
  "worklet";
  const parse = (c: string) => {
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

  // Sync JS id list with shared value when blobs are created/destroyed
  useEffect(() => {
    const t = setInterval(() => {
      const live = blobs.value.filter((b) => b.alive).map((b) => b.id);
      if (live.length !== ids.length || live.some((id, i) => id !== ids[i])) {
        setIds(live);
      }
    }, 200);
    return () => clearInterval(t);
  }, [ids]);

  // Physics tick on UI thread
  useFrameCallback((frame) => {
    "worklet";
    const dt = Math.min(frame.timeSincePreviousFrame ?? 16, 40) / 16;
    const arr = blobs.value;
    const next: BlobState[] = arr.map((b) => ({ ...b }));
    const n = next.length;

    // 1) Integrate position + velocity
    for (let i = 0; i < n; i++) {
      const b = next[i];
      if (!b.alive) continue;

      if (b.draggedBy === 0) {
        // very gentle damping (no return-home spring at all)
        b.vx *= 0.997;
        b.vy *= 0.997;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // bounce off screen edges with ~70% energy retention
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * 0.7; }
        if (b.x + b.r > SCREEN_W) { b.x = SCREEN_W - b.r; b.vx = -Math.abs(b.vx) * 0.7; }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * 0.7; }
        if (b.y + b.r > SCREEN_H) { b.y = SCREEN_H - b.r; b.vy = -Math.abs(b.vy) * 0.7; }
      }
    }

    // 2) Edge-based collisions and merge
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = next[i];
        const c = next[j];
        if (!a.alive || !c.alive) continue;

        // True edge collision: use full visual radius
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

          // Approach speed along collision normal
          const an = a.vx * nx + a.vy * ny;
          const bn = c.vx * nx + c.vy * ny;
          const approach = an - bn;

          // MERGE if collision is energetic enough and neither is being dragged
          if (
            approach > MERGE_VELOCITY &&
            a.draggedBy === 0 &&
            c.draggedBy === 0 &&
            (a.r + c.r) < MAX_BLOB_R * 1.5
          ) {
            // bigger absorbs smaller
            const big = a.r >= c.r ? a : c;
            const small = a.r >= c.r ? c : a;
            const mA = big.r * big.r;
            const mB = small.r * small.r;
            // new area = sum of areas → r = sqrt(rA^2 + rB^2)
            big.r = Math.min(MAX_BLOB_R, Math.sqrt(mA + mB));
            big.color = mixColors(big.color, small.color, mA, mB);
            big.opacity = Math.min(0.4, (big.opacity * mA + small.opacity * mB) / (mA + mB));
            // momentum conservation
            big.vx = (big.vx * mA + small.vx * mB) / (mA + mB);
            big.vy = (big.vy * mA + small.vy * mB) / (mA + mB);
            small.alive = 0;
            continue;
          }

          // Otherwise: regular elastic separation + bounce
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          c.x += nx * overlap;
          c.y += ny * overlap;

          if (approach > 0) {
            // mass = r^2 (2D circle area)
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
    if (live.length >= 3) return; // keep at least 3 visible
    arr.push({
      id: nextId++,
      x: Math.random() * (SCREEN_W - 200),
      y: Math.random() * (SCREEN_H - 200),
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      r: 150 + Math.random() * 50,
      color: [Colors.violet, Colors.fuchsia, Colors.indigo][Math.floor(Math.random() * 3)],
      opacity: 0.25,
      draggedBy: 0,
      alive: 1,
    });
    blobs.value = [...arr];
  }, []);

  // Auto-respawn check every 3s after merges
  useEffect(() => {
    const t = setInterval(respawnBlob, 3000);
    return () => clearInterval(t);
  }, [respawnBlob]);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {ids.map((id) => (
        <Blob key={id} id={id} blobs={blobs} />
      ))}
    </View>
  );
}

interface BlobViewProps {
  id: number;
  blobs: Animated.SharedValue<BlobState[]>;
}

function Blob({ id, blobs }: BlobViewProps) {
  const animStyle = useAnimatedStyle(() => {
    const arr = blobs.value;
    const b = arr.find((x) => x.id === id);
    if (!b || !b.alive) return { opacity: 0, width: 0, height: 0 };

    // Water-drop deformation: stretch in velocity direction, squash perpendicular
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const stretch = b.draggedBy ? 1.1 : Math.min(1.25, 1 + speed * 0.025);
    const squash = b.draggedBy ? 0.92 : Math.max(0.85, 1 - speed * 0.02);
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
        vx: e.changeX * 0.6,
        vy: e.changeY * 0.6,
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
        // fling preserves velocity scaled down
        vx: e.velocityX / 80,
        vy: e.velocityY / 80,
      };
      blobs.value = next;
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animStyle} />
    </GestureDetector>
  );
}
