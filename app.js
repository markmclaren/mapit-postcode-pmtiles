// Color conversion utilities for dynamic contrasting polygons
function hexToHsl(hex) {
  hex = hex.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  let c = (1 - Math.abs(2 * l - 1)) * s;
  let x = c * (1 - Math.abs((h / 60) % 2 - 1));
  let m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; }
  else if (60 <= h && h < 120) { r = x; g = c; }
  else if (120 <= h && h < 180) { g = c; b = x; }
  else if (180 <= h && h < 240) { g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; b = c; }
  else if (300 <= h && h < 360) { r = c; b = x; }
  let hexR = Math.round((r + m) * 255).toString(16).padStart(2, '0');
  let hexG = Math.round((g + m) * 255).toString(16).padStart(2, '0');
  let hexB = Math.round((b + m) * 255).toString(16).padStart(2, '0');
  return `#${hexR}${hexG}${hexB}`;
}

function getColorExpression(baseColorHex) {
  const hsl = hexToHsl(baseColorHex);
  const expression = [
    'match',
    ['get', 'colour_index']
  ];
  // Generate 6 distinct contrasting colors by rotating Hue and slightly adjusting Lightness/Saturation
  for (let i = 0; i < 6; i++) {
    const shiftedHue = (hsl.h + i * 60) % 360;
    const shiftedLight = Math.max(15, Math.min(85, hsl.l + (i % 2 === 0 ? 10 : -10)));
    const color = hslToHex(shiftedHue, hsl.s, shiftedLight);
    expression.push(i, color);
  }
  expression.push(baseColorHex); // default fallback color
  return expression;
}

// Layer configurations matching files in repo
const LAYER_CONFIGS = [
  {
    id: 'areas',
    name: 'Postcode Areas',
    file: 'gb_areas.pmtiles',
    sourceLayer: 'areas',
    defaultFillColor: '#a855f7', // Purple
    defaultStrokeColor: '#7e22ce',
    defaultFillOpacity: 0.15,
    defaultStrokeWidth: 2.0,
    description: 'Top-level postcode areas (e.g. AB, EH, SW).'
  },
  {
    id: 'districts',
    name: 'Postcode Districts',
    file: 'gb_districts.pmtiles',
    sourceLayer: 'districts',
    defaultFillColor: '#3b82f6', // Blue
    defaultStrokeColor: '#1d4ed8',
    defaultFillOpacity: 0.2,
    defaultStrokeWidth: 1.5,
    description: 'Postcode districts (e.g. AB10, EH1, SW1A).'
  },
  {
    id: 'sectors',
    name: 'Postcode Sectors',
    file: 'gb_sectors.pmtiles',
    sourceLayer: 'sectors',
    defaultFillColor: '#10b981', // Emerald
    defaultStrokeColor: '#047857',
    defaultFillOpacity: 0.25,
    defaultStrokeWidth: 1.2,
    description: 'Postcode sectors (e.g. AB10 1, EH1 2, SW1A 1).'
  },
  {
    id: 'units',
    name: 'Postcode Units',
    file: 'gb_units.pmtiles',
    sourceLayer: 'units',
    defaultFillColor: '#f59e0b', // Amber
    defaultStrokeColor: '#b45309',
    defaultFillOpacity: 0.3,
    defaultStrokeWidth: 1.0,
    description: 'Detailed unit postcodes (e.g. AB10 1AB).'
  }
];

// Global state
let mapInstance = null;
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);
let loadedLayerZoomRanges = {};
window.loadedLayerZoomRanges = loadedLayerZoomRanges;

function applyMapZoomRangeFromLoaded() {
  if (!mapInstance) return;

  const activeRanges = LAYER_CONFIGS.map(config => {
    const range = loadedLayerZoomRanges[config.id];
    const toggle = document.getElementById(`toggle-${config.id}`);
    if (!range || (toggle && !toggle.checked)) return null;
    return range;
  }).filter(Boolean);

  const ranges = activeRanges.length > 0
    ? activeRanges
    : Object.values(loadedLayerZoomRanges);

  if (ranges.length === 0) return;

  const minZoom = Math.max(...ranges.map(r => r.minZoom));
  const maxZoom = Math.min(...ranges.map(r => r.maxZoom));
  const effectiveMaxZoom = Math.max(minZoom, maxZoom - 0.01);

  console.debug('applyMapZoomRangeFromLoaded', {
    ranges,
    activeLayerIds: Object.keys(loadedLayerZoomRanges).filter(id => document.getElementById(`toggle-${id}`)?.checked),
    minZoom,
    maxZoom,
    effectiveMaxZoom
  });

  if (minZoom > maxZoom) {
    console.warn('Active layer zoom ranges do not overlap; preserving current map zoom limits.');
    return;
  }

  try {
    const currentZoom = mapInstance.getZoom();
    mapInstance.setMinZoom(minZoom);
    mapInstance.setMaxZoom(effectiveMaxZoom);

    if (currentZoom < minZoom) {
      mapInstance.setZoom(minZoom);
    } else if (currentZoom > effectiveMaxZoom) {
      mapInstance.setZoom(effectiveMaxZoom);
    }
  } catch (err) {
    console.warn('Failed to apply zoom constraints:', err);
  }
}

function getActiveLayerIds() {
  return LAYER_CONFIGS
    .filter(config => document.getElementById(`toggle-${config.id}`)?.checked)
    .map(config => config.id);
}

function getActiveZoomRange() {
  const activeLayerIds = getActiveLayerIds();
  const ranges = activeLayerIds.length > 0
    ? activeLayerIds.map(id => loadedLayerZoomRanges[id]).filter(Boolean)
    : Object.values(loadedLayerZoomRanges);

  if (ranges.length === 0) return null;
  const minZoom = Math.max(...ranges.map(r => r.minZoom));
  const maxZoom = Math.min(...ranges.map(r => r.maxZoom));
  return minZoom <= maxZoom ? { minZoom, maxZoom } : null;
}

function updateZoomDisplay() {
  const display = document.getElementById('zoom-display');
  if (!display || !mapInstance || !mapInstance.getZoom) return;
  const current = mapInstance.getZoom().toFixed(2);
  const activeRange = getActiveZoomRange();
  if (activeRange) {
    display.textContent = `Zoom: ${current} (allowed ${activeRange.minZoom}-${activeRange.maxZoom})`;
  } else {
    display.textContent = `Zoom: ${current}`;
  }
}

function safeResizeMap() {
  if (!mapInstance || !mapInstance.getContainer) return;
  const container = mapInstance.getContainer();
  if (!container || !document.body.contains(container)) return;
  try {
    mapInstance.resize();
    updateZoomDisplay();
  } catch (err) {
    console.warn('Ignored map resize error:', err);
  }
}

// Initial load UI Icons
lucide.createIcons();

// Collapsible sidebar trigger logic
const sidebar = document.getElementById('sidebar');
const collapseBtn = document.getElementById('sidebar-collapse-btn');
const expandBtn = document.getElementById('sidebar-expand-btn');

collapseBtn.addEventListener('click', () => {
  sidebar.classList.add('collapsed');
  expandBtn.classList.add('visible');
  setTimeout(() => safeResizeMap(), 305);
});

expandBtn.addEventListener('click', () => {
  sidebar.classList.remove('collapsed');
  expandBtn.classList.remove('visible');
  setTimeout(() => safeResizeMap(), 305);
});

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'warning') icon = 'alert-triangle';
  if (type === 'error') icon = 'alert-circle';
  
  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  lucide.createIcons({attrs: {class: 'toast-icon'}});
  
  // Animate in
  setTimeout(() => toast.classList.add('visible'), 50);
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Build the dynamic UI controls
function buildLayerControls() {
  const container = document.getElementById('layers-container');
  container.innerHTML = '';

  LAYER_CONFIGS.forEach(config => {
    const row = document.createElement('div');
    row.className = 'layer-row';
    row.innerHTML = `
      <div class="layer-header">
        <div class="layer-title-badge">
          <span class="layer-color-dot" id="dot-${config.id}" style="background-color: ${config.defaultFillColor}"></span>
          <span>${config.name}</span>
        </div>
        <label class="switch">
          <input type="checkbox" id="toggle-${config.id}">
          <span class="slider-toggle"></span>
        </label>
      </div>
      <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px; line-height: 1.3;">
        ${config.description}
      </div>
      <span class="layer-styling-trigger" id="trigger-${config.id}">
        <i data-lucide="sliders" style="width: 12px; height: 12px;"></i> Custom Styling
      </span>
      
      <div class="layer-style-options" id="style-${config.id}">
        <div class="style-row">
          <div>
            <label>Fill Color</label>
            <div class="color-picker-wrapper">
              <input type="color" class="color-picker-input" id="fill-color-${config.id}" value="${config.defaultFillColor}">
              <span style="font-family: monospace; font-size: 0.75rem;" id="val-fill-color-${config.id}">${config.defaultFillColor}</span>
            </div>
          </div>
          <div>
            <label>Stroke Color</label>
            <div class="color-picker-wrapper">
              <input type="color" class="color-picker-input" id="stroke-color-${config.id}" value="${config.defaultStrokeColor}">
              <span style="font-family: monospace; font-size: 0.75rem;" id="val-stroke-color-${config.id}">${config.defaultStrokeColor}</span>
            </div>
          </div>
        </div>
        
        <div class="style-row" style="grid-template-columns: 1fr; margin-top: 8px;">
          <div class="slider-wrapper">
            <div class="value-header">
              <span>Fill Opacity</span>
              <span id="label-fill-opacity-${config.id}">${Math.round(config.defaultFillOpacity * 100)}%</span>
            </div>
            <input type="range" class="style-slider" id="fill-opacity-${config.id}" min="0" max="1" step="0.05" value="${config.defaultFillOpacity}">
          </div>
        </div>

        <div class="style-row" style="grid-template-columns: 1fr; margin-top: 8px;">
          <div class="slider-wrapper">
            <div class="value-header">
              <span>Stroke Width</span>
              <span id="label-stroke-width-${config.id}">${config.defaultStrokeWidth}px</span>
            </div>
            <input type="range" class="style-slider" id="stroke-width-${config.id}" min="0.5" max="8" step="0.1" value="${config.defaultStrokeWidth}">
          </div>
        </div>
      </div>
    `;
    container.appendChild(row);

    // Bind interactive event listeners for dynamic styling
    const trigger = row.querySelector(`#trigger-${config.id}`);
    const panel = row.querySelector(`#style-${config.id}`);
    trigger.addEventListener('click', () => {
      panel.classList.toggle('visible');
      trigger.classList.toggle('expanded');
    });

    // Layer Visibility Toggle
    const toggle = row.querySelector(`#toggle-${config.id}`);
    toggle.addEventListener('change', (e) => {
      const visible = e.target.checked;
      const visibilityVal = visible ? 'visible' : 'none';
      if (mapInstance) {
        if (mapInstance.getLayer(`${config.id}-fill`)) {
          mapInstance.setLayoutProperty(`${config.id}-fill`, 'visibility', visibilityVal);
        }
        if (mapInstance.getLayer(`${config.id}-outline`)) {
          mapInstance.setLayoutProperty(`${config.id}-outline`, 'visibility', visibilityVal);
        }
      }
      applyMapZoomRangeFromLoaded();
    });

    // Paint Fill Color Change
    const fillColorInput = row.querySelector(`#fill-color-${config.id}`);
    fillColorInput.addEventListener('input', (e) => {
      const val = e.target.value;
      document.getElementById(`val-fill-color-${config.id}`).textContent = val;
      document.getElementById(`dot-${config.id}`).style.backgroundColor = val;
      if (mapInstance && mapInstance.getLayer(`${config.id}-fill`)) {
        mapInstance.setPaintProperty(`${config.id}-fill`, 'fill-color', getColorExpression(val));
      }
    });

    // Paint Stroke Color Change
    const strokeColorInput = row.querySelector(`#stroke-color-${config.id}`);
    strokeColorInput.addEventListener('input', (e) => {
      const val = e.target.value;
      document.getElementById(`val-stroke-color-${config.id}`).textContent = val;
      if (mapInstance && mapInstance.getLayer(`${config.id}-outline`)) {
        mapInstance.setPaintProperty(`${config.id}-outline`, 'line-color', val);
      }
    });

    // Paint Fill Opacity Change
    const fillOpacityInput = row.querySelector(`#fill-opacity-${config.id}`);
    fillOpacityInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById(`label-fill-opacity-${config.id}`).textContent = `${Math.round(val * 100)}%`;
      if (mapInstance && mapInstance.getLayer(`${config.id}-fill`)) {
        mapInstance.setPaintProperty(`${config.id}-fill`, 'fill-opacity', val);
      }
    });

    // Paint Stroke Width Change
    const strokeWidthInput = row.querySelector(`#stroke-width-${config.id}`);
    strokeWidthInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById(`label-stroke-width-${config.id}`).textContent = `${val}px`;
      if (mapInstance && mapInstance.getLayer(`${config.id}-outline`)) {
        mapInstance.setPaintProperty(`${config.id}-outline`, 'line-width', val);
      }
    });
  });

  // Update icons for the dynamic controls
  lucide.createIcons();
}

// Initialize the file metadata viewer layout
function buildMetadataPlaceholder() {
  const container = document.getElementById('metadata-container');
  container.innerHTML = '';
  
  LAYER_CONFIGS.forEach(config => {
    const card = document.createElement('div');
    card.className = 'metadata-card';
    card.id = `meta-card-${config.id}`;
    card.innerHTML = `
      <div class="metadata-card-header">
        <span>${config.name}</span>
        <span class="metadata-status status-loading" id="meta-status-${config.id}">Waiting...</span>
      </div>
      <div class="metadata-grid" id="meta-grid-${config.id}">
        <span class="metadata-label">File name:</span>
        <span class="metadata-val" title="${config.file}">${config.file}</span>
      </div>
      <div class="metadata-error-msg" id="meta-error-${config.id}" style="display: none;"></div>
    `;
    container.appendChild(card);
  });
}

function ensureZoomPanel() {
  const sidebarContent = document.querySelector('.sidebar-content');
  if (!sidebarContent) return;
  if (document.getElementById('zoom-display')) return;

  const oldConnection = Array.from(sidebarContent.querySelectorAll('details.panel-section'))
    .find(detail => detail.textContent && detail.textContent.includes('Connection Settings'));
  if (oldConnection) {
    oldConnection.remove();
  }

  const details = document.createElement('details');
  details.className = 'panel-section';
  details.open = true;
  details.innerHTML = `
    <summary>
      <span class="summary-title-wrapper">
        <i data-lucide="zoom-in"></i> Zoom
      </span>
      <i data-lucide="chevron-down" class="section-chevron"></i>
    </summary>
    <div class="section-body">
      <div id="zoom-display">Zoom: --</div>
    </div>
  `;
  sidebarContent.prepend(details);
  lucide.createIcons();
}

// Fetch and populate metadata for PMTiles using pmtiles JS Client
function getBaseUrl() {
  return document.getElementById('base-url-input')?.value.trim() || './';
}

async function loadFileMetadata(baseUrl) {
  LAYER_CONFIGS.forEach(async (config) => {
    const statusBadge = document.getElementById(`meta-status-${config.id}`);
    const grid = document.getElementById(`meta-grid-${config.id}`);
    const errorDiv = document.getElementById(`meta-error-${config.id}`);

    statusBadge.textContent = 'Fetching...';
    statusBadge.className = 'metadata-status status-loading';
    errorDiv.style.display = 'none';

    const rawUrl = `${baseUrl}${config.file}`;
    // Resolve relative urls to absolute to help PMTiles library ranges
    const absoluteUrl = new URL(rawUrl, window.location.href).toString();
    
    try {
      const p = new pmtiles.PMTiles(absoluteUrl);
      const header = await p.getHeader();
      
      statusBadge.textContent = 'Loaded';
      statusBadge.className = 'metadata-status status-loaded';

      // Format bounds beautifully
      const boundsFormatted = `${header.minLon.toFixed(4)}, ${header.minLat.toFixed(4)} to ${header.maxLon.toFixed(4)}, ${header.maxLat.toFixed(4)}`;

      grid.innerHTML = `
        <span class="metadata-label">Source Layer:</span>
        <span class="metadata-val">${config.sourceLayer}</span>
        
        <span class="metadata-label">Min/Max Zoom:</span>
        <span class="metadata-val">z${header.minZoom} - z${header.maxZoom}</span>
        
        <span class="metadata-label">Bounds:</span>
        <span class="metadata-val" title="${boundsFormatted}">${boundsFormatted}</span>
        
        <span class="metadata-label">Spec Version:</span>
        <span class="metadata-val">v${header.specVersion}</span>

        <span class="metadata-label">Tile Type:</span>
        <span class="metadata-val">${header.tileType === 1 ? 'MVT (Vector)' : 'Raster'}</span>
      `;
    } catch (err) {
      console.error(`Metadata fetch error for ${config.file}:`, err);
      statusBadge.textContent = 'Failed';
      statusBadge.className = 'metadata-status status-error';
      errorDiv.textContent = `Error: ${err.message || 'Failed range request. Ensure server has CORS and HTTP Range Requests enabled.'}`;
      errorDiv.style.display = 'block';
    }
  });
}

// Initialize MapLibre Map
function initMap() {
  // Clear previous map if reloading
  if (mapInstance) {
    mapInstance.remove();
  }

  const mapOptions = {
    container: 'map-container',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [-2.5, 54.5], // Centered on Great Britain
    zoom: 5.5,
    pitch: 0,
    bearing: 0,
    renderWorldCopies: false,
    minZoom: 0,
    maxZoom: 24
  };

  mapInstance = new maplibregl.Map(mapOptions);

  // Expose for debugging and runtime inspection
  window.mapInstance = mapInstance;

  // Add navigation controls (zoom, bearing)
  mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

  // Set up click handlers and loading logic on load
  mapInstance.on('load', () => {
    showToast('Base Map Loaded (OpenFreeMap Liberty)', 'success');
    updateZoomDisplay();
    loadPMTilesLayers();
  });

  mapInstance.on('zoom', () => {
    updateZoomDisplay();
  });

  mapInstance.on('zoomend', () => {
    updateZoomDisplay();
  });

  mapInstance.on('error', (e) => {
    console.error('MapLibre GL error:', e);
    if (e.error && e.error.message && e.error.message.includes('CORS')) {
      showToast('CORS Blocked or Server Unreachable. Please check connection.', 'error');
    } else if (e.tile && e.tile.state === 'errored') {
      // suppress repeating toast warnings for tile loading fails
    } else {
      showToast(`Map Error: ${e.error ? e.error.message : 'Unknown map error'}`, 'warning');
    }
  });

  // Map click inspector
  mapInstance.on('click', (e) => {
    // Query only from active fill layers
    const activeFillLayers = LAYER_CONFIGS
      .filter(config => document.getElementById(`toggle-${config.id}`).checked)
      .map(config => `${config.id}-fill`);

    if (activeFillLayers.length === 0) {
      clearInspector();
      return;
    }

    const features = mapInstance.queryRenderedFeatures(e.point, { layers: activeFillLayers });
    
    if (features && features.length > 0) {
      displayFeatures(features);
    } else {
      clearInspector();
    }
  });
}

// Add PMTiles sources & styles dynamically
async function loadPMTilesLayers() {
  const baseUrl = getBaseUrl();
  showToast('Loading PMTiles sources...', 'info');
  
  loadedLayerZoomRanges = {};
  window.loadedLayerZoomRanges = loadedLayerZoomRanges;

  // Update metadata list representation
  loadFileMetadata(baseUrl);

  for (const config of LAYER_CONFIGS) {
    const sourceId = `source-${config.id}`;
    const rawUrl = `${baseUrl}${config.file}`;
    const absoluteUrl = new URL(rawUrl, window.location.href).toString();
    const pmtilesUrl = `pmtiles://${absoluteUrl}`;

    try {
      // Get minZoom and maxZoom dynamically from PMTiles header
      const p = new pmtiles.PMTiles(absoluteUrl);
      const header = await p.getHeader();
      const minZoom = header.minZoom;
      const maxZoom = header.maxZoom;
      loadedLayerZoomRanges[config.id] = { minZoom, maxZoom };
      window.loadedLayerZoomRanges = loadedLayerZoomRanges;

      // Add source
      mapInstance.addSource(sourceId, {
        type: 'vector',
        url: pmtilesUrl
      });

      // Find the first water layer to insert postcode layers underneath it.
      // This automatically masks out postcode boundaries extending into the sea,
      // and ensures postcodes are drawn beneath roads, water bodies, and labels.
      const beforeId = mapInstance.getLayer('water') ? 'water' : undefined;

      // Add Fill layer
      mapInstance.addLayer({
        id: `${config.id}-fill`,
        type: 'fill',
        source: sourceId,
        'source-layer': config.sourceLayer,
        minzoom: minZoom,
        maxzoom: maxZoom,
        paint: {
          'fill-color': getColorExpression(document.getElementById(`fill-color-${config.id}`).value),
          'fill-opacity': parseFloat(document.getElementById(`fill-opacity-${config.id}`).value)
        }
      }, beforeId);

      // Add Outline layer
      mapInstance.addLayer({
        id: `${config.id}-outline`,
        type: 'line',
        source: sourceId,
        'source-layer': config.sourceLayer,
        minzoom: minZoom,
        maxzoom: maxZoom,
        paint: {
          'line-color': document.getElementById(`stroke-color-${config.id}`).value,
          'line-width': parseFloat(document.getElementById(`stroke-width-${config.id}`).value),
          'line-opacity': 0.8
        }
      }, beforeId);

      // Respect toggle switches on load
      const isChecked = document.getElementById(`toggle-${config.id}`).checked;
      const visibility = isChecked ? 'visible' : 'none';
      mapInstance.setLayoutProperty(`${config.id}-fill`, 'visibility', visibility);
      mapInstance.setLayoutProperty(`${config.id}-outline`, 'visibility', visibility);

      // Change cursor to pointer when hovering over layers
      mapInstance.on('mouseenter', `${config.id}-fill`, () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });
      mapInstance.on('mouseleave', `${config.id}-fill`, () => {
        mapInstance.getCanvas().style.cursor = '';
      });
    } catch (err) {
      console.error(`Error adding layers for ${config.id}:`, err);
      showToast(`Error initializing layer: ${config.name}. Check Console.`, 'error');
    }
  }

  // Apply zoom constraints once after all layers have been added
  applyMapZoomRangeFromLoaded();
}

// Display clicked features in side panel
function displayFeatures(features) {
  const placeholder = document.getElementById('inspector-placeholder');
  const content = document.getElementById('inspector-content');

  placeholder.style.display = 'none';
  content.style.display = 'flex';
  content.innerHTML = '';

  // De-duplicate features by layer & properties
  const seen = new Set();
  const uniqueFeatures = [];
  
  features.forEach(f => {
    const key = `${f.layer.id}-${JSON.stringify(f.properties)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFeatures.push(f);
    }
  });

  uniqueFeatures.forEach((feature, idx) => {
    // Map back layer ID to human title
    const configId = feature.layer.id.replace('-fill', '');
    const config = LAYER_CONFIGS.find(c => c.id === configId);
    const displayName = config ? config.name : feature.layer.id;
    const color = config ? config.defaultFillColor : '#ffffff';

    const featDiv = document.createElement('div');
    featDiv.className = 'inspector-feature';
    
    let propertiesRows = '';
    const props = feature.properties;
    
    if (Object.keys(props).length === 0) {
      propertiesRows = `<tr><td colspan="2" style="color: var(--text-muted); font-style: italic;">No attributes available</td></tr>`;
    } else {
      for (const [key, value] of Object.entries(props)) {
        propertiesRows += `
          <tr>
            <td class="prop-key">${key}</td>
            <td class="prop-value">${value}</td>
          </tr>
        `;
      }
    }

    featDiv.innerHTML = `
      <div class="feature-title-row">
        <span style="font-weight: 600; font-size: 0.9rem;">Feature #${idx + 1}</span>
        <span class="feature-layer-badge" style="background-color: ${color}20; border: 1px solid ${color}60; color: ${color};">
          ${displayName}
        </span>
      </div>
      <table class="prop-table">
        <tbody>
          ${propertiesRows}
        </tbody>
      </table>
    `;
    content.appendChild(featDiv);
  });
  
  // Auto expand inspector section if it is closed
  const inspectorSection = document.getElementById('inspector-section');
  if (!inspectorSection.open) {
    inspectorSection.open = true;
  }
}

// Clear feature inspector
function clearInspector() {
  document.getElementById('inspector-placeholder').style.display = 'flex';
  document.getElementById('inspector-content').style.display = 'none';
  document.getElementById('inspector-content').innerHTML = '';
}

// Run Initialization
ensureZoomPanel();
buildLayerControls();
buildMetadataPlaceholder();
initMap();
