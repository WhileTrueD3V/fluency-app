export const DrillAccents = {
  listening: '#2FB9AE',
  speaking: '#D94734',
  reading: '#2FA36B',
  conversation: '#7C5CFF',
  texting: '#D99521',
  levelCheck: '#4BAEC5',
  analytics: '#0F1B2D',
} as const;

export function tint(hex: string, alphaHex = '18') {
  return `${hex}${alphaHex}`;
}
