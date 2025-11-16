# Aura Predict

**AI-Powered Prediction Market Terminal**

A professional prediction and trading platform built with modern web technologies, featuring AI-powered agents and real-time market analysis.

## 🚀 Overview

Aura Predict is a comprehensive trading and prediction platform that integrates multiple AI agents for market analysis and decision-making. The platform provides real-time market data, technical analysis, and automated trading capabilities with a focus on Solana-based prediction markets.

## ✨ Features

- **🤖 AI-Powered Agents**: Multiple AI agents (GPT, Claude, Grok, DeepSeek, Gemini) for market analysis and predictions
- **📊 Real-Time Market Data**: Live feed integration with Polymarket and other prediction market providers
- **📈 Technical Analysis**: Advanced charting and technical indicators
- **💼 Trading Dashboard**: Comprehensive trading interface with position management
- **🔐 Custodial Wallet Integration**: Secure wallet management for Solana transactions
- **📉 Performance Tracking**: Real-time performance metrics and analytics
- **🎯 Agent Builder**: Create and deploy custom AI trading agents with a user-friendly wizard interface

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router DOM
- **Blockchain**: Solana Web3.js
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Backend**: Express.js + Node.js

## 📋 Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/greaterdan/aura-predict.git
cd aura-predict
```

2. Install dependencies:
```bash
npm install
```

## 🏃 Development

Start the development server:
```bash
npm run dev
```

Start the backend server:
```bash
npm run server
```

Start both frontend and backend concurrently:
```bash
npm run dev:all
```

The application will be available at `http://localhost:3000` (frontend) and `http://localhost:3002` (backend).

## 🏗️ Build

Build for production:
```bash
npm run build
```

Build for development:
```bash
npm run build:dev
```

Preview production build:
```bash
npm run preview
```

## 📁 Project Structure

```
aura-predict/
├── src/
│   ├── components/     # React components
│   │   ├── ui/         # shadcn/ui components
│   │   └── ...         # Feature components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility libraries and API clients
│   ├── types/          # TypeScript type definitions
│   └── App.tsx         # Main application component
├── public/             # Static assets
├── server.js           # Express backend server
├── package.json        # Project dependencies
└── vite.config.ts      # Vite configuration
```

## 🔑 Key Features

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

## 📝 License

This project is private and proprietary.

## 🤝 Contributing

This is a private project. For access or questions, please contact the repository owner.

## 📧 Contact

For inquiries about Aura Predict, please reach out through the repository.

---

**Built with ❤️ for the prediction market community**
