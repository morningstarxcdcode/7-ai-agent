#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Multi-Platform Verification & Setup Script${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
    fi
}

# Check Prerequisites
echo -e "${YELLOW}Checking Prerequisites...${NC}\n"

if command_exists node; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js$NC found: $NODE_VERSION"
else
    echo -e "${RED}✗ Node.js not found (required for frontends)${NC}"
    exit 1
fi

if command_exists npm; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓ npm${NC} found: $NPM_VERSION"
else
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi

if command_exists python3; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✓ Python3${NC} found: $PYTHON_VERSION"
else
    echo -e "${YELLOW}⚠ Python3 not found (only needed for DeFi backend)${NC}"
fi

if command_exists cargo; then
    RUST_VERSION=$(rustc --version)
    echo -e "${GREEN}✓ Rust${NC} found: $RUST_VERSION"
else
    echo -e "${YELLOW}⚠ Rust not found (only needed for Blockchain services)${NC}"
fi

echo ""

# Check Project Structures
echo -e "${YELLOW}Checking Project Structures...${NC}\n"

PROJECTS=(
    "blockchain-wallet-platform"
    "defi-automation-platform"
    "multi-agent-autonomous-engineering"
)

for project in "${PROJECTS[@]}"; do
    if [ -d "$project" ]; then
        echo -e "${GREEN}✓${NC} $project exists"
        
        # Check for package.json in frontend
        if [ -f "$project/frontend/package.json" ]; then
            echo -e "  ${GREEN}✓${NC} Frontend package.json found"
        fi
        
        # Check for specific files
        if [ -f "$project/package.json" ]; then
            echo -e "  ${GREEN}✓${NC} Backend package.json found"
        elif [ -f "$project/Cargo.toml" ]; then
            echo -e "  ${GREEN}✓${NC} Backend Cargo.toml (Rust) found"
        elif [ -f "$project/requirements.txt" ]; then
            echo -e "  ${GREEN}✓${NC} Backend requirements.txt (Python) found"
        fi
    else
        echo -e "${RED}✗${NC} $project not found"
    fi
done

echo ""

# Check Port Availability
echo -e "${YELLOW}Checking Port Availability...${NC}\n"

PORTS=(3000 3001 3002 8000 8001 8003 8004 8005)

for port in "${PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}✗ Port $port${NC} is in use"
    else
        echo -e "${GREEN}✓ Port $port${NC} is available"
    fi
done

echo ""

# Check Frontend Dependencies
echo -e "${YELLOW}Checking Frontend Configurations...${NC}\n"

# DeFi Frontend
if [ -f "defi-automation-platform/frontend/vite.config.ts" ]; then
    echo -e "${GREEN}✓${NC} DeFi Frontend: Vite configured"
fi

if [ -f "defi-automation-platform/frontend/tailwind.config.js" ]; then
    echo -e "${GREEN}✓${NC} DeFi Frontend: TailwindCSS configured"
fi

# Multi-Agent Frontend
if [ -f "multi-agent-autonomous-engineering/frontend/vite.config.ts" ]; then
    echo -e "${GREEN}✓${NC} Multi-Agent Frontend: Vite configured"
fi

if [ -f "multi-agent-autonomous-engineering/frontend/tailwind.config.js" ]; then
    echo -e "${GREEN}✓${NC} Multi-Agent Frontend: TailwindCSS configured"
fi

echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Verification Complete${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}Next Steps:${NC}\n"
echo "1. Install frontend dependencies:"
echo "   cd defi-automation-platform/frontend && npm install"
echo "   cd multi-agent-autonomous-engineering/frontend && npm install"
echo ""
echo "2. Start backends in separate terminals:"
echo "   cd defi-automation-platform && python -m flask run --port 8000"
echo "   cd multi-agent-autonomous-engineering && npm run dev:backend"
echo ""
echo "3. Start frontends:"
echo "   cd defi-automation-platform/frontend && npm run dev"
echo "   cd multi-agent-autonomous-engineering/frontend && npm run dev"
echo ""
echo "4. Access platforms:"
echo "   Blockchain Wallet: http://localhost:3000"
echo "   DeFi Platform: http://localhost:3001"
echo "   Multi-Agent Platform: http://localhost:3002"
echo ""
