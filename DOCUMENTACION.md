# VibeWire Alfa — Documentación del Proyecto

**Autor:** york garcia
**Fecha:** Octubre 2026  


---

## 1. ¿Qué es VibeWire?

VibeWire es una aplicación web de noticias sobre tecnología, inteligencia artificial, desarrollo y cultura maker. Funciona como una **SPA (Single Page Application)**: toda la navegación ocurre dentro de una sola página HTML sin recargar el navegador. Los datos se guardan en una base de datos **Supabase** (PostgreSQL en la nube) con políticas de seguridad que protegen la información de cada usuario.

---

## 2. Tecnologías utilizadas

| Tecnología | Para qué sirve |
|---|---|
| **Vite** | Empaquetador y servidor de desarrollo |
| **JavaScript (Vanilla)** | Toda la lógica de la aplicación, sin frameworks |
| **Supabase** | Base de datos (PostgreSQL), autenticación y seguridad |
| **CSS personalizado** | Diseño visual completo de la interfaz |
| **Tailwind CSS** | Framework de utilidades CSS (incluido pero el diseño principal es CSS propio) |
| **HTML5** | Estructura base de la página |

---

## 3. Estructura de archivos

```
project/
├── index.html                  → Documento HTML único (punto de montaje)
├── package.json                → Dependencias y scripts del proyecto
├── vite.config.ts              → Configuración del empaquetador Vite
├── tailwind.config.js          → Configuración de Tailwind CSS
├── postcss.config.js           → Configuración de PostCSS (Tailwind + Autoprefixer)
├── eslint.config.js            → Reglas de calidad de código
├── tsconfig.json               → Configuración base de TypeScript
├── src/
│   ├── main.tsx                → Punto de entrada: importa estilos y app.js
│   ├── app.js                  → Lógica completa de la aplicación (SPA)
│   ├── styles.css              → Todos los estilos visuales
│   ├── index.css               → Directivas de Tailwind
│   ├── data.json               → Catálogo local de 6 noticias (respaldo)
│   ├── vite-env.d.ts           → Tipos de Vite
│   └── lib/
│       └── supabase.js         → Cliente de Supabase (conexión a la base de datos)
└── supabase/
    └── migrations/
        ├── 20261013225854_create_vibewire_alpha_schema.sql    → Crea tablas, políticas y datos iniciales
        └── 20261013230027_tighten_vibewire_client_writes.sql  → Endurece permisos de escritura
```

---

## 4. Explicación de cada archivo

### 4.1. `index.html`
Es el único archivo HTML del proyecto. Contiene:
- Metadatos (título, descripción, configuración de redes sociales).
- Un `<div id="app">` donde JavaScript inserta todo el contenido dinámicamente.
- Una etiqueta `<script>` que carga el módulo de entrada `main.tsx`.

### 4.2. `src/main.tsx`
Punto de entrada de JavaScript. Solo importa tres archivos:
1. `index.css` (directivas de Tailwind)
2. `styles.css` (estilos personalizados)
3. `app.js` (toda la lógica)

### 4.3. `src/lib/supabase.js`
Crea el cliente de Supabase usando las variables de entorno públicas (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`). Este cliente se usa en toda la app para consultar la base de datos y gestionar sesiones.

### 4.4. `src/data.json`
Archivo JSON con 6 noticias editoriales de respaldo. Si la base de datos no responde, la app usa estos datos para que la página nunca quede vacía.

### 4.5. `src/styles.css`
Contiene todo el diseño visual: variables de color, tipografía, tarjetas, botones, formularios, notificaciones, encabezado, pie de página y reglas responsivas para móvil y escritorio.

### 4.6. `src/app.js`
Es el archivo principal. Contiene toda la lógica de la aplicación.

---

## 5. Funciones de `src/app.js` — Explicación completa

### 5.1. Configuración y estado global

| Elemento | Qué hace |
|---|---|
| `PAGE_SIZE = 6` | Cantidad de noticias por página en el archivo |
| `CATEGORIES` | Lista de categorías: IA, Desarrollo, Tecnología, Cultura |
| `ROUTES` | Rutas válidas del router: home, noticias, detalle, favoritos, crear, contacto, auth |
| `state` | Objeto global con toda la información de la app: noticias, favoritos, sesión, búsqueda, categoría actual, página actual, etc. |

### 5.2. Utilidades

| Función | Qué hace |
|---|---|
| `byId(id)` | Atajo para `document.getElementById`. Busca un elemento por su ID. |
| `escapeHtml(value)` | Reemplaza caracteres especiales (`&`, `<`, `>`, `'`, `"`) por entidades HTML. **Previene ataques XSS**: si un usuario escribe `<script>`, se muestra como texto y no se ejecuta. |
| `normalizeId(id)` | Convierte cualquier ID (string o número) a número entero para comparaciones consistentes. |
| `formatDate(value)` | Toma una fecha ISO (YYYY-MM-DD) y la formatea en español de Colombia (ej: "25 sep, 2026"). |
| `fromDatabase(row)` | Convierte una fila de la tabla `news` de Supabase al formato que usan las vistas (nombres en español). |
| `toDatabase(values)` | Convierte los valores del formulario al formato de columnas que espera la base de datos. |
| `owns(news)` | Verifica si una noticia pertenece al usuario conectado (compara `ownerId` con el ID de sesión). |
| `isFavorite(id)` | Revisa si un ID de noticia está en los favoritos del usuario. |
| `getNews(id)` | Busca una noticia por su ID dentro del arreglo `state.news`. |
| `articleParagraphs(content)` | Divide el contenido en párrafos (por saltos de línea) y genera etiquetas `<p>` con el texto escapado. |
| `friendlyError(error)` | Convierte un error técnico de Supabase en un mensaje amable. Nunca muestra el error original al usuario. |

### 5.3. Plantilla y router

| Función | Qué hace |
|---|---|
| `renderShell()` | Dibuja la estructura base: encabezado con logo y navegación, contenedor principal, pie de página y zona de notificaciones. |
| `renderAccount()` | Muestra el correo del usuario conectado con botón de cerrar sesión, o un botón de "Acceder" si no hay sesión. |
| `newsCard(news)` | Genera el HTML de una tarjeta de noticia: imagen, categoría, botón de favorito, título, descripción y enlace al detalle. |
| `renderCards(target, news, emptyMessage)` | Pinta una lista de tarjetas en un contenedor, o muestra un mensaje si no hay resultados. |
| `route()` | **Router principal**: lee el hash de la URL, determina qué vista mostrar, marca el enlace activo y renderiza. |
| `renderView(routeName, parameter, returnTo)` | Selecciona y llama a la función de render correspondiente según la ruta. |

### 5.4. Carga de datos y vistas públicas

| Función | Qué hace |
|---|---|
| `loadRemoteData()` | Consulta todas las noticias y los favoritos del usuario desde Supabase. Si hay error, muestra un toast pero mantiene el catálogo local. |
| `renderHome()` | Dibuja la portada: noticia destacada con imagen grande, texto introductorio y cuadrícula de 6 noticias recientes. |
| `renderNews()` | Dibuja el archivo editorial con búsqueda por texto, filtro por categoría y paginación de 6 noticias por página. |
| `renderPagination(pages)` | Genera los botones de paginación numerados. |
| `renderDetail(id)` | Dibuja el artículo completo: categoría, título, autor, fecha, imagen, contenido en párrafos y hasta 3 noticias relacionadas. |
| `renderFavorites()` | Dibuja la biblioteca privada de favoritos. Si no hay sesión, redirige al login. |

### 5.5. Autenticación

| Función | Qué hace |
|---|---|
| `renderAuth(mode, returnTo)` | Dibuja el formulario de acceso (login) o registro (register). `returnTo` indica a dónde redirigir después del login. |
| `handleAuthSubmit(event, register, returnTo)` | Procesa el envío del formulario: valida correo y contraseña, llama a `signUp` o `signInWithPassword` de Supabase, y redirige si todo sale bien. |
| `signOut()` | Cierra la sesión, limpia favoritos de memoria, recarga datos y redirige al inicio. |

### 5.6. Formularios y publicaciones

| Función | Qué hace |
|---|---|
| `newsRules()` | Define las reglas de validación para cada campo del formulario de noticias (título mínimo 5 caracteres, descripción entre 10 y 160, etc.). |
| `validImageUrl(value)` | Verifica que una URL tenga protocolo `http:` o `https:`. |
| `validateField(field, valid, message)` | Marca visualmente un campo como válido (verde) o inválido (rojo) y muestra el mensaje de error. |
| `setupLiveValidation(form, rules)` | Conecta los eventos `input` y `blur` para validar cada campo mientras el usuario escribe. |
| `newsForm(news)` | Genera el HTML del formulario de creación o edición de noticias. Si recibe una noticia, precarga sus valores. |
| `renderManager()` | Dibuja el panel privado de autor: formulario de publicación, panel de ayuda y tabla con las noticias del usuario (con botones de editar y eliminar). |
| `readNewsForm(form)` | Lee los valores del formulario y convierte el checkbox a booleano. |
| `handleNewsSubmit(event)` | Guarda una noticia nueva (INSERT) o actualiza una existente (UPDATE) en Supabase. Valida todos los campos antes de enviar. |
| `confirmDelete()` | Elimina una noticia propia después de que el usuario confirma la acción. |

### 5.7. Contacto y favoritos

| Función | Qué hace |
|---|---|
| `contactRules()` | Reglas de validación del formulario de contacto (nombre, email, asunto, mensaje, checkbox de consentimiento). |
| `renderContact()` | Dibuja el formulario de contacto con campos para nombre, correo, asunto, mensaje y checkbox de aceptación. |
| `handleContactSubmit(event, rules)` | Valida y envía el mensaje a la tabla `contact_messages`. Si todo sale bien, reemplaza el formulario con una confirmación visual. |
| `toggleFavorite(id, source)` | Añade o quita una noticia de favoritos en la base de datos. Si no hay sesión, redirige al login. |

### 5.8. Notificaciones y arranque

| Función | Qué hace |
|---|---|
| `toast(message, type)` | Muestra una notificación temporal en la esquina inferior derecha. Desaparece sola en 3.6 segundos o se cierra manualmente. |
| `document.addEventListener('click', ...)` | **Delegación de eventos**: centraliza todos los clics de botones dinámicos (favoritos, paginación, editar, eliminar, cerrar sesión, menú móvil). |
| `supabase.auth.onAuthStateChange(...)` | Escucha cambios de sesión. Cuando el usuario inicia o cierra sesión, actualiza el estado, recarga datos y re-renderiza. |
| `boot()` | **Función de arranque**: dibuja la estructura, recupera la sesión existente, carga los datos y ejecuta el router. |
| `window.addEventListener('hashchange', route)` | Escucha cambios en el hash de la URL para ejecutar el router. |
| `boot()` (llamada final) | Inicia la aplicación. |

---

## 6. Base de datos (Supabase)

### 6.1. Tablas

#### `news`
Almacena todas las noticias del catálogo.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigint | Identificador único autoincremental |
| `owner_id` | uuid | Usuario propietario (NULL para noticias editoriales) |
| `title` | text | Título (5-180 caracteres) |
| `category` | text | Categoría (IA, Desarrollo, Tecnología, Cultura) |
| `description` | text | Descripción breve (10-160 caracteres) |
| `content` | text | Contenido completo (mínimo 30 caracteres) |
| `image_url` | text | URL de imagen (debe empezar con http/https) |
| `published_at` | date | Fecha de publicación |
| `featured` | boolean | Indica si es noticia destacada |
| `is_published` | boolean | Controla si es visible públicamente |
| `created_at` | timestamptz | Fecha de creación |
| `updated_at` | timestamptz | Fecha de última modificación |

#### `favorites`
Relación privada entre usuarios y noticias guardadas.

| Columna | Tipo | Descripción |
|---|---|---|
| `user_id` | uuid | Usuario propietario del favorito |
| `news_id` | bigint | Noticia guardada |
| `created_at` | timestamptz | Fecha de creación |

Clave primaria compuesta: `(user_id, news_id)` — impide duplicados.

#### `contact_messages`
Mensajes del formulario de contacto.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigint | Identificador único |
| `owner_id` | uuid | Usuario conectado (NULL si es anónimo) |
| `name` | text | Nombre del remitente (3-120 caracteres) |
| `email` | text | Correo del remitente |
| `subject` | text | Asunto (Proponer, Corrección, Otro) |
| `message` | text | Mensaje (10-5000 caracteres) |
| `status` | text | Estado (new, read, archived) |
| `created_at` | timestamptz | Fecha de recepción |

### 6.2. Seguridad (RLS — Row Level Security)

La base de datos tiene políticas de seguridad a nivel de fila:

- **Noticias**: cualquiera puede leer las publicadas; solo el propietario puede editar y eliminar las suyas.
- **Favoritos**: cada usuario solo puede ver, crear y eliminar sus propios favoritos.
- **Mensajes de contacto**: cualquiera puede enviar un mensaje; solo el propietario puede ver los suyos.
- La propiedad se obtiene de `auth.uid()` (servidor), nunca del cliente.

### 6.3. Migraciones

1. **`20261013225854_create_vibewire_alpha_schema.sql`**: Crea las tres tablas, índices, políticas RLS, permisos de columnas y carga las 6 noticias iniciales.

2. **`20261013230027_tighten_vibewire_client_writes.sql`**: Endurece los permisos: el navegador solo puede escribir en columnas editoriales, nunca en `owner_id`, fechas o estados de control.

---

## 7. Vistas de la aplicación

### 7.1. Inicio (`#home`)
Portada con noticia destacada, texto introductorio y cuadrícula de noticias recientes.

### 7.2. Noticias (`#noticias`)
Archivo editorial con búsqueda por texto, filtro por categoría y paginación.

### 7.3. Detalle (`#detalle/<id>`)
Artículo completo con imagen, contenido, metadatos y noticias relacionadas.

### 7.4. Favoritos (`#favoritos`)
Biblioteca privada de noticias guardadas. Requiere sesión.

### 7.5. Crear noticia (`#crear`)
Panel de autor con formulario de publicación y tabla de noticias propias. Requiere sesión.

### 7.6. Contacto (`#contacto`)
Formulario de contacto con validación en tiempo real.

### 7.7. Acceder (`#auth`)
Pantalla de login o registro con correo y contraseña.

---

## 8. Características de seguridad

1. **Escape HTML**: todo el contenido introducido por usuarios se escapa antes de insertarlo en el DOM, previniendo ataques XSS.
2. **RLS (Row Level Security)**: la base de datos valida que cada usuario solo acceda a sus propios datos.
3. **Mensajes de error neutrales**: los errores técnicos nunca se muestran al usuario final.
4. **Validación doble**: los formularios se validan en el cliente y la base de datos tiene restricciones CHECK.
5. **Permisos de columnas**: el navegador no puede modificar `owner_id`, `created_at`, `updated_at` ni `status`.
6. **URLs validadas**: solo se aceptan URLs con protocolo http o https.

---

## 9. Diseño responsivo

- **Escritorio (>900px)**: 3 columnas de noticias, hero a 2 columnas, navegación horizontal.
- **Tablet (650-900px)**: 2 columnas de noticias, hero a 1 columna.
- **Móvil (<650px)**: 1 columna, menú desplegable, filtros apilados.

---

## 10. Cómo ejecutar el proyecto

```bash
npm install      # Instala dependencias
npm run dev      # Servidor de desarrollo
npm run build    # Genera la versión de producción en dist/
npm run preview  # Previsualiza la versión de producción
```
