# MIRA - AI-Powered Prediction Market Terminal

Real-time AI-powered prediction market interface with live trading analytics and neural network visualizations.

## Features

### AI Agent System
- Multiple AI models for diverse trading strategies
- Real-time decision making and market analysis
- Performance tracking and analytics

### Prediction Market Integration
- Polymarket API integration
- Real-time market data
- Category filtering and search

### Trading Interface
- Interactive bubble visualization
- Zoom and pan controls
- Real-time position tracking
- Trade execution on Solana

### Agent Builder
- 3-step wizard interface
- Strategy configuration
- Risk management settings
- Live testing and deployment

## Trade Lifecycle Flowchart

The following flowchart illustrates how AI agents manage trading positions from opening to closing:

```mermaid
flowchart TD
    A[Agent Cycle Starts<br/>Every 30-60s] --> B[Load Portfolio<br/>from Persistence]
    B --> C[Update Portfolio Metrics<br/>Calculate Unrealized PnL]
    C --> D[Process Position Lifecycle]
    D --> E{Check Exit Conditions<br/>for Each Open Position}
    E -->|No Exit| F[Position Stays Open]
    E -->|Take Profit Hit| G[Close Position]
    E -->|Stop Loss Hit| G
    E -->|Time Limit Reached| G
    E -->|Score Decay| G
    E -->|Market Unavailable| G
    G --> H[Calculate Realized PnL]
    H --> I[Remove from Open Positions]
    I --> J[Update Portfolio Stats<br/>Add Realized PnL to Capital]
    J --> K[Generate New Trades<br/>Based on Available Capital]
    K --> L[Save Portfolio<br/>to Persistence]
    L --> M[Next Cycle]
    M --> A
    F --> K
```

### Flow Explanation

1. **Agent Cycle Starts**: Trading cycle runs every 30-60 seconds for each agent
2. **Load Portfolio**: Agent's portfolio is loaded from persistence (Redis or database) with all open positions
3. **Update Portfolio Metrics**: System fetches current market probabilities and calculates unrealized PnL for all open positions
4. **Process Position Lifecycle**: System iterates through each open position to check exit conditions
5. **Check Exit Conditions**: For each position, system evaluates:
   - **Take Profit**: 
     - YES position closes if probability >= 80%
     - NO position closes if probability <= 20%
   - **Stop Loss**:
     - YES position closes if probability <= 30%
     - NO position closes if probability >= 70%
   - **Time Limit**: Position open for > 30 days
   - **Score Decay**: Market score drops below 20
   - **Market Unavailable**: Market no longer exists or accessible
   - **No Exit**: Position continues to be monitored
6. **Close Position**: When exit condition is met, position is marked for closing
7. **Calculate Realized PnL**: Final profit/loss is calculated based on entry vs exit probability
8. **Remove from Open Positions**: Position is removed from active portfolio
9. **Update Portfolio Stats**: Realized PnL is added to agent's capital and portfolio statistics
10. **Generate New Trades**: Agent analyzes markets and generates new trades based on available capital and risk limits
11. **Save Portfolio**: Updated portfolio (with closed positions and new trades) is saved to persistence
12. **Next Cycle**: Process repeats in the next cycle interval

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Express.js + Node.js
- **UI:** shadcn/ui + Tailwind CSS
- **Blockchain:** Solana Web3.js
- **Deployment:** Railway

## Development

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Run Development Server

Start both frontend and backend:
```bash
npm run dev:all
```

Or separately:
```bash
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend
npm run dev
```

The application will be available at:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3002`

### Build

Build for production:
```bash
npm run build
```

## Environment Variables

### Backend (Railway/Server)

Required:
- `PORT` - Server port (auto-set by Railway)
- `NODE_ENV` - Environment (production/development)

Optional:
- `REDIS_URL` - Redis connection URL for session storage (highly recommended for production)
  - **How to get:** Add Redis addon in Railway dashboard → Your Service → "+ New" → "Database" → "Add Redis"
  - Railway will automatically set this variable when you add the Redis addon
  - Without Redis, sessions are stored in memory (lost on restart, won't work across multiple instances)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `CSRF_SECRET` - Secret for CSRF token generation (recommended for production)
- `SESSION_SECRET` - Secret for session management (required for Google OAuth, recommended for production)
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID (required for Google login)
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret (required for Google login)
- `GOOGLE_CALLBACK_URL` - Google OAuth callback URL (defaults to `https://mira.tech/api/auth/google/callback` in production)
- `NEWS_API_KEY` - NewsAPI.org API key
- `NEWSDATA_API_KEY` - NewsData.io API key
- `GNEWS_API_KEY` - GNews API key
- `POLYMARKET_API_KEY` - Polymarket API key
- `POLYMARKET_SECRET` - Polymarket API secret
- `POLYMARKET_PASSPHRASE` - Polymarket API passphrase
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `NOTIFICATION_EMAIL` - Email for waitlist notifications

### Frontend

Optional:
- `VITE_API_BASE_URL` - Custom API base URL (defaults to relative URLs in production)

## Project Structure

```
aura-predict/
├── src/
│   ├── components/     # React components
│   │   ├── ui/         # shadcn/ui components
│   │   └── ...         # Feature components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility libraries and API clients
│   └── types/          # TypeScript type definitions
├── server/
│   ├── services/       # Business logic services
│   ├── utils/          # Utility functions
│   └── index.js        # Express server
├── public/             # Static assets
└── dist/               # Production build output
```

## Google OAuth Setup

To enable Google login:

1. **Create Google OAuth Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google+ API
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - Production: `https://mira.tech/api/auth/google/callback`
     - Development: `http://localhost:3002/api/auth/google/callback`

2. **Set Environment Variables:**
   ```bash
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   SESSION_SECRET=your-session-secret  # Generate with: openssl rand -base64 32
   ```

3. **Deploy:**
   - Add these variables to your Railway project settings
   - The OAuth flow will work automatically once configured

## Security

The application includes comprehensive security features:
- CSRF protection
- Rate limiting
- Input validation
- Security headers (Helmet.js)
- CORS configuration
- Error sanitization
- Google OAuth authentication
- Secure session management

## License

This project is private and proprietary.

## Contact

For inquiries about MIRA, please contact dev@mira.tech

---

**Built for the prediction market community**

