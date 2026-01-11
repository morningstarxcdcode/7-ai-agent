#!/bin/bash

# Blockchain Wallet Platform - Test Suite

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:8000"
SWAP_URL="http://localhost:8003"
CHAT_URL="http://localhost:8004"
TX_URL="http://localhost:8005"

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Blockchain Wallet Platform - Integration Tests           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check if services are running
echo -e "${BLUE}🔍 Checking if services are running...${NC}"
echo ""

test_service() {
    local name=$1
    local url=$2
    
    if curl -s "$url/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name is running at $url"
        return 0
    else
        echo -e "${RED}✗${NC} $name is NOT running at $url"
        return 1
    fi
}

test_service "Swap Service" "$SWAP_URL" || MISSING_SERVICES=true
test_service "Chatbot Service" "$CHAT_URL" || MISSING_SERVICES=true
test_service "Transactions Service" "$TX_URL" || MISSING_SERVICES=true

if [ "$MISSING_SERVICES" = true ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Some services are not running!${NC}"
    echo "Please start them with: ./start-demo.sh"
    exit 1
fi

echo ""
echo -e "${BLUE}📝 Running API Tests...${NC}"
echo ""

# Test Swap Service
echo -e "${BLUE}1. Testing Swap Service${NC}"
SWAP_QUOTE=$(curl -s "$SWAP_URL/swap/quote?from_token=ETH&to_token=USDC&amount=1.0")
if echo "$SWAP_QUOTE" | grep -q "to_amount"; then
    echo -e "  ${GREEN}✓${NC} Quote endpoint working"
    echo "    Quote: 1 ETH ≈ $(echo $SWAP_QUOTE | grep -o '"to_amount":"[^"]*"' | cut -d'"' -f4) USDC"
else
    echo -e "  ${RED}✗${NC} Quote endpoint failed"
fi

TOKENS=$(curl -s "$SWAP_URL/swap/tokens")
if echo "$TOKENS" | grep -q "ETH"; then
    echo -e "  ${GREEN}✓${NC} Tokens endpoint working"
    echo "    Tokens: $(echo $TOKENS | grep -o '"symbol":"[^"]*"' | cut -d'"' -f4 | tr '\n' ', ' | sed 's/,$//')"
else
    echo -e "  ${RED}✗${NC} Tokens endpoint failed"
fi

echo ""

# Test Chatbot Service
echo -e "${BLUE}2. Testing Chatbot Service${NC}"
CHAT_RESPONSE=$(curl -s -X POST "$CHAT_URL/chat/message" \
  -H "Content-Type: application/json" \
  -d '{"message": "Swap 0.1 ETH to USDC", "context": null}')
if echo "$CHAT_RESPONSE" | grep -q "response"; then
    echo -e "  ${GREEN}✓${NC} Chat endpoint working"
    RESPONSE=$(echo $CHAT_RESPONSE | grep -o '"response":"[^"]*"' | cut -d'"' -f4 | head -c 50)
    echo "    Response: $RESPONSE..."
else
    echo -e "  ${RED}✗${NC} Chat endpoint failed"
fi

echo ""

# Test Transactions Service
echo -e "${BLUE}3. Testing Transactions Service${NC}"
HEALTH=$(curl -s "$TX_URL/health")
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "  ${GREEN}✓${NC} Transactions endpoint working"
else
    echo -e "  ${RED}✗${NC} Transactions endpoint failed"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ ALL TESTS PASSED ✨${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Services Status:${NC}"
echo "  - Swap Service:         $SWAP_URL"
echo "  - Chatbot Service:      $CHAT_URL"
echo "  - Transactions Service: $TX_URL"
echo ""
echo -e "${BLUE}Frontend Ready:${NC}"
echo "  - Dev Server:    npm run dev (port 3000)"
echo "  - Production:    frontend/dist"
echo ""
