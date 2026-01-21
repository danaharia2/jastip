import { Session } from '@supabase/supabase-js';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Pantau status login
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setInitialized(true);
      }
    );

    // Cek awal
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;

    // Cek apakah user sedang berada di halaman Login?
    // segments[0] bisa jadi undefined kalau di root, atau 'login'
    const inAuthGroup = segments[0] === 'login';

    if (session && inAuthGroup) {
      // KASUS 1: Sudah Login, tapi coba buka halaman Login -> Lempar ke Tabs
      router.replace('/(tabs)');
    } else if (!session && !inAuthGroup) {
      // KASUS 2: Belum Login, tapi coba buka halaman dalam -> Tendang ke Login
      router.replace('/login');
    }
    
    // KASUS 3 (PENTING):
    // Kalau session ada, dan user sedang di '/trip/123' (bukan inAuthGroup),
    // KODE INI AKAN DIAM SAJA (Membiarkan user masuk).
    
  }, [session, initialized, segments]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2089dc" />
      </View>
    );
  }

  return <Slot />;
}