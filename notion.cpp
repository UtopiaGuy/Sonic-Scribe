#include "notion.h"
#include <curl/curl.h>
#include <iostream>
#include <sstream>
#include <map>
#include <vector>
#include <string>
#include <utility>

using namespace std;
using json = nlohmann::json;

string g_titlePropertyName = "";

static size_t WriteCallback(void *contents, size_t size, size_t nmemb, string *output) {
    size_t totalSize = size * nmemb;
    output->append(reinterpret_cast<char*>(contents), totalSize);
    return totalSize;
}

bool ensureNotionDatabaseProperties(const string &notionDatabaseId, const string &notionApiKey) {
    CURL *curl;
    CURLcode res;
    string responseString;

    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();
    if (!curl) {
        cerr << "Failed to initialize CURL for database retrieval" << endl;
        return false;
    }

    struct curl_slist *headers = nullptr;
    headers = curl_slist_append(headers, ("Authorization: Bearer " + notionApiKey).c_str());
    headers = curl_slist_append(headers, "Content-Type: application/json");
    headers = curl_slist_append(headers, "Notion-Version: 2022-06-28");

    string url = "https://api.notion.com/v1/databases/" + notionDatabaseId;
    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseString);

    res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        cerr << "CURL error (database retrieval): " << curl_easy_strerror(res) << endl;
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        curl_global_cleanup();
        return false;
    }

    try {
        auto dbJson = json::parse(responseString);
        if (dbJson.contains("object") && dbJson["object"] == "error") {
            cerr << "Notion API error (database retrieval): " << dbJson["message"].get<string>() << endl;
            cout << "Notion API response:" << endl << responseString << endl;
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
            curl_global_cleanup();
            return false;
        }

        map<string, string> existingProps;
        if (dbJson.contains("properties") && dbJson["properties"].is_object()) {
            for (auto& [key, value] : dbJson["properties"].items()) {
                if (value.contains("type")) {
                    existingProps[key] = value["type"];
                }
            }
        }

        string titlePropName;
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

        g_titlePropertyName = titlePropName;

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

        vector<pair<string, string>> missingProps;
        for (const auto& [propName, propType] : requiredProps) {
            if (existingProps.find(propName) == existingProps.end()) {
                missingProps.push_back({propName, propType});
            } else if (existingProps[propName] != propType) {
                cerr << "Warning: Property '" << propName << "' exists but has type '" << existingProps[propName] << "' instead of '" << propType << "'" << endl;
            }
        }

        if (missingProps.empty()) {
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
            curl_global_cleanup();
            return true;
        }

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

        curl_easy_reset(curl);
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PATCH");
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, updatePayloadStr.c_str());
        responseString.clear();
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseString);

        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            cerr << "CURL error (database update): " << curl_easy_strerror(res) << endl;
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
            curl_global_cleanup();
            return false;
        }

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
        } catch (const exception& e) {
            cerr << "Error parsing database update response: " << e.what() << endl;
            cout << "Raw response:" << endl << responseString << endl;
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
            curl_global_cleanup();
            return false;
        }

        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        curl_global_cleanup();
        return true;
    } catch (const exception& e) {
        cerr << "Error parsing database response: " << e.what() << endl;
        cout << "Raw response:" << endl << responseString << endl;
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        curl_global_cleanup();
        return false;
    }
}

bool sendToNotion(const json &data, const string &notionDatabaseId, const string &notionApiKey) {
    if (!ensureNotionDatabaseProperties(notionDatabaseId, notionApiKey)) {
        cerr << "Failed to ensure database properties" << endl;
        return false;
    }

    json payload;
    payload["parent"] = {{"database_id", notionDatabaseId}};
    json properties;
    for (auto& [key, value] : data.items()) {
        if (key == "AI_Title" || key == "Title") {
            string content = value.is_string() ? value.get<string>() : value.dump();
            properties[g_titlePropertyName] = {
                {"title", json::array({{{"text", {{"content", content}}}}})}
            };
        } else if (key == "Summary") {
            if (!data.contains("AI_Title") && !data.contains("Title")) {
                string content = value.is_string() ? value.get<string>() : value.dump();
                properties[g_titlePropertyName] = {
                    {"title", json::array({{{"text", {{"content", content}}}}})}
                };
            }
        } else if (key == "Type") {
            string content = value.is_string() ? value.get<string>() : value.dump();
            properties[key] = {{"select", {{"name", content}}}};
        } else if (key == "At Cost" || key == "AI Cost") {
            string propName = "AI Cost";
            if (value.is_null()) {
                properties[propName] = {{"number", nullptr}};
            } else if (value.is_number()) {
                properties[propName] = {{"number", value}};
            } else {
                try {
                    double numValue = stod(value.is_string() ? value.get<string>() : value.dump());
                    properties[propName] = {{"number", numValue}};
                } catch (...) {
                    properties[propName] = {{"number", nullptr}};
                }
            }
        } else if (key == "Duration (Seconds)") {
            if (value.is_number()) {
                properties[key] = {{"number", value}};
            } else {
                try {
                    double numValue = stod(value.is_string() ? value.get<string>() : value.dump());
                    properties[key] = {{"number", numValue}};
                } catch (...) {
                    properties[key] = {{"number", 0}};
                }
            }
        } else if (key == "Date") {
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
            if (value.is_array()) {
                ostringstream contentStream;
                for (size_t i = 0; i < value.size(); ++i) {
                    string itemText = value[i].is_string() ? value[i].get<string>() : value[i].dump();
                    contentStream << itemText;
                    if (i < value.size() - 1) contentStream << ", ";
                }
                string content = contentStream.str();
                properties[key] = {{"rich_text", json::array({{{"text", {{"content", content}}}}})}};
            } else {
                string content = value.is_string() ? value.get<string>() : value.dump();
                properties[key] = {{"rich_text", json::array({{{"text", {{"content", content}}}}})}};
            }
        }
    }
    payload["properties"] = properties;
    string payloadStr = payload.dump();

    CURL *curl;
    CURLcode res;
    string responseString;

    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();
    if (curl) {
        struct curl_slist *headers = nullptr;
        headers = curl_slist_append(headers, ("Authorization: Bearer " + notionApiKey).c_str());
        headers = curl_slist_append(headers, "Content-Type: application/json");
        headers = curl_slist_append(headers, "Notion-Version: 2022-06-28");
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.notion.com/v1/pages");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_POST, 1L);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, payloadStr.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseString);
        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            cerr << "CURL error (Notion API): " << curl_easy_strerror(res) << endl;
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
            curl_global_cleanup();
            return false;
        }
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
            cout << "Notion API response:" << endl << responseString << endl;
        }
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
    }
    curl_global_cleanup();
    return true;
}
