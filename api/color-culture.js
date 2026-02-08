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
    console.error('❌ ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Check KV availability
  const kvConfigured = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
  if (!kvConfigured) {
    console.warn('⚠️ Vercel KV not configured - caching disabled');
  }

  try {
    // Extract color and location for caching
    const { hex, location } = extractColorAndLocation(req.body);
    console.log(`📝 Request: color=${hex}, location=${location}`);

    // CRITICAL: Always check database FIRST before calling AI API
    console.log('🔍 Checking Vercel KV database...');

    if (kvConfigured && hex && location) {
      const cacheKey = getCacheKey(hex, location);

      try {
        const cached = await kv.get(cacheKey);

        if (cached) {
          console.log(`✅ DATABASE HIT - returning cached result (no AI API call)`);
          console.log(`   Cache key: ${cacheKey}`);
          res.setHeader('X-Cache-Status', 'HIT');
          // EARLY RETURN - AI API never called
          return res.status(200).json(cached);
        }

        console.log(`❌ DATABASE MISS - result not in cache`);
        console.log(`   Cache key: ${cacheKey}`);
      } catch (kvError) {
        console.error('⚠️ Cache read error:', kvError.message);
        console.log('   Continuing to AI API despite cache error...');
      }
    } else {
      if (!kvConfigured) {
        console.warn('⚠️ Vercel KV not configured - database check skipped');
      }
      if (!hex || !location) {
        console.log('⚠️ Could not extract color/location - cache check skipped');
      }
    }

    // LAST RESORT: Call Anthropic API only if NOT found in database
    console.log('🤖 Calling AI API (last resort)...');
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

    // Handle rate limit errors with clear messaging
    if (response.status === 429) {
      console.error('⚠️ Rate limit hit - request not cached');
      return res.status(429).json(data);
    }

    // Save to database for future requests (avoid AI API calls)
    if (response.ok && kvConfigured && hex && location) {
      const cacheKey = getCacheKey(hex, location);
      console.log(`💾 Saving to database for all users...`);
      try {
        await kv.set(cacheKey, data, { ex: CACHE_DURATION });
        console.log(`✅ SAVED TO DATABASE: ${cacheKey}`);
        console.log(`   Next request for this color+location will use database (no AI call)`);
        console.log(`   Cache expires: ${new Date(Date.now() + CACHE_DURATION * 1000).toLocaleDateString()}`);
        res.setHeader('X-Cache-Status', 'MISS');
      } catch (cacheError) {
        console.error('❌ Database save error:', cacheError.message);
        console.error('   Warning: Result not cached - next request will call AI API again');
        // Continue even if caching fails
      }
    } else if (!response.ok) {
      console.error(`❌ API error ${response.status} - not caching`);
    } else if (!kvConfigured) {
      console.warn('⚠️ Result not cached (KV not configured) - all requests will call AI API');
    }

    return res.status(response.status).json(data);

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}