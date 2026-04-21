/**
 * Sonic Scribe v2 — Obsidian Service
 * Generates Obsidian-flavored markdown with YAML frontmatter
 */

const fs = require('fs');
const path = require('path');

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '/obsidian/Sonic Scribe';

/**
 * Generate Obsidian-compatible markdown from analysis
 */
function generateMarkdown(analysis, transcription = '') {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  const tags = (analysis.topics || []).map(t => t.replace(/\s+/g, '-').toLowerCase());

  let md = '';

  // YAML frontmatter
  md += '---\n';
  md += `title: "${(analysis.title || 'Untitled').replace(/"/g, '\\"')}"\n`;
  md += `date: ${dateStr}\n`;
  md += `time: "${timeStr}"\n`;
  md += `type: "${analysis.type || 'Voice Memo'}"\n`;
  md += `duration: "${analysis.duration || 'unknown'}"\n`;
  md += `engine: "${analysis._engine || 'unknown'}"\n`;
  md += `sentiment: "${analysis.sentiment?.overall || 'neutral'}"\n`;
  md += `confidence: ${analysis.confidence || 0}\n`;
  if (tags.length) md += `tags:\n${tags.map(t => `  - ${t}`).join('\n')}\n`;
  if (analysis.speakers?.length) md += `speakers:\n${analysis.speakers.map(s => `  - "${s}"`).join('\n')}\n`;
  md += `word_count: ${analysis.word_count || 0}\n`;
  md += '---\n\n';

  // Title
  md += `# ${analysis.title || 'Untitled Recording'}\n\n`;

  // Metadata callout
  md += '> [!info] Recording Details\n';
  md += `> **Type:** ${analysis.type || 'Unknown'} · **Duration:** ${analysis.duration || 'N/A'} · **Date:** ${dateStr}\n`;
  md += `> **Engine:** ${analysis._engine || 'N/A'} · **Confidence:** ${((analysis.confidence || 0) * 100).toFixed(0)}%\n`;
  if (analysis.sentiment?.overall) {
    const emoji = { positive: '😊', neutral: '😐', negative: '😟', mixed: '🤔' };
    md += `> **Sentiment:** ${emoji[analysis.sentiment.overall] || ''} ${analysis.sentiment.overall}`;
    if (analysis.sentiment.breakdown) md += ` — ${analysis.sentiment.breakdown}`;
    md += '\n';
  }
  md += '\n';

  // Summary
  if (analysis.summary) {
    md += '## Summary\n\n';
    md += `${analysis.summary}\n\n`;
  }

  // Key Insights
  if (analysis.key_insights?.length) {
    md += '## Key Insights\n\n';
    for (const insight of analysis.key_insights) {
      md += `- ${insight}\n`;
    }
    md += '\n';
  }

  // Main Points
  if (analysis.main_points?.length) {
    md += '## Main Points\n\n';
    for (const point of analysis.main_points) {
      md += `- ${point}\n`;
    }
    md += '\n';
  }

  // Action Items
  if (analysis.action_items?.length) {
    md += '## Action Items\n\n';
    for (const item of analysis.action_items) {
      if (typeof item === 'string') {
        md += `- [ ] ${item}\n`;
      } else {
        const priority = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢';
        md += `- [ ] ${priority} ${item.task}`;
        if (item.assignee) md += ` → *${item.assignee}*`;
        md += '\n';
      }
    }
    md += '\n';
  }

  // Decisions Made
  if (analysis.decisions_made?.length) {
    md += '## Decisions Made\n\n';
    for (const decision of analysis.decisions_made) {
      md += `- ✅ ${decision}\n`;
    }
    md += '\n';
  }

  // Follow-up Questions
  if (analysis.follow_up_questions?.length) {
    md += '## Follow-up Questions\n\n';
    for (const q of analysis.follow_up_questions) {
      md += `- ❓ ${q}\n`;
    }
    md += '\n';
  }

  // Arguments
  if (analysis.arguments) {
    const args = analysis.arguments;
    if (args.for?.length || args.against?.length || args.unresolved?.length) {
      md += '## Arguments\n\n';
      if (args.for?.length) {
        md += '### For\n';
        for (const a of args.for) md += `- 👍 ${a}\n`;
        md += '\n';
      }
      if (args.against?.length) {
        md += '### Against\n';
        for (const a of args.against) md += `- 👎 ${a}\n`;
        md += '\n';
      }
      if (args.unresolved?.length) {
        md += '### Unresolved\n';
        for (const a of args.unresolved) md += `- ⚖️ ${a}\n`;
        md += '\n';
      }
    }
  }

  // Stories & Examples
  if (analysis.stories_examples?.length) {
    md += '## Stories & Examples\n\n';
    for (const story of analysis.stories_examples) {
      md += `- ${story}\n`;
    }
    md += '\n';
  }

  // References
  if (analysis.references?.length) {
    md += '## References\n\n';
    for (const ref of analysis.references) {
      md += `- ${ref}\n`;
    }
    md += '\n';
  }

  // Full Transcript (collapsible)
  if (transcription) {
    md += '## Transcript\n\n';
    md += '> [!note]- Full Transcript (click to expand)\n';
    const lines = transcription.split('\n');
    for (const line of lines) {
      md += `> ${line}\n`;
    }
    md += '\n';
  }

  return md;
}

/**
 * Save markdown to Obsidian vault
 */
function saveToVault(analysis, transcription = '') {
  const now = new Date();
  const year = now.getFullYear().toString();
  const monthNum = (now.getMonth() + 1).toString().padStart(2, '0');
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = monthNames[now.getMonth()];
  const monthDir = `${monthNum}-${monthName}`;

  const dir = path.join(VAULT_PATH, year, monthDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Create safe filename
  const title = (analysis.title || 'Untitled')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
  const dateStr = now.toISOString().split('T')[0];
  const filename = `${dateStr} ${title}.md`;
  const filepath = path.join(dir, filename);

  const markdown = generateMarkdown(analysis, transcription);
  fs.writeFileSync(filepath, markdown, 'utf-8');

  console.log(`Obsidian note saved: ${filepath}`);
  return { path: filepath, filename };
}

/**
 * Generate downloadable markdown (doesn't save to vault)
 */
function getDownloadableMarkdown(analysis, transcription = '') {
  return generateMarkdown(analysis, transcription);
}

module.exports = { generateMarkdown, saveToVault, getDownloadableMarkdown };
