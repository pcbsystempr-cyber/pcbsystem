// Notification Bot System
(function() {
  'use strict';

  let notifications = [];

  // Create bot HTML
  function createBot() {
    const botHTML = `
      <div class="notification-bot" id="notificationBot">
        <div class="bot-button" id="botButton">
          🔔
          <span class="bot-badge" id="botBadge" style="display: none;">0</span>
        </div>
      </div>

      <div class="notification-popup" id="notificationPopup">
        <div class="popup-header">
          <h3>📢 Avisos y Promociones</h3>
          <button class="popup-close-btn" id="popupCloseBtn">×</button>
        </div>
        <div class="popup-content" id="popupContent">
          <div class="notification-empty">
            <div class="notification-empty-icon">📭</div>
            <p>No hay avisos disponibles</p>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', botHTML);

    // Add event listeners
    document.getElementById('botButton').addEventListener('click', togglePopup);
    document.getElementById('popupCloseBtn').addEventListener('click', closePopup);

    // Close popup when clicking outside
    document.addEventListener('click', function(e) {
      const popup = document.getElementById('notificationPopup');
      const bot = document.getElementById('notificationBot');
      
      if (popup.classList.contains('active') && 
          !popup.contains(e.target) && 
          !bot.contains(e.target)) {
        closePopup();
      }
    });
  }

  // Load notifications from localStorage
  function loadNotifications() {
    console.log('🔔 Cargando notificaciones del bot...');

    const botConfig = JSON.parse(localStorage.getItem('pcb_bot_config') || '{}');
    console.log('Bot config:', botConfig);

    notifications = botConfig.notifications || [];

    // Always try to load from content data
    loadFromContentData();
  }

  // Load from content data (avisos and promociones)
  function loadFromContentData() {
    console.log('📦 Cargando datos de contenido...');

    // Detectar si estamos en GitHub Pages o localhost
    const isGitHubPages = window.location.hostname.includes('github.io');
    const isLocalServer = window.location.protocol === 'http:' || window.location.protocol === 'https:';

    // Si estamos en un servidor (GitHub Pages o local server), intentar cargar desde JSON
    if (isGitHubPages || isLocalServer) {
      console.log('🌐 Cargando desde servidor...');
      fetch('data/content-data.json')
        .then(response => {
          if (!response.ok) {
            throw new Error('No se pudo cargar el archivo JSON');
          }
          return response.json();
        })
        .then(data => {
          console.log('✅ Datos cargados desde JSON:', data);
          // Guardar en localStorage para uso offline
          localStorage.setItem('pcb_content_data', JSON.stringify(data));
          processContentData(data);
        })
        .catch(error => {
          console.log('⚠️ No se pudo cargar JSON, usando localStorage:', error);
          loadFromLocalStorage();
        });
    } else {
      // Si estamos en file://, usar localStorage directamente
      console.log('📁 Modo local (file://), usando localStorage');
      loadFromLocalStorage();
    }
  }

  // Load from localStorage
  function loadFromLocalStorage() {
    try {
      const contentData = JSON.parse(localStorage.getItem('pcb_content_data') || '{}');
      console.log('📦 Datos desde localStorage:', contentData);
      processContentData(contentData);
    } catch (error) {
      console.error('❌ Error al cargar datos:', error);
      notifications = [];
      updateBadge();
      renderNotifications();
    }
  }

  // Process content data and filter by selected IDs
  function processContentData(data) {
    const botConfig = JSON.parse(localStorage.getItem('pcb_bot_config') || '{}');
    const selectedIds = botConfig.selectedIds || [];

    console.log('🎯 IDs seleccionados:', selectedIds);
    console.log('📋 Avisos disponibles:', data.avisos || []);
    console.log('📢 Promociones disponibles:', data.promociones || []);

    // Get all avisos and promociones
    const allAvisos = data.avisos || [];
    const allPromociones = data.promociones || [];

    // If there are selected IDs, filter by them
    let avisos, promociones;

    if (selectedIds.length > 0) {
      avisos = allAvisos.filter(item => selectedIds.includes(item.id));
      promociones = allPromociones.filter(item => selectedIds.includes(item.id));
      console.log('✅ Filtrando por IDs seleccionados');
    } else {
      // If no IDs selected, show all
      avisos = allAvisos;
      promociones = allPromociones;
      console.log('ℹ️ No hay IDs seleccionados, mostrando todos');
    }

    console.log('📋 Avisos filtrados:', avisos);
    console.log('📢 Promociones filtradas:', promociones);

    notifications = [...avisos, ...promociones];
    console.log('🔔 Total de notificaciones:', notifications.length);

    updateBadge();
    renderNotifications();
  }

  // Update badge count
  function updateBadge() {
    const badge = document.getElementById('botBadge');
    if (notifications.length > 0) {
      badge.textContent = notifications.length;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // Render notifications
  function renderNotifications() {
    const content = document.getElementById('popupContent');

    console.log('🎨 Renderizando notificaciones:', notifications.length);

    if (notifications.length === 0) {
      content.innerHTML = `
        <div class="notification-empty">
          <div class="notification-empty-icon">📭</div>
          <p>No hay avisos disponibles</p>
          <p style="font-size: 0.85rem; color: #999; margin-top: 0.5rem;">
            Configura los avisos desde el <a href="admin.html" style="color: var(--primary);">panel administrativo</a>
          </p>
        </div>
      `;
      return;
    }

    content.innerHTML = notifications.map((item, index) => {
      // Use URL if available (external), otherwise use base64 or path
      const imageSrc = item.url || item.base64 || item.path || '';
      console.log(`Renderizando item ${index}:`, item.title, 'Imagen:', imageSrc ? 'Sí' : 'No', item.isExternal ? '(URL Externa)' : '');

      return `
        <div class="notification-item" onclick="window.imagePopup && window.imagePopup.open ? window.imagePopup.open({
          src: '${imageSrc}',
          title: '${(item.title || '').replace(/'/g, "\\'")}',
          description: '${(item.description || '').replace(/'/g, "\\'")}'
        }, [], 0) : alert('Popup no disponible')">
          ${imageSrc ? `<img src="${imageSrc}" alt="${item.title || 'Aviso'}" onerror="console.error('Error cargando imagen:', this.src); this.style.display='none'">` : ''}
          <h4>${item.title || 'Aviso'}</h4>
          ${item.description ? `<p>${item.description}</p>` : ''}
          ${item.date ? `<p style="font-size: 0.8rem; color: #999; margin-top: 0.5rem;">📅 ${item.date}</p>` : ''}
        </div>
      `;
    }).join('');

    console.log('✅ Notificaciones renderizadas');
  }

  // Toggle popup
  function togglePopup() {
    const popup = document.getElementById('notificationPopup');
    popup.classList.toggle('active');
  }

  // Close popup
  function closePopup() {
    const popup = document.getElementById('notificationPopup');
    popup.classList.remove('active');
  }

  // Initialize on page load
  window.addEventListener('DOMContentLoaded', function() {
    createBot();
    loadNotifications();

    // Reload notifications every 30 seconds
    setInterval(loadNotifications, 30000);
  });

  // Export for external use
  window.notificationBot = {
    reload: loadNotifications,
    close: closePopup
  };
})();

