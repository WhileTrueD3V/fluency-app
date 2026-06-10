import React from 'react';
import { Tabs } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function HomeLayout() {
  return (
    <Tabs
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="mock" options={{ title: 'Mock' }} />
    </Tabs>
  );
}
