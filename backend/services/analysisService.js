/**
 * Sonic Scribe v2 — AI Analysis Service
 * Primary: Gemma 4 E4B via Unsloth Studio (local)
 * Fallback: Gemini API (cloud)
 */

const { jsonrepair } = require('jsonrepair');

const UNSLOTH_URL = process.env.UNSLOTH_URL || 'http://host.docker.internal:8888';
const UNSLOTH_USER = process.env.UNSLOTH_USER || 'unsloth';
const UNSLOTH_PASS = process.env.UNSLOTH_PASSWORD || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const LOCAL_TIMEOUT = 120000; // 2 min for local model (long transcriptions need time)
const AUTH_TIMEOUT = 5000;

let unslothToken = null;
let tokenExpiry = 0;

/**
 * Get/refresh Unsloth JWT token
 */
async function getUnslothToken() {
  if (unslothToken && Date.now() < tokenExpiry - 60000) return unslothToken;

  try {
    const res = await fetch(`${UNSLOTH_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: UNSLOTH_USER, password: UNSLOTH_PASS }),
    });

    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
    const data = await res.json();
    unslothToken = data.access_token;
    // Decode JWT for expiry
    try {
      const payload = JSON.parse(Buffer.from(unslothToken.split('.')[1], 'base64').toString());
      tokenExpiry = payload.exp * 1000;
    } catch {
      tokenExpiry = Date.now() + 3600000;
    }
    return unslothToken;
  } catch (err) {
    console.error('Unsloth auth error:', err.message);
    unslothToken = null;
    throw err;
  }
}

/**
 * Build the analysis system prompt
 */
function buildSystemPrompt() {
  return `You are an expert audio transcription analyst. Analyze the provided transcription and produce a structured JSON analysis.

You MUST respond with ONLY valid JSON (no markdown, no code blocks, no explanation). The JSON must follow this exact schema:

{
  "title": "A concise, descriptive title for this recording",
  "type": "One of: Meeting Notes, Lecture, Interview, Brainstorm, Journal, Conversation, Podcast, Presentation, Phone Call, Voice Memo",
  "confidence": 0.0 to 1.0,
  "summary": "2-3 paragraph executive summary capturing the essence of the recording",
  "key_insights": ["Array of the most important insights or takeaways, each with context"],
  "main_points": ["Array of detailed main points with supporting evidence from the transcription"],
  "action_items": [
    {"task": "Description of the action item", "priority": "high or medium or low", "assignee": "name if mentioned, otherwise null"}
  ],
  "follow_up_questions": ["Thoughtful analytical questions that arise from the content"],
  "decisions_made": ["Any explicit decisions identified in the recording"],
  "references": ["People, books, tools, URLs, organizations mentioned"],
  "stories_examples": ["Narratives, anecdotes, and examples mentioned with brief context"],
  "arguments": {"for": ["Arguments in favor"], "against": ["Arguments against"], "unresolved": ["Open debates"]},
  "sentiment": {"overall": "positive or neutral or negative or mixed", "breakdown": "Brief explanation of the emotional tone"},
  "topics": ["tag1", "tag2", "tag3", "up to 8 relevant topic tags"],
  "speakers": ["List of identified speakers if multiple, or empty array"],
  "word_count": 0,
  "language": "en"
}

Rules:
- Every field must be present. Use empty arrays [] or null for missing data.
- Be thorough in your analysis. Extract as much useful information as possible.
- action_items must have priority and assignee fields.
- arguments must have for, against, and unresolved arrays.
- sentiment must have overall and breakdown fields.
- topics should be lowercase tags suitable for Obsidian/Notion.
- Respond with ONLY the JSON object. No other text.`;
}

/**
 * Analyze transcription using local Gemma 4 via Unsloth
 */
async function analyzeWithGemma(transcription, duration) {
  const token = await getUnslothToken();

  const res = await fetch(`${UNSLOTH_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemma-4-E4B-it-UD-Q6_K_XL',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: `Analyze this transcription (duration: ${duration || 'unknown'}):\n\n${transcription}` },
      ],
      max_tokens: 4096,
      temperature: 0.3,
      stream: false,
    }),
    signal: AbortSignal.timeout(LOCAL_TIMEOUT),
  });

  if (!res.ok) throw new Error(`Gemma API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Gemma');

  return parseAnalysisJSON(content);
}

/**
 * Analyze transcription using Gemini API (fallback)
 */
async function analyzeWithGemini(transcription, duration) {
  if (!GEMINI_KEY) throw new Error('No Gemini API key configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `${buildSystemPrompt()}\n\nAnalyze this transcription (duration: ${duration || 'unknown'}):\n\n${transcription}`,
        }],
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Empty response from Gemini');

  return parseAnalysisJSON(content);
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
function parseAnalysisJSON(text) {
  try {
    // Strip <think>...</think> XML blocks that reasoning models (like Gemma 4 / R1) output before the JSON
    let cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    // Strip discord-style markdown code blocks if the AI wrapped the JSON
    cleanText = cleanText.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

    return JSON.parse(cleanText);
  } catch (initialErr) {
    console.warn('Initial JSON parse failed, trying jsonrepair...', initialErr.message);
    try {
      // Fallback: repair common LLM JSON syntax errors before parsing
      let cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      cleanText = cleanText.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      
      const repaired = jsonrepair(cleanText);
      return JSON.parse(repaired);
    } catch (repairErr) {
      console.error('Failed to parse and repair analysis JSON:', initialErr.message, repairErr.message);
      console.error('Raw response (first 500 chars):', text.substring(0, 500));
      throw new Error(`Invalid JSON response from AI: ${initialErr.message}`);
    }
  }
}

/**
 * Main analysis function — selects engine based on preference
 * @param {string} transcription - The transcribed text
 * @param {string} duration - Duration string (e.g., "00:07:26")
 * @param {string} preference - 'auto' (default), 'local' (Gemma only), or 'cloud' (Gemini only)
 * @returns {Promise<{analysis: Object, engine: string}>}
 */
async function analyze(transcription, duration, preference = 'auto') {
  let lastErr = null;

  // Try Local Gemma 4
  if (preference === 'auto' || preference === 'local') {
    try {
      console.log('Attempting analysis with local Gemma 4...');
      const analysis = await analyzeWithGemma(transcription, duration);
      console.log('Analysis complete via Gemma 4 (local)');
      return { analysis, engine: 'gemma-4-local' };
    } catch (err) {
      console.warn('Local Gemma 4 failed:', err.message);
      lastErr = err;
      if (preference === 'local') {
        throw new Error(`Local analysis failed: ${err.message}`);
      }
    }
  }

  // Fallback / Try Cloud Gemini
  if (preference === 'auto' || preference === 'cloud') {
    try {
      console.log('Attempting analysis with Gemini API...');
      const analysis = await analyzeWithGemini(transcription, duration);
      console.log('Analysis complete via Gemini API (cloud)');
      return { analysis, engine: 'gemini-cloud' };
    } catch (err) {
      console.error('Gemini API failed:', err.message);
      throw new Error(`Cloud analysis failed: ${err.message}`);
    }
  }

  throw new Error(`Analysis failed. Last error: ${lastErr?.message || 'Unknown configuration'}`);
}

module.exports = { analyze, analyzeWithGemma, analyzeWithGemini };
