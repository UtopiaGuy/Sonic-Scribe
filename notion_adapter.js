#!/usr/bin/env node

const fs = require('fs');

// Help text
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Notion Adapter - Format JSON data for Notion API

Usage:
  ./notion_adapter.js [options] [input_file]

Options:
  --output, -o FILE    Save output to FILE instead of stdout
  --help, -h           Show this help message

Examples:
  ./notion_adapter.js data.json                     # Read from data.json, output to stdout
  ./notion_adapter.js data.json -o notion_data.json # Read from data.json, save to notion_data.json
  cat data.json | ./notion_adapter.js               # Read from stdin, output to stdout
  `);
  process.exit(0);
}

// Parse command line arguments
let inputFile = null;
let outputFile = null;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--output' || process.argv[i] === '-o') {
    outputFile = process.argv[i + 1];
    i++; // Skip the next argument
  } else if (!process.argv[i].startsWith('-')) {
    inputFile = process.argv[i];
  }
}

// Read input data
let inputData;
try {
  if (inputFile) {
    // Read from file
    inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  } else {
    // Read from stdin
    const stdinBuffer = fs.readFileSync(0); // STDIN_FILENO = 0
    inputData = JSON.parse(stdinBuffer.toString());
  }
} catch (error) {
  console.error(`Error reading input: ${error.message}`);
  process.exit(1);
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

// Format the output JSON
const outputJson = JSON.stringify(notionCompatibleData, null, 2);

// Output the formatted JSON
if (outputFile) {
  try {
    fs.writeFileSync(outputFile, outputJson);
    console.log(`Notion-compatible JSON saved to ${outputFile}`);
  } catch (error) {
    console.error(`Error writing to ${outputFile}: ${error.message}`);
    process.exit(1);
  }
} else {
  console.log(outputJson);
}
