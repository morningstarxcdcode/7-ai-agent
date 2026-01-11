#!/bin/bash

# Blockchain Wallet Platform - Complete Setup Script

set -e

echo "🚀 Setting up Blockchain Wallet Platform..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Install frontend dependencies
echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
cd frontend
npm install
cd ..
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
echo ""

# Step 2: Build Rust backend
echo -e "${BLUE}🔨 Building Rust backend services...${NC}"
cargo build --release
echo -e "${GREEN}✓ Backend services built${NC}"
echo ""

# Step 3: Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${BLUE}📝 Creating .env file...${NC}"
    cat > .env << 'EOF'
# Gateway Configuration
GATEWAY_SERVER_ADDR=0.0.0.0:8000
GATEWAY_AUTH_BASE_URL=http://localhost:8001
GATEWAY_WALLET_BASE_URL=http://localhost:8002
GATEWAY_TRANSACTIONS_BASE_URL=http://localhost:8005
GATEWAY_BUSINESS_CARDS_BASE_URL=http://localhost:8006
GATEWAY_AUTONOMOUS_CODER_BASE_URL=http://localhost:8007
GATEWAY_SWAP_BASE_URL=http://localhost:8003
GATEWAY_CHATBOT_BASE_URL=http://localhost:8004

# Rust Log Level
RUST_LOG=info
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi
echo ""

echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo "To start the platform:"
echo "  1. Run: ./start-backend.sh  (in one terminal)"
echo "  2. Run: ./start-frontend.sh (in another terminal)"
echo "  3. Open: http://localhost:3000"
echo ""
