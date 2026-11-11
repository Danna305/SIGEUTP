-- =====================================================================
-- SIGEP UTP · Módulo 2: Administración y gestión académica
-- Esquema de base de datos para MySQL 8 / MariaDB 10.5+
-- Mismas 8 tablas que usa el servidor en data/db.json
-- =====================================================================
CREATE DATABASE IF NOT EXISTS sigep_utp CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci;
USE sigep_utp;

-- ---------- Roles y usuarios ----------
CREATE TABLE roles (
  id            VARCHAR(30)  PRIMARY KEY,
  nombre        VARCHAR(60)  NOT NULL,
  descripcion   VARCHAR(200),
  permisos      JSON         NOT NULL,            -- ["alumnos.ver","alumnos.editar",...]
  sistema       BOOLEAN      NOT NULL DEFAULT FALSE  -- TRUE = no se pueden modificar sus permisos
);

CREATE TABLE usuarios (
  id             VARCHAR(30)  PRIMARY KEY,
  nombre         VARCHAR(90)  NOT NULL,
  email          VARCHAR(90)  NOT NULL UNIQUE,
  password_hash  CHAR(64)     NOT NULL,           -- scrypt en hexadecimal
  password_salt  CHAR(32)     NOT NULL,
  rol_id         VARCHAR(30)  NOT NULL,
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  ultimo_acceso  DATETIME     NULL,
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles(id)
);

-- ---------- Periodos ----------
CREATE TABLE periodos (
  id      VARCHAR(30)  PRIMARY KEY,
  clave   VARCHAR(12)  NOT NULL UNIQUE,           -- 2025-1
  nombre  VARCHAR(60)  NOT NULL,                  -- Enero – Junio 2025
  inicio  DATE         NOT NULL,
  fin     DATE         NOT NULL,
  estado  ENUM('planeado','activo','cerrado') NOT NULL DEFAULT 'planeado',
  CONSTRAINT ck_periodo_fechas CHECK (fin > inicio)
);

-- ---------- Empresas y contactos ----------
CREATE TABLE empresas (
  id         VARCHAR(30)  PRIMARY KEY,
  nombre     VARCHAR(90)  NOT NULL UNIQUE,
  rfc        VARCHAR(13),
  giro       VARCHAR(60)  NOT NULL,
  ciudad     VARCHAR(60),
  direccion  VARCHAR(120),
  convenio   ENUM('vigente','tramite') NOT NULL DEFAULT 'tramite',
  vence      DATE         NULL                    -- vencido = vence < fecha actual
);

CREATE TABLE contactos_empresa (
  id          VARCHAR(30)  PRIMARY KEY,
  empresa_id  VARCHAR(30)  NOT NULL,
  nombre      VARCHAR(90)  NOT NULL,
  puesto      VARCHAR(60),
  email       VARCHAR(90),
  telefono    VARCHAR(20),
  principal   BOOLEAN      NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_contacto_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ---------- Asesores ----------
CREATE TABLE asesores (
  id         VARCHAR(30)  PRIMARY KEY,
  nombre     VARCHAR(90)  NOT NULL,
  email      VARCHAR(90)  NOT NULL UNIQUE,
  telefono   VARCHAR(20),
  carrera    CHAR(3)      NOT NULL,               -- ISC, IMT, IIN, LNM, IER
  area       VARCHAR(60)  NOT NULL,
  capacidad  TINYINT UNSIGNED NOT NULL DEFAULT 10,
  activo     BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT ck_asesor_capacidad CHECK (capacidad BETWEEN 1 AND 30)
);

-- ---------- Alumnos ----------
CREATE TABLE alumnos (
  id          VARCHAR(30)  PRIMARY KEY,
  matricula   VARCHAR(15)  NOT NULL UNIQUE,
  nombre      VARCHAR(90)  NOT NULL,
  email       VARCHAR(90)  NOT NULL,
  telefono    VARCHAR(20),
  carrera     CHAR(3)      NOT NULL,
  grupo       VARCHAR(3)   NOT NULL,
  periodo_id  VARCHAR(30)  NOT NULL,
  empresa_id  VARCHAR(30)  NULL,
  proyecto    VARCHAR(140),
  estado      ENUM('activo','baja','concluido') NOT NULL DEFAULT 'activo',
  CONSTRAINT fk_alumno_periodo FOREIGN KEY (periodo_id) REFERENCES periodos(id),
  CONSTRAINT fk_alumno_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id),
  INDEX ix_alumno_periodo_carrera (periodo_id, carrera)
);
-- Nota: el estado de los documentos del expediente pertenece al Módulo 1
-- (tablas expedientes / documentos); aquí solo se consulta.

-- ---------- Asignaciones de asesor ----------
CREATE TABLE asignaciones_asesor (
  id          VARCHAR(30)  PRIMARY KEY,
  alumno_id   VARCHAR(30)  NOT NULL,
  asesor_id   VARCHAR(30)  NOT NULL,
  periodo_id  VARCHAR(30)  NOT NULL,
  tipo        ENUM('individual','masiva','automatica') NOT NULL DEFAULT 'individual',
  fecha       DATE         NOT NULL,
  CONSTRAINT fk_asg_alumno  FOREIGN KEY (alumno_id)  REFERENCES alumnos(id) ON DELETE CASCADE,
  CONSTRAINT fk_asg_asesor  FOREIGN KEY (asesor_id)  REFERENCES asesores(id),
  CONSTRAINT fk_asg_periodo FOREIGN KEY (periodo_id) REFERENCES periodos(id),
  CONSTRAINT uq_alumno_periodo UNIQUE (alumno_id, periodo_id),  -- un asesor por alumno y periodo
  INDEX ix_asg_asesor_periodo (asesor_id, periodo_id)           -- para calcular la carga
);

-- ---------- Datos mínimos ----------
INSERT INTO roles (id, nombre, descripcion, permisos, sistema) VALUES
 ('admin', 'Administrador', 'Control total del módulo, incluidos periodos, usuarios y permisos.',
  JSON_ARRAY('alumnos.ver','alumnos.editar','asesores.ver','asesores.editar','asignaciones.editar','periodos.ver','periodos.editar','empresas.ver','empresas.editar','expedientes.ver','usuarios.ver','usuarios.editar'), TRUE),
 ('coordinador', 'Coordinador de carrera', 'Gestiona alumnos, asesores, asignaciones y empresas. Consulta periodos.',
  JSON_ARRAY('alumnos.ver','alumnos.editar','asesores.ver','asesores.editar','asignaciones.editar','periodos.ver','empresas.ver','empresas.editar','expedientes.ver'), FALSE),
 ('consulta', 'Consulta', 'Solo consulta información y estadísticas; no modifica datos.',
  JSON_ARRAY('alumnos.ver','asesores.ver','periodos.ver','empresas.ver','expedientes.ver'), FALSE);

-- Ejemplo de consulta: carga de cada asesor en el periodo activo
-- SELECT a.nombre, a.capacidad, COUNT(g.id) AS asignados
-- FROM asesores a
-- LEFT JOIN asignaciones_asesor g ON g.asesor_id = a.id
--   AND g.periodo_id = (SELECT id FROM periodos WHERE estado = 'activo')
-- GROUP BY a.id ORDER BY asignados / a.capacidad;
