import type { APPromptSet } from '@/data/apPractice';
import type { ListeningQuestion, ReadingPassageSet, SpeakingPrompt } from '@/data/types';

export type PracticeRepeatItem = ListeningQuestion | ReadingPassageSet | SpeakingPrompt | APPromptSet;

export function normalizePracticeRepeatText(value: string, maxLength = 260) {
  return value
    .toLowerCase()
    .replace(/[。、，,.!?！？「」『』（）()【】\[\]{}"'`~・:：;；\s-]/g, '')
    .slice(0, maxLength);
}

export function practiceItemText(item: PracticeRepeatItem) {
  if ('transcript' in item) {
    return [
      item.context,
      item.category,
      item.question,
      item.transcript,
      item.choices[item.correctIndex] ?? '',
      ...item.choices,
    ].join(' ');
  }
  if ('passage' in item) {
    return [
      item.title,
      item.context,
      item.category,
      item.passage,
      ...item.questions.flatMap((question) => [
        question.question,
        question.choices[question.correctIndex] ?? '',
        ...question.choices,
        question.evidence ?? '',
        question.keyword ?? '',
      ]),
    ].join(' ');
  }
  if ('english' in item) {
    return [
      item.english,
      item.hint,
      ...item.acceptableAnswers.slice(0, 4),
    ].join(' ');
  }
  return [
    item.title,
    item.situation,
    ...item.prompts,
    ...item.modelAnswers.slice(0, 4),
  ].join(' ');
}

export function practiceItemTopicText(item: PracticeRepeatItem) {
  if ('transcript' in item) return [item.context, item.category, item.question, item.choices[item.correctIndex] ?? ''].join(' ');
  if ('passage' in item) {
    return [
      item.title,
      item.context,
      item.category,
      ...item.questions.flatMap((question) => [
        question.question,
        question.choices[question.correctIndex] ?? '',
        question.keyword ?? '',
      ]),
    ].join(' ');
  }
  if ('english' in item) return item.english;
  return [item.title, item.situation, ...item.prompts.slice(0, 2)].join(' ');
}

export function practiceFingerprint(item: PracticeRepeatItem) {
  return normalizePracticeRepeatText(practiceItemText(item));
}

export function practiceTopicFingerprint(item: PracticeRepeatItem) {
  return normalizePracticeRepeatText(practiceItemTopicText(item), 150);
}

export function topicTokens(value: string): string[] {
  const lowered = value.toLowerCase();
  const wordTokens = lowered
      .toLowerCase()
      .split(/[^a-z0-9一-龯ぁ-んァ-ヶー]+/i)
      .map((token) => token.trim())
    .filter((token) => token.length >= 3);
  const japaneseText = normalizePracticeRepeatText(lowered, 220)
    .replace(/[^一-龯ぁ-んァ-ヶー]/g, '');
  const japaneseNgrams: string[] = [];
  for (const size of [3, 4, 5]) {
    for (let index = 0; index <= japaneseText.length - size; index += 1) {
      japaneseNgrams.push(japaneseText.slice(index, index + size));
    }
  }
  return Array.from(new Set([...wordTokens, ...japaneseNgrams])).slice(0, 140);
}

function practiceFamilyKeys(item: PracticeRepeatItem) {
  const text = practiceItemText(item);
  const keys: string[] = [];
  const add = (key: string) => keys.push(`family:${key}`);

  if (/(late|遅れ|遅刻|遅い).{0,100}(bring|what to bring|持ち|持って|持ち物)|(bring|what to bring|持ち|持って|持ち物).{0,100}(late|遅れ|遅刻|遅い)/i.test(text)) {
    add('late-bring');
  }
  if (/(club|部活|クラブ).{0,120}(change|changed|schedule|予定|変更|変わ|変える)|(change|changed|schedule|予定|変更|変わ|変える).{0,120}(club|部活|クラブ)/i.test(text)) {
    add('club-schedule-change');
  }
  if (/(train|platform|station|電車|駅|ホーム).{0,120}(delay|delayed|late|遅れ|遅延|変更)/i.test(text)) {
    add('train-delay');
  }
  if (/(cafe|coffee|カフェ|喫茶).{0,120}(study|quiet|勉強|静か)|(study|quiet|勉強|静か).{0,120}(cafe|coffee|カフェ|喫茶)/i.test(text)) {
    add('cafe-study');
  }
  if (/(bag|かばん|バッグ|チャック|zipper).{0,120}(exchange|replace|return|交換|返品|返金)|(exchange|replace|return|交換|返品|返金).{0,120}(bag|かばん|バッグ|チャック|zipper)/i.test(text)) {
    add('bag-exchange');
  }
  if (/(cash|payment|smartphone|現金|支払|払う|スマートフォン).{0,120}(young|trend|less common|若い|少なく|普通)|(young|trend|less common|若い|少なく|普通).{0,120}(cash|payment|smartphone|現金|支払|払う|スマートフォン)/i.test(text)) {
    add('cashless-trend');
  }

  return keys;
}

export function practiceRepeatKeys(item: PracticeRepeatItem) {
  const keys = [
    item.id,
    `fp:${practiceFingerprint(item)}`,
    `topic:${practiceTopicFingerprint(item)}`,
    ...practiceFamilyKeys(item),
  ];

  if ('passage' in item) {
    keys.push(
      `passage:${normalizePracticeRepeatText([item.title, item.context, item.passage].join(' '), 220)}`,
      ...item.questions.flatMap((question) => [
        question.id,
        `${item.id}:${question.id}`,
        `q:${normalizePracticeRepeatText([
          item.title,
          question.question,
          question.choices[question.correctIndex] ?? '',
          question.evidence ?? '',
          question.keyword ?? '',
        ].join(' '), 220)}`,
      ]),
    );
  }

  return Array.from(new Set(keys.filter((key) => key && key.length > 3)));
}

export function isCloseTopicMatch(topic: string, blockedTopic: string) {
  if (!topic || !blockedTopic) return false;
  if (topic === blockedTopic || topic.includes(blockedTopic) || blockedTopic.includes(topic)) return true;

  const topicSet = new Set(topicTokens(topic));
  const blockedTokens = topicTokens(blockedTopic);
  if (topicSet.size === 0 || blockedTokens.length === 0) return false;

  const overlap = blockedTokens.filter((token) => topicSet.has(token)).length;
  const ratio = overlap / Math.min(topicSet.size, blockedTokens.length);
  return (overlap >= 3 && ratio >= 0.6) || (overlap >= 8 && ratio >= 0.34);
}

export function hasPracticeRepeatOverlap(item: PracticeRepeatItem, blockedKeys: Iterable<string>) {
  const blocked = new Set(blockedKeys);
  if (practiceRepeatKeys(item).some((key) => blocked.has(key))) return true;

  const topic = practiceTopicFingerprint(item);
  for (const key of blocked) {
    if (!key.startsWith('topic:') && !key.startsWith('passage:')) continue;
    const normalized = key.replace(/^(topic|passage):/, '');
    if (isCloseTopicMatch(topic, normalized)) return true;
  }

  return false;
}
