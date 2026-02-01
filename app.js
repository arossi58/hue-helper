// ============================================
// Configuration
// ============================================
const CONFIG = {
  CACHE_DURATION_DAYS: 30,
  API_MODEL: 'claude-sonnet-4-20250514',
  // Vercel serverless function endpoint
  API_ENDPOINT: 'https://hue-helper.vercel.app/api/color-culture',
};

// ============================================
// State
// ============================================
let state = {
  selectedColor: null,
  selectedPosition: null,
  selectedLocation: null,
  result: null,
  loading: false,
  error: null,
  cacheStatus: null,
};

// ============================================
// Storage Helpers (using localStorage)
// ============================================
function getFromStorage(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error('Storage read error:', e);
    return null;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage write error:', e);
  }
}

// ============================================
// Cache Helpers
// ============================================
function getCacheKey(hex, location) {
  return `color-cache:${hex.toLowerCase()}:${location || 'global'}`;
}

function checkCache(hex, location) {
  const cached = getFromStorage(getCacheKey(hex, location));
  if (!cached) return null;

  const age = Date.now() - (cached.timestamp || 0);
  const maxAge = CONFIG.CACHE_DURATION_DAYS * 24 * 60 * 60 * 1000;

  return age < maxAge ? cached.data : null;
}

function saveToCache(hex, location, data) {
  saveToStorage(getCacheKey(hex, location), {
    data,
    timestamp: Date.now(),
  });
}

// ============================================
// Theme Helpers
// ============================================
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function applyColorTheme(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Generate theme colors based on the selected color
  const baseColor = `hsl(${hsl.h}, ${Math.max(hsl.s, 50)}%, ${Math.min(Math.max(hsl.l, 45), 55)}%)`;
  const hoverColor = `hsl(${hsl.h}, ${Math.max(hsl.s, 50)}%, ${Math.min(Math.max(hsl.l, 55), 65)}%)`;
  const lightColor = `hsl(${hsl.h}, ${Math.max(hsl.s, 40)}%, ${Math.min(Math.max(hsl.l, 45), 55)}%, 0.2)`;
  const borderColor = `hsl(${hsl.h}, ${Math.max(hsl.s, 40)}%, ${Math.min(Math.max(hsl.l, 45), 55)}%, 0.4)`;
  const tagColor = `hsl(${hsl.h}, ${Math.max(hsl.s, 35)}%, ${Math.min(Math.max(hsl.l, 65), 75)}%)`;
  const linkColor = `hsl(${hsl.h}, ${Math.max(hsl.s, 40)}%, ${Math.min(Math.max(hsl.l, 60), 70)}%)`;
  const linkHoverColor = `hsl(${hsl.h}, ${Math.max(hsl.s, 40)}%, ${Math.min(Math.max(hsl.l, 75), 85)}%)`;

  document.documentElement.style.setProperty('--accent-color', baseColor);
  document.documentElement.style.setProperty('--accent-color-hover', hoverColor);
  document.documentElement.style.setProperty('--accent-color-light', lightColor);
  document.documentElement.style.setProperty('--accent-color-border', borderColor);
  document.documentElement.style.setProperty('--accent-color-tag', tagColor);
  document.documentElement.style.setProperty('--accent-color-link', linkColor);
  document.documentElement.style.setProperty('--accent-color-link-hover', linkHoverColor);
}

function resetColorTheme() {
  // Reset to greyscale
  document.documentElement.style.setProperty('--accent-color', '#6b7280');
  document.documentElement.style.setProperty('--accent-color-hover', '#9ca3af');
  document.documentElement.style.setProperty('--accent-color-light', 'rgba(107, 114, 128, 0.2)');
  document.documentElement.style.setProperty('--accent-color-border', 'rgba(107, 114, 128, 0.4)');
  document.documentElement.style.setProperty('--accent-color-tag', 'rgb(156, 163, 175)');
  document.documentElement.style.setProperty('--accent-color-link', '#9ca3af');
  document.documentElement.style.setProperty('--accent-color-link-hover', '#d1d5db');
}

// ============================================
// UI Updates
// ============================================
function showSelectedColor(hex) {
  const container = document.getElementById('selected-color');
  const swatch = document.getElementById('color-swatch');
  const hexText = document.getElementById('color-hex');

  container.classList.remove('hidden');
  swatch.style.backgroundColor = hex;
  hexText.textContent = hex.toUpperCase();
}

function showLoading(show) {
  state.loading = show;
  document.getElementById('loading').classList.toggle('hidden', !show);
}


function showError(message) {
  const el = document.getElementById('error');
  if (message) {
    el.textContent = message;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function showCacheStatus(status) {
  const el = document.getElementById('cache-status');
  if (!status) {
    el.classList.add('hidden');
    return;
  }
  
  el.classList.remove('hidden', 'hit', 'miss');
  el.classList.add(status);
  
  if (status === 'hit') {
    el.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 13l4 4L19 7"/>
      </svg>
      Loaded from cache — no API call used!
    `;
  } else {
    el.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
      </svg>
      Fresh results — saved to cache for future searches
    `;
  }
}

function renderResults() {
  const container = document.getElementById('results');
  const overviewSwatch = document.getElementById('overview-swatch');
  const summaryEl = document.getElementById('color-summary');
  const researchListEl = document.getElementById('cultures-list');

  if (!state.result) {
    container.classList.add('hidden');
    return;
  }

  // Apply color theme when results are available
  if (state.selectedColor) {
    applyColorTheme(state.selectedColor);
  }

  container.classList.remove('hidden');

  // Overview
  overviewSwatch.style.backgroundColor = state.selectedColor;
  summaryEl.textContent = state.result.colorSummary || '';

  // Research results
  researchListEl.innerHTML = '';

  state.result.countries?.forEach(country => {
    const card = document.createElement('div');
    card.className = 'culture-card';

    card.innerHTML = `
      <div class="culture-header">
        <div class="culture-dot" style="background-color: ${state.selectedColor}"></div>
        <h4 class="culture-name">${country.country}</h4>
      </div>
      <p class="culture-significance">${country.significance}</p>

      <div class="words-section">
        <p class="words-label">Adjectives</p>
        <div class="words-list">
          ${(country.adjectives || []).map(adj =>
            `<span class="word-tag adjective">${adj}</span>`
          ).join('')}
        </div>
      </div>

      <div class="words-section">
        <p class="words-label">Associated With</p>
        <div class="words-list">
          ${(country.nouns || []).map(noun =>
            `<span class="word-tag noun">${noun}</span>`
          ).join('')}
        </div>
      </div>

      ${country.sources?.length ? `
        <div class="sources-section">
          <p class="sources-label">Sources</p>
          ${country.sources.map(src => `
            <a href="${src.url}" target="_blank" rel="noopener noreferrer" class="source-link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
              ${src.title || src.url}
            </a>
          `).join('')}
        </div>
      ` : ''}
    `;

    researchListEl.appendChild(card);
  });
}

// ============================================
// API Calls
// ============================================
async function fetchColorDescription(hex, location) {
  showError(null);
  showCacheStatus(null);
  showLoading(true);
  state.result = null;

  // Check cache first
  const cached = checkCache(hex, location);
  if (cached) {
    state.cacheStatus = 'hit';
    state.result = cached;
    showCacheStatus('hit');
    showLoading(false);
    renderResults();
    return;
  }

  state.cacheStatus = 'miss';
  
  try {
    console.log('Fetching from:', CONFIG.API_ENDPOINT);
    console.log('Color:', hex);
    console.log('Country:', location);

    const response = await fetch(CONFIG.API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.API_MODEL,
        max_tokens: 2048,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
           content: `Research color ${hex} in ${location}. Use web search for accurate information.

Return ONLY valid JSON:
{
  "colorSummary": "1-2 sentence description of the color",
  "countries": [
    {
      "country": "${location}",
      "significance": "2-3 sentences about meaning in ${location}",
      "adjectives": ["adj1", "adj2", "adj3", "adj4", "adj5"],
      "nouns": ["specific noun 1", "specific noun 2", "specific noun 3", "specific noun 4", "specific noun 5"],
      "sources": [
        {"title": "Source title 1", "url": "https://example1.com"},
        {"title": "Source title 2", "url": "https://example2.com"}
      ]
    }
  ]
}

Include:
- Significance in ${location} (traditions, holidays, politics, sports, religion)
- 5 adjectives for emotional/perceptual qualities
- 5 SPECIFIC concrete nouns (like "Manchester United jerseys", "Chinese New Year envelopes")
- AT LEAST 2 source links (provide more if available)

IMPORTANT: You MUST include at least 2 sources with valid URLs. More sources are encouraged if available.`
        }]
      })
    });
    
    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('API Response:', data);
    
    // Check for API errors
    if (data.error) {
      throw new Error(data.error.message || data.error);
    }
    
    const text = data.content?.filter(i => i.type === 'text').map(i => i.text || '').join('') || '';
    console.log('Extracted text:', text.substring(0, 500));
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in text:', text);
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0].replace(/```json|```/g, '').trim());
    console.log('Parsed result:', parsed);

    // Save to cache
    saveToCache(hex, location, parsed);

    state.result = parsed;
    showCacheStatus('miss');
    
  } catch (err) {
    console.error('API Error:', err);
    showError(`Failed to generate color analysis: ${err.message}`);
  } finally {
    showLoading(false);
    renderResults();
  }
}


// ============================================
// Event Handlers
// ============================================
function onColorSelected(hex, position) {
  state.selectedColor = hex;
  state.selectedPosition = position;
  showSelectedColor(hex);
  updateSearchButtonState();

  // Reset theme to greyscale when new color is selected
  resetColorTheme();

  // Hide previous results
  document.getElementById('results').classList.add('hidden');

  // Don't auto-fetch - wait for button click
}

function onLocationChange() {
  const input = document.getElementById('location-select');
  state.selectedLocation = input.value.trim();
  updateSearchButtonState();
}

function updateSearchButtonState() {
  const btn = document.getElementById('search-btn');
  btn.disabled = !state.selectedColor || !state.selectedLocation;
}

function onSearchClick() {
  if (state.selectedColor && state.selectedLocation) {
    fetchColorDescription(state.selectedColor, state.selectedLocation);
  }
}

// ============================================
// Initialization
// ============================================
function initApp() {
  // Location selector - listen to both input and change events
  const locationInput = document.getElementById('location-select');
  locationInput.addEventListener('input', onLocationChange);
  locationInput.addEventListener('change', onLocationChange);

  // Search button
  document.getElementById('search-btn').addEventListener('click', onSearchClick);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
