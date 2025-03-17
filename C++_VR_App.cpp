/**
 * C++ VR Application for Audio Transcription and Analysis
 * 
 * This application transcribes audio files using OpenAI's Whisper API,
 * analyzes the transcription using GPT-4o to categorize the content,
 * and sends the categorized data to a Notion database.
 * 
 * The application handles:
 * 1. Audio file selection
 * 2. Transcription via OpenAI Whisper API
 * 3. Content analysis via OpenAI GPT-4o
 * 4. Notion database integration with proper property types
 */

// Include necessary libraries
#include <iostream>     // Standard I/O operations for console output
#include <fstream>      // File stream handling for reading audio files
#include <string>       // String manipulation for text processing
#include <curl/curl.h>  // CURL operations to handle HTTP requests to APIs
#include <cstdlib>      // Standard library functions, e.g., exit()
#include <unistd.h>     // For access() function to check file existence
#include <sstream>      // String stream operations for string manipulation
#include <map>          // Map container for key-value pairs
#include <regex>        // Regular expressions for pattern matching
#include <vector>       // Vector container for dynamic arrays
#include <iomanip>      // Input/output manipulators for formatting
#include <chrono>       // For timestamp generation

// Include the nlohmann/json library for JSON parsing and manipulation
#include "nlohmann/json.hpp"
// Include the configuration file for API keys
#include "config.h"
using json = nlohmann::json;
using namespace std;

/**
 * Global variables to store the property names from the Notion database
 * 
 * These variables are used to map the fields from the GPT response
 * to the property names in the Notion database, which may have different names.
 */
string g_titlePropertyName = "";
map<string, string> g_propertyNameMap;

/**
 * Function to prompt the user to select an audio file
 * 
 * This function displays a prompt asking the user to enter the path to an audio file.
 * It validates that the file exists before returning the path.
 * The user can type 'exit' to quit the application.
 * 
 * @return The path to the selected audio file
 */
string getFileFromDialog() {
    string filePath;
    bool validFile = false;
    while (!validFile) {
        cout << "Please enter the full patcd /Users/root1/C++/VRapp/C++_VR_App.cpph to your audio file (or type 'exit' to quit): ";
        getline(cin, filePath);
        if (filePath == "exit") {
            exit(EXIT_SUCCESS);
        }
        if (access(filePath.c_str(), F_OK) != 0) {
            cerr << "File does not exist. Please check the path and try again." << endl;
        } else {
            validFile = true;
        }
    }
    return filePath;
}

/**
 * Callback function for CURL to write received data
 * 
 * This function is called by CURL when data is received from an HTTP request.
 * It appends the received data to the output string.
 * 
 * @param contents Pointer to the received data
 * @param size Size of each data element
 * @param nmemb Number of data elements
 * @param output Pointer to the string where data will be stored
 * @return The total size of the data received
 */
size_t WriteCallback(void *contents, size_t size, size_t nmemb, string *output) {
    size_t totalSize = size * nmemb;
    output->append(reinterpret_cast<char*>(contents), totalSize);
    return totalSize;
}

/**
 * Function to transcribe audio using the OpenAI Whisper API
 * 
 * This function sends an audio file to the OpenAI Whisper API for transcription.
 * It handles:
 * 1. Reading the audio file
 * 2. Setting up the API request with proper headers and parameters
 * 3. Sending the request to the API
 * 4. Receiving and returning the response
 * 
 * @param filePath Path to the audio file to transcribe
 * @param apiKey OpenAI API key for authentication
 * @return The API response containing the transcription
 */
string transcribeAudio(const string &filePath, const string &apiKey) {
    CURL *curl;
    CURLcode res;
    string responseString;
    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();
    if (curl) {
        ifstream file(filePath, ios::binary);
        if (!file.is_open()) {
            cerr << "Failed to open file: " << filePath << endl;
            exit(EXIT_FAILURE);
        }
        ostringstream oss;
        oss << file.rdbuf();
        string fileData = oss.str();

        // Set up the header with the API key
        struct curl_slist *headers = nullptr;
        headers = curl_slist_append(headers, ("Authorization: Bearer " + apiKey).c_str());

        // Set the API endpoint for transcription
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.openai.com/v1/audio/transcriptions");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_POST, 1L);

        // Set up MIME form for file upload and model parameter
        curl_mime *form = curl_mime_init(curl);

        // Add the file field to the form
        curl_mimepart *field = curl_mime_addpart(form);
        curl_mime_name(field, "file");
        curl_mime_filename(field, filePath.c_str());
        curl_mime_data(field, fileData.c_str(), fileData.size());

        // Add the model parameter
        field = curl_mime_addpart(form);
        curl_mime_name(field, "model");
        curl_mime_data(field, "whisper-1", CURL_ZERO_TERMINATED);

        // Attach the form and set callback for response
        curl_easy_setopt(curl, CURLOPT_MIMEPOST, form);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseString);

        // Perform the request
        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            cerr << "CURL error (transcription): " << curl_easy_strerror(res) << endl;
        }

        // Clean up
        curl_mime_free(form);
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
    }
    curl_global_cleanup();
    return responseString;
}

/**
 * Function to escape JSON special characters in a string
 * 
 * This function escapes special characters in a string to make it safe for inclusion in JSON.
 * It handles characters like quotes, backslashes, and control characters.
 * 
 * @param input The string to escape
 * @return The escaped string
 */
string escapeJsonString(const string &input) {
    ostringstream escaped;
    for (char c : input) {
        switch (c) {
            case '"': escaped << "\\\""; break;
            case '\\': escaped << "\\\\"; break;
            case '\b': escaped << "\\b"; break;
            case '\f': escaped << "\\f"; break;
            case '\n': escaped << "\\n"; break;
            case '\r': escaped << "\\r"; break;
            case '\t': escaped << "\\t"; break;
            default:
                if ('\x00' <= c && c <= '\x1f') {
                    escaped << "\\u" << hex << setw(4) << setfill('0') << (int)c;
                } else {
                    escaped << c;
                }
        }
    }
    return escaped.str();
}

/**
 * Function to communicate with the OpenAI Chat Completions API for categorizing transcription
 * 
 * This function sends the transcription text to the OpenAI GPT-4o model for analysis.
 * It requests categorization into various sections based on the Notion Voice Notes structure.
 * 
 * @param transcription The transcription text to analyze
 * @param apiKey OpenAI API key for authentication
 * @return The API response containing the categorized content
 */
string categorizeWithOpenAI(const string& transcription, const string& apiKey) {
    CURL* curl;
    CURLcode res;
    string responseString;
    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();
    if (curl) {
        // Escape transcription text for JSON safety
        string escapedTranscription = escapeJsonString(transcription);

        // Define the summary options from the Notion Voice Notes configuration
        vector<string> summaryOptions = {
            "Summary",
            "Main Points",
            "Action Items",
            "References",
            "Follow-up Questions",
            "Stories",
            "Arguments",
            "Sentiment"
        };

        // Build the summary options string
        string summaryOptionsStr = "";
        for (size_t i = 0; i < summaryOptions.size(); ++i) {
            summaryOptionsStr += summaryOptions[i];
            if (i < summaryOptions.size() - 1) {
                summaryOptionsStr += ", ";
            }
        }

        // Build the JSON payload using a raw string literal for clarity
        string data = R"({
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": "You are an assistant that analyzes voice recordings and outputs categorized sections in JSON format for Notion database integration."
                },
                {
                    "role": "user",
                    "content": "Analyze the following transcription and categorize it into these sections: )" + summaryOptionsStr + R"(. Generate an AI title for the note. For Type, suggest a category like 'AI Transcription', 'Meeting Notes', etc. For Duration, provide a time format like '00:07:26'. Calculate the Duration (Seconds) as a number. Include an AI Cost estimate (a small dollar amount). Also include an Icon field with the value '🤖'. Format all lists as arrays. Provide the output in clean JSON format with no markdown formatting.\n\nTranscription: )" + escapedTranscription + R"("
                }
            ]
        })";

        // Set up the headers
        struct curl_slist* headers = nullptr;
        headers = curl_slist_append(headers, ("Authorization: Bearer " + apiKey).c_str());
        headers = curl_slist_append(headers, "Content-Type: application/json");

        // Set the API endpoint for chat completions
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.openai.com/v1/chat/completions");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_POST, 1L);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, data.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseString);

        // Perform the request
        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            cerr << "CURL error (chat completions): " << curl_easy_strerror(res) << endl;
        }

        // Clean up
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
    }
    curl_global_cleanup();
    return responseString;
}

/**
 * Function to ensure the Notion database has the required properties
 * 
 * This function:
 * 1. Retrieves the current structure of the Notion database
 * 2. Identifies the title property
 * 3. Checks for missing properties or properties with incorrect types
 * 4. Adds any missing properties with the correct types
 * 
 * Required properties include:
 * - Title property (for Summary)
 * - Type (select)
 * - Duration (rich_text)
 * - At Cost (number)
 * - Duration (Seconds) (number)
 * - Date (date)
 * - Main Points, Action Items, etc. (rich_text)
 * 
 * @param notionDatabaseId ID of the Notion database
 * @param notionApiKey Notion API key for authentication
 * @return true if the database has all required properties, false otherwise
 */
bool ensureNotionDatabaseProperties(const string &notionDatabaseId,const string &notionApiKey) {
    // Get the current database structure
    CURL *curl;
    CURLcode res;
    string responseString;
    
    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();
    if (!curl) {
        cerr << "Failed to initialize CURL for database retrieval" << endl;
        return false;
    }
    
    // Set up the required headers
    struct curl_slist *headers = nullptr;
    headers = curl_slist_append(headers, ("Authorization: Bearer " + notionApiKey).c_str());
    headers = curl_slist_append(headers, "Content-Type: application/json");
    headers = curl_slist_append(headers, "Notion-Version: 2022-06-28");
    
    // Set the Notion API endpoint for retrieving the database
    string url = "https://api.notion.com/v1/databases/" + notionDatabaseId;
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseString);
    
    // Perform the request
    res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        cerr << "CURL error (database retrieval): " << curl_easy_strerror(res) << endl;
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        curl_global_cleanup();
        return false;
    }
    
    // Parse the response to check existing properties
    try {
        auto dbJson = json::parse(responseString);
        
        // Check if there was an error
        if (dbJson.contains("object") && dbJson["object"] == "error") {
            cerr << "Notion API error (database retrieval): " << dbJson["message"].get<string>() << endl;
            cout << "Notion API response:" << endl << responseString << endl;
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
            curl_global_cleanup();
            return false;
        }
        
        // Get existing properties
        map<string, string> existingProps;
        if (dbJson.contains("properties") && dbJson["properties"].is_object()) {
            for (auto& [key, value] : dbJson["properties"].items()) {
                if (value.contains("type")) {
                    existingProps[key] = value["type"];
                }
            }
        }
        
        // Find the existing title property
        string titlePropName = "";
        for (auto& [key, value] : existingProps) {
            if (value == "title") {
                titlePropName = key;
                break;
            }
        }
        
        if (titlePropName.empty()) {
            cerr << "No title property found in the database" << endl;
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
            curl_global_cleanup();
            return false;
        }
        
        cout << "Found title property: " << titlePropName << endl;
        
        // Store the title property name for later use
        g_titlePropertyName = titlePropName;
        
        // Define required properties with their types based on Notion Voice Notes configuration
        map<string, string> requiredProps = {
            {"Main Points", "rich_text"},
            {"Action Items", "rich_text"},
            {"Follow-up Questions", "rich_text"},
            {"Stories", "rich_text"},
            {"References", "rich_text"},
            {"Arguments", "rich_text"},
            {"Sentiment", "rich_text"},
            {"Type", "select"},
            {"Duration", "rich_text"},
            {"AI Cost", "number"},
            {"Duration (Seconds)", "number"},
            {"Date", "date"},
            {"Icon", "rich_text"}
        };
        
        // Check which properties are missing or have the wrong type
        vector<pair<string, string>> missingProps;
        for (const auto& [propName, propType] : requiredProps) {
            if (existingProps.find(propName) == existingProps.end()) {
                missingProps.push_back({propName, propType});
            } else if (existingProps[propName] != propType) {
                cerr << "Warning: Property '" << propName << "' exists but has type '" 
                     << existingProps[propName] << "' instead of '" << propType << "'" << endl;
            }
        }
        
        // If no properties are missing, return success
        if (missingProps.empty()) {
            cout << "All required properties exist in the database" << endl;
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
            curl_global_cleanup();
            return true;
        }
        
        // Build the update payload
        json updatePayload;
        json properties;
        
        for (const auto& [propName, propType] : missingProps) {
            if (propType == "rich_text") {
                properties[propName] = {{"type", "rich_text"}, {"rich_text", json::object()}};
            } else if (propType == "select") {
                properties[propName] = {{"type", "select"}, {"select", json::object()}};
            } else if (propType == "number") {
                properties[propName] = {{"type", "number"}, {"number", json::object()}};
            } else if (propType == "date") {
                properties[propName] = {{"type", "date"}, {"date", json::object()}};
            }
        }
        
        updatePayload["properties"] = properties;
        string updatePayloadStr = updatePayload.dump();
        
        // Reset CURL for the update request
        curl_easy_reset(curl);
        
        // Set up the PATCH request
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PATCH");
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, updatePayloadStr.c_str());
        
        // Clear the response string
        responseString.clear();
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseString);
        
        // Perform the update request
        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            cerr << "CURL error (database update): " << curl_easy_strerror(res) << endl;
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
            curl_global_cleanup();
            return false;
        }
        
        // Check the update response
        try {
            auto updateJson = json::parse(responseString);
            if (updateJson.contains("object") && updateJson["object"] == "error") {
                cerr << "Notion API error (database update): " << updateJson["message"].get<string>() << endl;
                cout << "Notion API response:" << endl << responseString << endl;
                curl_slist_free_all(headers);
                curl_easy_cleanup(curl);
                curl_global_cleanup();
                return false;
            }
            
            cout << "Database properties updated successfully" << endl;
        } catch (const exception& e) {
            cerr << "Error parsing database update response: " << e.what() << endl;
            cout << "Raw response:" << endl << responseString << endl;
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
            curl_global_cleanup();
            return false;
        }
        
    } catch (const exception& e) {
        cerr << "Error parsing database response: " << e.what() << endl;
        cout << "Raw response:" << endl << responseString << endl;
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        curl_global_cleanup();
        return false;
    }
    
    // Clean up
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    curl_global_cleanup();
    
    return true;
}

/**
 * Function to send a parsed JSON object into a Notion database
 * 
 * This function:
 * 1. Ensures the database has the required properties
 * 2. Builds a JSON payload according to Notion's API requirements
 * 3. Handles different property types (title, select, number, date, rich_text)
 * 4. Converts arrays to comma-separated strings without square brackets
 * 5. Sends the data to the Notion API
 * 
 * @param data The JSON data to send to Notion
 * @param notionDatabaseId ID of the Notion database
 * @param notionApiKey Notion API key for authentication
 * @return true if the data was successfully sent, false otherwise
 */
bool sendToNotion(const nlohmann::json &data,const string &notionDatabaseId,const string &notionApiKey) {
    // First, ensure the database has the required properties
    if (!ensureNotionDatabaseProperties(notionDatabaseId, notionApiKey)) {
        cerr << "Failed to ensure database properties" << endl;
        return false;
    }
    // Build the JSON payload according to Notion's API requirements.
    // The payload includes:
    //   - A "parent" key specifying the database_id.
    //   - A "properties" key that maps each key from your parsed JSON
    //     into a Notion property.
    nlohmann::json payload;
    payload["parent"] = {{"database_id", notionDatabaseId}};
    
    nlohmann::json properties;
    // Iterate over the key/value pairs in the input JSON.
    for (auto& [key, value] : data.items()) {
        // Handle each property based on its expected type in Notion
        if (key == "AI_Title" || key == "Title") {
            // Use the title property name from the database
            string content = value.is_string() ? value.get<string>() : value.dump();
            properties[g_titlePropertyName] = {
                {"title", nlohmann::json::array({
                    {{"text", {{"content", content}}}}
                })}
            };
        } else if (key == "Summary") {
            // Use the title property name from the database if AI_Title is not present
            if (!data.contains("AI_Title") && !data.contains("Title")) {
                string content = value.is_string() ? value.get<string>() : value.dump();
                properties[g_titlePropertyName] = {
                    {"title", nlohmann::json::array({
                        {{"text", {{"content", content}}}}
                    })}
                };
            }
        } else if (key == "Type") {
            // Type is a select property
            string content = value.is_string() ? value.get<string>() : value.dump();
            properties[key] = {
                {"select", {{"name", content}}}
            };
        } else if (key == "At Cost" || key == "AI Cost") {
            // AI Cost is a number property
            // If the value is null or not a number, set it to null
            string propName = "AI Cost"; // Use the Notion Voice Notes property name
            if (value.is_null()) {
                properties[propName] = {{"number", nullptr}};
            } else if (value.is_number()) {
                properties[propName] = {{"number", value}};
            } else {
                // Try to convert string to number
                try {
                    double numValue = stod(value.is_string() ? value.get<string>() : value.dump());
                    properties[propName] = {{"number", numValue}};
                } catch (...) {
                    properties[propName] = {{"number", nullptr}};
                }
            }
        } else if (key == "Duration (Seconds)") {
            // Duration (Seconds) is a number property
            if (value.is_number()) {
                properties[key] = {{"number", value}};
            } else {
                // Try to convert string to number
                try {
                    double numValue = stod(value.is_string() ? value.get<string>() : value.dump());
                    properties[key] = {{"number", numValue}};
                } catch (...) {
                    properties[key] = {{"number", 0}};
                }
            }
        } else if (key == "Date") {
            // Date is a date property
            if (value.is_null()) {
                properties[key] = {{"date", nullptr}};
            } else {
                string dateStr = value.is_string() ? value.get<string>() : value.dump();
                if (dateStr == "null" || dateStr.empty()) {
                    properties[key] = {{"date", nullptr}};
                } else {
                    properties[key] = {{"date", {{"start", dateStr}}}};
                }
            }
        } else {
            // All other properties are rich_text
            if (value.is_array()) {
                // Convert array to string without square brackets
                ostringstream contentStream;
                for (size_t i = 0; i < value.size(); ++i) {
                    string itemText = value[i].is_string() ? value[i].get<string>() : value[i].dump();
                    contentStream << itemText;
                    if (i < value.size() - 1) {
                        contentStream << ", ";
                    }
                }
                string content = contentStream.str();
                properties[key] = {
                    {"rich_text", nlohmann::json::array({
                        {{"text", {{"content", content}}}}
                    })}
                };
            } else {
                // Handle non-array values as before
                string content = value.is_string() ? value.get<string>() : value.dump();
                properties[key] = {
                    {"rich_text", nlohmann::json::array({
                        {{"text", {{"content", content}}}}
                    })}
                };
            }
        }
    }
    payload["properties"] = properties;
    
    // Convert the payload JSON to a string
    string payloadStr = payload.dump();
    
    // Set up CURL for the HTTP POST request to Notion's API.
    CURL *curl;
    CURLcode res;
    string responseString;
    
    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();
    if (curl) {
        // Set up the required headers.
        struct curl_slist *headers = nullptr;
        headers = curl_slist_append(headers, ("Authorization: Bearer " + notionApiKey).c_str());
        headers = curl_slist_append(headers, "Content-Type: application/json");
        headers = curl_slist_append(headers, "Notion-Version: 2022-06-28"); // Adjust if needed

        // Set the Notion API endpoint for creating a page
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.notion.com/v1/pages");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_POST, 1L);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, payloadStr.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseString);
        
        // Perform the request
        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            cerr << "CURL error (Notion API): " << curl_easy_strerror(res) << endl;
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
            curl_global_cleanup();
            return false;
        }
        
        // Check the response for errors
        try {
            auto responseJson = json::parse(responseString);
            if (responseJson.contains("object") && responseJson["object"] == "error") {
                cerr << "Notion API error: " << responseJson["message"].get<string>() << endl;
                cout << "Notion API response:" << endl << responseString << endl;
                curl_slist_free_all(headers);
                curl_easy_cleanup(curl);
                curl_global_cleanup();
                return false;
            }
        } catch (const exception& e) {
            // If we can't parse the response, just print it
            cout << "Notion API response:" << endl << responseString << endl;
        }
        
        // Clean up
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
    }
    curl_global_cleanup();
    
    return true;
}

/**
 * Main function - Entry point of the application
 * 
 * This function:
 * 1. Prompts the user to select an audio file
 * 2. Transcribes the audio using OpenAI's Whisper API
 * 3. Analyzes the transcription using GPT-4o
 * 4. Sends the categorized data to a Notion database
 * 
 * @return 0 on successful execution
 */// Function to convert JSON data to LaTeX format
string convertToLatex(const nlohmann::json &data) {
    ostringstream latex;
    
    // Start the LaTeX document
    latex << "\\documentclass{article}\n";
    latex << "\\usepackage{geometry}\n";
    latex << "\\usepackage{enumitem}\n";
    latex << "\\usepackage{hyperref}\n";
    latex << "\\usepackage{xcolor}\n";
    latex << "\\usepackage{titlesec}\n";
    latex << "\\usepackage{fancyhdr}\n";
    latex << "\\usepackage{booktabs}\n";
    
    // Set up the document
    latex << "\\geometry{margin=1in}\n";
    latex << "\\titleformat{\\section}{\\normalfont\\Large\\bfseries}{\\thesection}{1em}{}\n";
    latex << "\\pagestyle{fancy}\n";
    latex << "\\fancyhf{}\n";
    latex << "\\renewcommand{\\headrulewidth}{0pt}\n";
    latex << "\\fancyfoot[C]{\\thepage}\n";
    
    // Begin the document
    latex << "\\begin{document}\n\n";
    
    // Add the title
    if (data.contains("Summary")) {
        string summary = data["Summary"].is_string() ? data["Summary"].get<string>() : data["Summary"].dump();
        latex << "\\title{" << summary << "}\n";
        latex << "\\author{Generated by AI Analysis}\n";
        latex << "\\date{\\today}\n";
        latex << "\\maketitle\n\n";
    }
    
    // Add metadata section
    latex << "\\section*{Metadata}\n";
    latex << "\\begin{tabular}{ll}\n";
    latex << "\\toprule\n";
    
    // Add Type
    if (data.contains("Type")) {
        string type = data["Type"].is_string() ? data["Type"].get<string>() : data["Type"].dump();
        latex << "Type & " << type << " \\\\\n";
    }
    
    // Add Duration
    if (data.contains("Duration")) {
        string duration = data["Duration"].is_string() ? data["Duration"].get<string>() : data["Duration"].dump();
        latex << "Duration & " << duration << " \\\\\n";
    }
    
    // Add AI Cost
    if (data.contains("AI Cost")) {
        string cost = data["AI Cost"].is_string() ? data["AI Cost"].get<string>() : data["AI Cost"].dump();
        latex << "AI Cost & " << cost << " \\\\\n";
    } else if (data.contains("At Cost")) {
        string cost = data["At Cost"].is_string() ? data["At Cost"].get<string>() : data["At Cost"].dump();
        latex << "AI Cost & " << cost << " \\\\\n";
    }
    
    // Add Date
    if (data.contains("Date")) {
        string date = data["Date"].is_string() ? data["Date"].get<string>() : data["Date"].dump();
        latex << "Date & " << date << " \\\\\n";
    }
    
    // Add Icon
    if (data.contains("Icon")) {
        string icon = data["Icon"].is_string() ? data["Icon"].get<string>() : data["Icon"].dump();
        latex << "Icon & " << icon << " \\\\\n";
    }
    
    latex << "\\bottomrule\n";
    latex << "\\end{tabular}\n\n";
    
    // Add Main Points section
    if (data.contains("Main Points")) {
        latex << "\\section{Main Points}\n";
        latex << "\\begin{itemize}[leftmargin=*]\n";
        
        if (data["Main Points"].is_array()) {
            for (const auto& point : data["Main Points"]) {
                string pointText = point.is_string() ? point.get<string>() : point.dump();
                latex << "  \\item " << pointText << "\n";
            }
        } else {
            string mainPoints = data["Main Points"].is_string() ? data["Main Points"].get<string>() : data["Main Points"].dump();
            latex << "  \\item " << mainPoints << "\n";
        }
        
        latex << "\\end{itemize}\n\n";
    }
    
    // Add Action Items section
    if (data.contains("Action Items")) {
        latex << "\\section{Action Items}\n";
        latex << "\\begin{itemize}[leftmargin=*]\n";
        
        if (data["Action Items"].is_array()) {
            for (const auto& item : data["Action Items"]) {
                string itemText = item.is_string() ? item.get<string>() : item.dump();
                latex << "  \\item " << itemText << "\n";
            }
        } else {
            string actionItems = data["Action Items"].is_string() ? data["Action Items"].get<string>() : data["Action Items"].dump();
            latex << "  \\item " << actionItems << "\n";
        }
        
        latex << "\\end{itemize}\n\n";
    }
    
    // Add Follow-up Questions section
    if (data.contains("Follow-up Questions")) {
        latex << "\\section{Follow-up Questions}\n";
        latex << "\\begin{itemize}[leftmargin=*]\n";
        
        if (data["Follow-up Questions"].is_array()) {
            for (const auto& question : data["Follow-up Questions"]) {
                string questionText = question.is_string() ? question.get<string>() : question.dump();
                latex << "  \\item " << questionText << "\n";
            }
        } else {
            string questions = data["Follow-up Questions"].is_string() ? data["Follow-up Questions"].get<string>() : data["Follow-up Questions"].dump();
            latex << "  \\item " << questions << "\n";
        }
        
        latex << "\\end{itemize}\n\n";
    }
    
    // Add Arguments section
    if (data.contains("Arguments")) {
        latex << "\\section{Arguments}\n";
        
        if (data["Arguments"].is_object()) {
            for (auto& [key, value] : data["Arguments"].items()) {
                string argTitle = key;
                string argContent = value.is_string() ? value.get<string>() : value.dump();
                
                latex << "\\subsection*{" << argTitle << "}\n";
                latex << argContent << "\n\n";
            }
        } else if (data["Arguments"].is_array()) {
            latex << "\\begin{itemize}[leftmargin=*]\n";
            for (const auto& arg : data["Arguments"]) {
                string argText = arg.is_string() ? arg.get<string>() : arg.dump();
                latex << "  \\item " << argText << "\n";
            }
            latex << "\\end{itemize}\n\n";
        } else {
            string arguments = data["Arguments"].is_string() ? data["Arguments"].get<string>() : data["Arguments"].dump();
            latex << arguments << "\n\n";
        }
    }
    
    // Add References section
    if (data.contains("References")) {
        latex << "\\section{References}\n";
        latex << "\\begin{itemize}[leftmargin=*]\n";
        
        if (data["References"].is_array()) {
            for (const auto& ref : data["References"]) {
                string refText = ref.is_string() ? ref.get<string>() : ref.dump();
                latex << "  \\item " << refText << "\n";
            }
        } else {
            string references = data["References"].is_string() ? data["References"].get<string>() : data["References"].dump();
            latex << "  \\item " << references << "\n";
        }
        
        latex << "\\end{itemize}\n\n";
    }
    
    // Add Stories section
    if (data.contains("Stories")) {
        latex << "\\section{Stories}\n";
        latex << "\\begin{itemize}[leftmargin=*]\n";
        
        if (data["Stories"].is_array()) {
            for (const auto& story : data["Stories"]) {
                string storyText = story.is_string() ? story.get<string>() : story.dump();
                latex << "  \\item " << storyText << "\n";
            }
        } else {
            string stories = data["Stories"].is_string() ? data["Stories"].get<string>() : data["Stories"].dump();
            latex << "  \\item " << stories << "\n";
        }
        
        latex << "\\end{itemize}\n\n";
    }
    
    // Add Sentiment section
    if (data.contains("Sentiment")) {
        latex << "\\section{Sentiment}\n";
        string sentiment = data["Sentiment"].is_string() ? data["Sentiment"].get<string>() : data["Sentiment"].dump();
        latex << sentiment << "\n\n";
    }
    
    // End the document
    latex << "\\end{document}\n";
    
    return latex.str();
}

// Function to save LaTeX to a file
bool saveLatexToFile(const string &latex, const string &filePath) {
    ofstream file(filePath);
    if (!file.is_open()) {
        cerr << "Failed to open file for writing: " << filePath << endl;
        return false;
    }
    
    file << latex;
    file.close();
    
    cout << "LaTeX saved to: " << filePath << endl;
    return true;
}
int main() {
    cout << "Select an audio file for transcription." << endl;
    string filePath = getFileFromDialog();
    
    // Use the API key from the config file
    string apiKey = OPENAI_API_KEY;
    
    // Transcribe audio
    cout << "Transcribing audio file: " << filePath << "..." << endl;
    string transcriptionResponse = transcribeAudio(filePath, apiKey);
    
    // Parse the transcription JSON to extract the transcription text
    string transcriptionText;
    try {
        auto jsonResponse = json::parse(transcriptionResponse);
        // Assuming the transcription text is in the "text" field
        transcriptionText = jsonResponse["text"];
        cout << "Transcription:" << endl << transcriptionText << endl;
    } catch (const exception& e) {
        cerr << "Error parsing transcription JSON response: " << e.what() << endl;
        cout << "Raw transcription response:" << endl << transcriptionResponse << endl;
        transcriptionText = transcriptionResponse; // Fallback to raw response if parsing fails
    }
    
    // Process transcription with the Chat Completions API
    cout << "Processing transcription with OpenAI Chat Completions API..." << endl;
    string categorizedResponse = categorizeWithOpenAI(transcriptionText, apiKey);
    
    // Parse the categorized JSON response to extract the assistant's reply
    nlohmann::json categorizedJson;
    string assistantReply;
    
    try {
        auto jsonResponse = json::parse(categorizedResponse);
        // Chat completions responses usually include a "choices" array
        assistantReply = jsonResponse["choices"][0]["message"]["content"];
        cout << "Categorized Response:" << endl << assistantReply << endl;
        
        // Extract JSON from code block if present
        try {
            // Check if the response is wrapped in a code block
            regex jsonBlockPattern("```json\\s*([\\s\\S]*?)\\s*```");
            smatch matches;
            if (regex_search(assistantReply, matches, jsonBlockPattern) && matches.size() > 1) {
                // Extract the JSON content from the code block
                string jsonContent = matches[1].str();
                categorizedJson = json::parse(jsonContent);
            } else {
                // Try parsing directly if not in a code block
                categorizedJson = json::parse(assistantReply);
            }
            
            cout << "Parsed JSON successfully" << endl;
        } catch (const exception& e) {
            cerr << "Error parsing categorized JSON: " << e.what() << endl;
            // Fallback to example JSON if parsing fails
            categorizedJson = {
                {"Summary", "This is a brief summary."},
                {"Main Points", "Point A, Point B, Point C"},
                {"Action Items", "Follow up on item 1 and item 2"},
                {"Follow-up Questions", "What is the timeline?"},
                {"Stories", "A brief anecdote..."},
                {"References", "Reference details here"},
                {"Arguments", "The arguments are..."},
                {"Sentiment", "Positive"}
            };
            cout << "Using fallback JSON example" << endl;
        }
    } catch (const exception& e) {
        cerr << "Error parsing chat completions JSON response: " << e.what() << endl;
        cout << "Raw categorized response:" << endl << categorizedResponse << endl;
        // Fallback to example JSON if parsing fails
        categorizedJson = {
            {"Summary", "This is a brief summary."},
            {"Main Points", "Point A, Point B, Point C"},
            {"Action Items", "Follow up on item 1 and item 2"},
            {"Follow-up Questions", "What is the timeline?"},
            {"Stories", "A brief anecdote..."},
            {"References", "Reference details here"},
            {"Arguments", "The arguments are..."},
            {"Sentiment", "Positive"}
        };
        cout << "Using fallback JSON example" << endl;
    }
    
    // Use the API keys from the config file
    string notionDatabaseId = NOTION_DATABASE_ID;
    string notionApiKey = NOTION_API_KEY;

    if (sendToNotion(categorizedJson, notionDatabaseId, notionApiKey)) {
        cout << "Data successfully sent to Notion." << endl;
    } else {
        cerr << "Failed to send data to Notion." << endl;
    }
    // Convert the JSON to LaTeX
    string latex = convertToLatex(categorizedJson);
    
    // Save the LaTeX to a file
    string latexFilePath = "transcription_analysis.tex";
    if (saveLatexToFile(latex, latexFilePath)) {
        cout << "LaTeX output saved to " << latexFilePath << endl;
        
        // Compile the LaTeX file to PDF (if pdflatex is available)
        string compileCommand = "pdflatex " + latexFilePath;
        cout << "You can compile the LaTeX file to PDF using: " << compileCommand << endl;
    } else {
        cerr << "Failed to save LaTeX output." << endl;
    }    
    return 0;
}
