# Aura Predict

A professional prediction and trading platform built with modern web technologies, featuring AI-powered agents and real-time market analysis.

## Technology Stack

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Solana](https://img.shields.io/badge/Solana-9945FF?style=for-the-badge&logo=solana&logoColor=white)

## Overview

Aura Predict is a comprehensive trading and prediction platform that integrates AI agents for market analysis and decision-making. The platform provides real-time market data, technical analysis, and automated trading capabilities with a focus on Solana-based markets.

## Features

- **AI-Powered Agents**: Multiple AI agents for market analysis and predictions
- **Real-Time Market Data**: Live feed integration with market data providers
- **Technical Analysis**: Advanced charting and technical indicators
- **Trading Dashboard**: Comprehensive trading interface with position management
- **Custodial Wallet Integration**: Secure wallet management for Solana transactions
- **Performance Tracking**: Real-time performance metrics and analytics

## Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd aura-predict
```

2. Install dependencies:
```bash
npm install
```

## Development

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

The application will be available at `http://localhost:5173` (or the port specified by Vite).

## Build

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

## Linting

Run ESLint to check code quality:
```bash
npm run lint
```

## Project Structure

```
aura-predict/
├── src/
│   ├── components/     # React components
│   ├── pages/          # Page components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility libraries and API clients
│   ├── types/          # TypeScript type definitions
│   └── App.tsx         # Main application component
├── public/             # Static assets
├── server.js           # Express backend server
└── package.json        # Project dependencies
```

## Key Technologies

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router DOM
- **Blockchain**: Solana Web3.js
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Form Handling**: React Hook Form with Zod validation
- **Backend**: Express.js

## License

This project is private and proprietary.
