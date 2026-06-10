const LightColors = {
  // Kibbo core palette: logo coral, deep ink, learning aqua; yellow stays a tiny reward accent.
  bg: '#F7F9FC',
  card: '#FFFFFF',
  surface: '#EFF4F8',
  border: '#DFE7F0',
  borderBright: '#C8D3E0',

  // Brand/action — logo coral
  primary: '#D94734',
  primaryDim: '#D9473414',
  primaryGlow: '#D9473426',

  // Learning accent — used softly, not as a second brand
  accent: '#D94734',
  accentDim: '#D9473414',
  secondary: '#2FB9AE',
  secondaryDim: '#2FB9AE16',

  ink: '#0F1B2D',
  inkDim: '#0F1B2D12',
  teal: '#2FB9AE',
  tealDim: '#2FB9AE16',
  moss: '#2FB9AE',
  mossDim: '#2FB9AE16',
  purple: '#0F1B2D',
  purpleDim: '#0F1B2D10',

  // Semantic
  success: '#2FB978',
  successDim: '#2FB97816',
  error: '#D94734',
  errorDim: '#D9473414',
  warning: '#F6C247',
  warningDim: '#F6C24720',
  gold: '#F6C247',
  goldDim: '#F6C24720',

  // Text
  text: '#101820',
  textSub: '#5B6676',
  textMuted: '#8B96A6',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#FFFFFFCC',
  bgGlyph: '#DDE6EF3D',
  bgGlyphAccent: '#2FB9AE0E',
  cardTranslucent: '#FFFFFFE8',
  surfaceTranslucent: '#F6F8FBE8',

  // Language card accent colors
  japanese: '#D94734',
  japaneseDim: '#D9473414',
  mandarin: '#F6C247',
  mandarinDim: '#F6C24720',
  spanish: '#D94734',
  spanishDim: '#D9473414',

  // Mode colors
  speaking: '#D94734',
  speakingDim: '#D9473414',
  listening: '#2FB9AE',
  listeningDim: '#2FB9AE16',
  reading: '#2FB9AE',
  readingDim: '#2FB9AE16',

  // Rank colors
  beginner: '#7A8797',
  functional: '#F6C247',
  natural: '#D94734',
  native: '#0F1B2D',
};

const DarkColors: typeof LightColors = {
  // Dark variant of the same Kibbo palette
  bg: '#0C1320',
  card: '#111D2E',
  surface: '#17263A',
  border: '#26364D',
  borderBright: '#3A4D67',

  primary: '#F06450',
  primaryDim: '#F0645024',
  primaryGlow: '#F0645038',

  accent: '#F06450',
  accentDim: '#F0645024',
  secondary: '#49D3C8',
  secondaryDim: '#49D3C824',

  ink: '#EAF2FA',
  inkDim: '#EAF2FA18',
  teal: '#49D3C8',
  tealDim: '#49D3C824',
  moss: '#49D3C8',
  mossDim: '#49D3C824',
  purple: '#EAF2FA',
  purpleDim: '#EAF2FA14',

  // Semantic
  success: '#49D38A',
  successDim: '#49D38A24',
  error: '#F06450',
  errorDim: '#F0645024',
  warning: '#F8C957',
  warningDim: '#F8C95724',
  gold: '#F8C957',
  goldDim: '#F8C95724',

  // Text
  text: '#F7FAFE',
  textSub: '#B8C4D3',
  textMuted: '#8090A3',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#FFFFFFCC',
  bgGlyph: '#FFFFFF0D',
  bgGlyphAccent: '#49D3C812',
  cardTranslucent: '#111D2EEF',
  surfaceTranslucent: '#17263AEF',

  // Language card accent colors
  japanese: '#F06450',
  japaneseDim: '#F0645024',
  mandarin: '#F8C957',
  mandarinDim: '#F8C95724',
  spanish: '#F06450',
  spanishDim: '#F0645024',

  // Mode colors
  speaking: '#F06450',
  speakingDim: '#F0645024',
  listening: '#49D3C8',
  listeningDim: '#49D3C824',
  reading: '#49D3C8',
  readingDim: '#49D3C824',

  // Rank colors
  beginner: '#8090A3',
  functional: '#F8C957',
  natural: '#F06450',
  native: '#EAF2FA',
};

const LightGradients = {
  hero: ['#FFFFFF', '#F7F9FC', '#EEF8F7'] as const,
  speaking: ['#F06450', '#D94734'] as const,
  listening: ['#6CDAD1', '#2FB9AE'] as const,
  primary: ['#F06450', '#D94734'] as const,
  purple: ['#22324A', '#0F1B2D'] as const,
  gold: ['#FFD66D', '#F6C247'] as const,
  success: ['#48C889', '#2FA36B'] as const,
  card: ['#FFFFFF', '#F7F8FA'] as const,
  japanese: ['#F06450', '#D94734'] as const,
  mandarin: ['#FFD66D', '#F6C247'] as const,
  spanish: ['#F06450', '#D94734'] as const,
} as const;

const DarkGradients = {
  hero: ['#181512', '#241F1A', '#30291F'] as const,
  speaking: ['#F06A54', '#E05A45'] as const,
  listening: ['#8AD5DE', '#56B4C0'] as const,
  primary: ['#F06A54', '#E05A45'] as const,
  purple: ['#C1C9FF', '#8F9CE5'] as const,
  gold: ['#E8AC62', '#B97832'] as const,
  success: ['#8DCA7B', '#5F9E4F'] as const,
  card: ['#30291F', '#241F1A'] as const,
  japanese: ['#F06A54', '#E05A45'] as const,
  mandarin: ['#E8AC62', '#B97832'] as const,
  spanish: ['#F18A68', '#D86D4D'] as const,
} as const;

export const ActiveTheme = 'light';
export const Colors = LightColors;
export const Gradients = LightGradients;
