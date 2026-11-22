import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

let cachedSession; // undefined until the first check finishes

function useAuth() {
  const [session, setSession] = useState(cachedSession);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      cachedSession = data.session;
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      cachedSession = session;
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return session;
}

export default useAuth;