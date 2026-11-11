/* ==========================================================================
   config.js — Conexión con Supabase (compartida por todos los módulos)
   --------------------------------------------------------------------------
   Los módulos 1, 3 y 4 usan esta misma base de datos y las mismas cuentas.
   Copia estos dos datos desde tu proyecto en supabase.com:
     Project Settings → Data API → Project URL
     Project Settings → API Keys → Publishable key (o la "anon public" key)

   La clave publicable está hecha para ir en el navegador: la seguridad la
   dan las políticas RLS de supabase/*.sql. NUNCA pongas aquí la "secret key"
   ni la "service_role key".
   ========================================================================== */
window.App = window.App || {};

App.config = {
  supabaseUrl: 'https://dwmhrvypjqystjjgoqak.supabase.co',
  supabaseKey: 'sb_publishable_Qqngn5rHT7eA_3XZQbMERg_VRrqPfeD',
  // Todos los módulos guardan la sesión con esta clave: al entrar en uno,
  // ya se tiene la sesión iniciada en los demás.
  storageKey: 'estadias-sesion',
};
