import type { LanguageCode } from '@/constants/languages';

export type APPracticeMode = 'conversation' | 'texting';

export interface APPromptSet {
  id: string;
  title: string;
  situation: string;
  mode: APPracticeMode;
  languageCode: LanguageCode;
  prompts: string[];
  suggestedKeywords: string[][];
  modelAnswers: string[];
}

export const japaneseConversationSets: APPromptSet[] = [
  {
    id: 'ja-conv-01',
    title: 'Weekend Plans',
    situation: 'A classmate asks about making plans for Saturday.',
    mode: 'conversation',
    languageCode: 'ja',
    prompts: [
      '土曜日に一緒に出かけませんか。どこに行きたいですか。',
      '何時に会うのがいいですか。',
      '雨が降ったら、どうしましょうか。',
      'では、最後に予定を確認してください。',
    ],
    suggestedKeywords: [
      ['行きたい', '映画', '店', '公園'],
      ['時', '会いましょう', '駅'],
      ['雨', 'カフェ', '家', '変更'],
      ['土曜日', '時', '会う', '楽しみ'],
    ],
    modelAnswers: [
      'はい、映画を見に行きたいです。そのあと、近くの店で昼ご飯を食べましょう。',
      '午後一時に駅の前で会うのはどうですか。',
      '雨が降ったら、駅の近くのカフェに変更しましょう。',
      '土曜日の午後一時に駅で会って、映画を見ます。楽しみにしています。',
    ],
  },
  {
    id: 'ja-conv-02',
    title: 'Restaurant Problem',
    situation: 'You are speaking with restaurant staff about a small problem.',
    mode: 'conversation',
    languageCode: 'ja',
    prompts: [
      'ご注文は何でしたか。',
      '申し訳ありません。何が違いますか。',
      '新しい料理をお持ちしましょうか。',
      'ほかに何か必要なものはありますか。',
    ],
    suggestedKeywords: [
      ['注文', '定食', 'お願いします'],
      ['違います', '頼んだ', '料理'],
      ['はい', 'お願いします', '新しい'],
      ['水', '大丈夫', 'ありがとう'],
    ],
    modelAnswers: [
      '私は魚の定食を注文しました。確認していただけますか。',
      'この料理は違います。私が頼んだものではありません。',
      'はい、お願いします。新しい料理を持ってきてください。',
      '水を一杯お願いします。ほかは大丈夫です。ありがとうございます。',
    ],
  },
  {
    id: 'ja-conv-03',
    title: 'Class Project',
    situation: 'A partner asks you about preparing a school presentation.',
    mode: 'conversation',
    languageCode: 'ja',
    prompts: [
      '発表のテーマは何にしましょうか。',
      '資料はだれが作りますか。',
      'いつ一緒に練習できますか。',
      '先生に何を聞いたほうがいいですか。',
    ],
    suggestedKeywords: [
      ['テーマ', '日本', '文化', '学校'],
      ['私', '資料', '作ります'],
      ['放課後', '練習', 'できます'],
      ['先生', '聞く', '発表'],
    ],
    modelAnswers: [
      '日本の学校生活について発表するのはどうですか。おもしろいテーマだと思います。',
      '私が資料を作ります。あなたは写真を探してくれますか。',
      '金曜日の放課後に一緒に練習できます。',
      '発表の長さと使ってもいい資料について先生に聞いたほうがいいです。',
    ],
  },
  {
    id: 'ja-conv-04',
    title: 'Lost Item',
    situation: 'You ask a school office worker about something you lost.',
    mode: 'conversation',
    languageCode: 'ja',
    prompts: [
      '何をなくしましたか。',
      '最後にどこで見ましたか。',
      'どんな色や形ですか。',
      '見つかったら、どう連絡すればいいですか。',
    ],
    suggestedKeywords: [
      ['なくしました', '財布', 'かばん', '携帯'],
      ['教室', '図書館', '見ました'],
      ['黒い', '小さい', '色'],
      ['メール', '電話', '連絡'],
    ],
    modelAnswers: [
      '小さい黒い財布をなくしました。中に学生証があります。',
      '最後に図書館で見ました。机の上に置いたと思います。',
      '黒くて小さい財布です。前に白いマークがあります。',
      '見つかったら、学校のメールに連絡してください。よろしくお願いします。',
    ],
  },
];

export const japaneseTextingSets: APPromptSet[] = [
  {
    id: 'ja-text-01',
    title: 'Club Meeting',
    situation: 'A friend texts you about a school club meeting.',
    mode: 'texting',
    languageCode: 'ja',
    prompts: [
      '今日のクラブのミーティングに来られますか。',
      '少し遅れる場合は、何時ごろ着きますか。',
      '持ってきたほうがいいものはありますか。',
      'では、グループのみんなに一言送ってください。',
    ],
    suggestedKeywords: [
      ['行けます', '行けません', 'ミーティング'],
      ['遅れます', '時', '着きます'],
      ['ノート', 'ペン', '持って'],
      ['よろしく', '楽しみ', 'ありがとう'],
    ],
    modelAnswers: [
      'はい、今日のクラブのミーティングに行けます。楽しみにしています。',
      '少し遅れると思います。四時十分ごろ着きます。',
      'ノートとペンを持ってきたほうがいいと思います。',
      'みなさん、今日はよろしくお願いします。一緒に活動するのを楽しみにしています。',
    ],
  },
  {
    id: 'ja-text-02',
    title: 'Homestay Message',
    situation: 'Your host family texts you about tonight.',
    mode: 'texting',
    languageCode: 'ja',
    prompts: [
      '今夜、何時ごろ帰りますか。',
      '晩ご飯は家で食べますか。',
      '明日の朝、何か予定がありますか。',
      '最後に、ホストファミリーにお礼を言ってください。',
    ],
    suggestedKeywords: [
      ['時', '帰ります', 'ごろ'],
      ['食べます', 'いりません', '晩ご飯'],
      ['学校', '友達', '予定'],
      ['ありがとうございます', 'お世話', '楽しみ'],
    ],
    modelAnswers: [
      '今夜は七時ごろ帰ります。遅くなったら、また連絡します。',
      'はい、晩ご飯は家で食べます。ありがとうございます。',
      '明日の朝は学校に行く予定があります。',
      'いつもありがとうございます。ホームステイでいろいろなことを学べてうれしいです。',
    ],
  },
  {
    id: 'ja-text-03',
    title: 'Study Group',
    situation: 'A classmate texts about studying for a Japanese quiz.',
    mode: 'texting',
    languageCode: 'ja',
    prompts: [
      '明日の日本語のクイズのために一緒に勉強しませんか。',
      'どこで勉強するのがいいと思いますか。',
      '何を復習したほうがいいですか。',
      '最後に、友達を励ますメッセージを送ってください。',
    ],
    suggestedKeywords: [
      ['勉強', 'クイズ', '一緒'],
      ['図書館', 'カフェ', '教室'],
      ['漢字', '文法', '単語'],
      ['頑張りましょう', '大丈夫', '一緒'],
    ],
    modelAnswers: [
      'はい、一緒に勉強したいです。明日のクイズの準備をしましょう。',
      '図書館で勉強するのがいいと思います。静かだからです。',
      '漢字と文法を復習したほうがいいと思います。',
      '一緒に頑張りましょう。きっと大丈夫です。',
    ],
  },
  {
    id: 'ja-text-04',
    title: 'School Event',
    situation: 'A friend texts about helping at a school event.',
    mode: 'texting',
    languageCode: 'ja',
    prompts: [
      '土曜日の学校イベントを手伝えますか。',
      '何時から来られますか。',
      'どんな仕事をしたいですか。',
      'では、イベントの前に確認したいことを一つ聞いてください。',
    ],
    suggestedKeywords: [
      ['手伝えます', '土曜日', 'イベント'],
      ['時', '来られます', '朝'],
      ['受付', '案内', '準備'],
      ['確認', '何時', '場所'],
    ],
    modelAnswers: [
      'はい、土曜日の学校イベントを手伝えます。',
      '朝九時から来られます。少し早く行きます。',
      '受付の仕事をしたいです。人と話すのが好きだからです。',
      '集合場所はどこですか。確認したいです。',
    ],
  },
];

export function getAPPracticeSets(mode: APPracticeMode, languageCode: LanguageCode): APPromptSet[] {
  if (languageCode !== 'ja') return [];
  return mode === 'conversation' ? japaneseConversationSets : japaneseTextingSets;
}

export function getAPPracticeSetById(
  mode: APPracticeMode,
  languageCode: LanguageCode,
  id?: string,
): APPromptSet {
  const sets = getAPPracticeSets(mode, languageCode);
  return sets.find((set) => set.id === id) ?? sets[0];
}
