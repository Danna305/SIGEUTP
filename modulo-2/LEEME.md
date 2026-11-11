# SIGEP UTP · Módulo 2: Administración y gestión académica

Propuesta 2 del Sistema de Gestión de Estadías. Panel administrativo (PWA) con
backend en **Node.js + Express** para controlar alumnos, asesores, periodos,
asignaciones, empresas y usuarios.

```
sigep-utp-admin/
├── server.js             Servidor Express y API REST
├── server/seed.js        Datos de ejemplo (180 alumnos, 24 asesores, 41 empresas, 3 periodos)
├── database/supabase.sql Las 8 tablas para Supabase (PostgreSQL)
├── database/esquema.sql  Las 8 tablas para MySQL / MariaDB
├── server/supabase.js    Conexión con Supabase (API REST, sin paquetes extra)
├── server/push.js        Notificaciones push (VAPID + cifrado aes128gcm, sin paquetes extra)
├── public/js/radar.js    Cálculo del Radar de Estadías (lo usan el servidor y el panel)
├── .env.example          Plantilla de las llaves de Supabase
├── data/db.json          Base de datos local si no usas Supabase
├── package.json          Dependencias y comandos
└── public/               Panel web (HTML, CSS, JS, manifest, Service Worker)
    └── portal/           Portal principal de los 4 módulos (diseño común del equipo)
```

## 1. Instalar (solo la primera vez)

```bash
npm install
```

## 2. Arrancar

```bash
npm start
```

Abre **http://localhost:3000**. La página de inicio explica el módulo; el botón
*Entrar al panel* lleva al inicio de sesión.

## 2.0 Portal y diseño común

El módulo usa el diseño común del equipo (menú azul marino, botones azules y el
color de acento de cada módulo). El portal principal con los 4 módulos está en
**http://localhost:3000/portal/index.html**; el menú del panel tiene el enlace
*Portal SIGEP* para regresar a él.

## 2.1 Base de datos en Supabase (opcional, recomendado)

Sin configurar nada, los datos se guardan en el archivo `data/db.json`.
Para guardarlos en **Supabase** (PostgreSQL en la nube) y verlos en sus tablas:

1. Entra a https://supabase.com, crea una cuenta y un proyecto nuevo.
2. Abre **SQL Editor > New query**, pega todo el archivo `database/supabase.sql` y presiona **Run**.
   Se crean las 8 tablas (vacías).
3. Ve a **Project Settings > API Keys** (o **API**) y copia:
   - la **Project URL** (`https://xxxx.supabase.co`)
   - la llave **secreta**: `service_role` o `sb_secret_...` (nunca la pública `anon`/`publishable`)
4. En la carpeta del proyecto copia `.env.example` como `.env` y pega esos dos valores.
5. Ejecuta `npm start`. La primera vez el servidor inserta los datos de ejemplo y verás:
   `Supabase listo: 180 alumnos, 24 asesores, 41 empresas`.

Desde ese momento:
- Lo que registras, editas o **borras en el sitio** se guarda en Supabase al instante
  (Table Editor > recarga la tabla para verlo).
- Lo que cambias o **borras directamente en Supabase** aparece en el sitio en unos 10 segundos.
- Si borras en Supabase un registro que otros usan (por ejemplo, una empresa con alumnos),
  la base no lo permite por sus llaves foráneas.

La llave secreta solo vive en `.env` del servidor; nunca se envía al navegador
y `.env` está en `.gitignore` para no subirla a GitHub.

## 2.2 Radar de Estadías y notificaciones push (propuesta de mejora)

En el menú del panel está **Radar de estadías**:

- Califica de 0 a 100 a cada alumno activo: documentos atrasados según la semana (30),
  sin asesor (30), empresa y convenio (20), documentos rechazados (10) y carga del asesor (10).
  Rojo: 50 o más · Amarillo: 25 a 49 · Verde: menos de 25.
- Muestra por qué cada alumno está en rojo y una **acción sugerida** (por ejemplo, el asesor
  de su carrera con menos carga) que se aplica con un clic.
- **Activar alertas**: el navegador pide permiso y el dispositivo queda suscrito. Cuando un
  alumno pasa a riesgo alto llega una notificación aunque el panel esté cerrado, y a las
  7:00 a. m. un resumen. **Enviar alerta de prueba** manda una al momento.
- En la app instalada, el ícono muestra el número de alumnos en rojo (Badging API).
- **Sin conexión**, las asignaciones hechas desde el radar se guardan en el dispositivo
  (IndexedDB) y se envían solas al volver la conexión (Background Sync).

Las llaves de las notificaciones (VAPID) se crean solas la primera vez en `data/vapid.json`.
Las notificaciones push necesitan **https** (o `localhost`) e internet hacia el servicio de
notificaciones del navegador. En iPhone funcionan con la app instalada (iOS 16.4 o posterior).

## 3. En el celular (https)

Con el servidor encendido, en **otra terminal**:

```bash
npm run tunel
```

Abre en el celular la dirección `https://...trycloudflare.com` que aparece en el
recuadro y elige *Instalar app*. La dirección cambia cada vez.

## 4. Usuarios de demostración (contraseña: demo1234)

| Rol | Correo | Puede |
| --- | --- | --- |
| Administrador | admin@utpuebla.edu.mx | Todo, incluidos periodos, usuarios y permisos |
| Coordinador de carrera | coordinacion@utpuebla.edu.mx | Alumnos, asesores, asignaciones y empresas |
| Consulta | consulta@utpuebla.edu.mx | Solo consultar |

`pmorales@utpuebla.edu.mx` está **inactivo** a propósito, para probar que no puede entrar.

## 5. Funcionalidades del módulo

1. Registro, consulta y edición de alumnos
2. Registro y gestión de asesores (con capacidad máxima)
3. Creación y administración de periodos (uno activo)
4. Asignación de asesores: individual, masiva o automática
5. Gestión de empresas y contactos
6. Consulta del estado general de expedientes
7. Filtros y búsquedas avanzadas, exportación a CSV
8. Panel con estadísticas básicas y pendientes
9. Gestión de usuarios y permisos (matriz editable por rol)

## 6. Caché y modo sin conexión (API Cache)

El Service Worker (`public/sw.js`) usa tres cachés:

| Caché | Estrategia | Contenido |
| --- | --- | --- |
| sigep-shell-v6 | Cache First | HTML, CSS, JS, manifiesto e íconos (se guardan al instalar) |
| sigep-dinamica-v1 | Stale-While-Revalidate | Imágenes, video y tipografías (máximo 40 archivos) |
| sigep-datos-v1 | Network First | Última respuesta de /api/estado, /api/version y /api/radar |

En el panel, la sección **Caché sin conexión** muestra el contenido de cada caché y
permite probar los métodos `caches.keys()`, `caches.open()`, `caches.match()`,
`caches.has()`, `caches.delete()`, `cache.keys()`, `cache.matchAll()`, `cache.add()`,
`cache.addAll()`, `cache.put()`, `cache.match()` y `cache.delete()`. Cada llamada
aparece en el registro de operaciones. Al cerrar sesión se borra la caché de datos.

Para verlo en Chrome: F12 > Application > Cache Storage. Para probar sin internet:
F12 > Network > Offline y recarga la página.

## 7. API REST

Todas las rutas (excepto `salud` y `login`) requieren `Authorization: Bearer <token>`.

| Método | Ruta | Permiso |
| --- | --- | --- |
| POST | /api/login | Público |
| POST | /api/logout | Sesión |
| GET | /api/estado · /api/version | Sesión |
| PUT | /api/perfil/password | Sesión |
| POST · PUT · DELETE | /api/alumnos · /api/alumnos/:id | alumnos.editar |
| POST · PUT · DELETE | /api/asesores · /api/asesores/:id | asesores.editar |
| POST | /api/asignaciones (individual o masiva) | asignaciones.editar |
| POST | /api/asignaciones/automatica | asignaciones.editar |
| DELETE | /api/asignaciones/:id | asignaciones.editar |
| POST · PUT · DELETE | /api/periodos · /api/periodos/:id | periodos.editar |
| PUT | /api/periodos/:id/estado | periodos.editar |
| POST · PUT · DELETE | /api/empresas · /api/empresas/:id | empresas.editar |
| PUT | /api/empresas/:id/convenio | empresas.editar |
| POST | /api/empresas/:id/contactos | empresas.editar |
| PUT · DELETE | /api/contactos/:id | empresas.editar |
| POST · PUT · DELETE | /api/usuarios · /api/usuarios/:id | usuarios.editar |
| PUT | /api/usuarios/:id/password | usuarios.editar |
| PUT | /api/roles/:id | usuarios.editar |
| GET | /api/radar | alumnos.ver |
| GET | /api/push/clave | Sesión |
| POST · DELETE | /api/push/suscribir | Sesión |
| POST | /api/push/prueba | alumnos.ver |
| POST | /api/reset | usuarios.editar |

## Otros comandos

- `npm run dev`: reinicia el servidor solo al guardar cambios.
- `npm run reset`: borra la base de datos para volver a los datos de ejemplo (con el servidor apagado).
