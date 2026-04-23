import { View, StyleSheet, ViewStyle } from "react-native";
import { Colors } from "../../constants/colors";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
}

export function GlassCard({ children, style, noPadding }: Props) {
  return (
    <View style={[styles.card, noPadding && styles.noPad, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  noPad: { padding: 0 },
});
