#!/bin/bash

# Blockchain Wallet Platform - Health Check & Diagnostics

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Blockchain Wallet Platform - Health Check                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Function to check command exists
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 installed"
        return 0
    else
        echo -e "${RED}✗${NC} $1 NOT installed"
        return 1
    fi
}

# Function to check port
check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${GREEN}✓${NC} $service running on port $port"
        return 0
    else
        echo -e "${RED}✗${NC} $service NOT running on port $port"
        return 1
    fi
}

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 exists"
        return 0
    else
        echo -e "${RED}✗${NC} $1 NOT found"
        return 1
    fi
}

echo -e "${BLUE}1️⃣  System Requirements${NC}"
check_command node && NODE_OK=1
check_command cargo && CARGO_OK=1
check_command npm && NPM_OK=1
echo ""

echo -e "${BLUE}2️⃣  Project Files${NC}"
check_file "package.json" && PKG_OK=1
check_file "Cargo.toml" && CARGO_TOML_OK=1
check_file ".env" || echo -e "${YELLOW}⚠️${NC} .env not found (will be created)"
echo ""

echo -e "${BLUE}3️⃣  Build Artifacts${NC}"
check_file "target/release/swap-service" && SWAP_BUILT=1
check_file "target/release/chatbot" && CHATBOT_BUILT=1
check_file "target/release/transactions" && TX_BUILT=1
check_file "frontend/dist/index.html" && FRONTEND_BUILT=1
echo ""

echo -e "${BLUE}4️⃣  Running Services${NC}"
check_port 8003 "Swap Service" || SWAP_RUNNING=0
check_port 8004 "Chatbot Service" || CHATBOT_RUNNING=0
check_port 8005 "Transactions Service" || TX_RUNNING=0
check_port 3000 "Frontend Dev" || FRONTEND_RUNNING=0
echo ""

echo -e "${BLUE}5️⃣  Dependency Health${NC}"

# Check node modules
if [ -d "frontend/node_modules" ]; then
    NODE_MODULES=$(find frontend/node_modules -maxdepth 1 -type d | wc -l)
    if [ $NODE_MODULES -gt 100 ]; then
        echo -e "${GREEN}✓${NC} Node modules installed ($NODE_MODULES packages)"
    else
        echo -e "${YELLOW}⚠️${NC} Node modules incomplete"
    fi
else
    echo -e "${RED}✗${NC} Node modules not installed"
fi

# Check Cargo.lock
if [ -f "Cargo.lock" ]; then
    echo -e "${GREEN}✓${NC} Cargo dependencies locked"
else
    echo -e "${YELLOW}⚠️${NC} No Cargo.lock (will be created on build)"
fi
echo ""

echo -e "${BLUE}6️⃣  Configuration${NC}"

# Check .env
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} Environment configured"
    GATEWAY_URL=$(grep "GATEWAY_SWAP_BASE_URL" .env | cut -d= -f2)
    echo "  - Swap Service: $GATEWAY_URL"
else
    echo -e "${YELLOW}⚠️${NC} .env not configured"
fi
echo ""

echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""

# Summary
BUILD_READY=0
RUN_READY=0

if [ "$NODE_OK" = "1" ] && [ "$CARGO_OK" = "1" ] && [ "$NPM_OK" = "1" ]; then
    BUILD_READY=1
fi

if [ "$SWAP_BUILT" = "1" ] && [ "$CHATBOT_BUILT" = "1" ] && [ "$TX_BUILT" = "1" ] && [ "$FRONTEND_BUILT" = "1" ]; then
    RUN_READY=1
fi

echo -e "${BLUE}📊 Status Summary:${NC}"
echo ""

if [ "$BUILD_READY" = "1" ]; then
    echo -e "${GREEN}✨ SYSTEM READY FOR BUILD${NC}"
    echo "  Run: ./build.sh"
else
    echo -e "${YELLOW}⚠️  MISSING BUILD DEPENDENCIES${NC}"
    [ "$NODE_OK" != "1" ] && echo "  - Install Node.js: https://nodejs.org/"
    [ "$CARGO_OK" != "1" ] && echo "  - Install Rust: https://rustup.rs/"
fi
echo ""

if [ "$RUN_READY" = "1" ]; then
    echo -e "${GREEN}✨ SYSTEM READY TO RUN${NC}"
    echo "  1. Backend: ./start-demo.sh"
    echo "  2. Frontend: ./start-frontend.sh"
    echo "  3. Browser: http://localhost:3000"
else
    if [ "$SWAP_BUILT" != "1" ] || [ "$CHATBOT_BUILT" != "1" ] || [ "$TX_BUILT" != "1" ]; then
        echo -e "${YELLOW}⚠️  BACKEND NOT BUILT${NC}"
        echo "  Run: cargo build --release"
    fi
    if [ "$FRONTEND_BUILT" != "1" ]; then
        echo -e "${YELLOW}⚠️  FRONTEND NOT BUILT${NC}"
        echo "  Run: cd frontend && npm run build"
    fi
fi
echo ""

if [ "$SWAP_RUNNING" = "1" ] && [ "$CHATBOT_RUNNING" = "1" ] && [ "$TX_RUNNING" = "1" ]; then
    echo -e "${GREEN}✨ ALL SERVICES RUNNING${NC}"
    echo "  Frontend: http://localhost:3000"
    echo "  Swap API: http://localhost:8003"
    echo "  Chat API: http://localhost:8004"
    echo "  TX API:   http://localhost:8005"
    echo ""
    echo "  Run tests: ./test.sh"
fi

echo ""
