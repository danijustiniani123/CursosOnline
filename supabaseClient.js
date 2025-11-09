import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabase = createClient(
  "https://apqssspkynusnqqpbyia.supabase.co", // ← reemplaza con tu URL si cambia
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcXNzc3BreW51c25xcXBieWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NjMwMDEsImV4cCI6MjA3ODIzOTAwMX0.KlMnfiOQ7P984qRU2V33_MB4w1dO-OOWSEqIBm5g4qo"   // ← tu clave pública anon
);
