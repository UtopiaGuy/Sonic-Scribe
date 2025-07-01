# Sonic Scribe

Sonic Scribe is a web-based application for transcribing and analyzing audio files. It uses OpenAI's Whisper API for transcription, GPT-4o for analysis, and can send the results to a Notion database.

## Architecture

The application is composed of three main parts:

*   **Frontend:** A React application that provides the user interface for uploading audio files and viewing transcriptions.
*   **Backend:** A Node.js server that handles file uploads, interacts with the OpenAI API, and communicates with the Notion API.
*   **C++ Application:** A command-line tool for audio transcription and analysis.

## Getting Started

The easiest way to run the application is with Docker Compose.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/UtopiaGuy/Sonic-Scribe.git
    cd Sonic-Scribe
    ```

2.  **Set up your environment variables:**
    Create a `.env` file in the root of the project and add your API keys. You can use the `.env.example` file as a template.
    ```
    OPENAI_API_KEY=your-openai-api-key
    NOTION_API_KEY=your-notion-api-key
    NOTION_DATABASE_ID=your-notion-database-id
    ```

3.  **Run the application:**
    ```bash
    docker-compose up --build
    ```

The frontend will be available at `http://localhost:3000` and the backend at `http://localhost:3001`.

## Configuration

### API Keys

The application requires API keys for OpenAI and Notion. These are stored in a `.env` file in the root of the project. See the "Getting Started" section for more details.

### C++ Configuration

The C++ application uses a `config.h` file for configuration. An example file, `config.h.example`, is provided. To use the C++ application, you will need to create your own `config.h` file.

## Notion Integration

The application can send transcription and analysis data to a Notion database. The `notion_adapter.js` script is used to format the data to be compatible with your Notion database.

## C++ Application

The `C++_VR_App.cpp` file contains a command-line application for audio transcription and analysis. To compile and run this application, see the instructions in the old README.md file (which can be found in the git history).