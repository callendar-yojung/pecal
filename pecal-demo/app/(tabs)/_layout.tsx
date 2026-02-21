import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, View } from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { MainHeader } from "@/components/main-header";
import { NotificationPanel } from "@/components/notification-panel";

function TabsLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <MainHeader />
      <NotificationPanel />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            paddingTop: 8,
            paddingBottom: bottomPadding,
            height: tabBarHeight,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 0.5,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: -2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "개요",
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            title: "일정",
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="list.bullet" color={color} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: "캘린더",
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="calendar.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="memo"
          options={{
            title: "메모",
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="note.text" color={color} />,
          }}
        />
        <Tabs.Screen
          name="files"
          options={{
            title: "파일",
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="doc.fill" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}

export default TabsLayout;
