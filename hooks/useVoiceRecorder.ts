import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

export type VoiceRecordingState = 'idle' | 'recording' | 'stopped' | 'error';

export interface VoiceRecordingResult {
  uri: string | null;
  durationMillis: number;
}

export function useVoiceRecorder() {
  const [recordingState, setRecordingState] = useState<VoiceRecordingState>('idle');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [durationMillis, setDurationMillis] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const webStartedAtRef = useRef(0);

  const startRecording = useCallback(async () => {
    setRecordingError(null);
    setRecordingUri(null);
    setDurationMillis(0);

    if (Platform.OS === 'web') {
      try {
        const mediaDevices = globalThis.navigator?.mediaDevices;
        if (!mediaDevices || typeof MediaRecorder === 'undefined') {
          setRecordingError('Browser audio recording is not available here.');
          setRecordingState('error');
          return false;
        }
        const stream = await mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        webChunksRef.current = [];
        webStreamRef.current = stream;
        webRecorderRef.current = recorder;
        webStartedAtRef.current = Date.now();
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) webChunksRef.current.push(event.data);
        };
        recorder.start();
        setRecordingState('recording');
        return true;
      } catch {
        setRecordingError('Could not start browser audio recording.');
        setRecordingState('error');
        return false;
      }
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setRecordingError('Microphone recording permission denied.');
        setRecordingState('error');
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setRecordingState('recording');
      return true;
    } catch {
      setRecordingError('Could not start audio recording.');
      setRecordingState('error');
      return false;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<VoiceRecordingResult> => {
    if (Platform.OS === 'web') {
      const recorder = webRecorderRef.current;
      if (!recorder) return { uri: recordingUri, durationMillis };
      return await new Promise<VoiceRecordingResult>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(webChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const uri = URL.createObjectURL(blob);
          const elapsed = Math.max(0, Date.now() - webStartedAtRef.current);
          webStreamRef.current?.getTracks().forEach((track) => track.stop());
          webStreamRef.current = null;
          webRecorderRef.current = null;
          setRecordingUri(uri);
          setDurationMillis(elapsed);
          setRecordingState('stopped');
          resolve({ uri, durationMillis: elapsed });
        };
        recorder.stop();
      });
    }

    const recording = recordingRef.current;
    if (!recording) return { uri: recordingUri, durationMillis };

    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      setRecordingUri(uri);
      setDurationMillis(status.durationMillis ?? 0);
      setRecordingState('stopped');
      return { uri, durationMillis: status.durationMillis ?? 0 };
    } catch {
      recordingRef.current = null;
      setRecordingError('Could not save audio recording.');
      setRecordingState('error');
      return { uri: null, durationMillis: 0 };
    }
  }, [durationMillis, recordingUri]);

  const resetRecording = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (webRecorderRef.current?.state === 'recording') {
        try {
          webRecorderRef.current.stop();
        } catch {
          // Ignore cleanup failures.
        }
      }
      webStreamRef.current?.getTracks().forEach((track) => track.stop());
      webRecorderRef.current = null;
      webStreamRef.current = null;
      webChunksRef.current = [];
      recordingRef.current = null;
      setRecordingState('idle');
      setRecordingUri(null);
      setDurationMillis(0);
      setRecordingError(null);
      return;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // Ignore cleanup failures.
      }
    }
    recordingRef.current = null;
    setRecordingState('idle');
    setRecordingUri(null);
    setDurationMillis(0);
    setRecordingError(null);
  }, []);

  return {
    recordingState,
    recordingUri,
    durationMillis,
    recordingError,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
