#!/bin/bash

# Splat Window Launcher
# This script starts both the frontend and backend servers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔════════════════════════════════════════════╗"
echo "║         Splat Window Launcher              ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if Python venv exists, create if not
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Python virtual environment not found. Setting it up automatically...${NC}"
    
    # Try to find a good python
    PYTHON_CMD="python3"
    if [ -f "/opt/homebrew/opt/python@3.13/bin/python3.13" ]; then
        PYTHON_CMD="/opt/homebrew/opt/python@3.13/bin/python3.13"
    fi
    
    echo "Using python: $PYTHON_CMD"
    $PYTHON_CMD -m venv .venv
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Virtual environment created.${NC}"
        echo "Installing dependencies..."
        source .venv/bin/activate
        pip install --upgrade pip
        pip install fastapi uvicorn python-multipart numpy
        # Install sharp dependencies
        if [ -f "ml-sharp/requirements_mac.txt" ]; then
            pip install -r ml-sharp/requirements_mac.txt
        fi
        # Install sharp in editable mode
        if [ -d "ml-sharp" ]; then
             pip install -e ml-sharp/
        fi
        BACKEND_AVAILABLE=true
    else
        echo -e "${RED}Failed to create virtual environment.${NC}"
        echo "Please install Python 3.10+ manually."
        BACKEND_AVAILABLE=false
    fi
else
    BACKEND_AVAILABLE=true
fi

# Kill any existing processes on our ports
echo -e "${BLUE}Cleaning up old processes...${NC}"
lsof -ti :5173 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti :8000 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    kill $FRONTEND_PID 2>/dev/null
    kill $BACKEND_PID 2>/dev/null
    lsof -ti :5173 2>/dev/null | xargs kill -9 2>/dev/null
    lsof -ti :8000 2>/dev/null | xargs kill -9 2>/dev/null
    echo -e "${GREEN}Goodbye!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend if available
if [ "$BACKEND_AVAILABLE" = true ]; then
    echo -e "${BLUE}Starting backend server (SHARP image conversion)...${NC}"
    source .venv/bin/activate
    python server/main.py > /tmp/splat_backend.log 2>&1 &
    BACKEND_PID=$!
    sleep 2

    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "${GREEN}✓ Backend running on http://localhost:8000${NC}"
    else
        echo -e "${RED}✗ Backend failed to start${NC}"
        echo "  Check /tmp/splat_backend.log for details"
        BACKEND_AVAILABLE=false
    fi
else
    echo -e "${YELLOW}⚠ Backend not available (image conversion disabled)${NC}"
fi

# Start frontend
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
fi

echo -e "${BLUE}Starting frontend server...${NC}"
npm run dev > /tmp/splat_frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3

# Get the actual port
FRONTEND_URL=$(grep -o 'http://localhost:[0-9]*' /tmp/splat_frontend.log | head -1)
if [ -z "$FRONTEND_URL" ]; then
    FRONTEND_URL="http://localhost:5173"
fi

if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Frontend running on ${FRONTEND_URL}${NC}"
else
    echo -e "${RED}✗ Frontend failed to start${NC}"
    echo "  Check /tmp/splat_frontend.log for details"
    cleanup
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║           Splat Window is Ready!           ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Open in your browser: ${FRONTEND_URL}${NC}"
echo ""
if [ "$BACKEND_AVAILABLE" = true ]; then
    echo "Features available:"
    echo "  • View .splat and .ply files"
    echo "  • Convert images to 3D splats"
    echo "  • Head tracking parallax effect"
else
    echo "Features available:"
    echo "  • View .splat and .ply files"
    echo "  • Head tracking parallax effect"
    echo ""
    echo -e "${YELLOW}Note: Image conversion disabled (backend not running)${NC}"
fi
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Open browser
if command -v open &> /dev/null; then
    sleep 1
    open "$FRONTEND_URL"
fi

# Wait for processes
wait $FRONTEND_PID
