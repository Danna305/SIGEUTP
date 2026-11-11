# SIGEP UTP · Módulo 3 · Pre-auditoría y seguimiento académico

PWA para que el **asesor** haga la pre-auditoría de la tesina de sus alumnos (visor del PDF,
checklist de 10 criterios, chatbot de consulta, dictamen, dictado por voz y citas) y para que
el **alumno** consulte su dictamen, checklist, observaciones, avisos y citas.

Usa el mismo Supabase y la misma cuenta que el resto de SIGEP: las versiones que revisa son
las que el alumno sube en el **Módulo 4** (tabla `tesina_versiones`), y el dictamen también
queda en la tesina del Módulo 4 (`observar_version`) con aviso push al alumno.

## Estructura

```text
modulo-3/
├── index.html                 Splash: redirige según la sesión de SIGEP
├── offline.html               Respaldo sin conexión del service worker
├── manifest.webmanifest       Manifiesto de la PWA
├── sw.js                      Service worker (caché, push y Background Sync)
├── Frontend/
│   ├── login.html             Inicio de sesión con Supabase Auth (cuentas de SIGEP)
│   ├── modulo-3.html          Vista del asesor: alumnos, pre-auditoría, dictamen y citas
│   └── alumno.html            Vista del alumno: dictamen, checklist, avisos y citas
├── css/
│   ├── sigep.css              Diseño común (con los ajustes de este módulo)
│   └── preauditoria.css       Estilos de la pre-auditoría
├── js/
│   ├── auth.js                Sesión y rol (asesor o alumno) con Supabase Auth
│   ├── sigep.js               Íconos, menú, sesión en pantalla y registro del SW
│   ├── sync.js                Motor híbrido IndexedDB ⇄ Supabase (cola sin conexión)
│   └── preauditoria.js        Lógica de la pre-auditoría
└── img/                       Íconos de la PWA
```

Usa los archivos compartidos de la raíz: `../js/config.js`, `../js/vendor/supabase.js` y
`../js/vendor/pdfjs/` (para leer el texto del PDF que usa el chatbot).

## Base de datos

Ejecuta `../supabase/modulo-3.sql` en el SQL Editor (después de `esquema.sql` y `tesina.sql`).
Crea las tablas `dictamenes`, `evaluaciones_checklist`, `notificaciones` y `citas` con reglas
RLS: el asesor solo escribe sobre sus alumnos asignados y el alumno solo ve lo suyo.

La versión anterior tenía su propio proyecto de Supabase, una tabla `usuarios` con
contraseñas y reglas abiertas a cualquiera; ya no se usan.

## Acceso

| Rol | Destino |
| --- | --- |
| Asesor | `Frontend/modulo-3.html` |
| Alumno | `Frontend/alumno.html` |

Si ya iniciaste sesión en otro módulo de SIGEP, `index.html` te lleva directo a tu vista.
Las cuentas de prueba están en el `README.md` de la raíz.

## Funcionamiento sin conexión

- El service worker guarda la app; los archivos de la tesina se guardan en IndexedDB la
  primera vez que se abren.
- Checklist, dictámenes, observaciones, avisos y citas se guardan en IndexedDB
  (`sigep-preauditoria`) y se envían a Supabase al volver la conexión (cola `sync_queue`).
- Si en el dispositivo entra otra cuenta, se borra lo que guardó la anterior.
