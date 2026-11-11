// ==========================================================================
// gestion-cuentas — Altas y bajas de cuentas desde el Módulo 2 (Edge Function)
// --------------------------------------------------------------------------
// Crear o borrar una cuenta de Supabase Auth necesita la llave secreta, que
// nunca debe llegar al navegador; por eso lo hace esta función. La llama el
// panel de coordinación con la sesión del usuario:
//
//   { accion: 'crear', tipo: 'alumno' | 'asesor' | 'personal', correo, password,
//     nombre, matricula?, nivel?, rol_id? }            → { id }
//   { accion: 'eliminar', tipo, id }                   → { ok: true }
//   { accion: 'contrasena', id, password }             → { ok: true }  (solo personal)
//
// Seguridad
// · El permiso se revisa con la sesión de quien llama (tiene_permiso):
//   alumno → alumnos.editar · asesor → asesores.editar · personal → usuarios.editar
// · SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone
//   Supabase automáticamente; no hay que configurar secretos.
// ==========================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PERMISO: Record<string, string> = { alumno: 'alumnos.editar', asesor: 'asesores.editar', personal: 'usuarios.editar' };
const NIVELES = ['TSU', 'Ingeniería'];
const esCorreo = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await usuario.auth.getUser();
  if (!user) return responder({ error: 'Tu sesión terminó. Vuelve a iniciar sesión.' }, 401);

  const b = await req.json().catch(() => ({}));
  const tipo = b.accion === 'contrasena' ? 'personal' : String(b.tipo || '');
  if (!PERMISO[tipo]) return responder({ error: 'Petición no válida.' }, 400);

  const { data: permitido } = await usuario.rpc('tiene_permiso', { p_permiso: PERMISO[tipo] });
  if (!permitido) return responder({ error: 'Tu rol no tiene permiso para esta acción.' }, 403);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  /* ---------- Crear cuenta ---------- */
  if (b.accion === 'crear') {
    const correo = String(b.correo || '').trim().toLowerCase();
    const nombre = String(b.nombre || '').trim();
    const password = String(b.password || '');
    if (!esCorreo(correo)) return responder({ error: 'El correo electrónico no es válido.' }, 400);
    if (nombre.length < 4) return responder({ error: 'Escribe el nombre completo.' }, 400);
    if (password.length < 8) return responder({ error: 'La contraseña inicial debe tener al menos 8 caracteres.' }, 400);

    const metadatos: Record<string, string> = { nombre };
    if (tipo === 'alumno') {
      const matricula = String(b.matricula || '').trim();
      const nivel = String(b.nivel || '');
      if (!/^[0-9]{10}$/.test(matricula)) return responder({ error: 'La matrícula debe tener 10 dígitos.' }, 400);
      if (!NIVELES.includes(nivel)) return responder({ error: 'Selecciona el nivel: TSU o Ingeniería.' }, 400);
      const { data: libre } = await admin.rpc('matricula_disponible', { p_matricula: matricula });
      if (libre === false) return responder({ error: `Ya existe un alumno con la matrícula ${matricula}.` }, 409);
      Object.assign(metadatos, { matricula, nivel }); // el disparador de esquema.sql crea su renglón en alumnos
    }
    if (tipo === 'personal') {
      const { data: rol } = await admin.from('roles_admin').select('id').eq('id', String(b.rol_id || '')).maybeSingle();
      if (!rol) return responder({ error: 'Selecciona un rol válido.' }, 400);
    }

    const { data: creada, error } = await admin.auth.admin.createUser({
      email: correo, password, email_confirm: true, user_metadata: metadatos,
    });
    if (error || !creada.user) {
      const existe = /already|registered|exists/i.test(error?.message || '');
      return responder({ error: existe ? 'Ya existe una cuenta con ese correo.' : 'No se pudo crear la cuenta.' }, existe ? 409 : 400);
    }
    const id = creada.user.id;

    let fallo = null;
    if (tipo === 'asesor') {
      ({ error: fallo } = await admin.from('asesores').insert({ id, nombre, correo }));
    } else if (tipo === 'personal') {
      ({ error: fallo } = await admin.from('personal_admin').insert({ id, nombre, correo, rol_id: b.rol_id, activo: b.activo !== false }));
    } else {
      const { data: fila } = await admin.from('alumnos').select('id').eq('id', id).maybeSingle();
      if (!fila) fallo = { message: 'No se creó el registro del alumno.' };
    }
    if (fallo) {
      await admin.auth.admin.deleteUser(id); // deshace la cuenta para no dejarla a medias
      return responder({ error: 'No se pudo registrar: ' + fallo.message }, 400);
    }
    return responder({ id }, 201);
  }

  /* ---------- Eliminar cuenta ---------- */
  if (b.accion === 'eliminar') {
    const id = String(b.id || '');
    const tabla = { alumno: 'alumnos', asesor: 'asesores', personal: 'personal_admin' }[tipo]!;
    const { data: fila } = await admin.from(tabla).select('id, nombre').eq('id', id).maybeSingle();
    if (!fila) return responder({ error: 'No se encontró el registro.' }, 404);

    if (tipo === 'asesor') {
      const { count } = await admin.from('asignaciones_asesor').select('alumno_id', { count: 'exact', head: true }).eq('asesor_id', id);
      if (count) {
        return responder({ error: `${fila.nombre} tiene ${count} asignaciones registradas. Desactívalo en lugar de eliminarlo, o reasigna a sus alumnos.` }, 409);
      }
    }
    if (tipo === 'personal') {
      if (id === user.id) return responder({ error: 'No puedes eliminar tu propio usuario.' }, 409);
      const { data: p } = await admin.from('personal_admin').select('rol_id').eq('id', id).maybeSingle();
      if (p?.rol_id === 'admin') {
        const { count } = await admin.from('personal_admin').select('id', { count: 'exact', head: true })
          .eq('rol_id', 'admin').eq('activo', true).neq('id', id);
        if (!count) return responder({ error: 'Debe quedar al menos un administrador activo.' }, 409);
      }
    }
    // Borrar la cuenta borra en cascada su renglón y lo que dependa de él
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return responder({ error: 'No se pudo eliminar la cuenta.' }, 400);
    return responder({ ok: true });
  }

  /* ---------- Restablecer contraseña de un usuario del personal ---------- */
  if (b.accion === 'contrasena') {
    const id = String(b.id || '');
    const password = String(b.password || '');
    if (password.length < 8) return responder({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
    const { data: fila } = await admin.from('personal_admin').select('id').eq('id', id).maybeSingle();
    if (!fila) return responder({ error: 'Usuario no encontrado.' }, 404);
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return responder({ error: 'No se pudo cambiar la contraseña.' }, 400);
    return responder({ ok: true });
  }

  return responder({ error: 'Petición no válida.' }, 400);
});
