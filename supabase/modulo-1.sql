-- ==========================================================================
-- modulo-1.sql — Módulo 1: Expediente digital y gestión de documentos
-- --------------------------------------------------------------------------
-- Antes usaba MySQL en Clever Cloud con un servidor Express (backend/).
-- Ahora vive en el mismo Supabase que el resto de SIGEP: mismas cuentas
-- (Supabase Auth), mismos alumnos y asesores, y reglas de seguridad RLS.
--
-- Requisito: haber ejecutado antes supabase/esquema.sql y supabase/tesina.sql
-- (tablas alumnos y asesores y la función es_asesor_de).
-- Cómo usarlo: en Supabase abre "SQL Editor", pega todo este archivo y pulsa
-- "Run". Se puede ejecutar más de una vez sin duplicar nada.
--
-- Contenido
--   1. Tablas: tipos_documento, expedientes, documentos,
--      revisiones_documento, historial_documentos
--   2. Reglas de seguridad (RLS) y permisos
--   3. Funciones: mi_expediente(), subir_documento(), revisar_documento()
--   4. Almacenamiento de archivos (bucket privado "expedientes")
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Tablas
-- --------------------------------------------------------------------------
create table if not exists public.tipos_documento (
  id           smallint primary key,
  nombre       text not null unique,
  descripcion  text,
  obligatorio  boolean not null default true
);

insert into public.tipos_documento (id, nombre, descripcion, obligatorio) values
  (1, 'Carta de presentación', 'La emite la universidad para presentarte con la empresa.', true),
  (2, 'Carta de aceptación', 'La empresa confirma que te recibe para la estadía.', true),
  (3, 'Seguro facultativo (IMSS)', 'Constancia vigente de tu seguro facultativo.', true),
  (4, 'Identificación oficial (INE)', 'Copia por ambos lados de tu identificación.', true)
on conflict (id) do update
  set nombre = excluded.nombre, descripcion = excluded.descripcion, obligatorio = excluded.obligatorio;

-- Un expediente por alumno
create table if not exists public.expedientes (
  id              uuid primary key default gen_random_uuid(),
  alumno_id       uuid not null unique references public.alumnos (id) on delete cascade,
  estado_general  text not null default 'En proceso' check (estado_general in ('En proceso', 'Completo')),
  creado_en       timestamptz not null default now()
);

-- Un documento por tipo; cada archivo nuevo sube la versión
create table if not exists public.documentos (
  id                 uuid primary key default gen_random_uuid(),
  expediente_id      uuid not null references public.expedientes (id) on delete cascade,
  tipo_documento_id  smallint not null references public.tipos_documento (id),
  archivo_path       text not null,
  nombre_archivo     text not null check (char_length(nombre_archivo) between 1 and 200),
  version            integer not null default 1 check (version > 0),
  estado             text not null default 'En revisión'
                       check (estado in ('En revisión', 'Aprobado', 'Requiere corrección')),
  fecha_subida       timestamptz not null default now(),
  unique (expediente_id, tipo_documento_id)
);

create table if not exists public.revisiones_documento (
  id               uuid primary key default gen_random_uuid(),
  documento_id     uuid not null references public.documentos (id) on delete cascade,
  asesor_id        uuid not null references public.asesores (id) on delete cascade,
  comentario       text check (comentario is null or char_length(comentario) <= 1000),
  estado_revision  text not null check (estado_revision in ('Aprobado', 'Requiere corrección')),
  fecha_revision   timestamptz not null default now()
);

create table if not exists public.historial_documentos (
  id            bigint generated always as identity primary key,
  documento_id  uuid not null references public.documentos (id) on delete cascade,
  accion        text not null,
  usuario       text not null,
  fecha         timestamptz not null default now()
);

create index if not exists documentos_expediente_idx on public.documentos (expediente_id);
create index if not exists revisiones_documento_idx on public.revisiones_documento (documento_id);
create index if not exists historial_documento_idx on public.historial_documentos (documento_id);

-- --------------------------------------------------------------------------
-- 2. Reglas de seguridad (RLS)
--    El alumno ve su expediente; el asesor, el de sus alumnos asignados.
--    Nadie escribe directo en las tablas: solo con las funciones del punto 3.
-- --------------------------------------------------------------------------
create or replace function public.puede_ver_expediente(p_expediente uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.expedientes e
    where e.id = p_expediente
      and (e.alumno_id = auth.uid() or public.es_asesor_de(e.alumno_id::text))
  );
$$;

revoke all on function public.puede_ver_expediente(uuid) from public, anon;
grant execute on function public.puede_ver_expediente(uuid) to authenticated;

alter table public.tipos_documento enable row level security;
alter table public.expedientes enable row level security;
alter table public.documentos enable row level security;
alter table public.revisiones_documento enable row level security;
alter table public.historial_documentos enable row level security;

drop policy if exists "consultar tipos de documento" on public.tipos_documento;
create policy "consultar tipos de documento" on public.tipos_documento
  for select to authenticated using (true);

drop policy if exists "consultar expediente" on public.expedientes;
create policy "consultar expediente" on public.expedientes
  for select to authenticated
  using (alumno_id = (select auth.uid()) or public.es_asesor_de(alumno_id::text));

drop policy if exists "consultar documentos" on public.documentos;
create policy "consultar documentos" on public.documentos
  for select to authenticated using (public.puede_ver_expediente(expediente_id));

drop policy if exists "consultar revisiones" on public.revisiones_documento;
create policy "consultar revisiones" on public.revisiones_documento
  for select to authenticated
  using (exists (select 1 from public.documentos d where d.id = documento_id and public.puede_ver_expediente(d.expediente_id)));

drop policy if exists "consultar historial" on public.historial_documentos;
create policy "consultar historial" on public.historial_documentos
  for select to authenticated
  using (exists (select 1 from public.documentos d where d.id = documento_id and public.puede_ver_expediente(d.expediente_id)));

revoke all on public.tipos_documento, public.expedientes, public.documentos,
              public.revisiones_documento, public.historial_documentos from anon;
grant select on public.tipos_documento, public.expedientes, public.documentos,
              public.revisiones_documento, public.historial_documentos to authenticated;

-- --------------------------------------------------------------------------
-- 3. Funciones
-- --------------------------------------------------------------------------

-- Devuelve el expediente del alumno con sesión; si no existe, lo crea
create or replace function public.mi_expediente()
returns public.expedientes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exp public.expedientes;
begin
  if not exists (select 1 from public.alumnos a where a.id = auth.uid()) then
    raise exception 'Solo los alumnos tienen expediente.' using errcode = '42501';
  end if;
  insert into public.expedientes (alumno_id) values (auth.uid())
  on conflict (alumno_id) do nothing;
  select * into v_exp from public.expedientes where alumno_id = auth.uid();
  return v_exp;
end;
$$;

-- Registra un PDF ya subido a Storage: crea el documento o sube su versión
create or replace function public.subir_documento(p_tipo smallint, p_path text, p_nombre text)
returns public.documentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exp     public.expedientes;
  v_doc     public.documentos;
  v_nombre  text;
begin
  select * into v_exp from public.mi_expediente();

  if split_part(p_path, '/', 1) <> auth.uid()::text then
    raise exception 'El archivo debe estar en tu carpeta.' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'expedientes' and o.name = p_path) then
    raise exception 'No se encontró el archivo subido.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.tipos_documento t where t.id = p_tipo) then
    raise exception 'El tipo de documento no existe.' using errcode = '22023';
  end if;

  select a.nombre into v_nombre from public.alumnos a where a.id = auth.uid();

  select * into v_doc from public.documentos
  where expediente_id = v_exp.id and tipo_documento_id = p_tipo
  for update;

  if found then
    update public.documentos
      set archivo_path = p_path, nombre_archivo = left(p_nombre, 200), version = v_doc.version + 1,
          estado = 'En revisión', fecha_subida = now()
      where id = v_doc.id
      returning * into v_doc;
    insert into public.historial_documentos (documento_id, accion, usuario)
    values (v_doc.id, format('Nueva versión (v%s) subida', v_doc.version), v_nombre);
  else
    insert into public.documentos (expediente_id, tipo_documento_id, archivo_path, nombre_archivo)
    values (v_exp.id, p_tipo, p_path, left(p_nombre, 200))
    returning * into v_doc;
    insert into public.historial_documentos (documento_id, accion, usuario)
    values (v_doc.id, 'Documento subido por primera vez', v_nombre);
  end if;

  update public.expedientes set estado_general = 'En proceso' where id = v_exp.id;
  return v_doc;
end;
$$;

-- El asesor asignado aprueba un documento o pide corrección
create or replace function public.revisar_documento(p_documento uuid, p_estado text, p_comentario text default null)
returns public.revisiones_documento
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alumno    uuid;
  v_exp       uuid;
  v_rev       public.revisiones_documento;
  v_asesor    text;
begin
  select e.alumno_id, e.id into v_alumno, v_exp
  from public.documentos d join public.expedientes e on e.id = d.expediente_id
  where d.id = p_documento;

  if v_alumno is null then
    raise exception 'El documento no existe.' using errcode = 'P0002';
  end if;
  if not public.es_asesor_de(v_alumno::text) then
    raise exception 'Solo el asesor asignado puede revisar este documento.' using errcode = '42501';
  end if;
  if p_estado not in ('Aprobado', 'Requiere corrección') then
    raise exception 'Estado no válido.' using errcode = '22023';
  end if;
  if p_estado = 'Requiere corrección' and nullif(trim(coalesce(p_comentario, '')), '') is null then
    raise exception 'Escribe qué debe corregir el alumno.' using errcode = '22023';
  end if;

  select nombre into v_asesor from public.asesores where id = auth.uid();

  insert into public.revisiones_documento (documento_id, asesor_id, comentario, estado_revision)
  values (p_documento, auth.uid(), nullif(trim(coalesce(p_comentario, '')), ''), p_estado)
  returning * into v_rev;

  update public.documentos set estado = p_estado where id = p_documento;
  insert into public.historial_documentos (documento_id, accion, usuario)
  values (p_documento, format('Revisión: %s', p_estado), v_asesor);

  -- El expediente queda completo cuando todos los obligatorios están aprobados
  update public.expedientes e
    set estado_general = case when not exists (
      select 1 from public.tipos_documento t
      where t.obligatorio and not exists (
        select 1 from public.documentos d
        where d.expediente_id = e.id and d.tipo_documento_id = t.id and d.estado = 'Aprobado'))
      then 'Completo' else 'En proceso' end
  where e.id = v_exp;

  return v_rev;
end;
$$;

revoke all on function public.mi_expediente() from public, anon;
revoke all on function public.subir_documento(smallint, text, text) from public, anon;
revoke all on function public.revisar_documento(uuid, text, text) from public, anon;
grant execute on function public.mi_expediente() to authenticated;
grant execute on function public.subir_documento(smallint, text, text) to authenticated;
grant execute on function public.revisar_documento(uuid, text, text) to authenticated;

-- --------------------------------------------------------------------------
-- 4. Almacenamiento: bucket privado "expedientes"
--    Solo PDF, máximo 5 MB. Ruta: <id del alumno>/<archivo>
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expedientes', 'expedientes', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "alumno sube a su expediente" on storage.objects;
create policy "alumno sube a su expediente" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'expedientes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.alumnos a where a.id = (select auth.uid()))
  );

drop policy if exists "consultar archivo del expediente" on storage.objects;
create policy "consultar archivo del expediente" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'expedientes'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or public.es_asesor_de((storage.foldername(name))[1]))
  );

-- Si falla el registro, el alumno puede borrar el archivo que no quedó en ningún documento
drop policy if exists "alumno borra archivo sin registrar" on storage.objects;
create policy "alumno borra archivo sin registrar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'expedientes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.documentos d where d.archivo_path = objects.name)
  );
