import { Button, Icon, Text } from '@rneui/themed';
import { Session } from '@supabase/supabase-js';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

export default function ChatScreen() {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // 1. Ambil Session & Load Pesan Awal
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchMessages();
    });

    // 2. Setup Realtime Channel (Dengan nama channel unik per order)
    // Tips: Gunakan ID order sebagai nama channel biar spesifik
    const channelName = `chat_room:${orderId}`; 
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          console.log("Pesan baru diterima Realtime!", payload); // Cek Terminal
          const newMessage = payload.new as Message;
          
          // Trik update state yang aman:
          setMessages((currentMessages) => {
            // Cek dulu, jangan sampai duplikat (kadang realtime kirim 2x)
            if (currentMessages.find(m => m.id === newMessage.id)) {
              return currentMessages;
            }
            return [...currentMessages, newMessage];
          });
        }
      )
      .subscribe();

    // 3. Bersihkan saat keluar
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  }

  async function sendMessage() {
    if (!inputText.trim() || !session) return;
    const textToSend = inputText;
    setInputText(''); 

    const { error } = await supabase.from('messages').insert({
      order_id: orderId,
      sender_id: session.user.id,
      content: textToSend,
    });

    if (error) {
        console.error('Gagal kirim:', error);
        setInputText(textToSend);
    }
  }

  const renderItem = ({ item }: { item: Message }) => {
    const isMe = item.sender_id === session?.user.id;
    return (
      <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
        <Text style={isMe ? styles.textRight : styles.textLeft}>{item.content}</Text>
        <Text style={styles.timeText}>
            {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </Text>
      </View>
    );
  };

  // Scroll ke bawah saat keyboard muncul
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
        flatListRef.current?.scrollToEnd({ animated: true });
    });
    return () => { keyboardDidShowListener.remove(); };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      
      {/* 1. HEADER (DI LUAR KeyboardAvoidingView) - Supaya diam di tempat */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="arrow-left" type="font-awesome" size={20} color="#333" />
        </TouchableOpacity>
        <View>
            <Text style={styles.headerTitle}>Ruang Diskusi</Text>
            <Text style={styles.headerSubtitle}>Order ID: ...{String(orderId).slice(-4)}</Text>
        </View>
      </View>

      {/* 2. AREA KONTEN (YANG BISA NAIK TURUN) */}
      <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          // iOS butuh 'padding', Android biasanya butuh 'height' atau 'padding' tergantung versi OS
          // Kita pakai ternary operator
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          // Offset untuk mengkompensasi tinggi Header agar tidak ketabrak
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.container}>
            {loading ? (
                <ActivityIndicator size="large" style={{marginTop: 20}} />
            ) : (
                <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
                // Saat ukuran konten berubah (ada pesan baru), scroll ke bawah
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                // Saat layout berubah (keyboard muncul), scroll ke bawah
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />
            )}

            {/* INPUT AREA */}
            <View style={styles.inputWrapper}>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Tulis pesan..."
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        placeholderTextColor="#999"
                    />
                    <Button 
                        icon={<Icon name="send" color="white" size={18} />} 
                        onPress={sendMessage} 
                        buttonStyle={{ borderRadius: 50, width: 45, height: 45, padding: 0, backgroundColor: '#2089dc' }}
                    />
                </View>
            </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
      backgroundColor: 'white',
      height: 60, // Kita set tinggi pasti
  },
  backButton: { padding: 10, marginRight: 10 },
  headerTitle: { fontWeight: 'bold', fontSize: 16 },
  headerSubtitle: { fontSize: 12, color: 'gray' },

  container: { flex: 1, backgroundColor: '#f5f5f5' },
  
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 20, marginBottom: 8 },
  bubbleRight: { alignSelf: 'flex-end', backgroundColor: '#dcf8c6', borderBottomRightRadius: 4 },
  bubbleLeft: { alignSelf: 'flex-start', backgroundColor: 'white', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#eee' },
  
  textRight: { color: '#333' },
  textLeft: { color: '#333' },
  timeText: { fontSize: 10, color: '#999', alignSelf: 'flex-end', marginTop: 4 },

  inputWrapper: {
      backgroundColor: 'white',
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderTopWidth: 1,
      borderTopColor: '#eee',
  },
  inputContainer: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    color: '#333',
    paddingTop: 10, 
    paddingBottom: 10,
  },
});