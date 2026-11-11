-- ==========================================================================
-- fechas-datos-prueba.sql — Reparte las fechas de los datos de prueba
-- --------------------------------------------------------------------------
-- PASO 3 de 3: ejecútalo en el SQL Editor DESPUÉS de
--   node supabase/sembrar-datos-prueba.mjs
--
-- La base de datos guarda la fecha real en que se sube cada versión, así que
-- todos los datos de prueba quedan con la fecha del día en que se sembraron.
-- Este script les pone fechas realistas del periodo septiembre–octubre
-- 2026 (las mismas que aparecen en la portada de cada tesina).
-- Solo modifica las cuentas @sigep-pruebas.mx. Se puede ejecutar varias veces.
-- ==========================================================================

-- 1. Versiones de la tesina y la observación de cada una (hora de Puebla, UTC-6)
with plan(matricula, numero, subida, observada) as (values
  ('9900000001', 1, timestamptz '2026-09-14 10:20-06', timestamptz '2026-09-16 12:05-06'),
  ('9900000001', 2, timestamptz '2026-09-25 18:40-06', timestamptz '2026-09-28 09:15-06'),
  ('9900000001', 3, timestamptz '2026-10-09 21:10-06', timestamptz '2026-10-12 11:30-06'),
  ('9900000002', 1, timestamptz '2026-09-22 16:05-06', timestamptz '2026-09-24 10:40-06'),
  ('9900000002', 2, timestamptz '2026-10-08 19:25-06', null),
  ('9900000003', 1, timestamptz '2026-10-19 13:50-06', null),
  ('9900000005', 1, timestamptz '2026-09-16 09:30-06', timestamptz '2026-09-18 17:20-06'),
  ('9900000005', 2, timestamptz '2026-09-30 20:15-06', timestamptz '2026-10-02 10:05-06'),
  ('9900000006', 1, timestamptz '2026-09-21 11:45-06', timestamptz '2026-09-23 13:10-06'),
  ('9900000006', 2, timestamptz '2026-10-03 22:30-06', timestamptz '2026-10-06 09:50-06'),
  ('9900000006', 3, timestamptz '2026-10-17 18:00-06', timestamptz '2026-10-18 08:45-06'),
  ('9900000007', 1, timestamptz '2026-10-05 15:20-06', timestamptz '2026-10-07 12:40-06')
),
versiones as (
  update public.tesina_versiones v
     set subida_en = p.subida
    from public.alumnos a, plan p
   where a.id = v.alumno_id and a.correo like '%@sigep-pruebas.mx'
     and p.matricula = a.matricula and p.numero = v.numero
  returning v.id, p.observada
)
update public.tesina_observaciones o
   set creado_en = v.observada
  from versiones v
 where o.version_id = v.id and v.observada is not null;

-- 2. Registro de las cuentas y asignación de asesores
update public.asesores
   set creado_en = timestamptz '2026-08-25 09:00-06'
 where correo like '%@sigep-pruebas.mx';

update public.alumnos
   set creado_en = timestamptz '2026-09-01 10:00-06' + (right(matricula, 1)::int * interval '13 hours')
 where correo like '%@sigep-pruebas.mx';

update public.asignaciones_asesor g
   set asignado_en = timestamptz '2026-09-08 09:30-06' + (right(a.matricula, 1)::int * interval '20 minutes')
  from public.alumnos a
 where a.id = g.alumno_id and a.correo like '%@sigep-pruebas.mx';

update auth.users u
   set created_at = x.fecha
  from (select id, creado_en as fecha from public.alumnos where correo like '%@sigep-pruebas.mx'
        union all
        select id, creado_en from public.asesores where correo like '%@sigep-pruebas.mx') x
 where u.id = x.id;

-- 3. Expedientes del Módulo 1: historial, fecha de cada documento y revisiones
--    (cada paso del historial de un documento ocurre dos días después del anterior)
update public.expedientes e
   set creado_en = a.creado_en + interval '1 day'
  from public.alumnos a
 where a.id = e.alumno_id and a.correo like '%@sigep-pruebas.mx';

with pasos as (
  select h.id,
         timestamptz '2026-09-10 10:00-06'
           + (d.tipo_documento_id * interval '3 days')
           + (right(a.matricula, 1)::int * interval '5 hours')
           + ((row_number() over (partition by h.documento_id order by h.id) - 1) * interval '2 days') as fecha
    from public.historial_documentos h
    join public.documentos d on d.id = h.documento_id
    join public.expedientes e on e.id = d.expediente_id
    join public.alumnos a on a.id = e.alumno_id
   where a.correo like '%@sigep-pruebas.mx'
)
update public.historial_documentos h
   set fecha = p.fecha
  from pasos p
 where h.id = p.id;

update public.documentos d
   set fecha_subida = s.fecha
  from (select documento_id, max(fecha) as fecha
          from public.historial_documentos
         where accion not like 'Revisión%'
         group by documento_id) s,
       public.expedientes e, public.alumnos a
 where s.documento_id = d.id and e.id = d.expediente_id and a.id = e.alumno_id
   and a.correo like '%@sigep-pruebas.mx';

with revisiones as (
  select r.id, r.documento_id,
         row_number() over (partition by r.documento_id order by r.fecha_revision, r.id) as n
    from public.revisiones_documento r
), pasos as (
  select documento_id, fecha,
         row_number() over (partition by documento_id order by id) as n
    from public.historial_documentos
   where accion like 'Revisión%'
)
update public.revisiones_documento r
   set fecha_revision = p.fecha
  from revisiones x
  join pasos p on p.documento_id = x.documento_id and p.n = x.n
  join public.documentos d on d.id = x.documento_id
  join public.expedientes e on e.id = d.expediente_id
  join public.alumnos a on a.id = e.alumno_id
 where r.id = x.id and a.correo like '%@sigep-pruebas.mx';

-- 4. Resultado: cada versión con su fecha
select a.nombre                                        as alumno,
       'v' || v.numero                                 as version,
       v.estado,
       to_char(v.subida_en at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI') as subida,
       coalesce(to_char(max(o.creado_en) at time zone 'America/Mexico_City', 'DD/MM/YYYY HH24:MI'), '—') as observacion
from public.tesina_versiones v
join public.alumnos a on a.id = v.alumno_id
left join public.tesina_observaciones o on o.version_id = v.id
where a.correo like '%@sigep-pruebas.mx'
group by a.nombre, v.numero, v.estado, v.subida_en
order by v.subida_en;
