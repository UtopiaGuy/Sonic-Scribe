/**
 * Sonic Scribe v2 — API Routes
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const { transcribe, getAvailableModels } = require('../services/whisperService');
const { analyze } = require('../services/analysisService');
const history = require('../services/historyService');
const notion = require('../services/notionService');
const obsidian = require('../services/obsidianService');

// --- File Upload Config ---
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are accepted'), false);
    }
  },
});

// ==========================================================
// Upload + Transcribe + Analyze (main pipeline)
// ==========================================================
router.post('/upload', upload.single('audio'), async (req, res) => {
  const broadcast = req.app.get('broadcast');
  const whisperModel = req.body.whisperModel || process.env.WHISPER_MODEL || 'base.en';
  const analysisEngine = req.body.analysisEngine || 'auto';
  const saveHistory = req.body.saveHistory !== 'false'; // default true

  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    broadcast('status', { step: 'uploaded', message: `File received: ${fileName}` });

    // Step 1: Transcribe
    broadcast('status', { step: 'transcribing', message: `Starting transcription (${whisperModel})...` });
    const { text: transcription, segments } = await transcribe(filePath, whisperModel, (progress) => {
      broadcast('status', progress);
    });

    if (!transcription || transcription.trim().length === 0) {
      throw new Error('Transcription returned empty result');
    }

    broadcast('status', { step: 'transcribed', message: `Transcription complete (${transcription.split(' ').length} words)` });

    // Calculate duration from segments or estimate
    let duration = '';
    let durationSeconds = 0;
    if (segments && segments.length > 0) {
      const lastSeg = segments[segments.length - 1];
      if (lastSeg.timestamps?.to) {
        // e.g. "00:05:15,000" or "00:05:15.000"
        const parts = lastSeg.timestamps.to.split(':');
        if (parts.length === 3) {
          const h = parseFloat(parts[0]);
          const m = parseFloat(parts[1]);
          const s = parseFloat(parts[2].replace(',', '.'));
          durationSeconds = Math.round(h * 3600 + m * 60 + s);
        }
      } else if (lastSeg.offsets?.to) {
        // e.g. 315000 milliseconds
        durationSeconds = Math.round(lastSeg.offsets.to / 1000);
      }
    }
    
    if (durationSeconds > 0) {
      const h = Math.floor(durationSeconds / 3600);
      const m = Math.floor((durationSeconds % 3600) / 60);
      const s = durationSeconds % 60;
      duration = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // Step 2: Analyze
    broadcast('status', { step: 'analyzing', message: 'Running AI analysis...' });
    const { analysis, engine } = await analyze(transcription, duration, analysisEngine);

    // Attach metadata
    analysis.duration = analysis.duration || duration;
    analysis.duration_seconds = analysis.duration_seconds || durationSeconds;
    analysis.word_count = analysis.word_count || transcription.split(/\s+/).length;
    analysis._engine = engine;

    broadcast('status', { step: 'analyzed', message: `Analysis complete via ${engine}`, engine });

    // Step 3: Save to history
    let historyId = null;
    if (saveHistory) {
      historyId = history.saveTranscription({
        title: analysis.title,
        type: analysis.type,
        filename: fileName,
        duration,
        duration_seconds: durationSeconds,
        transcription,
        analysis,
        engine,
        whisper_model: whisperModel,
      });
    }

    // Step 4: Auto-save to Obsidian
    let obsidianPath = null;
    try {
      const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
      if (vaultPath && fs.existsSync(path.dirname(vaultPath))) {
        const result = obsidian.saveToVault(analysis, transcription);
        obsidianPath = result.path;
        broadcast('status', { step: 'obsidian_saved', message: `Saved to Obsidian: ${result.filename}` });
      }
    } catch (err) {
      console.warn('Obsidian auto-save failed:', err.message);
    }

    broadcast('status', { step: 'complete', message: 'Processing complete!' });

    res.json({
      success: true,
      id: historyId,
      transcription,
      analysis,
      engine,
      duration,
      obsidianPath,
    });

  } catch (err) {
    console.error('Pipeline error:', err);
    broadcast('status', { step: 'error', message: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
// History
// ==========================================================
router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const items = history.listTranscriptions(limit, offset);
  const total = history.getTranscriptionCount();
  res.json({ items, total });
});

router.get('/history/:id', (req, res) => {
  const item = history.getTranscription(parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.delete('/history/:id', (req, res) => {
  history.deleteTranscription(parseInt(req.params.id));
  res.json({ success: true });
});

// ==========================================================
// Export — Notion
// ==========================================================
router.post('/export/notion', async (req, res) => {
  try {
    const { analysis, databaseId } = req.body;
    if (!analysis || !databaseId) return res.status(400).json({ error: 'Missing analysis or databaseId' });

    const result = await notion.exportToNotion(analysis, databaseId);

    // Save to known databases list
    try {
      history.saveNotionDatabase(databaseId, analysis.title || 'Sonic Scribe Export');
    } catch { /* ignore */ }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Notion export error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/notion/databases', async (req, res) => {
  try {
    const remote = await notion.listDatabases();
    const saved = history.getNotionDatabases();
    res.json({ remote, saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notion/database', async (req, res) => {
  try {
    const { pageId, name } = req.body;
    if (!pageId) return res.status(400).json({ error: 'Missing pageId' });
    const result = await notion.createDatabase(pageId, name || 'Sonic Scribe Notes');
    // Save to known databases list
    try {
      history.saveNotionDatabase(result.id, result.title || name || 'Sonic Scribe Notes');
    } catch { /* ignore */ }
    res.json({ success: true, database: result });
  } catch (err) {
    console.error('Notion database creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
// Export — Obsidian
// ==========================================================
router.post('/export/obsidian', (req, res) => {
  try {
    const { analysis, transcription } = req.body;
    if (!analysis) return res.status(400).json({ error: 'Missing analysis' });

    const markdown = obsidian.getDownloadableMarkdown(analysis, transcription || '');
    const filename = `${(analysis.title || 'Untitled').replace(/[^a-zA-Z0-9\s-]/g, '').trim()}.md`;

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(markdown);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
// Export — Clipboard text
// ==========================================================
router.post('/export/clipboard', (req, res) => {
  try {
    const { analysis, transcription } = req.body;
    if (!analysis) return res.status(400).json({ error: 'Missing analysis' });

    // Generate clean text for clipboard
    let text = `# ${analysis.title || 'Untitled'}\n\n`;
    if (analysis.summary) text += `## Summary\n${analysis.summary}\n\n`;
    if (analysis.main_points?.length) text += `## Main Points\n${analysis.main_points.map(p => `• ${p}`).join('\n')}\n\n`;
    if (analysis.action_items?.length) {
      text += `## Action Items\n`;
      for (const item of analysis.action_items) {
        if (typeof item === 'string') text += `☐ ${item}\n`;
        else text += `☐ [${item.priority || 'medium'}] ${item.task}${item.assignee ? ` → ${item.assignee}` : ''}\n`;
      }
      text += '\n';
    }
    if (analysis.key_insights?.length) text += `## Key Insights\n${analysis.key_insights.map(i => `• ${i}`).join('\n')}\n\n`;
    if (analysis.follow_up_questions?.length) text += `## Follow-up Questions\n${analysis.follow_up_questions.map(q => `• ${q}`).join('\n')}\n\n`;
    if (analysis.references?.length) text += `## References\n${analysis.references.map(r => `• ${r}`).join('\n')}\n\n`;
    if (transcription) text += `## Transcript\n${transcription}\n`;

    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
// Settings
// ==========================================================
router.get('/settings', (req, res) => {
  const settings = history.getAllSettings();
  const models = getAvailableModels();
  res.json({ settings, whisperModels: models });
});

router.put('/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Missing key' });
  history.setSetting(key, value);
  res.json({ success: true });
});

// ==========================================================
// System Services
// ==========================================================
const UNSLOTH_BASE = process.env.UNSLOTH_URL || 'http://127.0.0.1:8888';
const IS_DOCKER = require('fs').existsSync('/.dockerenv');

router.get('/system/ai-status', async (req, res) => {
  try {
    const check = await fetch(`${UNSLOTH_BASE}/openapi.json`, { signal: AbortSignal.timeout(2000) });
    res.json({ online: check.ok });
  } catch (e) {
    res.json({ online: false });
  }
});

router.post('/system/ai-start', (req, res) => {
  if (IS_DOCKER) {
    // Can't spawn host processes from inside Docker — tell the frontend
    return res.status(400).json({ 
      success: false, 
      error: 'Cannot start Unsloth from inside Docker. Run on the host: unsloth studio -H 0.0.0.0 -p 8888' 
    });
  }

  const { spawn } = require('child_process');
  
  const aiProcess = spawn('/Users/bill/.unsloth/studio/unsloth_studio/bin/python', [
    '/Users/bill/.unsloth/studio/unsloth_studio/bin/unsloth',
    'studio',
    '-H', '0.0.0.0',
    '-p', '8888'
  ], {
    detached: true,
    stdio: 'ignore'
  });
  
  aiProcess.unref();

  res.json({ success: true });
});

module.exports = router;
