# SIGEP UTP · PWA de pre-auditoría y seguimiento académico

Aplicación web progresiva (PWA) para la gestión de estadías de la Universidad Tecnológica de Puebla. Implementa el **Módulo 3 (asesor)** para pre-auditoría de tesinas y el **Módulo 4 (alumno)** para consulta de dictámenes, checklist, observaciones y citas.

## Estructura

```text
SIGEUTP/
├── index.html                 Splash y redirección por sesión
├── offline.html               Respaldo offline del Service Worker
├── manifest.webmanifest       Manifiesto PWA
├── sw.js                      Service Worker (caché + sync + notificaciones)
├── Frontend/
│   ├── login.html             Inicio de sesión (Supabase + fallback offline)
│   ├── modulo-3.html          Vista del asesor (pre-auditoría, checklist, dictamen, citas)
│   └── modulo-4.html          Vista del alumno (documento, dictamen, checklist, avisos, citas)
├── css/
│   ├── sigep.css              Estilos base, layout responsivo y componentes comunes
│   └── preauditoria.css       Estilos del módulo de pre-auditoría
├── js/
│   ├── sigep.js               Íconos, UI común, sesión, SW e instalación PWA
│   ├── sync.js                Motor híbrido IndexedDB ⇄ Supabase
│   └── preauditoria.js        Lógica de pre-auditoría, checklist, PDF, citas y notificaciones
├── BD/
│   └── supabase.sql           Tablas, RLS, datos de prueba y RPC verificar_login
├── docs/                      PDFs de ejemplo para el visor offline
└── img/                       Íconos PWA y recursos de interfaz
```

## Uso local

Una PWA requiere `http://localhost` o HTTPS para registrar el Service Worker. Ejemplo:

```powershell
npx serve .
```

Luego abre la URL local en el navegador.

## Acceso

`index.html` redirige a `Frontend/login.html`. Al iniciar sesión se guarda `sigep_sesion` (JSON) y claves de respaldo en `localStorage`, lo que permite reabrir la app sin re-autenticarse constantemente.

| Rol | Destino |
| --- | --- |
| Asesor | `Frontend/modulo-3.html` |
| Alumno | `Frontend/modulo-4.html` |

## Configuración de Supabase

1. Revisa `SUPABASE_URL` y `SUPABASE_KEY` en `js/sync.js`.
2. Ejecuta `BD/supabase.sql` en el editor SQL de Supabase.
3. La tabla `usuarios` usa hashes bcrypt y el login seguro se realiza con la función RPC `verificar_login`.

Tablas sincronizadas: `dictamenes`, `evaluaciones_checklist`, `notificaciones`, `citas`.

## Funcionamiento offline

- El Service Worker precachea el shell y PDFs de ejemplo.
- Estrategia de caché: **Cache First** para recursos estáticos (mismo origen) y **Network First** para navegación con respaldo en caché / `offline.html`.
- Los cambios de checklist, dictámenes, observaciones y citas se guardan en IndexedDB (`sigep-preauditoria`, v4) y se sincronizan al recuperar la red.
- La base de datos remota (Supabase) se consulta en red; en modo offline la app usa IndexedDB como respaldo.

## Tecnologías

HTML5, CSS3, JavaScript ES6+ (Vanilla), Service Worker, Cache API, IndexedDB, Web App Manifest y Supabase JS SDK v2 (CDN).
