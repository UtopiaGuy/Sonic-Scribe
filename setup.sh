#!/bin/bash
# Sonic Scribe v2 - Automated Setup Script
# Works on macOS and Linux

set -e

echo "========================================================="
echo "🎙️  Welcome to the Sonic Scribe Initializer Script!"
echo "========================================================="
echo ""

# 1. Dependency Checks
echo "[1] Checking system dependencies..."

check_cmd() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is not installed."
        return 1
    fi
    echo "✅ $1 is installed."
    return 0
}

DEPS_MISSING=0
for cmd in git node npm cmake clang ffmpeg curl; do
    check_cmd "$cmd" || DEPS_MISSING=1
done

if [ "$DEPS_MISSING" -eq 1 ]; then
    echo ""
    echo "⚠️  Missing dependencies found! If you are on macOS, run:"
    echo "   brew install node cmake llvm ffmpeg"
    echo "If you exclusively intend to use Docker, you only need docker installed."
    echo ""
    read -p "Do you want to continue anyway? (y/n): " cont
    if [[ "$cont" != "y" && "$cont" != "Y" ]]; then
        exit 1
    fi
fi

# 2. Whisper.cpp Compilation
echo ""
echo "[2] Setting up Whisper.cpp engine..."
WHISPER_DIR="backend/whisper"
if [ ! -d "$WHISPER_DIR" ]; then
    echo "Cloning whisper.cpp..."
    git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "$WHISPER_DIR"
fi

if [ ! -f "$WHISPER_DIR/build/bin/whisper-cli" ] && [ ! -f "$WHISPER_DIR/build/bin/whisper" ]; then
    echo "Compiling whisper.cpp natively (this may take a minute)..."
    cd "$WHISPER_DIR" || exit
    cmake -B build -DCMAKE_BUILD_TYPE=Release
    cmake --build build --config Release -j"$(sysctl -n hw.ncpu 2>/dev/null || nproc)"
    cd ../..
else
    echo "✅ Whisper.cpp is already compiled."
fi

# Download default base.en model
echo "Checking for local whisper models..."
mkdir -p "$WHISPER_DIR/models"
if [ ! -f "$WHISPER_DIR/models/ggml-base.en.bin" ]; then
    echo "Downloading tiny and base English whisper models..."
    cd "$WHISPER_DIR/models" || exit
    curl -LO https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
    curl -LO https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin
    cd ../../..
else
    echo "✅ Whisper models found."
fi

# 3. Environment Variables
echo ""
echo "[3] Environment Configuration (.env)"
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || touch .env
fi

ask_env() {
    local KEY=$1
    local PROMPT=$2
    local DEFAULT=$3
    
    # Check if key exists and isn't empty
    if grep -q "^${KEY}=" .env; then
        local CURRENT=$(grep "^${KEY}=" .env | cut -d '=' -f2-)
        if [ -n "$CURRENT" ] && [ "$CURRENT" != "$DEFAULT" ]; then
             echo "✅ $KEY is already configured."
             return
        fi
    fi

    # Erase old empty/default key if it existed
    sed -i.bak "/^${KEY}=/d" .env 2>/dev/null || true
    rm -f .env.bak

    echo "> $PROMPT"
    if [ -n "$DEFAULT" ]; then
        read -p "[$KEY] (default: $DEFAULT): " USER_IN
        if [ -z "$USER_IN" ]; then
            USER_IN=$DEFAULT
        fi
    else
        read -p "[$KEY]: " USER_IN
    fi
    echo "${KEY}=${USER_IN}" >> .env
}

ask_env "OBSIDIAN_VAULT_PATH" "Absolute path to your Obsidian Vault (e.g., /Users/name/Documents/Obsidian)" ""
ask_env "GEMINI_API_KEY" "Google Gemini Cloud API Key (required for cloud fallback)" ""
ask_env "NOTION_API_KEY" "Notion Integration Secret Key" ""
ask_env "UNSLOTH_URL" "Unsloth Server URL (if you have local Gemma 4)" "http://127.0.0.1:8888"

# Backend & Frontend Deps
echo ""
echo "[4] Installing Node dependencies..."
echo "Installing backend dependencies..."
(cd backend && npm install)
echo "Installing frontend dependencies..."
(cd frontend && npm install)

echo ""
echo "========================================================="
echo "✅ Configuration and Compilation complete!"
echo "========================================================="
echo "You can now run Sonic Scribe in two ways:"
echo "1. Docker (Recommended): docker compose up --build"
echo "2. Native: Open two terminal tabs:"
echo "   - Tab 1: cd backend && NODE_ENV=development node server.js"
echo "   - Tab 2: cd frontend && npm run dev"
echo "========================================================="
