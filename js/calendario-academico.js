/**
 * calendario-academico.js
 * Convierte los eventos de data/calendario-academico.js (extraídos del PDF
 * oficial) en fechas reales y calcula las próximas según el día de hoy.
 * Lo usan la sección "Calendario escolar" y el popup de Novedades PCB Vision,
 * así que ambos se actualizan solos cada día y al regenerar el PDF.
 */
(function () {
  'use strict';

  var datos = window.PCB_CALENDARIO;
  if (!datos) {
    console.warn('calendario-academico: falta data/calendario-academico.js');
    return;
  }

  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var DIA_MS = 86400000;

  var TIPOS = {
    festivo:        { icono: '🎉', es: 'Día festivo',    en: 'Holiday' },
    receso:         { icono: '🛑', es: 'Receso',         en: 'Recess' },
    clases:         { icono: '🏫', es: 'Clases',         en: 'Classes' },
    evaluacion:     { icono: '📝', es: 'Evaluaciones',   en: 'Final exams' },
    assessment:     { icono: '🧪', es: 'Pruebas',        en: 'Assessment' },
    familia:        { icono: '👨‍👩‍👧', es: 'Familias',       en: 'Families' },
    simulacro:      { icono: '🚨', es: 'Simulacro',      en: 'Drill' },
    'fecha-limite': { icono: '⏰', es: 'Fecha límite',   en: 'Deadline' },
    actividad:      { icono: '📌', es: 'Actividad',      en: 'Activity' }
  };

  var TEXTOS = {
    es: {
      titulo: 'Calendario escolar {curso}',
      desc: 'Calendario académico oficial del Departamento de Educación de Puerto Rico para el año escolar {curso}. Las próximas fechas se actualizan automáticamente.',
      proximas: '📅 Próximas fechas',
      enCurso: 'En curso',
      hoy: 'Hoy',
      manana: 'Mañana',
      enDias: 'En {n} días',
      vacio: 'No hay más fechas en este calendario escolar.',
      fuente: 'Fuente: {pdf}'
    },
    en: {
      titulo: 'School Calendar {curso}',
      desc: 'Official academic calendar of the Puerto Rico Department of Education for the {curso} school year. Upcoming dates update automatically.',
      proximas: '📅 Upcoming dates',
      enCurso: 'Happening now',
      hoy: 'Today',
      manana: 'Tomorrow',
      enDias: 'In {n} days',
      vacio: 'There are no more dates in this school calendar.',
      fuente: 'Source: {pdf}'
    }
  };

  function idioma() {
    try { return localStorage.getItem('language') === 'en' ? 'en' : 'es'; } catch (e) { return 'es'; }
  }

  function t(clave, vars) {
    var texto = TEXTOS[idioma()][clave];
    Object.keys(vars || {}).forEach(function (k) { texto = texto.replace('{' + k + '}', vars[k]); });
    return texto;
  }

  function escapar(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hoy() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /**
   * "30 de nov. al 4 dic." -> { inicio, fin, dias }
   * Cada número toma el mes que lo sigue; agosto-diciembre pertenecen al
   * primer año del curso y enero-julio al segundo.
   */
  function interpretar(fecha) {
    var tokens = fecha.toLowerCase().match(/\d{1,2}|[a-záéíóúñ]+/g) || [];
    var dias = [];
    var pendientes = [];
    tokens.forEach(function (tok) {
      if (/^\d/.test(tok)) {
        pendientes.push(Number(tok));
        return;
      }
      var mes = MESES.indexOf(tok.slice(0, 3));
      if (mes === -1) return;
      pendientes.forEach(function (dia) {
        var anio = mes >= 7 ? datos.anioInicio : datos.anioInicio + 1;
        dias.push(new Date(anio, mes, dia));
      });
      pendientes = [];
    });
    if (!dias.length) return null;
    return { inicio: dias[0], fin: dias[dias.length - 1], dias: dias };
  }

  var eventos = datos.eventos
    .map(function (e) {
      var r = interpretar(e.fecha);
      return r && { fecha: e.fecha, texto: e.texto, tipo: TIPOS[e.tipo] ? e.tipo : 'actividad', inicio: r.inicio, fin: r.fin, dias: r.dias };
    })
    .filter(Boolean)
    .sort(function (a, b) { return a.inicio - b.inicio || a.fin - b.fin; });

  /** Eventos que no han terminado (en curso primero), hasta `limite`. */
  function proximos(limite) {
    var h = hoy();
    return eventos.filter(function (e) { return e.fin >= h; }).slice(0, limite || 5);
  }

  function fechaVisible(e) {
    if (idioma() === 'es') return e.fecha;
    var fmt = function (d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    if (e.dias.length === 1) return fmt(e.inicio);
    var union = /\by\b/.test(e.fecha) ? ' & ' : ' – ';
    return fmt(e.inicio) + union + fmt(e.fin);
  }

  function cuando(e) {
    var h = hoy();
    if (e.inicio <= h) return e.dias.length > 1 && e.fin > h ? t('enCurso') : t('hoy');
    var n = Math.round((e.inicio - h) / DIA_MS);
    return n === 1 ? t('manana') : t('enDias', { n: n });
  }

  /** HTML de una lista de eventos para el popup o la sección. */
  function listaHTML(lista) {
    if (!lista.length) return '<li class="cal-item cal-item-vacio">' + escapar(t('vacio')) + '</li>';
    return lista.map(function (e) {
      var tipo = TIPOS[e.tipo];
      var enCurso = e.inicio <= hoy();
      return '<li class="cal-item cal-' + e.tipo + (enCurso ? ' cal-en-curso' : '') + '">' +
        '<span class="cal-icono" aria-hidden="true">' + tipo.icono + '</span>' +
        '<span class="cal-cuerpo">' +
          '<span class="cal-meta"><strong class="cal-fecha">' + escapar(fechaVisible(e)) + '</strong>' +
          '<span class="cal-chip">' + escapar(cuando(e)) + '</span>' +
          '<span class="cal-tipo">' + escapar(tipo[idioma()]) + '</span></span>' +
          '<span class="cal-texto">' + escapar(e.texto) + '</span>' +
        '</span></li>';
    }).join('');
  }

  function renderSeccion() {
    var curso = datos.curso.replace('-', '–');
    var titulo = document.getElementById('calendarioTitulo');
    var desc = document.getElementById('calendarioDesc');
    var subtitulo = document.getElementById('calendarioProximasTitulo');
    var lista = document.getElementById('calendarioProximas');
    var fuente = document.getElementById('calendarioFuente');
    var visor = document.getElementById('calendarioPdf');
    var descarga = document.getElementById('calendarioDescarga');

    if (titulo) titulo.textContent = t('titulo', { curso: curso });
    if (desc) desc.textContent = t('desc', { curso: curso });
    if (subtitulo) subtitulo.textContent = t('proximas');
    if (lista) lista.innerHTML = listaHTML(proximos(6));
    if (fuente) fuente.textContent = t('fuente', { pdf: datos.pdf.split('/').pop() });
    if (visor && visor.getAttribute('src') !== datos.pdf) visor.setAttribute('src', datos.pdf);
    if (descarga) descarga.setAttribute('href', datos.pdf);
  }

  window.PCBCalendario = {
    curso: datos.curso,
    pdf: datos.pdf,
    eventos: eventos,
    proximos: proximos,
    fechaVisible: fechaVisible,
    listaHTML: listaHTML,
    renderSeccion: renderSeccion
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSeccion);
  } else {
    renderSeccion();
  }
  document.addEventListener('pcb:idioma', renderSeccion);
})();
