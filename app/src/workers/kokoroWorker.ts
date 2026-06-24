// Runs Kokoro entirely off the main thread: model load (first call only, ~80MB, cached by the
// browser after that) and audio generation both happen here.
//
// We deliberately do NOT call `tts.generate(text, ...)` — that runs the model's built-in English
// phonemizer, which would mangle our invented spell names the same way any generic TTS would.
// Instead we tokenize our own hand-authored phoneme string (see ../engines/soundIpa.ts) and call
// `tts.generate_from_ids` directly, so the model speaks exactly the phonemes we built.
import { KokoroTTS } from 'kokoro-js';

type VoiceId = Parameters<KokoroTTS['generate']>[1] extends { voice?: infer V } ? V : never;

type SpeakRequest = { type: 'speak'; id: number; phonemes: string; voice: VoiceId };

async function detectWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (!gpu) return false;
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

const device = (await detectWebGPU()) ? 'webgpu' : 'wasm';
self.postMessage({ status: 'device', device });

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const tts = await KokoroTTS.from_pretrained(MODEL_ID, {
  dtype: device === 'wasm' ? 'q8' : 'fp32',
  device,
}).catch((e: unknown) => {
  self.postMessage({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  throw e;
});

self.postMessage({ status: 'ready', voices: tts.voices, device });

self.addEventListener('message', async (e: MessageEvent<SpeakRequest>) => {
  const { id, phonemes, voice } = e.data;
  try {
    const { input_ids } = tts.tokenizer(phonemes, { truncation: true });
    const audio = await tts.generate_from_ids(input_ids, { voice });
    const blob = audio.toBlob();
    self.postMessage({ status: 'complete', id, audio: URL.createObjectURL(blob) });
  } catch (err) {
    self.postMessage({ status: 'error', id, error: err instanceof Error ? err.message : String(err) });
  }
});
