import { View, StyleSheet, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { Colors } from "../../constants/colors";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const BLOB_SIZE = 280;

interface BlobProps {
  color: string;
  homeX: number;
  homeY: number;
  driftAmp: number;
  driftDuration: number;
  opacity: number;
}

function InteractiveBlob({ color, homeX, homeY, driftAmp, driftDuration, opacity }: BlobProps) {
  // Position offset from home position
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const drifting = useSharedValue(1); // 0 when dragging, 1 when free

  // Gentle ambient drift (breathing/floating feel)
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);

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
  }, [driftAmp, driftDuration]);

  // Track last velocity for fling effect
  const pan = Gesture.Pan()
    .onStart(() => {
      drifting.value = 0;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      // Jelly spring bounce back home, carrying velocity
      translateX.value = withSpring(0, {
        damping: 6,
        stiffness: 40,
        mass: 1.2,
        velocity: e.velocityX,
      });
      translateY.value = withSpring(0, {
        damping: 6,
        stiffness: 40,
        mass: 1.2,
        velocity: e.velocityY,
      });
      drifting.value = 1;
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + driftX.value * drifting.value },
      { translateY: translateY.value + driftY.value * drifting.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.blob,
          {
            backgroundColor: color,
            opacity,
            top: homeY,
            left: homeX,
          },
          animStyle,
        ]}
      />
    </GestureDetector>
  );
}

export function AuroraBg() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <InteractiveBlob
        color={Colors.violet}
        homeX={-60}
        homeY={-40}
        driftAmp={30}
        driftDuration={4500}
        opacity={0.28}
      />
      <InteractiveBlob
        color={Colors.fuchsia}
        homeX={SCREEN_W - 220}
        homeY={SCREEN_H * 0.25}
        driftAmp={35}
        driftDuration={5800}
        opacity={0.22}
      />
      <InteractiveBlob
        color={Colors.indigo}
        homeX={-40}
        homeY={SCREEN_H * 0.6}
        driftAmp={25}
        driftDuration={5200}
        opacity={0.2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute",
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
  },
});
