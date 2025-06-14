#include "analysis.h"
#include <curl/curl.h>
#include <string>
#include <sstream>
#include <iostream>
#include <iomanip>
#include <vector>
#include <cstdlib>

using namespace std;

static size_t WriteCallback(void *contents, size_t size, size_t nmemb, string *output) {
    size_t totalSize = size * nmemb;
    output->append(reinterpret_cast<char*>(contents), totalSize);
    return totalSize;
}

static string escapeJsonString(const string &input) {
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

string categorizeWithOpenAI(const string &transcription, const string &apiKey) {
    CURL *curl;
    CURLcode res;
    string responseString;
    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();
    if (curl) {
        string escapedTranscription = escapeJsonString(transcription);
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
        string summaryOptionsStr;
        for (size_t i = 0; i < summaryOptions.size(); ++i) {
            summaryOptionsStr += summaryOptions[i];
            if (i < summaryOptions.size() - 1) summaryOptionsStr += ", ";
        }
        string data = R"({
            \"model\": \"gpt-4o\",
            \"messages\": [
                {\"role\": \"system\",\"content\": \"You are an assistant that analyzes voice recordings and outputs categorized sections in JSON format for Notion database integration.\"},
                {\"role\": \"user\",\"content\": \"Analyze the following transcription and categorize it into these sections: )" + summaryOptionsStr + R"(. Generate an AI title for the note. For Type, suggest a category like 'AI Transcription', 'Meeting Notes', etc. For Duration, provide a time format like '00:07:26'. Calculate the Duration (Seconds) as a number. Include an AI Cost estimate (a small dollar amount). Also include an Icon field with the value '🤖'. Format all lists as arrays. Provide the output in clean JSON format with no markdown formatting.\n\nTranscription: )" + escapedTranscription + R"(")}
            ]
        })";
        struct curl_slist *headers = nullptr;
        headers = curl_slist_append(headers, ("Authorization: Bearer " + apiKey).c_str());
        headers = curl_slist_append(headers, "Content-Type: application/json");
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.openai.com/v1/chat/completions");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_POST, 1L);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, data.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseString);
        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            cerr << "CURL error (chat completions): " << curl_easy_strerror(res) << endl;
        }
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
    }
    curl_global_cleanup();
    return responseString;
}
