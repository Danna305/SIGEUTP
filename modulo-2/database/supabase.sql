-- =====================================================================
-- SIGEP UTP · Módulo 2: Administración y gestión académica
-- Tablas para Supabase (PostgreSQL)
-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo > Run
-- Los datos de ejemplo los inserta el servidor la primera vez que arranca.
-- =====================================================================

-- ---------- Roles y usuarios ----------
create table if not exists roles (
  id           text primary key,
  nombre       text not null,
  descripcion  text,
  permisos     jsonb not null default '[]',        -- ["alumnos.ver","alumnos.editar",...]
  sistema      boolean not null default false      -- true = sus permisos no se pueden cambiar
);

create table if not exists usuarios (
  id             text primary key,
  nombre         text not null,
  email          text not null unique,
  password_hash  text not null,                    -- scrypt en hexadecimal (nunca texto plano)
  password_salt  text not null,
  rol_id         text not null references roles(id),
  activo         boolean not null default true,
  ultimo_acceso  timestamptz
);

-- ---------- Periodos ----------
create table if not exists periodos (
  id      text primary key,
  clave   text not null unique,                    -- 2025-1
  nombre  text not null,                           -- Enero – Junio 2025
  inicio  date not null,
  fin     date not null,
  estado  text not null default 'planeado' check (estado in ('planeado', 'activo', 'cerrado')),
  constraint periodo_fechas check (fin > inicio)
);

-- ---------- Empresas y contactos ----------
create table if not exists empresas (
  id         text primary key,
  nombre     text not null unique,
  rfc        text,
  giro       text not null,
  ciudad     text,
  direccion  text,
  convenio   text not null default 'tramite' check (convenio in ('vigente', 'tramite')),
  vence      date
);

create table if not exists contactos_empresa (
  id          text primary key,
  empresa_id  text not null references empresas(id) on delete cascade,
  nombre      text not null,
  puesto      text,
  email       text,
  telefono    text,
  principal   boolean not null default false
);

-- ---------- Asesores ----------
create table if not exists asesores (
  id         text primary key,
  nombre     text not null,
  email      text not null unique,
  telefono   text,
  carrera    text not null,                        -- ISC, IMT, IIN, LNM, IER
  area       text not null,
  capacidad  integer not null default 10 check (capacidad between 1 and 30),
  activo     boolean not null default true
);

-- ---------- Alumnos ----------
create table if not exists alumnos (
  id          text primary key,
  matricula   text not null unique,
  nombre      text not null,
  email       text not null,
  telefono    text,
  carrera     text not null,
  grupo       text not null,
  periodo_id  text not null references periodos(id),
  empresa_id  text references empresas(id),
  proyecto    text,
  estado      text not null default 'activo' check (estado in ('activo', 'baja', 'concluido')),
  expediente  jsonb not null default '{}'          -- estado de los 5 documentos (Módulo 1)
);

-- ---------- Asignaciones de asesor ----------
create table if not exists asignaciones_asesor (
  id          text primary key,
  alumno_id   text not null references alumnos(id) on delete cascade,
  asesor_id   text not null references asesores(id),
  periodo_id  text not null references periodos(id),
  tipo        text not null default 'individual' check (tipo in ('individual', 'masiva', 'automatica')),
  fecha       date not null,
  constraint un_asesor_por_periodo unique (alumno_id, periodo_id)
);
create index if not exists asignaciones_carga on asignaciones_asesor (asesor_id, periodo_id);

-- ---------- Seguridad ----------
-- RLS activado y sin políticas: nadie puede leer las tablas con la llave pública (anon).
-- El servidor usa la llave secreta (service_role), que sí tiene acceso.
alter table roles               enable row level security;
alter table usuarios            enable row level security;
alter table periodos            enable row level security;
alter table empresas            enable row level security;
alter table contactos_empresa   enable row level security;
alter table asesores            enable row level security;
alter table alumnos             enable row level security;
alter table asignaciones_asesor enable row level security;
