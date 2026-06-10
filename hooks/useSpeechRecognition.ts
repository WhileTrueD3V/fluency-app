/**
 * Speech recognition hook — wraps expo-speech-recognition.
 *
 * For the dev-build / App Store version this uses the native OS speech APIs
 * (Apple Speech Framework on iOS, SpeechRecognizer on Android).
 *
 * NOTE: This requires a custom dev build (not Expo Go).
 * Run: npx expo run:ios  or  npx expo run:android
 *
 * Future upgrade paths:
 *  - OpenAI Whisper API  → much higher accuracy, language-agnostic
 *  - Azure Cognitive Services Speech → pronunciation scoring (phoneme-level)
 *  - Google Cloud Speech-to-Text → best for Asian languages
 */
import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import {
  useSpeechRecognitionEvent,
  ExpoSpeechRecognitionModule,
} from 'expo-speech-recognition';

export type RecognitionState = 'idle' | 'listening' | 'processing' | 'done' | 'error';
export type MicrophonePermissionState = 'unknown' | 'granted' | 'denied' | 'prompt';

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number; // 0–1
  isFinal: boolean;
}

export interface SpeechRecognitionOptions {
  continuous?: boolean;
}

export interface SpeechDeliveryMetrics {
  totalDurationMs: number;
  firstSpeechDelayMs: number | null;
  finalSegmentCount: number;
  interimUpdateCount: number;
  restartCount: number;
}

type WebSpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: {
        transcript: string;
        confidence?: number;
      };
    };
  };
};

type WebSpeechRecognitionErrorEvent = {
  error?: string;
  message?: string;
};

type WebSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: WebSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type WebSpeechRecognitionConstructor = new () => WebSpeechRecognition;

type WebSpeechGlobals = typeof globalThis & {
  SpeechRecognition?: WebSpeechRecognitionConstructor;
  webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
};

function microphoneBlockedMessage(): string {
  return 'Microphone permission is blocked. Click the browser site controls beside the address bar, allow microphone for localhost:8081, then try again.';
}

async function requestWebMicrophoneAccess(): Promise<boolean> {
  const mediaDevices = globalThis.navigator?.mediaDevices;
  if (!mediaDevices?.getUserMedia) return true;

  try {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

export function useSpeechRecognition(locale: string) {
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle');
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>('unknown');
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0.8);
  const [error, setError] = useState<string | null>(null);
  const onDoneRef = useRef<((result: SpeechRecognitionResult) => void) | null>(null);
  const transcriptRef = useRef('');
  const confidenceRef = useRef(0.8);
  const webRecognitionRef = useRef<WebSpeechRecognition | null>(null);
  const continuousRef = useRef(false);
  const manuallyStoppingRef = useRef(false);
  const completedRef = useRef(false);
  const startedAtRef = useRef(0);
  const firstResultAtRef = useRef<number | null>(null);
  const endedAtRef = useRef(0);
  const finalSegmentCountRef = useRef(0);
  const interimUpdateCountRef = useRef(0);
  const restartCountRef = useRef(0);
  const [deliveryMetrics, setDeliveryMetrics] = useState<SpeechDeliveryMetrics>({
    totalDurationMs: 0,
    firstSpeechDelayMs: null,
    finalSegmentCount: 0,
    interimUpdateCount: 0,
    restartCount: 0,
  });

  const buildDeliveryMetrics = useCallback((): SpeechDeliveryMetrics => {
    const startedAt = startedAtRef.current;
    const endedAt = endedAtRef.current || Date.now();
    const totalDurationMs = startedAt ? Math.max(0, endedAt - startedAt) : 0;
    return {
      totalDurationMs,
      firstSpeechDelayMs: startedAt && firstResultAtRef.current
        ? Math.max(0, firstResultAtRef.current - startedAt)
        : null,
      finalSegmentCount: finalSegmentCountRef.current,
      interimUpdateCount: interimUpdateCountRef.current,
      restartCount: restartCountRef.current,
    };
  }, []);

  const updateTranscript = useCallback((nextTranscript: string, nextConfidence: number) => {
    const cleanTranscript = nextTranscript.trim();
    if (!cleanTranscript) return;
    if (!firstResultAtRef.current) firstResultAtRef.current = Date.now();
    interimUpdateCountRef.current += 1;
    setTranscript(cleanTranscript);
    setConfidence(nextConfidence);
    transcriptRef.current = cleanTranscript;
    confidenceRef.current = nextConfidence;
  }, []);

  const completeRecognition = useCallback((finalTranscript: string, finalConfidence: number) => {
    if (completedRef.current) return;
    const cleanTranscript = finalTranscript.trim();
    if (!cleanTranscript) {
      setError('No speech detected. Try again in a quiet room.');
      setRecognitionState('error');
      return;
    }

    completedRef.current = true;
    endedAtRef.current = Date.now();
    setDeliveryMetrics(buildDeliveryMetrics());
    setTranscript(cleanTranscript);
    setConfidence(finalConfidence);
    transcriptRef.current = cleanTranscript;
    confidenceRef.current = finalConfidence;
    setRecognitionState('done');
    onDoneRef.current?.({
      transcript: cleanTranscript,
      confidence: finalConfidence,
      isFinal: true,
    });
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (Platform.OS === 'web') {
      const hasMicAccess = await requestWebMicrophoneAccess();
      setPermissionState(hasMicAccess ? 'granted' : 'denied');
      if (!hasMicAccess) setError(microphoneBlockedMessage());
      return hasMicAccess;
    }

    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    setPermissionState(granted ? 'granted' : 'denied');
    if (!granted) {
      setError('Microphone permission denied. Open system settings for this app and allow microphone and speech recognition.');
    }
    return granted;
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    const best = event.results[0];
    if (best) {
      if (event.isFinal) finalSegmentCountRef.current += 1;
      updateTranscript(best.transcript, best.confidence ?? 0.8);
      if (event.isFinal && !continuousRef.current) {
        completeRecognition(best.transcript, best.confidence ?? 0.8);
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setError(event.message ?? 'Speech recognition error');
    setRecognitionState('error');
  });

  useSpeechRecognitionEvent('end', () => {
    setRecognitionState((s) => {
      if (s !== 'listening' && s !== 'processing') return s;
      if (continuousRef.current && !manuallyStoppingRef.current) {
        return 'listening';
      }
      if (transcriptRef.current.trim()) {
        completeRecognition(transcriptRef.current, confidenceRef.current);
        return 'done';
      }
      return 'processing';
    });
  });

  const startListening = useCallback(
    async (
      onDone?: (result: SpeechRecognitionResult) => void,
      options?: SpeechRecognitionOptions,
    ) => {
      setTranscript('');
      transcriptRef.current = '';
      confidenceRef.current = 0.8;
      startedAtRef.current = Date.now();
      firstResultAtRef.current = null;
      endedAtRef.current = 0;
      finalSegmentCountRef.current = 0;
      interimUpdateCountRef.current = 0;
      restartCountRef.current = 0;
      setDeliveryMetrics({
        totalDurationMs: 0,
        firstSpeechDelayMs: null,
        finalSegmentCount: 0,
        interimUpdateCount: 0,
        restartCount: 0,
      });
      continuousRef.current = options?.continuous ?? false;
      manuallyStoppingRef.current = false;
      completedRef.current = false;
      setError(null);
      setRecognitionState('listening');
      onDoneRef.current = onDone ?? null;

      try {
        if (Platform.OS === 'web') {
          const webGlobals = globalThis as WebSpeechGlobals;
          const Recognition =
            webGlobals.SpeechRecognition ?? webGlobals.webkitSpeechRecognition;

          if (!Recognition) {
            setError('Speech recognition is not available in this browser.');
            setRecognitionState('error');
            return;
          }

          const hasMicAccess = await requestPermission();
          if (!hasMicAccess) {
            continuousRef.current = false;
            setError(microphoneBlockedMessage());
            setRecognitionState('error');
            return;
          }

          webRecognitionRef.current?.abort();
          const recognition = new Recognition();
          webRecognitionRef.current = recognition;
          recognition.lang = locale;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          recognition.continuous = continuousRef.current;
          recognition.onresult = (event) => {
            let latestTranscript = '';
            let latestConfidence = 0.8;
            let hasFinal = false;

            for (let i = 0; i < event.results.length; i += 1) {
              const result = event.results[i];
              const alternative = result[0];
              if (!alternative) continue;
              latestTranscript = `${latestTranscript} ${alternative.transcript}`.trim();
              latestConfidence = alternative.confidence ?? 0.8;
              if (result.isFinal) {
                hasFinal = true;
                finalSegmentCountRef.current += 1;
              }
            }

            if (!latestTranscript.trim()) return;
            updateTranscript(latestTranscript, latestConfidence);

            if (hasFinal && !continuousRef.current) {
              completeRecognition(latestTranscript, latestConfidence);
            }
          };
          recognition.onerror = (event) => {
            const message = event.error === 'not-allowed'
              ? microphoneBlockedMessage()
              : event.error === 'no-speech'
                ? 'No speech detected. Try again in a quiet room.'
                : event.message ?? 'Speech recognition error';
            continuousRef.current = false;
            setError(message);
            setRecognitionState('error');
          };
          recognition.onend = () => {
            if (manuallyStoppingRef.current) {
              completeRecognition(transcriptRef.current, confidenceRef.current);
              return;
            }
            if (continuousRef.current) {
              setRecognitionState('listening');
              globalThis.setTimeout(() => {
                try {
                  restartCountRef.current += 1;
                  recognition.start();
                } catch {
                  continuousRef.current = false;
                  setRecognitionState('idle');
                }
              }, 120);
              return;
            }
            setRecognitionState((s) => (s === 'listening' ? 'idle' : s));
          };
          recognition.start();
          return;
        }

        const granted = await requestPermission();
        if (!granted) {
          setRecognitionState('error');
          return;
        }

        ExpoSpeechRecognitionModule.start({
          lang: locale,
          interimResults: true,
          maxAlternatives: 1,
          continuous: continuousRef.current,
        });
      } catch (e) {
        setError('Could not start speech recognition');
        setRecognitionState('error');
      }
    },
    [completeRecognition, locale, requestPermission],
  );

  const stopListening = useCallback(() => {
    manuallyStoppingRef.current = true;
    continuousRef.current = false;

    if (Platform.OS === 'web') {
      endedAtRef.current = Date.now();
      setDeliveryMetrics(buildDeliveryMetrics());
      webRecognitionRef.current?.stop();
      setRecognitionState('processing');
      return;
    }

    endedAtRef.current = Date.now();
    setDeliveryMetrics(buildDeliveryMetrics());
    ExpoSpeechRecognitionModule.stop();
    setRecognitionState('processing');
  }, []);

  const reset = useCallback(() => {
    continuousRef.current = false;

    if (Platform.OS === 'web') {
      webRecognitionRef.current?.abort();
      webRecognitionRef.current = null;
    }

    manuallyStoppingRef.current = false;
    completedRef.current = false;
    setTranscript('');
    transcriptRef.current = '';
    setConfidence(0.8);
    confidenceRef.current = 0.8;
    startedAtRef.current = 0;
    firstResultAtRef.current = null;
    endedAtRef.current = 0;
    finalSegmentCountRef.current = 0;
    interimUpdateCountRef.current = 0;
    restartCountRef.current = 0;
    setDeliveryMetrics({
      totalDurationMs: 0,
      firstSpeechDelayMs: null,
      finalSegmentCount: 0,
      interimUpdateCount: 0,
      restartCount: 0,
    });
    setError(null);
    setRecognitionState('idle');
  }, []);

  return {
    recognitionState,
    transcript,
    confidence,
    deliveryMetrics,
    error,
    permissionState,
    startListening,
    stopListening,
    reset,
    requestPermission,
    isListening: recognitionState === 'listening',
    isProcessing: recognitionState === 'processing',
  };
}
