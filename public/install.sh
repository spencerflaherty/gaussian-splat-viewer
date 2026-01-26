#!/bin/bash
# Splat Window Backend Installer
# This script sets up the local backend for image-to-splat conversion

set -e

echo "=============================================="
echo "     Splat Window Backend Installer"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: This installer is designed for macOS.${NC}"
    echo "For other platforms, please install manually."
    exit 1
fi

# Find Python 3.10+
echo "Checking Python version..."
PYTHON_CMD=""

# Function to check if Python version is 3.10+
check_python_version() {
    local python_path="$1"
    if [ -x "$python_path" ]; then
        local version=$("$python_path" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)
        local major=$(echo "$version" | cut -d. -f1)
        local minor=$(echo "$version" | cut -d. -f2)
        if [ "$major" -eq 3 ] && [ "$minor" -ge 10 ]; then
            echo "$version"
            return 0
        fi
    fi
    return 1
}

# Search Homebrew Python installations (Apple Silicon and Intel paths)
for brew_base in /opt/homebrew/opt /usr/local/opt; do
    if [ -d "$brew_base" ]; then
        # Find all python@3.* directories, sort by version descending
        for python_dir in $(ls -d "$brew_base"/python@3.* 2>/dev/null | sort -t@ -k2 -rV); do
            version_num=$(basename "$python_dir" | sed 's/python@//')
            python_path="$python_dir/bin/python$version_num"
            if version=$(check_python_version "$python_path"); then
                PYTHON_CMD="$python_path"
                PYTHON_VERSION="$version"
                break 2
            fi
        done
    fi
done

# Fall back to system python3 if new enough
if [ -z "$PYTHON_CMD" ] && command -v python3 &> /dev/null; then
    if version=$(check_python_version "$(which python3)"); then
        PYTHON_CMD="python3"
        PYTHON_VERSION="$version"
    fi
fi

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}Error: Python 3.10 or higher is required.${NC}"
    echo ""
    echo "Install Python via Homebrew:"
    echo "  brew install python@3.13"
    exit 1
fi

echo -e "${GREEN}Found Python $PYTHON_VERSION at $PYTHON_CMD${NC}"

# Set up installation directory
INSTALL_DIR="$HOME/.splat-window"
echo ""
echo "Installing to: $INSTALL_DIR"

# Create directory
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Clone or update repository
if [ -d "$INSTALL_DIR/repo" ]; then
    echo ""
    echo "Updating existing installation..."
    cd "$INSTALL_DIR/repo"
    git pull
else
    echo ""
    echo "Cloning Splat Window repository..."
    git clone --depth 1 https://github.com/spencerflaherty/gaussian-splat-viewer.git "$INSTALL_DIR/repo"
    cd "$INSTALL_DIR/repo"
fi

# Initialize submodules (ml-sharp)
echo ""
echo "Initializing submodules..."
git submodule update --init --recursive

# Create virtual environment
echo ""
echo "Creating Python virtual environment..."
$PYTHON_CMD -m venv .venv
source .venv/bin/activate

# Install dependencies
echo ""
echo "Installing Python dependencies..."
pip install --upgrade pip
pip install fastapi uvicorn python-multipart numpy

# Install ml-sharp requirements
if [ -f "ml-sharp/requirements_mac.txt" ]; then
    pip install -r ml-sharp/requirements_mac.txt
fi

# Install ml-sharp in editable mode
echo ""
echo "Installing SHARP..."
pip install -e ml-sharp/

# Install Node.js dependencies for frontend
echo ""
echo "Installing frontend dependencies..."
if command -v npm &> /dev/null; then
    npm install
else
    echo -e "${YELLOW}npm not found. Install Node.js to run the frontend locally.${NC}"
    echo "  brew install node"
fi

# Create convenience scripts
mkdir -p "$HOME/.local/bin"

# Backend only script
echo ""
echo "Creating splat-backend command..."
cat > "$HOME/.local/bin/splat-backend" << 'SCRIPT'
#!/bin/bash
cd "$HOME/.splat-window/repo"
source .venv/bin/activate
python server/main.py
SCRIPT
chmod +x "$HOME/.local/bin/splat-backend"

# Full app script (frontend + backend)
echo "Creating splat-viewer command..."
cat > "$HOME/.local/bin/splat-viewer" << 'SCRIPT'
#!/bin/bash
cd "$HOME/.splat-window/repo"
source .venv/bin/activate

echo "Starting Splat Viewer..."
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start backend in background
python server/main.py &
BACKEND_PID=$!

# Start frontend
npm run dev &
FRONTEND_PID=$!

# Wait for either to exit
wait $BACKEND_PID $FRONTEND_PID

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
SCRIPT
chmod +x "$HOME/.local/bin/splat-viewer"

# Add to PATH if needed
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo ""
    echo -e "${YELLOW}Adding ~/.local/bin to your PATH...${NC}"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
    export PATH="$HOME/.local/bin:$PATH"
fi

echo ""
echo "=============================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "=============================================="
echo ""
echo "To start the full app (frontend + backend):"
echo -e "  ${GREEN}splat-viewer${NC}"
echo ""
echo "Or backend only:"
echo "  splat-backend"
echo ""
echo "The app will open at http://localhost:5173"
echo ""
echo -e "${YELLOW}Note: The first image conversion will download the"
echo -e "SHARP model (~2.6GB). This only happens once.${NC}"
echo ""

# Ask if user wants to start now
read -p "Start the app now? [Y/n] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo ""
    echo "Starting Splat Viewer..."
    splat-viewer
fi
