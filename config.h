/**
 * Configuration Header File
 * 
 * This file contains declarations for API keys and other configuration settings.
 * The actual values are defined in config.cpp, which should not be committed to version control.
 */

#ifndef CONFIG_H
#define CONFIG_H

#include <string>

// API Keys
extern const std::string OPENAI_API_KEY;
extern const std::string NOTION_API_KEY;
extern const std::string NOTION_DATABASE_ID;

#endif // CONFIG_H
