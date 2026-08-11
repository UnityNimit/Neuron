// frontend/src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// I extracted your exact Project URL from your database string!
const supabaseUrl = 'https://dmrtbxgvzugcumndtgdu.supabase.co';

// 🛑 REPLACE THIS with your "anon / public" API Key (Steps to find it below)
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcnRieGd2enVnY3VtbmR0Z2R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Njc5NDUsImV4cCI6MjEwMjA0Mzk0NX0.Pmp0CeNjp-z7ZNZQiFWqFDEI6JIq5s3HxQxUOZZmo7I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);