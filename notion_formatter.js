#!/usr/bin/env node

const fs = require('fs');

// Read the input JSON file or use stdin
let inputData;
if (process.argv.length > 2) {
  const inputFile = process.argv[2];
  inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
} else {
  // Read from stdin
  const stdinBuffer = fs.readFileSync(0); // STDIN_FILENO = 0
  inputData = JSON.parse(stdinBuffer.toString());
}

// Create a new object with only the properties that exist in Notion
const notionCompatibleData = {
  // Use Title instead of AI_Title
  Title: inputData.AI_Title || inputData.Title || "",
  
  // Keep these properties as they seem to exist in Notion
  Type: inputData.Type || "",
  Icon: inputData.Icon || "",
  
  // Keep arrays that seem to exist in Notion
  Summary: inputData.Summary || [],
  References: inputData.References || [],
  Stories: inputData.Stories || [],
  Arguments: inputData.Arguments || [],
  Sentiment: inputData.Sentiment || [],
  
  // Duration is mentioned as existing but as a formula type
  // We'll include it anyway and let Notion handle it
  Duration: inputData.Duration || ""
};

// Output the formatted JSON with proper commas
console.log(JSON.stringify(notionCompatibleData, null, 2));
