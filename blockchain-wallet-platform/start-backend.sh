#!/bin/bash

# Start all backend services

set -e

echo "🚀 Starting Blockchain Wallet Platform Backend Services..."
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

# Start services
echo "Starting Gateway (port 8000)..."
RUST_LOG=info cargo run --bin gateway &

sleep 2

echo "Starting Wallet Service (port 8002)..."
RUST_LOG=info cargo run --bin wallet &

sleep 1

echo "Starting Swap Service (port 8003)..."
RUST_LOG=info cargo run --bin swap-service &

sleep 1

echo "Starting Chatbot Service (port 8004)..."
RUST_LOG=info cargo run --bin chatbot &

sleep 1

echo "Starting Transactions Service (port 8005)..."
RUST_LOG=info cargo run --bin transactions &

echo ""
echo "✅ All services started!"
echo ""
echo "Services running:"
echo "  - Gateway:      http://localhost:8000"
echo "  - Wallet:       http://localhost:8002"
echo "  - Swap:         http://localhost:8003"
echo "  - Chatbot:      http://localhost:8004"
echo "  - Transactions: http://localhost:8005"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background jobs
wait
