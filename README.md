# SIGEP UTP · Sistema de Gestión de Estadías

Aplicación web progresiva (PWA) de la Universidad Tecnológica de Puebla para la gestión de
estadías. Cada integrante del equipo desarrolla un módulo; todos usan el mismo diseño, el
mismo proyecto de Supabase y la misma cuenta (si entras a un módulo, ya entraste a todos).

| Módulo | Propuesta | Integrante | Carpeta | Estado |
| --- | --- | --- | --- | --- |
| 1 | Expediente digital y gestión de documentos | Belén | `modulo-1/` | Funcional con Supabase |
| 2 | Administración y gestión académica | Danna | `ejemplos/modulo-2.html` | Solo pantalla de ejemplo |
| 3 | Seguimiento académico (pre-auditoría de tesinas) | María José | `modulo-3/` | Funcional con Supabase |
| 4 | Portal del alumno (tesina por versiones) | Alexia | `modulo-4/` | Funcional con Supabase |

## Estructura

```
SIGEUTP/
├── index.html              Portal de entrada con los 4 módulos
├── guia.html               Guía visual del diseño común (colores, componentes y su código)
├── plantilla-modulo.html   Pantalla vacía para empezar un módulo
├── ejemplos/               Una pantalla de ejemplo por módulo (diseño)
├── css/sigep.css           Estilos comunes de los 4 módulos
├── js/
│   ├── sigep.js            Íconos, menú en celular y pestañas
│   ├── config.js           Conexión con Supabase (URL y clave publicable) — compartido
│   └── vendor/             Librerías compartidas: supabase.js (MIT) y pdfjs/ (Apache 2.0)
├── supabase/               Base de datos de todos los módulos (ver «Configurar Supabase»)
├── modulo-1/               Expediente digital: login.html, modulo-1.html, js/expediente.js
├── modulo-3/               Pre-auditoría: Frontend/login.html, modulo-3.html (asesor), alumno.html
└── modulo-4/               Portal del alumno: portal.html, alumno.html, asesor.html
```

Cada módulo es su propia PWA (manifiesto, service worker y caché independientes), con
alcance en su carpeta. Las cachés tienen nombres distintos (`sigep-modulo-1-…`,
`sigep-preauditoria-…`, `estadias-…`) y cada service worker solo borra las suyas.

## Configurar Supabase (una sola vez)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Copia en `js/config.js` la **Project URL** y la **Publishable key** (o *anon key*).
   Nunca pongas ahí la clave secreta (*service_role*).
3. En **SQL Editor**, ejecuta en este orden (pega cada archivo y pulsa **Run**):
   1. `supabase/esquema.sql` — alumnos y registro automático
   2. `supabase/tesina.sql` — asesores, tesinas, observaciones, notas, voz y push (Módulo 4)
   3. `supabase/modulo-1.sql` — expedientes, documentos, revisiones e historial (Módulo 1)
   4. `supabase/modulo-3.sql` — dictámenes, checklist, avisos y citas (Módulo 3)

   Todos se pueden volver a ejecutar sin duplicar nada.
4. **Notificaciones push:** sigue los pasos de `modulo-4/README.md` («Notificaciones push»).
   La misma función `enviar-push` avisa de los tres módulos.
5. **Asesores:** se crean en **Authentication → Users** y se activan con
   `select hacer_asesor('correo', 'Nombre');` y `select asignar_asesor('matrícula', 'correo');`.

### Seguridad

- Inicio de sesión con Supabase Auth (contraseñas cifradas por Supabase).
- Reglas RLS en todas las tablas: el alumno solo ve lo suyo y el asesor solo a sus alumnos
  asignados. Los cambios importantes se hacen con funciones de la base de datos que
  validan quién llama (`subir_documento`, `revisar_documento`, `observar_version`…).
- Archivos en buckets privados (`expedientes`, `tesinas`, `voz`), uno por carpeta de alumno.

## Datos de prueba (todos los módulos)

**12 cuentas** (10 alumnos y 2 asesores), todas con la contraseña **Prueba2026**:

1. En **SQL Editor**, ejecuta `supabase/datos-prueba.sql` (crea las cuentas y asigna asesores).
2. En una terminal, en la carpeta del repositorio: `node supabase/sembrar-datos-prueba.mjs`
   (Node 18 o superior; no instala nada). Entra como cada alumno y asesor, igual que en la app:
   - **Módulo 4:** 12 versiones de tesina en PDF y 10 observaciones.
   - **Módulo 1:** 28 documentos del expediente (PDF generados) y 22 revisiones.
   - **Módulo 3:** checklist de pre-auditoría, dictámenes, citas y avisos.
3. En **SQL Editor**, ejecuta `supabase/fechas-datos-prueba.sql` (reparte las fechas entre
   septiembre y octubre de 2026).

| Cuenta | Rol | Situación |
| --- | --- | --- |
| `prueba.asesor1@sigep-pruebas.mx` | Asesora (Dra. Mariana Torres) | Alumnos 01, 02, 03, 04 y 10 |
| `prueba.asesor2@sigep-pruebas.mx` | Asesor (Mtro. Ricardo Vega) | Alumnos 05, 06, 07 y 09 |
| `prueba.alumno01@…` | Alumna | Tesina aprobada (3 versiones) · expediente completo |
| `prueba.alumno02@…` | Alumno | Tesina en revisión · carta de aceptación corregida (v2) |
| `prueba.alumno03@…` | Alumna | Primera entrega por revisar · 2 documentos en revisión |
| `prueba.alumno04@…` | Alumno | Sin entregas de tesina · documento con corrección |
| `prueba.alumno05@…` | Alumna | Tesina aprobada · INE en revisión |
| `prueba.alumno06@…` | Alumno | 2 versiones con correcciones y la 3.ª en revisión · IMSS corregido (v2) |
| `prueba.alumno07@…` | Alumna | Tesina aprobada · expediente completo |
| `prueba.alumno08@…` | Alumno | Sin asesor asignado |
| `prueba.alumno09@…` | Alumna | Sin tesina · expediente a la mitad |
| `prueba.alumno10@…` | Alumno | Sin tesina · IMSS con corrección |

Para quitarlas: `supabase/borrar-datos-prueba.sql` y borra en **Storage** (buckets
`tesinas`, `voz` y `expedientes`) las carpetas que lista.

## Probar en la computadora

Una PWA necesita `http://localhost` o HTTPS. Desde la carpeta del repositorio:

```
npx serve .
```

y abre la dirección que muestra. En GitHub Pages: **Settings → Pages → Branch: main /
(root) → Save**; queda en `https://<usuario>.github.io/SIGEUTP/`.

## Diseño común (reglas del equipo)

- Enlaza `css/sigep.css` y `js/sigep.js` y pon tu número de módulo en `<body data-modulo="N">`.
- Copia el menú y la barra superior de `plantilla-modulo.html`; usa las clases de `guia.html`
  (`btn`, `card`, `stats`, `stat`, `table-wrap` + `tbl`, `chip`, `tabs`, `rows`, `field`).
- No cambies los colores del menú ni de los estados; usa siempre las variables (`var(--primary)`).
- Una sola acción principal (botón azul) por pantalla e incluye **Portal SIGEP** al final del menú.
- Si alguien necesita cambiar `sigep.css`, avisa al equipo: el cambio es para los 4.
