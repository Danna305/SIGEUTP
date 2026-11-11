-- ==========================================================================
-- modulo-2.sql — Módulo 2: Administración y gestión académica
-- --------------------------------------------------------------------------
-- Antes el módulo tenía su propio servidor (Node.js + Express), su propio
-- proyecto de Supabase y una tabla de usuarios con contraseñas. Ahora usa el
-- mismo Supabase y las mismas cuentas que el resto de SIGEP:
--   · El personal de coordinación entra con Supabase Auth; su rol y sus
--     permisos están en personal_admin y roles_admin.
--   · Trabaja sobre las tablas reales: alumnos, asesores y
--     asignaciones_asesor (las mismas de los módulos 1, 3 y 4), a las que
--     este archivo les agrega los datos académicos (carrera, grupo, periodo,
--     empresa, capacidad del asesor…).
--   · Las reglas importantes viven en la base de datos: permisos por rol,
--     capacidad del asesor, un solo periodo activo y al menos un
--     administrador activo.
--
-- Requisito: haber ejecutado antes esquema.sql, tesina.sql y modulo-1.sql.
-- Cómo usarlo: en Supabase abre "SQL Editor", pega todo este archivo y pulsa
-- "Run". Se puede ejecutar más de una vez sin duplicar nada.
--
-- Primer administrador (una sola vez, en el SQL Editor; la cuenta debe
-- existir en Authentication → Users):
--   select hacer_personal('correo@utpuebla.edu.mx', 'Nombre Apellido', 'admin');
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Roles, personal de coordinación y catálogos del módulo
-- --------------------------------------------------------------------------
create table if not exists public.roles_admin (
  id           text primary key,
  nombre       text not null,
  descripcion  text,
  permisos     jsonb not null default '[]'::jsonb,   -- ["alumnos.ver", "alumnos.editar", …]
  sistema      boolean not null default false,        -- true: sus permisos no se pueden cambiar
  orden        integer not null default 0
);

insert into public.roles_admin (id, nombre, descripcion, permisos, sistema, orden) values
  ('admin', 'Administrador', 'Control total del módulo, incluidos periodos, usuarios y permisos.',
   '["alumnos.ver","alumnos.editar","asesores.ver","asesores.editar","asignaciones.editar","periodos.ver","periodos.editar","empresas.ver","empresas.editar","expedientes.ver","usuarios.ver","usuarios.editar"]', true, 1),
  ('coordinador', 'Coordinador de carrera', 'Gestiona alumnos, asesores, asignaciones y empresas. Consulta periodos.',
   '["alumnos.ver","alumnos.editar","asesores.ver","asesores.editar","asignaciones.editar","periodos.ver","empresas.ver","empresas.editar","expedientes.ver"]', false, 2),
  ('consulta', 'Consulta', 'Solo consulta información y estadísticas; no modifica datos.',
   '["alumnos.ver","asesores.ver","periodos.ver","empresas.ver","expedientes.ver"]', false, 3)
on conflict (id) do nothing;

create table if not exists public.personal_admin (
  id             uuid primary key references auth.users (id) on delete cascade,
  nombre         text not null check (char_length(trim(nombre)) between 3 and 120),
  correo         text not null unique,
  rol_id         text not null references public.roles_admin (id),
  activo         boolean not null default true,
  ultimo_acceso  timestamptz,
  creado_en      timestamptz not null default now()
);

create table if not exists public.periodos (
  id      text primary key default gen_random_uuid()::text,
  clave   text not null unique check (clave ~ '^[A-Z0-9-]{4,12}$'),
  nombre  text not null check (char_length(trim(nombre)) between 4 and 60),
  inicio  date not null,
  fin     date not null,
  estado  text not null default 'planeado' check (estado in ('planeado', 'activo', 'cerrado')),
  constraint periodo_fechas check (fin > inicio)
);
-- Solo puede haber un periodo activo
create unique index if not exists periodos_un_activo on public.periodos ((true)) where estado = 'activo';

create table if not exists public.empresas (
  id         text primary key default gen_random_uuid()::text,
  nombre     text not null check (char_length(trim(nombre)) between 3 and 90),
  rfc        text check (rfc is null or rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  giro       text not null,
  ciudad     text,
  direccion  text,
  convenio   text not null default 'tramite' check (convenio in ('vigente', 'tramite')),
  vence      date,
  creado_en  timestamptz not null default now(),
  constraint convenio_con_fecha check (convenio = 'tramite' or vence is not null)
);
create unique index if not exists empresas_nombre_un on public.empresas (lower(nombre));

create table if not exists public.contactos_empresa (
  id          text primary key default gen_random_uuid()::text,
  empresa_id  text not null references public.empresas (id) on delete cascade,
  nombre      text not null check (char_length(trim(nombre)) between 4 and 90),
  puesto      text,
  email       text,
  telefono    text,
  principal   boolean not null default false,
  constraint contacto_con_medio check (coalesce(email, '') <> '' or coalesce(telefono, '') <> '')
);
create index if not exists contactos_empresa_idx on public.contactos_empresa (empresa_id);

-- Bitácora de actividad del panel
create table if not exists public.bitacora_admin (
  id       bigint generated always as identity primary key,
  fecha    timestamptz not null default now(),
  usuario  text not null,
  accion   text not null check (char_length(accion) <= 200)
);

-- Número de versión de los datos: el panel lo consulta cada pocos segundos
-- para saber si otra persona (o otro módulo) hizo cambios
create table if not exists public.m2_version (
  id     integer primary key default 1 check (id = 1),
  valor  bigint not null default 1
);
insert into public.m2_version (id, valor) values (1, 1) on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- 2. Datos académicos en las tablas que comparten todos los módulos
-- --------------------------------------------------------------------------
alter table public.alumnos add column if not exists telefono   text;
alter table public.alumnos add column if not exists carrera    text check (carrera in ('ISC', 'IMT', 'IIN', 'LNM', 'IER'));
alter table public.alumnos add column if not exists grupo      text check (grupo ~ '^[A-Z0-9]{1,3}$');
alter table public.alumnos add column if not exists periodo_id text references public.periodos (id);
alter table public.alumnos add column if not exists empresa_id text references public.empresas (id);
alter table public.alumnos add column if not exists proyecto   text check (char_length(proyecto) <= 140);
alter table public.alumnos add column if not exists estado     text not null default 'activo' check (estado in ('activo', 'baja', 'concluido'));

alter table public.asesores add column if not exists telefono  text;
alter table public.asesores add column if not exists carrera   text check (carrera in ('ISC', 'IMT', 'IIN', 'LNM', 'IER'));
alter table public.asesores add column if not exists area      text;
alter table public.asesores add column if not exists capacidad integer not null default 10 check (capacidad between 1 and 30);
alter table public.asesores add column if not exists activo    boolean not null default true;

alter table public.asignaciones_asesor add column if not exists periodo_id text references public.periodos (id);
alter table public.asignaciones_asesor add column if not exists tipo text not null default 'individual' check (tipo in ('individual', 'masiva', 'automatica'));

create index if not exists alumnos_periodo_idx on public.alumnos (periodo_id);
create index if not exists alumnos_empresa_idx on public.alumnos (empresa_id);
create index if not exists asignaciones_periodo_idx on public.asignaciones_asesor (asesor_id, periodo_id);

-- Un alumno nuevo queda en el periodo activo; una asignación, en el periodo del alumno
create or replace function public.m2_periodo_por_defecto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'alumnos' then
    if new.periodo_id is null then
      select p.id into new.periodo_id from public.periodos p where p.estado = 'activo';
    end if;
  elsif new.periodo_id is null or tg_op = 'UPDATE' and new.asesor_id is distinct from old.asesor_id and new.periodo_id = old.periodo_id then
    select a.periodo_id into new.periodo_id from public.alumnos a where a.id = new.alumno_id;
  end if;
  return new;
end;
$$;

drop trigger if exists m2_alumno_periodo on public.alumnos;
create trigger m2_alumno_periodo before insert on public.alumnos
  for each row execute function public.m2_periodo_por_defecto();
drop trigger if exists m2_asignacion_periodo on public.asignaciones_asesor;
create trigger m2_asignacion_periodo before insert or update on public.asignaciones_asesor
  for each row execute function public.m2_periodo_por_defecto();

-- --------------------------------------------------------------------------
-- 3. Permisos: ¿quién es personal de coordinación y qué puede hacer?
-- --------------------------------------------------------------------------
create or replace function public.es_personal()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.personal_admin p where p.id = auth.uid() and p.activo);
$$;

create or replace function public.tiene_permiso(p_permiso text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.personal_admin p
    join public.roles_admin r on r.id = p.rol_id
    where p.id = auth.uid() and p.activo and r.permisos ? p_permiso
  );
$$;

-- Perfil de quien entra al panel (null si no es personal activo); registra el acceso
create or replace function public.mi_personal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'email', p.correo, 'rol_id', p.rol_id,
                            'rol', r.nombre, 'activo', p.activo, 'permisos', r.permisos)
    into v
  from public.personal_admin p join public.roles_admin r on r.id = p.rol_id
  where p.id = auth.uid();
  if v is not null and (v ->> 'activo')::boolean then
    update public.personal_admin set ultimo_acceso = now() where id = auth.uid();
  end if;
  return v;
end;
$$;

create or replace function public.m2_version_actual()
returns bigint
language sql
security definer
set search_path = ''
stable
as $$
  select case when public.es_personal() then (select valor from public.m2_version where id = 1) end;
$$;

revoke all on function public.es_personal() from public, anon;
revoke all on function public.tiene_permiso(text) from public, anon;
revoke all on function public.mi_personal() from public, anon;
revoke all on function public.m2_version_actual() from public, anon;
grant execute on function public.es_personal() to authenticated;
grant execute on function public.tiene_permiso(text) to authenticated;
grant execute on function public.mi_personal() to authenticated;
grant execute on function public.m2_version_actual() to authenticated;

-- Cualquier cambio en los datos del panel sube el número de versión
create or replace function public.m2_subir_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.m2_version set valor = valor + 1 where id = 1;
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['alumnos', 'asesores', 'asignaciones_asesor', 'documentos', 'periodos',
                           'empresas', 'contactos_empresa', 'personal_admin', 'roles_admin'] loop
    execute format('drop trigger if exists m2_version on public.%I', t);
    execute format('create trigger m2_version after insert or update or delete on public.%I
                    for each statement execute function public.m2_subir_version()', t);
  end loop;
end
$$;

-- --------------------------------------------------------------------------
-- 4. Reglas de seguridad (RLS)
--    El personal activo consulta todo lo del módulo; para modificar necesita
--    el permiso de su rol. Alumnos y asesores no ven nada de este módulo.
-- --------------------------------------------------------------------------
alter table public.roles_admin enable row level security;
alter table public.personal_admin enable row level security;
alter table public.periodos enable row level security;
alter table public.empresas enable row level security;
alter table public.contactos_empresa enable row level security;
alter table public.bitacora_admin enable row level security;
alter table public.m2_version enable row level security;

drop policy if exists "personal consulta roles" on public.roles_admin;
create policy "personal consulta roles" on public.roles_admin for select to authenticated
  using (public.es_personal());

drop policy if exists "consultar personal" on public.personal_admin;
create policy "consultar personal" on public.personal_admin for select to authenticated
  using (id = (select auth.uid()) or public.tiene_permiso('usuarios.ver'));

drop policy if exists "personal consulta periodos" on public.periodos;
create policy "personal consulta periodos" on public.periodos for select to authenticated
  using (public.es_personal());
drop policy if exists "editar periodos" on public.periodos;
create policy "editar periodos" on public.periodos for all to authenticated
  using (public.tiene_permiso('periodos.editar')) with check (public.tiene_permiso('periodos.editar'));

drop policy if exists "personal consulta empresas" on public.empresas;
create policy "personal consulta empresas" on public.empresas for select to authenticated
  using (public.es_personal());
drop policy if exists "editar empresas" on public.empresas;
create policy "editar empresas" on public.empresas for all to authenticated
  using (public.tiene_permiso('empresas.editar')) with check (public.tiene_permiso('empresas.editar'));

drop policy if exists "personal consulta contactos" on public.contactos_empresa;
create policy "personal consulta contactos" on public.contactos_empresa for select to authenticated
  using (public.es_personal());
drop policy if exists "editar contactos" on public.contactos_empresa;
create policy "editar contactos" on public.contactos_empresa for all to authenticated
  using (public.tiene_permiso('empresas.editar')) with check (public.tiene_permiso('empresas.editar'));

drop policy if exists "personal consulta bitacora" on public.bitacora_admin;
create policy "personal consulta bitacora" on public.bitacora_admin for select to authenticated
  using (public.es_personal());

-- Tablas compartidas: el personal las consulta (las escribe con las funciones del punto 5)
drop policy if exists "personal consulta alumnos" on public.alumnos;
create policy "personal consulta alumnos" on public.alumnos for select to authenticated
  using (public.es_personal());
drop policy if exists "personal consulta asesores" on public.asesores;
create policy "personal consulta asesores" on public.asesores for select to authenticated
  using (public.es_personal());
drop policy if exists "personal consulta asignaciones" on public.asignaciones_asesor;
create policy "personal consulta asignaciones" on public.asignaciones_asesor for select to authenticated
  using (public.es_personal());
drop policy if exists "personal consulta expedientes" on public.expedientes;
create policy "personal consulta expedientes" on public.expedientes for select to authenticated
  using (public.tiene_permiso('expedientes.ver'));
drop policy if exists "personal consulta documentos" on public.documentos;
create policy "personal consulta documentos" on public.documentos for select to authenticated
  using (public.tiene_permiso('expedientes.ver'));

-- El alumno ya no puede cambiar su propio renglón directamente: sus datos
-- académicos los administra la coordinación (el Módulo 4 solo los consulta)
drop policy if exists "alumno actualiza su registro" on public.alumnos;
revoke update on public.alumnos from authenticated;

revoke all on public.roles_admin, public.personal_admin, public.periodos, public.empresas,
  public.contactos_empresa, public.bitacora_admin, public.m2_version from anon;
grant select on public.roles_admin, public.personal_admin, public.bitacora_admin to authenticated;
grant select, insert, update, delete on public.periodos, public.empresas, public.contactos_empresa to authenticated;

-- --------------------------------------------------------------------------
-- 5. Funciones del panel (validan el permiso de quien llama)
-- --------------------------------------------------------------------------
create or replace function public.m2_exigir(p_permiso text)
returns void
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.tiene_permiso(p_permiso) then
    raise exception 'Tu rol no tiene permiso para esta acción.' using errcode = '42501';
  end if;
end;
$$;

-- Bitácora: la escribe el panel después de cada cambio
create or replace function public.m2_registrar(p_accion text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text;
begin
  select nombre into v_nombre from public.personal_admin where id = auth.uid() and activo;
  if v_nombre is null then
    raise exception 'Tu sesión no pertenece al personal de coordinación.' using errcode = '42501';
  end if;
  insert into public.bitacora_admin (usuario, accion) values (v_nombre, left(p_accion, 200));
  delete from public.bitacora_admin where id < (select min(id) from (select id from public.bitacora_admin order by id desc limit 200) x);
end;
$$;

-- Asigna (o reasigna) un asesor a varios alumnos respetando su capacidad por periodo
create or replace function public.m2_asignar(p_alumnos uuid[], p_asesor uuid, p_tipo text default 'individual')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asesor  public.asesores;
  v_periodo record;
  v_libres  integer;
  v_n       integer := 0;
begin
  perform public.m2_exigir('asignaciones.editar');
  if p_tipo not in ('individual', 'masiva', 'automatica') then p_tipo := 'individual'; end if;
  select * into v_asesor from public.asesores where id = p_asesor;
  if not found then raise exception 'El asesor seleccionado no existe.'; end if;
  if not v_asesor.activo then raise exception '% está inactivo y no puede recibir alumnos.', v_asesor.nombre; end if;
  if exists (select 1 from unnest(p_alumnos) x where not exists (select 1 from public.alumnos a where a.id = x)) then
    raise exception 'Uno de los alumnos no existe.';
  end if;

  -- Revisa la capacidad en cada periodo (solo cuentan los que cambian de asesor)
  for v_periodo in
    select a.periodo_id, count(*) as n
    from public.alumnos a
    where a.id = any (p_alumnos)
      and not exists (select 1 from public.asignaciones_asesor g where g.alumno_id = a.id and g.asesor_id = p_asesor and g.periodo_id is not distinct from a.periodo_id)
    group by a.periodo_id
  loop
    select v_asesor.capacidad - count(*) into v_libres
    from public.asignaciones_asesor g where g.asesor_id = p_asesor and g.periodo_id is not distinct from v_periodo.periodo_id;
    if v_periodo.n > v_libres then
      if v_libres > 0 then
        raise exception '% solo tiene % lugar(es) disponible(s) y elegiste % alumnos.', v_asesor.nombre, v_libres, v_periodo.n;
      else
        raise exception '% ya llegó a su capacidad de % alumnos.', v_asesor.nombre, v_asesor.capacidad;
      end if;
    end if;
  end loop;

  insert into public.asignaciones_asesor (alumno_id, asesor_id, periodo_id, tipo, asignado_en)
  select a.id, p_asesor, a.periodo_id, p_tipo, now()
  from public.alumnos a
  where a.id = any (p_alumnos)
    and not exists (select 1 from public.asignaciones_asesor g where g.alumno_id = a.id and g.asesor_id = p_asesor and g.periodo_id is not distinct from a.periodo_id)
  on conflict (alumno_id) do update
    set asesor_id = excluded.asesor_id, periodo_id = excluded.periodo_id, tipo = excluded.tipo, asignado_en = now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.m2_quitar_asignacion(p_alumno uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.m2_exigir('asignaciones.editar');
  delete from public.asignaciones_asesor where alumno_id = p_alumno;
  if not found then raise exception 'Asignación no encontrada.'; end if;
end;
$$;

-- Reparte a los alumnos sin asesor del periodo activo entre los asesores de su
-- carrera con menor carga (proporcional a su capacidad)
create or replace function public.m2_asignacion_automatica(p_carrera text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_periodo text;
  v_alumno  record;
  v_asesor  uuid;
  v_total   integer := 0;
  v_hechos  integer := 0;
begin
  perform public.m2_exigir('asignaciones.editar');
  select id into v_periodo from public.periodos where estado = 'activo';
  if v_periodo is null then raise exception 'No hay un periodo activo.'; end if;

  for v_alumno in
    select a.id, a.carrera from public.alumnos a
    where a.periodo_id = v_periodo and a.estado = 'activo'
      and (coalesce(p_carrera, '') = '' or a.carrera = p_carrera)
      and not exists (select 1 from public.asignaciones_asesor g where g.alumno_id = a.id and g.periodo_id = v_periodo)
    order by a.nombre
  loop
    v_total := v_total + 1;
    select t.id into v_asesor
    from public.asesores t
    where t.activo and t.carrera = v_alumno.carrera
      and (select count(*) from public.asignaciones_asesor g where g.asesor_id = t.id and g.periodo_id = v_periodo) < t.capacidad
    order by (select count(*) from public.asignaciones_asesor g where g.asesor_id = t.id and g.periodo_id = v_periodo)::numeric / t.capacidad, t.nombre
    limit 1;
    if v_asesor is null then continue; end if;
    insert into public.asignaciones_asesor (alumno_id, asesor_id, periodo_id, tipo, asignado_en)
    values (v_alumno.id, v_asesor, v_periodo, 'automatica', now())
    on conflict (alumno_id) do update set asesor_id = excluded.asesor_id, periodo_id = excluded.periodo_id, tipo = 'automatica', asignado_en = now();
    v_hechos := v_hechos + 1;
  end loop;

  if v_total = 0 then raise exception 'No hay alumnos sin asesor con esos criterios.'; end if;
  if v_hechos = 0 then
    raise exception 'Los asesores de esa carrera ya no tienen lugares disponibles. Registra otro asesor o aumenta su capacidad.';
  end if;
  return jsonb_build_object('asignados', v_hechos, 'faltan', v_total - v_hechos);
end;
$$;

-- Datos académicos de un alumno (y, si se indica, su asesor)
create or replace function public.m2_guardar_alumno(p_id uuid, p_datos jsonb, p_cambiar_asesor boolean default false, p_asesor uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes public.alumnos;
begin
  perform public.m2_exigir('alumnos.editar');
  select * into v_antes from public.alumnos where id = p_id;
  if not found then raise exception 'Alumno no encontrado.'; end if;

  update public.alumnos set
    matricula  = coalesce(nullif(p_datos ->> 'matricula', ''), matricula),
    nombre     = coalesce(nullif(trim(p_datos ->> 'nombre'), ''), nombre),
    nivel      = coalesce(nullif(p_datos ->> 'nivel', ''), nivel),
    telefono   = nullif(trim(p_datos ->> 'telefono'), ''),
    carrera    = nullif(p_datos ->> 'carrera', ''),
    grupo      = nullif(upper(trim(p_datos ->> 'grupo')), ''),
    periodo_id = nullif(p_datos ->> 'periodo_id', ''),
    empresa_id = nullif(p_datos ->> 'empresa_id', ''),
    proyecto   = nullif(trim(p_datos ->> 'proyecto'), ''),
    estado     = coalesce(nullif(p_datos ->> 'estado', ''), 'activo')
  where id = p_id;

  -- Al cambiar de periodo, la asignación del periodo anterior ya no aplica
  if (p_datos ->> 'periodo_id') is distinct from v_antes.periodo_id then
    delete from public.asignaciones_asesor where alumno_id = p_id;
  end if;

  if p_cambiar_asesor and public.tiene_permiso('asignaciones.editar') then
    if p_asesor is null then
      delete from public.asignaciones_asesor where alumno_id = p_id;
    else
      perform public.m2_asignar(array[p_id], p_asesor, 'individual');
    end if;
  end if;
exception
  when unique_violation then
    raise exception 'Ya existe un alumno con la matrícula %.', p_datos ->> 'matricula';
end;
$$;

-- Datos de un asesor (la capacidad no puede quedar por debajo de su carga)
create or replace function public.m2_guardar_asesor(p_id uuid, p_datos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_carga integer;
  v_cap   integer := (p_datos ->> 'capacidad')::integer;
  v_area  text := case p_datos ->> 'carrera'
    when 'ISC' then 'Sistemas y Computación' when 'IMT' then 'Mecatrónica'
    when 'IIN' then 'Procesos Industriales' when 'LNM' then 'Negocios'
    when 'IER' then 'Energías Renovables' end;
begin
  perform public.m2_exigir('asesores.editar');
  if not exists (select 1 from public.asesores where id = p_id) then raise exception 'Asesor no encontrado.'; end if;
  select count(*) into v_carga from public.asignaciones_asesor g
  join public.periodos p on p.id = g.periodo_id and p.estado = 'activo'
  where g.asesor_id = p_id;
  if v_cap < v_carga then
    raise exception 'No puedes bajar la capacidad a %: ya tiene % alumnos en el periodo activo.', v_cap, v_carga;
  end if;
  update public.asesores set
    nombre    = coalesce(nullif(trim(p_datos ->> 'nombre'), ''), nombre),
    telefono  = nullif(trim(p_datos ->> 'telefono'), ''),
    carrera   = nullif(p_datos ->> 'carrera', ''),
    area      = v_area,
    capacidad = v_cap,
    activo    = coalesce((p_datos ->> 'activo')::boolean, true)
  where id = p_id;
end;
$$;

-- Activa, cierra o reabre un periodo (activar uno cierra el que estaba activo)
create or replace function public.m2_periodo_estado(p_id text, p_estado text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.m2_exigir('periodos.editar');
  if p_estado not in ('activo', 'cerrado', 'planeado') then raise exception 'Estado no válido.'; end if;
  if not exists (select 1 from public.periodos where id = p_id) then raise exception 'Periodo no encontrado.'; end if;
  if p_estado = 'activo' then
    update public.periodos set estado = 'cerrado' where estado = 'activo' and id <> p_id;
  end if;
  update public.periodos set estado = p_estado where id = p_id;
  -- Los alumnos que aún no tienen periodo (por ejemplo, recién registrados) quedan en el activo
  if p_estado = 'activo' then
    update public.alumnos set periodo_id = p_id where periodo_id is null;
  end if;
end;
$$;

-- Permisos de un rol (el de Administrador no se puede cambiar)
create or replace function public.m2_guardar_rol(p_id text, p_permisos jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_validos constant text[] := array['alumnos.ver', 'alumnos.editar', 'asesores.ver', 'asesores.editar', 'asignaciones.editar',
    'periodos.ver', 'periodos.editar', 'empresas.ver', 'empresas.editar', 'expedientes.ver', 'usuarios.ver', 'usuarios.editar'];
  v_sistema boolean;
begin
  perform public.m2_exigir('usuarios.editar');
  select sistema into v_sistema from public.roles_admin where id = p_id;
  if v_sistema is null then raise exception 'Rol no encontrado.'; end if;
  if v_sistema then raise exception 'Los permisos del Administrador no se pueden modificar.'; end if;
  if jsonb_typeof(p_permisos) <> 'array' or exists (
    select 1 from jsonb_array_elements_text(p_permisos) x where x <> all (v_validos)) then
    raise exception 'Lista de permisos no válida.';
  end if;
  update public.roles_admin set permisos = (
    select coalesce(jsonb_agg(v order by o), '[]'::jsonb)
    from unnest(v_validos) with ordinality as t(v, o)
    where p_permisos ? v
  ) where id = p_id;
end;
$$;

-- Nombre, rol y estado de un usuario del personal
create or replace function public.m2_guardar_personal(p_id uuid, p_nombre text, p_rol text, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes public.personal_admin;
begin
  perform public.m2_exigir('usuarios.editar');
  select * into v_antes from public.personal_admin where id = p_id;
  if not found then raise exception 'Usuario no encontrado.'; end if;
  if not exists (select 1 from public.roles_admin where id = p_rol) then raise exception 'Selecciona un rol válido.'; end if;
  if p_id = auth.uid() and not p_activo then raise exception 'No puedes desactivar tu propio usuario.'; end if;
  if v_antes.rol_id = 'admin' and (p_rol <> 'admin' or not p_activo) and not exists (
    select 1 from public.personal_admin where rol_id = 'admin' and activo and id <> p_id) then
    raise exception 'Debe quedar al menos un administrador activo.';
  end if;
  update public.personal_admin set nombre = trim(p_nombre), rol_id = p_rol, activo = p_activo where id = p_id;
end;
$$;

-- Primer administrador (o cualquier miembro del personal), desde el SQL Editor
create or replace function public.hacer_personal(p_correo text, p_nombre text, p_rol text default 'coordinador')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(p_correo));
  if v_id is null then
    raise exception 'No existe una cuenta con el correo %. Créala primero en Authentication → Users.', p_correo;
  end if;
  if exists (select 1 from public.alumnos where id = v_id) then
    raise exception 'La cuenta % pertenece a un alumno; usa otra cuenta para el personal.', p_correo;
  end if;
  insert into public.personal_admin (id, nombre, correo, rol_id)
  values (v_id, trim(p_nombre), lower(trim(p_correo)), p_rol)
  on conflict (id) do update set nombre = excluded.nombre, rol_id = excluded.rol_id, activo = true;
  return format('Listo: %s (%s) entra al Módulo 2 con el rol %s.', trim(p_nombre), lower(trim(p_correo)), p_rol);
end;
$$;

revoke all on function public.m2_exigir(text) from public, anon, authenticated;
revoke all on function public.hacer_personal(text, text, text) from public, anon, authenticated;
revoke all on function public.m2_periodo_por_defecto() from public, anon, authenticated;
revoke all on function public.m2_subir_version() from public, anon, authenticated;
do $$
declare
  f text;
begin
  foreach f in array array['m2_registrar(text)', 'm2_asignar(uuid[], uuid, text)', 'm2_quitar_asignacion(uuid)',
    'm2_asignacion_automatica(text)', 'm2_guardar_alumno(uuid, jsonb, boolean, uuid)', 'm2_guardar_asesor(uuid, jsonb)',
    'm2_periodo_estado(text, text)', 'm2_guardar_rol(text, jsonb)', 'm2_guardar_personal(uuid, text, text, boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;

-- --------------------------------------------------------------------------
-- 6. Datos que ya existían: alumnos y asignaciones sin periodo
-- --------------------------------------------------------------------------
update public.alumnos a set periodo_id = p.id
from public.periodos p
where p.estado = 'activo' and a.periodo_id is null;

update public.asignaciones_asesor g set periodo_id = a.periodo_id
from public.alumnos a
where a.id = g.alumno_id and g.periodo_id is null and a.periodo_id is not null;
