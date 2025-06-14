#include "transcription.h"
#include <curl/curl.h>
#include <fstream>
#include <iostream>
#include <sstream>
#include <cstdlib>

using namespace std;

// Local callback for CURL data
static size_t WriteCallback(void *contents, size_t size, size_t nmemb, string *output) {
    size_t totalSize = size * nmemb;
    output->append(reinterpret_cast<char*>(contents), totalSize);
    return totalSize;
}

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

        struct curl_slist *headers = nullptr;
        headers = curl_slist_append(headers, ("Authorization: Bearer " + apiKey).c_str());

        curl_easy_setopt(curl, CURLOPT_URL, "https://api.openai.com/v1/audio/transcriptions");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_POST, 1L);

        curl_mime *form = curl_mime_init(curl);
        curl_mimepart *field = curl_mime_addpart(form);
        curl_mime_name(field, "file");
        curl_mime_filename(field, filePath.c_str());
        curl_mime_data(field, fileData.c_str(), fileData.size());

        field = curl_mime_addpart(form);
        curl_mime_name(field, "model");
        curl_mime_data(field, "whisper-1", CURL_ZERO_TERMINATED);

        curl_easy_setopt(curl, CURLOPT_MIMEPOST, form);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseString);

        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            cerr << "CURL error (transcription): " << curl_easy_strerror(res) << endl;
        }

        curl_mime_free(form);
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
    }
    curl_global_cleanup();
    return responseString;
}
