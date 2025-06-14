#ifndef NOTION_H
#define NOTION_H

#include <string>
#include "nlohmann/json.hpp"

extern std::string g_titlePropertyName;

bool ensureNotionDatabaseProperties(const std::string &notionDatabaseId, const std::string &notionApiKey);
bool sendToNotion(const nlohmann::json &data, const std::string &notionDatabaseId, const std::string &notionApiKey);

#endif // NOTION_H
