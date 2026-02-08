import { kv } from '@vercel/kv';

// Cache duration: 90 days (in seconds)
const CACHE_DURATION = 90 * 24 * 60 * 60;

function getCacheKey(hex, location) {
  return `color:${hex.toLowerCase()}:${location.toLowerCase().trim()}`;
}

function extractColorAndLocation(requestBody) {
  // Extract from the messages array
  const message = requestBody?.messages?.[0]?.content || '';
  const hexMatch = message.match(/#([A-Fa-f0-9]{6})/);
  const locationMatch = message.match(/in ([^.]+)\./);

  return {
    hex: hexMatch ? `#${hexMatch[1]}` : null,
    location: locationMatch ? locationMatch[1].trim() : null
  };
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Extract color and location for caching
    const { hex, location } = extractColorAndLocation(req.body);

    // Check cache if we have both hex and location
    if (hex && location) {
      const cacheKey = getCacheKey(hex, location);
      const cached = await kv.get(cacheKey);

      if (cached) {
        console.log(`Cache HIT for ${cacheKey}`);
        // Return cached result with a special header
        res.setHeader('X-Cache-Status', 'HIT');
        return res.status(200).json(cached);
      }

      console.log(`Cache MISS for ${cacheKey}`);
    }

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // Save to cache if successful and we have cache key
    if (response.ok && hex && location) {
      const cacheKey = getCacheKey(hex, location);
      try {
        await kv.set(cacheKey, data, { ex: CACHE_DURATION });
        console.log(`Cached result for ${cacheKey}`);
        res.setHeader('X-Cache-Status', 'MISS');
      } catch (cacheError) {
        console.error('Cache save error:', cacheError);
        // Continue even if caching fails
      }
    }

    return res.status(response.status).json(data);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}