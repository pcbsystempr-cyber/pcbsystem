/* ============================================================
 * global-header.js
 * Inyecta el header y el sidebar unificado de index.html en
 * cualquier sub-página que cargue este script. Se omite si la
 * página actual es index.html (que ya define el header inline).
 * ============================================================ */
(function () {
  'use strict';

  // No inyectar en index.html (ya tiene su propio header con modal)
  var path = (location.pathname || '').toLowerCase();
  var isIndex = /(^|\/)index\.html?$/.test(path) || path === '/' || path.endsWith('/');
  if (isIndex) return;

  // ── Asegurar dependencias CSS ──
  function ensureStylesheet(href, marker) {
    if (document.querySelector('link[href*="' + marker + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
  ensureStylesheet('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css', 'font-awesome');
  ensureStylesheet('dropdown-fix.css', 'dropdown-fix.css');

  // ── Estilos del botón móvil de tema (sol/luna animado) ──
  function ensureMhcStyles() {
    if (document.getElementById('gh-mhc-styles')) return;
    var st = document.createElement('style');
    st.id = 'gh-mhc-styles';
    st.textContent = [
      '.mobile-header-controls{display:none;}',
      '@media (max-width: 900px){',
      '  .mobile-header-controls{display:flex;position:fixed;right:calc(1.5rem + 45px + 6px);top:1.62rem;align-items:center;gap:0.3rem;z-index:10001;}',
      '}',
      '@media (max-width: 780px){',
      '  .mobile-header-controls{right:calc(1rem + 45px + 6px);top:1.32rem;}',
      '}',
      '.mhc-btn{position:relative;width:38px;height:38px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.35);',
      '  background:linear-gradient(135deg, rgba(56,189,248,0.22) 0%, rgba(255,255,255,0.10) 100%);',
      '  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;display:flex;align-items:center;justify-content:center;',
      '  cursor:pointer;transition:background .25s ease, transform .2s ease, box-shadow .25s ease, border-color .25s ease;',
      '  flex-shrink:0;padding:0;overflow:hidden;box-shadow:0 2px 10px rgba(15,42,74,.30), inset 0 1px 0 rgba(255,255,255,.20);}',
      '.mhc-btn:hover{transform:scale(1.08);border-color:rgba(255,255,255,0.55);box-shadow:0 6px 18px rgba(56,189,248,.40), inset 0 1px 0 rgba(255,255,255,.30);}',
      '.mhc-btn:active{transform:scale(0.92);} .mhc-btn:focus-visible{outline:2px solid #38BDF8;outline-offset:2px;}',
      '.mhc-btn .mhc-icon{position:absolute;width:18px;height:18px;pointer-events:none;transition:transform .45s cubic-bezier(.4,0,.2,1), opacity .30s ease;}',
      '.mhc-btn .mhc-icon-sun{color:#FFD56B;transform:rotate(0deg) scale(1);opacity:1;}',
      '.mhc-btn .mhc-icon-moon{color:#E0F2FE;transform:rotate(-90deg) scale(0.4);opacity:0;}',
      'body.dark-mode .mhc-btn .mhc-icon-sun{transform:rotate(90deg) scale(0.4);opacity:0;}',
      'body.dark-mode .mhc-btn .mhc-icon-moon{transform:rotate(0deg) scale(1);opacity:1;}',
      'body.dark-mode .mhc-btn{background:linear-gradient(135deg, rgba(15,42,74,0.55) 0%, rgba(30,79,134,0.35) 100%);',
      '  border-color:rgba(56,189,248,0.45);box-shadow:0 2px 10px rgba(0,0,0,.45), inset 0 1px 0 rgba(56,189,248,.20);}',
      'body.dark-mode .mhc-btn:hover{box-shadow:0 6px 18px rgba(56,189,248,.45), inset 0 1px 0 rgba(56,189,248,.30);}'
    ].join('\n');
    document.head.appendChild(st);
  }
  ensureMhcStyles();

  // ── Cargar translations.js si no está ──
  if (typeof window.translatePage !== 'function' && !document.querySelector('script[src*="translations.js"]')) {
    var s = document.createElement('script');
    s.src = 'translations.js';
    document.head.appendChild(s);
  }

  // ── Funciones de tema (fallback si la página no las define) ──
  if (typeof window.setLightMode !== 'function') {
    window.setLightMode = function () {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    };
  }
  if (typeof window.setDarkMode !== 'function') {
    window.setDarkMode = function () {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    };
  }
  if (typeof window.toggleMobileTheme !== 'function') {
    window.toggleMobileTheme = function () {
      var isDark = document.body.classList.toggle('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      var btn = document.getElementById('mhcThemeBtn');
      if (btn) {
        btn.setAttribute('aria-pressed', String(isDark));
        btn.setAttribute('title', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      }
    };
  }

  // ── Markup del header (idéntico a index.html) ──
  var HEADER_HTML = '' +
    '<header class="site-header">' +
      '<div class="container header-inner">' +
        '<div class="logo-area">' +
          '<a href="index.html" style="display:flex;align-items:center;gap:.6rem;text-decoration:none;color:inherit;">' +
            '<img src="LOGO6.png" alt="Logo Escuela" class="logo-image">' +
            '<div class="logo-text">' +
              '<span class="logo-title" data-translate="Escuela Superior Vocacional">Escuela Superior Vocacional</span>' +
              '<span class="logo-subtitle" data-translate="Pablo Colón Berdecia">Pablo Colón Berdecia</span>' +
            '</div>' +
          '</a>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:1rem;">' +
          '<nav class="main-nav">' +
            '<ul>' +
              '<li><a href="index.html#inicio" data-translate="Inicio">Inicio</a></li>' +
              '<li><a href="index.html#escuela" data-translate="La escuela">La escuela</a></li>' +
              '<li class="dropdown">' +
                '<a href="#" style="pointer-events:none;"><span data-translate="Servicios Digitales">Servicios Digitales</span> <i class="fas fa-chevron-down"></i></a>' +
                '<ul class="dropdown-menu">' +
                  '<li><a href="https://de.pr.gov/MATRICULA//" data-translate="📝 Matrícula Online">📝 Matrícula Online</a></li>' +
                  '<li><a href="solicitudes.html" data-translate="📄 Solicitud de Documentos">📄 Solicitud de Documentos</a></li>' +
                  '<li><a href="https://pcbsystempr-cyber.github.io/Servicio-Tecnico/" data-translate="🔧 Servicios Técnicos">🔧 Servicios Técnicos</a></li>' +
                  '<li><a href="https://pcbsystempr-cyber.github.io/Unidad-de-ApoyoSocioEmocional/" data-translate="🧠 Orientación">🧠 Orientación</a></li>' +
                  '<li><a href="biblioteca.html" data-translate="📚 Biblioteca">📚 Biblioteca</a></li>' +
                  '<li><a href="comedor.html" data-translate="🍽️ Comedor">🍽️ Comedor</a></li>' +
                  '<li><a href="padres.html" data-translate="👨‍👩‍👧 Portal de Padres">👨‍👩‍👧 Portal de Padres</a></li>' +
                  '<li><a href="seguridad.html" data-translate="🛡️ Seguridad">🛡️ Seguridad</a></li>' +
                  '<li><a href="excursiones/excursiones.html" data-translate="📋 Formulario de Excursión">📋 Formulario de Excursión</a></li>' +
                '</ul>' +
              '</li>' +
              '<li><a href="index.html#vida" data-translate="Vida estudiantil">Vida estudiantil</a></li>' +
              '<li><a href="index.html#contacto" data-translate="Contacto">Contacto</a></li>' +
            '</ul>' +
          '</nav>' +
          '<div class="mobile-header-controls" id="mobileHeaderControls">' +
            '<button class="mhc-btn" id="mhcThemeBtn" onclick="toggleMobileTheme()" title="Cambiar tema" aria-label="Cambiar tema" aria-pressed="false">' +
              '<svg class="mhc-icon mhc-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<circle cx="12" cy="12" r="4"></circle>' +
                '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>' +
              '</svg>' +
              '<svg class="mhc-icon mhc-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>' +
              '</svg>' +
            '</button>' +
          '</div>' +
          '<button class="hamburger-menu" id="hamburgerBtn" aria-label="Abrir menú">' +
            '<span></span><span></span><span></span>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</header>';

  // ── Markup del sidebar (idéntico a index.html) ──
  var SIDEBAR_HTML = '' +
    '<div class="sidebar-menu" id="sidebarMenu">' +
      '<div class="sidebar-header">' +
        '<h3 data-translate="Menú">Menú</h3>' +
        '<button class="sidebar-close" id="closeSidebar">&times;</button>' +
      '</div>' +
      '<div class="sidebar-content">' +
        '<a href="index.html" class="sidebar-item sidebar-link">' +
          '<span class="sidebar-icon">🏠</span>' +
          '<span class="sidebar-text" data-translate="Inicio">Inicio</span>' +
          '<span class="sidebar-arrow">›</span>' +
        '</a>' +
        '<a href="quienes-somos.html" class="sidebar-item sidebar-link">' +
          '<span class="sidebar-icon">🏫</span>' +
          '<span class="sidebar-text" data-translate="Quiénes Somos">Quiénes Somos</span>' +
          '<span class="sidebar-arrow">›</span>' +
        '</a>' +
        '<div class="sidebar-item" id="servicesToggle">' +
          '<span class="sidebar-icon">💻</span>' +
          '<span class="sidebar-text" data-translate="Servicios Digitales">Servicios Digitales</span>' +
          '<span class="sidebar-arrow">›</span>' +
        '</div>' +
        '<div class="theme-options" id="servicesOptions" style="display:none;">' +
          '<a href="https://de.pr.gov/MATRICULA//" class="theme-option"><span>📝</span> Matrícula Online</a>' +
          '<a href="solicitudes.html" class="theme-option"><span>📄</span> Solicitud de Documentos</a>' +
          '<a href="https://pcbsystempr-cyber.github.io/Servicio-Tecnico/" class="theme-option"><span>🔧</span> Servicios Técnicos</a>' +
          '<a href="orientacion.html" class="theme-option"><span>🧠</span> Orientación</a>' +
          '<a href="biblioteca.html" class="theme-option"><span>📚</span> Biblioteca</a>' +
          '<a href="comedor.html" class="theme-option"><span>🍽️</span> Comedor</a>' +
          '<a href="padres.html" class="theme-option"><span>👨‍👩‍👧</span> Portal de Padres</a>' +
          '<a href="seguridad.html" class="theme-option"><span>🛡️</span> Seguridad</a>' +
          '<a href="excursiones/excursiones.html" class="theme-option"><span>📋</span> Formulario de Excursión</a>' +
        '</div>' +
        '<a href="participacion-comunitaria.html" class="sidebar-item sidebar-link">' +
          '<span class="sidebar-icon">🎓</span>' +
          '<span class="sidebar-text" data-translate="Vida Estudiantil">Vida Estudiantil</span>' +
          '<span class="sidebar-arrow">›</span>' +
        '</a>' +
        '<a href="normas-reglamentos.html" class="sidebar-item sidebar-link">' +
          '<span class="sidebar-icon">📋</span>' +
          '<span class="sidebar-text" data-translate="Normas">Normas</span>' +
          '<span class="sidebar-arrow">›</span>' +
        '</a>' +
        '<div class="sidebar-item sidebar-publish-item" id="ghPublishItem" style="cursor:pointer;">' +
          '<span class="sidebar-icon">📌</span>' +
          '<span class="sidebar-text" data-translate="Publicar Anuncio">Publicar Anuncio</span>' +
          '<span class="sidebar-arrow">›</span>' +
        '</div>' +
        '<div style="border-top:1px solid rgba(255,255,255,0.1); margin:1rem 0;"></div>' +
        '<div class="sidebar-item" id="themeToggle">' +
          '<span class="sidebar-icon">🎨</span>' +
          '<span class="sidebar-text" data-translate="Cambiar Tema">Cambiar Tema</span>' +
          '<span class="sidebar-arrow">›</span>' +
        '</div>' +
        '<div class="theme-options" id="themeOptions" style="display:none;">' +
          '<button class="theme-option" id="selectLightMode" data-translate="Modo Claro"><span>☀️</span> Modo Claro</button>' +
          '<button class="theme-option" id="selectDarkMode" data-translate="Modo Oscuro"><span>🌙</span> Modo Oscuro</button>' +
        '</div>' +
        '<div class="sidebar-item" id="languageToggle">' +
          '<span class="sidebar-icon">🌐</span>' +
          '<span class="sidebar-text" data-translate="Cambiar Idioma">Cambiar Idioma</span>' +
          '<span class="sidebar-arrow">›</span>' +
        '</div>' +
        '<div class="theme-options" id="languageOptions" style="display:none;">' +
          '<button class="theme-option" id="selectSpanish" data-translate="Español"><span>🇵🇷</span> Español</button>' +
          '<button class="theme-option" id="selectEnglish" data-translate="English"><span>🇺🇸</span> English</button>' +
        '</div>' +
        '<div style="border-top:1px solid rgba(255,255,255,0.1); margin:1rem 0;"></div>' +
        '<a href="admin.html" class="sidebar-item sidebar-link">' +
          '<span class="sidebar-icon">⚙️</span>' +
          '<span class="sidebar-text" data-translate="Dashboard Admin">Dashboard Admin</span>' +
          '<span class="sidebar-arrow">›</span>' +
        '</a>' +
      '</div>' +
    '</div>' +
    '<div class="sidebar-overlay" id="sidebarOverlay"></div>';

  // ── Inyectar / reemplazar el header y sidebar existentes ──
  function injectMarkup() {
    // Eliminar header, sidebar y overlay existentes (de cualquier versión anterior)
    document.querySelectorAll('header.site-header, .sidebar-menu, .sidebar-overlay').forEach(function (el) {
      el.parentNode && el.parentNode.removeChild(el);
    });
    // Insertar el nuevo header al inicio del body
    var wrap = document.createElement('div');
    wrap.innerHTML = HEADER_HTML + SIDEBAR_HTML;
    // Mover cada hijo al body en el orden esperado
    var nodes = Array.prototype.slice.call(wrap.childNodes);
    var firstChild = document.body.firstChild;
    nodes.forEach(function (n) { document.body.insertBefore(n, firstChild); });
  }

  // ── Wiring de eventos del sidebar ──
  function wireEvents() {
    var hamburgerBtn = document.getElementById('hamburgerBtn');
    var sidebarMenu = document.getElementById('sidebarMenu');
    var sidebarOverlay = document.getElementById('sidebarOverlay');
    var closeSidebar = document.getElementById('closeSidebar');
    var themeToggle = document.getElementById('themeToggle');
    var themeOptions = document.getElementById('themeOptions');
    var selectLightMode = document.getElementById('selectLightMode');
    var selectDarkMode = document.getElementById('selectDarkMode');
    var languageToggle = document.getElementById('languageToggle');
    var languageOptions = document.getElementById('languageOptions');
    var selectSpanish = document.getElementById('selectSpanish');
    var selectEnglish = document.getElementById('selectEnglish');
    var servicesToggle = document.getElementById('servicesToggle');
    var servicesOptions = document.getElementById('servicesOptions');
    var publishItem = document.getElementById('ghPublishItem');

    function closeSidebarMenu() {
      if (sidebarMenu) sidebarMenu.classList.remove('active');
      if (sidebarOverlay) sidebarOverlay.classList.remove('active');
      if (themeOptions) themeOptions.style.display = 'none';
      if (languageOptions) languageOptions.style.display = 'none';
      if (servicesOptions) servicesOptions.style.display = 'none';
    }

    if (hamburgerBtn) hamburgerBtn.addEventListener('click', function () {
      if (sidebarMenu) sidebarMenu.classList.add('active');
      if (sidebarOverlay) sidebarOverlay.classList.add('active');
    });
    if (closeSidebar) closeSidebar.addEventListener('click', closeSidebarMenu);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebarMenu);

    if (themeToggle) themeToggle.addEventListener('click', function () {
      if (themeOptions) themeOptions.style.display = themeOptions.style.display === 'none' ? 'block' : 'none';
    });
    if (selectLightMode) selectLightMode.addEventListener('click', function () { window.setLightMode(); closeSidebarMenu(); });
    if (selectDarkMode) selectDarkMode.addEventListener('click', function () { window.setDarkMode(); closeSidebarMenu(); });

    if (languageToggle) languageToggle.addEventListener('click', function () {
      if (languageOptions) languageOptions.style.display = languageOptions.style.display === 'none' ? 'block' : 'none';
    });
    function setLang(lang) {
      localStorage.setItem('language', lang);
      var htmlRoot = document.getElementById('htmlRoot') || document.documentElement;
      if (htmlRoot) htmlRoot.setAttribute('lang', lang);
      if (typeof window.translatePage === 'function') window.translatePage(lang);
      closeSidebarMenu();
    }
    if (selectSpanish) selectSpanish.addEventListener('click', function () { setLang('es'); });
    if (selectEnglish) selectEnglish.addEventListener('click', function () { setLang('en'); });

    if (servicesToggle && servicesOptions) {
      servicesToggle.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var hidden = servicesOptions.style.display === 'none' || servicesOptions.style.display === '';
        servicesOptions.style.display = hidden ? 'block' : 'none';
        var arrow = this.querySelector('.sidebar-arrow');
        if (arrow) arrow.style.transform = hidden ? 'rotate(90deg)' : 'rotate(0deg)';
        this.classList.toggle('active', hidden);
      });
    }

    if (publishItem) publishItem.addEventListener('click', function () {
      closeSidebarMenu();
      if (typeof window.abrirModalAnuncio === 'function') {
        window.abrirModalAnuncio();
      } else {
        location.href = 'index.html?publicar=1';
      }
    });

    // Sincronizar estado del botón móvil de tema
    var isDark = document.body.classList.contains('dark-mode');
    var themeBtn = document.getElementById('mhcThemeBtn');
    if (themeBtn) {
      themeBtn.setAttribute('aria-pressed', String(isDark));
      themeBtn.setAttribute('title', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }
  }

  function init() {
    injectMarkup();
    wireEvents();
    // Re-traducir la página por si translations.js ya cargó
    var lang = localStorage.getItem('language') || 'es';
    if (typeof window.translatePage === 'function') {
      try { window.translatePage(lang); } catch (e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
