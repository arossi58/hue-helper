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
  allCultures: [],
  loading: false,
  loadingMore: false,
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
// UI Updates
// ============================================
function showSelectedColor(hex, position) {
  const container = document.getElementById('selected-color');
  const swatch = document.getElementById('color-swatch');
  const hexText = document.getElementById('color-hex');
  const posText = document.getElementById('color-position');
  
  container.classList.remove('hidden');
  swatch.style.backgroundColor = hex;
  hexText.textContent = hex.toUpperCase();
  posText.textContent = `Position: ${position.col}${position.row}`;
}

function showLoading(show) {
  state.loading = show;
  document.getElementById('loading').classList.toggle('hidden', !show);
}

function showLoadingMore(show) {
  state.loadingMore = show;
  const btn = document.getElementById('explore-more');
  btn.disabled = show;
  btn.innerHTML = show 
    ? '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> Researching...'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg> Explore More';
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
  const culturesListEl = document.getElementById('cultures-list');
  const countEl = document.getElementById('cultures-count');
  const exploreBtn = document.getElementById('explore-more');
  
  if (!state.result) {
    container.classList.add('hidden');
    return;
  }
  
  container.classList.remove('hidden');
  
  // Overview
  overviewSwatch.style.backgroundColor = state.selectedColor;
  summaryEl.textContent = state.result.colorSummary || '';
  
  // Cultures list
  culturesListEl.innerHTML = '';
  
  state.result.cultures?.forEach(culture => {
    const card = document.createElement('div');
    card.className = 'culture-card';
    
    card.innerHTML = `
      <div class="culture-header">
        <div class="culture-dot" style="background-color: ${state.selectedColor}"></div>
        <h4 class="culture-name">${culture.culture}</h4>
      </div>
      <p class="culture-significance">${culture.significance}</p>
      
      <div class="words-section">
        <p class="words-label">Adjectives</p>
        <div class="words-list">
          ${(culture.adjectives || []).map(adj => 
            `<span class="word-tag adjective">${adj}</span>`
          ).join('')}
        </div>
      </div>
      
      <div class="words-section">
        <p class="words-label">Associated With</p>
        <div class="words-list">
          ${(culture.nouns || []).map(noun => 
            `<span class="word-tag noun">${noun}</span>`
          ).join('')}
        </div>
      </div>
      
      ${culture.sources?.length ? `
        <div class="sources-section">
          <p class="sources-label">Sources</p>
          ${culture.sources.map(src => `
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
    
    culturesListEl.appendChild(card);
  });
  
  // Count display
  //countEl.textContent = `${state.allCultures.length} cultures explored`;
  
  exploreBtn.disabled = state.loadingMore;
}

// ============================================
// API Calls
// ============================================
async function fetchColorDescription(hex, location) {
  showError(null);
  showCacheStatus(null);
  showLoading(true);
  state.result = null;
  state.allCultures = [];

  // Check cache first
  const cached = checkCache(hex, location);
  if (cached) {
    state.cacheStatus = 'hit';
    state.result = cached;
    state.allCultures = cached.cultures?.map(c => c.culture) || [];
    showCacheStatus('hit');
    showLoading(false);
    renderResults();
    return;
  }

  state.cacheStatus = 'miss';
  
  try {
    console.log('Fetching from:', CONFIG.API_ENDPOINT);
    console.log('Color:', hex);
    
    const response = await fetch(CONFIG.API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.API_MODEL,
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
           content: `Research what this color means and represents in different countries: ${hex}

Use web search to find accurate, sourced information about how this color is perceived, used, and symbolized in specific countries.

After researching, return ONLY valid JSON with no additional text, in this exact format:
{
  "colorSummary": "A brief 1-2 sentence description of the color itself",
  "countries": [
    {
      "country": "Country name",
      "significance": "2-3 sentences about what this color means, symbolizes, or represents in this country",
      "adjectives": ["adj1", "adj2", "adj3", "adj4", "adj5", "adj6"],
      "nouns": ["specific noun 1", "specific noun 2", "specific noun 3", "specific noun 4", "specific noun 5", "specific noun 6"],
      "sources": [
        {"title": "Source title", "url": "https://example.com/article"}
      ]
    }
  ]
}

Include 4-5 different countries from around the world. For each country, provide:
- The country name
- The significance: what this color means, symbolizes, or represents in that country (traditions, holidays, politics, sports, religion, etc.)
- 5-6 adjectives that capture emotional or perceptual qualities associated with this color in that country
- 5-6 SPECIFIC nouns — not generic words like "nature" or "life", but concrete things like "Manchester United jerseys", "Chinese New Year envelopes", "Japanese torii gates", "Irish shamrocks", "Brazilian Carnival costumes"
- 1-2 source links that support the information

Be specific and concrete. Nouns should be things you can picture or point to, not abstract concepts.`
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
    state.allCultures = parsed.cultures?.map(c => c.culture) || [];
    showCacheStatus('miss');
    
  } catch (err) {
    console.error('API Error:', err);
    showError(`Failed to generate color analysis: ${err.message}`);
  } finally {
    showLoading(false);
    renderResults();
  }
}

async function fetchMoreCultures() {
  if (!state.selectedColor) return;

  showError(null);
  showLoadingMore(true);

  const excludeList = state.allCultures.join(', ');
  
  try {
    const response = await fetch(CONFIG.API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.API_MODEL,
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Research what this color means and represents in different countries: ${state.selectedColor}

Use web search to find accurate, sourced information about how this color is perceived, used, and symbolized in specific countries.

After researching, return ONLY valid JSON with no additional text, in this exact format:
{
  "countries": [
    {
      "country": "Country name",
      "significance": "2-3 sentences about what this color means, symbolizes, or represents in this country",
      "adjectives": ["adj1", "adj2", "adj3", "adj4", "adj5", "adj6"],
      "nouns": ["specific noun 1", "specific noun 2", "specific noun 3", "specific noun 4", "specific noun 5", "specific noun 6"],
      "sources": [
        {"title": "Source title", "url": "https://example.com/article"}
      ]
    }
  ]
}

Include 4-5 DIFFERENT countries. DO NOT include any of these countries that were already covered: ${excludeList}

For each NEW country, provide:
- The country name
- The significance: what this color means, symbolizes, or represents in that country
- 5-6 adjectives that capture emotional or perceptual qualities associated with this color in that country
- 5-6 SPECIFIC nouns — not generic words like "nature" or "life", but concrete things like "Manchester United jerseys", "Chinese New Year envelopes", "Japanese torii gates", "Irish shamrocks", "Brazilian Carnival costumes"
- 1-2 source links that support the information

Be specific and concrete. Explore countries from different continents. Nouns should be things you can picture or point to, not abstract concepts.`
        }]
      })
    });
    
    const data = await response.json();
    const text = data.content?.filter(i => i.type === 'text').map(i => i.text || '').join('') || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    
    const parsed = JSON.parse(jsonMatch[0].replace(/```json|```/g, '').trim());
    
    // Append new cultures
    state.result.cultures = [...(state.result.cultures || []), ...(parsed.cultures || [])];
    state.allCultures = [...state.allCultures, ...(parsed.cultures?.map(c => c.culture) || [])];
    
  } catch (err) {
    console.error('API Error:', err);
    showError('Failed to load more cultures. Please try again.');
  } finally {
    showLoadingMore(false);
    renderResults();
  }
}

// ============================================
// Event Handlers
// ============================================
function onColorSelected(hex, position) {
  state.selectedColor = hex;
  state.selectedPosition = position;
  showSelectedColor(hex, position);
  updateSearchButtonState();
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

  // Explore more button
  document.getElementById('explore-more').addEventListener('click', fetchMoreCultures);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
