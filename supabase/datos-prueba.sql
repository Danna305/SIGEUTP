-- ==========================================================================
-- datos-prueba.sql — 15 cuentas de prueba (10 alumnos, 2 asesores y 3 de coordinación)
-- --------------------------------------------------------------------------
-- PASO 1 de 3. En Supabase → SQL Editor, pega todo este archivo y pulsa Run.
-- PASO 2 de 3. En una terminal, dentro de la carpeta del repositorio:
--                node supabase/sembrar-datos-prueba.mjs
--              (llena los módulos: tesinas y observaciones del Módulo 4,
--               expedientes del Módulo 1 y pre-auditoría del Módulo 3)
-- PASO 3 de 3. En el SQL Editor, ejecuta supabase/fechas-datos-prueba.sql
--              (reparte las fechas entre septiembre y octubre de 2026)
--
-- · Todas las cuentas usan el dominio @sigep-pruebas.mx y la contraseña
--   Prueba2026. Las matrículas empiezan con 99 para no chocar con reales.
-- · Se puede ejecutar más de una vez: no duplica cuentas.
-- · Para quitarlas: supabase/borrar-datos-prueba.sql
-- Requisito: haber ejecutado antes esquema.sql, tesina.sql, modulo-1.sql,
-- modulo-2.sql y modulo-3.sql.
-- También crea los datos del Módulo 2: periodos, empresas con contactos y los
-- datos académicos de cada alumno (carrera, grupo, empresa y proyecto).
-- ==========================================================================

do $$
declare
  v_clave text := extensions.crypt('Prueba2026', extensions.gen_salt('bf'));
  v_id    uuid;
  r       record;
begin
  -- Módulo 2: periodos (el de septiembre–diciembre 2026 queda activo si no hay otro)
  insert into public.periodos (id, clave, nombre, inicio, fin, estado) values
    ('prueba-2026-2', '2026-2', 'Mayo – Agosto 2026', '2026-05-04', '2026-08-21', 'cerrado'),
    ('prueba-2026-3', '2026-3', 'Septiembre – Diciembre 2026', '2026-09-07', '2026-12-18',
       case when exists (select 1 from public.periodos where estado = 'activo' and id <> 'prueba-2026-3') then 'planeado' else 'activo' end),
    ('prueba-2027-1', '2027-1', 'Enero – Abril 2027', '2027-01-11', '2027-04-23', 'planeado')
  on conflict do nothing;
  update public.alumnos set periodo_id = (select id from public.periodos where estado = 'activo') where periodo_id is null;

  -- Módulo 2: empresas con convenio (vigente, por vencer, vencido y en trámite) y sus contactos
  insert into public.empresas (id, nombre, rfc, giro, ciudad, direccion, convenio, vence) values
    ('prueba-emp-1', 'Alimentos La Poblanita (prueba)', 'APO1504159K2', 'Alimentos', 'Puebla', 'Av. 15 de Mayo 2210', 'vigente', '2027-08-31'),
    ('prueba-emp-2', 'Mantenimiento Industrial del Centro (prueba)', 'MIC180322H71', 'Servicios industriales', 'Cuautlancingo', 'Parque Industrial FINSA, nave 4', 'vigente', '2027-06-30'),
    ('prueba-emp-3', 'Plásticos Inyectados de Puebla (prueba)', 'PIP120801AB3', 'Manufactura', 'Puebla', 'Blvd. Hermanos Serdán 990', 'vigente', '2026-12-05'),
    ('prueba-emp-4', 'Hotel Casona Barroca (prueba)', 'HCB190610T52', 'Hotelería', 'Puebla', 'Calle 3 Sur 702, Centro', 'vigente', '2027-03-15'),
    ('prueba-emp-5', 'EnerSol Puebla (prueba)', 'ESP200115QW4', 'Energías renovables', 'San Andrés Cholula', 'Recta a Cholula 3105', 'vigente', '2026-10-01'),
    ('prueba-emp-6', 'Autopartes Volkan (prueba)', 'AVO090902LM8', 'Automotriz', 'Cuautlancingo', 'Autopista México–Puebla km 116', 'vigente', '2027-11-30'),
    ('prueba-emp-7', 'Software Angelópolis (prueba)', null, 'Tecnologías de la información', 'Puebla', 'Vía Atlixcáyotl 5208', 'tramite', null),
    ('prueba-emp-8', 'Logística Cholula (prueba)', 'LCH170404RT9', 'Logística', 'San Pedro Cholula', 'Calle 14 Poniente 1102', 'vigente', '2027-02-28')
  on conflict do nothing;

  insert into public.contactos_empresa (id, empresa_id, nombre, puesto, email, telefono, principal) values
    ('prueba-con-1', 'prueba-emp-1', 'Lic. Rosa Méndez Arroyo', 'Recursos Humanos', 'rmendez@poblanita-prueba.mx', '222 410 2231', true),
    ('prueba-con-2', 'prueba-emp-1', 'Ing. Pablo Torres Lima', 'Jefe de Sistemas', 'ptorres@poblanita-prueba.mx', '222 410 2240', false),
    ('prueba-con-3', 'prueba-emp-2', 'Ing. Arturo Campos Ruiz', 'Gerente de Mantenimiento', 'acampos@mic-prueba.mx', '222 285 1190', true),
    ('prueba-con-4', 'prueba-emp-3', 'Ing. Luis Ortega Paredes', 'Calidad', 'lortega@pip-prueba.mx', '222 233 8800', true),
    ('prueba-con-5', 'prueba-emp-4', 'Lic. Claudia Ríos Peña', 'Gerente General', 'crios@casonabarroca-prueba.mx', '222 242 0011', true),
    ('prueba-con-6', 'prueba-emp-5', 'Ing. Sergio Luna Bravo', 'Director de Proyectos', 'sluna@enersol-prueba.mx', '222 301 7744', true),
    ('prueba-con-7', 'prueba-emp-6', 'Lic. Mónica Vázquez Gil', 'Compras', 'mvazquez@volkan-prueba.mx', '222 223 5500', true),
    ('prueba-con-8', 'prueba-emp-7', 'Ing. Daniel Reyes Cano', 'Líder técnico', null, '222 120 3344', true),
    ('prueba-con-9', 'prueba-emp-8', 'Lic. Andrea Solís Mora', 'Operaciones', 'asolis@logcholula-prueba.mx', null, true)
  on conflict do nothing;

  for r in
    select * from (values
      -- correo                                  nombre                          matrícula     nivel / rol
      ('prueba.asesor1@sigep-pruebas.mx',      'Dra. Mariana Torres Salgado',  null,         'asesor'),
      ('prueba.asesor2@sigep-pruebas.mx',      'Mtro. Ricardo Vega Morales',   null,         'asesor'),
      ('prueba.admin@sigep-pruebas.mx',        'Mtro. Carlos Reyes Ibarra',    null,         'admin'),
      ('prueba.coordinacion@sigep-pruebas.mx', 'Ing. Laura Medina Ortiz',      null,         'coordinador'),
      ('prueba.consulta@sigep-pruebas.mx',     'Lic. Sofía Herrera Luna',      null,         'consulta'),
      ('prueba.alumno01@sigep-pruebas.mx', 'Ana Lucía Ramírez Cruz',       '9900000001', 'Ingeniería'),
      ('prueba.alumno02@sigep-pruebas.mx', 'Bruno Hernández Ortega',       '9900000002', 'TSU'),
      ('prueba.alumno03@sigep-pruebas.mx', 'Camila Flores Aguilar',        '9900000003', 'Ingeniería'),
      ('prueba.alumno04@sigep-pruebas.mx', 'Diego Martínez Solís',         '9900000004', 'TSU'),
      ('prueba.alumno05@sigep-pruebas.mx', 'Elena Castillo Pérez',         '9900000005', 'Ingeniería'),
      ('prueba.alumno06@sigep-pruebas.mx', 'Fernando Ruiz Domínguez',      '9900000006', 'Ingeniería'),
      ('prueba.alumno07@sigep-pruebas.mx', 'Gabriela Morales Núñez',       '9900000007', 'TSU'),
      ('prueba.alumno08@sigep-pruebas.mx', 'Héctor Jiménez Rosas',         '9900000008', 'TSU'),
      ('prueba.alumno09@sigep-pruebas.mx', 'Irene Navarro Luna',           '9900000009', 'Ingeniería'),
      ('prueba.alumno10@sigep-pruebas.mx', 'Jorge Sánchez Medina',         '9900000010', 'TSU')
    ) as t(correo, nombre, matricula, nivel)
  loop
    select u.id into v_id from auth.users u where lower(u.email) = r.correo;

    if v_id is null then
      v_id := gen_random_uuid();

      -- Cuenta confirmada (los alumnos traen sus datos como metadatos: el
      -- disparador de esquema.sql crea su renglón en la tabla alumnos)
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
        r.correo, v_clave, now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        case when r.matricula is null
          then jsonb_build_object('nombre', r.nombre)
          else jsonb_build_object('nombre', r.nombre, 'matricula', r.matricula, 'nivel', r.nivel)
        end,
        now(), now(), '', '', '', ''
      );

      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (
        gen_random_uuid(), v_id, v_id::text, 'email',
        jsonb_build_object('sub', v_id::text, 'email', r.correo, 'email_verified', true),
        now(), now(), now()
      );
    end if;

    if r.nivel = 'asesor' then
      perform public.hacer_asesor(r.correo, r.nombre);
    elsif r.matricula is null then
      perform public.hacer_personal(r.correo, r.nombre, r.nivel);   -- coordinación (Módulo 2)
    end if;
  end loop;

  -- Asignaciones: 5 alumnos para el asesor 1 y 4 para el asesor 2;
  -- el alumno 08 se queda sin asesor
  perform public.asignar_asesor('9900000001', 'prueba.asesor1@sigep-pruebas.mx');
  perform public.asignar_asesor('9900000002', 'prueba.asesor1@sigep-pruebas.mx');
  perform public.asignar_asesor('9900000003', 'prueba.asesor1@sigep-pruebas.mx');
  perform public.asignar_asesor('9900000004', 'prueba.asesor1@sigep-pruebas.mx');
  perform public.asignar_asesor('9900000005', 'prueba.asesor2@sigep-pruebas.mx');
  perform public.asignar_asesor('9900000006', 'prueba.asesor2@sigep-pruebas.mx');
  perform public.asignar_asesor('9900000007', 'prueba.asesor2@sigep-pruebas.mx');
  perform public.asignar_asesor('9900000009', 'prueba.asesor2@sigep-pruebas.mx');
  perform public.asignar_asesor('9900000010', 'prueba.asesor1@sigep-pruebas.mx');

  -- Módulo 2: datos de los asesores
  update public.asesores set carrera = 'ISC', area = 'Sistemas y Computación', capacidad = 6, telefono = '222 300 4101', activo = true
   where correo = 'prueba.asesor1@sigep-pruebas.mx';
  update public.asesores set carrera = 'IIN', area = 'Procesos Industriales', capacidad = 5, telefono = '222 300 4102', activo = true
   where correo = 'prueba.asesor2@sigep-pruebas.mx';

  -- Módulo 2: datos académicos de cada alumno (el 04 y el 08 todavía sin empresa)
  update public.alumnos a set
    carrera = d.carrera, grupo = d.grupo, telefono = d.telefono, empresa_id = d.empresa, proyecto = d.proyecto,
    periodo_id = 'prueba-2026-3', estado = 'activo'
  from (values
    ('9900000001', 'ISC', 'A', '222 501 0001', 'prueba-emp-1', 'Sistema de inventarios para una PyME de alimentos'),
    ('9900000002', 'ISC', 'B', '222 501 0002', 'prueba-emp-2', 'Aplicación móvil para el control de mantenimiento industrial'),
    ('9900000003', 'ISC', 'A', '222 501 0003', 'prueba-emp-3', 'Tablero de indicadores de calidad en una línea de producción'),
    ('9900000004', 'ISC', 'C', '222 501 0004', null,           null),
    ('9900000005', 'IIN', 'A', '222 501 0005', 'prueba-emp-4', 'Plataforma web de reservaciones para un hotel boutique'),
    ('9900000006', 'IIN', 'B', '222 501 0006', 'prueba-emp-5', 'Monitoreo de consumo energético con IoT'),
    ('9900000007', 'IIN', 'A', '222 501 0007', 'prueba-emp-6', 'Rediseño del proceso de compras de una empresa automotriz'),
    ('9900000008', 'ISC', 'B', '222 501 0008', null,           null),
    ('9900000009', 'IIN', 'C', '222 501 0009', 'prueba-emp-8', 'Optimización de rutas de reparto'),
    ('9900000010', 'ISC', 'C', '222 501 0010', 'prueba-emp-7', 'Portal de servicios para clientes')
  ) as d(matricula, carrera, grupo, telefono, empresa, proyecto)
  where a.matricula = d.matricula;

  update public.asignaciones_asesor g set periodo_id = 'prueba-2026-3', tipo = 'individual'
  from public.alumnos a where a.id = g.alumno_id and a.correo like '%@sigep-pruebas.mx';
end
$$;

-- Resumen de lo creado
select u.email as correo,
       coalesce(a.nombre, s.nombre, p.nombre) as nombre,
       case when a.id is not null then 'Alumno' when s.id is not null then 'Asesor'
            when p.id is not null then 'Coordinación (' || p.rol_id || ')' else '¿?' end as rol,
       a.matricula,
       a.nivel,
       (select x.nombre from public.asignaciones_asesor g join public.asesores x on x.id = g.asesor_id
         where g.alumno_id = a.id) as asesor_asignado
from auth.users u
left join public.alumnos a on a.id = u.id
left join public.asesores s on s.id = u.id
left join public.personal_admin p on p.id = u.id
where u.email like '%@sigep-pruebas.mx'
order by rol desc, u.email;
