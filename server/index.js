// Express proxy server for Polymarket API
// All market processing happens server-side

import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import csrf from 'csrf';
import session from 'express-session';
import { createClient } from 'redis';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// connect-redis v7.x - load the RedisStore class
// In v7.x, it exports the class directly (not a factory function)
let RedisStoreClass;
try {
  const connectRedisModule = require('connect-redis');
  // v7.x exports the RedisStore class directly as default
  RedisStoreClass = connectRedisModule.default || connectRedisModule;
  
  if (!RedisStoreClass) {
    throw new Error('RedisStore class not found in connect-redis module');
  }
  
  // Check if it's actually a class (has prototype and can be instantiated)
  if (typeof RedisStoreClass !== 'function') {
    const keys = Object.keys(connectRedisModule);
    throw new Error(`RedisStore is not a class. Type: ${typeof RedisStoreClass}, Module keys: ${keys.join(', ')}`);
  }
  
  console.log('[REDIS] RedisStore class loaded successfully');
} catch (error) {
  console.error('[REDIS] Failed to load connect-redis:', error.message);
  RedisStoreClass = null;
}
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { fetchAllMarkets } from './services/polymarketService.js';
import { transformMarkets } from './services/marketTransformer.js';
import { mapCategoryToPolymarket } from './utils/categoryMapper.js';
// Import agents API lazily to not block server startup
// These will be loaded dynamically when routes are registered
let getAgentTrades, getAgentsSummary, getAgentsStats;

// Get directory paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const isProduction = process.env.NODE_ENV === 'production';

// SECURITY: Trust proxy if behind reverse proxy (Railway, etc.)
app.set('trust proxy', 1);

// SECURITY: Add security headers using Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.mainnet-beta.solana.com", "https://rpc.ankr.com", "https://solana-api.projectserum.com", "https://mainnet.helius-rpc.com", "https://gamma-api.polymarket.com", "https://data-api.polymarket.com", "https://clob.polymarket.com", "https://newsapi.org", "https://newsdata.io", "https://gnews.io", "https://api.worldnewsapi.com", "https://api.mediastack.com", "https://my.productfruits.com", "https://accounts.google.com", "https://www.googleapis.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow external resources
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow external resources
}));

// Log startup info immediately
console.log('🚀 Starting server...');
console.log(`📋 PORT: ${PORT}`);
console.log(`📋 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`📋 Process PID: ${process.pid}`);
console.log(`📋 Railway PORT env: ${process.env.PORT || 'NOT SET'}`);

// Check if dist folder exists (frontend build)
// Define distPath early so it's available for static file serving later
const distPath = path.join(__dirname, '..', 'dist');
try {
  const distExists = fs.existsSync(distPath);
  if (distExists) {
    console.log(`✅ Frontend build found at: ${distPath}`);
  } else {
    console.warn(`⚠️  Frontend build not found at: ${distPath}`);
    console.warn(`   This is OK - server will still start, but frontend won't be served`);
    console.warn(`   Make sure 'npm run build' runs before 'npm run server'`);
  }
} catch (err) {
  console.warn(`⚠️  Could not check for frontend build: ${err.message}`);
  // Don't fail startup if we can't check for dist folder
}

// CRITICAL: Define healthcheck endpoints FIRST, before any middleware
// Railway healthchecks need these to work immediately
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  // Minimal response for Railway healthcheck - must be fast
  res.status(200).json({ status: 'ok' });
});

// SECURITY: CSRF Protection - Initialize BEFORE endpoints that use it
// Generate a secret for CSRF tokens (use environment variable or generate one)
const csrfSecret = process.env.CSRF_SECRET || 'csrf-secret-change-in-production-' + Date.now();
const csrfProtection = new csrf({ secret: csrfSecret });

// Warn if using default secret in production
if (isProduction && !process.env.CSRF_SECRET) {
  console.warn('⚠️  WARNING: CSRF_SECRET not set in production!');
  console.warn('   Set CSRF_SECRET environment variable for security.');
  console.warn('   Generate a secure random string: openssl rand -base64 32');
}

// SECURITY: CSRF token endpoint - clients can fetch CSRF token here
app.get('/api/csrf-token', (req, res) => {
  try {
    // Generate CSRF token
    const token = csrfProtection.create(csrfSecret);
    
    // Set token in httpOnly cookie for additional security
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false, // Must be false so JavaScript can read it
      secure: isProduction, // Only send over HTTPS in production
      sameSite: 'strict', // Prevent CSRF attacks
      maxAge: 3600000, // 1 hour
    });
    
    // Also return token in response body for clients that prefer header-based approach
    res.json({ 
      csrfToken: token,
      message: 'CSRF token generated successfully'
    });
  } catch (error) {
    console.error(`[${req.id}] Error generating CSRF token:`, error);
    res.status(500).json({ 
      error: 'Failed to generate CSRF token',
      message: isProduction ? undefined : error.message 
    });
  }
});

// Root route removed - will be handled by static file serving for frontend

// Security: CORS - restrict to specific origins instead of wildcard
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174', 'https://probly.tech']; // Default for development

// CORS configuration - allow healthcheck without origin check
// CRITICAL: When credentials are included, we MUST return the specific origin, not '*'
app.use(cors({
  origin: function (origin, callback) {
    // CRITICAL: When credentials: true, we MUST return the actual origin string, not true
    // Returning true becomes '*' which is not allowed with credentials
    
    // Allow requests with no origin (like mobile apps, Postman, healthchecks, etc.)
    // For these, we return the first allowed origin as a fallback
    if (!origin) {
      // For healthchecks and non-browser requests, use first allowed origin
      return callback(null, allowedOrigins[0] || 'http://localhost:3000');
    }
    
    // SECURITY: In production, only allow configured origins
    // In development, allow localhost origins
    if (isProduction) {
      // Allow Railway internal origins (for healthchecks and internal requests)
      const isRailwayOrigin = origin.includes('.up.railway.app') || origin.includes('.railway.app');
      
      if (allowedOrigins.indexOf(origin) !== -1 || isRailwayOrigin) {
        // Return the actual origin (not true) when credentials are included
        callback(null, origin);
    } else {
        // Only log CORS blocks occasionally (every 100th) to reduce log spam
        if (Math.random() < 0.01) {
          console.warn(`[CORS] Blocked request from origin: ${origin} (sampling 1% of blocks)`);
        }
      callback(new Error('Not allowed by CORS'));
      }
    } else {
      // Development: Allow localhost and configured origins
      if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        // Return the actual origin (not true) when credentials are included
        callback(null, origin);
      } else {
        // Only log CORS blocks occasionally (every 100th) to reduce log spam
        if (Math.random() < 0.01) {
          console.warn(`[CORS] Blocked request from origin: ${origin} (sampling 1% of blocks)`);
        }
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));

// Security: Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased limit: 200 requests per 15 minutes per IP
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for healthcheck, auth, and agent endpoints
    return req.path === '/health' || 
           req.path === '/api/health' ||
           req.path === '/api/auth/me' ||
           req.path.startsWith('/api/agents');
  },
});

const predictionsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Increased to 100 requests per minute - cache handles most requests, this allows more concurrent users
  message: 'Too many prediction requests, please try again later.',
});

const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit waitlist submissions to 5 per hour per IP
  message: 'Too many waitlist submissions, please try again later.',
});

// Apply rate limiting to API routes (but NOT /api/health, /api/auth/me, or /api/wallet - healthchecks, auth checks, and wallet operations need to work)
app.use('/api/', (req, res, next) => {
  // Skip rate limiting for healthcheck, auth, and wallet endpoints
  if (req.path === '/health' || req.path === '/auth/me' || req.path === '/wallet') {
    return next();
  }
  apiLimiter(req, res, next);
});
app.use(express.json({ limit: '1mb' })); // Limit request body size
app.use(cookieParser()); // Parse cookies for CSRF protection

// SECURITY: Session configuration for OAuth
const sessionSecret = process.env.SESSION_SECRET || 'session-secret-change-in-production-' + Date.now();
if (isProduction && !process.env.SESSION_SECRET) {
  console.warn('⚠️  WARNING: SESSION_SECRET not set in production!');
  console.warn('   Set SESSION_SECRET environment variable for security.');
  console.warn('   Generate a secure random string: openssl rand -base64 32');
}

// Configure session store - use Redis in production if available, otherwise MemoryStore
let sessionStore;
const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;

if (redisUrl) {
  try {
    // Create Redis client with lazy connect (won't connect until first use)
    const redisClient = createClient({
      url: redisUrl,
      socket: {
        lazyConnect: true, // Don't connect immediately - connect on first use
        reconnectStrategy: (retries) => {
          // Don't block server startup if Redis fails
          if (retries > 3) {
            console.warn('⚠️  Redis connection failed after 3 retries');
            return false; // Stop retrying
          }
          return Math.min(retries * 100, 3000); // Exponential backoff
        },
      },
    });
    
    redisClient.on('error', (err) => {
      // Don't crash on Redis errors - just log and continue
      console.error('Redis Client Error:', err.message);
    });
    
    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });
    
    // Create RedisStore (will work even if not connected yet - Redis client handles reconnection)
    try {
      if (!RedisStoreClass) {
        throw new Error('RedisStore class not loaded - check connect-redis installation');
      }
      
      // connect-redis v7.x: RedisStore is a class, instantiate it directly
      sessionStore = new RedisStoreClass({
        client: redisClient,
        prefix: 'probly:sess:',
      });
      console.log('✅ RedisStore created (will connect on first use)');
      
      // Try to connect to Redis in background (non-blocking)
      redisClient.connect().then(() => {
        console.log('✅ Redis connection established successfully');
      }).catch((err) => {
        console.warn('⚠️  Redis connection failed (will retry):', err.message);
        console.warn('⚠️  Falling back to MemoryStore - sessions will be lost on restart');
      });
    } catch (storeError) {
      console.warn('⚠️  Failed to create RedisStore, using MemoryStore:', storeError.message);
      sessionStore = undefined;
    }
  } catch (error) {
    console.error('Failed to initialize Redis:', error.message);
    console.warn('⚠️  Falling back to MemoryStore (not recommended for production)');
    sessionStore = undefined; // Will use default MemoryStore
  }
} else {
  if (isProduction) {
    console.warn('⚠️  WARNING: REDIS_URL not set - using MemoryStore (not recommended for production)');
    console.warn('   To fix: Add Redis addon in Railway dashboard → Your Service → Add Service → Redis');
    console.warn('   Railway will automatically set REDIS_URL environment variable');
    console.warn('   Sessions will be lost on server restart and won\'t work across multiple instances');
  } else {
    console.log('ℹ️  Using MemoryStore for development (set REDIS_URL for production)');
  }
  sessionStore = undefined; // Will use default MemoryStore
}

app.use(session({
  store: sessionStore, // Use Redis if available, otherwise MemoryStore
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'connect.sid', // Explicit session cookie name
  cookie: {
    secure: isProduction, // Only send over HTTPS in production
    httpOnly: true, // Prevent XSS attacks
    sameSite: 'lax', // CSRF protection - allows redirects from Google OAuth
    maxAge: 24 * 60 * 60 * 1000, // 24 hours - session persists across browser restarts
    // Don't set domain - let browser handle it automatically for current domain
  },
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth Strategy
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Determine callback URL - use environment variable if set, otherwise construct from current request
// In production, default to probly.tech, but allow override for Railway deployments
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || (isProduction ? 'https://probly.tech/api/auth/google/callback' : 'http://localhost:3002/api/auth/google/callback');

// Log the callback URL for debugging
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  console.log(`🔐 Google OAuth callback URL: ${GOOGLE_CALLBACK_URL}`);
}

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL,
  }, (accessToken, refreshToken, profile, done) => {
    // This function is called after Google authentication succeeds
    // profile contains user information from Google
    return done(null, {
      id: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value,
    });
  }));

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // Deserialize user from session
  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  console.log('✅ Google OAuth configured');
  
  // Google OAuth Routes
  // Initiate Google OAuth flow
  app.get('/api/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
  }));

  // Google OAuth callback
  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth-popup-callback?error=1' }),
    (req, res) => {
      // Successful authentication - redirect to popup callback page
      // The user object is stored in req.user via Passport
      res.redirect('/auth-popup-callback?success=1');
    }
  );

  // Get current user session
  app.get('/api/auth/me', (req, res) => {
    if (req.user) {
      res.json({
        authenticated: true,
        user: req.user,
      });
    } else {
      res.json({
        authenticated: false,
        user: null,
      });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    if (req.logout) {
      req.logout((err) => {
        if (err) {
          console.error('Logout error:', err);
          return res.status(500).json({ error: 'Logout failed' });
        }
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destroy error:', err);
            return res.status(500).json({ error: 'Session destroy failed' });
          }
          res.clearCookie('connect.sid'); // Clear session cookie
          res.json({ success: true, message: 'Logged out successfully' });
        });
      });
    } else {
      // Fallback if logout method doesn't exist
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.status(500).json({ error: 'Session destroy failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
      });
    }
  });
} else {
  console.warn('⚠️  Google OAuth not configured - set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  
  // Placeholder routes when OAuth is not configured
  app.get('/api/auth/google', (req, res) => {
    res.status(503).json({
      error: 'Google OAuth not configured',
      message: 'Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables',
    });
  });

  app.get('/api/auth/me', (req, res) => {
    res.json({
      authenticated: false,
      user: null,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out (OAuth not configured)' });
  });
}

// Wallet storage - store wallets server-side tied to Google email
// Use Redis if available, otherwise fallback to in-memory (not recommended for production)
let walletStorageClient = null;
if (redisUrl) {
  try {
    // Create a separate Redis client for wallet storage
    walletStorageClient = createClient({
      url: redisUrl,
      socket: {
        lazyConnect: true,
        reconnectStrategy: (retries) => {
          if (retries > 3) return false;
          return Math.min(retries * 100, 3000);
        },
      },
    });
    
    walletStorageClient.on('error', (err) => {
      console.error('[WALLET] Redis wallet storage error:', err.message);
    });
    
    walletStorageClient.on('connect', () => {
      console.log('[WALLET] ✅ Wallet storage Redis connected');
    });
    
    // Try to connect in background
    walletStorageClient.connect().catch((err) => {
      console.warn('[WALLET] ⚠️  Wallet storage Redis connection failed, using in-memory fallback');
    });
    
    console.log('[WALLET] ✅ Wallet storage configured (Redis)');
  } catch (error) {
    console.warn('[WALLET] ⚠️  Failed to create wallet storage Redis client:', error.message);
    walletStorageClient = null;
  }
}

// In-memory wallet storage fallback (only if Redis not available)
const inMemoryWalletStorage = new Map();

// Helper function to get wallet from storage
async function getWalletFromStorage(email) {
  if (!email) return null;
  
  const key = `wallet:${email}`;
  
  // Try Redis first
  if (walletStorageClient) {
    try {
      const walletData = await walletStorageClient.get(key);
      if (walletData) {
        return JSON.parse(walletData);
      }
    } catch (error) {
      console.warn('[WALLET] Redis get failed, trying in-memory:', error.message);
    }
  }
  
  // Fallback to in-memory
  return inMemoryWalletStorage.get(key) || null;
}

// Helper function to save wallet to storage
async function saveWalletToStorage(email, walletData) {
  if (!email) return false;
  
  const key = `wallet:${email}`;
  const data = JSON.stringify(walletData);
  
  // Try Redis first
  if (walletStorageClient) {
    try {
      await walletStorageClient.set(key, data);
      // Set expiration to 10 years (wallets should persist)
      await walletStorageClient.expire(key, 10 * 365 * 24 * 60 * 60);
      return true;
    } catch (error) {
      console.warn('[WALLET] Redis save failed, using in-memory:', error.message);
    }
  }
  
  // Fallback to in-memory
  inMemoryWalletStorage.set(key, walletData);
  return true;
}

// Wallet endpoints - require authentication
// Get wallet for authenticated user
app.get('/api/wallet', async (req, res) => {
  try {
    // Require authentication
    if (!req.user || !req.user.email) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to access your wallet',
      });
    }
    
    const email = req.user.email;
    const wallet = await getWalletFromStorage(email);
    
    if (wallet) {
      res.json({
        success: true,
        wallet: {
          publicKey: wallet.publicKey,
          privateKey: wallet.privateKey,
        },
      });
    } else {
      res.json({
        success: true,
        wallet: null,
        message: 'No wallet found for this account',
      });
    }
  } catch (error) {
    console.error(`[${req.id}] Error getting wallet:`, error);
    res.status(500).json({
      error: isProduction ? 'Internal server error' : error.message,
    });
  }
});

// Create or update wallet for authenticated user
app.post('/api/wallet', async (req, res) => {
  try {
    // Require authentication
    if (!req.user || !req.user.email) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to create a wallet',
      });
    }
    
    const email = req.user.email;
    const { publicKey, privateKey } = req.body;
    
    // Validate wallet data
    if (!publicKey || !privateKey) {
      return res.status(400).json({
        error: 'Invalid wallet data',
        message: 'Both publicKey and privateKey are required',
      });
    }
    
    // Validate format (basic checks)
    if (typeof publicKey !== 'string' || publicKey.length < 32) {
      return res.status(400).json({
        error: 'Invalid publicKey format',
      });
    }
    
    if (typeof privateKey !== 'string' || privateKey.length < 32) {
      return res.status(400).json({
        error: 'Invalid privateKey format',
      });
    }
    
    // Save wallet to storage
    const saved = await saveWalletToStorage(email, {
      publicKey,
      privateKey,
      createdAt: new Date().toISOString(),
      email, // Store email for verification
    });
    
    if (saved) {
      console.log(`[WALLET] ✅ Wallet saved for ${email}`);
      res.json({
        success: true,
        message: 'Wallet saved successfully',
        wallet: {
          publicKey,
          // Don't send privateKey back in response for security
        },
      });
    } else {
      res.status(500).json({
        error: 'Failed to save wallet',
      });
    }
  } catch (error) {
    console.error(`[${req.id}] Error saving wallet:`, error);
    res.status(500).json({
      error: isProduction ? 'Internal server error' : error.message,
    });
  }
});

// SECURITY: Add request ID for logging and tracking
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Cache for predictions (2 minute cache - balance between freshness and server load)
// Most users will get cached data, only first request in 2-min window hits Polymarket
let predictionsCache = {
  data: null,
  timestamp: null,
  category: null,
  CACHE_DURATION: 2 * 60 * 1000, // 2 minutes - fresh data while serving many users
};

// Main endpoint: Get predictions (ready-to-use format)
// SECURITY: Apply rate limiting and input validation
app.get('/api/predictions', predictionsLimiter, async (req, res) => {
  try {
    // SECURITY: Input validation and limits
    let { category = 'All Markets', limit = 5000, search = null } = req.query;
    
    // Validate and sanitize inputs
    const MAX_LIMIT = 10000;
    const MAX_SEARCH_LENGTH = 200;
    const MAX_CATEGORY_LENGTH = 50;
    
    // Enforce maximum limit to prevent DoS
    limit = Math.min(Math.max(parseInt(limit) || 5000, 1), MAX_LIMIT);
    
    // Validate category
    if (typeof category !== 'string' || category.length > MAX_CATEGORY_LENGTH) {
      return res.status(400).json({ error: 'Invalid category parameter' });
    }
    
    // Validate and sanitize search query
    if (search) {
      if (typeof search !== 'string' || search.length > MAX_SEARCH_LENGTH) {
        return res.status(400).json({ error: 'Invalid search parameter' });
      }
      search = search.trim().substring(0, MAX_SEARCH_LENGTH);
    }
    
    // Check cache first (but don't cache search results - they should be fresh)
    const cacheNow = Date.now();
    const isSearching = search && search.trim();
    if (!isSearching && predictionsCache.data && 
        predictionsCache.category === category &&
        predictionsCache.timestamp && 
        (cacheNow - predictionsCache.timestamp) < predictionsCache.CACHE_DURATION) {
      // Cache hit - don't log to reduce log volume
      return res.json(predictionsCache.data);
    }
    
    // Only log cache misses occasionally (every 10th miss) to reduce log spam
    if (Math.random() < 0.1) {
    console.log(`[CACHE MISS] Fetching fresh predictions for category: ${category}${isSearching ? ` (search: ${search})` : ''}`);
    }
    
    // Map category to Polymarket category
    let polymarketCategory = null;
    if (category !== 'All Markets' && category !== 'Trending' && category !== 'Breaking' && category !== 'New') {
      polymarketCategory = mapCategoryToPolymarket(category);
    }
    
    // Fetch markets from Polymarket - increased limits for better coverage
    // When searching, fetch more markets to increase search pool
    const maxMarkets = isSearching 
      ? 10000 // Fetch more markets when searching
      : category === 'All Markets' ? 500 : 5000;
    
    let markets = await fetchAllMarkets({
      category: polymarketCategory,
      active: true,
      maxPages: Math.ceil(maxMarkets / 1000) + 1, // Fetch more pages for category searches
      limitPerPage: 1000,
      searchQuery: isSearching ? search.trim() : null, // Pass search query to API
    });
    
    // ALWAYS fetch all markets for Earnings, Geopolitics, and Elections
    // and rely on category detection from actual market data
    if (category === 'Earnings' || category === 'Geopolitics' || category === 'Elections') {
      // Reduced logging - only log occasionally
      if (Math.random() < 0.1) {
      console.log(`Fetching ALL markets for ${category} category (will filter by detection)...`);
      }
      const allMarkets = await fetchAllMarkets({
        category: null, // Fetch all markets - don't filter by API category
        active: true,
        maxPages: Math.ceil(3000 / 1000) + 1, // Fetch more to find enough markets
        limitPerPage: 1000,
        searchQuery: isSearching ? search.trim() : null,
      });
      markets = allMarkets; // Use all markets, will filter by detection below
      // Reduced logging
      if (Math.random() < 0.1) {
      console.log(`Fetched ${markets.length} total markets for ${category} detection`);
      }
    } else if (markets.length < 50 && polymarketCategory) {
      // Reduced logging
      if (Math.random() < 0.1) {
      console.log(`Category search for ${category} returned only ${markets.length} markets. Trying without category filter...`);
      }
      const allMarkets = await fetchAllMarkets({
        category: null, // Fetch all markets
        active: true,
        maxPages: Math.ceil(2000 / 1000) + 1,
        limitPerPage: 1000,
        searchQuery: isSearching ? search.trim() : null,
      });
      markets = allMarkets; // Use all markets, will filter by detection below
    }
    
    // Limit markets for "All Markets" category (but allow more when searching or for other categories)
    const limitedMarkets = (category === 'All Markets' && !isSearching) 
      ? markets.slice(0, 500) 
      : markets;
    
    // Transform markets to predictions (server-side filtering and transformation)
    // Note: transformMarkets is now async to fetch prices from /prices endpoint
    const predictions = await transformMarkets(limitedMarkets);
    
    // Apply server-side search filtering if search query provided
    // (Since Polymarket API doesn't support text search, we filter client-side)
    let searchFilteredPredictions = predictions;
    if (isSearching) {
      const searchLower = search.toLowerCase().trim();
      searchFilteredPredictions = predictions.filter(p => {
        const question = (p.question || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        const description = (p.description || '').toLowerCase();
        return question.includes(searchLower) || 
               category.includes(searchLower) || 
               description.includes(searchLower);
      });
      // Only log search results occasionally (every 10th) to reduce log spam
      if (Math.random() < 0.1) {
      console.log(`Search "${search}" filtered ${predictions.length} predictions down to ${searchFilteredPredictions.length}`);
    }
    }
    
    // DEBUG: Log category distribution (removed to reduce log spam - only log occasionally)
    // const categoryCounts = {};
    // predictions.forEach(p => {
    //   const cat = p.category || 'World';
    //   categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    // });
    // if (Math.random() < 0.1) {
    //   console.log(`Category distribution:`, categoryCounts);
    //   console.log(`Total predictions: ${predictions.length}`);
    // }
    
    // Filter by category if needed (client-side category filtering)
    // Use search-filtered predictions if search was applied
    let filteredPredictions = searchFilteredPredictions;
    if (category !== 'All Markets') {
      filteredPredictions = searchFilteredPredictions.filter(p => {
        if (category === 'Trending' || category === 'Breaking' || category === 'New') {
          // For these, show all (or implement specific logic)
          return true;
        }
        // Match category - be flexible with category names
        const marketCategory = (p.category || 'World');
        // Allow matching if category matches or if it's a related category
        if (marketCategory === category) {
          return true;
        }
        // For Elections, also accept Politics markets
        if (category === 'Elections' && marketCategory === 'Politics') {
          return true;
        }
        // For Geopolitics, also accept Politics markets
        if (category === 'Geopolitics' && marketCategory === 'Politics') {
          return true;
        }
        // For Earnings, also accept Finance markets
        if (category === 'Earnings' && marketCategory === 'Finance') {
          return true;
        }
        return false;
      });
      // Only log category filtering occasionally (every 10th) to reduce log spam
      if (Math.random() < 0.1) {
      console.log(`Filtered ${filteredPredictions.length} predictions for category: ${category}`);
      }
      // DEBUG: Log sample filtered prediction (removed to reduce log spam)
      // if (filteredPredictions.length > 0 && Math.random() < 0.1) {
      //   console.log(`Sample filtered prediction:`, {
      //     question: filteredPredictions[0].question?.substring(0, 50),
      //     category: filteredPredictions[0].category
      //   });
      // }
    }
    
    // Apply limit if specified
    if (limit && parseInt(limit) > 0) {
      filteredPredictions = filteredPredictions.slice(0, parseInt(limit));
    }
    
    // Cache the response AFTER filtering
    const responseData = {
      predictions: filteredPredictions,
      count: filteredPredictions.length,
      totalFetched: markets.length,
      totalTransformed: predictions.length,
    };
    
    predictionsCache = {
      data: responseData,
      timestamp: Date.now(),
      category: category,
      CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    };
    
    res.json(responseData);
  } catch (error) {
    console.error(`[${req.id}] Error in /api/predictions:`, error);
    // SECURITY: Don't expose error details to clients
    res.status(500).json({ 
      error: isProduction ? 'Internal server error' : error.message,
      predictions: [],
      count: 0,
    });
  }
});

// Legacy endpoint for backwards compatibility
app.get('/api/polymarket/markets', async (req, res) => {
  try {
    const { limit = 50, active = 'true', category, offset = 0 } = req.query;
    
    // Map category
    let polymarketCategory = null;
    if (category) {
      polymarketCategory = mapCategoryToPolymarket(category);
    }
    
    // Fetch markets
    const markets = await fetchAllMarkets({
      category: polymarketCategory,
      active: active === 'true',
      maxPages: Math.ceil((parseInt(limit) || 50) / 1000) + 1,
      limitPerPage: 1000,
    });
    
    // Apply offset and limit
    const offsetNum = parseInt(offset) || 0;
    const limitNum = parseInt(limit) || 50;
    const paginatedMarkets = markets.slice(offsetNum, offsetNum + limitNum);
    
    res.json({
      markets: paginatedMarkets,
      count: paginatedMarkets.length,
      total: markets.length,
    });
  } catch (error) {
    console.error(`[${req.id}] Error in /api/polymarket/markets:`, error);
    // SECURITY: Don't expose error details to clients
    res.status(500).json({
      error: isProduction ? 'Internal server error' : error.message,
      markets: [],
      count: 0,
    });
  }
});

// News API proxy endpoint with caching
// SECURITY: All API keys must be in environment variables - never hardcode
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2/everything';
const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY;
const NEWSDATA_API_URL = 'https://newsdata.io/api/1/news';
// GNews API - Get your free API key from https://gnews.io/register
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const GNEWS_API_URL = 'https://gnews.io/api/v4/search';
// World News API - Get your free API key from https://worldnewsapi.com/
const WORLD_NEWS_API_KEY = process.env.WORLD_NEWS_API_KEY;
const WORLD_NEWS_API_URL = 'https://api.worldnewsapi.com/search-news';
// Mediastack API - Get your free API key from https://mediastack.com/
const MEDIASTACK_API_KEY = process.env.MEDIASTACK_API_KEY;
const MEDIASTACK_API_URL = 'https://api.mediastack.com/v1/news';

// Log API key status on startup
console.log('[NEWS] 📰 News API Configuration:');
console.log(`[NEWS]   NewsAPI: ${NEWS_API_KEY ? `✅ Configured (${NEWS_API_KEY.substring(0, 8)}...)` : '❌ NOT SET'}`);
console.log(`[NEWS]   NewsData.io: ${NEWSDATA_API_KEY ? `✅ Configured (${NEWSDATA_API_KEY.substring(0, 8)}...)` : '❌ NOT SET'}`);
console.log(`[NEWS]   GNews: ${GNEWS_API_KEY ? `✅ Configured (${GNEWS_API_KEY.substring(0, 8)}...)` : '❌ NOT SET'}`);
console.log(`[NEWS]   World News API: ${WORLD_NEWS_API_KEY ? `✅ Configured (${WORLD_NEWS_API_KEY.substring(0, 8)}...)` : '❌ NOT SET'}`);
console.log(`[NEWS]   Mediastack: ${MEDIASTACK_API_KEY ? `✅ Configured (${MEDIASTACK_API_KEY.substring(0, 8)}...)` : '❌ NOT SET'}`);

// Simple in-memory cache (refresh every 5 minutes)
let newsCache = {
  data: null,
  timestamp: null,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// Helper function to normalize title for deduplication
const normalizeTitle = (title) => {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// Deduplicate articles based on title similarity and URL
const deduplicateArticles = (articles) => {
  const seen = new Map();
  const uniqueArticles = [];
  
  for (const article of articles) {
    const normalizedTitle = normalizeTitle(article.title || '');
    const url = article.url || '';
    
    // Check if we've seen a similar title (exact match or very similar)
    let isDuplicate = false;
    for (const [key, existing] of seen.entries()) {
      const existingTitle = normalizeTitle(existing.title || '');
      
      // Check for exact URL match
      if (url && existing.url && url === existing.url) {
        isDuplicate = true;
        break;
      }
      
      // Check for very similar titles (same normalized title)
      if (normalizedTitle && existingTitle && normalizedTitle === existingTitle) {
        isDuplicate = true;
        break;
      }
      
      // Check for high similarity (one title contains the other or vice versa)
      if (normalizedTitle.length > 20 && existingTitle.length > 20) {
        if (normalizedTitle.includes(existingTitle) || existingTitle.includes(normalizedTitle)) {
          // If one is significantly longer, prefer the longer one
          if (Math.abs(normalizedTitle.length - existingTitle.length) < 10) {
            isDuplicate = true;
            break;
          }
        }
      }
    }
    
    if (!isDuplicate) {
      const key = normalizedTitle || url || `article-${uniqueArticles.length}`;
      seen.set(key, article);
      uniqueArticles.push(article);
    }
  }
  
  return uniqueArticles;
};

// Fetch news from NewsAPI
const fetchNewsAPI = async () => {
  console.log('[NEWS] 🔄 Starting NewsAPI fetch...');
  // SECURITY: Check if API key is configured
  if (!NEWS_API_KEY) {
    console.error('[NEWS] ❌ NEWS_API_KEY not configured, skipping NewsAPI');
    return [];
  }
  // Get date from last 7 days for better news coverage
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7); // Last 7 days
  const fromDateStr = fromDate.toISOString();
  
  // Get current date for 'to' parameter
  const toDate = new Date();
  const toDateStr = toDate.toISOString();
  
  // Try multiple queries to get more results
  const queries = [
    'prediction OR election',
    'cryptocurrency',
    'bitcoin',
    'ethereum',
    'blockchain',
    'stock market OR economy',
    'technology OR AI',
    'sports', // Dedicated sports query
    'climate'
  ];
  
  const fetchPromises = queries.map(async (query) => {
    try {
      // Use from and to parameters for last 7 days, sort by publishedAt (newest first)
      const url = `${NEWS_API_URL}?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20&from=${fromDateStr}&to=${toDateStr}&apiKey=${NEWS_API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        // ALWAYS log API errors for debugging
        try {
          const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          console.error(`[NEWS] ❌ NewsAPI HTTP error ${response.status} for query "${query}":`, JSON.stringify(errorData));
        } catch (e) {
          console.error(`[NEWS] ❌ NewsAPI HTTP error ${response.status} for query "${query}":`, e.message);
        }
        return [];
      }
      
      const data = await response.json();
      
      // ALWAYS log API responses for debugging
      console.log(`[NEWS] NewsAPI response for "${query}": status=${data.status}, articles=${data.articles?.length || 0}, totalResults=${data.totalResults || 0}`);
      
      if (data.status === 'ok' && data.articles) {
        // Filter to only articles from last 7 days
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const filtered = data.articles
          .filter(article => {
            if (!article.publishedAt) return false;
            const publishedDate = new Date(article.publishedAt);
            return publishedDate >= sevenDaysAgo;
          })
          .map(article => ({
            ...article,
            sourceApi: 'newsapi',
          }));
        console.log(`[NEWS] NewsAPI "${query}": ${data.articles.length} articles, ${filtered.length} after 7-day filter`);
        return filtered;
      }
      
      // ALWAYS log API errors
      if (data.status !== 'ok') {
        console.error(`[NEWS] ❌ NewsAPI error for query "${query}":`, JSON.stringify(data));
      }
      
      return [];
    } catch (error) {
      // ALWAYS log fetch errors
      console.error(`[NEWS] ❌ NewsAPI fetch error for query "${query}":`, error.message, error.stack);
      return [];
    }
  });
  
  const results = await Promise.all(fetchPromises);
  const allArticles = results.flat();
  
  // Remove duplicates based on URL
  const uniqueArticles = [];
  const seenUrls = new Set();
  
  for (const article of allArticles) {
    if (article.url && !seenUrls.has(article.url)) {
      seenUrls.add(article.url);
      uniqueArticles.push(article);
    }
  }
  
  return uniqueArticles;
};

// Fetch news from NewsData.io
const fetchNewsData = async () => {
  console.log('[NEWS] 🔄 Starting NewsData.io fetch...');
  // SECURITY: Check if API key is configured
  if (!NEWSDATA_API_KEY) {
    console.error('[NEWS] ❌ NEWSDATA_API_KEY not configured, skipping NewsData.io');
    return [];
  }
  // Get date from last 7 days for more news (relaxed from 24 hours)
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  const fromDateStr = fromDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  // NewsData.io uses different query parameters - try multiple queries
  // Using more queries to get more articles (max 10 per query for free tier)
  const queries = [
    'prediction',
    'election',
    'cryptocurrency',
    'bitcoin',
    'ethereum',
    'blockchain',
    'stock market',
    'economy',
    'technology',
    'sports',
    'climate',
    'politics',
    'finance',
    'trading',
    'crypto',
    'solana',
    'defi',
    'nft',
    'web3',
    'markets'
  ];
  
  // Fetch from multiple queries and combine results
  const fetchPromises = queries.map(async (query) => {
    try {
      // NewsData.io doesn't support time_from in /1/news endpoint - filter by date manually instead
      // Maximum size is 10 for free tier
      const url = `${NEWSDATA_API_URL}?apikey=${NEWSDATA_API_KEY}&q=${encodeURIComponent(query)}&language=en&size=10`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        // ALWAYS log API errors for debugging
        try {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`[NEWS] ❌ NewsData.io HTTP error ${response.status} for query "${query}":`, errorText.substring(0, 500));
        } catch (e) {
          console.error(`[NEWS] ❌ NewsData.io HTTP error ${response.status} for query "${query}":`, e.message);
        }
        return [];
      }
      
      const data = await response.json();
      
      // ALWAYS log API responses for debugging
      console.log(`[NEWS] NewsData.io response for "${query}": status=${data.status}, results=${data.results?.length || 0}, totalResults=${data.totalResults || 0}`);
      
      if (data.status === 'success' && data.results) {
        // Filter to only articles from last 7 days (double-check)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const filtered = data.results.filter(article => {
          if (!article.pubDate) return false;
          const publishedDate = new Date(article.pubDate);
          return publishedDate >= sevenDaysAgo;
        });
        console.log(`[NEWS] NewsData.io "${query}": ${data.results.length} articles, ${filtered.length} after 7-day filter`);
        return filtered;
      }
      
      // ALWAYS log API errors
      if (data.status !== 'success') {
        console.error(`[NEWS] ❌ NewsData.io error for query "${query}":`, JSON.stringify(data));
      }
      
      return [];
    } catch (error) {
      // ALWAYS log fetch errors
      console.error(`[NEWS] ❌ NewsData.io fetch error for query "${query}":`, error.message, error.stack);
      return [];
    }
  });
  
  const results = await Promise.all(fetchPromises);
  const allArticles = results.flat();
  
  // Remove duplicates based on link
  const uniqueArticles = [];
  const seenLinks = new Set();
  
  for (const article of allArticles) {
    const link = article.link || article.guid;
    if (link && !seenLinks.has(link)) {
      seenLinks.add(link);
      uniqueArticles.push(article);
    }
  }
  
  // Transform NewsData.io format to match NewsAPI format
  return uniqueArticles.map(article => ({
    source: {
      id: article.source_id || null,
      name: article.source_name || 'Unknown',
    },
    author: article.creator?.[0] || null,
    title: article.title || '',
    description: article.description || null,
    url: article.link || article.guid || '',
    urlToImage: article.image_url || null,
    publishedAt: article.pubDate || new Date().toISOString(),
    content: article.content || null,
    sourceApi: 'newsdata',
  }));
};

// Fetch news from GNews
const fetchGNews = async () => {
  console.log('[NEWS] 🔄 Starting GNews fetch...');
  // SECURITY: Check if API key is configured
  if (!GNEWS_API_KEY) {
    console.error('[NEWS] ❌ GNEWS_API_KEY not configured, skipping GNews');
    return [];
  }
  
  // Get date from last 7 days for more news (relaxed from 24 hours)
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  const fromDateStr = fromDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  // GNews has rate limits, so use fewer broader queries
  // Using broader queries to get more diverse results with fewer API calls
  const queries = [
    'prediction OR election',
    'cryptocurrency OR bitcoin OR ethereum OR crypto OR blockchain OR stock market',
    'technology OR economy',
    'sports', // Dedicated sports query
    'climate'
  ];
  
  // Fetch sequentially with delays to avoid rate limits
  const allArticles = [];
  
  for (const query of queries) {
    try {
      // Add delay between requests to avoid rate limits
      if (allArticles.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
      
      // GNews supports 'from' and 'to' parameters for time filtering
      const url = `${GNEWS_API_URL}?q=${encodeURIComponent(query)}&lang=en&max=20&from=${fromDateStr}&apikey=${GNEWS_API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        // ALWAYS log API errors for debugging
        if (response.status === 429) {
          console.error(`[NEWS] ❌ GNews rate limit hit (429) for query "${query}"`);
          break; // Stop if we hit rate limit
        }
        try {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`[NEWS] ❌ GNews HTTP error ${response.status} for query "${query}":`, errorText.substring(0, 500));
        } catch (e) {
          console.error(`[NEWS] ❌ GNews HTTP error ${response.status} for query "${query}":`, e.message);
        }
        continue;
      }
      
      const data = await response.json();
      
      // ALWAYS log API responses for debugging
      console.log(`[NEWS] GNews response for "${query}": articles=${data.articles?.length || 0}, totalArticles=${data.totalArticles || 0}`);
      
      if (data.articles && Array.isArray(data.articles)) {
        // Filter to only articles from last 7 days (relaxed from 24 hours)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const filteredArticles = data.articles.filter(article => {
          if (!article.publishedAt && !article.pubDate) return false;
          const publishedDate = new Date(article.publishedAt || article.pubDate);
          return publishedDate >= sevenDaysAgo;
        });
        
        console.log(`[NEWS] GNews "${query}": ${data.articles.length} articles, ${filteredArticles.length} after 7-day filter`);
        allArticles.push(...filteredArticles);
      } else {
        console.error(`[NEWS] ❌ GNews unexpected response format for "${query}":`, JSON.stringify(data).substring(0, 200));
      }
    } catch (error) {
      // ALWAYS log fetch errors
      console.error(`[NEWS] ❌ GNews fetch error for query "${query}":`, error.message, error.stack);
    }
  }
  
  // Remove duplicates based on url
  const uniqueArticles = [];
  const seenUrls = new Set();
  
  for (const article of allArticles) {
    const url = article.url || article.link;
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      uniqueArticles.push(article);
    }
  }
  
  // Transform GNews format to match NewsAPI format
  return uniqueArticles.map(article => ({
    source: {
      id: article.source?.id || null,
      name: article.source?.name || 'Unknown',
    },
    author: article.author || null,
    title: article.title || '',
    description: article.description || null,
    url: article.url || article.link || '',
    urlToImage: article.image || null,
    publishedAt: article.publishedAt || article.pubDate || new Date().toISOString(),
    content: article.content || null,
    sourceApi: 'gnews',
  }));
};

// Fetch news from World News API
const fetchWorldNews = async () => {
  console.log('[NEWS] 🔄 Starting World News API fetch...');
  // SECURITY: Check if API key is configured
  if (!WORLD_NEWS_API_KEY) {
    console.error('[NEWS] ❌ WORLD_NEWS_API_KEY not configured, skipping World News API');
    return [];
  }
  
  // Get date from last 7 days
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  const fromDateStr = fromDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  // World News API queries - try multiple topics
  const queries = [
    'prediction',
    'election',
    'cryptocurrency',
    'bitcoin',
    'ethereum',
    'blockchain',
    'stock market',
    'economy',
    'technology',
    'sports',
    'climate',
    'politics',
    'finance',
    'trading',
    'crypto',
    'solana',
    'defi',
    'nft',
    'web3',
    'markets'
  ];
  
  // Fetch from multiple queries and combine results
  const fetchPromises = queries.map(async (query) => {
    try {
      // World News API uses x-api-key header
      const url = `${WORLD_NEWS_API_URL}?text=${encodeURIComponent(query)}&language=en&number=10&earliest-publish-date=${fromDateStr}`;
      
      const response = await fetch(url, {
        headers: {
          'x-api-key': WORLD_NEWS_API_KEY,
        },
      });
      
      if (!response.ok) {
        // ALWAYS log API errors for debugging
        try {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`[NEWS] ❌ World News API HTTP error ${response.status} for query "${query}":`, errorText.substring(0, 500));
        } catch (e) {
          console.error(`[NEWS] ❌ World News API HTTP error ${response.status} for query "${query}":`, e.message);
        }
        return [];
      }
      
      const data = await response.json();
      
      // ALWAYS log API responses for debugging
      console.log(`[NEWS] World News API response for "${query}": articles=${data.news?.length || 0}`);
      
      if (data.news && Array.isArray(data.news)) {
        // Filter to only articles from last 7 days (double-check)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const filtered = data.news.filter(article => {
          if (!article.publish_date) return false;
          const publishedDate = new Date(article.publish_date);
          return publishedDate >= sevenDaysAgo;
        });
        console.log(`[NEWS] World News API "${query}": ${data.news.length} articles, ${filtered.length} after 7-day filter`);
        return filtered;
      }
      
      // ALWAYS log API errors
      if (data.error) {
        console.error(`[NEWS] ❌ World News API error for query "${query}":`, JSON.stringify(data));
      }
      
      return [];
    } catch (error) {
      // ALWAYS log fetch errors
      console.error(`[NEWS] ❌ World News API fetch error for query "${query}":`, error.message, error.stack);
      return [];
    }
  });
  
  const results = await Promise.all(fetchPromises);
  const allArticles = results.flat();
  
  // Remove duplicates based on url
  const uniqueArticles = [];
  const seenUrls = new Set();
  
  for (const article of allArticles) {
    const url = article.url || article.link;
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      uniqueArticles.push(article);
    }
  }
  
  // Transform World News API format to match NewsAPI format
  return uniqueArticles.map(article => ({
    source: {
      id: article.source?.id || null,
      name: article.source?.name || 'Unknown',
    },
    author: article.author || null,
    title: article.title || '',
    description: article.text || article.summary || null,
    url: article.url || article.link || '',
    urlToImage: article.image || null,
    publishedAt: article.publish_date || new Date().toISOString(),
    content: article.text || null,
    sourceApi: 'worldnews',
  }));
};

// Fetch news from Mediastack
const fetchMediastack = async () => {
  console.log('[NEWS] 🔄 Starting Mediastack fetch...');
  // SECURITY: Check if API key is configured
  if (!MEDIASTACK_API_KEY) {
    console.error('[NEWS] ❌ MEDIASTACK_API_KEY not configured, skipping Mediastack');
    return [];
  }
  
  // Get date from last 7 days
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  const fromDateStr = fromDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  // Mediastack queries - try multiple topics
  // Using fewer queries since limit is 100 per request (more efficient)
  // Also use category parameter for better sports coverage
  const queries = [
    'prediction OR election',
    'cryptocurrency OR bitcoin OR ethereum',
    'blockchain OR crypto OR defi',
    'stock market OR economy OR finance',
    'technology OR trading OR markets',
    'sports', // Dedicated sports query
    'climate OR politics',
    'solana OR nft OR web3'
  ];
  
  // Also fetch by category for sports (Mediastack supports categories parameter)
  const categoryQueries = [
    { categories: 'sports', keywords: '' },
    { categories: 'business', keywords: '' },
    { categories: 'technology', keywords: '' },
    { categories: 'entertainment', keywords: '' },
    { categories: 'general', keywords: '' },
  ];
  
  // Fetch from multiple queries and combine results
  const fetchPromises = queries.map(async (query) => {
    try {
      // Mediastack uses access_key parameter and supports date range
      // Max limit is 100 per request
      const url = `${MEDIASTACK_API_URL}?access_key=${MEDIASTACK_API_KEY}&keywords=${encodeURIComponent(query)}&languages=en&date=${fromDateStr},${new Date().toISOString().split('T')[0]}&limit=100&sort=published_desc`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        // ALWAYS log API errors for debugging
        try {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`[NEWS] ❌ Mediastack HTTP error ${response.status} for query "${query}":`, errorText.substring(0, 500));
        } catch (e) {
          console.error(`[NEWS] ❌ Mediastack HTTP error ${response.status} for query "${query}":`, e.message);
        }
        return [];
      }
      
      const data = await response.json();
      
      // ALWAYS log API responses for debugging
      if (data.data && Array.isArray(data.data)) {
        console.log(`[NEWS] Mediastack response for "${query}": articles=${data.data.length}, total=${data.pagination?.total || 'N/A'}`);
        
        // Filter to only articles from last 7 days (double-check)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const filtered = data.data.filter(article => {
          if (!article.published_at) return false;
          const publishedDate = new Date(article.published_at);
          return publishedDate >= sevenDaysAgo;
        });
        console.log(`[NEWS] Mediastack "${query}": ${data.data.length} articles, ${filtered.length} after 7-day filter`);
        return filtered;
      }
      
      // ALWAYS log API errors
      if (data.error) {
        console.error(`[NEWS] ❌ Mediastack error for query "${query}":`, JSON.stringify(data.error));
      }
      
      return [];
    } catch (error) {
      // ALWAYS log fetch errors
      console.error(`[NEWS] ❌ Mediastack fetch error for query "${query}":`, error.message, error.stack);
      return [];
    }
  });
  
  // Also fetch by category for better sports coverage
  const categoryPromises = categoryQueries.map(async ({ categories, keywords }) => {
    try {
      // Mediastack supports categories parameter - use it for sports
      let url = `${MEDIASTACK_API_URL}?access_key=${MEDIASTACK_API_KEY}&categories=${categories}&languages=en&date=${fromDateStr},${new Date().toISOString().split('T')[0]}&limit=100&sort=published_desc`;
      if (keywords) {
        url += `&keywords=${encodeURIComponent(keywords)}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        // ALWAYS log API errors for debugging
        try {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`[NEWS] ❌ Mediastack HTTP error ${response.status} for category "${categories}":`, errorText.substring(0, 500));
        } catch (e) {
          console.error(`[NEWS] ❌ Mediastack HTTP error ${response.status} for category "${categories}":`, e.message);
        }
        return [];
      }
      
      const data = await response.json();
      
      // ALWAYS log API responses for debugging
      if (data.data && Array.isArray(data.data)) {
        console.log(`[NEWS] Mediastack response for category "${categories}": articles=${data.data.length}, total=${data.pagination?.total || 'N/A'}`);
        
        // Filter to only articles from last 7 days (double-check)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const filtered = data.data.filter(article => {
          if (!article.published_at) return false;
          const publishedDate = new Date(article.published_at);
          return publishedDate >= sevenDaysAgo;
        });
        console.log(`[NEWS] Mediastack category "${categories}": ${data.data.length} articles, ${filtered.length} after 7-day filter`);
        return filtered;
      }
      
      // ALWAYS log API errors
      if (data.error) {
        console.error(`[NEWS] ❌ Mediastack error for category "${categories}":`, JSON.stringify(data.error));
      }
      
      return [];
    } catch (error) {
      // ALWAYS log fetch errors
      console.error(`[NEWS] ❌ Mediastack fetch error for category "${categories}":`, error.message, error.stack);
      return [];
    }
  });
  
  const keywordResults = await Promise.all(fetchPromises);
  const categoryResults = await Promise.all(categoryPromises);
  const allArticles = [...keywordResults, ...categoryResults].flat();
  
  // Remove duplicates based on url
  const uniqueArticles = [];
  const seenUrls = new Set();
  
  for (const article of allArticles) {
    const url = article.url;
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      uniqueArticles.push(article);
    }
  }
  
  // Transform Mediastack format to match NewsAPI format
  return uniqueArticles.map(article => ({
    source: {
      id: article.source || null,
      name: article.source || 'Unknown',
    },
    author: article.author || null,
    title: article.title || '',
    description: article.description || null,
    url: article.url || '',
    urlToImage: article.image || null,
    publishedAt: article.published_at || new Date().toISOString(),
    content: article.description || null,
    sourceApi: 'mediastack',
  }));
};

app.get('/api/news', async (req, res) => {
  const { source = 'all' } = req.query; // 'all', 'newsapi', 'newsdata', 'gnews', 'worldnews', or 'mediastack'
  
  try {
    // Check cache
    const cacheKey = `news-${source}`;
    const cacheNow = Date.now();
    if (newsCache.data && newsCache.timestamp && (cacheNow - newsCache.timestamp) < newsCache.CACHE_DURATION) {
      // Filter by source if needed
      if (source === 'all') {
      return res.json(newsCache.data);
      } else {
        const filtered = {
          ...newsCache.data,
          articles: newsCache.data.articles.filter(a => a.sourceApi === source),
        };
        return res.json(filtered);
      }
    }

    // Fetch from all APIs in parallel
    const fetchPromises = [];
    
    if (source === 'all' || source === 'newsapi') {
      fetchPromises.push(fetchNewsAPI().catch(() => []));
    }
    
    if (source === 'all' || source === 'newsdata') {
      fetchPromises.push(fetchNewsData().catch(() => []));
    }
    
    if (source === 'all' || source === 'gnews') {
      fetchPromises.push(fetchGNews().catch(() => []));
    }
    
    if (source === 'all' || source === 'worldnews') {
      fetchPromises.push(fetchWorldNews().catch(() => []));
    }
    
    if (source === 'all' || source === 'mediastack') {
      fetchPromises.push(fetchMediastack().catch(() => []));
    }
    
    const results = await Promise.all(fetchPromises);
    let allArticles = results.flat();
    
    // ALWAYS log fetch results for debugging
    const newsapiCount = allArticles.filter(a => a.sourceApi === 'newsapi').length;
    const newsdataCount = allArticles.filter(a => a.sourceApi === 'newsdata').length;
    const gnewsCount = allArticles.filter(a => a.sourceApi === 'gnews').length;
    const worldnewsCount = allArticles.filter(a => a.sourceApi === 'worldnews').length;
    const mediastackCount = allArticles.filter(a => a.sourceApi === 'mediastack').length;
    
    if (allArticles.length === 0) {
      console.error('[NEWS] ❌❌❌ NO ARTICLES FETCHED FROM ANY API ❌❌❌');
      console.error(`[NEWS] API keys configured: NewsAPI=${!!NEWS_API_KEY}, NewsData=${!!NEWSDATA_API_KEY}, GNews=${!!GNEWS_API_KEY}, WorldNews=${!!WORLD_NEWS_API_KEY}, Mediastack=${!!MEDIASTACK_API_KEY}`);
      console.error('[NEWS] Check Railway logs above for API errors or rate limit messages');
    } else {
      console.log(`[NEWS] ✅ Fetched ${allArticles.length} articles (NewsAPI: ${newsapiCount}, NewsData: ${newsdataCount}, GNews: ${gnewsCount}, WorldNews: ${worldnewsCount}, Mediastack: ${mediastackCount})`);
    }
    
    // Deduplicate articles
    allArticles = deduplicateArticles(allArticles);
    
    // Final filter: Only show articles from last 7 days (more flexible than 24 hours)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const beforeFilter = allArticles.length;
    allArticles = allArticles.filter(article => {
      if (!article.publishedAt) return false;
      const publishedDate = new Date(article.publishedAt);
      return publishedDate >= sevenDaysAgo;
    });
    
    // Log if filter removed many articles (only occasionally)
    if (beforeFilter > 0 && allArticles.length === 0 && Math.random() < 0.1) {
      console.warn(`[NEWS] All ${beforeFilter} articles were filtered out (older than 7 days)`);
    }
    
    // Sort by published date (newest first)
    allArticles.sort((a, b) => {
      const dateA = new Date(a.publishedAt || 0).getTime();
      const dateB = new Date(b.publishedAt || 0).getTime();
      return dateB - dateA;
    });
    
    // Limit to 100 articles
    allArticles = allArticles.slice(0, 100);
    
    const responseData = {
      status: 'ok',
      totalResults: allArticles.length,
      articles: allArticles,
      sources: {
        newsapi: allArticles.filter(a => a.sourceApi === 'newsapi').length,
        newsdata: allArticles.filter(a => a.sourceApi === 'newsdata').length,
        gnews: allArticles.filter(a => a.sourceApi === 'gnews').length,
        worldnews: allArticles.filter(a => a.sourceApi === 'worldnews').length,
        mediastack: allArticles.filter(a => a.sourceApi === 'mediastack').length,
      },
    };
    
      // Cache the response - reduced to 2 minutes for fresher news
      newsCache = {
      data: responseData,
        timestamp: Date.now(),
        CACHE_DURATION: 2 * 60 * 1000, // 2 minutes instead of 5
      };
      
    // Filter by source if needed
    if (source !== 'all') {
      responseData.articles = responseData.articles.filter(a => a.sourceApi === source);
      responseData.totalResults = responseData.articles.length;
    }
    
    // ALWAYS log final results
    if (allArticles.length === 0) {
      console.error(`[${req.id}] ❌❌❌ FINAL RESULT: NO NEWS ARTICLES FOUND ❌❌❌`);
      console.error(`[${req.id}] API keys: NewsAPI=${!!NEWS_API_KEY}, NewsData=${!!NEWSDATA_API_KEY}, GNews=${!!GNEWS_API_KEY}, WorldNews=${!!WORLD_NEWS_API_KEY}, Mediastack=${!!MEDIASTACK_API_KEY}`);
    } else {
      console.log(`[${req.id}] ✅ Final result: ${allArticles.length} articles (NewsAPI: ${newsapiCount}, NewsData: ${newsdataCount}, GNews: ${gnewsCount}, WorldNews: ${worldnewsCount}, Mediastack: ${mediastackCount})`);
    }
    
    res.json(responseData);
  } catch (error) {
    // ALWAYS log errors
    console.error(`[${req.id}] ❌❌❌ ERROR in /api/news:`, error.message, error.stack);
    // Return cached data if available, even if expired
    if (newsCache.data && newsCache.data.articles && newsCache.data.articles.length > 0) {
      let cachedData = newsCache.data;
      
      if (source !== 'all') {
        cachedData = {
          ...cachedData,
          articles: cachedData.articles.filter(a => a.sourceApi === source),
          totalResults: cachedData.articles.filter(a => a.sourceApi === source).length,
        };
      }
      
      console.log(`[NEWS] Returning cached data: ${cachedData.articles.length} articles`);
      return res.json(cachedData);
    }
    
    // If no cache and no API keys configured, return empty but valid response
    if (!NEWS_API_KEY && !NEWSDATA_API_KEY && !GNEWS_API_KEY) {
      console.warn('[NEWS] No news API keys configured - returning empty response');
      return res.json({
        status: 'ok',
        totalResults: 0,
      articles: [],
        sources: { newsapi: 0, newsdata: 0, gnews: 0, worldnews: 0, mediastack: 0 },
      });
    }
    
    // SECURITY: Don't expose error details to clients
    res.status(500).json({ 
      status: 'error',
      error: isProduction ? 'Internal server error' : error.message,
      articles: [],
      totalResults: 0,
    });
  }
});

// Agent trading endpoints
// Load agents module dynamically to not block server startup
// GET /api/agents/:agentId/trades - Get trades for a specific agent
app.get('/api/agents/:agentId/trades', apiLimiter, async (req, res) => {
  try {
    if (!getAgentTrades) {
      const agentsModule = await import('./api/agents.js');
      getAgentTrades = agentsModule.getAgentTrades;
      getAgentsSummary = agentsModule.getAgentsSummary;
      getAgentsStats = agentsModule.getAgentsStats;
    }
    return getAgentTrades(req, res);
  } catch (error) {
    console.error('[API] Failed to load agents module:', error);
    res.status(503).json({ error: 'Agents module not available', message: error.message });
  }
});
console.log('✅ Registered: GET /api/agents/:agentId/trades');

// GET /api/agents/summary - Get summary for all agents
app.get('/api/agents/summary', apiLimiter, async (req, res) => {
  try {
    if (!getAgentsSummary) {
      const agentsModule = await import('./api/agents.js');
      getAgentTrades = agentsModule.getAgentTrades;
      getAgentsSummary = agentsModule.getAgentsSummary;
      getAgentsStats = agentsModule.getAgentsStats;
    }
    return getAgentsSummary(req, res);
  } catch (error) {
    console.error('[API] Failed to load agents module:', error);
    res.status(503).json({ error: 'Agents module not available', message: error.message });
  }
});
console.log('✅ Registered: GET /api/agents/summary');

// Waitlist endpoint - sends email notification
// SECURITY: Apply rate limiting, CSRF protection, and input sanitization
app.post('/api/waitlist', waitlistLimiter, (req, res, next) => {
  // CSRF protection middleware
  // Token can be sent in header (X-CSRF-Token) or body (_csrf) or query (_csrf)
  const token = req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;
  
  // Verify CSRF token
  if (!token) {
    return res.status(403).json({ 
      error: 'CSRF token missing',
      message: 'CSRF token is required. Please refresh the page and try again.'
    });
  }
  
  if (!csrfProtection.verify(csrfSecret, token)) {
    console.warn(`[${req.id}] Invalid CSRF token attempt`);
    return res.status(403).json({ 
      error: 'Invalid CSRF token',
      message: 'CSRF token is invalid. Please refresh the page and try again.'
    });
  }
  
  next();
}, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // SECURITY: Strict email validation and length limit
    const MAX_EMAIL_LENGTH = 254; // RFC 5321
    if (email.length > MAX_EMAIL_LENGTH) {
      return res.status(400).json({ error: 'Email too long' });
    }
    
    // Trim and sanitize email
    const sanitizedEmail = email.trim().toLowerCase().substring(0, MAX_EMAIL_LENGTH);
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // SECURITY: Additional validation - check for common injection patterns
    if (/[<>\"'%;()&+]/.test(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Send email notification to dev@probly.tech
    const notificationEmail = process.env.NOTIFICATION_EMAIL || 'dev@probly.tech';
    
    // SECURITY: Sanitize email for HTML output to prevent injection
    // Escape HTML special characters
    const escapeHtml = (text) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, (m) => map[m]);
    };
    
    const safeEmail = escapeHtml(sanitizedEmail);
    const timestamp = new Date().toISOString();
    
    const subject = `New Waitlist Signup: ${safeEmail}`;
    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Agent Builder Waitlist Signup</h2>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Timestamp:</strong> ${timestamp}</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated notification from the Probly waitlist system.</p>
      </div>
    `;
    const textMessage = `
New user joined the Agent Builder waitlist:

Email: ${sanitizedEmail}
Timestamp: ${timestamp}
    `.trim();

    console.log(`\n=== WAITLIST SIGNUP ===`);
    console.log(`Email: ${sanitizedEmail}`);
    console.log(`Time: ${timestamp}`);
    console.log(`Sending notification to: ${notificationEmail}`);
    console.log(`========================\n`);

    // Send email notification using nodemailer
    // Configure via environment variables:
    // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
    // Or use Gmail with app password
    try {
      // Create transporter - configure based on your email service
      // For Gmail: Use app password (not regular password)
      // For other services: Update SMTP settings accordingly
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_USER,
          pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
        },
      });

      // Only send email if credentials are configured
      if (process.env.SMTP_USER || process.env.EMAIL_USER) {
        const mailOptions = {
          from: process.env.SMTP_USER || process.env.EMAIL_USER,
          to: notificationEmail,
          subject: subject,
          text: textMessage,
          html: htmlMessage,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email notification sent to ${notificationEmail}`);
      } else {
        console.log(`⚠️  Email credentials not configured. Email would be sent to: ${notificationEmail}`);
        console.log(`   Configure SMTP_USER and SMTP_PASS environment variables to enable email sending.`);
      }
    } catch (emailError) {
      console.error('Error sending notification email:', emailError);
      // Don't fail the request if email fails - still return success to user
      // Log the error for debugging
      console.error('Email error details:', emailError.message);
    }

    res.json({ 
      success: true, 
      message: 'Successfully joined waitlist',
      email: sanitizedEmail 
    });
  } catch (error) {
    console.error(`[${req.id}] Waitlist endpoint error:`, error);
    // SECURITY: Don't expose error details to clients
    res.status(500).json({ 
      error: 'Failed to process waitlist signup',
      message: isProduction ? undefined : error.message 
    });
  }
});

// Serve static files from the React app build directory
// This must come AFTER all API routes
// distPath is already defined above, reuse it

// Only serve static files if dist folder exists
if (fs.existsSync(distPath)) {
  console.log(`📁 Serving static files from: ${distPath}`);
  
  // Serve static assets (JS, CSS, images, etc.) FIRST
  // This must come before the catch-all middleware
  app.use(express.static(distPath, {
    maxAge: '1y', // Cache static assets for 1 year
    etag: true,
  }));

  // Handle React Router - serve index.html for all non-API routes
  // This allows client-side routing to work
  // Express 5.x doesn't support '*' pattern, so use a catch-all middleware
  // This MUST be last, after all other routes
  app.use((req, res, next) => {
    // Skip API routes and health checks - they should have been handled already
    if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    // Skip static assets - express.static should have handled these
    // If we reach here, it means express.static didn't find the file
    // So serve index.html for SPA routing
    const indexPath = path.join(distPath, 'index.html');
          res.sendFile(indexPath, (err) => {
            if (err) {
              console.error(`Error serving index.html for ${req.path}: ${err.message}`);
              res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to serve frontend'
              });
            }
            // Don't log successful index.html serves - too frequent, causes log spam
          });
  });
} else {
  console.warn(`⚠️  Dist folder not found at ${distPath} - frontend will not be served`);
  console.warn(`   API endpoints will still work, but frontend routes will return 404`);
  
  // If dist doesn't exist, at least return a helpful message for root route
  app.get('/', (req, res) => {
    res.status(503).json({
      error: 'Frontend not available',
      message: 'Frontend build not found. Please ensure "npm run build" completed successfully.',
      api: {
        health: '/api/health',
        predictions: '/api/predictions',
        news: '/api/news',
        agents: '/api/agents/:agentId/trades',
        agentsSummary: '/api/agents/summary',
      }
    });
  });
}

// Export app for serverless functions (Railway, etc.)
export default app;

// Only start server if not in serverless environment
// Serverless platforms (like AWS Lambda) don't need app.listen
// Railway needs app.listen on 0.0.0.0 to be accessible
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // Add top-level error handler before starting server
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception during startup:', error);
    console.error('Stack:', error.stack);
    // Don't exit - let Railway see the error and restart
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection during startup:', promise);
    console.error('Reason:', reason);
    // Don't exit - let Railway handle it
  });

  console.log('🔧 Starting server...');
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Railway PORT env: ${process.env.PORT || 'NOT SET'}`);
  console.log(`🔧 Attempting to listen on 0.0.0.0:${PORT}...`);
  
  try {
    // Start server with error handling
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Healthcheck available at http://0.0.0.0:${PORT}/api/health`);
      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✅ Railway PORT: ${process.env.PORT || 'not set (using fallback)'}`);
      console.log(`✅ Server started successfully - ready for healthchecks`);
      console.log(`🤖 AI Agent Trading System: Ready`);
      console.log(`   - GET /api/agents/summary - Get all agents summary`);
      console.log(`   - GET /api/agents/:agentId/trades - Get agent trades`);
      console.log(`   - All agents start with $3,000 USD`);
      console.log(`   - Trades generated on-demand when API is called`);
    });

    server.on('error', (err) => {
      console.error('❌ Server failed to start:', err);
      console.error('Error details:', {
        code: err.code,
        message: err.message,
        port: PORT
      });
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      }
      // Don't exit - let Railway see the error and handle it
      // process.exit(1);
    });
    
    // Keep process alive
    process.on('SIGTERM', () => {
      console.log('📴 Received SIGTERM, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ CRITICAL: Failed to start server:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

