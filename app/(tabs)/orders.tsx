import { Badge, Button, Card, Icon, Text } from '@rneui/themed';
import { Session } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer'; // Helper untuk upload
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, RefreshControl, StyleSheet, View } from 'react-native';
import { supabase } from '../../lib/supabase';

// Tipe data
interface OrderItem {
  id: string;
  item_name: string;
  total_amount: number;
  status: string; 
  buyer_id: string;
  traveler_id: string;
  payment_proof_url: string | null; // Kolom baru kita
  trips: { destination_country: string } | null;
  profiles: { full_name: string } | null;
}

export default function OrdersScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false); // Loading pas upload

  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchOrders(session.user.id);
    });
  }, []);

  const onRefresh = useCallback(() => {
    if (session) {
      setRefreshing(true);
      fetchOrders(session.user.id);
    }
  }, [session]);

  async function fetchOrders(userId: string) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, trips ( destination_country ), profiles:buyer_id ( full_name )`)
        .or(`buyer_id.eq.${userId},traveler_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setOrders(data as any);
    } catch (error) { console.log(error); } finally { setLoading(false); setRefreshing(false); }
  }

  async function updateStatus(orderId: string, newStatus: string) {
    try {
        setLoading(true);
        const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
        if (error) throw error;
        Alert.alert('Sukses', `Status berubah jadi ${newStatus}`);
        if (session) fetchOrders(session.user.id);
    } catch (error) { Alert.alert('Gagal', 'Error update status'); } finally { setLoading(false); }
  }

  // --- FUNGSI UPLOAD GAMBAR (JANTUNG FITUR INI) ---
  async function uploadProof(orderId: string) {
    try {
      // 1. Buka Galeri
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5, // Kompres biar gak berat
        base64: true, // PENTING: Kita butuh data mentahnya
      });

      if (result.canceled || !result.assets[0].base64) return;

      setUploading(true);
      const fileExt = result.assets[0].uri.split('.').pop();
      const fileName = `${orderId}_${new Date().getTime()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 2. Upload ke Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('receipts') // Nama bucket yang tadi kita buat
        .upload(filePath, decode(result.assets[0].base64), {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      // 3. Dapatkan URL Public-nya
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);

      // 4. Update Database: Simpan URL & Ubah Status jadi 'paid_escrow'
      const { error: dbError } = await supabase
        .from('orders')
        .update({ 
            payment_proof_url: publicUrl,
            status: 'paid_escrow'
        })
        .eq('id', orderId);

      if (dbError) throw dbError;

      Alert.alert('Berhasil!', 'Bukti transfer berhasil diupload.');
      if (session) fetchOrders(session.user.id);

    } catch (error) {
      if (error instanceof Error) Alert.alert('Upload Gagal', error.message);
    } finally {
      setUploading(false);
    }
  }

  const renderOrderItem = ({ item }: { item: OrderItem }) => {
    const isImTheTraveler = item.traveler_id === session?.user.id;

    return (
      <Card containerStyle={[styles.card, isImTheTraveler ? styles.cardIncoming : styles.cardOutgoing]}>
        <View style={styles.headerRow}>
            <Badge value={isImTheTraveler ? "Pesanan Masuk" : "Pesanan Saya"} status={isImTheTraveler ? "primary" : "success"} />
            <Text style={{color: 'gray', fontWeight:'bold', fontSize:12}}>{item.status.toUpperCase().replace('_', ' ')}</Text>
        </View>
        <Card.Divider style={{marginTop: 10}} />
        <Text h4 style={styles.itemName}>{item.item_name}</Text>
        <Text style={styles.priceText}>Rp {item.total_amount.toLocaleString()}</Text>

        {/* --- TOMBOL UNTUK TRAVELER --- */}
        {isImTheTraveler && item.status === 'pending_payment' && (
             <View style={styles.actionButtons}>
                 <Button title="Tolak" type="outline" buttonStyle={{ borderColor: 'red' }} titleStyle={{ color: 'red' }} containerStyle={{ flex: 1, marginRight: 5 }} onPress={() => updateStatus(item.id, 'rejected')} />
                 <Button title="Terima" color="success" containerStyle={{ flex: 1, marginLeft: 5 }} onPress={() => updateStatus(item.id, 'accepted')} />
             </View>
        )}

        {/* --- TOMBOL UNTUK BUYER (UPLOAD BUKTI) --- */}
        {!isImTheTraveler && item.status === 'accepted' && (
            <View>
                <Text style={{color: 'orange', fontStyle: 'italic', marginVertical:5}}>
                    Traveler setuju! Silakan transfer dan upload bukti.
                </Text>
                <Button 
                    title={uploading ? "Mengupload..." : "Upload Bukti Transfer 📸"} 
                    onPress={() => uploadProof(item.id)}
                    disabled={uploading}
                />
            </View>
        )}

        {/* --- LIHAT BUKTI (JIKA SUDAH BAYAR) --- */}
        {item.payment_proof_url && (
            <View style={{marginTop: 10}}>
                <Text style={{fontWeight: 'bold'}}>Bukti Bayar:</Text>
                <Image source={{ uri: item.payment_proof_url }} style={{ width: 100, height: 100, borderRadius: 5, marginTop: 5 }} />
                {isImTheTraveler && item.status === 'paid_escrow' && (
                    <Button 
                        title="Verifikasi & Beli Barang" 
                        color="#2089dc"
                        containerStyle={{marginTop: 10}}
                        onPress={() => updateStatus(item.id, 'purchased')}
                    />
                )}
            </View>
        )}

        <View>
            <Button
                type="clear"
                icon={<Icon name="comments" type="font-awesome" color="#2089dc" size={20} style={{marginRight: 5}}/>}
                title="Diskusi / Chat"
                onPress={() => router.push(`/chat/${item.id}`)} // <--- Pindah ke halaman chat bawa ID Order
                containerStyle={{ marginTop: 10, borderTopWidth: 1, borderColor: '#eee' }}
            />
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator size="large" color="#2089dc" style={{marginTop: 20}}/>}
      <FlatList data={orders} keyExtractor={(item) => item.id} renderItem={renderOrderItem} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>} ListEmptyComponent={!loading ? <Text style={styles.empty}>Belum ada transaksi.</Text> : null} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { borderRadius: 10, marginBottom: 5 },
  cardIncoming: { borderLeftWidth: 5, borderLeftColor: '#2089dc' }, 
  cardOutgoing: { borderLeftWidth: 5, borderLeftColor: '#52c41a' }, 
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 18, marginBottom: 5 },
  priceText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  actionButtons: { flexDirection: 'row', marginTop: 15 },
  empty: { textAlign: 'center', marginTop: 50, color: 'gray' }
});