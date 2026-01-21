import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Icon, Input, Text } from '@rneui/themed';
import { Session } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

// Daftar Kendaraan
const VEHICLES = [
  { id: 'plane', name: 'Pesawat', icon: 'plane' },
  { id: 'train', name: 'Kereta', icon: 'train' },
  { id: 'bus', name: 'Bus', icon: 'bus' },
  { id: 'car', name: 'Mobil', icon: 'car' },
  { id: 'motorcycle', name: 'Motor', icon: 'motorcycle' },
  { id: 'ship', name: 'Kapal', icon: 'ship' },
];

export default function CreateTrip({ session }: { session: Session }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // State Form Baru
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [vehicle, setVehicle] = useState('plane'); // Default Pesawat
  
  const [date, setDate] = useState(new Date()); 
  const [showPicker, setShowPicker] = useState(false);
  const [dateSelected, setDateSelected] = useState(false);

  const [desc, setDesc] = useState('');

  const onChangeDate = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowPicker(Platform.OS === 'ios');
    if (event.type === 'set' || Platform.OS === 'ios') {
        setShowPicker(false);
        setDate(currentDate);
        setDateSelected(true);
    } else {
        setShowPicker(false);
    }
  };

  const formatDateDisplay = (rawDate: Date) => {
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(rawDate);
  };

  async function handlePostTrip() {
    if (!province || !city) {
      Alert.alert('Data Kurang', 'Provinsi dan Kota wajib diisi ya.');
      return;
    }
    
    if (!dateSelected) {
        Alert.alert('Lupa Tanggal?', 'Silakan pilih tanggal keberangkatan.');
        return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('trips').insert({
        traveler_id: session.user.id,
        destination_province: province, // Kolom Baru
        destination_city: city,
        vehicle_type: vehicle,          // Kolom Baru
        departure_date: date.toISOString().split('T')[0],
        return_date: date.toISOString().split('T')[0],
        description: desc,
        status: 'open',
      });

      if (error) throw error;

      Alert.alert('Siap Berangkat!', 'Jadwal Jastip domestik berhasil diposting!', [
        { 
          text: 'OK', 
          onPress: () => {
            setProvince('');
            setCity('');
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
      <Text h4 style={styles.header}>Rute Perjalanan</Text>
      <Text style={styles.subHeader}>Jastip keliling Indonesia, ongkos aman!</Text>

      <View style={styles.formGroup}>
        <Input
          label="Provinsi Tujuan"
          placeholder="Contoh: Jawa Timur, Bali"
          value={province}
          onChangeText={setProvince}
          leftIcon={{ type: 'font-awesome', name: 'map' }}
        />
        
        <Input
          label="Kota / Kabupaten"
          placeholder="Contoh: Surabaya, Denpasar"
          value={city}
          onChangeText={setCity}
          leftIcon={{ type: 'font-awesome', name: 'map-marker' }}
        />

        {/* PILIH KENDARAAN */}
        <Text style={styles.label}>Naik apa kesana?</Text>
        <View style={styles.vehicleContainer}>
            {VEHICLES.map((v) => (
                <TouchableOpacity 
                    key={v.id} 
                    style={[styles.vehicleBox, vehicle === v.id && styles.vehicleSelected]}
                    onPress={() => setVehicle(v.id)}
                >
                    <Icon 
                        name={v.icon} 
                        type="font-awesome" 
                        size={24} 
                        color={vehicle === v.id ? 'white' : '#555'} 
                    />
                    <Text style={{ fontSize: 10, marginTop: 4, color: vehicle === v.id ? 'white' : '#555' }}>
                        {v.name}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>

        {/* INPUT TANGGAL */}
        <View style={{ paddingHorizontal: 10, marginBottom: 20, marginTop: 10 }}>
            <Text style={styles.label}>Tanggal Berangkat</Text>
            <TouchableOpacity onPress={() => setShowPicker(true)}>
                <View style={styles.dateInputFake}>
                    <Text style={{ color: dateSelected ? 'black' : '#ccc', fontSize: 16 }}>
                        {dateSelected ? formatDateDisplay(date) : "Pilih Tanggal..."}
                    </Text>
                    <Icon name="calendar" type="font-awesome" color="#2089dc" />
                </View>
            </TouchableOpacity>
        </View>

        {showPicker && (
            <DateTimePicker value={date} mode="date" display="default" onChange={onChangeDate} minimumDate={new Date()} />
        )}

        <Input
          label="Keterangan"
          placeholder="Open jastip oleh-oleh khas..."
          value={desc}
          onChangeText={setDesc}
          multiline
          numberOfLines={3}
          leftIcon={{ type: 'font-awesome', name: 'comment' }}
        />

        <Button
          title={loading ? "Sedang Posting..." : "Posting Rute 🇮🇩"}
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
  subHeader: { textAlign: 'center', color: 'gray', marginBottom: 20 },
  formGroup: { marginBottom: 50 },
  label: { fontSize: 16, color: '#86939e', fontWeight: 'bold', marginLeft: 10, marginBottom: 10 },
  dateInputFake: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      borderBottomWidth: 1, borderColor: '#86939e',
      paddingVertical: 10, paddingHorizontal: 5, marginBottom: 5
  },
  vehicleContainer: {
      flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', marginBottom: 15
  },
  vehicleBox: {
      width: '30%', backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8,
      alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#ddd'
  },
  vehicleSelected: {
      backgroundColor: '#2089dc', borderColor: '#2089dc'
  }
});