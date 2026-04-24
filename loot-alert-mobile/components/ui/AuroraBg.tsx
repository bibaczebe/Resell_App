/**
 * Aurora background with agar.io-style physics.
 *
 * Single-loop 60 fps frame callback on the UI thread (react-native-reanimated).
 * State (position, velocity, radius) lives in a single shared array of objects.
 * We mutate it in place inside runOnUI and also re-read it with useDerivedValue
 * per-blob to drive transforms (no React re-renders per frame).
 *
 * Features:
 *  - Drag a blob to fling it with momentum – it NEVER snaps back home.
 *  - Double tap splits a blob into two smaller ones travelling apart,
 *    like ejecting mass in agar.io.
 *  - Ball-to-ball elastic collisions with mass proportional to r^2.
 *  - Soft gravity pulls blobs back toward their home drift point so they
 *    don't drift off-screen forever, but only gently (feels floaty).
 */

import { View, StyleSheet, Dimensions } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  runOnJS,
  runOnUI,
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
  homeX: number;
  homeY: number;
  color: string;
  opacity: number;
  draggedBy: number; // timestamp, 0 if free
}

let nextId = 1;

const INITIAL: BlobState[] = [
  {
    id: nextId++,
    x: 40, y: 40, vx: 0.6, vy: 0.2, r: 120,
    homeX: 40, homeY: 40, color: Colors.violet, opacity: 0.28, draggedBy: 0,
  },
  {
    id: nextId++,
    x: SCREEN_W - 160, y: SCREEN_H * 0.28, vx: -0.5, vy: 0.3, r: 110,
    homeX: SCREEN_W - 160, homeY: SCREEN_H * 0.28, color: Colors.fuchsia, opacity: 0.22, draggedBy: 0,
  },
  {
    id: nextId++,
    x: 20, y: SCREEN_H * 0.6, vx: 0.3, vy: -0.4, r: 100,
    homeX: 20, homeY: SCREEN_H * 0.6, color: Colors.indigo, opacity: 0.2, draggedBy: 0,
  },
];

function clamp(v: number, lo: number, hi: number) {
  "worklet";
  return v < lo ? lo : v > hi ? hi : v;
}

export function AuroraBg() {
  // blobs shared array — single source of truth on UI thread
  const blobs = useSharedValue<BlobState[]>(INITIAL);
  // signal for JS to re-render wrapper when count changes (split)
  const [version, setVersion] = useState(0);

  // Per-blob transforms – created once per count
  const current = blobs.value;

  // physics step
  useFrameCallback((frame) => {
    "worklet";
    const dt = Math.min(frame.timeSincePreviousFrame ?? 16, 40) / 16; // normalize to ~60fps step
    const arr = blobs.value;
    const n = arr.length;
    const next = arr.slice();

    // --- Integrate motion + soft home-return + edge bounce ---
    for (let i = 0; i < n; i++) {
      const b = { ...next[i] };
      if (b.draggedBy === 0) {
        // gentle pull toward home (extremely soft)
        const dx = b.homeX - b.x;
        const dy = b.homeY - b.y;
        b.vx += dx * 0.00006 * dt;
        b.vy += dy * 0.00006 * dt;
        // damping
        b.vx *= 0.995;
        b.vy *= 0.995;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // bounce off screen edges (treat blob edge, not center)
      if (b.x < -b.r * 0.5) { b.x = -b.r * 0.5; b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x + b.r > SCREEN_W + b.r * 0.5) { b.x = SCREEN_W - b.r * 0.5; b.vx = -Math.abs(b.vx) * 0.6; }
      if (b.y < -b.r * 0.5) { b.y = -b.r * 0.5; b.vy = Math.abs(b.vy) * 0.6; }
      if (b.y + b.r > SCREEN_H + b.r * 0.5) { b.y = SCREEN_H - b.r * 0.5; b.vy = -Math.abs(b.vy) * 0.6; }

      next[i] = b;
    }

    // --- Ball-to-ball elastic collisions ---
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = next[i];
        const c = next[j];
        const cx = a.x + a.r / 2;
        const cy = a.y + a.r / 2;
        const dx = (c.x + c.r / 2) - cx;
        const dy = (c.y + c.r / 2) - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // effective radius for collision — use half of drawn size (the dense core)
        const rA = a.r * 0.45;
        const rB = c.r * 0.45;
        const minDist = rA + rB;
        if (dist > 0 && dist < minDist) {
          // separate to remove overlap
          const overlap = (minDist - dist) * 0.5;
          const nxv = dx / dist;
          const nyv = dy / dist;
          next[i] = { ...a, x: a.x - nxv * overlap, y: a.y - nyv * overlap };
          next[j] = { ...c, x: c.x + nxv * overlap, y: c.y + nyv * overlap };

          // elastic collision response, mass = r^2
          const mA = rA * rA;
          const mB = rB * rB;
          const an = a.vx * nxv + a.vy * nyv;
          const bn = c.vx * nxv + c.vy * nyv;
          if (an - bn > 0) continue; // moving apart already
          const p = (2 * (an - bn)) / (mA + mB);
          next[i].vx = a.vx - p * mB * nxv;
          next[i].vy = a.vy - p * mB * nyv;
          next[j].vx = c.vx + p * mA * nxv;
          next[j].vy = c.vy + p * mA * nyv;
        }
      }
    }

    blobs.value = next;
  });

  const splitBlob = useCallback((id: number) => {
    runOnUI((bid: number) => {
      "worklet";
      const arr = blobs.value;
      const idx = arr.findIndex((b) => b.id === bid);
      if (idx < 0) return;
      const src = arr[idx];
      if (src.r < 55) return; // too small to split further

      const newR = src.r * 0.7;
      const ejectSpeed = 5;
      const angle = Math.random() * Math.PI * 2;
      const vxOff = Math.cos(angle) * ejectSpeed;
      const vyOff = Math.sin(angle) * ejectSpeed;

      const a = {
        ...src,
        r: newR,
        vx: src.vx + vxOff,
        vy: src.vy + vyOff,
      };
      const b = {
        ...src,
        id: -Math.floor(Math.random() * 1_000_000_000),
        r: newR,
        vx: src.vx - vxOff,
        vy: src.vy - vyOff,
        opacity: Math.max(0.1, src.opacity * 0.85),
      };
      const next = arr.slice();
      next[idx] = a;
      next.push(b);
      if (next.length > 10) next.shift();
      blobs.value = next;
      runOnJS(setVersion)(Date.now());
    })(id);
  }, []);

  // JS id list kept in sync with shared value (only changes on split)
  const [ids, setIds] = useState<number[]>(INITIAL.map((b) => b.id));
  useEffect(() => {
    const t = setInterval(() => {
      const currentIds = blobs.value.map((b) => b.id);
      if (
        currentIds.length !== ids.length ||
        currentIds.some((id, i) => id !== ids[i])
      ) {
        setIds(currentIds);
      }
    }, 250);
    return () => clearInterval(t);
  }, [ids]);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {ids.map((id, i) => (
        <BlobView key={id} index={i} id={id} blobs={blobs} onSplit={splitBlob} />
      ))}
    </View>
  );
}

interface BlobViewProps {
  id: number;
  index: number;
  blobs: Animated.SharedValue<BlobState[]>;
  onSplit: (id: number) => void;
}

function BlobView({ id, index, blobs, onSplit }: BlobViewProps) {
  const style = useAnimatedStyle(() => {
    const arr = blobs.value;
    const b = arr[index] ?? arr.find((x) => x.id === id);
    if (!b) return { opacity: 0 };
    return {
      position: "absolute",
      left: 0,
      top: 0,
      width: b.r,
      height: b.r,
      borderRadius: b.r / 2,
      backgroundColor: b.color,
      opacity: b.opacity,
      transform: [{ translateX: b.x }, { translateY: b.y }],
    };
  });

  const startPos = useRef({ x: 0, y: 0 });

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
      next[idx] = { ...next[idx], x: next[idx].x + e.changeX, y: next[idx].y + e.changeY };
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
        vx: e.velocityX / 60,
        vy: e.velocityY / 60,
      };
      blobs.value = next;
    });

  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    "worklet";
    runOnJS(onSplit)(id);
  });

  const gesture = Gesture.Exclusive(doubleTap, pan);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={style} />
    </GestureDetector>
  );
}
