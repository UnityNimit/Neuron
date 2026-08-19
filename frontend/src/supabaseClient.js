// frontend/src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dmrtbxgvzugcumndtgdu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcnRieGd2enVnY3VtbmR0Z2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njc5NDUsImV4cCI6MjEwMjA0Mzk0NX0.Pmp0CeNjp-z7ZNZQiFWqFDEI6JIq5s3HxQxUOZZmo7I';

// -------------------------------------------------------------------------
// 1. SUPABASE CLIENT INITIALIZATION (With PKCE & Session Persistence)
// -------------------------------------------------------------------------
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// -------------------------------------------------------------------------
// 2. RUNTIME ENVIRONMENT DETECTOR
// -------------------------------------------------------------------------
export const isTauriApp = () => {
  return typeof window !== 'undefined' && Boolean(
    window.__TAURI_INTERNALS__ || window.__TAURI__
  );
};

// -------------------------------------------------------------------------
// 3. OFFLINE LOCAL DEVELOPER SESSION (Desktop Fallback)
// -------------------------------------------------------------------------
export const getLocalDesktopSession = () => ({
  access_token: 'local-desktop-token',
  token_type: 'bearer',
  expires_in: 315360000,
  refresh_token: 'local-desktop-refresh',
  user: {
    id: 'neuron-local-architect',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'architect@neuron.local',
    user_metadata: {
      full_name: 'Lead Software Architect',
      avatar_url: ''
    }
  }
});

// -------------------------------------------------------------------------
// 4. UNIVERSAL OAUTH SIGN-IN DISPATCHER
// -------------------------------------------------------------------------
export const signInWithGoogleOAuth = async () => {
  // If running in native desktop mode (.exe), bypass dead localhost redirect
  if (isTauriApp()) {
    try {
      // Store local session in localStorage
      const localSession = getLocalDesktopSession();
      localStorage.setItem('neuron_desktop_session', JSON.stringify(localSession));
      return { data: { session: localSession }, error: null };
    } catch (e) {
      return { data: { session: getLocalDesktopSession() }, error: null };
    }
  }

  // Web Browser Flow
  return await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
};