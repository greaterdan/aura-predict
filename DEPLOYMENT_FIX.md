# Frontend Deployment Fix

## Problem
Your Railway deployment was only serving the backend API on port 8080. The frontend (React app) wasn't being served, so when you visited `probly.tech`, you only saw API responses, not the actual website.

## Solution
I've updated your Express server to serve the built frontend files. Here's what changed:

### Changes Made

1. **Added static file serving** in `server/index.js`:
   - Serves static assets (JS, CSS, images) from the `dist` folder
   - Handles React Router by serving `index.html` for all non-API routes
   - This allows your SPA (Single Page Application) to work correctly

2. **Railway configuration** (`railway.toml`) is already correct:
   - Builds frontend with `npm run build`
   - Starts server with `npm run server`

## What Happens Now

When Railway deploys:
1. ✅ Builds the frontend (`npm run build` → creates `dist/` folder)
2. ✅ Starts the Express server (`npm run server`)
3. ✅ Server serves API routes at `/api/*`
4. ✅ Server serves frontend at all other routes (`/`, `/about`, etc.)

## Next Steps

### 1. Commit and Push Changes
```bash
git add server/index.js
git commit -m "Add frontend static file serving"
git push
```

### 2. Railway Will Auto-Deploy
Railway will automatically:
- Build the frontend
- Deploy with the updated server code
- Serve both API and frontend from the same domain

### 3. Verify DNS is Correct
Make sure your Namecheap CNAME points to:
```
probly.tech → your-railway-domain.railway.app
```

Or if Railway gave you a specific domain, use that.

### 4. Wait for DNS Propagation
DNS changes can take up to 48 hours, but usually work within a few minutes to an hour.

### 5. Test Your Site
Once deployed, visit:
- `https://probly.tech` - Should show your React frontend
- `https://probly.tech/api/health` - Should show API health check
- `https://probly.tech/api/predictions` - Should show predictions API

## How It Works

```
User visits probly.tech
    ↓
Railway routes to your server (port 8080)
    ↓
Express server checks the route:
    ├─ /api/* → API endpoints (predictions, news, etc.)
    ├─ /health → Health check
    └─ /* → Serve index.html (React app handles routing)
```

## Troubleshooting

### Still seeing API responses instead of frontend?

1. **Check Railway logs** - Look for:
   ```
   ✅ Frontend build found at: /path/to/dist
   ```

2. **Verify build is running** - Railway should run `npm run build` during deployment

3. **Check dist folder exists** - The build should create a `dist/` folder

4. **Clear browser cache** - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Frontend shows but API calls fail?

1. **Check CORS** - Make sure `ALLOWED_ORIGINS` in Railway includes `https://probly.tech`

2. **Check API routes** - Visit `https://probly.tech/api/health` directly

### DNS not working?

1. **Verify CNAME** in Namecheap points to Railway domain
2. **Check DNS propagation**: https://www.whatsmydns.net/
3. **Wait longer** - DNS can take up to 48 hours

## Environment Variables

Make sure these are set in Railway:
- `ALLOWED_ORIGINS` - Should include `https://probly.tech`
- `NODE_ENV=production`
- All your API keys (NEWS_API_KEY, etc.)

## Summary

✅ **Fixed**: Server now serves frontend static files  
✅ **Ready**: Just commit, push, and Railway will deploy  
✅ **Result**: `probly.tech` will show your full React app!

