import { Avatar, Button, Card, Icon, SearchBar, Text } from '@rneui/themed';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { supabase } from '../../lib/supabase';

// Tipe data (Tetap sama)
interface TripWithProfile {
  id: string;
  destination_country: string;
  destination_city: string | null;
  departure_date: string;
  description: string | null;
  traveler_id: string;
  profiles: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

const ITEMS_PER_PAGE = 5; // Kita muat 5 data per scroll

export default function HomeScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 1. State Baru untuk Pagination
  const [page, setPage] = useState(0); 
  const [hasMore, setHasMore] = useState(true); // Cek apakah masih ada data di server?
  const [loadingMore, setLoadingMore] = useState(false); // Loading kecil di bawah saat scroll

  const [search, setSearch] = useState('');

  // 2. Modifikasi Fetch Trips (Menerima parameter pageNumber & isRefresh)
  async function fetchTrips(keyword: string = '', pageNumber: number = 0, isRefresh: boolean = false) {
    try {
      if (pageNumber === 0) setLoading(true); // Loading besar cuma di awal

      // Hitung Range Pagination Supabase (0-4, 5-9, dst)
      const from = pageNumber * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // 1. Ambil tanggal hari ini format YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];

      let query = supabase
        .from('trips')
        .select(`
          *,
          traveler_id,
          profiles ( username, full_name, avatar_url )
        `)
        .gte('departure_date', today)
        .order('created_at', { ascending: false })
        .range(from, to); // <--- INI KUNCI PAGINATION

      if (keyword && keyword.trim() !== '') {
        query = query.or(`destination_country.ilike.%${keyword}%,destination_city.ilike.%${keyword}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        // Logika Penggabungan Data
        if (isRefresh || pageNumber === 0) {
            setTrips(data as any); // Kalau refresh/awal, timpa semua data
        } else {
            // Kalau load more, gabungkan data lama + data baru
            setTrips(prev => [...prev, ...data as any]);
        }

        // Cek apakah data habis?
        if (data.length < ITEMS_PER_PAGE) {
            setHasMore(false); // Data sudah habis/kurang dari 5
        } else {
            setHasMore(true);
        }
      }
      
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('Error', error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }

  // Load awal
  useEffect(() => {
    fetchTrips();
  }, []);

  // 3. Fungsi Refresh (Tarik layar ke bawah)
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);      // Reset ke halaman 0
    setHasMore(true); // Reset indikator habis
    fetchTrips(search, 0, true); 
  }, [search]);

  // 4. Fungsi Load More (Scroll sampai mentok bawah)
  const loadMoreTrips = () => {
      if (!hasMore || loadingMore || loading) return; // Jangan load kalau lagi loading atau data habis

      setLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      fetchTrips(search, nextPage, false);
  };

  // Fungsi Search
  const updateSearch = (text: string) => {
    setSearch(text);
    // Reset Pagination saat mencari
    setPage(0);
    setHasMore(true);
    // Kita pakai debounce manual simpel: panggil fetch langsung (di real app sebaiknya pakai debounce timer)
    fetchTrips(text, 0, true);
  };

  const renderTripItem = ({ item }: { item: TripWithProfile }) => (
    <Card containerStyle={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <View style={styles.userInfo}>
            <Avatar 
                size={32} 
                rounded 
                source={item.profiles?.avatar_url ? { uri: item.profiles.avatar_url } : undefined}
                icon={!item.profiles?.avatar_url ? { name: 'user', type: 'font-awesome' } : undefined}
                containerStyle={{ backgroundColor: '#ccc', marginRight: 10 }}
            />
            <View>
                <Text style={styles.userName}>
                    {item.profiles?.full_name || item.profiles?.username || 'Traveler'}
                </Text>
                <Text style={styles.tripDate}>Berangkat: {item.departure_date}</Text>
            </View>
        </View>
      </View>

      <Card.Divider />

      <View style={styles.destinationRow}>
        <Icon name="plane" type="font-awesome" color="#2089dc" size={24} style={{marginRight: 10}} />
        <Text h4>{item.destination_country}</Text>
      </View>
      
      {item.destination_city && (
        <Text style={styles.cityText}>📍 {item.destination_city}</Text>
      )}

      <Text style={styles.description}>
        {item.description || 'Tidak ada keterangan tambahan.'}
      </Text>

      <Button
        icon={<Icon name="shopping-bag" color="#ffffff" type="font-awesome" size={15} style={{ marginRight: 10 }}/>}
        buttonStyle={{ borderRadius: 0, marginLeft: 0, marginRight: 0, marginBottom: 0, marginTop: 15 }}
        title="Titip Barang"
        onPress={() => {
            router.push(`/trip/${item.id}?country=${item.destination_country}&traveler=${item.traveler_id}`);
        }}
      />
    </Card>
  );

  // Komponen Loading Footer
  const renderFooter = () => {
      if (!loadingMore) return null;
      return (
          <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator size="small" color="#2089dc" />
          </View>
      );
  };

  return (
    <View style={styles.container}>
      <SearchBar
        placeholder="Cari Negara atau Kota..."
        onChangeText={updateSearch}
        value={search}
        lightTheme
        round
        containerStyle={{ backgroundColor: 'transparent', borderTopWidth: 0, borderBottomWidth: 0 }}
        inputContainerStyle={{ backgroundColor: 'white' }}
      />

      {loading && page === 0 ? (
        <ActivityIndicator size="large" color="#2089dc" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={renderTripItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          // 5. Props Ajaib Pagination
          onEndReached={loadMoreTrips} 
          onEndReachedThreshold={0.5} // Load lagi ketika scroll sisa 50% dari bawah
          ListFooterComponent={renderFooter} // Loading kecil di bawah
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Icon name="search" type="font-awesome" color="gray" size={50} style={{marginBottom:10}} />
                <Text>Tidak ditemukan jadwal jastip.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  cardContainer: { borderRadius: 10, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontWeight: 'bold', fontSize: 14 },
  tripDate: { fontSize: 12, color: 'gray' },
  destinationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  cityText: { color: '#2089dc', fontWeight: 'bold', marginBottom: 10, marginLeft: 34 },
  description: { color: '#555', marginLeft: 5 },
  emptyContainer: { marginTop: 50, alignItems: 'center' }
});