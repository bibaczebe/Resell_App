import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { Colors } from "../constants/colors";
import { isLoggedIn } from "../lib/auth";

export default function Index() {
  const [auth, setAuth] = useState<boolean | null>(null);

  useEffect(() => {
    isLoggedIn()
      .then(setAuth)
      .catch(() => setAuth(false));
  }, []);

  if (auth === null) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  return <Redirect href={auth ? "/(tabs)" : "/(auth)/login"} />;
}
