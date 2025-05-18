// app/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { initDatabase } from '../src/database/db';
import { seedDemoData } from '../src/database/seed'; // ← import seeda

export default function RootLayout() {
  const [ready, setReady]   = useState(false);
  const [error, setError]   = useState<string | null>(null);

  /* -------------- INIT + SEED -------------- */
  useEffect(() => {
    (async () => {
      try {
        await initDatabase();   // tworzy tabele
        await seedDemoData();   // dodaje przykładowe dane, jeśli baza pusta
        setReady(true);
      } catch (err: any) {
        setError(err.message || String(err));
      }
    })();
  }, []);

  /* -------------- STANY ŁADOWANIA -------------- */
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

  /* -------------- BOTTOM TABS -------------- */
  return (
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
        name="settings"
        options={{
          title: 'Ustawienia',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="options" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

/* -------------- STYLES -------------- */
const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'black',
  },
});