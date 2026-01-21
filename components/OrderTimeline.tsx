import { Icon, Text } from '@rneui/themed';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// Status yang berurutan
const STEPS = [
  { key: 'pending_payment', title: 'Menunggu Bayar', icon: 'hourglass' },
  { key: 'paid_escrow', title: 'Dibayar (Verifikasi)', icon: 'credit-card' },
  { key: 'purchased', title: 'Barang Dibelikan', icon: 'shopping-bag' },
  { key: 'shipped', title: 'Sedang Dikirim', icon: 'plane' }, // Status baru
  { key: 'completed', title: 'Pesanan Selesai', icon: 'check-circle' },
];

export default function OrderTimeline({ currentStatus }: { currentStatus: string }) {
  // Cari index status saat ini
  const currentIndex = STEPS.findIndex(s => s.key === currentStatus);
  // Kalau status 'rejected', tampilkan khusus
  if (currentStatus === 'rejected') {
     return <View style={styles.errorContainer}><Text style={{color:'white'}}>Pesanan Ditolak</Text></View>;
  }

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const isActive = index <= currentIndex; // Langkah ini sudah dilewati/sedang aktif
        const isLast = index === STEPS.length - 1;

        return (
          <View key={step.key} style={styles.stepRow}>
             {/* Garis Konektor (Kecuali item terakhir) */}
            {!isLast && (
                <View style={[styles.line, { backgroundColor: index < currentIndex ? '#2089dc' : '#e0e0e0' }]} />
            )}

            {/* Bulatan Icon */}
            <View style={[styles.circle, { backgroundColor: isActive ? '#2089dc' : '#e0e0e0' }]}>
               <Icon name={step.icon} type="font-awesome" size={12} color="white" />
            </View>

            {/* Teks */}
            <View style={styles.textContainer}>
                <Text style={[styles.title, { color: isActive ? '#333' : '#aaa' }]}>{step.title}</Text>
                {index === currentIndex && <Text style={styles.activeLabel}>Sedang Proses</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 15, backgroundColor: 'white', borderRadius: 8, marginVertical: 10 },
  stepRow: { flexDirection: 'row', height: 50 }, // Tinggi per step
  line: { 
    position: 'absolute', left: 12, top: 25, width: 2, height: 50, zIndex: 0 
  },
  circle: {
    width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', zIndex: 1
  },
  textContainer: { marginLeft: 15, justifyContent: 'center', top: -10 },
  title: { fontSize: 14, fontWeight: 'bold' },
  activeLabel: { fontSize: 10, color: '#2089dc' },
  errorContainer: { backgroundColor: 'red', padding: 10, borderRadius: 5, alignItems: 'center'}
}); 