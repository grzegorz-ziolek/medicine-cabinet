import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { initDatabase } from '../src/database/db';
import { seedDemoData } from '../src/database/seed';

import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import { COLORS } from '../src/constants/theme';
import { logger } from '../src/utils/logger';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  //  Start the db and test seed of the data
  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await seedDemoData();
        setReady(true);
      } catch (err: any) {
        const errorMsg = err.message || String(err);
        logger.error('Database initialization failed', err);
        setError(errorMsg);
      }
    })();
  }, []);

  // System nav bar hiding
  useEffect(() => {
    if (!ready) return;
    if (Platform.OS !== 'android') return;

    const hideNavBar = () => {
      NavigationBar.setVisibilityAsync('hidden').catch((err) => 
        logger.warn('Failed to hide navigation bar', err)
      );
      NavigationBar.setBehaviorAsync('immersive-sticky').catch((err) => 
        logger.warn('Failed to set navigation bar behavior', err)
      );
    };

    hideNavBar();

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') hideNavBar();
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [ready]);

  // DB errors
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: COLORS.WHITE }}>⛔ Błąd DB: {error}</Text>
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      {/* Status bar */}
      <StatusBar hidden animated />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.WHITE,
          tabBarLabelPosition: 'below-icon',
          tabBarStyle: {
            backgroundColor: COLORS.BLACK,
            height: 72,
            paddingTop: 8,
            paddingBottom: 10,
          },
          tabBarItemStyle: {
            flex: 1,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Lista leków',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: 'Dodaj lek',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="pencil" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="addProduct"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Ustawienia',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="options" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

/* STYLES */
const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.BLACK,
  },
});
