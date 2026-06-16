export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface SpeakingPrompt {
  id: string;
  english: string;
  acceptableAnswers: string[];
  hint: string;
  difficulty: Difficulty;
}

export interface ListeningQuestion {
  id: string;
  transcript: string;
  translation: string;
  context: string;
  question: string;
  choices: string[];
  correctIndex: number;
  difficulty: Difficulty;
  category: string;
}

export interface ReadingPromptQuestion {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  evidence?: string;
  keyword?: string;
  explanation?: string;
}

export interface ReadingPassageSet {
  id: string;
  passage: string;
  translation: string;
  context: string;
  title: string;
  questions: ReadingPromptQuestion[];
  difficulty: Difficulty;
  category: string;
}

export interface PracticeItem {
  id: string;
  type: 'speaking' | 'listening' | 'reading' | 'conversation' | 'texting';
  languageCode: string;
  promptId: string;
  savedAt: number;
  // snapshot of question data so it displays even if data changes
  question: string;
  answer: string;
}
