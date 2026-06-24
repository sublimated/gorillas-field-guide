// Thin client around kokoroWorker.ts: owns the (lazily-created) worker singleton, tracks model
// load status, and plays back generated audio. The worker is only spun up on the first call to
// speak() — nobody pays the ~80MB model download until they actually press the "speak" button.
// If that first press lands while the model is still loading, we remember it and fire it
// automatically the moment the model becomes ready, instead of dropping it on the floor.
import { useCallback, useEffect, useRef, useState } from 'react';

export type KokoroStatus = 'idle' | 'loading' | 'ready' | 'speaking' | 'error';

type WorkerMessage =
  | { status: 'device'; device: string }
  | { status: 'ready'; voices: unknown; device: string }
  | { status: 'error'; id?: number; error: string }
  | { status: 'complete'; id: number; audio: string };

type SpeakRequest = { phonemes: string; voice: string };

let worker: Worker | null = null;
let workerStatus: KokoroStatus = 'idle';
let workerError: string | null = null;
let queuedRequest: SpeakRequest | null = null;
const statusListeners = new Set<(status: KokoroStatus, error: string | null) => void>();
const pending = new Map<number, (audioUrl: string) => void>();
let nextId = 0;

function setWorkerStatus(status: KokoroStatus, error: string | null = null) {
  workerStatus = status;
  workerError = error;
  for (const listen of statusListeners) listen(status, error);
}

function sendSpeak(w: Worker, request: SpeakRequest, onAudio: (audioUrl: string) => void) {
  const id = nextId++;
  pending.set(id, onAudio);
  w.postMessage({ type: 'speak', id, phonemes: request.phonemes, voice: request.voice });
}

function ensureWorker(): Worker {
  if (worker) return worker;
  setWorkerStatus('loading');
  worker = new Worker(new URL('../workers/kokoroWorker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (e: MessageEvent<WorkerMessage>) => {
    const data = e.data;
    if (data.status === 'ready') {
      setWorkerStatus('ready');
      const request = queuedRequest;
      queuedRequest = null;
      if (request && worker) {
        sendSpeak(worker, request, (audioUrl) => playAudio(audioUrl));
      }
    } else if (data.status === 'error') {
      setWorkerStatus('error', data.error);
      if (data.id !== undefined) pending.delete(data.id);
    } else if (data.status === 'complete') {
      const resolve = pending.get(data.id);
      pending.delete(data.id);
      resolve?.(data.audio);
    }
  });
  worker.addEventListener('error', (e) => {
    setWorkerStatus('error', e.message);
  });
  return worker;
}

let sharedAudio: HTMLAudioElement | null = null;
function playAudio(audioUrl: string) {
  setWorkerStatus(workerStatus === 'error' ? workerStatus : 'ready');
  sharedAudio ??= new Audio();
  sharedAudio.src = audioUrl;
  void sharedAudio.play();
}

const DEFAULT_VOICE = 'af_heart';

export function useKokoroSpeak() {
  const [status, setStatus] = useState<KokoroStatus>(workerStatus);
  const [error, setError] = useState<string | null>(workerError);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const listen = (s: KokoroStatus, e: string | null) => {
      if (!mounted.current) return;
      setStatus(s);
      setError(e);
    };
    statusListeners.add(listen);
    return () => {
      mounted.current = false;
      statusListeners.delete(listen);
    };
  }, []);

  const speak = useCallback((phonemes: string, voice: string = DEFAULT_VOICE) => {
    const w = ensureWorker();
    if (workerStatus === 'loading' || workerStatus === 'idle') {
      queuedRequest = { phonemes, voice };
      return;
    }
    setWorkerStatus('speaking');
    sendSpeak(w, { phonemes, voice }, (audioUrl) => playAudio(audioUrl));
  }, []);

  return { status, error, speak };
}
