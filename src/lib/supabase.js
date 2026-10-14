/* =====================================================================
   Cliente de Supabase para VibeWire Alfa
   =====================================================================
   Soy estudiante de Ingeniería de Sistemas y este archivo crea el
   único cliente de Supabase que usa toda la aplicación. Desde aquí
   hago todas las consultas a la base de datos y gestiono la sesión
   del usuario.
   ===================================================================== */

/* Importo la función createClient desde el paquete oficial de Supabase.
   Este paquete me permite hablar con la base de datos Postgres y con
   el sistema de autenticación de Supabase directamente desde el
   navegador. */
import { createClient } from '@supabase/supabase-js';

/* Creo el cliente con dos variables de entorno públicas:
   - VITE_SUPABASE_URL: la URL del proyecto de Supabase.
   - VITE_SUPABASE_ANON_KEY: la clave pública anónima que permite
     operaciones protegidas por RLS (Row Level Security).
   Las claves privadas (service_role) nunca llegan al navegador porque
   podrían usarse para saltarse las políticas de seguridad. */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
