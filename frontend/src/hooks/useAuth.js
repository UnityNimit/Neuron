import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useAuth() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const login = () => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  const logout = () => supabase.auth.signOut();

  return { session, login, logout };
}