#!/bin/bash

# Blockchain Wallet Platform - Production Build & Deployment

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Blockchain Wallet Platform - Production Build            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Step 1: Build Backend Services
echo -e "${BLUE}📦 Step 1: Building Rust Backend Services...${NC}"
cd "$(dirname "$0")"

echo "Building Swap Service..."
cargo build --bin swap-service --release --quiet || { echo -e "${RED}❌ Swap service build failed${NC}"; exit 1; }
echo -e "${GREEN}✓ Swap service compiled${NC}"

echo "Building Chatbot Service..."
cargo build --bin chatbot --release --quiet || { echo -e "${RED}❌ Chatbot service build failed${NC}"; exit 1; }
echo -e "${GREEN}✓ Chatbot service compiled${NC}"

echo "Building Transactions Service..."
cargo build --bin transactions --release --quiet || { echo -e "${RED}❌ Transactions service build failed${NC}"; exit 1; }
echo -e "${GREEN}✓ Transactions service compiled${NC}"

echo ""
echo -e "${BLUE}📦 Step 2: Building React Frontend...${NC}"

cd frontend
echo "Installing dependencies..."
npm install --quiet 2>/dev/null || npm ci --quiet

echo "Building production bundle..."
npm run build --quiet 2>/dev/null || { echo -e "${RED}❌ Frontend build failed${NC}"; exit 1; }
echo -e "${GREEN}✓ Frontend compiled${NC}"

cd ..
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ BUILD SUCCESSFUL! ✨${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""

echo "Binaries ready at:"
echo "  - Swap:         target/release/swap-service"
echo "  - Chatbot:      target/release/chatbot"
echo "  - Transactions: target/release/transactions"
echo ""
echo "Frontend ready at:"
echo "  - Build:  frontend/dist"
echo "  - Dev:    npm run dev"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Run:  ./start-demo.sh      (Backend)"
echo "  2. Run:  ./start-frontend.sh  (Frontend Dev)"
echo "  3. Open: http://localhost:3000"
echo ""
