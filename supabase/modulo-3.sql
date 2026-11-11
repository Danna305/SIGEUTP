-- ==========================================================================
-- modulo-3.sql — Módulo 3: Seguimiento académico (pre-auditoría de tesinas)
-- --------------------------------------------------------------------------
-- Antes el módulo tenía su propio proyecto de Supabase, una tabla
-- «usuarios» con contraseñas y reglas abiertas a cualquiera. Ahora usa el
-- mismo Supabase que el resto de SIGEP:
--   · Inicio de sesión con Supabase Auth (las mismas cuentas de alumnos y
--     asesores de los módulos 1 y 4).
--   · Pre-audita las versiones reales de la tesina (tabla tesina_versiones
--     del Módulo 4).
--   · Reglas RLS: el asesor solo trabaja con sus alumnos asignados y cada
--     alumno solo ve lo suyo.
--
-- Requisito: haber ejecutado antes supabase/esquema.sql y supabase/tesina.sql.
-- Cómo usarlo: en Supabase abre "SQL Editor", pega todo este archivo y pulsa
-- "Run". Se puede ejecutar más de una vez sin duplicar nada.
--
-- Los identificadores son TEXT porque la app también los guarda en
-- IndexedDB para trabajar sin conexión: alumno_id es el id de la cuenta del
-- alumno y version_id, el id de su versión en tesina_versiones.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Tablas
-- --------------------------------------------------------------------------
create table if not exists public.dictamenes (
  id              text primary key,
  alumno_id       text not null,
  version_id      text not null,
  version_numero  integer,
  estado          text not null default 'Pendiente',
  observacion     text,
  actualizado     timestamptz not null default now()
);

create table if not exists public.evaluaciones_checklist (
  id              text primary key,
  alumno_id       text not null,
  version_id      text not null,
  version_numero  integer,
  criterio_id     text not null,
  criterio        text,
  cumple          boolean not null default false,
  nota            text,
  pagina          integer,
  actualizado     timestamptz not null default now()
);

create table if not exists public.notificaciones (
  id          bigint primary key,
  alumno_id   text not null,
  version_id  text,
  titulo      text not null,
  cuerpo      text not null,
  leida       boolean not null default false,
  fecha       timestamptz not null default now()
);

create table if not exists public.citas (
  id          text primary key,
  alumno_id   text not null,
  asesor_id   text,
  fecha       timestamptz not null,
  motivo      text not null,
  estado      text not null default 'Programada',
  created_at  timestamptz not null default now()
);

create index if not exists dictamenes_alumno_idx on public.dictamenes (alumno_id);
create index if not exists evaluaciones_alumno_idx on public.evaluaciones_checklist (alumno_id);
create index if not exists evaluaciones_version_idx on public.evaluaciones_checklist (version_id);
create index if not exists notificaciones_alumno_idx on public.notificaciones (alumno_id);
create index if not exists citas_alumno_idx on public.citas (alumno_id);
create index if not exists citas_fecha_idx on public.citas (fecha);

-- --------------------------------------------------------------------------
-- 2. Reglas de seguridad (RLS)
-- --------------------------------------------------------------------------
alter table public.dictamenes enable row level security;
alter table public.evaluaciones_checklist enable row level security;
alter table public.notificaciones enable row level security;
alter table public.citas enable row level security;

-- Se quitan las reglas de prueba de la versión anterior (abiertas a cualquiera)
drop policy if exists "acceso_demo_dictamenes" on public.dictamenes;
drop policy if exists "acceso_demo_evaluaciones" on public.evaluaciones_checklist;
drop policy if exists "acceso_demo_notificaciones" on public.notificaciones;
drop policy if exists "acceso_demo_citas" on public.citas;

-- Dictámenes y checklist: los escribe el asesor; los consulta el alumno
drop policy if exists "consultar dictamenes" on public.dictamenes;
create policy "consultar dictamenes" on public.dictamenes for select to authenticated
  using (alumno_id = (select auth.uid())::text or public.es_asesor_de(alumno_id));
drop policy if exists "asesor escribe dictamenes" on public.dictamenes;
create policy "asesor escribe dictamenes" on public.dictamenes for all to authenticated
  using (public.es_asesor_de(alumno_id)) with check (public.es_asesor_de(alumno_id));

drop policy if exists "consultar evaluaciones" on public.evaluaciones_checklist;
create policy "consultar evaluaciones" on public.evaluaciones_checklist for select to authenticated
  using (alumno_id = (select auth.uid())::text or public.es_asesor_de(alumno_id));
drop policy if exists "asesor escribe evaluaciones" on public.evaluaciones_checklist;
create policy "asesor escribe evaluaciones" on public.evaluaciones_checklist for all to authenticated
  using (public.es_asesor_de(alumno_id)) with check (public.es_asesor_de(alumno_id));

-- Notificaciones: las crea el asesor; el alumno también las marca como leídas
drop policy if exists "consultar notificaciones" on public.notificaciones;
create policy "consultar notificaciones" on public.notificaciones for select to authenticated
  using (alumno_id = (select auth.uid())::text or public.es_asesor_de(alumno_id));
drop policy if exists "escribir notificaciones" on public.notificaciones;
create policy "escribir notificaciones" on public.notificaciones for all to authenticated
  using (alumno_id = (select auth.uid())::text or public.es_asesor_de(alumno_id))
  with check (alumno_id = (select auth.uid())::text or public.es_asesor_de(alumno_id));

-- Citas: las agenda el asesor; el alumno las consulta
drop policy if exists "consultar citas" on public.citas;
create policy "consultar citas" on public.citas for select to authenticated
  using (alumno_id = (select auth.uid())::text or public.es_asesor_de(alumno_id));
drop policy if exists "asesor escribe citas" on public.citas;
create policy "asesor escribe citas" on public.citas for all to authenticated
  using (public.es_asesor_de(alumno_id)) with check (public.es_asesor_de(alumno_id));

revoke all on public.dictamenes, public.evaluaciones_checklist, public.notificaciones, public.citas from anon;
grant select, insert, update, delete on public.dictamenes, public.evaluaciones_checklist,
  public.notificaciones, public.citas to authenticated;

-- La versión anterior creaba una tabla «usuarios» con contraseñas y la
-- función verificar_login(). Ya no se usan: el inicio de sesión es con
-- Supabase Auth, igual que en los módulos 1 y 4.
