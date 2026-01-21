import { Session } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { supabase } from '../lib/supabase';

// 1. Konfigurasi Handler Notifikasi
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

// 2. Fungsi Helper Register Token
async function registerForPushNotificationsAsync() {
  // 1. Cek apakah ini HP fisik
  if (!Device.isDevice) {
    console.log('Harus pakai HP fisik untuk Push Notif!');
    return null; 
  }

  // 2. Setup Channel Android (Wajib buat Android)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // 3. Cek izin
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Izin notifikasi ditolak user!');
    return null;
  }

  // 4. Ambil Project ID dengan aman
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  
  if (!projectId) {
    // Kalau belum setup EAS, kita return null aja biar gak crash
    console.log("⚠️ Project ID EAS belum ada (Nanti disetup saat mau rilis).");
    return null;
  }

  // 5. Coba Ambil Token (DENGAN PENANGANAN ERROR EXPO GO)
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error) {
    const errorMessage = (error as Error).message;
    
    if (errorMessage.includes('Expo Go') || errorMessage.includes('development build')) {
        console.log("⚠️ INFO: Push Notification dilewati karena sedang menggunakan Expo Go.");
        console.log("👉 Fitur ini baru bisa jalan nanti saat pakai 'Development Build' (APK sendiri).");
    } else {
        console.log("Error ambil token:", errorMessage);
    }
    return null;
  }
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  // EFFECT 1: Pantau Session Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setInitialized(true);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // EFFECT 2: Proteksi Halaman (Redirect)
  // Dipisahkan agar berjalan setiap kali navigasi berubah
  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === 'login';

    if (session && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!session && !inAuthGroup) {
      router.replace('/login');
    }
  }, [session, initialized, segments]);

  // EFFECT 3: Simpan Token Notifikasi (Hanya Sekali saat Login) 
  useEffect(() => {
    if (session?.user) {
        // Cek dulu apakah token logic perlu dijalankan
        registerForPushNotificationsAsync().then(token => {
            if (token) {
                // Upsert logic: Update jika ada, atau biarkan
                supabase.from('profiles')
                .update({ expo_push_token: token })
                .eq('id', session.user.id)
                .then(({ error }) => {
                    if (error) console.log("Gagal simpan token DB:", error.message);
                    else console.log("Push Token Update:", token);
                });
            }
        });
    }
  }, [session]); // <--- PENTING: Dependency cuma 'session'. Segments dihapus.

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2089dc" />
      </View>
    );
  }

  return <Slot />;
}