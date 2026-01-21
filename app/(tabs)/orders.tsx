import { Badge, Button, Card, Icon, Text } from '@rneui/themed';
import { Session } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
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
  payment_proof_url: string | null;
  trips: { destination_province: string } | null; 
  profiles: { full_name: string } | null;
}

export default function OrdersScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false); 

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
        .select(`*, trips ( destination_province ), profiles:buyer_id ( full_name )`)
        .or(`buyer_id.eq.${userId},traveler_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setOrders(data as any);
    } catch (error) { 
        console.log("Error Fetch:", error); 
    } finally { 
        setLoading(false); 
        setRefreshing(false); 
    }
  }

  async function updateStatus(orderId: string, newStatus: string) {
    try {
        setLoading(true);
        const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
        if (error) throw error;
        Alert.alert('Sukses', `Status diperbarui!`);
        if (session) fetchOrders(session.user.id);
    } catch (error) { 
        Alert.alert('Gagal', 'Error update status'); 
    } finally { 
        setLoading(false); 
    }
  }

  // --- FUNGSI UPLOAD GAMBAR ---
  async function uploadProof(orderId: string) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5, 
        base64: true, 
      });

      if (result.canceled || !result.assets[0].base64) return;

      setUploading(true);
      const fileExt = result.assets[0].uri.split('.').pop();
      const fileName = `${orderId}_${new Date().getTime()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts') 
        .upload(filePath, decode(result.assets[0].base64), {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);

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
        
        {item.trips?.destination_province && (
             <Text style={{ fontSize: 12, color: '#2089dc', marginTop: 5 }}>Rute: {item.trips.destination_province}</Text>
        )}

        <Card.Divider style={{marginTop: 10}} />
        <Text h4 style={styles.itemName}>{item.item_name}</Text>
        <Text style={styles.priceText}>Rp {item.total_amount.toLocaleString()}</Text>

        {/* ============================================== */}
        {/* LOGIKA TOMBOL UNTUK TRAVELER */}
        {/* ============================================== */}
        {isImTheTraveler && (
            <View style={styles.actionButtons}>
                {item.status === 'pending_payment' && (
                    <>
                        <Button title="Tolak" type="outline" buttonStyle={{ borderColor: 'red' }} titleStyle={{ color: 'red' }} containerStyle={{ flex: 1, marginRight: 5 }} onPress={() => updateStatus(item.id, 'rejected')} />
                        <Button title="Terima" color="success" containerStyle={{ flex: 1, marginLeft: 5 }} onPress={() => updateStatus(item.id, 'accepted')} />
                    </>
                )}

                {item.status === 'accepted' && (
                     <Text style={styles.statusInfo}>Menunggu Buyer upload bukti transfer...</Text>
                )}

                {item.status === 'paid_escrow' && (
                    <Button 
                        title="Saya Sudah Beli Barang Ini ✅" 
                        color="#2089dc"
                        containerStyle={{ flex: 1 }}
                        onPress={() => updateStatus(item.id, 'purchased')}
                    />
                )}

                {item.status === 'purchased' && (
                    <Button 
                        title="Barang Dikirim / Siap Diambil 🚚" 
                        color="#e67e22"
                        containerStyle={{ flex: 1 }}
                        onPress={() => updateStatus(item.id, 'shipped')}
                    />
                )}

                 {/* Saat dikirim, Traveler hanya menunggu konfirmasi Buyer */}
                 {item.status === 'shipped' && (
                     <Text style={styles.statusInfo}>Menunggu konfirmasi penerimaan dari Buyer.</Text>
                )}
                
                {item.status === 'completed' && (
                     <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center', width:'100%'}}>
                        <Icon name="check-circle" color="green" />
                        <Text style={{color:'green', fontWeight:'bold', marginLeft:5}}>Transaksi Selesai</Text>
                     </View>
                )}
            </View>
        )}

        {/* ============================================== */}
        {/* LOGIKA TOMBOL UNTUK BUYER */}
        {/* ============================================== */}
        {!isImTheTraveler && (
            <View style={styles.actionButtons}>
                {/* 1. Upload Bukti */}
                {item.status === 'accepted' && (
                    <View style={{width: '100%'}}>
                        <Text style={{color: 'orange', fontStyle: 'italic', marginBottom: 5, textAlign:'center'}}>
                            Traveler setuju! Silakan transfer dan upload bukti.
                        </Text>
                        <Button 
                            title={uploading ? "Mengupload..." : "Upload Bukti Transfer 📸"} 
                            onPress={() => uploadProof(item.id)}
                            disabled={uploading}
                        />
                    </View>
                )}

                {/* 2. Menunggu Traveler Beli & Kirim */}
                {(item.status === 'paid_escrow' || item.status === 'purchased') && (
                     <Text style={styles.statusInfo}>Menunggu proses oleh Traveler...</Text>
                )}

                {/* 3. TOMBOL PENYELESAIAN (NEW!!!) */}
                {item.status === 'shipped' && (
                    <View style={{width: '100%'}}>
                         <Text style={{color: '#2089dc', marginBottom: 5, textAlign:'center'}}>
                            Barang sedang dikirim. Klik tombol di bawah jika sudah diterima.
                        </Text>
                        <Button 
                            title="Pesanan Diterima / Selesai ✅" 
                            color="success"
                            onPress={() => updateStatus(item.id, 'completed')}
                        />
                    </View>
                )}

                {/* 4. Selesai */}
                {item.status === 'completed' && (
                     <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center', width:'100%'}}>
                        <Icon name="check-circle" color="green" />
                        <Text style={{color:'green', fontWeight:'bold', marginLeft:5}}>Barang Diterima & Selesai</Text>
                     </View>
                )}
            </View>
        )}

        {/* --- TAMPILAN BUKTI BAYAR --- */}
        {item.payment_proof_url && (
            <View style={{marginTop: 10, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 5}}>
                <Text style={{fontWeight: 'bold', marginBottom: 5}}>Bukti Bayar:</Text>
                <Image source={{ uri: item.payment_proof_url }} style={{ width: 100, height: 100, borderRadius: 5 }} />
            </View>
        )}

        <View>
            <Button
                type="clear"
                icon={<Icon name="comments" type="font-awesome" color="#2089dc" size={20} style={{marginRight: 5}}/>}
                title="Diskusi / Chat"
                onPress={() => router.push(`/chat/${item.id}`)}
                containerStyle={{ marginTop: 10, borderTopWidth: 1, borderColor: '#eee' }}
            />
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator size="large" color="#2089dc" style={{marginTop: 20}}/>}
      <FlatList 
        data={orders} 
        keyExtractor={(item) => item.id} 
        renderItem={renderOrderItem} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>} 
        ListEmptyComponent={!loading ? <Text style={styles.empty}>Belum ada transaksi.</Text> : null} 
      />
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
  actionButtons: { flexDirection: 'row', marginTop: 15, flexWrap: 'wrap', justifyContent: 'center' }, 
  empty: { textAlign: 'center', marginTop: 50, color: 'gray' },
  statusInfo: { fontStyle:'italic', color:'gray', width:'100%', textAlign:'center', marginVertical: 10 }
});