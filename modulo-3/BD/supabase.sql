-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

---------------------------------------------------------
-- 1. TABLA DE USUARIOS (Para el Login)
---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    correo TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('asesor', 'alumno')),
    matricula_nombres TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS y Políticas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_lectura_login" ON public.usuarios;
CREATE POLICY "permitir_lectura_login" ON public.usuarios FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.usuarios TO anon, authenticated;

-- Insertar datos de prueba
INSERT INTO public.usuarios (nombre, correo, password_hash, rol, matricula_nombres)
VALUES 
    ('Asesor Académico', 'asesor@utp.edu.mx', crypt('Utp2026!', gen_salt('bf')), 'asesor', 'DOC-001'),
    ('María José Hernández', 'demo@utp.edu.mx', crypt('Utp2026!', gen_salt('bf')), 'alumno', '20230001')
ON CONFLICT (correo) DO NOTHING;

---------------------------------------------------------
-- 2. VALIDACIÓN SEGURA DE CREDENCIALES (Login)
---------------------------------------------------------
-- Compara la contraseña enviada contra el hash bcrypt almacenado.
-- Devuelve únicamente la fila del usuario cuando las credenciales coinciden.
CREATE OR REPLACE FUNCTION public.verificar_login(p_correo TEXT, p_password TEXT)
RETURNS TABLE (id UUID, nombre TEXT, correo TEXT, rol TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT u.id, u.nombre, u.correo, u.rol
  FROM public.usuarios u
  WHERE lower(u.correo) = lower(p_correo)
    AND u.password_hash = crypt(p_password, u.password_hash)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_login(TEXT, TEXT) TO anon, authenticated;

---------------------------------------------------------
-- 3. TABLAS DE SINCRONIZACIÓN (Dictamen, checklist, avisos y citas)
---------------------------------------------------------
-- Los IDs son TEXT para reutilizar los identificadores locales de IndexedDB.
CREATE TABLE IF NOT EXISTS public.dictamenes (
    id TEXT PRIMARY KEY,
    alumno_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    version_numero INTEGER,
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    observacion TEXT,
    actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evaluaciones_checklist (
    id TEXT PRIMARY KEY,
    alumno_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    version_numero INTEGER,
    criterio_id TEXT NOT NULL,
    criterio TEXT,
    cumple BOOLEAN NOT NULL DEFAULT false,
    nota TEXT,
    pagina INTEGER,
    actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notificaciones (
    id BIGINT PRIMARY KEY,
    alumno_id TEXT NOT NULL,
    version_id TEXT,
    titulo TEXT NOT NULL,
    cuerpo TEXT NOT NULL,
    leida BOOLEAN NOT NULL DEFAULT false,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.citas (
    id TEXT PRIMARY KEY,
    alumno_id TEXT NOT NULL,
    asesor_id TEXT,
    fecha TIMESTAMPTZ NOT NULL,
    motivo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'Programada',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dictamenes_alumno_idx ON public.dictamenes (alumno_id);
CREATE INDEX IF NOT EXISTS evaluaciones_alumno_idx ON public.evaluaciones_checklist (alumno_id);
CREATE INDEX IF NOT EXISTS evaluaciones_version_idx ON public.evaluaciones_checklist (version_id);
CREATE INDEX IF NOT EXISTS notificaciones_alumno_idx ON public.notificaciones (alumno_id);
CREATE INDEX IF NOT EXISTS citas_alumno_idx ON public.citas (alumno_id);
CREATE INDEX IF NOT EXISTS citas_fecha_idx ON public.citas (fecha);

ALTER TABLE public.dictamenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluaciones_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acceso_demo_dictamenes" ON public.dictamenes;
CREATE POLICY "acceso_demo_dictamenes" ON public.dictamenes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "acceso_demo_evaluaciones" ON public.evaluaciones_checklist;
CREATE POLICY "acceso_demo_evaluaciones" ON public.evaluaciones_checklist FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "acceso_demo_notificaciones" ON public.notificaciones;
CREATE POLICY "acceso_demo_notificaciones" ON public.notificaciones FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "acceso_demo_citas" ON public.citas;
CREATE POLICY "acceso_demo_citas" ON public.citas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dictamenes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluaciones_checklist TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificaciones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.citas TO anon, authenticated;

