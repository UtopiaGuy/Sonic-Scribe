/**
 * Sonic Scribe v2 — Notion Service
 * Simplified Notion integration using the official SDK
 */

const { Client } = require('@notionhq/client');

const NOTION_API_KEY = process.env.NOTION_API_KEY || '';

function getClient() {
  if (!NOTION_API_KEY) throw new Error('Notion API key not configured. Set NOTION_API_KEY in .env');
  return new Client({ auth: NOTION_API_KEY });
}

/**
 * List databases accessible to the integration
 */
async function listDatabases() {
  const notion = getClient();
  const response = await notion.search({
    filter: { value: 'database', property: 'object' },
    sort: { direction: 'descending', timestamp: 'last_edited_time' },
  });
  return response.results.map(db => ({
    id: db.id,
    title: db.title?.[0]?.plain_text || 'Untitled',
    url: db.url,
  }));
}

/**
 * Ensure database has the required properties, create any missing ones
 */
async function ensureProperties(databaseId) {
  const notion = getClient();
  const db = await notion.databases.retrieve({ database_id: databaseId });

  // Find the title property
  let titleProp = null;
  for (const [name, config] of Object.entries(db.properties)) {
    if (config.type === 'title') { titleProp = name; break; }
  }

  // Required properties
  const required = {
    'Type': { select: {} },
    'Duration': { rich_text: {} },
    'Duration Seconds': { number: { format: 'number' } },
    'Summary': { rich_text: {} },
    'Main Points': { rich_text: {} },
    'Action Items': { rich_text: {} },
    'Key Insights': { rich_text: {} },
    'Follow-up Questions': { rich_text: {} },
    'References': { rich_text: {} },
    'Topics': { multi_select: {} },
    'Sentiment': { rich_text: {} },
    'Engine': { select: {} },
    'Date': { date: {} },
  };

  // Find missing properties
  const missing = {};
  for (const [name, config] of Object.entries(required)) {
    if (!db.properties[name]) missing[name] = config;
  }

  // Update if needed
  if (Object.keys(missing).length > 0) {
    await notion.databases.update({ database_id: databaseId, properties: missing });
    console.log(`Added properties to Notion DB: ${Object.keys(missing).join(', ')}`);
  }

  return titleProp || 'Name';
}

/**
 * Create a new Notion database for Sonic Scribe
 */
async function createDatabase(parentPageId, name = 'Sonic Scribe Notes') {
  const notion = getClient();
  const db = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: name } }],
    properties: {
      'Title': { title: {} },
      'Type': { select: { options: [
        { name: 'Meeting Notes', color: 'blue' },
        { name: 'Lecture', color: 'green' },
        { name: 'Interview', color: 'purple' },
        { name: 'Voice Memo', color: 'orange' },
        { name: 'Conversation', color: 'yellow' },
        { name: 'Podcast', color: 'red' },
      ]}},
      'Duration': { rich_text: {} },
      'Duration Seconds': { number: { format: 'number' } },
      'Summary': { rich_text: {} },
      'Main Points': { rich_text: {} },
      'Action Items': { rich_text: {} },
      'Key Insights': { rich_text: {} },
      'Follow-up Questions': { rich_text: {} },
      'References': { rich_text: {} },
      'Topics': { multi_select: {} },
      'Sentiment': { rich_text: {} },
      'Engine': { select: {} },
      'Date': { date: {} },
    },
  });
  return { id: db.id, title: name, url: db.url };
}

/**
 * Helper: truncate text to Notion's 2000-char limit for rich_text
 */
function truncate(text, maxLen = 2000) {
  if (text === null || text === undefined) return '';
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  const trimmed = str.trim();
  if (!trimmed) return ''; // Empty string
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}

/**
 * Helper: format array to string
 */
function arrayToString(arr) {
  if (!arr) return '';
  if (typeof arr === 'string') return arr;
  if (Array.isArray(arr)) {
    return arr.map(item => {
      if (typeof item === 'string') return `• ${item}`;
      if (item.task) return `• [${item.priority || 'medium'}] ${item.task}${item.assignee ? ` → ${item.assignee}` : ''}`;
      return `• ${JSON.stringify(item)}`;
    }).join('\n');
  }
  return JSON.stringify(arr);
}

/**
 * Export analysis to Notion database
 */
async function exportToNotion(analysis, databaseId) {
  const notion = getClient();
  const titleProp = await ensureProperties(databaseId);

  const createRichText = (content) => {
    const truncated = truncate(content);
    return truncated ? { rich_text: [{ text: { content: truncated } }] } : undefined;
  };

  const properties = {
    [titleProp]: {
      title: [{ text: { content: truncate(analysis.title || 'Untitled Recording', 100) || 'Untitled' } }],
    },
    'Type': analysis.type ? { select: { name: analysis.type } } : undefined,
    'Duration': analysis.duration ? createRichText(analysis.duration) : undefined,
    'Duration Seconds': analysis.duration_seconds ? { number: analysis.duration_seconds } : undefined,
    'Summary': createRichText(analysis.summary),
    'Main Points': createRichText(arrayToString(analysis.main_points)),
    'Action Items': createRichText(arrayToString(analysis.action_items)),
    'Key Insights': createRichText(arrayToString(analysis.key_insights)),
    'Follow-up Questions': createRichText(arrayToString(analysis.follow_up_questions)),
    'References': createRichText(arrayToString(analysis.references)),
    'Sentiment': (() => {
      if (!analysis.sentiment) return undefined;
      const content = truncate(
        typeof analysis.sentiment === 'string' 
          ? analysis.sentiment 
          : `Overall: ${analysis.sentiment.overall || 'N/A'}\nBreakdown: ${analysis.sentiment.breakdown || 'N/A'}`
      );
      if (!content) return undefined;
      return { rich_text: [{ text: { content } }] };
    })(),
    'Engine': analysis._engine ? { select: { name: analysis._engine } } : undefined,
    'Date': { date: { start: new Date().toISOString().split('T')[0] } },
  };

  // Add topics as multi_select
  if (analysis.topics && Array.isArray(analysis.topics)) {
    properties['Topics'] = { multi_select: analysis.topics.slice(0, 10).map(t => ({ name: t.substring(0, 100) })) };
  }

  // Remove undefined properties
  for (const key of Object.keys(properties)) {
    if (properties[key] === undefined) delete properties[key];
  }

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
  });

  return { id: page.id, url: page.url };
}

module.exports = { listDatabases, createDatabase, exportToNotion, ensureProperties };
