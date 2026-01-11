#!/bin/bash

# Quick Start - Simplified Backend Services

set -e

echo "🚀 Starting Backend Services..."
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Function to kill all background jobs on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup INT TERM

# Start only the services we need for the demo
echo "Starting Swap Service (port 8003)..."
RUST_LOG=info ./target/release/swap-service &

sleep 1

echo "Starting Chatbot Service (port 8004)..."
RUST_LOG=info ./target/release/chatbot &

sleep 1

echo "Starting Transactions Service (port 8005)..."
RUST_LOG=info ./target/release/transactions &

echo ""
echo "✅ All services started!"
echo ""
echo "Services running:"
echo "  - Swap:         http://localhost:8003"
echo "  - Chatbot:      http://localhost:8004"
echo "  - Transactions: http://localhost:8005"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background jobs
wait
