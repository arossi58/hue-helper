# Cache-First Architecture

This document explains how Hue Helper ensures the database is **always checked first** and the AI API is used as an **absolute last resort**.

## 🎯 Three-Layer Cache Strategy

### Layer 1: Client Cache (localStorage) ⚡️ INSTANT
- **Location**: User's browser
- **Duration**: 30 days
- **Speed**: Instant (0ms)
- **Scope**: Individual user only

### Layer 2: Server Cache (Vercel KV) 🌐 SHARED
- **Location**: Vercel/Upstash database
- **Duration**: 90 days
- **Speed**: Very fast (~50-100ms)
- **Scope**: All users worldwide

### Layer 3: AI API (Anthropic Claude) 🤖 LAST RESORT
- **Location**: Anthropic servers
- **Duration**: N/A (fresh generation)
- **Speed**: Slow (~5-15 seconds)
- **Cost**: $$ per request
- **Scope**: New result, then saved to both caches

---

## 🔄 Complete Request Flow

```
User clicks "Research Color"
    ↓
┌─────────────────────────────────────────┐
│ STEP 1: Check localStorage              │
│ ✅ HIT  → Return instantly (0ms)        │
│ ❌ MISS → Continue to Step 2            │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STEP 2: Check Vercel KV Database        │
│ ✅ HIT  → Return from cache (~100ms)    │
│          Save to localStorage           │
│          Status: "Loaded from shared    │
│          cache"                          │
│ ❌ MISS → Continue to Step 3            │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ STEP 3: Call AI API (LAST RESORT)       │
│ 🤖 Generate fresh result (~10s)         │
│ 💾 Save to Vercel KV (90 days)          │
│ 💾 Save to localStorage (30 days)       │
│ Status: "Fresh results — saved for all  │
│ users"                                   │
└─────────────────────────────────────────┘
```

---

## 🛡️ Safeguards & Protections

### 1. **Early Return Pattern**
Both cache layers use early returns to prevent any chance of unnecessary API calls:

```javascript
// Client-side (app.js)
const cached = checkCache(hex, location);
if (cached) {
  showCacheStatus('hit');
  renderResults();
  return; // ← EARLY EXIT: AI API never called
}

// Server-side (api/color-culture.js)
const cached = await kv.get(cacheKey);
if (cached) {
  res.setHeader('X-Cache-Status', 'HIT');
  return res.status(200).json(cached); // ← EARLY EXIT: AI API never called
}
```

### 2. **Rate Limit Protection**
Client-side rate limiting prevents excessive requests:
- **Limit**: 5 API calls per minute
- **Protection**: Shows wait time if limit exceeded
- **Purpose**: Prevents accidental API abuse

### 3. **Explicit Logging**
Every step is logged with emojis for visibility:

```
🔍 Step 1: Checking local cache (localStorage)...
✅ Found in local cache - using cached result
```

Or for cache misses:

```
🔍 Step 1: Checking local cache (localStorage)...
❌ Not in local cache
🔍 Step 2: Checking server cache (Vercel KV)...
✅ DATABASE HIT - returning cached result (no AI API call)
```

Or for complete misses:

```
🔍 Step 1: Checking local cache (localStorage)...
❌ Not in local cache
🔍 Step 2: Checking server cache (Vercel KV)...
❌ DATABASE MISS - result not in cache
🤖 Calling AI API (last resort)...
💾 Saving to database for all users...
✅ SAVED TO DATABASE: color:#ffff00:united states
```

### 4. **Cache Key Consistency**
Identical cache keys across all layers ensure reliable hits:

```javascript
// Format: color:#{hex}:{location}
// Example: color:#ff0000:japan
// Always lowercase, trimmed
```

---

## 📊 Cache Hit Scenarios

### Scenario A: Repeat Search (Same User)
User searches "Red in Japan" twice:

1. First search: MISS → MISS → AI API → Save to both caches
2. Second search: **HIT (localStorage)** → Return in 0ms

**Result**: No server or AI calls on repeat searches

### Scenario B: Another User's Search
User A searches "Blue in France", then User B searches the same:

1. User A: MISS → MISS → AI API → Saves to Vercel KV
2. User B: MISS (localStorage) → **HIT (Vercel KV)** → Return in ~100ms

**Result**: No AI call for User B, shared cache used

### Scenario C: Popular Color
"Red in United States" searched by 100 users:

1. First user: MISS → MISS → AI API → Saves to database
2. Next 99 users: MISS → **HIT (Vercel KV)** → Fast response

**Result**: Only 1 AI call for 100 requests (99% cache hit rate)

---

## 🔧 Monitoring Cache Effectiveness

### Check Vercel Logs
View real-time cache status:
```
✅ Cache HIT for color:#ff0000:japan
❌ Cache MISS for color:#00ff00:brazil
💾 SAVED TO DATABASE: color:#00ff00:brazil
```

### Browser Console
Watch the cache flow in DevTools:
```
🔍 Step 1: Checking local cache (localStorage)...
❌ Not in local cache
🔍 Step 2: Checking server cache (Vercel KV)...
✅ Found in server cache (Vercel KV) - no AI API call made
```

### Cache Status UI
The app shows users where results came from:
- **"Loaded from your cache"** = localStorage hit
- **"Loaded from shared cache"** = Vercel KV hit
- **"Fresh results"** = AI API called

---

## 💰 Cost Savings

### Without Caching
- 100 searches = 100 AI API calls
- Cost: ~$2.00 (at $0.02/call)
- Time: ~1000 seconds total

### With Cache-First Architecture
- 100 searches = 10 unique queries × 1 AI call each
- Cost: ~$0.20 (90% savings!)
- Time: ~100 seconds total
- Cache hits: ~90 searches served in <100ms

---

## 🚀 Deployment Checklist

To ensure cache-first architecture works:

1. ✅ Vercel KV database created
2. ✅ Environment variables set:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`
   - `ANTHROPIC_API_KEY`
3. ✅ `@vercel/kv` package installed
4. ✅ Code deployed to Vercel
5. ✅ Test cache flow in Vercel logs

---

## ❓ Troubleshooting

### "Too many requests!" error
- **Cause**: Hit client-side rate limit (5/minute)
- **Solution**: Wait indicated seconds, then retry
- **Prevention**: Results are cached - you shouldn't hit this often

### API called when it shouldn't be
- **Check**: Are environment variables set in Vercel?
- **Check**: Is `@vercel/kv` properly installed?
- **Check**: Look for cache errors in Vercel logs

### Cache not being saved
- **Check**: Vercel logs for "SAVED TO DATABASE" message
- **Check**: KV database is connected to project
- **Check**: No errors in cache save attempt

---

## 🎉 Summary

**The AI API is truly the last resort:**

1. ✅ Client cache checked first (instant)
2. ✅ Server cache checked second (fast)
3. ✅ AI API called only if both miss (slow, expensive)
4. ✅ Results saved to both caches for future requests
5. ✅ Rate limiting prevents excessive API usage
6. ✅ Comprehensive logging shows cache-first flow

**Your database is always checked first. The AI API is never called unless absolutely necessary.**
