import type { APPromptSet } from '@/data/apPractice';

export interface APGradedTurn {
  prompt: string;
  answer: string;
  modelAnswer: string;
  score: number;
  reason: string;
  improvements: string[];
  weakSkills: string[];
}

export interface APSessionReview {
  score: number;
  label: string;
  improvements: string[];
  weakSkills: string[];
  turns: APGradedTurn[];
}

const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9fff]/g;
const FORMAL_CONTEXT_RE = /(先生|店員|スタッフ|係|ホスト|ホームステイ|家族|親|注文|予約|申し訳|失礼|お願いします|ください|確認してください|必要ですか|手伝えますか)/;
const CASUAL_CONTEXT_RE = /(友達|友だち|友人|親友|クラスメート|同級生|友だち|友達|パーティー|遊び|映画に行|クラブの友|クラスのミーティング|今日のクラブ)/;
type ExpectedRegister = 'casual' | 'polite' | 'neutral';

export function reviewAPSession(set: APPromptSet, answers: string[]): APSessionReview {
  const turns = set.prompts.map((prompt, index) => {
    const answer = answers[index]?.trim() ?? '';
    const modelAnswer = set.modelAnswers[index] ?? '';
    const analysis = analyzeAnswer(answer, set.suggestedKeywords[index] ?? [], prompt, set.situation, set.mode);
    const score = scoreTurn(analysis);
    return {
      prompt,
      answer,
      modelAnswer,
      score,
      reason: reasonFor(score, analysis),
      improvements: improvementsFor(score, analysis),
      weakSkills: weakSkillsFor(analysis, score),
    };
  });

  const average = turns.reduce((sum, turn) => sum + turn.score, 0) / Math.max(1, turns.length);
  const score = Math.max(1, Math.min(5, Math.round(average)));

  return {
    score,
    label: labelForScore(score),
    improvements: score >= 5 ? [] : sessionImprovements(turns).slice(0, 2),
    weakSkills: sessionWeakSkills(turns).slice(0, 4),
    turns,
  };
}

interface AnswerAnalysis {
  answer: string;
  mode: APPromptSet['mode'];
  japaneseChars: number;
  keywordHits: number;
  hasPoliteEnding: boolean;
  hasCasualSignal: boolean;
  expectedRegister: ExpectedRegister;
  hasSpecificDetail: boolean;
  grammarIssues: string[];
}

function analyzeAnswer(
  answer: string,
  keywords: string[],
  prompt: string,
  situation: string,
  mode: APPromptSet['mode'],
): AnswerAnalysis {
  const registerContext = `${situation} ${prompt}`;
  const japaneseChars = answer.match(JAPANESE_RE)?.length ?? 0;
  const keywordHits = keywords.filter((keyword) => answer.includes(keyword)).length;
  const hasPoliteEnding = /(です|ます|ください|お願いします|ありがとう)/.test(answer);
  const hasCasualSignal = /(だ|じゃん|じゃない|行く|行ける|来る|できる|する|〜|ね|よ|かな|かも|ごめん|ありがとう|いいよ|むり|無理|行けない|行けるよ|行くよ|行くね|だよ|だね|だと思う|だった)/.test(answer);
  const expectedRegister = expectedRegisterFor(registerContext, mode);
  const hasSpecificDetail = /([一二三四五六七八九十\d]+時|今日|明日|土曜日|日曜日|映画|駅|雨|カフェ|学校|友達|水|料理|定食|ノート|ペン)/.test(answer);
  const grammarIssues = grammarIssuesFor(answer, mode);

  return {
    answer,
    mode,
    japaneseChars,
    keywordHits,
    hasPoliteEnding,
    hasCasualSignal,
    expectedRegister,
    hasSpecificDetail,
    grammarIssues,
  };
}

function expectedRegisterFor(context: string, mode: APPromptSet['mode']): ExpectedRegister {
  if (mode === 'texting' && CASUAL_CONTEXT_RE.test(context)) return 'casual';
  if (FORMAL_CONTEXT_RE.test(context)) return 'polite';
  return 'neutral';
}

function scoreTurn(analysis: AnswerAnalysis): number {
  if (!analysis.answer) return 1;

  let score = 1;
  if (analysis.japaneseChars >= 4) score = 2;
  if (analysis.japaneseChars >= 10 && analysis.keywordHits >= 1) score = 3;
  if (analysis.japaneseChars >= 18 && analysis.keywordHits >= 1 && hasRegisterFit(analysis) && analysis.hasSpecificDetail) score = 4;
  if (analysis.japaneseChars >= 28 && analysis.keywordHits >= 2 && hasRegisterFit(analysis) && analysis.hasSpecificDetail) score = 5;
  if (analysis.grammarIssues.length > 0) score = Math.max(1, score - 1);
  if (analysis.expectedRegister === 'polite' && !analysis.hasPoliteEnding && score > 3) score = 3;
  if (analysis.expectedRegister === 'casual' && analysis.hasPoliteEnding && score > 4) score = 4;
  return score;
}

function hasRegisterFit(analysis: AnswerAnalysis) {
  if (analysis.expectedRegister === 'polite') return analysis.hasPoliteEnding;
  if (analysis.expectedRegister === 'casual') return !analysis.hasPoliteEnding || analysis.hasCasualSignal;
  return analysis.hasPoliteEnding || analysis.hasCasualSignal;
}

function labelForScore(score: number): string {
  if (score >= 5) return 'AP 5 range';
  if (score === 4) return 'Strong';
  if (score === 3) return 'Developing';
  if (score === 2) return 'Limited';
  return 'Needs work';
}

function reasonFor(score: number, analysis: AnswerAnalysis): string {
  if (!analysis.answer.trim()) return 'No usable response was captured, so the turn cannot show AP-level communication.';
  if (analysis.grammarIssues.length > 0) return 'The response communicates something, but grammar or sentence-form issues lower the AP score.';
  if (score >= 5) return `Clear, specific, and ${analysis.expectedRegister === 'casual' ? 'casual enough' : analysis.expectedRegister === 'polite' ? 'polite enough' : 'register-appropriate'} for an AP 5-style exchange.`;
  if (score === 4) return 'Strong communication, but it needs a little more detail or precision to feel fully AP 5-ready.';
  if (score === 3) return 'The main idea is understandable, but the reply is still thin or only partly tied to the prompt.';
  if (score === 2) return 'Some Japanese is present, but the response is too short or unclear for the task.';
  return 'The answer is missing, off task, or too limited to sustain the exchange.';
}

function improvementsFor(score: number, analysis: AnswerAnalysis): string[] {
  if (score >= 5) return [];
  if (!analysis.answer.trim()) {
    if (analysis.mode === 'conversation') {
      return ['Give a spoken response instead of leaving the turn blank.', 'Use one short sentence that answers the prompt and keeps the conversation going.'];
    }
    return [
      'Give a written response instead of leaving the turn blank.',
      analysis.expectedRegister === 'casual'
        ? 'For this casual chat, use one short plain/casual reply that answers the friend directly.'
        : analysis.expectedRegister === 'polite'
          ? 'For this formal/polite chat, use one short です/ます reply that answers directly.'
          : 'Use one short reply that matches the relationship and answers directly.',
    ];
  }
  if (analysis.grammarIssues.length > 0) return analysis.grammarIssues;
  if (analysis.expectedRegister === 'casual' && analysis.hasPoliteEnding) {
    return [
      'This is a friend/casual text, so do not default to です/ます. Use plain/casual endings like 行く, だ, 〜ね, or 〜よ.',
      'Your sentence can be complete but still too thin; add one useful reason, time, or action that answers the friend directly.',
    ];
  }
  if (analysis.expectedRegister === 'polite' && !analysis.hasPoliteEnding) {
    return [
      'This situation calls for polite Japanese, so use です, ます, ください, or お願いします.',
      'Add one specific detail from the prompt so the reply feels complete.',
    ];
  }
  if (!analysis.hasSpecificDetail) {
    return ['Add one concrete detail such as a time, place, reason, or object.', 'The sentence may be complete, but make it useful: answer the exact question instead of giving only a general reaction.'];
  }
  if (analysis.keywordHits === 0) {
    return ['Use more specific vocabulary from the prompt instead of a general reply.', 'Add one detail that directly answers the question asked.'];
  }
  return ['Answer the prompt more directly and add one extra useful detail.', 'Keep the register matched to the relationship instead of defaulting to one style every time.'];
}

function weakSkillsFor(analysis: AnswerAnalysis, score: number): string[] {
  const skills: string[] = [];
  if (!analysis.answer.trim()) return ['Response capture'];
  if (analysis.japaneseChars < 12) skills.push('Response length');
  if (analysis.keywordHits === 0) skills.push('Prompt relevance');
  if (analysis.expectedRegister === 'polite' && !analysis.hasPoliteEnding) skills.push('Politeness control');
  if (analysis.expectedRegister === 'casual' && analysis.hasPoliteEnding) skills.push('Casual register control');
  if (!analysis.hasSpecificDetail) skills.push('Specific detail');
  if (analysis.grammarIssues.length > 0) skills.push('Grammar accuracy');
  if (score < 5 && skills.length === 0) skills.push('Response depth');
  return skills;
}

function sessionImprovements(turns: APGradedTurn[]): string[] {
  const specific = turns.flatMap((turn) => turn.improvements);
  return Array.from(new Set(specific.length > 0 ? specific : ['Add more useful detail to each response.', 'Match casual or polite register to the relationship in the prompt.']));
}

function sessionWeakSkills(turns: APGradedTurn[]): string[] {
  const counts = new Map<string, number>();
  turns.flatMap((turn) => turn.weakSkills).forEach((skill) => {
    counts.set(skill, (counts.get(skill) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([skill]) => skill);
}

function grammarIssuesFor(answer: string, mode: APPromptSet['mode']): string[] {
  const issues: string[] = [];
  if (!answer.trim()) return issues;
  if (/[ぁ-んァ-ン一-龯]をです/.test(answer)) {
    issues.push('Check particle plus copula use: をです is usually unnatural; use をお願いします, をください, or です depending on the sentence.');
  }
  if (/(行きますです|食べますです|ありますです|しますです)/.test(answer)) {
    issues.push('Avoid stacking polite endings like ますです; choose one correct polite form.');
  }
  if (/(はを|をは|がを|をが)/.test(answer)) {
    issues.push('Check particle order; two particles in a row often means the sentence needs restructuring.');
  }
  if (mode === 'texting' && !/[。！？!?]$/.test(answer) && answer.length >= 12) {
    issues.push('Add sentence-ending punctuation so the response reads like a complete AP text-chat reply.');
  }
  return issues.slice(0, 2);
}
