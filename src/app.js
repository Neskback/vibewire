/* =====================================================================
   VibeWire Alfa · SPA Vanilla JS + Supabase
   Estado, autenticación, noticias, favoritos, contacto y navegación hash.
   =====================================================================
   Soy estudiante de Ingeniería de Sistemas y este archivo es el corazón
   de toda la aplicación. Aquí concentro el estado global, el enrutamiento
   por hash, la autenticación con Supabase, las vistas públicas y privadas,
   los formularios validados y la comunicación con la base de datos.
   ===================================================================== */
'use strict';

/* ------------------------------------------------------------------
   Importaciones
   ------------------------------------------------------------------ */
/* Importo el cliente de Supabase que creé en src/lib/supabase.js.
   A través de este objeto hago todas las consultas a la base de datos
   y gestiono la sesión del usuario. */
import { supabase } from './lib/supabase.js';

/* Importo el catálogo local en JSON como respaldo inicial.
   Si la base de datos todavía no ha respondido, muestro estas noticias
   para que la página nunca quede vacía. */
import catalogoLocal from './data.json';

/* ------------------------------------------------------------------
   Constantes de configuración
   ------------------------------------------------------------------ */
/* Cantidad de noticias que muestro por página en el archivo editorial.
   Lo dejé en 6 para que la cuadrícula se vea balanceada en escritorio. */
const PAGE_SIZE = 6;

/* Lista de categorías permitidas. La uso tanto en los filtros del archivo
   como en el formulario de creación, y coincide con el CHECK de la base. */
const CATEGORIES = ['IA', 'Desarrollo', 'Tecnología', 'Cultura'];

/* Rutas válidas que mi router reconoce. Si el hash no coincide con
   ninguna, envío al usuario a 'home'. */
const ROUTES = ['home', 'noticias', 'detalle', 'favoritos', 'crear', 'contacto', 'auth'];

/* ------------------------------------------------------------------
   Estado global de la aplicación
   ------------------------------------------------------------------ */
/* Este objeto 'state' es la única fuente de verdad mientras la app corre.
   - news: arreglo de noticias (del respaldo local o de Supabase).
   - favorites: ids de noticias que el usuario conectado ha guardado.
   - session: objeto de sesión de Supabase Auth (null si no hay usuario).
   - query: texto de búsqueda actual en el archivo.
   - category: filtro de categoría activo ('Todas' por defecto).
   - page: número de página actual en la paginación.
   - pendingDelete: id de la noticia que se quiere eliminar (espera confirmación).
   - editingId: id de la noticia que se está editando (null si es creación nueva).
   - loading: bandera que indica si estoy esperando datos del servidor. */
const state = {
  news: Array.isArray(catalogoLocal) ? [...catalogoLocal] : [],
  favorites: [],
  session: null,
  query: '',
  category: 'Todas',
  page: 1,
  pendingDelete: null,
  editingId: null,
  loading: true
};

/* ==================================================================
   SECCIÓN 1: Utilidades y adaptación de datos
   ==================================================================
   Aquí defino funciones auxiliares que uso en toda la aplicación.
   Me sirven para no repetir lógica y para mantener el código limpio.
   ================================================================== */

/* byId: atajo para document.getElementById.
   Lo uso constantemente para obtener elementos del DOM por su id. */
function byId(id) { return document.getElementById(id); }

/* escapeHtml: reemplazo los caracteres especiales de HTML (&, <, >, ', ")
   por sus entidades correspondientes.
   Hago esto para evitar ataques XSS: si un usuario escribe <script> en un
   campo, ese texto se muestra literalmente y no se ejecuta como código. */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

/* normalizeId: convierto cualquier id (string o número) a número entero.
   Lo necesito porque a veces el id viene de un data-attribute (string)
   y otras viene de la base de datos (número), y quiero compararlos bien. */
function normalizeId(id) { return Number(id); }

/* formatDate: tomo una fecha en formato ISO (YYYY-MM-DD) y la devuelvo
   en un formato legible en español de Colombia (ej: "25 sep, 2026").
   Si la fecha no es válida, muestro un mensaje neutro. */
function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Fecha pendiente'
    : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* fromDatabase: convierto una fila de la tabla 'news' de Supabase
   al modelo de datos que usan mis vistas (con nombres en español).
   - row.id → id numérico.
   - row.owner_id → ownerId (uuid del usuario que creó la noticia, o null).
   - row.title → titulo, row.category → categoria, etc.
   - Para el autor: si la noticia es del usuario conectado, muestro su correo;
     si no, muestro 'Equipo VibeWire' (las noticias iniciales no tienen autor). */
function fromDatabase(row) {
  return {
    id: row.id,
    ownerId: row.owner_id ?? null,
    titulo: row.title,
    categoria: row.category,
    descripcionCorta: row.description,
    contenidoCompleto: row.content,
    fecha: row.published_at,
    autor: row.author_name || (state.session?.user.id === row.owner_id ? state.session.user.email : 'Equipo VibeWire'),
    imagen: row.image_url,
    esDestacada: row.featured,
    isPublished: row.is_published
  };
}

/* toDatabase: hago lo inverso de fromDatabase: tomo los valores del
   formulario (con nombres en español) y los convierto al formato de
   columnas que espera la tabla 'news' en Supabase.
   - Recorto espacios con trim() para evitar datos sucios.
   - Convierto esDestacada a booleano (el checkbox puede no estar marcado).
   - is_published siempre lo mando en true para que la noticia sea pública. */
function toDatabase(values) {
  return {
    title: values.titulo.trim(),
    category: values.categoria,
    description: values.descripcionCorta.trim(),
    content: values.contenidoCompleto.trim(),
    image_url: values.imagen.trim(),
    featured: Boolean(values.esDestacada),
    is_published: true
  };
}

/* owns: verifico si una noticia pertenece al usuario actualmente conectado.
   Comparo el ownerId de la noticia con el id de la sesión.
   Lo uso para decidir si el usuario puede editar o eliminar esa publicación. */
function owns(news) { return Boolean(state.session && news.ownerId && news.ownerId === state.session.user.id); }

/* isFavorite: reviso si un id de noticia ya está en el arreglo de favoritos
   del usuario conectado. Lo uso para pintar el botón ★ o ☆. */
function isFavorite(id) { return state.favorites.some(item => normalizeId(item) === normalizeId(id)); }

/* getNews: busco una noticia por su id dentro del arreglo state.news.
   Lo uso principalmente en la vista de detalle. */
function getNews(id) { return state.news.find(item => normalizeId(item.id) === normalizeId(id)); }

/* articleParagraphs: tomo el contenido completo de una noticia (que puede
   tener varios párrafos separados por saltos de línea) y genero etiquetas
   <p> para cada uno. Importante: escapo el texto con escapeHtml() antes
   de insertarlo, así nunca renderizo HTML no confiable. */
function articleParagraphs(content) {
  return String(content || '').split(/\n+/).filter(Boolean).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('');
}

/* friendlyError: convierto un error técnico de Supabase en un mensaje
   amable para el usuario. Nunca muestro el error original al usuario
   porque contiene detalles internos de la base de datos.
   - Si el código es '23505' (violación de unicidad), digo "ya existe".
   - Para todo lo demás, devuelvo un mensaje genérico.
   El detalle sí lo imprimo en consola para depuración. */
function friendlyError(error, fallback = 'No se pudo completar la operación.') {
  console.error(fallback, error);
  return error?.code === '23505' ? 'Ese registro ya existe.' : fallback;
}

/* ==================================================================
   SECCIÓN 2: Plantilla común y router
   ==================================================================
   Aquí construyo la estructura HTML base (header, footer, contenedor)
   y el router que cambia de vista según el hash de la URL.
   ================================================================== */

/* renderShell: dibujo el esqueleto de la página: encabezado con logo y
   navegación, contenedor principal (main), pie de página y región de
   notificaciones (toast). Al final llamo a renderAccount() para mostrar
   el estado de la sesión del usuario. */
function renderShell() {
  byId('app').innerHTML = `<header class="site-header"><div class="container header-inner"><a class="brand" href="#home" aria-label="VibeWire, ir al inicio"><span class="brand-mark">//</span><span>Vibe<strong>Wire</strong></span></a><button class="menu-button" id="menu-button" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="Abrir menú">☰</button><nav class="main-nav" id="main-nav" aria-label="Navegación principal"><a href="#home" data-route="home">Inicio</a><a href="#noticias" data-route="noticias">Noticias</a><a href="#favoritos" data-route="favoritos">Favoritos</a><a href="#crear" data-route="crear">Crear noticia</a><a href="#contacto" data-route="contacto">Contacto</a></nav><div id="account-area"></div></div></header><main class="container" id="main-content" tabindex="-1"></main><footer class="site-footer"><div class="container footer-grid"><div><a class="brand" href="#home"><span class="brand-mark">//</span><span>Vibe<strong>Wire</strong></span></a><p class="muted" style="margin-top:10px;max-width:270px">Noticias para quienes diseñan, programan y construyen el futuro.</p></div><div><h3>EXPLORAR</h3><div class="footer-links"><a href="#home">Inicio</a><a href="#noticias">Noticias</a><a href="#favoritos">Favoritos</a></div></div><div><h3>PARTICIPAR</h3><div class="footer-links"><a href="#crear">Crear noticia</a><a href="#contacto">Contacto</a></div></div><div><h3>SEÑAL SEMANAL</h3><p class="muted" style="font-size:13px">Un envío editorial. Cero ruido.</p></div></div><div class="container footer-copy mono">© 2026 VibeWire / HECHO CON CURIOSIDAD</div></footer><div class="toast-region" id="toast-region" aria-live="polite" aria-atomic="true"></div>`;
  renderAccount();
}

/* renderAccount: muestro el correo del usuario conectado con un botón
   de cerrar sesión, o un botón de "Acceder" si no hay sesión.
   Lo llamo cada vez que cambia el estado de autenticación. */
function renderAccount() {
  const area = byId('account-area'); if (!area) return;
  area.innerHTML = state.session
    ? `<div class="account-menu"><span class="account-email" title="${escapeHtml(state.session.user.email)}">${escapeHtml(state.session.user.email)}</span><button class="button secondary small" type="button" data-signout>Cerrar sesión</button></div>`
    : '<a class="button secondary small" href="#auth">Acceder</a>';
}

/* newsCard: genero el HTML de una tarjeta de noticia individual.
   - Muestro la imagen con alt descriptivo para accesibilidad.
   - Pongo la categoría como etiqueta flotante.
   - El botón de favorito cambia entre ★ y ☆ según isFavorite().
   - El enlace "Leer artículo" lleva al detalle con hash #detalle/<id>. */
function newsCard(news) {
  const favorite = isFavorite(news.id);
  return `<article class="news-card"><div class="card-media"><img src="${escapeHtml(news.imagen)}" alt="${escapeHtml(news.titulo)}" loading="lazy"><span class="eyebrow card-category">${escapeHtml(news.categoria)}</span><button class="favorite-button ${favorite ? 'is-favorite' : ''}" type="button" data-favorite="${news.id}" aria-label="${favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}" aria-pressed="${favorite}">${favorite ? '★' : '☆'}</button></div><div class="card-body"><small class="card-meta">${formatDate(news.fecha)} · ${escapeHtml(news.autor)}</small><h3>${escapeHtml(news.titulo)}</h3><p>${escapeHtml(news.descripcionCorta)}</p><a class="text-link" href="#detalle/${news.id}">Leer artículo →</a></div></article>`;
}

/* renderCards: pinto una lista de tarjetas en un contenedor, o muestro
   un mensaje de estado vacío si no hay resultados. */
function renderCards(target, news, emptyMessage) {
  target.innerHTML = news.length ? news.map(newsCard).join('') : `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
}

/* route: mi router basado en hash. Se ejecuta cada vez que cambia
   location.hash (el texto después del # en la URL).
   - Divido el hash en partes: ej: "#detalle/3" → ['detalle', '3'].
   - Si la ruta no existe en ROUTES, envío a 'home'.
   - Marco el enlace de navegación activo.
   - Cierro el menú móvil si estaba abierto.
   - Llamo a renderView() con el nombre de la ruta y los parámetros. */
function route() {
  const parts = location.hash.slice(1).split('/');
  const routeName = ROUTES.includes(parts[0]) ? parts[0] : 'home';
  const main = byId('main-content');
  /* Marco el enlace activo: si estoy en 'detalle', activo 'noticias'. */
  document.querySelectorAll('[data-route]').forEach(link => link.classList.toggle('active', link.dataset.route === (routeName === 'detalle' ? 'noticias' : routeName)));
  /* Cierro el menú desplegable móvil. */
  byId('main-nav').classList.remove('open');
  byId('menu-button').setAttribute('aria-expanded', 'false');
  /* Aplico la animación de entrada de vista y renderizo. */
  main.className = 'container view-enter';
  renderView(routeName, parts[1], parts[2]);
  /* Desplazo al inicio de la página y doy foco al contenedor. */
  window.scrollTo({ top: 0, behavior: 'smooth' });
  main.focus({ preventScroll: true });
}

/* renderView: recibo el nombre de la ruta y los parámetros, y llamo
   a la función de render correspondiente.
   - parameter: suele ser el id de la noticia (para detalle) o el modo
     de autenticación (para auth).
   - returnTo: ruta a la que volver después de iniciar sesión. */
function renderView(routeName, parameter, returnTo) {
  const views = { home: renderHome, noticias: renderNews, detalle: renderDetail, favoritos: renderFavorites, crear: renderManager, contacto: renderContact, auth: renderAuth };
  views[routeName](parameter, returnTo);
}

/* ==================================================================
   SECCIÓN 3: Carga remota y vistas públicas
   ==================================================================
   Aquí cargo los datos desde Supabase y construyo las vistas que
   cualquier visitante puede ver sin iniciar sesión.
   ================================================================== */

/* loadRemoteData: consulto todas las noticias y los favoritos del
   usuario desde Supabase.
   - Primero pido las noticias ordenadas por fecha descendente.
   - Si hay sesión, pido también los favoritos del usuario.
   - Si no hay sesión, vacío el arreglo de favoritos.
   - Si hay error cargando noticias, muestro un toast pero no rompo
     la app: el catálogo local sigue disponible. */
async function loadRemoteData() {
  state.loading = true;
  const newsResult = await supabase.from('news').select('id, owner_id, title, category, description, content, image_url, published_at, featured, is_published').order('published_at', { ascending: false });
  /* Si la consulta salió bien, reemplazo el catálogo local con los datos reales. */
  if (!newsResult.error && Array.isArray(newsResult.data)) state.news = newsResult.data.map(fromDatabase);
  /* Si hay sesión, cargo los favoritos del usuario desde la base. */
  if (state.session) {
    const favoritesResult = await supabase.from('favorites').select('news_id');
    if (!favoritesResult.error) state.favorites = favoritesResult.data.map(item => item.news_id);
  } else state.favorites = [];
  state.loading = false;
  if (newsResult.error) toast('No se pudo cargar el catálogo. Mostramos la última versión disponible.', 'error');
}

/* renderHome: dibujo la portada de la aplicación.
   - Busco la noticia destacada (esDestacada = true) o uso la primera.
   - Ordeno las noticias por fecha y tomo las 6 más recientes.
   - La sección hero tiene dos columnas: texto introductorio y la
     tarjeta de la noticia destacada con imagen.
   - Debajo muestro la cuadrícula de "Lo más reciente". */
function renderHome() {
  const news = state.news;
  const featured = news.find(item => item.esDestacada) || news[0];
  const recent = [...news].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);
  byId('main-content').innerHTML = `<section aria-labelledby="home-title"><div class="hero"><div class="hero-copy"><span class="eyebrow">EDICIÓN 42 · SEP 2026</span><h1 id="home-title" style="margin-top:14px">Ideas que ya están <em>compilando</em> el futuro.</h1><p>Noticias y análisis sobre inteligencia artificial, desarrollo y cultura maker para quienes convierten ideas en productos.</p><div class="hero-actions"><a class="button" href="#noticias">Explorar noticias</a><a class="button secondary" href="#crear">Crear noticia</a></div></div>${featured ? `<article class="hero-card"><img src="${escapeHtml(featured.imagen)}" alt="${escapeHtml(featured.titulo)}"><div class="hero-card-content"><span class="eyebrow green">Destacado</span><h2>${escapeHtml(featured.titulo)}</h2><p>${escapeHtml(featured.descripcionCorta)}</p><a class="text-link" href="#detalle/${featured.id}">Leer artículo →</a></div></article>` : '<div class="empty-state">Aún no hay noticias.</div>'}</div><div class="section-header"><h2>Lo más reciente</h2><a class="button secondary small" href="#noticias">Ver todas</a></div><div class="news-grid">${recent.map(newsCard).join('')}</div></section>`;
}

/* renderNews: dibujo el archivo editorial con búsqueda, filtros por
   categoría y paginación.
   - Filtro por categoría (si no es 'Todas').
   - Filtro por texto de búsqueda (busco en título, descripción y autor).
   - Ordeno por fecha descendente.
   - Calculo cuántas páginas hay y corto el arreglo a la página actual.
   - Renderizo las tarjetas, la paginación y conecto los eventos. */
function renderNews() {
  const filtered = state.news.filter(news => (state.category === 'Todas' || news.categoria === state.category) && (!state.query || `${news.titulo} ${news.descripcionCorta} ${news.autor}`.toLowerCase().includes(state.query.toLowerCase()))).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const slice = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
  byId('main-content').innerHTML = `<section aria-labelledby="news-title"><div class="page-heading"><span class="eyebrow">ARCHIVO EDITORIAL</span><h1 id="news-title">Noticias para gente que construye.</h1><p>Explora señales sobre tecnología, IA y las herramientas que están cambiando la forma de crear.</p></div><div class="filters"><input class="field-control" id="search-input" type="search" value="${escapeHtml(state.query)}" placeholder="Buscar por palabra clave..." aria-label="Buscar noticias"><select class="field-control" id="category-select" aria-label="Filtrar por categoría"><option>Todas</option>${CATEGORIES.map(category => `<option ${state.category === category ? 'selected' : ''}>${category}</option>`).join('')}</select></div><p class="muted mono" style="margin-bottom:16px">${filtered.length} RESULTADO${filtered.length === 1 ? '' : 'S'}</p><div class="news-grid" id="news-grid"></div><div class="pagination" id="pagination" aria-label="Paginación"></div></section>`;
  /* Pinto las tarjetas de la página actual y los botones de paginación. */
  renderCards(byId('news-grid'), slice, 'No hay noticias que coincidan con tu búsqueda.');
  renderPagination(pages);
  /* Conecto los eventos de búsqueda y cambio de categoría.
     Cada vez que cambian, reinicio a página 1 y vuelvo a renderizar. */
  byId('search-input').addEventListener('input', event => { state.query = event.target.value; state.page = 1; renderNews(); });
  byId('category-select').addEventListener('change', event => { state.category = event.target.value; state.page = 1; renderNews(); });
}

/* renderPagination: dibujo los botones de paginación si hay más de
   una página. Cada botón tiene data-page con su número. */
function renderPagination(pages) {
  const target = byId('pagination'); if (pages < 2) { target.innerHTML = ''; return; }
  target.innerHTML = Array.from({ length: pages }, (_, index) => `<button type="button" class="${state.page === index + 1 ? 'active' : ''}" data-page="${index + 1}" aria-label="Página ${index + 1}" aria-current="${state.page === index + 1 ? 'page' : 'false'}">${index + 1}</button>`).join('');
}

/* renderDetail: dibujo el artículo completo de una noticia.
   - Busco la noticia por id. Si no existe, muestro un mensaje.
   - Muestro la categoría, título, autor, fecha y un botón de favorito.
   - El contenido se renderiza como párrafos seguros (con escapeHtml).
   - Al final muestro hasta 3 noticias relacionadas de la misma categoría. */
function renderDetail(id) {
  const news = getNews(id);
  if (!news) { byId('main-content').innerHTML = '<div class="empty-state">No encontramos esa noticia. <a class="text-link" href="#noticias">Volver al archivo</a></div>'; return; }
  const related = state.news.filter(item => item.id !== news.id && item.categoria === news.categoria).slice(0, 3);
  byId('main-content').innerHTML = `<article class="article"><a class="back-link" href="#noticias">← Volver a noticias</a><span class="eyebrow">${escapeHtml(news.categoria)}</span><h1>${escapeHtml(news.titulo)}</h1><div class="article-meta"><span>${escapeHtml(news.autor)}</span><span>·</span><span>${formatDate(news.fecha)}</span><button class="button secondary small" type="button" data-favorite="${news.id}" aria-pressed="${isFavorite(news.id)}">${isFavorite(news.id) ? '★ Guardado' : '☆ Guardar en favoritos'}</button></div><img class="article-cover" src="${escapeHtml(news.imagen)}" alt="${escapeHtml(news.titulo)}"><div class="article-copy">${articleParagraphs(news.contenidoCompleto)}</div>${related.length ? `<section class="related" aria-labelledby="related-title"><div class="section-header"><h2 id="related-title">Noticias relacionadas</h2></div><div class="news-grid">${related.map(newsCard).join('')}</div></section>` : ''}</article>`;
}

/* renderFavorites: dibujo la biblioteca privada de favoritos del usuario.
   - Si no hay sesión, redirijo a la pantalla de login con returnTo='favoritos'.
   - Filtro las noticias que están en el arreglo de favoritos. */
function renderFavorites() {
  if (!state.session) { renderAuth('login', 'favorites'); return; }
  const favorites = state.news.filter(news => isFavorite(news.id));
  byId('main-content').innerHTML = `<section aria-labelledby="favorites-title"><div class="page-heading"><span class="eyebrow green">TU BIBLIOTECA</span><h1 id="favorites-title">Favoritos.</h1><p>${favorites.length} lectura${favorites.length === 1 ? '' : 's'} guardada${favorites.length === 1 ? '' : 's'} para volver cuando quieras.</p></div><div class="news-grid" id="favorites-grid"></div></section>`;
  renderCards(byId('favorites-grid'), favorites, 'Aún no tienes favoritos. Pulsa ☆ en una noticia para guardarla.');
}

/* ==================================================================
   SECCIÓN 4: Autenticación
   ==================================================================
   Aquí manejo el registro, inicio de sesión y cierre de sesión
   usando Supabase Auth con correo y contraseña.
   ================================================================== */

/* renderAuth: dibujo la pantalla de acceso o registro.
   - mode: 'login' para iniciar sesión, 'register' para crear cuenta.
   - returnTo: ruta a la que redirigir después de un login exitoso.
   - El formulario tiene validación del lado del cliente (novalidate).
   - El enlace inferior permite alternar entre login y registro. */
function renderAuth(mode = 'login', returnTo = '') {
  const register = mode === 'register';
  byId('main-content').innerHTML = `<section class="auth-page" aria-labelledby="auth-title"><div class="auth-card"><span class="eyebrow">VIBEWIRE ALFA</span><h1 id="auth-title">${register ? 'Crea tu cuenta.' : 'Vuelve a la señal.'}</h1><p class="muted">${register ? 'Publica, guarda y gestiona tus lecturas desde cualquier dispositivo.' : 'Inicia sesión para publicar noticias y conservar tus favoritos.'}</p><form id="auth-form" class="form-card" novalidate><div class="field"><label for="auth-email">Correo electrónico</label><input class="field-control" id="auth-email" name="email" type="email" autocomplete="email" required><div class="field-error" id="auth-email-error" role="alert"></div></div><div class="field"><label for="auth-password">Contraseña</label><input class="field-control" id="auth-password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="6" required><div class="field-error" id="auth-password-error" role="alert"></div></div><button class="button" type="submit">${register ? 'Crear cuenta' : 'Iniciar sesión'}</button></form><p class="auth-switch">${register ? '¿Ya tienes una cuenta?' : '¿Aún no tienes cuenta?'} <a href="#auth/${register ? 'login' : 'register'}${returnTo ? `/${returnTo}` : ''}">${register ? 'Inicia sesión' : 'Regístrate'}</a></p></div></section>`;
  const form = byId('auth-form');
  form.addEventListener('submit', event => handleAuthSubmit(event, register, returnTo));
}

/* handleAuthSubmit: proceso el envío del formulario de acceso o registro.
   - Primero valido el correo con una expresión regular básica.
   - Luego valido que la contraseña tenga al menos 6 caracteres.
   - Si las validaciones pasan, llamo a signUp o signInWithPassword.
   - Si hay error, muestro un toast con un mensaje neutro (nunca revelo
     si el correo existe o no, para evitar fugas de información).
   - Si el registro exitoso no devuelve sesión, Supabase requiere
     confirmación por correo.
   - Si todo sale bien, redirijo a la ruta de retorno o al inicio. */
async function handleAuthSubmit(event, register, returnTo) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const emailError = byId('auth-email-error');
  const passwordError = byId('auth-password-error');
  /* Validación del lado del cliente: correo con formato válido. */
  emailError.textContent = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? '' : 'Introduce un correo válido.';
  /* Validación del lado del cliente: contraseña de al menos 6 caracteres. */
  passwordError.textContent = password.length >= 6 ? '' : 'Usa al menos 6 caracteres.';
  if (emailError.textContent || passwordError.textContent) return;
  /* Llamo a la API de Supabase Auth según el modo. */
  const result = register ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) { toast(register ? 'No pudimos completar el registro. Revisa los datos e inténtalo de nuevo.' : 'No pudimos iniciar sesión. Revisa tu correo y contraseña.', 'error'); return; }
  /* Si es registro y no hay sesión, Supabase puede requerir confirmación por correo. */
  if (register && !result.data.session) { toast('Cuenta creada. Revisa tu correo para confirmar el acceso.', 'success'); return; }
  toast(register ? 'Cuenta creada correctamente.' : 'Sesión iniciada.', 'success');
  location.hash = returnTo ? `#${returnTo}` : '#home';
}

/* signOut: cierro la sesión actual.
   - Llamo a supabase.auth.signOut().
   - Limpio el estado local (session y favorites).
   - Vuelvo a renderizar el área de cuenta y recargo los datos.
   - Redirijo al inicio y muestro un toast de confirmación. */
async function signOut() {
  const result = await supabase.auth.signOut();
  if (result.error) { toast('No pudimos cerrar la sesión.', 'error'); return; }
  state.session = null;
  state.favorites = [];
  renderAccount();
  await loadRemoteData();
  location.hash = '#home';
  toast('Sesión cerrada.', 'success');
}

/* ==================================================================
   SECCIÓN 5: Formularios y publicaciones
   ==================================================================
   Aquí manejo la creación, edición y eliminación de noticias,
   incluyendo validación en tiempo real y confirmación de borrado.
   ================================================================== */

/* newsRules: devuelvo un objeto con las reglas de validación para cada
   campo del formulario de noticias. Cada regla tiene:
   - test: función que recibe el campo y devuelve true/false.
   - message: mensaje de error si la validación falla. */
function newsRules() {
  return {
    titulo: { test: field => field.value.trim().length >= 5, message: 'Escribe un título de al menos 5 caracteres.' },
    autor: { test: field => field.value.trim().length >= 3, message: 'Indica un autor de al menos 3 caracteres.' },
    categoria: { test: field => Boolean(field.value), message: 'Selecciona una categoría.' },
    imagen: { test: field => validImageUrl(field.value.trim()), message: 'Introduce una URL http o https válida.' },
    descripcionCorta: { test: field => field.value.trim().length >= 10 && field.value.trim().length <= 160, message: 'Usa entre 10 y 160 caracteres.' },
    contenidoCompleto: { test: field => field.value.trim().length >= 30, message: 'El contenido debe tener al menos 30 caracteres.' }
  };
}

/* validImageUrl: verifico que una URL tenga protocolo http o https.
   Uso el constructor URL() que lanza una excepción si la URL no es
   válida, por eso lo envuelvo en try/catch. */
function validImageUrl(value) { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } }

/* validateField: actualizo la apariencia visual de un campo según si
   pasa o no la validación.
   - Añado la clase 'is-invalid' o 'is-valid' al grupo (.field).
   - Marca aria-invalid para lectores de pantalla.
   - Muestro el mensaje de error debajo del campo.
   - Devuelvo true/false para que el llamador pueda acumular resultados. */
function validateField(field, valid, message) {
  const group = field.closest('.field');
  const error = group.querySelector('.field-error');
  group.classList.toggle('is-invalid', !valid);
  group.classList.toggle('is-valid', valid);
  field.setAttribute('aria-invalid', String(!valid));
  error.textContent = valid ? '' : message;
  return valid;
}

/* setupLiveValidation: conecto los eventos 'input' y 'blur' a cada
   campo del formulario para validar en tiempo real.
   - Por cada regla, busco el campo por su nombre (name).
   - Cada vez que el usuario escribe o sale del campo, valido. */
function setupLiveValidation(form, rules) {
  Object.entries(rules).forEach(([name, rule]) => {
    const field = form.elements.namedItem(name);
    const validate = () => validateField(field, rule.test(field), rule.message);
    field.addEventListener('input', validate);
    field.addEventListener('blur', validate);
  });
}

/* newsForm: genero el HTML del formulario de creación o edición.
   - Si recibo una noticia (editing), precargo sus valores.
   - Si no, genero campos vacíos para una nueva publicación.
   - El checkbox "esDestacada" permite marcar la noticia como destacada. */
function newsForm(news) {
  const editing = Boolean(news);
  return `<form class="form-card" id="news-form" novalidate><div class="field-grid"><div class="field"><label for="news-title">Título *</label><input class="field-control" id="news-title" name="titulo" value="${escapeHtml(news?.titulo || '')}" required><div class="field-error" role="alert"></div></div><div class="field"><label for="news-author">Autor *</label><input class="field-control" id="news-author" name="autor" value="${escapeHtml(news?.autor || '')}" required><div class="field-error" role="alert"></div></div></div><div class="field-grid"><div class="field"><label for="news-category">Categoría *</label><select class="field-control" id="news-category" name="categoria" required><option value="">Selecciona una categoría</option>${CATEGORIES.map(category => `<option ${news?.categoria === category ? 'selected' : ''}>${category}</option>`).join('')}</select><div class="field-error" role="alert"></div></div><div class="field"><label for="news-image">Imagen de portada (URL) *</label><input class="field-control" id="news-image" name="imagen" type="url" value="${escapeHtml(news?.imagen || '')}" placeholder="https://..." required><div class="field-error" role="alert"></div></div></div><div class="field"><label for="news-description">Descripción breve * <span class="muted">(10 a 160 caracteres)</span></label><textarea class="field-control" id="news-description" name="descripcionCorta" maxlength="160" required>${escapeHtml(news?.descripcionCorta || '')}</textarea><div class="field-error" role="alert"></div></div><div class="field"><label for="news-content">Contenido completo *</label><textarea class="field-control" id="news-content" name="contenidoCompleto" rows="7" required>${escapeHtml(news?.contenidoCompleto || '')}</textarea><div class="field-error" role="alert"></div></div><label class="check-row field"><input type="checkbox" name="esDestacada" ${news?.esDestacada ? 'checked' : ''}><span>Marcar como noticia destacada</span></label><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="button" type="submit">${editing ? 'Guardar cambios' : 'Publicar noticia'}</button>${editing ? '<a class="button secondary" href="#crear">Cancelar edición</a>' : ''}</div></form>`;
}

/* renderManager: dibujo el panel privado de autor.
   - Si no hay sesión, redirijo al login con returnTo='crear'.
   - Si estoy editando, verifico que la noticia sea del usuario conectado.
   - Muestro el formulario de creación/edición a la izquierda.
   - A la derecha muestro un panel de ayuda.
   - Debajo muestro la tabla con las publicaciones del usuario, con
     botones de editar y eliminar.
   - Si hay una eliminación pendiente, muestro la caja de confirmación. */
function renderManager() {
  if (!state.session) { renderAuth('login', 'crear'); return; }
  const editing = state.editingId ? getNews(state.editingId) : null;
  /* Si la noticia que se quiere editar no pertenece al usuario, cancelo. */
  if (editing && !owns(editing)) { state.editingId = null; renderManager(); return; }
  const ownNews = state.news.filter(owns);
  byId('main-content').innerHTML = `<section aria-labelledby="manager-title"><div class="page-heading"><span class="eyebrow">PANEL DE AUTOR</span><h1 id="manager-title">${editing ? 'Edita una señal.' : 'Publica una nueva señal.'}</h1><p>${editing ? 'Actualiza los datos de tu noticia y mantén una publicación consistente.' : 'Comparte una historia con la comunidad que está construyendo el futuro.'}</p></div><div class="form-layout">${newsForm(editing)}<aside class="side-card"><h3>${editing ? 'Modo edición' : 'Antes de publicar'}</h3><ul><li>Usa un título claro y específico.</li><li>La descripción aparece en las tarjetas.</li><li>Las URLs deben comenzar por http o https.</li><li>Solo tú podrás modificar esta publicación.</li></ul></aside></div><section class="manage-card" aria-labelledby="manage-title"><div class="manage-header"><h2 id="manage-title">Tus publicaciones</h2><span class="eyebrow green">${ownNews.length} visibles</span></div>${state.pendingDelete ? `<div class="confirm-box" role="alert"><span>¿Eliminar “${escapeHtml(getNews(state.pendingDelete)?.titulo || '')}”?</span><span class="confirm-actions"><button class="button secondary small" type="button" data-cancel-delete>Cancelar</button><button class="button danger small" type="button" data-confirm-delete>Eliminar</button></span></div>` : ''}<div class="table-wrap"><table class="manage-table"><thead><tr><th>Noticia</th><th>Categoría</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>${ownNews.length ? ownNews.map(item => `<tr><td>${escapeHtml(item.titulo)}</td><td>${escapeHtml(item.categoria)}</td><td>${formatDate(item.fecha)}</td><td><div class="manage-actions"><button class="button secondary small" type="button" data-edit="${item.id}">Editar</button><button class="button danger small" type="button" data-request-delete="${item.id}">Eliminar</button></div></td></tr>`).join('') : '<tr><td colspan="4" class="muted">Todavía no tienes publicaciones.</td></tr>'}</tbody></table></div></section></section>`;
  /* Conecto la validación en vivo y el evento de envío del formulario. */
  const form = byId('news-form');
  setupLiveValidation(form, newsRules());
  form.addEventListener('submit', handleNewsSubmit);
}

/* readNewsForm: leo los valores del formulario y convierto el checkbox
   'esDestacada' a un booleano (FormData no distingue unchecked/checked). */
function readNewsForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  data.esDestacada = form.elements.namedItem('esDestacada').checked;
  return data;
}

/* handleNewsSubmit: guardo una noticia nueva o actualizo una existente.
   - Primero valido todos los campos con las reglas de newsRules().
   - Si algún campo falla, muestro un toast y detengo el envío.
   - Convierto los valores al formato de la base de datos con toDatabase().
   - Si state.editingId tiene valor, hago UPDATE; si no, hago INSERT.
   - Uso .maybeSingle() porque espero 0 o 1 fila.
   - Si hay error, muestro un mensaje neutro con friendlyError().
   - Si todo sale bien, limpio editingId, recargo los datos y redirijo. */
async function handleNewsSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = readNewsForm(form);
  const rules = newsRules();
  /* Valido todos los campos y verifico que todos pasen. */
  const valid = Object.entries(rules).map(([name, rule]) => validateField(form.elements.namedItem(name), rule.test(form.elements.namedItem(name)), rule.message)).every(Boolean);
  if (!valid) { toast('Revisa los campos marcados.', 'error'); return; }
  const payload = toDatabase(values);
  /* Si estoy editando, hago UPDATE; si no, INSERT. */
  const result = state.editingId
    ? await supabase.from('news').update(payload).eq('id', state.editingId).select('id, owner_id, title, category, description, content, image_url, published_at, featured, is_published').maybeSingle()
    : await supabase.from('news').insert(payload).select('id, owner_id, title, category, description, content, image_url, published_at, featured, is_published').maybeSingle();
  if (result.error || !result.data) { toast(friendlyError(result.error, 'No se pudo guardar la noticia.'), 'error'); return; }
  state.editingId = null;
  await loadRemoteData();
  toast('Noticia guardada correctamente.', 'success');
  location.hash = '#crear';
}

/* confirmDelete: elimino una noticia propia después de que el usuario
   confirmó la acción.
   - Uso state.pendingDelete que guardé cuando el usuario pulsó "Eliminar".
   - Si hay error, muestro un mensaje neutro.
   - Si todo sale bien, limpio pendingDelete, recargo datos y re-renderizo. */
async function confirmDelete() {
  if (!state.pendingDelete) return;
  const result = await supabase.from('news').delete().eq('id', state.pendingDelete);
  if (result.error) { toast(friendlyError(result.error, 'No se pudo eliminar la noticia.'), 'error'); return; }
  state.pendingDelete = null;
  await loadRemoteData();
  renderManager();
  toast('Noticia eliminada.', 'success');
}

/* ==================================================================
   SECCIÓN 6: Contacto y favoritos
   ==================================================================
   El formulario de contacto guarda mensajes en la base de datos.
   Los favoritos se sincronizan con la cuenta del usuario.
   ================================================================== */

/* contactRules: reglas de validación para el formulario de contacto.
   - nombre: al menos 3 caracteres.
   - email: formato de correo válido.
   - asunto: debe tener un valor seleccionado.
   - mensaje: al menos 10 caracteres.
   - acepto: el checkbox de consentimiento debe estar marcado. */
function contactRules() {
  return {
    nombre: { test: field => field.value.trim().length >= 3, message: 'Escribe tu nombre completo.' },
    email: { test: field => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(field.value.trim()), message: 'Introduce un correo válido.' },
    asunto: { test: field => Boolean(field.value), message: 'Selecciona un asunto.' },
    mensaje: { test: field => field.value.trim().length >= 10, message: 'Escribe al menos 10 caracteres.' },
    acepto: { test: field => field.checked, message: 'Debes aceptar el uso de tus datos.' }
  };
}

/* renderContact: dibujo el formulario de contacto.
   - Campos para nombre, correo, asunto (select), mensaje y checkbox.
   - Conecto la validación en vivo y el evento de envío. */
function renderContact() {
  byId('main-content').innerHTML = `<section aria-labelledby="contact-title"><div class="page-heading"><span class="eyebrow">CANAL ABIERTO</span><h1 id="contact-title">Conversemos.</h1><p>Envíanos una historia, una corrección o una propuesta editorial.</p></div><div class="form-layout"><form class="form-card" id="contact-form" novalidate><div class="field-grid"><div class="field"><label for="contact-name">Nombre *</label><input class="field-control" id="contact-name" name="nombre" autocomplete="name" required><div class="field-error" role="alert"></div></div><div class="field"><label for="contact-email">Correo electrónico *</label><input class="field-control" id="contact-email" name="email" type="email" autocomplete="email" required><div class="field-error" role="alert"></div></div></div><div class="field"><label for="contact-subject">Asunto *</label><select class="field-control" id="contact-subject" name="asunto" required><option value="">Selecciona un motivo</option><option>Proponer una historia</option><option>Corrección</option><option>Otro</option></select><div class="field-error" role="alert"></div></div><div class="field"><label for="contact-message">Mensaje *</label><textarea class="field-control" id="contact-message" name="mensaje" rows="6" required></textarea><div class="field-error" role="alert"></div></div><label class="check-row field"><input type="checkbox" name="acepto" required><span>Acepto el uso de mis datos para responder mi consulta. *</span><div class="field-error" role="alert"></div></label><button class="button" type="submit">Enviar mensaje</button></form><aside class="side-card"><span class="eyebrow green">RESPUESTA HUMANA</span><h3 style="margin-top:14px">Una señal bien contada merece espacio.</h3><p class="muted" style="margin-top:10px;font-size:13px">Cuéntanos qué estás construyendo. Guardaremos tu mensaje de forma segura.</p></aside></div></section>`;
  const form = byId('contact-form');
  const rules = contactRules();
  setupLiveValidation(form, rules);
  form.addEventListener('submit', event => handleContactSubmit(event, rules));
}

/* handleContactSubmit: valido y envío el mensaje de contacto.
   - Valido todos los campos con las reglas de contactRules().
   - Si algún campo falla, muestro un toast y detengo el envío.
   - Inserto el mensaje en la tabla 'contact_messages'.
   - Solo envío los campos que el usuario escribió (name, email, subject,
     message). El owner_id y el status los controla la base de datos.
   - Si todo sale bien, reemplazo el formulario con una tarjeta de éxito. */
async function handleContactSubmit(event, rules) {
  event.preventDefault();
  const form = event.currentTarget;
  const valid = Object.entries(rules).map(([name, rule]) => validateField(form.elements.namedItem(name), rule.test(form.elements.namedItem(name)), rule.message)).every(Boolean);
  if (!valid) { toast('Revisa los campos marcados.', 'error'); return; }
  const values = Object.fromEntries(new FormData(form).entries());
  const result = await supabase.from('contact_messages').insert({ name: values.nombre.trim(), email: values.email.trim(), subject: values.asunto, message: values.mensaje.trim() });
  if (result.error) { toast(friendlyError(result.error, 'No se pudo enviar el mensaje.'), 'error'); return; }
  /* Reemplazo el formulario con una confirmación visual. */
  const name = escapeHtml(values.nombre.trim());
  const email = escapeHtml(values.email.trim());
  form.outerHTML = `<div class="success-card" role="status"><h2>Gracias, ${name}.</h2><p class="muted">Recibimos tu mensaje y responderemos a ${email} en 1-2 días hábiles.</p><a class="button secondary small" style="margin-top:16px" href="#home">Volver al inicio</a></div>`;
  toast('Mensaje enviado correctamente.', 'success');
}

/* toggleFavorite: añado o quito una noticia de favoritos.
   - Si no hay sesión, redirijo al login con returnTo='favoritos'.
   - Si la noticia ya es favorito, la elimino con .delete().
   - Si no es favorito, la inserto con .insert({ news_id }).
   - La columna user_id la llena automáticamente auth.uid() en la base.
   - Después recargo los datos y re-renderizo la vista actual. */
async function toggleFavorite(id, source) {
  if (!state.session) { toast('Inicia sesión para guardar favoritos.', 'error'); location.hash = '#auth/login/favoritos'; return; }
  const normalized = normalizeId(id);
  const result = isFavorite(normalized)
    ? await supabase.from('favorites').delete().eq('news_id', normalized).eq('user_id', state.session.user.id)
    : await supabase.from('favorites').insert({ news_id: normalized });
  if (result.error) { toast(friendlyError(result.error, 'No se pudo actualizar favoritos.'), 'error'); return; }
  await loadRemoteData();
  source?.classList.add('pulse');
  toast(isFavorite(normalized) ? 'Guardado en favoritos.' : 'Quitado de favoritos.', 'success');
  /* Re-renderizo la vista actual para reflejar el cambio visual. */
  const parts = location.hash.slice(1).split('/');
  renderView(parts[0] || 'home', parts[1], parts[2]);
}

/* ==================================================================
   SECCIÓN 7: Notificaciones, eventos y arranque
   ==================================================================
   Aquí centralized las notificaciones visuales (toasts), el manejador
   global de clics y el arranque de la aplicación.
   ================================================================== */

/* toast: muestro una notificación temporal en la esquina inferior
   derecha.
   - message: texto a mostrar.
   - type: 'info', 'success' o 'error' (cambia el color del borde).
   - La notificación desaparece sola después de 3.6 segundos.
   - También tiene un botón para cerrarla manualmente. */
function toast(message, type = 'info') {
  const region = byId('toast-region'); if (!region) return;
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" aria-label="Cerrar notificación">×</button>`;
  item.querySelector('button').addEventListener('click', () => item.remove());
  region.appendChild(item);
  window.setTimeout(() => item.remove(), 3600);
}

/* Manejador global de clics: como las vistas se generan dinámicamente,
   no puedo asignar eventos a botones individuales. En su lugar, uso
   delegación de eventos en document.
   - data-favorite: botón de favorito en una tarjeta o artículo.
   - data-page: botón de paginación.
   - data-edit: botón de editar una publicación propia.
   - data-request-delete: botón que inicia la confirmación de borrado.
   - data-confirm-delete: botón que confirma el borrado.
   - data-cancel-delete: botón que cancela el borrado.
   - data-signout: botón de cerrar sesión.
   - #menu-button: botón del menú móvil. */
document.addEventListener('click', event => {
  const target = event.target.closest('[data-favorite],[data-page],[data-edit],[data-request-delete],[data-confirm-delete],[data-cancel-delete],[data-signout],#menu-button');
  if (!target) return;
  /* Menú móvil: abro/cierro el panel de navegación. */
  if (target.id === 'menu-button') { const nav = byId('main-nav'); const open = nav.classList.toggle('open'); target.setAttribute('aria-expanded', String(open)); return; }
  /* Favorito: añade o quita de favoritos. */
  if (target.dataset.favorite) { toggleFavorite(target.dataset.favorite, target); return; }
  /* Paginación: cambia de página. */
  if (target.dataset.page) { state.page = Number(target.dataset.page); renderNews(); return; }
  /* Editar: guarda el id en state.editingId y redirige al panel. */
  if (target.dataset.edit) { state.editingId = normalizeId(target.dataset.edit); location.hash = '#crear'; return; }
  /* Solicitar eliminación: guarda el id en state.pendingDelete y re-renderiza. */
  if (target.dataset.requestDelete) { state.pendingDelete = normalizeId(target.dataset.requestDelete); renderManager(); return; }
  /* Confirmar eliminación: ejecuta el borrado. */
  if (target.dataset.confirmDelete) { confirmDelete(); return; }
  /* Cancelar eliminación: limpia el estado y re-renderiza. */
  if (target.dataset.cancelDelete) { state.pendingDelete = null; renderManager(); return; }
  /* Cerrar sesión. */
  if (target.dataset.signout) signOut();
});

/* onAuthStateChange: Supabase notifica aquí cada vez que cambia el
   estado de autenticación (login, logout, expiración de token).
   - Actualizo state.session con la nueva sesión.
   - Vuelvo a renderizar el área de cuenta.
   - Recargo los datos (incluyendo favoritos si hay sesión).
   - Si el evento es SIGNED_IN o SIGNED_OUT, ejecuto route() para
     redirigir correctamente.
   Importante: envuelvo la lógica asíncrona en una IIFE async porque
   el callback de onAuthStateChange no puede ser asíncrono directamente. */
supabase.auth.onAuthStateChange((event, session) => {
  (async () => {
    state.session = session;
    renderAccount();
    await loadRemoteData();
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') route();
  })();
});

/* boot: función de arranque de la aplicación.
   - Dibujo el esqueleto HTML (renderShell).
   - Recupero la sesión existente con supabase.auth.getSession().
   - Cargo los datos remotos (noticias y favoritos).
   - Ejecuto route() para renderizar la vista inicial según el hash. */
async function boot() {
  renderShell();
  const sessionResult = await supabase.auth.getSession();
  state.session = sessionResult.data.session;
  await loadRemoteData();
  route();
}

/* Escucho cambios en el hash de la URL para ejecutar el router. */
window.addEventListener('hashchange', route);

/* Inicio la aplicación. */
boot();
