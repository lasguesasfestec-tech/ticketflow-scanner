import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mismo proyecto de Supabase que usa toda la plataforma — nada de esto
// cambia aunque muevas los sitios web de un lugar a otro.
const SUPABASE_URL = 'https://nfxzltvdtloecsjokbja.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5meHpsdHZkdGxvZWNzam9rYmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NDAzNjQsImV4cCI6MjEwMTIxNjM2NH0.H-otHV7DReuqcwbiFo6GVSy8NHGUYTUkYMue3Mkl4jQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
