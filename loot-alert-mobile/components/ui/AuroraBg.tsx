import { View, StyleSheet, Dimensions } from "react-native";
import { useState, useCallback, useEffect } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
  runOnJS,
  withSpring,
  withDecay,
} from "react-native-reanimated";
import { Colors } from "../../constants/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const BLOB_SIZE = 280;

interface BlobInstance {
  id: number;
  color: string;
  initialX: number;
  initialY: number;
  driftAmp: number;
  driftDuration: number;
  opacity: number;
}

interface BlobProps extends BlobInstance {
  onDoubleTap: (instance: BlobInstance) => void;
}

function Blob({ id, color, initialX, initialY, driftAmp, driftDuration, opacity, onDoubleTap }: BlobProps) {
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);
  const drifting = useSharedValue(1);
  const scale = useSharedValue(0.2);

  // mount "pop" animation
  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 80 });
  }, []);

  // ambient drift (breathing)
  useEffect(() => {
    driftX.value = withRepeat(
      withTiming(driftAmp, { duration: driftDuration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    driftY.value = withRepeat(
      withTiming(driftAmp * 0.7, { duration: driftDuration * 1.3, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    return () => {
      cancelAnimation(driftX);
      cancelAnimation(driftY);
    };
  }, []);

  const pan = Gesture.Pan()
    .onStart(() => {
      drifting.value = 0;
      cancelAnimation(x);
      cancelAnimation(y);
    })
    .onChange((e) => {
      x.value = x.value + e.changeX;
      y.value = y.value + e.changeY;
    })
    .onEnd((e) => {
      // fling with momentum decay (NO snap-back home)
      x.value = withDecay({
        velocity: e.velocityX,
        deceleration: 0.995,
        clamp: [-BLOB_SIZE * 1.5, SCREEN_W + BLOB_SIZE * 0.5],
      });
      y.value = withDecay({
        velocity: e.velocityY,
        deceleration: 0.995,
        clamp: [-BLOB_SIZE * 1.5, SCREEN_H + BLOB_SIZE * 0.5],
      });
      drifting.value = 1;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      runOnJS(onDoubleTap)({
        id: Date.now() + Math.random(),
        color,
        initialX: x.value + 40,
        initialY: y.value + 40,
        driftAmp,
        driftDuration,
        opacity: opacity * 0.75,
      });
      scale.value = withSpring(1.2, { damping: 4, stiffness: 200 }, () => {
        scale.value = withSpring(1, { damping: 8, stiffness: 100 });
      });
    });

  const gesture = Gesture.Race(doubleTap, pan);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value + driftX.value * drifting.value },
      { translateY: y.value + driftY.value * drifting.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.blob, { backgroundColor: color, opacity }, animStyle]} />
    </GestureDetector>
  );
}

export function AuroraBg() {
  const [blobs, setBlobs] = useState<BlobInstance[]>([
    { id: 1, color: Colors.violet, initialX: -60, initialY: -40, driftAmp: 30, driftDuration: 4500, opacity: 0.28 },
    { id: 2, color: Colors.fuchsia, initialX: SCREEN_W - 220, initialY: SCREEN_H * 0.25, driftAmp: 35, driftDuration: 5800, opacity: 0.22 },
    { id: 3, color: Colors.indigo, initialX: -40, initialY: SCREEN_H * 0.6, driftAmp: 25, driftDuration: 5200, opacity: 0.2 },
  ]);

  const handleDoubleTap = useCallback((clone: BlobInstance) => {
    setBlobs((prev) => {
      // cap at 8 blobs to avoid performance issues
      if (prev.length >= 8) return prev;
      return [...prev, clone];
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {blobs.map((b) => (
        <Blob key={b.id} {...b} onDoubleTap={handleDoubleTap} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute",
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
    top: 0,
    left: 0,
  },
});
