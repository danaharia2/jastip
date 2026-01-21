import { Session } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import CreateTrip from '../../components/CreateTrip';
import { supabase } from '../../lib/supabase';

export default function PostScreen() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  if (!session) return <View><Text>Loading...</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Tampilkan Form Create Trip */}
      <CreateTrip session={session} />
    </View>
  );
}