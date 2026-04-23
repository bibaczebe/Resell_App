import { View, StyleSheet } from "react-native";
import { MotiView } from "moti";
import { Colors } from "../../constants/colors";

export function AuroraBg() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <MotiView
        from={{ opacity: 0.18, translateX: -80, translateY: -80 }}
        animate={{ opacity: 0.3, translateX: 40, translateY: 0 }}
        transition={{ type: "timing", duration: 8000, loop: true }}
        style={[styles.blob, { backgroundColor: Colors.violet, top: -80, left: -40 }]}
      />
      <MotiView
        from={{ opacity: 0.12, translateX: 60, translateY: 0 }}
        animate={{ opacity: 0.25, translateX: -40, translateY: 60 }}
        transition={{ type: "timing", duration: 10000, loop: true }}
        style={[styles.blob, { backgroundColor: Colors.fuchsia, top: 180, right: -60 }]}
      />
      <MotiView
        from={{ opacity: 0.1, translateY: -40 }}
        animate={{ opacity: 0.22, translateY: 40 }}
        transition={{ type: "timing", duration: 9000, loop: true }}
        style={[styles.blob, { backgroundColor: Colors.indigo, bottom: 40, left: -60 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.22,
  },
});
