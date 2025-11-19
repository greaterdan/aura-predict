# Stress Test Quick Start 🚀

## Test Your Production Server

```bash
# Replace with your actual production URL
TEST_URL=https://your-domain.com npm run stress-test:medium
```

## Test Scenarios

| Scenario | Users | Duration | Command |
|----------|-------|----------|---------|
| **Light** | 10 | 30s | `npm run stress-test:light` |
| **Medium** | 50 | 60s | `npm run stress-test:medium` |
| **Heavy** | 100 | 120s | `npm run stress-test:heavy` |
| **Extreme** | 200 | 180s | `npm run stress-test:extreme` |

## Quick Test Against Local Server

```bash
# Make sure your server is running on port 3002
npm run server

# In another terminal, run:
npm run stress-test:light
```

## What You'll See

The test will show:
- ✅ Total requests and success rate
- ⏱️ Response times (min, max, avg, p95, p99)
- 📊 Status code distribution
- 💡 Estimated capacity

## Example Output

```
📈 Request Statistics:
   Total Requests: 2,450
   Successful: 2,380 (97.14%)
   Requests/Second: 40.83

⏱️  Response Time Statistics (ms):
   Average: 156.78
   p95: 345.67
   p99: 567.89
```

## Tips

1. **Start with light load** to establish baseline
2. **Monitor Railway logs** during test
3. **Watch for rate limiting** (429 errors are expected)
4. **Check external API limits** (Polymarket, News APIs)

## Full Documentation

See `STRESS_TEST_GUIDE.md` for detailed information.

