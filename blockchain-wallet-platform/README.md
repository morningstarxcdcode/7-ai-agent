# Blockchain Wallet Platform

A professional, full-stack blockchain wallet platform with AI-powered transaction assistance.

## Features

✨ **Modern UI/UX**
- Beautiful, responsive dashboard
- Real-time balance tracking
- Transaction history with filtering
- Smooth animations and transitions

🔄 **Token Swapping**
- Instant token swaps
- Real-time price quotes
- Low slippage guarantees
- Multi-token support (ETH, USDC, USDT, DAI, WBTC)

🤖 **AI Chat Assistant**
- Natural language transaction guidance
- "Swap 0.1 ETH to USDC" - it understands!
- Context-aware suggestions
- 24/7 availability

🔐 **Security First**
- Non-custodial wallet
- MetaMask integration
- Private keys never leave your device
- Secure transaction signing

## Quick Start

### Prerequisites

- Rust 1.70+
- Node.js 18+
- MetaMask browser extension

### Installation

```bash
# Run the setup script
chmod +x setup.sh start-backend.sh start-frontend.sh
./setup.sh
```

### Running the Platform

1. **Start the backend** (in one terminal):
```bash
./start-backend.sh
```

2. **Start the frontend** (in another terminal):
```bash
./start-frontend.sh
```

3. **Open your browser** and navigate to:
```
http://localhost:3000
```

## Services
- `gateway`: API gateway (Port 8000)
- `wallet`: Non-custodial wallet operations (Port 8002)
- `swap`: Token swap functionality (Port 8003)
- `chatbot`: AI assistant (Port 8004)
- `transactions`: Transaction persistence (Port 8005)
- `auth`: Google OAuth authentication
- `business-cards`: Digital business card system (IPFS + blockchain)
- `autonomous-coder`: Sandboxed autonomous coding system
- `gateway`: Unified API gateway that forwards to the services

## Local development
1. Start dependencies:
   - PostgreSQL and Redis via docker-compose.
2. Run a service:
   - `cargo run -p auth`
   - `cargo run -p transactions`
3. Run the gateway:
   - `cargo run -p gateway`

## Migrations
SQL migrations are in `migrations/`.
Use your preferred migration tool (e.g., `sqlx-cli`) to apply them to PostgreSQL.

## Environment
Copy `.env.example` to `.env` and update values.
