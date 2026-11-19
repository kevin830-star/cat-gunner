import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  collectAllVoicePhrases,
  DEFAULT_STYLE,
  phraseFilename,
  VOICE_NAME,
} from './voice-phrases.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '16kb' }));

const TTS_MODELS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
const VOICES_DIR = path.join(__dirname, 'voices');
const MANIFEST_PATH = path.join(VOICES_DIR, 'manifest.json');
const DISK_CACHE_DIR = path.join(__dirname, '.tts-cache');

for (const dir of [VOICES_DIR, DISK_CACHE_DIR]) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // Ignore read-only errors
  }
}

let ALL_VOICE_PHRASES = [];
try {
  ALL_VOICE_PHRASES = collectAllVoicePhrases(__dirname);
} catch (err) {
  console.warn('[Voices] Failed to collect voice phrases:', err?.message || err);
}
const manifest = { voice: VOICE_NAME, style: DEFAULT_STYLE, phrases: {} };

function syncManifestFromDisk() {
  let changed = false;
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      if (parsed && typeof parsed.phrases === 'object') {
        Object.assign(manifest.phrases, parsed.phrases);
      }
    } else {
      changed = true;
    }
  } catch {
    changed = true;
  }
  for (const text of ALL_VOICE_PHRASES) {
    const file = phraseFilename(text);
    const full = path.join(VOICES_DIR, file);
    try {
      if (fs.existsSync(full) && fs.statSync(full).size > 44) {
        if (manifest.phrases[text] !== file) {
          manifest.phrases[text] = file;
          changed = true;
        }
      } else if (text in manifest.phrases) {
        delete manifest.phrases[text];
        changed = true;
      }
    } catch {
      // Ignore individual file stat errors
    }
  }
  if (changed) saveManifest();
}

function saveManifest() {
  try {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  } catch {
    // Ignore disk write errors
  }
}

syncManifestFromDisk();

let aiClient = null;
let cachedApiKey = null;
const modelCooldowns = new Map();
let quotaKeyFingerprint = '';
let lastRetryAfterSeconds = 0;

function keyFingerprint(apiKey) {
  return crypto.createHash('sha256').update(String(apiKey || '')).digest('hex').slice(0, 12);
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    modelCooldowns.clear();
    quotaKeyFingerprint = '';
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
const MAX_TTS_CACHE = 300;

function cacheHash(cacheKey) {
  return crypto.createHash('sha256').update(cacheKey).digest('hex');
}

function getCachedWav(cacheKey, text, style) {
  const mem = ttsCache.get(cacheKey);
  if (mem) {
    ttsCache.delete(cacheKey);
    ttsCache.set(cacheKey, mem);
    return mem;
  }
  try {
    if (style === DEFAULT_STYLE) {
      const voiceFile = path.join(VOICES_DIR, phraseFilename(text));
      if (fs.existsSync(voiceFile)) {
        const buf = fs.readFileSync(voiceFile);
        if (buf.length > 44) {
          putCache(cacheKey, buf, text, style, false);
          return buf;
        }
      }
    }
    const file = path.join(DISK_CACHE_DIR, `${cacheHash(cacheKey)}.wav`);
    if (fs.existsSync(file)) {
      const buf = fs.readFileSync(file);
      if (buf.length > 44) {
        putCache(cacheKey, buf, text, style, false);
        return buf;
      }
    }
  } catch {
    // Ignore disk cache read errors
  }
  return null;
}

function putCache(cacheKey, buf, text, style, persist = true) {
  if (ttsCache.has(cacheKey)) ttsCache.delete(cacheKey);
  ttsCache.set(cacheKey, buf);
  if (ttsCache.size > MAX_TTS_CACHE) {
    const oldest = ttsCache.keys().next().value;
    ttsCache.delete(oldest);
  }
  if (persist) {
    try {
      if (style === DEFAULT_STYLE) {
        const file = phraseFilename(text);
        fs.writeFileSync(path.join(VOICES_DIR, file), buf);
        manifest.phrases[text] = file;
        saveManifest();
      } else {
        const file = path.join(DISK_CACHE_DIR, `${cacheHash(cacheKey)}.wav`);
        fs.writeFileSync(file, buf);
      }
    } catch {
      // Ignore disk cache write errors
    }
  }
}

function parseGeminiError(err) {
  let status = Number(err?.status) || 0;
  let apiStatus = '';
  let rawMessage = String(err?.message || '');
  let retryAfterSeconds = 0;
  let quotaIds = [];

  try {
    const parsed = JSON.parse(rawMessage);
    const inner = parsed?.error || parsed;
    if (!status && Number(inner?.code)) status = Number(inner.code);
    if (inner?.status) apiStatus = String(inner.status);
    if (inner?.message) rawMessage = String(inner.message);
    const details = Array.isArray(inner?.details) ? inner.details : [];
    for (const d of details) {
      if (d?.retryDelay) {
        const m = String(d.retryDelay).match(/(\d+)/);
        if (m) retryAfterSeconds = Number(m[1]) || 0;
      }
      if (Array.isArray(d?.violations)) {
        for (const v of d.violations) {
          if (v?.quotaId) quotaIds.push(String(v.quotaId));
        }
      }
    }
  } catch {
    // rawMessage is not JSON
  }

  const quotaStr = `${quotaIds.join(',')} ${rawMessage}`;
  const isDailyQuota = /PerDay|daily/i.test(quotaStr);

  if (status === 429 || apiStatus === 'RESOURCE_EXHAUSTED' || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      retryAfterSeconds,
      isDailyQuota,
      quotaIds,
      detail: rawMessage.slice(0, 240),
      message: isDailyQuota
        ? '今日免费语音额度已用完（429），请在 Settings > Secrets 中切换已启用结算的 API 密钥后重试预生成。'
        : `触发语音接口每分钟速率限制（429），需等待 ${retryAfterSeconds || 60} 秒后继续。`,
    };
  }
  if (status === 403 || apiStatus === 'PERMISSION_DENIED' || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: status || 403,
      code: apiStatus || 'PERMISSION_DENIED',
      retryAfterSeconds: 0,
      isDailyQuota: false,
      quotaIds,
      detail: rawMessage.slice(0, 240),
      message: '语音 API 密钥无效或权限不足，请在 Settings > Secrets 中检查并更新 API 密钥。',
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 502,
    code: apiStatus || 'TTS_UPSTREAM_ERROR',
    retryAfterSeconds: 0,
    isDailyQuota: false,
    quotaIds,
    detail: rawMessage.slice(0, 240),
    message: rawMessage || '语音合成请求失败，请稍后重试。',
  };
}

async function synthesizeAndCache(text, style, { bypassCooldown = false } = {}) {
  const cacheKey = `${VOICE_NAME}|${style}|${text}`;
  const hit = getCachedWav(cacheKey, text, style);
  if (hit) return { buf: hit, fromCache: true };

  const ai = getGeminiClient();
  if (!ai) {
    const err = new Error('GEMINI_API_KEY 未配置，请在 Settings > Secrets 中配置 API 密钥。');
    err.status = 503;
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const fp = keyFingerprint(process.env.GEMINI_API_KEY);
  if (quotaKeyFingerprint !== fp) {
    modelCooldowns.clear();
    quotaKeyFingerprint = fp;
  }

  let task = ttsInFlight.get(cacheKey);
  if (!task) {
    task = (async () => {
      const now = Date.now();
      let lastErr = null;
      for (const model of TTS_MODELS) {
        const cdUntil = modelCooldowns.get(model) || 0;
        if (!bypassCooldown && now < cdUntil) continue;
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [{ text, speechMetadata: { style } }],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
              },
            },
          });
          const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (!base64Audio) throw new Error(`${model} returned no audio data.`);
          const wavBuffer = Buffer.from(base64Audio, 'base64');
          putCache(cacheKey, wavBuffer, text, style, true);
          return wavBuffer;
        } catch (err) {
          const info = parseGeminiError(err);
          lastErr = info;
          if (info.status === 429) {
            lastRetryAfterSeconds = info.retryAfterSeconds;
            modelCooldowns.set(model, Date.now() + 60_000);
            console.warn(`[TTS Quota 429] ${model}: ${info.code} (retry ~${info.retryAfterSeconds || 60}s)`);
            continue;
          }
          console.warn(`[TTS Error ${info.status}] ${model}: ${info.message}`);
          // 若备用模型遇到权限/不支持，继续抛出；若是主模型429已跳过，备用失败则停止
          const wrapped = new Error(info.message);
          wrapped.status = info.status;
          wrapped.code = info.code;
          wrapped.retryAfterSeconds = info.retryAfterSeconds;
          wrapped.isDailyQuota = info.isDailyQuota;
          wrapped.quotaIds = info.quotaIds;
          wrapped.detail = info.detail;
          throw wrapped;
        }
      }
      const info = lastErr || {
        status: 429,
        code: 'RESOURCE_EXHAUSTED',
        retryAfterSeconds: lastRetryAfterSeconds || 60,
        isDailyQuota: false,
        quotaIds: [],
        detail: '',
        message: '语音接口限流（429），请稍后重试。',
      };
      const wrapped = new Error(info.message);
      wrapped.status = info.status;
      wrapped.code = info.code;
      wrapped.retryAfterSeconds = info.retryAfterSeconds;
      wrapped.isDailyQuota = info.isDailyQuota;
      wrapped.quotaIds = info.quotaIds;
      wrapped.detail = info.detail;
      throw wrapped;
    })().finally(() => {
      ttsInFlight.delete(cacheKey);
    });
    ttsInFlight.set(cacheKey, task);
  }

  const buf = await task;
  return { buf, fromCache: false };
}

function getArchiveStats() {
  let cached = 0;
  for (const text of ALL_VOICE_PHRASES) {
    if (manifest.phrases[text]) cached++;
  }
  return {
    total: ALL_VOICE_PHRASES.length,
    cached,
    remaining: ALL_VOICE_PHRASES.length - cached,
    hasKey: Boolean(process.env.GEMINI_API_KEY),
    manifestUrl: '/voices/manifest.json',
  };
}

let pregenPromise = null;

app.get('/api/tts/status', (_req, res) => {
  res.json({ ...getArchiveStats(), inProgress: Boolean(pregenPromise) });
});

app.post('/api/tts/pregenerate', async (_req, res) => {
  if (pregenPromise) {
    const result = await pregenPromise;
    return res.status(result.errorStatus || 200).json(result.payload);
  }

  pregenPromise = (async () => {
    const missing = ALL_VOICE_PHRASES.filter(text => !manifest.phrases[text]);
    if (!missing.length) {
      return { payload: { ...getArchiveStats(), generated: 0, done: true } };
    }
    let generated = 0;
    let errorInfo = null;
    const concurrency = 1;
    let idx = 0;

    async function worker() {
      let rpmWaitCount = 0;
      while (!errorInfo) {
        const i = idx++;
        if (i >= missing.length) break;
        const text = missing[i];
        try {
          const { fromCache } = await synthesizeAndCache(text, DEFAULT_STYLE, { bypassCooldown: i === 0 });
          if (!fromCache) generated++;
          rpmWaitCount = 0;
        } catch (err) {
          if (err?.status === 429 && !err?.isDailyQuota && rpmWaitCount < 3) {
            rpmWaitCount++;
            const waitSec = Math.min(Math.max(Number(err?.retryAfterSeconds) || 62, 10), 70);
            console.warn(`[TTS Pregen] RPM limit hit on "${text}", waiting ${waitSec}s (retry ${rpmWaitCount}/3)...`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
            modelCooldowns.clear();
            idx--;
            continue;
          }
          errorInfo = {
            status: err?.status || 502,
            code: err?.code || 'TTS_UPSTREAM_ERROR',
            isDailyQuota: Boolean(err?.isDailyQuota),
            quotaIds: err?.quotaIds || [],
            detail: err?.detail || '',
            message: err?.message || '预生成失败',
          };
          break;
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, () => worker()));
    const stats = getArchiveStats();
    if (errorInfo) {
      return {
        errorStatus: errorInfo.status,
        payload: {
          ...stats,
          generated,
          done: false,
          code: errorInfo.code,
          isDailyQuota: errorInfo.isDailyQuota,
          quotaIds: errorInfo.quotaIds,
          detail: errorInfo.detail,
          error: errorInfo.message,
        },
      };
    }
    return {
      payload: {
        ...stats,
        generated,
        done: true,
      },
    };
  })().finally(() => {
    pregenPromise = null;
  });

  const result = await pregenPromise;
  return res.status(result.errorStatus || 200).json(result.payload);
});

app.post('/api/tts', async (req, res) => {
  const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const text = rawText.slice(0, 300);
  if (!text) {
    return res.status(400).json({ error: 'Text is required for speech synthesis.' });
  }
  const style = typeof req.body?.style === 'string' && req.body.style.trim()
    ? req.body.style.trim().slice(0, 160)
    : DEFAULT_STYLE;

  try {
    const { buf } = await synthesizeAndCache(text, style);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(buf);
  } catch (err) {
    return res.status(err?.status || 502).json({
      error: err?.message || '语音合成请求失败，请稍后重试。',
      code: err?.code || 'TTS_UPSTREAM_ERROR',
      retryAfterSeconds: err?.retryAfterSeconds || undefined,
    });
  }
});

app.use((req, res, next) => {
  if (
    req.path === '/server.js' ||
    req.path === '/voice-phrases.js' ||
    req.path === '/package.json' ||
    req.path === '/package-lock.json' ||
    req.path === '/metadata.json' ||
    req.path.startsWith('/scripts/') ||
    req.path.startsWith('/.')
  ) {
    return res.status(404).end();
  }
  return next();
});

app.use(express.static(__dirname));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});

server.on('error', (err) => {
  console.error('[Server Error]', err);
  process.exit(1);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
