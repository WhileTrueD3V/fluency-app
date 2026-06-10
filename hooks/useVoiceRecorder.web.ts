import { useCallback, useState } from 'react';
import type { VoiceRecordingResult, VoiceRecordingState } from './useVoiceRecorder';

export function useVoiceRecorder() {
  const [recordingState, setRecordingState] = useState<VoiceRecordingState>('idle');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [durationMillis, setDurationMillis] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const startRecording = useCallback(async () => {
    setRecordingError(null);
    setRecordingUri(null);
    setDurationMillis(0);
    setRecordingState('idle');
    return true;
  }, []);

  const stopRecording = useCallback(async (): Promise<VoiceRecordingResult> => {
    setRecordingState('idle');
    return { uri: null, durationMillis: 0 };
  }, []);

  const resetRecording = useCallback(async () => {
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
