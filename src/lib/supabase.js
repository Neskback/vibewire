/* Cliente único para todas las operaciones autenticadas y de contenido de VibeWire. */
import { createClient } from '@supabase/supabase-js';

/* Las variables públicas del proyecto identifican el servicio; las claves privadas nunca llegan al navegador. */
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
