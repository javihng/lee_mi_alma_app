// supabase.js
import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

import { createClient } from "@supabase/supabase-js";

// ⚠️ Pega aquí tus datos desde Settings → API en Supabase
const SUPABASE_URL = "https://xbgxpowcpilvuyjadxpd.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZ3hwb3djcGlsdnV5amFkeHBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNTAyMjUsImV4cCI6MjA3MTkyNjIyNX0.iBRjYlHM_lV0eCrsgbdv5QC1FcpR8MWSmvyQHFac7iU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } }
});