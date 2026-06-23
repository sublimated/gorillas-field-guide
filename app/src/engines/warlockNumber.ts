const PLACE_VALUES = [1000, 100, 10, 1] as const;

export function warlockNumberTokens(value: number): string[] {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Warlock numbers must be non-negative integers, got ${value}.`);
  }
  if (value === 0) return [];

  const tokens: string[] = [];
  let remaining = value;
  for (const place of PLACE_VALUES) {
    const digit = Math.floor(remaining / place);
    remaining -= digit * place;
    if (digit > 0) tokens.push(`n${digit * place}`);
  }
  return tokens;
}

export function warlockNumberValue(tokens: string[]): number {
  return tokens.reduce((sum, token) => {
    const match = token.match(/^n(\d+)$/);
    if (!match) throw new Error(`Invalid warlock number token: ${token}`);
    return sum + Number(match[1]);
  }, 0);
}
