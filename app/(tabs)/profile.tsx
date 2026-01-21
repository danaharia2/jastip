import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Account from '../../components/Account';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {session && <Account session={session} />}
    </View>
  );
}