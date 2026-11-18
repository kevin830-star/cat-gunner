import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '16kb' }));

const TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const DEFAULT_STYLE = '自然明媚、元气亲切的年轻女声，标准普通话，吐字清晰温暖，像活泼可爱的少女老师';
const VOICE_NAME = 'Zephyr';

let aiClient = null;
let cachedApiKey = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    aiClient = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

const ttsCache = new Map();
const ttsInFlight = new Map();
const MAX_TTS_CACHE = 200;

function putCache(key, buf) {
  if (ttsCache.has(key)) ttsCache.delete(key);
  ttsCache.set(key, buf);
  if (ttsCache.size > MAX_TTS_CACHE) {
    const oldest = ttsCache.keys().next().value;
    ttsCache.delete(oldest);
  }
}

app.post('/api/tts', async (req, res) => {
  const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const text = rawText.slice(0, 300);
  if (!text) {
    return res.status(400).json({ error: 'Text is required for speech synthesis.' });
  }
  const style = typeof req.body?.style === 'string' && req.body.style.trim()
    ? req.body.style.trim().slice(0, 160)
    : DEFAULT_STYLE;

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured. Please check Settings > Secrets.',
    });
  }

  const cacheKey = `${VOICE_NAME}|${style}|${text}`;
  const hit = ttsCache.get(cacheKey);
  if (hit) {
    putCache(cacheKey, hit);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(hit);
  }

  try {
    let task = ttsInFlight.get(cacheKey);
    if (!task) {
      task = (async () => {
        const response = await ai.models.generateContent({
          model: TTS_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text,
                  speechMetadata: { style },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: VOICE_NAME },
              },
            },
          },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          throw new Error('Gemini TTS returned no audio data.');
        }
        const wavBuffer = Buffer.from(base64Audio, 'base64');
        putCache(cacheKey, wavBuffer);
        return wavBuffer;
      })().finally(() => {
        ttsInFlight.delete(cacheKey);
      });
      ttsInFlight.set(cacheKey, task);
    }

    const wavBuffer = await task;
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(wavBuffer);
  } catch (err) {
    console.error('[TTS Error]', err);
    const status = Number(err?.status) >= 400 && Number(err?.status) < 600 ? Number(err.status) : 502;
    return res.status(status).json({
      error: err?.message || 'Speech synthesis request failed.',
    });
  }
});

app.use((req, res, next) => {
  if (req.path === '/server.js' || req.path === '/package.json' || req.path === '/package-lock.json' || req.path === '/metadata.json' || req.path.startsWith('/.')) {
    return res.status(404).end();
  }
  return next();
});

app.use(express.static(__dirname));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
