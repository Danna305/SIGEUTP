# SIGEP UTP · Módulo 2: Administración y gestión académica

Propuesta 2 del Sistema de Gestión de Estadías (Danna). Panel administrativo (PWA) para
que la coordinación controle alumnos, asesores, periodos, asignaciones, empresas y usuarios,
con el **Radar de Estadías** (semáforo de riesgo por alumno) y alertas push.

Antes tenía su propio servidor (Node.js + Express), su propio proyecto de Supabase y una
tabla de usuarios con contraseñas. Ahora usa **el mismo Supabase y las mismas cuentas que
el resto de SIGEP** y ya no necesita servidor: es una página estática como los otros módulos.

```
modulo-2/
├── index.html        Página informativa y panel (una sola página, rutas con #)
├── offline.html      Respaldo sin conexión del Service Worker
├── manifest.json     Manifiesto de la PWA (accesos directos al radar, alumnos…)
├── sw.js             Service Worker: App Shell, recursos, datos, push y Background Sync
├── css/styles.css    Estilos (diseño común SIGEP)
├── js/datos.js       Conexión con Supabase: atiende las rutas que antes tenía la API REST
├── js/app.js         Panel: vistas, formularios, caché sin conexión, radar y push
├── js/radar.js       Cálculo del Radar de Estadías (se ejecuta en el navegador)
├── icons/ img/ media/
```

Usa los archivos compartidos de la raíz: `../js/config.js` y `../js/vendor/supabase.js`.

## Base de datos

`../supabase/modulo-2.sql` (después de `esquema.sql`, `tesina.sql` y `modulo-1.sql`):

- **Tablas nuevas:** `roles_admin` (matriz de permisos), `personal_admin` (cuentas de
  coordinación), `periodos`, `empresas`, `contactos_empresa` y `bitacora_admin`.
- **Tablas compartidas:** agrega carrera, grupo, periodo, empresa, proyecto y estado a
  `alumnos`; carrera, capacidad y estado a `asesores`; periodo y tipo a `asignaciones_asesor`.
  Así el asesor que asigna la coordinación es el mismo que revisa en los módulos 1, 3 y 4.
- **Expedientes:** el avance de cada alumno sale de los documentos reales del Módulo 1.
- **Seguridad en la base de datos:** reglas RLS y funciones (`m2_asignar`,
  `m2_guardar_alumno`, `m2_periodo_estado`, `m2_guardar_rol`…) que revisan el permiso del
  rol de quien llama. Además: capacidad del asesor, un solo periodo activo y al menos un
  administrador activo.

**Primer administrador** (una vez, en el SQL Editor; la cuenta debe existir en
Authentication → Users):

```sql
select hacer_personal('correo@utpuebla.edu.mx', 'Nombre Apellido', 'admin');
```

## Funciones del servidor (Supabase Edge Functions)

- **`gestion-cuentas`**: registrar un alumno, un asesor o un usuario de coordinación crea su
  cuenta real de SIGEP (con contraseña inicial); eliminarlo borra la cuenta. Crear cuentas
  necesita la llave secreta, que nunca llega al navegador; por eso lo hace esta función.
  No necesita secretos: Supabase pone las llaves automáticamente.
- **`enviar-push`** (la misma de los otros módulos): acción `radar` para las alertas.

## Usuarios

Las cuentas de prueba (`prueba.admin`, `prueba.coordinacion` y `prueba.consulta`, todas
`@sigep-pruebas.mx` con contraseña `Prueba2026`) están en el `README.md` de la raíz.
Alumnos y asesores no pueden entrar a este panel.

| Rol | Puede |
| --- | --- |
| Administrador | Todo, incluidos periodos, usuarios y permisos |
| Coordinador de carrera | Alumnos, asesores, asignaciones y empresas |
| Consulta | Solo consultar |

Los permisos de Coordinador y Consulta se cambian en **Usuarios y permisos**.

## Radar de Estadías y notificaciones push

- Califica de 0 a 100 a cada alumno activo del periodo: documentos del expediente atrasados
  según la semana (30), sin asesor (30), empresa y convenio (20), documentos con corrección
  (10) y carga del asesor (10). Rojo ≥ 50 · Amarillo 25–49 · Verde < 25.
- Acción sugerida con un clic (asignar al asesor de su carrera con menos carga, renovar el
  convenio, vincular una empresa).
- **Alertas push:** cuando un alumno pasa a riesgo alto, se avisa a todo el personal que
  puede ver alumnos, aunque el panel esté cerrado. El número de alumnos en rojo aparece sobre
  el ícono de la app instalada (Badging API).
- **Sin conexión**, las asignaciones hechas desde el radar se guardan en IndexedDB y se envían
  solas al volver la conexión (Background Sync).

## Caché y modo sin conexión

| Caché | Estrategia | Contenido |
| --- | --- | --- |
| sigep-m2-shell-v7 | Cache First | HTML, CSS, JS, manifiesto e íconos |
| sigep-m2-dinamica-v1 | Stale-While-Revalidate | Imágenes, video y tipografías (máximo 40) |
| sigep-m2-datos-v1 | Network First | Última copia de los datos leídos de Supabase |

La sección **Caché sin conexión** del panel muestra cada caché y permite probar los métodos
de la API Cache. Al cerrar sesión se borra la caché de datos. Cada módulo de SIGEP borra solo
sus propias cachés.
