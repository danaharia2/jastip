import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Input, Text } from '@rneui/themed';
import { Session } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function CreateTrip({ session }: { session: Session }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // State untuk form
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  
  // 2. Ubah State Date: Kita simpan Objek Date asli untuk logika, dan String untuk database
  const [date, setDate] = useState(new Date()); 
  const [showPicker, setShowPicker] = useState(false); // Untuk kontrol muncul/hilang picker
  const [dateSelected, setDateSelected] = useState(false); // Penanda apakah user sudah pilih tanggal atau belum

  const [desc, setDesc] = useState('');

  // 3. Fungsi saat tanggal dipilih
  const onChangeDate = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowPicker(Platform.OS === 'ios'); // Di iOS biarkan tetap muncul (opsional), di Android harus ditutup manual
    if (event.type === 'set' || Platform.OS === 'ios') {
        setShowPicker(false); // Tutup picker
        setDate(currentDate);
        setDateSelected(true);
    } else {
        setShowPicker(false); // Jika user cancel
    }
  };

  // Helper untuk format tanggal ke YYYY-MM-DD (Supabase format)
  const formatDateForDB = (rawDate: Date) => {
    return rawDate.toISOString().split('T')[0];
  };

  // Helper untuk format tanggal yang enak dibaca user (Indonesia)
  const formatDateDisplay = (rawDate: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(rawDate);
  };

  async function handlePostTrip() {
    // Validasi sederhana
    if (!country) {
      Alert.alert('Eits!', 'Negara tujuan wajib diisi ya.');
      return;
    }
    
    // Validasi Tanggal (harus dipilih)
    if (!dateSelected) {
        Alert.alert('Lupa Tanggal?', 'Silakan pilih tanggal keberangkatan dulu.');
        return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('trips').insert({
        traveler_id: session.user.id,
        destination_country: country,
        destination_city: city,
        departure_date: formatDateForDB(date), // Gunakan format YYYY-MM-DD
        return_date: formatDateForDB(date),    // Sementara disamakan
        description: desc,
        status: 'open',
      });

      if (error) {
        throw error;
      }

      Alert.alert('Mantap!', 'Jadwal Jastip berhasil diposting!', [
        { 
          text: 'OK', 
          onPress: () => {
            // Reset form
            setCountry('');
            setCity('');
            setDate(new Date());
            setDateSelected(false);
            setDesc('');
            router.push('/(tabs)'); 
          }
        }
      ]);

    } catch (error) {
      if (error instanceof Error) Alert.alert('Gagal Posting', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text h4 style={styles.header}>Mau Pergi ke Mana?</Text>
      <Text style={styles.subHeader}>Buka jastip biar ongkos jalan-jalan ketutup!</Text>

      <View style={styles.formGroup}>
        <Input
          label="Negara Tujuan"
          placeholder="Contoh: Jepang, Singapore"
          value={country}
          onChangeText={setCountry}
          leftIcon={{ type: 'font-awesome', name: 'plane', size: 18 }}
        />
        
        <Input
          label="Kota (Opsional)"
          placeholder="Contoh: Tokyo, Osaka"
          value={city}
          onChangeText={setCity}
          leftIcon={{ type: 'font-awesome', name: 'map-marker', size: 18 }}
        />

        {/* 4. AREA DATE PICKER YANG BARU */}
        <View style={{ paddingHorizontal: 10, marginBottom: 20 }}>
            <Text style={{ fontSize: 16, color: '#86939e', fontWeight: 'bold', marginBottom: 5 }}>
                Tanggal Berangkat
            </Text>
            <TouchableOpacity onPress={() => setShowPicker(true)}>
                <View style={styles.dateInputFake}>
                    <Text style={{ color: dateSelected ? 'black' : '#ccc', fontSize: 16 }}>
                        {dateSelected ? formatDateDisplay(date) : "Pilih Tanggal..."}
                    </Text>
                </View>
            </TouchableOpacity>
        </View>

        {/* Komponen Picker (Hanya muncul jika showPicker = true) */}
        {showPicker && (
            <DateTimePicker
                testID="dateTimePicker"
                value={date}
                mode="date"
                display="default"
                onChange={onChangeDate}
                minimumDate={new Date()} // Gak bisa pilih tanggal masa lalu
            />
        )}

        <Input
          label="Keterangan / Titipan yang diterima"
          placeholder="Open jastip Uniqlo, Snack, Kosmetik..."
          value={desc}
          onChangeText={setDesc}
          multiline
          numberOfLines={3}
          leftIcon={{ type: 'font-awesome', name: 'comment', size: 18 }}
        />

        <Button
          title={loading ? "Sedang Posting..." : "Posting Jastip ✈️"}
          onPress={handlePostTrip}
          disabled={loading}
          containerStyle={{ marginTop: 20 }}
          buttonStyle={{ backgroundColor: '#2089dc' }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: 'white' },
  header: { textAlign: 'center', marginBottom: 5 },
  subHeader: { textAlign: 'center', color: 'gray', marginBottom: 30 },
  formGroup: { marginBottom: 50 },
  // Styling tambahan agar mirip Input biasa
  dateInputFake: {
      borderBottomWidth: 1,
      borderColor: '#86939e',
      paddingVertical: 10,
      paddingHorizontal: 5,
      marginBottom: 5
  }
});