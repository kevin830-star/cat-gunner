import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { collectAllVoicePhrases, DEFAULT_STYLE, phraseFilename, VOICE_NAME } from '../voice-phrases.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const voicesDir = path.join(rootDir, 'voices');
const manifestPath = path.join(voicesDir, 'manifest.json');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY environment variable.');
  process.exit(1);
}

fs.mkdirSync(voicesDir, { recursive: true });
let manifest = { voice: VOICE_NAME, style: DEFAULT_STYLE, phrases: {} };
try {
  if (fs.existsSync(manifestPath)) {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (parsed && typeof parsed.phrases === 'object') manifest.phrases = parsed.phrases;
  }
} catch {
  // Start fresh manifest if unreadable
}

const ai = new GoogleGenAI({
  apiKey,
  apiVersion: 'v1beta',
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
});

const all = collectAllVoicePhrases(rootDir);
let generated = 0;
let skipped = 0;

for (let i = 0; i < all.length; i++) {
  const text = all[i];
  const file = phraseFilename(text);
  const outPath = path.join(voicesDir, file);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 44) {
    manifest.phrases[text] = file;
    skipped++;
    continue;
  }
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [{ role: 'user', parts: [{ text, speechMetadata: { style: DEFAULT_STYLE } }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error('Empty audio payload');
    fs.writeFileSync(outPath, Buffer.from(base64Audio, 'base64'));
    manifest.phrases[text] = file;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    generated++;
    console.log(`[${i + 1}/${all.length}] Saved ${file} (${text})`);
  } catch (err) {
    console.error(`[${i + 1}/${all.length}] Stopped on "${text}":`, err?.message || err);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    process.exit(1);
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Done! Total=${all.length}, Skipped=${skipped}, NewlyGenerated=${generated}`);
