export function encodeTargetSkills(skills: string[] = []) {
  const cleaned = skills
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 8);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : undefined;
}

export function parseTargetSkillsParam(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((skill): skill is string => typeof skill === 'string')
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return raw
      .split('|')
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 8);
  }
}
