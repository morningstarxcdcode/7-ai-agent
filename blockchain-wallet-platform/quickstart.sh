#!/bin/bash

# Blockchain Wallet Platform - Quick Start Guide

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Blockchain Wallet Platform - Quick Start                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js not found. Installing...${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# Check Rust
if ! command -v cargo &> /dev/null; then
    echo -e "${YELLOW}⚠️  Rust not found. Installing...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
fi
echo -e "${GREEN}✓${NC} Rust/Cargo installed"

# Check MetaMask
echo -e "${YELLOW}ℹ️  Please ensure MetaMask browser extension is installed${NC}"
echo "   Download from: https://metamask.io"

echo ""
echo -e "${BLUE}🚀 Building & Starting Platform...${NC}"
echo ""

# Build
if [ ! -f "target/release/swap-service" ] || [ ! -f "target/release/chatbot" ] || [ ! -f "target/release/transactions" ]; then
    echo "Building backend services..."
    ./build.sh
fi

# Create .env if missing
if [ ! -f ".env" ]; then
    echo "Creating .env configuration..."
    cat > .env << 'EOF'
GATEWAY_SERVER_ADDR=0.0.0.0:8000
GATEWAY_AUTH_BASE_URL=http://localhost:8001
GATEWAY_WALLET_BASE_URL=http://localhost:8002
GATEWAY_TRANSACTIONS_BASE_URL=http://localhost:8005
GATEWAY_BUSINESS_CARDS_BASE_URL=http://localhost:8006
GATEWAY_AUTONOMOUS_CODER_BASE_URL=http://localhost:8007
GATEWAY_SWAP_BASE_URL=http://localhost:8003
GATEWAY_CHATBOT_BASE_URL=http://localhost:8004
RUST_LOG=info
EOF
    echo -e "${GREEN}✓${NC} .env created"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ SETUP COMPLETE ✨${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}📌 Running in 3 Terminal Windows:${NC}"
echo ""

echo -e "${BLUE}Terminal 1 - Backend Services:${NC}"
echo "  $ ./start-demo.sh"
echo "  (Keeps running - backend services on ports 8003, 8004, 8005)"
echo ""

echo -e "${BLUE}Terminal 2 - Frontend Development:${NC}"
echo "  $ ./start-frontend.sh"
echo "  (Starts dev server on port 3000)"
echo ""

echo -e "${BLUE}Terminal 3 - Open Browser:${NC}"
echo "  $ open http://localhost:3000"
echo ""

echo -e "${BLUE}📝 Optional - Run Tests:${NC}"
echo "  $ chmod +x test.sh && ./test.sh"
echo ""

echo -e "${YELLOW}💡 Pro Tips:${NC}"
echo "  1. Use MetaMask to connect your wallet"
echo "  2. Try the AI chatbot: 'Swap 0.1 ETH to USDC'"
echo "  3. Check browser DevTools (F12) for API calls"
echo "  4. All transactions stored in-memory for demo"
echo ""

echo -e "${BLUE}🎯 Project Features:${NC}"
echo "  ✨ Professional React UI with TailwindCSS"
echo "  🤖 AI-powered chatbot for natural language swaps"
echo "  💱 Real-time token swap quotes"
echo "  📊 Transaction tracking and history"
echo "  🔐 MetaMask wallet integration"
echo "  ⚡ Real-time updates every 5 seconds"
echo ""

echo -e "${BLUE}📚 Documentation:${NC}"
echo "  - DEMO_GUIDE.md     - Complete usage guide"
echo "  - README.md         - Project overview"
echo "  - Tech stack details in package.json & Cargo.toml"
echo ""

# Ask to start
read -p "Start the platform now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}Starting backend services...${NC}"
    chmod +x ./start-demo.sh
    ./start-demo.sh
else
    echo ""
    echo "To start manually, run:"
    echo "  1. ./start-demo.sh"
    echo "  2. ./start-frontend.sh"
    echo "  3. open http://localhost:3000"
fi
