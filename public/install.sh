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

# Check Python version
echo "Checking Python version..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

    if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]); then
        echo -e "${RED}Error: Python 3.10 or higher is required (found $PYTHON_VERSION).${NC}"
        echo ""
        echo "Install Python 3.13 via Homebrew:"
        echo "  brew install python@3.13"
        exit 1
    fi
    echo -e "${GREEN}Found Python $PYTHON_VERSION${NC}"
else
    echo -e "${RED}Error: Python 3 is not installed.${NC}"
    echo ""
    echo "Install Python via Homebrew:"
    echo "  brew install python@3.13"
    exit 1
fi

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
    git clone --depth 1 https://github.com/yourusername/gaussian-splat-viewer.git "$INSTALL_DIR/repo"
    cd "$INSTALL_DIR/repo"
fi

# Initialize submodules (ml-sharp)
echo ""
echo "Initializing submodules..."
git submodule update --init --recursive

# Create virtual environment
echo ""
echo "Creating Python virtual environment..."
python3 -m venv .venv
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

# Create convenience script
echo ""
echo "Creating splat-backend command..."
cat > "$HOME/.local/bin/splat-backend" << 'SCRIPT'
#!/bin/bash
cd "$HOME/.splat-window/repo"
source .venv/bin/activate
python server/main.py
SCRIPT

mkdir -p "$HOME/.local/bin"
chmod +x "$HOME/.local/bin/splat-backend"

# Add to PATH if needed
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo ""
    echo -e "${YELLOW}Note: Add ~/.local/bin to your PATH:${NC}"
    echo '  echo '\''export PATH="$HOME/.local/bin:$PATH"'\'' >> ~/.zshrc'
    echo '  source ~/.zshrc'
fi

echo ""
echo "=============================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "=============================================="
echo ""
echo "To start the backend server:"
echo "  splat-backend"
echo ""
echo "Or manually:"
echo "  cd $INSTALL_DIR/repo"
echo "  source .venv/bin/activate"
echo "  python server/main.py"
echo ""
echo "The backend will run on http://localhost:8000"
echo ""
echo -e "${YELLOW}Note: The first image conversion will download the"
echo -e "SHARP model (~2.6GB). This only happens once.${NC}"
echo ""
