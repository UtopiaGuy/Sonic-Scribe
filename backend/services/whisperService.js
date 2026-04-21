/**
 * Sonic Scribe v2 — Whisper Service
 * Local whisper.cpp integration for audio transcription
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// Model configs: name → { file, description }
const MODELS = {
  'tiny.en':  { file: 'ggml-tiny.en.bin',  label: '⚡ Fast',       desc: 'Quick notes, clear audio' },
  'base.en':  { file: 'ggml-base.en.bin',  label: '⚖️ Medium',    desc: 'General use' },
  'large-v3': { file: 'ggml-large-v3.bin',  label: '🔥 Full Power', desc: 'Long recordings, noisy audio' },
};

const WHISPER_DIR = path.join(__dirname, '../whisper');
const MODELS_DIR = path.join(WHISPER_DIR, 'models');

/**
 * Download a whisper model if not already present
 */
async function ensureModel(modelName) {
  const model = MODELS[modelName];
  if (!model) throw new Error(`Unknown model: ${modelName}. Available: ${Object.keys(MODELS).join(', ')}`);

  const modelPath = path.join(MODELS_DIR, model.file);
  if (fs.existsSync(modelPath)) return modelPath;

  // Create models directory
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

  // Download model from Hugging Face
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${model.file}`;
  console.log(`Downloading whisper model: ${modelName} from ${url}...`);

  return new Promise((resolve, reject) => {
    const curlArgs = ['-L', '-o', modelPath, '--progress-bar', url];
    const proc = execFile('curl', curlArgs, { maxBuffer: 1024 * 1024 * 10 }, (err) => {
      if (err) {
        // Clean up partial download
        if (fs.existsSync(modelPath)) fs.unlinkSync(modelPath);
        reject(new Error(`Failed to download model ${modelName}: ${err.message}`));
      } else {
        console.log(`Model ${modelName} downloaded successfully`);
        resolve(modelPath);
      }
    });
  });
}

/**
 * Ensure whisper binary is available
 * Uses the whisper-cli binary compiled in the Docker container
 */
function getWhisperBinary() {
  // Check for binary in container
  const containerBin = '/usr/local/bin/whisper-cli';
  if (fs.existsSync(containerBin)) return containerBin;

  // Check for binary in whisper directory
  const localBin = path.join(WHISPER_DIR, 'build/bin/whisper-cli');
  if (fs.existsSync(localBin)) return localBin;

  // Check PATH
  const which = require('child_process').execSync('which whisper-cli 2>/dev/null || which whisper 2>/dev/null || echo ""').toString().trim();
  if (which) return which;

  throw new Error('whisper-cli binary not found. Ensure whisper.cpp is compiled and in PATH.');
}

/**
 * Transcribe audio file using local whisper.cpp
 * @param {string} audioPath - Path to audio file
 * @param {string} modelName - Model name (tiny.en, base.en, large-v3)
 * @param {function} onProgress - Progress callback
 * @returns {Promise<{text: string, segments: Array}>}
 */
async function transcribe(audioPath, modelName = 'base.en', onProgress = null) {
  const modelPath = await ensureModel(modelName);
  const whisperBin = getWhisperBinary();

  // Convert audio to WAV 16kHz mono if needed (whisper requirement)
  const wavPath = audioPath.replace(/\.[^.]+$/, '.wav');
  if (!audioPath.endsWith('.wav') || true) {
    await new Promise((resolve, reject) => {
      const ffmpegArgs = ['-i', audioPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-y', wavPath];
      if (onProgress) onProgress({ step: 'converting', message: 'Converting audio format...' });
      execFile('ffmpeg', ffmpegArgs, { maxBuffer: 1024 * 1024 * 50 }, (err) => {
        if (err) reject(new Error(`ffmpeg conversion failed: ${err.message}`));
        else resolve();
      });
    });
  }

  // Run whisper
  return new Promise((resolve, reject) => {
    if (onProgress) onProgress({ step: 'transcribing', message: `Transcribing with ${MODELS[modelName].label}...` });

    const args = [
      '-m', modelPath,
      '-f', wavPath,
      '--output-json',
      '--output-file', wavPath.replace('.wav', ''),
      '-l', 'en',
      '--print-progress',
    ];

    const proc = execFile(whisperBin, args, {
      maxBuffer: 1024 * 1024 * 50,
      timeout: 600000, // 10 min timeout
    }, (err, stdout, stderr) => {
      // Clean up wav if we converted it
      if (wavPath !== audioPath && fs.existsSync(wavPath)) {
        try { fs.unlinkSync(wavPath); } catch (e) { /* ignore */ }
      }

      if (err) {
        reject(new Error(`Whisper transcription failed: ${err.message}\n${stderr}`));
        return;
      }

      // Read JSON output
      const jsonPath = wavPath.replace('.wav', '.json');
      try {
        if (fs.existsSync(jsonPath)) {
          const result = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
          const text = result.transcription
            ? result.transcription.map(s => s.text).join(' ').trim()
            : stdout.trim();
          const segments = result.transcription || [];

          // Clean up json output
          try { fs.unlinkSync(jsonPath); } catch (e) { /* ignore */ }

          resolve({ text, segments });
        } else {
          // Fallback: parse stdout
          resolve({ text: stdout.trim(), segments: [] });
        }
      } catch (parseErr) {
        resolve({ text: stdout.trim(), segments: [] });
      }
    });

    // Stream stderr for progress
    if (proc.stderr && onProgress) {
      proc.stderr.on('data', (data) => {
        const line = data.toString();
        const progressMatch = line.match(/(\d+)%/);
        if (progressMatch) {
          onProgress({ step: 'transcribing', progress: parseInt(progressMatch[1]), message: `Transcribing... ${progressMatch[1]}%` });
        }
      });
    }
  });
}

/**
 * Get available models and their status
 */
function getAvailableModels() {
  return Object.entries(MODELS).map(([name, info]) => ({
    name,
    label: info.label,
    description: info.desc,
    downloaded: fs.existsSync(path.join(MODELS_DIR, info.file)),
    file: info.file,
  }));
}

module.exports = { transcribe, getAvailableModels, ensureModel, MODELS };
