/* =====================================================================
   app.js — Lógica de la SPA VibeWire (Entrega 2 y 3)
   Secciones: 1 Estado · 2 Persistencia · 3 Utilidades · 4 Tarjetas ·
   5 Vistas · 6 Router · 7 Favoritos · 8 Buscador/Filtro · 9 Mini-CRUD ·
   10 Validación · 11 Eventos globales · 12 Arranque
   ===================================================================== */
'use strict';

/* ---------- 1. ESTADO GLOBAL ----------
   Una única fuente de verdad: todas las vistas se dibujan a partir de este objeto. */
const CLAVES = { custom: 'noticias_custom', eliminadas: 'noticias_eliminadas', favs: 'favoritos' };
const POR_PAGINA = 6;
const VISTAS = ['home', 'noticias', 'detalle', 'favoritos', 'crear', 'contacto'];
const estado = {
  base: [],                              // noticias leídas de data.json (fetch)
  custom: leer(CLAVES.custom),           // noticias creadas por el usuario (localStorage)
  eliminadas: leer(CLAVES.eliminadas),   // ids de noticias del JSON que el usuario borró
  favs: leer(CLAVES.favs),               // ids marcados como favoritos
  q: '', cat: 'Todas', pagina: 1,        // estado de buscador, filtro y paginación
  pendiente: null                        // id que espera confirmación de eliminación
};

/* ---------- 2. PERSISTENCIA (localStorage) ---------- */
// DESERIALIZAR: localStorage solo guarda texto; JSON.parse lo convierte en arreglo.
// El try/catch evita que un valor corrupto rompa la aplicación.
function leer(clave) {
  try { return JSON.parse(localStorage.getItem(clave)) || []; } catch { return []; }
}
// SERIALIZAR: JSON.stringify convierte el arreglo en texto para guardarlo.
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* almacenamiento lleno o bloqueado */ }
}
// FUSIÓN: noticias creadas (primero) + noticias del JSON, sin las eliminadas.
const todas = () => [...estado.custom, ...estado.base].filter(n => !estado.eliminadas.includes(n.id));
const porId = id => todas().find(n => n.id === Number(id));

/* ---------- 3. UTILIDADES ---------- */
const $ = id => document.getElementById(id);
// Escapa HTML: evita que texto escrito por el usuario inyecte etiquetas (seguridad XSS).
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fecha = d => new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
function aviso(msg) { // notificación temporal (toast)
  const t = Object.assign(document.createElement('div'), { className: 'toast', textContent: msg });
  document.body.appendChild(t); setTimeout(() => t.remove(), 2500);
}

/* ---------- 4. RENDERIZADO DINÁMICO DE TARJETAS ---------- */
// Devuelve el HTML de UNA tarjeta (template literal con datos escapados).
const tarjeta = n => {
  const fav = estado.favs.includes(n.id);
  return `<article class="card">
    <div class="im"><img src="${esc(n.imagen)}" alt="${esc(n.titulo)}" loading="lazy">
      <span class="badge">${esc(n.categoria)}</span>
      <button class="fav ${fav ? 'on' : ''}" data-fav="${n.id}" aria-label="Favorito">${fav ? '★' : '☆'}</button></div>
    <div class="cb"><small>${fecha(n.fecha)} · ${esc(n.autor)}</small><h3>${esc(n.titulo)}</h3>
      <p>${esc(n.descripcionCorta)}</p><a class="lnk" href="#detalle/${n.id}">Leer más →</a></div></article>`;
};
// Inserta una lista de tarjetas en un contenedor usando un DocumentFragment:
// se construye fuera del DOM y se inserta de una sola vez (menos reflujos del navegador).
function pintar(contenedor, lista, vacio = 'No hay noticias para mostrar.') {
  const plantilla = document.createElement('template');
  plantilla.innerHTML = lista.length ? lista.map(tarjeta).join('') : `<div class="empty">${vacio}</div>`;
  contenedor.replaceChildren(plantilla.content);
}

/* ---------- 5. VISTAS (una función por sección) ---------- */
const RENDER = {
  home() {
    const lista = todas();
    const h = lista.find(n => n.esDestacada) || lista[0]; // noticia destacada del hero
    const hero = $('hero-destacada');
    hero.style.backgroundImage = h ? `url('${h.imagen}')` : 'none';
    hero.innerHTML = h ? `<div><span class="badge hot">Destacado</span><h2>${esc(h.titulo)}</h2>
      <p>${esc(h.descripcionCorta)}</p><a class="btn" href="#detalle/${h.id}">Leer más →</a></div>` : '';
    // .sort() ordena por fecha descendente sobre una copia; .slice() toma las 6 más recientes.
    pintar($('grid-recientes'), [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6));
  },
  noticias() { $('buscador').value = estado.q; $('filtro-categoria').value = estado.cat; listar(); },
  detalle(id) {
    const n = porId(id), cont = $('detalle-contenido');
    if (!n) { cont.innerHTML = '<div class="empty">Noticia no encontrada. <a class="lnk" href="#noticias">Volver</a></div>'; return; }
    const rel = todas().filter(x => x.id !== n.id && x.categoria === n.categoria).slice(0, 3); // mismas categoría
    cont.innerHTML = `<a class="lnk" href="#noticias">← Volver a noticias</a>
      <div style="margin-top:18px"><span class="badge">${esc(n.categoria)}</span></div><h1>${esc(n.titulo)}</h1>
      <div class="meta"><span>${esc(n.autor)}</span>·<span>${fecha(n.fecha)}</span>
        <button class="btn sec" data-fav="${n.id}">${estado.favs.includes(n.id) ? '★ Guardado' : '☆ Guardar en favoritos'}</button></div>
      <img class="cover" src="${esc(n.imagen)}" alt="${esc(n.titulo)}">
      ${esc(n.contenidoCompleto).split(/\n+/).map(p => `<p>${p}</p>`).join('')}
      <section class="rel"><h2 style="margin-bottom:16px">Noticias relacionadas</h2><div class="grid" id="grid-rel"></div></section>`;
    pintar($('grid-rel'), rel, 'No hay noticias relacionadas.');
  },
  favoritos() {
    const lista = todas().filter(n => estado.favs.includes(n.id)); // .filter + .includes sobre los ids guardados
    $('contador-favs').textContent = `${lista.length} lecturas guardadas`;
    pintar($('grid-favoritos'), lista, 'Aún no tienes favoritos. Pulsa ☆ en una noticia para guardarla.');
  },
  crear() { tabla(); },
  contacto() { $('form-contacto').classList.remove('oculto'); $('exito-contacto').classList.add('oculto'); }
};

/* ---------- 6. ENRUTAMIENTO POR HASH ----------
   El hash (#noticias, #detalle/3) cambia sin recargar la página; hashchange nos avisa. */
function enrutar() {
  const [ruta, param] = location.hash.slice(1).split('/');   // "#detalle/3" -> ["detalle","3"]
  const vista = VISTAS.includes(ruta) ? ruta : 'home';        // ruta desconocida -> home
  VISTAS.forEach(v => $('vista-' + v).classList.toggle('oculto', v !== vista)); // muestra solo una sección
  document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.v === (vista === 'detalle' ? 'noticias' : vista)));
  $('nav').classList.remove('open');
  RENDER[vista](param);
}
window.addEventListener('hashchange', () => { estado.pendiente = null; enrutar(); scrollTo(0, 0); });

/* ---------- 7. SISTEMA DE FAVORITOS ---------- */
function alternarFavorito(id) {
  // Si el id ya está, se quita (.filter); si no, se agrega. Luego se serializa a localStorage.
  estado.favs = estado.favs.includes(id) ? estado.favs.filter(x => x !== id) : [...estado.favs, id];
  guardar(CLAVES.favs, estado.favs);
  const y = scrollY; enrutar(); scrollTo(0, y); // redibuja la vista actual conservando el scroll
}

/* ---------- 8. BUSCADOR, FILTRO Y PAGINACIÓN ---------- */
function listar() {
  const q = estado.q.trim().toLowerCase();
  const res = todas().filter(n =>
    (estado.cat === 'Todas' || n.categoria === estado.cat) &&                       // filtro por categoría
    (!q || (n.titulo + ' ' + n.descripcionCorta + ' ' + n.autor).toLowerCase().includes(q))); // búsqueda por texto
  const paginas = Math.max(1, Math.ceil(res.length / POR_PAGINA));
  estado.pagina = Math.min(estado.pagina, paginas);
  $('contador').textContent = `${res.length} RESULTADOS`;
  pintar($('grid-noticias'), res.slice((estado.pagina - 1) * POR_PAGINA, estado.pagina * POR_PAGINA), 'Sin resultados para tu búsqueda.');
  $('paginacion').innerHTML = paginas < 2 ? '' : Array.from({ length: paginas }, (_, i) =>
    `<button class="${estado.pagina === i + 1 ? 'on' : ''}" data-pagina="${i + 1}">${i + 1}</button>`).join('');
}
$('buscador').addEventListener('input', e => { estado.q = e.target.value; estado.pagina = 1; listar(); });       // evento INPUT: en cada tecla
$('filtro-categoria').addEventListener('change', e => { estado.cat = e.target.value; estado.pagina = 1; listar(); }); // evento CHANGE: al elegir opción

/* ---------- 9. MINI-CRUD ---------- */
// READ: dibuja la tabla de gestión y la confirmación de borrado si hay una pendiente.
function tabla() {
  const aviso = $('aviso-eliminar'), p = porId(estado.pendiente);
  aviso.classList.toggle('oculto', !p);
  aviso.innerHTML = p ? `⚠ ¿Eliminar "${esc(p.titulo)}"? Esta acción no se puede deshacer.
    <button class="btn sec" data-cancelar>Cancelar</button><button class="btn danger" data-borrar="${p.id}">Eliminar</button>` : '';
  $('tabla-noticias').innerHTML = '<tr><th>NOTICIA</th><th class="hide">CATEGORÍA</th><th class="hide">FECHA</th><th>ACCIÓN</th></tr>' +
    (todas().map(n => `<tr><td>${esc(n.titulo)}</td><td class="hide">${esc(n.categoria)}</td><td class="hide">${fecha(n.fecha)}</td>
      <td><button class="btn sec" data-pedir="${n.id}">🗑 Eliminar</button></td></tr>`).join('') || '<tr><td colspan="4" class="mut">Sin noticias.</td></tr>');
}
// CREATE: se captura el evento submit; preventDefault evita que el navegador recargue la página.
$('form-noticia').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, v = id => f.querySelector('#' + id), val = id => v(id).value.trim();
  let urlOk; try { urlOk = /^https?:$/.test(new URL(val('imagen')).protocol); } catch { urlOk = false; } // ¿URL http(s) válida?
  const ok = [
    validar(v('titulo'), val('titulo').length >= 5, 'El título debe tener al menos 5 caracteres.'),
    validar(v('categoria'), !!val('categoria'), 'Selecciona una categoría.'),
    validar(v('autor'), val('autor').length >= 3, 'Indica el autor.'),
    validar(v('imagen'), urlOk, 'Introduce una URL válida (http/https).'),
    validar(v('desc'), val('desc').length >= 10 && val('desc').length <= 160, 'La descripción debe tener entre 10 y 160 caracteres.'),
    validar(v('cont'), val('cont').length >= 30, 'El contenido debe tener al menos 30 caracteres.')
  ].every(Boolean); // solo continúa si TODAS las validaciones pasan
  if (!ok) return;
  estado.custom.unshift({ id: Date.now(),  // ID único: milisegundos desde 1970 (no se repite entre envíos)
    titulo: val('titulo'), categoria: val('categoria'), descripcionCorta: val('desc'), contenidoCompleto: val('cont'),
    fecha: new Date().toISOString().slice(0, 10), autor: val('autor'), imagen: val('imagen'), esDestacada: v('dest').checked });
  guardar(CLAVES.custom, estado.custom);  // persistencia en localStorage
  f.reset(); aviso('✓ Noticia publicada'); location.hash = '#noticias';
});
// DELETE: las noticias propias se quitan del arreglo; las del JSON se "ocultan" guardando su id.
function eliminar(id) {
  estado.custom = estado.custom.filter(n => n.id !== id);
  if (!estado.eliminadas.includes(id)) estado.eliminadas.push(id);
  estado.favs = estado.favs.filter(x => x !== id);
  guardar(CLAVES.custom, estado.custom); guardar(CLAVES.eliminadas, estado.eliminadas); guardar(CLAVES.favs, estado.favs);
  estado.pendiente = null; tabla(); aviso('Noticia eliminada');
}

/* ---------- 10. VALIDACIÓN DE FORMULARIOS ---------- */
// Marca el campo con error (clase .bad), muestra el mensaje y devuelve true/false.
function validar(campo, condicion, mensaje) {
  const grupo = campo.closest('.f');
  grupo.classList.toggle('bad', !condicion);
  grupo.querySelector('.err').textContent = condicion ? '' : mensaje;
  return condicion;
}
$('form-contacto').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, v = id => f.querySelector('#' + id);
  const ok = [
    validar(v('nombre'), v('nombre').value.trim().length >= 3, 'Escribe tu nombre (mínimo 3 caracteres).'),
    // Regex de email: texto sin espacios/@ + "@" + dominio + "." + extensión de 2+ letras.
    validar(v('email'), /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email').value.trim()), 'Introduce un correo válido, ej. nombre@dominio.com.'),
    validar(v('asunto'), v('asunto').value !== '', 'Selecciona un asunto.'),
    validar(v('mensaje'), v('mensaje').value.trim().length >= 10, 'El mensaje debe tener al menos 10 caracteres.'),
    validar(v('acepto'), v('acepto').checked, 'Debes aceptar el uso de tus datos.')
  ].every(Boolean);
  if (!ok) return;
  $('exito-contacto').innerHTML = `<h2>✓ ¡Gracias, ${esc(v('nombre').value.trim())}!</h2>
    <p class="mut">Recibimos tu mensaje. Responderemos a ${esc(v('email').value.trim())} en 1-2 días hábiles.</p>`;
  f.reset(); f.classList.add('oculto'); $('exito-contacto').classList.remove('oculto'); // mensaje de éxito visual
});

/* ---------- 11. EVENTOS GLOBALES (delegación) ----------
   Un solo listener en document atiende los botones creados dinámicamente. */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-fav],[data-pagina],[data-pedir],[data-borrar],[data-cancelar],#burger');
  if (!t) return;
  if (t.id === 'burger') $('nav').classList.toggle('open');
  else if (t.dataset.fav) alternarFavorito(Number(t.dataset.fav));
  else if (t.dataset.pagina) { estado.pagina = Number(t.dataset.pagina); listar(); scrollTo(0, 0); }
  else if (t.dataset.pedir) { estado.pendiente = Number(t.dataset.pedir); tabla(); }
  else if (t.dataset.borrar) eliminar(Number(t.dataset.borrar));
  else estado.pendiente = null, tabla(); // data-cancelar
});

/* ---------- 12. ARRANQUE: fetch() de data.json ----------
   fetch devuelve una Promesa: .then encadena pasos y .catch atrapa errores de red. */
fetch('data.json')
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }) // r.json() parsea el texto a objetos JS
  .then(datos => { estado.base = datos; enrutar(); })                     // guarda en el estado y dibuja la vista del hash
  .catch(() => { $('vista-home').classList.remove('oculto');
    $('vista-home').innerHTML = '<div class="empty">No se pudo cargar data.json. Usa Live Server o StackBlitz (no file://).</div>'; });
