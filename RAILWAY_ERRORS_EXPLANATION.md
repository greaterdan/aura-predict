# Railway Errors Explanation

## Error Summary

You're seeing multiple errors that indicate server/deployment issues:

### 1. **502 Bad Gateway**
- **Meaning**: Server is down, crashing, or not responding
- **Cause**: Server process might have crashed or failed to start
- **Fix**: Check Railway logs to see if server started successfully

### 2. **404 Not Found**
- **Meaning**: Endpoint doesn't exist or server can't find it
- **Cause**: Server might not be running, or routes aren't registered
- **Fix**: Ensure server starts and routes are registered

### 3. **ERR_CERT_COMMON_NAME_INVALID**
- **Meaning**: SSL certificate doesn't match the domain name
- **Cause**: Railway SSL certificate might not be properly configured for `mira.tech`
- **Fix**: 
  - Check Railway domain settings
  - Ensure custom domain is properly configured
  - Railway should auto-provision SSL, but might need manual setup

### 4. **CSS served as JSON (MIME type error)**
- **Meaning**: CSS file request returns JSON instead of CSS
- **Cause**: Static file serving is broken - CSS files don't exist or catch-all route is serving JSON 404
- **Fix**: 
  - Ensure `npm run build` runs successfully
  - Check that `dist/` folder exists with CSS files
  - Fixed in code: Now returns proper MIME type for missing CSS files

## How to Fix

### Step 1: Check Railway Logs
1. Go to Railway dashboard
2. Click on your service
3. Check "Deployments" tab for build errors
4. Check "Logs" tab for runtime errors

### Step 2: Verify Build Process
The build should run:
```bash
npm install
npm run build        # Builds frontend (Vite)
npm run build:server # Builds server TypeScript
```

### Step 3: Check Server Startup
Look for these log messages:
- `✅ Server running on port ${PORT}`
- `✅ Frontend build found at: ${distPath}`
- `✅ Healthcheck available at http://0.0.0.0:${PORT}/api/health`

### Step 4: Verify SSL Certificate
1. In Railway, go to your service
2. Click "Settings" → "Networking"
3. Check if custom domain `mira.tech` is configured
4. Ensure SSL certificate is provisioned (Railway does this automatically)

### Step 5: Test Healthcheck
Try accessing:
- `https://mira.tech/api/health` - Should return `{"status":"ok"}`
- `https://mira.tech/api/agents/summary` - Should return agent data

## Common Issues

### Issue: Server crashes on startup
**Symptoms**: 502 errors, no logs
**Fix**: Check Railway logs for:
- TypeScript compilation errors
- Missing environment variables
- Module import errors

### Issue: Static files not found
**Symptoms**: CSS/JS files return 404 or JSON
**Fix**: 
- Ensure `dist/` folder is built
- Check `railway.toml` build command includes `npm run build`
- Verify static file serving middleware is working

### Issue: SSL certificate error
**Symptoms**: `ERR_CERT_COMMON_NAME_INVALID`
**Fix**:
- Wait for Railway to auto-provision SSL (can take a few minutes)
- Or manually configure SSL in Railway settings
- Check domain DNS settings point to Railway

## Quick Debugging

1. **Check if server is running**:
   ```bash
   curl https://mira.tech/api/health
   ```

2. **Check if static files exist**:
   ```bash
   curl https://mira.tech/assets/index-*.css
   ```

3. **Check Railway build logs**:
   - Look for "✅ Server running" message
   - Look for "✅ Frontend build found" message

## Next Steps

1. Check Railway logs to see what's actually happening
2. Verify the build process completes successfully
3. Ensure all environment variables are set
4. Check SSL certificate status in Railway dashboard

