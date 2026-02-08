# Vercel KV Setup Guide

This guide will help you set up Vercel KV for shared caching across all users.

## Benefits
- **Reduce API costs**: Shared results mean fewer Claude API calls
- **Faster responses**: Cached results load instantly
- **Better UX**: Users benefit from previous searches by others
- **90-day cache**: Results stay fresh for 3 months

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Vercel KV Database

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project (hue-helper)
3. Go to the **Storage** tab
4. Click **Create Database**
5. Select **KV (Redis)**
6. Choose a name (e.g., "hue-helper-cache")
7. Select a region (choose closest to your users)
8. Click **Create**

### 3. Connect KV to Your Project

1. After creating the database, click **Connect to Project**
2. Select your `hue-helper` project
3. Vercel will automatically add the environment variables:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

### 4. Deploy

```bash
git add .
git commit -m "Add Vercel KV shared caching"
git push
```

Vercel will automatically deploy your changes.

## How It Works

### Caching Flow
1. **User searches** for a color + location (e.g., Red in Japan)
2. **Server checks** Vercel KV for existing results
3. **Cache HIT**: Return cached result instantly (no API call)
4. **Cache MISS**: Call Claude API, save to KV, return result
5. **Next user** searching the same color + location gets instant results

### Cache Status Messages
- **"Loaded from your cache"**: From your browser's localStorage
- **"Loaded from shared cache"**: From Vercel KV (another user searched this)
- **"Fresh results"**: New API call, now saved for everyone

### Cache Duration
- Results cached for **90 days**
- Automatically expires after that
- Can be adjusted in `api/color-culture.js` (CACHE_DURATION)

## Monitoring Cache Usage

View your KV database stats in the Vercel dashboard:
- Number of keys stored
- Storage used
- Request count
- Cache hit rate

## Pricing

Vercel KV Free Tier:
- 256 MB storage
- 30,000 commands per month
- More than enough for this app!

## Testing

After deployment, test the cache:

1. Search for a color (e.g., Red in Japan)
2. Check status: "Fresh results — saved to shared cache"
3. Search the same color+location again
4. Check status: "Loaded from shared cache — previously searched by another user!"

## Troubleshooting

### KV Not Working?
- Check environment variables are set in Vercel dashboard
- Verify KV database is connected to your project
- Check server logs in Vercel dashboard for errors

### Clear Cache
To clear the cache, go to your KV database in Vercel dashboard and use the Data Browser to delete keys.

## Local Development

For local development, create a `.env` file:

```bash
KV_URL=your_kv_url
KV_REST_API_URL=your_rest_api_url
KV_REST_API_TOKEN=your_token
KV_REST_API_READ_ONLY_TOKEN=your_readonly_token
```

Get these values from the Vercel KV dashboard → `.env.local` tab.
