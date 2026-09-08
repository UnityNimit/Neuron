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
// 4. EXTERNAL DEFAULT BROWSER LAUNCHER
// -------------------------------------------------------------------------
export const openExternalBrowser = async (url) => {
  if (isTauriApp()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      return;
    } catch (err) {
      console.warn("[AUTH] Tauri plugin-opener error, falling back:", err);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};

// -------------------------------------------------------------------------
// 5. UNIVERSAL GOOGLE SIGN-IN DISPATCHER
// -------------------------------------------------------------------------
export const triggerGoogleLogin = async () => {
  // Opens the default browser directly to the Neuron Sidecar auth engine.
  // The sidecar generates cryptographic PKCE pairs, redirects to Google account selection,
  // exchanges the auth code directly with Supabase, and broadcasts session sync to the IDE.
  await openExternalBrowser('http://127.0.0.1:8000/auth');
};

export const triggerLogout = async () => {
  try {
    await fetch('http://127.0.0.1:8000/auth/logout', { method: 'POST' });
  } catch (e) {}

  try {
    await supabase.auth.signOut();
  } catch (e) {}
};

export const signInWithGoogleOAuth = triggerGoogleLogin;