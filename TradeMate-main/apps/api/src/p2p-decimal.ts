const POWERS_OF_TEN = new Map<number, bigint>();
const powerOfTen = (scale: number) => {
  if (!Number.isInteger(scale) || scale < 0 || scale > 30) throw new Error('Unsupported decimal scale.');
  if (!POWERS_OF_TEN.has(scale)) POWERS_OF_TEN.set(scale, 10n ** BigInt(scale));
  return POWERS_OF_TEN.get(scale)!;
};

/** Parse a plain decimal string into exact integer units; never passes through Number. */
export const decimalToUnits = (value: string | number, scale: number, field: string): bigint => {
  const input = typeof value === 'number' ? String(value) : value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(input);
  if (!match) throw new Error(`Enter a valid ${field} using ordinary decimal notation.`);
  const fraction = match[2] || '';
  if (fraction.length > scale) throw new Error(`${field} supports at most ${scale} decimal places.`);
  return BigInt(match[1]) * powerOfTen(scale) + BigInt((fraction + '0'.repeat(scale)).slice(0, scale) || '0');
};

export const unitsToDecimal = (units: bigint, scale: number): string => {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const factor = powerOfTen(scale);
  const whole = absolute / factor;
  const fraction = (absolute % factor).toString().padStart(scale, '0');
  return `${negative ? '-' : ''}${whole}${scale ? '.' + fraction : ''}`;
};

/** Convert price(10dp) × quantity(12dp) to fiat cents, rounding half-up. */
export const productToFiatCents = (priceUnits: bigint, quantityUnits: bigint): bigint => {
  const numerator = priceUnits * quantityUnits;
  const divisor = powerOfTen(20);
  return (numerator + divisor / 2n) / divisor;
};

/** Convert fiat cents to asset units, rounding down so reserved quantity is never overstated. */
export const fiatCentsToQuantityUnits = (fiatCents: bigint, priceUnits: bigint): bigint => {
  if (priceUnits <= 0n) throw new Error('Price must be positive.');
  return (fiatCents * powerOfTen(20)) / priceUnits;
};
