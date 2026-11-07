/** Decimal arithmetic for non-negative amounts, matching PostgreSQL NUMERIC rounding. */
export function decimalParts(value: number) {
  if(!Number.isFinite(value)||value<0)throw new Error('Enter a valid non-negative amount.');
  const [mantissa,exponent='0']=value.toString().toLowerCase().split('e');
  const scale=(mantissa.split('.')[1]?.length??0)-Number(exponent);
  const units=BigInt(mantissa.replace('.',''));
  return scale<0?{units:units*BigInt(10)**BigInt(-scale),divisor:BigInt(1)}:{units,divisor:BigInt(10)**BigInt(scale)};
}

export function roundPositiveRatio(numerator: bigint, denominator: bigint) {
  return (numerator*BigInt(2)+denominator)/(denominator*BigInt(2));
}

export function roundUsd(value: number) {
  const amount=decimalParts(value);
  return Number(roundPositiveRatio(amount.units*BigInt(100),amount.divisor))/100;
}

export function discountedUsd(value: number, discount: number) {
  const amount=decimalParts(value),percentage=decimalParts(Math.max(0,Math.min(100,Number.isFinite(discount)?discount:0)));
  const numerator=amount.units*(BigInt(100)*percentage.divisor-percentage.units)*BigInt(100);
  return Number(roundPositiveRatio(numerator,amount.divisor*BigInt(100)*percentage.divisor))/100;
}
