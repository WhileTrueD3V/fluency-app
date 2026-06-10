import { getAIEndpoint } from '@/utils/aiApi';
import {
  getFirstCompletionFeedback,
  markFirstCompletionFeedbackRemoteResult,
  type FirstCompletionFeedback,
} from '@/utils/storage';
import { Platform } from 'react-native';

export async function submitFirstCompletionFeedbackToServer(feedback: FirstCompletionFeedback) {
  const endpoint = getAIEndpoint();
  if (!endpoint) {
    return { ok: false, skipped: true, reason: 'No feedback endpoint configured.' };
  }

  const response = await fetch(`${endpoint}/submit-feedback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      source: 'kibbo-app',
      appVersion: 'local-preview',
      platform: Platform.OS,
      feedback,
    }),
  });
  const body = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    skipped: false,
    status: response.status,
    id: typeof body?.id === 'string' ? body.id : null,
    error: response.ok ? null : body?.error ?? 'Feedback submission failed.',
  };
}

export async function submitAndTrackFirstCompletionFeedback(feedback: FirstCompletionFeedback) {
  try {
    const result = await submitFirstCompletionFeedbackToServer(feedback);
    await markFirstCompletionFeedbackRemoteResult(result);
    return result;
  } catch (error) {
    const result = {
      ok: false,
      skipped: false,
      id: null,
      error: error instanceof Error ? error.message : 'Feedback submission failed.',
    };
    await markFirstCompletionFeedbackRemoteResult(result);
    return result;
  }
}

export async function retryPendingFirstCompletionFeedbackToServer() {
  const feedback = await getFirstCompletionFeedback();
  if (
    !feedback
    || feedback.status !== 'submitted'
    || !feedback.rating
    || feedback.remoteStatus === 'submitted'
  ) {
    return { ok: false, skipped: true, reason: 'No retryable first-completion feedback.' };
  }

  return submitAndTrackFirstCompletionFeedback(feedback);
}
