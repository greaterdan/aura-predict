# Aura Predict - AI-Powered Prediction Market Terminal

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
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
- `CSRF_SECRET` - Secret for CSRF token generation (recommended for production)
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

## Security

The application includes comprehensive security features:
- CSRF protection
- Rate limiting
- Input validation
- Security headers (Helmet.js)
- CORS configuration
- Error sanitization

## License

This project is private and proprietary.

## Contact

For inquiries about Probly, please contact dev@probly.tech

---

**Built for the prediction market community**

