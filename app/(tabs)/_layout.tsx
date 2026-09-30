import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Tabs, router } from "expo-router";
import { Map, Radio, Users, UserRound, Plus } from "lucide-react-native";
import { Button, Sheet, useTheme } from "@/src/ui";
const items = [
  { name: "index", label: "Map", Icon: Map },
  { name: "activities", label: "Beacons", Icon: Radio },
  { name: "squads", label: "Squads", Icon: Users },
  { name: "profile", label: "Profile", Icon: UserRound },
];
export default function TabLayout() {
  const { colors } = useTheme();

  const [actions, setActions] = useState(false);
  function create(kind: string) {
    setActions(false);
    router.push({ pathname: "/create", params: { kind } });
  }
  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={({ state, navigation, insets }) => (
          <View
            style={{
              backgroundColor: colors.white,
              borderTopWidth: 1,
              borderColor: colors.line,
              paddingBottom: Math.max(insets.bottom, 8),
              paddingTop: 8,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", height: 54 }}
            >
              {items.map(({ name, label, Icon }, index) => {
                const route = state.routes.find((r) => r.name === name)!;
                const focused = state.routes[state.index].name === name;
                return (
                  <React.Fragment key={name}>
                    {index === 2 && <View style={{ width: 76 }} />}
                    <Pressable
                      accessibilityRole="tab"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: focused }}
                      onPress={() => {
                        const event = navigation.emit({
                          type: "tabPress",
                          target: route.key,
                          canPreventDefault: true,
                        });
                        if (!event.defaultPrevented) navigation.navigate(name);
                      }}
                      style={{
                        flex: 1,
                        minHeight: 48,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      <Icon
                        size={22}
                        color={focused ? colors.green : colors.muted}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: focused ? "700" : "500",
                          color: focused ? colors.green : colors.muted,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create Beacon"
              onPress={() => setActions(true)}
              style={({ pressed }) => ({
                position: "absolute",
                left: "50%",
                marginLeft: -32,
                top: -20,
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 5,
                borderColor: colors.bg,
                backgroundColor: colors.ink,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
                elevation: 6,
                boxShadow: "0 3px 10px #102b2926",
              })}
            >
              <Plus size={29} color={colors.lime} />
            </Pressable>
          </View>
        )}
      >
        <Tabs.Screen name="index" options={{ title: "Map" }} />
        <Tabs.Screen name="activities" options={{ title: "Beacons" }} />
        <Tabs.Screen name="squads" options={{ title: "Squads" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
        <Tabs.Screen name="two" options={{ href: null }} />
      </Tabs>
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
      </Sheet>
    </>
  );
}
