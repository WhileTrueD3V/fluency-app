import { useCallback, useRef, useState } from 'react';
import type {
  MicrophonePermissionState,
  RecognitionState,
  SpeechDeliveryMetrics,
  SpeechRecognitionOptions,
  SpeechRecognitionResult,
} from './useSpeechRecognition';

type WebSpeechRecognitionEvent = {
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
  return 'Microphone permission is blocked. Click the browser site controls beside the address bar, allow microphone for localhost, then try again.';
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

const emptyMetrics: SpeechDeliveryMetrics = {
  totalDurationMs: 0,
  firstSpeechDelayMs: null,
  finalSegmentCount: 0,
  interimUpdateCount: 0,
  restartCount: 0,
};

export function useSpeechRecognition(locale: string) {
  const [recognitionState, setRecognitionState] = useState<RecognitionState>('idle');
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>('unknown');
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0.8);
  const [error, setError] = useState<string | null>(null);
  const [deliveryMetrics, setDeliveryMetrics] = useState<SpeechDeliveryMetrics>(emptyMetrics);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const confidenceRef = useRef(0.8);
  const onDoneRef = useRef<((result: SpeechRecognitionResult) => void) | null>(null);
  const continuousRef = useRef(false);
  const manuallyStoppingRef = useRef(false);
  const startedAtRef = useRef(0);
  const firstResultAtRef = useRef<number | null>(null);
  const finalSegmentCountRef = useRef(0);
  const interimUpdateCountRef = useRef(0);
  const restartCountRef = useRef(0);

  const buildMetrics = useCallback((): SpeechDeliveryMetrics => ({
    totalDurationMs: startedAtRef.current ? Date.now() - startedAtRef.current : 0,
    firstSpeechDelayMs: startedAtRef.current && firstResultAtRef.current
      ? firstResultAtRef.current - startedAtRef.current
      : null,
    finalSegmentCount: finalSegmentCountRef.current,
    interimUpdateCount: interimUpdateCountRef.current,
    restartCount: restartCountRef.current,
  }), []);

  const complete = useCallback((nextTranscript: string, nextConfidence: number) => {
    const cleanTranscript = nextTranscript.trim();
    if (!cleanTranscript) {
      setError('No speech detected. Try again in a quiet room.');
      setRecognitionState('error');
      return;
    }

    setDeliveryMetrics(buildMetrics());
    setTranscript(cleanTranscript);
    setConfidence(nextConfidence);
    setRecognitionState('done');
    onDoneRef.current?.({
      transcript: cleanTranscript,
      confidence: nextConfidence,
      isFinal: true,
    });
  }, [buildMetrics]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setError(null);
    const hasMicAccess = await requestWebMicrophoneAccess();
    setPermissionState(hasMicAccess ? 'granted' : 'denied');
    if (!hasMicAccess) setError(microphoneBlockedMessage());
    return hasMicAccess;
  }, []);

  const startListening = useCallback(async (
    onDone?: (result: SpeechRecognitionResult) => void,
    options?: SpeechRecognitionOptions,
  ) => {
    const webGlobals = globalThis as WebSpeechGlobals;
    const Recognition = webGlobals.SpeechRecognition ?? webGlobals.webkitSpeechRecognition;

    setError(null);
    setTranscript('');
    transcriptRef.current = '';
    confidenceRef.current = 0.8;
    onDoneRef.current = onDone ?? null;
    continuousRef.current = options?.continuous ?? false;
    manuallyStoppingRef.current = false;
    startedAtRef.current = Date.now();
    firstResultAtRef.current = null;
    finalSegmentCountRef.current = 0;
    interimUpdateCountRef.current = 0;
    restartCountRef.current = 0;
    setDeliveryMetrics(emptyMetrics);

    if (!Recognition) {
      setError('Speech recognition is not available in this browser.');
      setRecognitionState('error');
      return;
    }

    const hasMicAccess = await requestPermission();
    if (!hasMicAccess) {
      setRecognitionState('error');
      return;
    }

    try {
      recognitionRef.current?.abort();
      const recognition = new Recognition();
      recognitionRef.current = recognition;
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
          hasFinal = hasFinal || result.isFinal;
        }

        if (!latestTranscript) return;
        if (!firstResultAtRef.current) firstResultAtRef.current = Date.now();
        interimUpdateCountRef.current += 1;
        if (hasFinal) finalSegmentCountRef.current += 1;
        transcriptRef.current = latestTranscript;
        confidenceRef.current = latestConfidence;
        setTranscript(latestTranscript);
        setConfidence(latestConfidence);

        if (hasFinal && !continuousRef.current) complete(latestTranscript, latestConfidence);
      };
      recognition.onerror = (event) => {
        const message = event.error === 'not-allowed'
          ? microphoneBlockedMessage()
          : event.error === 'no-speech'
            ? 'No speech detected. Try again in a quiet room.'
            : event.message ?? 'Speech recognition error';
        setError(message);
        setRecognitionState('error');
      };
      recognition.onend = () => {
        if (manuallyStoppingRef.current) {
          complete(transcriptRef.current, confidenceRef.current);
          return;
        }
        if (continuousRef.current) {
          restartCountRef.current += 1;
          try {
            recognition.start();
          } catch {
            setRecognitionState('idle');
          }
          return;
        }
        setRecognitionState((current) => (current === 'listening' ? 'idle' : current));
      };
      setRecognitionState('listening');
      recognition.start();
    } catch {
      setError('Could not start speech recognition.');
      setRecognitionState('error');
    }
  }, [complete, locale, requestPermission]);

  const stopListening = useCallback(() => {
    manuallyStoppingRef.current = true;
    continuousRef.current = false;
    setDeliveryMetrics(buildMetrics());
    setRecognitionState('processing');
    recognitionRef.current?.stop();
  }, [buildMetrics]);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    continuousRef.current = false;
    manuallyStoppingRef.current = false;
    setTranscript('');
    transcriptRef.current = '';
    setConfidence(0.8);
    confidenceRef.current = 0.8;
    setError(null);
    setRecognitionState('idle');
    setDeliveryMetrics(emptyMetrics);
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
