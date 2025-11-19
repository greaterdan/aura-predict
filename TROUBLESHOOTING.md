# Troubleshooting Healthcheck Failure

## Issue
Railway healthcheck is failing with "service unavailable" even though the build succeeds.

## Possible Causes

### 1. Server Not Starting
The server might be crashing during startup. Check Railway logs for:
- Error messages
- Stack traces
- "Server running on port" message (should appear if server starts)

### 2. Port Configuration
Railway automatically sets `PORT` environment variable. The server should use:
```javascript
const PORT = process.env.PORT || 3002;
```

### 3. Missing Dependencies
Check if all npm packages are installed correctly. Railway runs `npm ci` which should handle this.

### 4. Build Issues
Even though build succeeds, the `dist` folder might not be created. Check logs for:
- "Frontend build found" message
- Build errors during `npm run build`

## Debugging Steps

### Check Railway Logs
1. Go to Railway dashboard
2. Click on your service
3. View "Deployments" → Latest deployment → "View Logs"
4. Look for:
   - `✅ Server running on port`
   - `✅ Healthcheck available`
   - Any error messages

### Test Locally
```bash
# Build frontend
npm run build

# Start server
npm run server

# Test healthcheck
curl http://localhost:3002/api/health
```

### Verify Environment Variables
In Railway dashboard, check:
- `NODE_ENV=production` (set automatically)
- `PORT` (set automatically by Railway)
- `ALLOWED_ORIGINS` (should include your domain)

## Quick Fixes

### If dist folder is missing:
The server will now start anyway, but frontend won't be served. Check Railway build logs to see if `npm run build` completed.

### If server crashes:
Check Railway logs for the exact error. Common issues:
- Missing environment variables
- Port already in use (shouldn't happen on Railway)
- Syntax errors in code

## Next Steps

1. **Check Railway logs** - Look for startup messages or errors
2. **Verify build completed** - Look for "built in X.XXs" message
3. **Check server logs** - Look for "Server running on port" message
4. **Test healthcheck manually** - Once server starts, test `/api/health` endpoint

## If Still Failing

Share the Railway logs (especially the startup section) and we can debug further.

