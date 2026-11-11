// ==========================================================================
// enviar-push — Notificaciones push de SIGEP UTP (Supabase Edge Function)
// --------------------------------------------------------------------------
// La llaman los módulos con la sesión del usuario:
//   { accion: 'clave' }                     → devuelve la clave pública VAPID
//   { accion: 'avisar', version: '<id>' }   → tesina (módulos 3 y 4):
//       · si llama el asesor (observación o dictamen) → al alumno
//       · si llama el alumno (subió una versión)      → a su asesor
//   { accion: 'avisar-documento', documento: '<id>' } → expediente (módulo 1):
//       · si llama el alumno (subió un documento)     → a su asesor
//       · si llama el asesor (lo revisó)              → al alumno
//   { accion: 'radar', titulo, texto, rojos, prueba? } → Radar de Estadías (módulo 2):
//       · al personal de coordinación que puede ver alumnos (o solo a quien
//         llama, si es una prueba). Quien llama debe tener ese permiso.
//
// Cada aviso lleva { titulo, texto, url, modulo, etiqueta }: «url» es
// relativa a la carpeta del módulo (modulo-1/, modulo-4/…), así el service
// worker de cualquier módulo sabe qué página abrir.
//
// Seguridad
// · La versión se consulta con la sesión de quien llama: si las reglas RLS
//   no le dejan verla, no se envía nada.
// · El destinatario lo decide esta función, no el navegador.
// · Solo se envía a los servicios de push de los navegadores (lista HOSTS).
//
// Secretos que hay que configurar en Supabase (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT (mailto:tu-correo)
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone
// Supabase automáticamente.
// ==========================================================================
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Servicios de push de Chrome/Edge/Android, Firefox, Windows y Safari/iPhone
const HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];
const extra = (Deno.env.get('PUSH_HOSTS_EXTRA') || '').split(',').filter(Boolean); // solo para pruebas locales
const permitido = (endpoint: string) => {
  try {
    const url = new URL(endpoint);
    return (url.protocol === 'https:' && HOSTS.some((h) => h.test(url.hostname))) || extra.some((e) => endpoint.startsWith(e));
  } catch {
    return false;
  }
};

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);

  const publica = Deno.env.get('VAPID_PUBLIC_KEY');
  const privada = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publica || !privada) return responder({ error: 'Faltan las claves VAPID en los secretos de la función.' }, 500);

  const cuerpo = await req.json().catch(() => ({}));
  const { accion, version, documento } = cuerpo;
  if (accion === 'clave') return responder({ clave: publica });
  const valida = (accion === 'avisar' && typeof version === 'string') || (accion === 'avisar-documento' && typeof documento === 'string')
    || (accion === 'radar' && typeof cuerpo.titulo === 'string');
  if (!valida) return responder({ error: 'Petición no válida.' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await usuario.auth.getUser();
  if (!user) return responder({ error: 'Tu sesión terminó.' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:estadias@example.com', publica, privada);

  // Envía el aviso a todos los dispositivos de esas cuentas
  async function enviarA(usuarios: string[], aviso: Record<string, unknown>) {
    if (!usuarios.length) return { enviadas: 0, dispositivos: 0 };
    const { data: suscripciones } = await admin.from('suscripciones_push').select('id, endpoint, p256dh, auth').in('usuario_id', usuarios);
    let enviadas = 0;
    for (const s of suscripciones ?? []) {
      if (!permitido(s.endpoint)) continue;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), { TTL: 86400 });
        enviadas++;
      } catch (error) {
        // 404/410: el navegador canceló la suscripción; se borra
        const estado = (error as { statusCode?: number }).statusCode;
        if (estado === 404 || estado === 410) await admin.from('suscripciones_push').delete().eq('id', s.id);
      }
    }
    return { enviadas, dispositivos: suscripciones?.length ?? 0 };
  }

  if (accion === 'radar') {
    // Solo el personal que puede ver alumnos manda (y recibe) alertas del radar
    const { data: puede } = await usuario.rpc('tiene_permiso', { p_permiso: 'alumnos.ver' });
    if (!puede) return responder({ error: 'Tu rol no tiene permiso para esta acción.' }, 403);
    let destinatarios = [user.id];
    if (!cuerpo.prueba) {
      const { data: personal } = await admin.from('personal_admin').select('id, roles_admin (permisos)').eq('activo', true);
      destinatarios = (personal ?? [])
        .filter((p) => ((p.roles_admin as { permisos?: string[] } | null)?.permisos ?? []).includes('alumnos.ver'))
        .map((p) => p.id as string);
    }
    const rojos = Number.isFinite(Number(cuerpo.rojos)) ? Math.max(0, Math.round(Number(cuerpo.rojos))) : undefined;
    return responder(await enviarA(destinatarios, {
      titulo: String(cuerpo.titulo).slice(0, 120),
      texto: String(cuerpo.texto || '').slice(0, 300),
      url: 'index.html#/app/radar',
      modulo: 2,
      etiqueta: 'sigep-radar',
      rojos,
    }));
  }

  const asesorDe = async (alumnoId: string) =>
    (await admin.from('asignaciones_asesor').select('asesor_id').eq('alumno_id', alumnoId).maybeSingle()).data?.asesor_id as string | undefined;
  const nombreDe = async (alumnoId: string) =>
    (await admin.from('alumnos').select('nombre').eq('id', alumnoId).maybeSingle()).data?.nombre as string | undefined;

  let destinatario: string | undefined;
  let aviso: { titulo: string; texto: string; url: string; modulo: number; etiqueta: string };

  if (accion === 'avisar') {
    // Con la sesión de quien llama: si no puede ver la versión, no hay aviso
    const { data: v } = await usuario
      .from('tesina_versiones')
      .select('id, numero, alumno_id, nombre_archivo, estado')
      .eq('id', version)
      .maybeSingle();
    if (!v) return responder({ error: 'No tienes acceso a esa versión.' }, 403);

    if (user.id === v.alumno_id) {
      // El alumno subió una versión: se avisa a su asesor
      destinatario = await asesorDe(v.alumno_id);
      aviso = {
        titulo: `Nueva versión de ${(await nombreDe(v.alumno_id)) ?? 'tu alumno'}`,
        texto: `Subió la versión ${v.numero} de su tesina (${v.nombre_archivo}). Ya puedes revisarla.`,
        url: `asesor.html#alumno/${v.alumno_id}`,
        modulo: 4,
        etiqueta: `tesina-${v.id}`,
      };
    } else {
      // El asesor dejó una observación o un dictamen: se avisa al alumno
      destinatario = v.alumno_id;
      aviso = {
        titulo: 'Tu asesor revisó tu tesina',
        texto: `Revisó la versión ${v.numero}. Estado: ${v.estado}.`,
        url: 'alumno.html#tesina',
        modulo: 4,
        etiqueta: `tesina-${v.id}`,
      };
    }
  } else {
    // Documento del expediente digital (Módulo 1)
    const { data: d } = await usuario
      .from('documentos')
      .select('id, estado, version, expediente_id, tipos_documento (nombre)')
      .eq('id', documento)
      .maybeSingle();
    if (!d) return responder({ error: 'No tienes acceso a ese documento.' }, 403);
    const { data: exp } = await admin.from('expedientes').select('alumno_id').eq('id', d.expediente_id).maybeSingle();
    if (!exp) return responder({ error: 'El expediente no existe.' }, 404);
    const tipo = (d.tipos_documento as { nombre?: string } | null)?.nombre ?? 'un documento';

    if (user.id === exp.alumno_id) {
      destinatario = await asesorDe(exp.alumno_id);
      aviso = {
        titulo: `Documento nuevo de ${(await nombreDe(exp.alumno_id)) ?? 'tu alumno'}`,
        texto: `Subió «${tipo}» (versión ${d.version}). Ya puedes revisarlo.`,
        url: 'modulo-1.html#revisar',
        modulo: 1,
        etiqueta: `documento-${d.id}`,
      };
    } else {
      destinatario = exp.alumno_id;
      aviso = {
        titulo: 'Tu asesor revisó tu expediente',
        texto: `«${tipo}»: ${d.estado}.`,
        url: d.estado === 'Requiere corrección' ? 'modulo-1.html#observaciones' : 'modulo-1.html#documentos',
        modulo: 1,
        etiqueta: `documento-${d.id}`,
      };
    }
  }

  if (!destinatario) return responder({ enviadas: 0, motivo: 'El alumno no tiene asesor asignado.' });

  const { enviadas } = await enviarA([destinatario], aviso);
  return responder({ enviadas });
});
