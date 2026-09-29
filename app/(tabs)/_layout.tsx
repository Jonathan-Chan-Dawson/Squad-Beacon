import React, { useState } from "react";
import { View } from "react-native";
import { Tabs, router } from "expo-router";
import { Map, Users, UserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Sheet, colors } from "@/src/ui";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [actions, setActions] = useState(false);
  const create = (kind: string) => {
    setActions(false);
    router.push({ pathname: "/create", params: { kind } });
  };
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.green,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: "#FCFDF9",
            borderTopColor: colors.line,
            height: 64 + insets.bottom,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 8),
          },
          tabBarIconStyle: { width: 22, height: 22 },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            marginTop: 0,
            lineHeight: 14,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Beacons",
            tabBarIcon: ({ color }) => <Map color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="squads"
          options={{
            title: "Squads",
            tabBarIcon: ({ color }) => <Users color={color} size={22} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <UserRound color={color} size={22} />,
          }}
        />
        <Tabs.Screen name="activities" options={{ href: null }} />
        <Tabs.Screen name="progress" options={{ href: null }} />
        <Tabs.Screen name="two" options={{ href: null }} />
      </Tabs>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          bottom: 76 + insets.bottom,
          alignSelf: "center",
          width: "90%",
          maxWidth: 420,
        }}
      >
        <Button title="+ Create Beacon" onPress={() => setActions(true)} />
      </View>
      <Sheet
        title="What are you up to?"
        visible={actions}
        onClose={() => setActions(false)}
      >
        <Button title="Create a beacon" onPress={() => create("beacon")} />
        <Button
          title="Share a status"
          secondary
          onPress={() => create("status")}
        />
        <Button
          title="Make a squad plan"
          secondary
          onPress={() => create("squad")}
        />
        <Button
          title="Customize profile & avatar"
          secondary
          onPress={() => {
            setActions(false);
            router.push("/(tabs)/profile");
          }}
        />
      </Sheet>
    </View>
  );
}
