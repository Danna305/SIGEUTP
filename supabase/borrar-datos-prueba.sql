-- ==========================================================================
-- borrar-datos-prueba.sql — Quita las 12 cuentas de prueba
-- --------------------------------------------------------------------------
-- Borra las cuentas @sigep-pruebas.mx y, en cascada, sus renglones en
-- alumnos, asesores, asignaciones_asesor, tesina_versiones,
-- tesina_observaciones, tesina_notas, expedientes, documentos,
-- revisiones_documento e historial_documentos. También borra lo del
-- Módulo 3 (dictámenes, checklist, notificaciones y citas), que guarda los
-- ids como texto. No toca ninguna cuenta real.
--
-- Los archivos quedan en Storage: el resultado de esta consulta lista las
-- carpetas que debes borrar en Storage → tesinas, voz y expedientes
-- (selecciónalas y pulsa Delete). Una carpeta solo aparece si ese alumno
-- tiene archivos en ese bucket.
-- ==========================================================================

-- Módulo 3 (sin llave foránea: se borra por el id de los alumnos de prueba)
with alumnos_prueba as (
  select a.id::text as id from public.alumnos a where a.correo like '%@sigep-pruebas.mx'
), d as (
  delete from public.dictamenes where alumno_id in (select id from alumnos_prueba)
), e as (
  delete from public.evaluaciones_checklist where alumno_id in (select id from alumnos_prueba)
), n as (
  delete from public.notificaciones where alumno_id in (select id from alumnos_prueba)
)
delete from public.citas where alumno_id in (select id from alumnos_prueba);

with borradas as (
  delete from auth.users
  where email like '%@sigep-pruebas.mx'
  returning id, email
)
select b.email as cuenta_borrada,
       case when exists (select 1 from storage.objects o
                          where o.bucket_id = 'tesinas' and o.name like b.id::text || '/%')
            then b.id::text else '—' end as carpeta_en_tesinas,
       case when exists (select 1 from storage.objects o
                          where o.bucket_id = 'voz' and o.name like b.id::text || '/%')
            then b.id::text else '—' end as carpeta_en_voz,
       case when exists (select 1 from storage.objects o
                          where o.bucket_id = 'expedientes' and o.name like b.id::text || '/%')
            then b.id::text else '—' end as carpeta_en_expedientes
from borradas b
order by b.email;
