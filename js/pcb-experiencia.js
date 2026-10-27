/**
 * pcb-experiencia.js
 * Flujo de bienvenida del index.html:
 *   1. Popup de idioma (ES/EN) + tema (claro/oscuro)   -> solo la primera visita
 *   2. Popup de perfil de usuario para personalizar     -> solo la primera visita
 *   3. Home fijo en el hero (sin autoscroll) y, a los 3 s, el popup de
 *      Novedades PCB Vision (una vez por sesión) con las próximas fechas
 *      del calendario académico + la última novedad publicada.
 * Además recuerda dónde hizo clic el usuario antes de salir a otra página
 * y, al regresar, lo devuelve a ese mismo punto.
 */
(function () {
  'use strict';

  var CLAVES = {
    configurado: 'langThemeSet',          // localStorage
    perfil: 'pcbUserRole',                // localStorage
    novedadesVistas: 'pcbNovedadesVistas', // sessionStorage
    retorno: 'pcbIndexRetorno'            // sessionStorage
  };
  var RETRASO_NOVEDADES = 3000;
  var POPUPS = '.welcome-popup, .promo-popup, .promo-popup-expanded, #modalAnuncio, #prontoModal, #contactosModal, .sidebar-menu';

  var TEXTOS = {
    es: {
      setupEyebrow: '👋 Bienvenido/a',
      setupTitulo: 'Personaliza tu visita',
      setupSub: 'Elige el idioma y el tema con el que quieres ver el sitio.',
      idioma: 'Idioma',
      tema: 'Tema',
      claro: 'Claro',
      oscuro: 'Oscuro',
      continuar: 'Continuar →',
      hola: 'Hola, {perfil}',
      cambiarPerfil: 'Cambiar perfil',
      elegirPerfil: '👤 Personaliza tu experiencia',
      novTitulo: '📢 Novedades PCB Vision',
      novProximo: 'Próximo',
      novCalendario: '📅 Próximas fechas del calendario escolar',
      novVerCalendario: '📅 Ver calendario completo',
      novVacio: 'Mantente pendiente a las próximas novedades.'
    },
    en: {
      setupEyebrow: '👋 Welcome',
      setupTitulo: 'Personalize your visit',
      setupSub: 'Choose the language and theme you want to browse the site with.',
      idioma: 'Language',
      tema: 'Theme',
      claro: 'Light',
      oscuro: 'Dark',
      continuar: 'Continue →',
      hola: 'Hi, {perfil}',
      cambiarPerfil: 'Change profile',
      elegirPerfil: '👤 Personalize your experience',
      novTitulo: '📢 PCB Vision News',
      novProximo: 'Next up',
      novCalendario: '📅 Upcoming school calendar dates',
      novVerCalendario: '📅 View full calendar',
      novVacio: 'Stay tuned for upcoming news.'
    }
  };

  // Accesos rápidos del hero según el perfil elegido
  var PERFILES = {
    estudiante: {
      icono: '🎓', es: 'Estudiante', en: 'Student',
      enlaces: [
        { href: '#servicios', es: 'Servicios estudiantiles', en: 'Student services' },
        { href: 'biblioteca.html', es: 'Biblioteca', en: 'Library' },
        { href: '#calendario-escolar', es: 'Calendario', en: 'Calendar' }
      ]
    },
    padre: {
      icono: '👨‍👩‍👧', es: 'Padre/Madre', en: 'Parent',
      enlaces: [
        { href: '#portal-padres', es: 'Portal de padres', en: 'Parent portal' },
        { href: '#calendario-escolar', es: 'Calendario', en: 'Calendar' },
        { href: '#seguridad-escolar', es: 'Seguridad escolar', en: 'School safety' }
      ]
    },
    maestro: {
      icono: '👩‍🏫', es: 'Maestro', en: 'Teacher',
      enlaces: [
        { href: '#servicios-maestro', es: 'Herramientas del maestro', en: 'Teacher tools' },
        { href: '#calendario-escolar', es: 'Calendario', en: 'Calendar' },
        { href: '#publicar-anuncio', es: 'Publicar anuncio', en: 'Post an announcement' }
      ]
    },
    administracion: {
      icono: '🛠️', es: 'Administración', en: 'Administration',
      enlaces: [
        { href: 'admin.html', es: 'Panel administrativo', en: 'Admin dashboard' },
        { href: '#calendario-escolar', es: 'Calendario', en: 'Calendar' }
      ]
    },
    comunidad: {
      icono: '🤝', es: 'Comunidad', en: 'Community',
      enlaces: [
        { href: '#publicar-anuncio', es: 'Publicar anuncio', en: 'Post an announcement' },
        { href: '#vida', es: 'Vida estudiantil', en: 'Student life' }
      ]
    },
    visitante: {
      icono: '🏫', es: 'Visitante', en: 'Visitor',
      enlaces: [
        { href: '#escuela', es: 'Conoce la escuela', en: 'About the school' },
        { href: '#programas', es: 'Programas', en: 'Programs' },
        { href: '#contacto', es: 'Contacto', en: 'Contact' }
      ]
    }
  };

  // ── Utilidades ──────────────────────────────────────────────
  function leer(clave, sesion) {
    try { return (sesion ? sessionStorage : localStorage).getItem(clave); } catch (e) { return null; }
  }
  function guardar(clave, valor, sesion) {
    try { (sesion ? sessionStorage : localStorage).setItem(clave, valor); } catch (e) { /* modo privado */ }
  }
  function idioma() { return leer('language') === 'en' ? 'en' : 'es'; }
  function t(clave, vars) {
    var texto = TEXTOS[idioma()][clave];
    Object.keys(vars || {}).forEach(function (k) { texto = texto.replace('{' + k + '}', vars[k]); });
    return texto;
  }
  function $(id) { return document.getElementById(id); }
  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function irArriba() {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  // Avisar a los componentes dinámicos cuando cambia el idioma
  if (typeof window.translatePage === 'function') {
    var traducirOriginal = window.translatePage;
    window.translatePage = function (lang) {
      traducirOriginal.apply(this, arguments);
      document.dispatchEvent(new CustomEvent('pcb:idioma', { detail: lang }));
    };
  }

  // ── Popups modales (idioma/tema y perfil) ───────────────────
  function abrirModal(popup) {
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function cerrarModal(popup) {
    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Paso 1: idioma + tema
  function aplicarIdioma(lang) {
    guardar('language', lang);
    var raiz = $('htmlRoot');
    if (raiz) raiz.setAttribute('lang', lang);
    if (typeof window.translatePage === 'function') window.translatePage(lang);
  }
  function aplicarTema(tema) {
    document.body.classList.toggle('dark-mode', tema === 'dark');
    guardar('theme', tema);
    var btn = $('mhcThemeBtn');
    if (btn) btn.textContent = tema === 'dark' ? '🌙' : '☀️';
  }

  function pintarSetup() {
    var popup = $('langThemePopup');
    if (!popup) return;
    popup.querySelectorAll('[data-setup-texto]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-setup-texto'));
    });
    var tema = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    popup.querySelectorAll('[data-setup-idioma]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-setup-idioma') === idioma()));
    });
    popup.querySelectorAll('[data-setup-tema]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-setup-tema') === tema));
    });
  }

  function abrirSetup() {
    var popup = $('langThemePopup');
    if (!popup) return siguientePaso();
    pintarSetup();
    abrirModal(popup);
  }

  function terminarSetup() {
    guardar(CLAVES.configurado, 'true');
    cerrarModal($('langThemePopup'));
    siguientePaso();
  }

  // Paso 2: perfil
  function abrirPerfiles() {
    var popup = $('welcomePopup');
    if (!popup) return siguientePaso();
    abrirModal(popup);
  }

  function elegirPerfil(perfil) {
    guardar(CLAVES.perfil, perfil);
    cerrarModal($('welcomePopup'));
    pintarPerfil();
    siguientePaso();
  }

  function pintarPerfil() {
    var cont = $('heroPerfil');
    if (!cont) return;
    var lang = idioma();
    var perfil = PERFILES[leer(CLAVES.perfil)];
    if (!perfil) {
      cont.innerHTML = '<button type="button" class="hero-perfil-cambiar" data-abrir-perfiles>' + escapar(t('elegirPerfil')) + '</button>';
    } else {
      cont.innerHTML =
        '<div class="hero-perfil-chip"><span aria-hidden="true">' + perfil.icono + '</span> ' +
          escapar(t('hola', { perfil: perfil[lang] })) +
          '<button type="button" class="hero-perfil-cambiar" data-abrir-perfiles>' + escapar(t('cambiarPerfil')) + '</button>' +
        '</div>' +
        '<div class="hero-perfil-links">' +
          perfil.enlaces.map(function (e) {
            return '<a class="hero-perfil-link" href="' + e.href + '">' + escapar(e[lang]) + '</a>';
          }).join('') +
        '</div>';
    }
    cont.hidden = false;
  }

  // Paso 3: hero + novedades
  function siguientePaso() {
    if (leer(CLAVES.configurado) !== 'true') return abrirSetup();
    if (!leer(CLAVES.perfil)) return abrirPerfiles();
    programarNovedades();
  }

  // ── Novedades PCB Vision ────────────────────────────────────
  var temporizadorNovedades = null;
  var avisoActual = null;

  function programarNovedades() {
    if (temporizadorNovedades || leer(CLAVES.novedadesVistas, true)) return;
    temporizadorNovedades = setTimeout(mostrarNovedades, RETRASO_NOVEDADES);
  }

  function pintarNovedades() {
    var popup = $('promoPopup');
    var expandido = $('promoPopupExpanded');
    if (!popup || !expandido) return;

    var proximos = window.PCBCalendario ? window.PCBCalendario.proximos(5) : [];
    var siguiente = proximos[0];

    popup.querySelector('.promo-title').textContent = t('novTitulo');
    popup.querySelector('.promo-preview').textContent = siguiente
      ? t('novProximo') + ' · ' + window.PCBCalendario.fechaVisible(siguiente) + ': ' + siguiente.texto
      : t('novVacio');

    var avisoCorto = popup.querySelector('.promo-aviso');
    var avisoBloque = $('novedadAviso');
    if (avisoActual) {
      avisoCorto.textContent = '📌 ' + avisoActual.titulo;
      avisoCorto.hidden = false;
      avisoBloque.querySelector('.promo-aviso-titulo').textContent = avisoActual.titulo;
      avisoBloque.querySelector('.promo-expanded-message').textContent = avisoActual.mensaje;
      var img = avisoBloque.querySelector('.promo-expanded-img');
      if (avisoActual.imagen) { img.src = avisoActual.imagen; img.hidden = false; } else { img.hidden = true; }
      avisoBloque.hidden = false;
    } else {
      avisoCorto.hidden = true;
      avisoBloque.hidden = true;
    }

    expandido.querySelector('.promo-expanded-title').textContent = t('novTitulo');
    $('novedadesCalendarioTitulo').textContent = t('novCalendario');
    $('novedadesVerCalendario').textContent = t('novVerCalendario');
    $('novedadesCalendario').innerHTML = window.PCBCalendario
      ? window.PCBCalendario.listaHTML(proximos)
      : '<li class="cal-item cal-item-vacio">' + escapar(t('novVacio')) + '</li>';
  }

  // Última novedad del admin o anuncio aprobado de la comunidad (Supabase)
  function cargarAviso() {
    return Promise.all([
      window.novedadesDB ? window.novedadesDB.getLatest().catch(function () { return null; }) : null,
      window.anunciosDB ? window.anunciosDB.getActive().catch(function () { return []; }) : []
    ]).then(function (r) {
      var novedad = r[0];
      var anuncio = r[1] && r[1].length ? r[1][0] : null;
      var item = novedad && anuncio
        ? (new Date(novedad.created_at) >= new Date(anuncio.created_at) ? novedad : anuncio)
        : (novedad || anuncio);
      if (!item) return null;
      return {
        titulo: item.title || item.titulo,
        mensaje: item.message || item.mensaje,
        imagen: item.image_url || item.imagen_url
      };
    });
  }

  function mostrarNovedades() {
    var popup = $('promoPopup');
    if (!popup) return;
    // No interrumpir si el usuario tiene otro modal abierto
    if (document.querySelector('.welcome-popup.is-open')) {
      temporizadorNovedades = setTimeout(mostrarNovedades, 1500);
      return;
    }
    guardar(CLAVES.novedadesVistas, '1', true);
    pintarNovedades();
    popup.classList.add('active');
    cargarAviso().then(function (aviso) {
      avisoActual = aviso;
      pintarNovedades();
    }).catch(function (e) {
      console.warn('No se pudo cargar la novedad:', e);
    });
  }

  // ── Regresar al punto donde se hizo clic ────────────────────
  var ultimoClic = null;
  var usuarioMovio = false;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function selectorDe(el) {
    var partes = [];
    while (el && el !== document.body) {
      if (el.id) {
        partes.unshift('#' + CSS.escape(el.id));
        break;
      }
      var n = 1;
      for (var h = el.previousElementSibling; h; h = h.previousElementSibling) {
        if (h.tagName === el.tagName) n++;
      }
      partes.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + n + ')');
      el = el.parentElement;
    }
    return partes.join(' > ');
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('a, button, [onclick], [role="button"], .card');
    if (!el || el.closest(POPUPS)) return;
    ultimoClic = { clave: selectorDe(el), offset: el.getBoundingClientRect().top, hora: Date.now() };
  }, true);

  window.addEventListener('pagehide', function () {
    var datos = { y: window.scrollY };
    if (ultimoClic && Date.now() - ultimoClic.hora < 15000) {
      datos.clave = ultimoClic.clave;
      datos.offset = ultimoClic.offset;
    }
    guardar(CLAVES.retorno, JSON.stringify(datos), true);
  });

  function restaurar(datos) {
    var el = null;
    try { el = datos.clave ? document.querySelector(datos.clave) : null; } catch (e) { el = null; }

    function aplicar() {
      if (usuarioMovio) return;
      var y = el ? el.getBoundingClientRect().top + window.scrollY - datos.offset : datos.y;
      window.scrollTo({ top: Math.max(0, y), left: 0, behavior: 'instant' });
    }

    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) {
      window.addEventListener(ev, function () { usuarioMovio = true; }, { once: true, passive: true });
    });

    aplicar();
    // El contenido dinámico (eventos, novedades) puede mover la página al cargar
    window.addEventListener('load', aplicar);
    setTimeout(aplicar, 600);
    setTimeout(aplicar, 1500);

    if (el) {
      if (el.matches('a, button')) el.focus({ preventScroll: true });
      el.classList.add('pcb-retorno');
      setTimeout(function () { el.classList.remove('pcb-retorno'); }, 2200);
    }
  }

  function posicionInicial() {
    var nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    var tipo = nav ? nav.type : 'navigate';
    var hash = location.hash;
    var destino = hash && hash !== '#inicio' ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;

    // Enlace explícito desde otra página (p. ej. index.html#contacto): respetarlo
    if (destino && tipo === 'navigate') {
      destino.scrollIntoView({ behavior: 'instant', block: 'start' });
      return;
    }
    if (hash) history.replaceState(null, '', location.pathname + location.search);

    var datos = null;
    try { datos = JSON.parse(leer(CLAVES.retorno, true)); } catch (e) { datos = null; }
    if (datos) {
      restaurar(datos);
    } else {
      irArriba();
    }
  }

  // ── Inicio ──────────────────────────────────────────────────
  function enlazar() {
    var setup = $('langThemePopup');
    if (setup) {
      setup.querySelectorAll('[data-setup-idioma]').forEach(function (b) {
        b.addEventListener('click', function () {
          aplicarIdioma(b.getAttribute('data-setup-idioma'));
          pintarSetup();
        });
      });
      setup.querySelectorAll('[data-setup-tema]').forEach(function (b) {
        b.addEventListener('click', function () {
          aplicarTema(b.getAttribute('data-setup-tema'));
          pintarSetup();
        });
      });
      $('langThemeContinuar').addEventListener('click', terminarSetup);
    }

    var perfiles = $('welcomePopup');
    if (perfiles) {
      perfiles.querySelectorAll('[data-welcome-role]').forEach(function (b) {
        b.addEventListener('click', function () { elegirPerfil(b.getAttribute('data-welcome-role')); });
      });
      // Cerrar sin elegir: no se vuelve a preguntar, pero se puede cambiar desde el hero o el menú
      var omitir = function () { elegirPerfil(leer(CLAVES.perfil) || 'general'); };
      $('welcomePopupClose').addEventListener('click', omitir);
      $('welcomePopupSkip').addEventListener('click', omitir);
      perfiles.addEventListener('click', function (e) { if (e.target === perfiles) omitir(); });
    }

    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-abrir-perfiles]')) return;
      var sidebar = $('sidebarMenu');
      if (sidebar) sidebar.classList.remove('active');
      var overlay = $('sidebarOverlay');
      if (overlay) overlay.classList.remove('active');
      abrirPerfiles();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (setup && setup.classList.contains('is-open')) terminarSetup();
      else if (perfiles && perfiles.classList.contains('is-open')) $('welcomePopupSkip').click();
    });

    // Enlaces del popup de novedades hacia el calendario
    var verCalendario = $('novedadesVerCalendario');
    if (verCalendario) {
      verCalendario.addEventListener('click', function (e) {
        e.preventDefault();
        window.closeExpandedPromo();
        var destino = $('calendario-escolar');
        if (destino) destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    document.addEventListener('pcb:idioma', function () {
      pintarSetup();
      pintarPerfil();
      if ($('promoPopup') && leer(CLAVES.novedadesVistas, true)) pintarNovedades();
    });
  }

  function iniciar() {
    enlazar();
    posicionInicial();
    pintarPerfil();
    siguientePaso();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  // Volver con el botón "atrás" desde la caché del navegador: la página queda igual
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) usuarioMovio = true;
  });
})();
