import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* INIT + SEED danych */
  useEffect(() => {
    (async () => {
      try {
        await initDatabase();
        await seedDemoData();
        setReady(true);
      } catch (err: any) {
        setError(err.message || String(err));
      }
    })();
  }, []);

  /* ukrycie paskó systemowych - TODO! bo nie działa dla nawigacyjnego */
  useEffect(() => {
    if (!ready) return;

    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      NavigationBar.setBehaviorAsync('immersive').catch(() => {});
    }
  }, [ready]);

  /* DB errory */
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'white' }}>⛔ Błąd DB: {error}</Text>
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

  /* zakładki główne */
  return (
    <>
      {/* schowanie status bar i animacja fade */}
      <StatusBar hidden animated />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: 'white',
          tabBarLabelPosition: 'below-icon',
          tabBarStyle: {
            backgroundColor: 'black',
            height: 72,
            paddingTop: 8,
            paddingBottom: 10,
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
          options={{ href: null }}
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
    backgroundColor: 'black',
  },
});
