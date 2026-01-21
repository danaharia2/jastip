import { Button, Card, Icon, Input, Text } from '@rneui/themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function TripDetail() {
  const { id, country, traveler } = useLocalSearchParams(); // Tangkap data dari halaman Home
  const router = useRouter();
  
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

  // Fungsi Kirim Request
  async function handleRequest() {
    if (!itemName || !price) {
      Alert.alert('Eits!', 'Nama barang dan estimasi harga harus diisi ya.');
      return;
    }

    setLoading(true);

    try {
      // 1. Dapatkan user yang sedang login (Buyer)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Kamu harus login dulu!');

      // 2. Simpan ke tabel 'orders'
      // Catatan: Pastikan RLS tabel 'orders' sudah dibuka nanti ya!
      const { error } = await supabase.from('orders').insert({
        trip_id: id,
        buyer_id: user.id,
        traveler_id: traveler, // ID Traveler kita lempar dari Home tadi
        item_name: itemName,
        item_price: parseInt(price),
        jastip_fee: 25000, // Sementara kita tembak flat dulu (Rp 25.000)
        platform_fee: 5000, // Fee aplikasi (Rp 5.000)
        total_amount: parseInt(price) + 30000, 
        status: 'pending_payment'
      });

      if (error) throw error;

      Alert.alert('Berhasil!', 'Request titipanmu sudah dikirim ke traveler.', [
        { text: 'OK', onPress: () => router.back() } // Kembali ke Home
      ]);

    } catch (error) {
        if (error instanceof Error) Alert.alert('Gagal Request', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Card>
        <Card.Title>TITIP BARANG DARI {typeof country === 'string' ? country.toUpperCase() : ''}</Card.Title>
        <Card.Divider />
        <Text style={{marginBottom: 10}}>
            Kamu akan menitip barang kepada Traveler ini. Pastikan detail barang jelas ya!
        </Text>
      </Card>

      <View style={styles.formContainer}>
        <Text h4 style={styles.header}>Mau Nitip Apa?</Text>
        
        <Input
          label="Nama Barang / Link Produk"
          placeholder="Misal: Sepatu Nike Air Jordan size 42"
          value={itemName}
          onChangeText={setItemName}
          leftIcon={{ type: 'font-awesome', name: 'shopping-bag' }}
        />

        <Input
          label="Estimasi Harga (IDR)"
          placeholder="Contoh: 1500000"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          leftIcon={{ type: 'font-awesome', name: 'money' }}
          errorMessage="Harga dalam Rupiah, tanpa titik/koma"
        />

        {/* Ringkasan Biaya */}
        <View style={styles.summary}>
            <Text style={styles.summaryText}>Jasa Titip: Rp 25.000</Text>
            <Text style={styles.summaryText}>Platform Fee: Rp 5.000</Text>
            <Text style={{fontWeight: 'bold', marginTop: 5}}>
                Total Estimasi: Rp {price ? (parseInt(price) + 30000).toLocaleString() : '0'}
            </Text>
        </View>

        <Button
          title={loading ? "Mengirim..." : "Kirim Request"}
          onPress={handleRequest}
          disabled={loading}
          icon={<Icon name="paper-plane" type="font-awesome" color="white" style={{marginRight: 10}} />}
          containerStyle={{ marginTop: 20 }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  formContainer: { padding: 20 },
  header: { marginBottom: 20, textAlign: 'center' },
  summary: { 
      backgroundColor: '#e6f2ff', 
      padding: 15, 
      borderRadius: 8, 
      marginBottom: 10 
  },
  summaryText: { color: '#555' }
});