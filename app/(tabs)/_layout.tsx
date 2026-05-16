/*
 * SafeRoute Varjumine — single map-first screen.
 *
 * Hides the tab bar entirely: the spec asks for a Google-Maps-like single-surface
 * experience with floating controls + bottom sheet, not a multi-tab dashboard.
 */

import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null, title: 'Map' }} />
    </Tabs>
  );
}
