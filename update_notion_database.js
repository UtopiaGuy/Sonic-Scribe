#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

// Configuration from environment variables
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// Check if environment variables are set
if (!NOTION_API_KEY || !DATABASE_ID) {
  console.error('Error: Required environment variables are not set.');
  console.error('Please make sure NOTION_API_KEY and NOTION_DATABASE_ID are defined in the .env file.');
  process.exit(1);
}

// Required properties for our data (excluding title property)
const requiredProperties = {
  "Type": {
    "select": {
      "options": [
        { "name": "Educational Transcript" },
        { "name": "Meeting Notes" },
        { "name": "AI Transcription" }
      ]
    }
  },
  "Duration": {
    "rich_text": {}
  },
  "Duration_Seconds": {
    "number": {
      "format": "number"
    }
  },
  "AI_Cost": {
    "rich_text": {}
  },
  "Icon": {
    "rich_text": {}
  },
  "Summary": {
    "rich_text": {}
  },
  "Main_Points": {
    "rich_text": {}
  },
  "Action_Items": {
    "rich_text": {}
  },
  "References": {
    "rich_text": {}
  },
  "Follow-up_Questions": {
    "rich_text": {}
  },
  "Stories": {
    "rich_text": {}
  },
  "Arguments": {
    "rich_text": {}
  },
  "Sentiment": {
    "rich_text": {}
  }
};

// Function to make a request to the Notion API
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.notion.com',
      port: 443,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            console.error('Error response:', parsedData);
            reject(new Error(`API request failed with status ${res.statusCode}: ${parsedData.message}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Function to get the current database structure
async function getDatabaseStructure() {
  try {
    const database = await makeRequest('GET', `/v1/databases/${DATABASE_ID}`);
    console.log('Current database structure retrieved successfully');
    return database;
  } catch (error) {
    console.error('Failed to get database structure:', error.message);
    throw error;
  }
}

// Function to update the database structure
async function updateDatabaseStructure(existingProperties) {
  // Prepare the properties to update
  const propertiesToUpdate = {};
  
  // Add or update required properties
  for (const [name, config] of Object.entries(requiredProperties)) {
    if (!existingProperties[name]) {
      propertiesToUpdate[name] = config;
    }
  }
  
  // If there are no properties to update, we're done
  if (Object.keys(propertiesToUpdate).length === 0) {
    console.log('No properties need to be added to the database');
    return;
  }
  
  try {
    // Update the database
    const data = {
      properties: propertiesToUpdate
    };
    
    const response = await makeRequest('PATCH', `/v1/databases/${DATABASE_ID}`, data);
    console.log('Database structure updated successfully');
    console.log('Added properties:', Object.keys(propertiesToUpdate).join(', '));
    return response;
  } catch (error) {
    console.error('Failed to update database structure:', error.message);
    throw error;
  }
}

// Function to find the title property in the database
function findTitleProperty(properties) {
  for (const [name, config] of Object.entries(properties)) {
    if (config.type === 'title') {
      return name;
    }
  }
  return null;
}

// Main function
async function main() {
  try {
    // Get the current database structure
    const database = await getDatabaseStructure();
    
    // Find the title property
    const titleProperty = findTitleProperty(database.properties);
    if (titleProperty) {
      console.log(`Found existing title property: "${titleProperty}"`);
      console.log(`Use this name in your C++ code for the title field.`);
    } else {
      console.log('No title property found in the database. This is unusual.');
    }
    
    // Update the database structure
    await updateDatabaseStructure(database.properties);
    
    console.log('Done!');
  } catch (error) {
    console.error('An error occurred:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
