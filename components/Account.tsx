import { Button, Icon, Input, Text } from '@rneui/themed';
import { Session } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Account({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    if (session) getProfile();
  }, [session]);

  async function getProfile() {
    try {
      setLoading(true);
      if (!session?.user) throw new Error('No user on the session!');

      const { data, error, status } = await supabase
        .from('profiles')
        .select(`username, website, full_name, avatar_url`)
        .eq('id', session.user.id)
        .single();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        setUsername(data.username || '');
        setFullName(data.full_name || '');
        setWebsite(data.website || '');
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      if (error instanceof Error) Alert.alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  // --- FUNGSI UPLOAD AVATAR ---
  async function uploadAvatar() {
    try {
      setUploading(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, // Biar bisa crop kotak/bulat
        aspect: [1, 1],      // Paksa rasio 1:1 (Kotak sempurna)
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets[0].base64) return;

      const fileExt = result.assets[0].uri.split('.').pop();
      // Nama file pakai ID User biar 1 user cuma punya 1 file (file lama tertimpa)
      const fileName = `${session.user.id}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Upload ke Storage 'avatars'
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(result.assets[0].base64), {
          contentType: 'image/jpeg',
          upsert: true, // Timpa file lama kalau ada
        });

      if (uploadError) throw uploadError;

      // 2. Ambil Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. TRIK CACHE BUSTING: Tambahkan timestamp saat update state lokal
      // Ini membuat React Native berpikir ini adalah URL baru, jadi dia download ulang
      const uniqueUrl = `${publicUrl}?t=${new Date().getTime()}`;

      setAvatarUrl(uniqueUrl);

      // Update DB (Kita simpan URL bersihnya saja tanpa timestamp agar rapi di DB)
      // Timestamp cuma butuh di sisi aplikasi (UI) saat ini.
      const updates = {
        id: session.user.id,
        avatar_url: publicUrl, // Simpan URL asli di DB
        updated_at: new Date(),
      };

      const { error: updateDbError } = await supabase.from('profiles').upsert(updates);
      if (updateDbError) throw updateDbError;

      Alert.alert('Sukses', 'Foto profil berhasil diperbarui!');

    } catch (error) {
      if (error instanceof Error) Alert.alert("Upload Gagal", error.message);
    } finally {
      setUploading(false);
    }
  }

  async function updateProfile() {
    try {
      setLoading(true);
      if (!session?.user) throw new Error('No user on the session!');

      const updates = {
        id: session.user.id,
        username,
        website,
        full_name: fullName,
        avatar_url: avatarUrl, // Simpan URL foto terbaru
        updated_at: new Date(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) throw error;
      Alert.alert('Sukses!', 'Profil berhasil diperbarui.');
    } catch (error) {
      if (error instanceof Error) Alert.alert("Gagal Update", error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
        await supabase.auth.signOut();
    } catch (error) {
        Alert.alert('Error Logout', 'Gagal keluar akun.');
    }
  }

  return (
    <View style={styles.container}>
      
      {/* --- AREA FOTO PROFIL --- */}
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <TouchableOpacity onPress={uploadAvatar} disabled={uploading}>
            {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
                <View style={[styles.avatar, { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' }]}>
                    <Icon name="camera" type="font-awesome" size={40} color="white" />
                </View>
            )}
            {/* Indikator Loading Kecil pas upload */}
            {uploading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator color="white" />
                </View>
            )}
        </TouchableOpacity>
        <Text style={{color: '#2089dc', marginTop: 10}}>Ganti Foto Profil</Text>
      </View>

      {/* Form Input */}
      <View style={styles.verticallySpaced}>
        <Input label="Email" value={session?.user?.email} disabled />
      </View>
      <View style={styles.verticallySpaced}>
        <Input label="Username" value={username} onChangeText={setUsername} />
      </View>
      <View style={styles.verticallySpaced}>
        <Input label="Nama Lengkap" value={fullName} onChangeText={setFullName} />
      </View>
      
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Button
          title={loading ? 'Loading ...' : 'Simpan Perubahan'}
          onPress={updateProfile}
          disabled={loading}
        />
      </View>

      <View style={styles.verticallySpaced}>
        <Button 
            title="Logout" 
            onPress={handleLogout} 
            type="outline" 
            color="error"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    padding: 12,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  mt20: {
    marginTop: 20,
  },
  avatar: {
      width: 100,
      height: 100,
      borderRadius: 50, // Bulat sempurna
      borderWidth: 2,
      borderColor: '#eee'
  },
  loadingOverlay: {
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center'
  }
});