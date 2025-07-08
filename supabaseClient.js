import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "https://eevijzdfqmhzuptwbkpw.supabase.co", // ← reemplaza con tu URL si cambia
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVldmlqemRmcW1oenVwdHdia3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1MTE4NzksImV4cCI6MjA2NzA4Nzg3OX0.cZiem42xcQyDhfvJTw2vrszhbn2NcOJ_nH_Twv37a5k"   // ← tu clave pública anon
);