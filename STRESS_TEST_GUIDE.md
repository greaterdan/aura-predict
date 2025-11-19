# Stress Test Guide - Aura Predict

This guide explains how to run stress tests to determine your application's capacity and performance under load.

## Quick Start

### Test Local Server
```bash
# Test against local server (default: http://localhost:3002)
npm run stress-test:light
```

### Test Production Server
```bash
# Set the target URL and run test
TEST_URL=https://your-production-domain.com npm run stress-test:medium
```

## Test Scenarios

### 1. Light Load (10 users, 30 seconds)
```bash
npm run stress-test:light
```
- **Concurrent Users:** 10
- **Duration:** 30 seconds
- **Use Case:** Baseline performance test

### 2. Medium Load (50 users, 60 seconds)
```bash
npm run stress-test:medium
```
- **Concurrent Users:** 50
- **Duration:** 60 seconds
- **Use Case:** Normal traffic simulation

### 3. Heavy Load (100 users, 120 seconds)
```bash
npm run stress-test:heavy
```
- **Concurrent Users:** 100
- **Duration:** 120 seconds
- **Use Case:** Peak traffic simulation

### 4. Extreme Load (200 users, 180 seconds)
```bash
npm run stress-test:extreme
```
- **Concurrent Users:** 200
- **Duration:** 180 seconds
- **Use Case:** Stress test to find breaking point

## Understanding Results

### Key Metrics

1. **Requests/Second (RPS)**
   - How many requests your server can handle per second
   - Higher is better

2. **Success Rate**
   - Percentage of successful requests (200-299 status codes)
   - Should be > 95% for healthy system

3. **Response Times**
   - **p50 (Median):** Half of requests are faster than this
   - **p95:** 95% of requests are faster than this
   - **p99:** 99% of requests are faster than this
   - Lower is better

4. **Rate Limiting**
   - Shows how many requests were rate-limited (429 status)
   - Expected for `/api/predictions` (30/min limit) and `/api/waitlist` (5/hour limit)

### Example Output

```
📈 Request Statistics:
   Total Requests: 2,450
   Successful: 2,380 (97.14%)
   Failed: 45 (1.84%)
   Rate Limited: 25 (1.02%)
   Requests/Second: 40.83

⏱️  Response Time Statistics (ms):
   Min: 45.23
   Max: 1,234.56
   Average: 156.78
   Median (p50): 142.33
   p95: 345.67
   p99: 567.89
```

## What Gets Tested

The stress test simulates real user behavior by testing:

1. **Health Check** (10% of requests)
   - `/api/health` - Fast endpoint

2. **Predictions** (40% of requests)
   - `/api/predictions` - Main endpoint

3. **Predictions with Category** (20% of requests)
   - `/api/predictions?category=Politics`

4. **Predictions with Search** (15% of requests)
   - `/api/predictions?search=bitcoin`

5. **News** (10% of requests)
   - `/api/news`

6. **Legacy Markets** (5% of requests)
   - `/api/polymarket/markets?limit=50`

## Interpreting Results

### ✅ Healthy System
- Success rate > 95%
- p95 response time < 1000ms
- No server errors (500s)
- Rate limiting working correctly (429s for rate-limited endpoints)

### ⚠️ Warning Signs
- Success rate < 90%
- p95 response time > 2000ms
- Many 500 errors
- Server crashes or timeouts

### 🔴 Critical Issues
- Success rate < 50%
- p95 response time > 5000ms
- Server becomes unresponsive
- Memory leaks or crashes

## Capacity Estimation

The test provides an estimated capacity based on results:

```
💡 Capacity Estimation:
   Estimated capacity: ~2,448 requests/minute
   With 50 concurrent users
   Estimated max concurrent users: ~100
```

This gives you a rough idea of how many concurrent users your server can handle.

## Rate Limiting Behavior

Your server has rate limits configured:

- **General API:** 100 requests per 15 minutes per IP
- **Predictions:** 30 requests per minute per IP
- **Waitlist:** 5 requests per hour per IP

You'll see 429 status codes when these limits are hit, which is **expected behavior**.

## Tips for Accurate Testing

1. **Test Against Production**
   - Use your actual production URL
   - Test during off-peak hours initially

2. **Start Small**
   - Begin with light load, then increase
   - Monitor server resources (CPU, memory)

3. **Monitor Server Logs**
   - Watch for errors in Railway logs
   - Check for memory leaks or crashes

4. **Test Different Scenarios**
   - Test with cache hits (repeat same requests)
   - Test with cache misses (different categories)

5. **Consider External APIs**
   - Polymarket API rate limits
   - News API rate limits
   - These may affect your results

## Customizing Tests

Edit `stress-test.js` to customize:

- **Endpoints:** Modify `CONFIG.ENDPOINTS`
- **Weights:** Change request distribution
- **Scenarios:** Adjust concurrent users and duration
- **Base URL:** Set `TEST_URL` environment variable

## Example: Testing Production

```bash
# Test production with medium load
TEST_URL=https://probly.tech npm run stress-test:medium

# Test production with heavy load
TEST_URL=https://probly.tech npm run stress-test:heavy
```

## Monitoring During Tests

While running stress tests, monitor:

1. **Railway Dashboard**
   - CPU usage
   - Memory usage
   - Request logs

2. **Application Logs**
   - Error messages
   - Response times
   - Cache hit rates

3. **External Services**
   - Polymarket API status
   - News API rate limits

## Expected Performance

Based on your current setup:

- **Light Load (10 users):** Should handle easily
- **Medium Load (50 users):** Should handle well with caching
- **Heavy Load (100 users):** May see some slowdowns on cache misses
- **Extreme Load (200 users):** Will likely hit rate limits and external API limits

## Troubleshooting

### High Error Rate
- Check server logs for errors
- Verify external APIs are accessible
- Check Railway resource limits

### Slow Response Times
- Check cache hit rates
- Monitor external API response times
- Consider increasing Railway resources

### Rate Limiting Issues
- Expected for `/api/predictions` and `/api/waitlist`
- Consider if limits are too strict for your use case

## Next Steps

After stress testing:

1. **Optimize bottlenecks** identified in tests
2. **Adjust rate limits** if needed
3. **Scale resources** if capacity is insufficient
4. **Implement caching** for frequently accessed data
5. **Monitor production** with similar metrics

---

**Note:** Always test responsibly. Don't run extreme stress tests against production during peak hours without warning your team.

