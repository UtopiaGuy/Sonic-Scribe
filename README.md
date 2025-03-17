# VR Application for Audio Transcription and Analysis

This application transcribes audio files using OpenAI's Whisper API, analyzes the transcription using GPT-4o to categorize the content, and sends the categorized data to a Notion database.

## Compiling the Application

To compile the application, use the following command:

```bash
g++ -std=c++17 -o vr_app C++_VR_App.cpp config.cpp -lcurl
```

This command compiles both the main application file and the configuration file, and links against the curl library.

To run the application:

```bash
./vr_app
```

## API Keys Configuration

For security purposes, all API keys are stored in separate configuration files that are not committed to version control:

- For C++: `config.cpp` contains the API keys used by the main application
- For JavaScript: `.env` file contains environment variables for the Node.js scripts

### Setting Up API Keys

1. **For C++ Application**:
   - Create a copy of `config.cpp.example` (if it exists) or create a new file named `config.cpp`
   - Add your API keys to the file following this format:
   ```cpp
   #include "config.h"
   
   const std::string OPENAI_API_KEY = "your-openai-api-key";
   const std::string NOTION_API_KEY = "your-notion-api-key";
   const std::string NOTION_DATABASE_ID = "your-notion-database-id";
   ```

2. **For JavaScript Scripts**:
   - Create a copy of `.env.example` (if it exists) or create a new file named `.env`
   - Add your API keys to the file following this format:
   ```
   OPENAI_API_KEY=your-openai-api-key
   NOTION_API_KEY=your-notion-api-key
   NOTION_DATABASE_ID=your-notion-database-id
   ```

3. **Install Required Node.js Packages**:
   - For the JavaScript scripts to use environment variables, install the dotenv package:
   ```bash
   npm install dotenv
   ```

## Notion JSON Adapter

This tool helps format JSON data to be compatible with your Notion database by filtering out properties that don't exist in your Notion database.

## Problem Solved

When sending data to Notion via the API, you might encounter errors like:

```
Notion API error: AI_Cost is not a property that exists. AI_Title is not a property that exists. Action_Items is not a property that exists...
```

This happens when your JSON contains properties that don't exist in your Notion database. This tool filters out those properties and keeps only the ones that Notion accepts.

## Usage

```bash
# Basic usage - read from a file, output to console
./notion_adapter.js data.json

# Save output to a file
./notion_adapter.js data.json -o notion_ready.json

# Read from stdin (pipe)
cat data.json | ./notion_adapter.js

# Show help
./notion_adapter.js --help
```

## Property Mapping

The tool maps properties as follows:

| Original Property | Notion Property |
|-------------------|----------------|
| AI_Title          | Title          |
| Type              | Type           |
| Icon              | Icon           |
| Summary           | Summary        |
| References        | References     |
| Stories           | Stories        |
| Arguments         | Arguments      |
| Sentiment         | Sentiment      |
| Duration          | Duration       |

Properties that don't exist in your Notion database (like AI_Cost, Action_Items, Duration_Seconds, Follow-up_Questions, Main_Points) are removed.

## Customization

If your Notion database has different properties, you can modify the `notionCompatibleData` object in the script to match your database structure.
