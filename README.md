# SIGEP UTP · Diseño común de los 4 módulos

Todos los módulos del Sistema de Gestión de Estadías usan el mismo menú lateral, la
misma barra superior, los mismos colores y los mismos componentes. Cada integrante
solo cambia el contenido de su propuesta y su número de módulo.

```
sigep-diseno-comun/
├── index.html              Página de presentación del sistema (portal con los 4 módulos)
├── guia.html               Guía visual: colores, tipografía y componentes con su código
├── plantilla-modulo.html   Pantalla vacía con comentarios para empezar tu módulo
├── ejemplos/modulo-1..4    Una pantalla de ejemplo por módulo
├── css/sigep.css           Estilos comunes (el único archivo de estilos compartido)
├── js/sigep.js             Íconos, menú en celular y pestañas
└── img/                    Capturas que usa la guía
```

Abre `index.html` o `guia.html` con doble clic para verlos en el navegador.

## Cómo aplicarlo en tu módulo

1. Copia `css/sigep.css` y `js/sigep.js` a tu proyecto.
2. Enlázalos en tu HTML:
   ```html
   <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
   <link rel="stylesheet" href="css/sigep.css">
   ...
   <script src="js/sigep.js"></script>
   ```
3. Pon tu número de módulo en el `<body>`:

   | Módulo | Propuesta | `data-modulo` | Color |
   | --- | --- | --- | --- |
   | 1 | Expediente digital y gestión de documentos | `1` | Rosa |
   | 2 | Administración y gestión académica | `2` | Azul |
   | 3 | Seguimiento académico y revisión de estadías | `3` | Verde |
   | 4 | Portal del alumno y acceso móvil | `4` | Ámbar |

4. Copia el menú y la barra superior de `plantilla-modulo.html` y escribe tu contenido
   dentro de `<main class="content">`. Usa las clases de la guía: `btn`, `card`, `stats`,
   `stat`, `table-wrap` + `tbl`, `chip`, `tabs`, `rows`, `field`.

**Si tu proyecto es React:** importa `sigep.css` una vez (`import './css/sigep.css'`) y
usa `className` en lugar de `class`. Los íconos los puedes poner con `<i data-ic="users"></i>`
cargando `sigep.js`, o copiar el `<svg>` que genera.

## Página de presentación (portal)

`index.html` es la página de entrada del sistema que usamos las 4. En cada tarjeta, cambia el
`href` del botón **Entrar** por la dirección real del módulo de cada integrante y el
texto "Integrante N" por su nombre.

## Reglas

- No cambiar los colores del menú ni de los estados (aprobado, en revisión, etc.).
- Usar siempre las variables (`var(--primary)`), nunca códigos de color directos.
- Una sola acción principal (botón azul) por pantalla.
- Incluir el enlace **Portal SIGEP** al final del menú.
- Si alguien necesita cambiar `sigep.css`, avisa al equipo: el cambio es para los 4.

## Publicarlo en GitHub Pages (opcional)

En el repositorio: **Settings → Pages → Branch: main / (root) → Save**. En unos minutos
la página de presentación queda en `https://<usuario>.github.io/<repositorio>/`.
