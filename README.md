# Sonic Scribe v2

Sonic Scribe v2 is a modernized, web-based application for transcribing and analyzing audio files. It is powered completely by local, open-source AI infrastructure or via Cloud fallbacks. 

It handles ultra-fast local transcriptions utilizing Apple Silicon or GPU compute via `whisper.cpp`, processes audio sentiment and strategic analysis via locally hosted LLMs (`Gemma 4` through `Unsloth`), and outputs its intelligence into custom Notion databases and Obsidian Markdown Vaults.

![Sonic Scribe UI](frontend/public/favicon.ico) *A modern, glassmorphic React interface designed for efficiency.*

## Architecture

The V2 architecture abandoned ancient C++ terminal scripts and deprecated legacy OpenAI integrations. Sonic Scribe is now deployed as a localized full-stack framework:

*   **Frontend Ecosystem:** A Vite + React application providing a stunning glassmorphic user interface. Displays real-time WebSockets to process transcription feeds, formatting outputs securely.
*   **Node.js Backend Engine:** Express-powered routing that drives backend jobs natively via `child_process`. Communicates seamlessly with native local architectures.
*   **AI Pipelines:**
    *   **Transcription:** Handled by a bare-metal compilation of `whisper.cpp` embedded within the `/backend` logic tree.
    *   **Analysis:** Processed securely via a localized pipeline hitting an Unsloth Inference server running `Gemma 4`, effectively maintaining zero-knowledge privacy. Features auto-failover directly to `Gemini 3.1 Pro` if the local Gemma server scales down.
*   **Integrations:** Automatic cross-routing into a designated local Obsidian Markdown Vault, accompanied by Notion Database API syncing explicitly formatted for Rich-Text data structures.

## Installation

### Automated Setup
To launch everything efficiently without friction, an interactive initializer script is included. 
This script validates your core operating dependencies (Git, Node, CMake, Clang), grabs the Whisper engine from the original `ggerganov/whisper.cpp` repo, aggressively compiles it utilizing all cores, provisions your Whisper Models, sets up your environment variables, and executes package downloads.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/UtopiaGuy/Sonic-Scribe.git
    cd Sonic-Scribe
    ```
2.  **Execute the Interactive Setup:**
    ```bash
    ./setup.sh
    ```
    *The prompt will ask for you to outline your Obsidian Vault absolute path, Notion API keys, and Unsloth connection bindings.*

---

## Deployment Modes

### 1. Docker Deployment (Recommended)
You can run the entire application completely isolated without manual server supervision using docker-compose.
The backend handles mapping virtual endpoints like `host.docker.internal` appropriately out into the host OS, letting it tap into the local Unsloth AI server perfectly!
```bash
docker compose up --build
```
- Access the UX at `http://localhost:5173`

### 2. Native Bare-Metal Deployment
You can run the entire operation from terminal manually to test iterations natively:

**Terminal 1 (Backend Controller)**
```bash
cd backend
NODE_ENV=development node server.js
```

**Terminal 2 (React Application)**
```bash
cd frontend
npm run dev
```

## System Requirements
- Node.js 20+
- FFMPEG
- Clang / CMake (For native deployment compilation)
- Unsloth AI (Optional, handles privacy localized intelligence processing)
- Docker (Mandatory only if deploying containerized architecture)