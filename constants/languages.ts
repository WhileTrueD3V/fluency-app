export type LanguageCode = 'ja' | 'zh' | 'es';

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  ttsLocale: string;
  sttLocale: string;
}

export const LANGUAGES: Language[] = [
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    ttsLocale: 'ja-JP',
    sttLocale: 'ja-JP',
  },
  {
    code: 'zh',
    name: 'Mandarin',
    nativeName: '中文',
    ttsLocale: 'zh-CN',
    sttLocale: 'zh-CN',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    ttsLocale: 'es-ES',
    sttLocale: 'es-ES',
  },
];

export const AVAILABLE_LANGUAGE_CODES: LanguageCode[] = ['ja'];

export function isLanguageAvailable(code: LanguageCode): boolean {
  return AVAILABLE_LANGUAGE_CODES.includes(code);
}

export function getLanguage(code: LanguageCode): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
