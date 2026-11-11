/** Preserve the original timestamp and its offset when presenting research events. */
export function dateLabel(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}(?::\d{2})?)(Z|[+-]\d{2}:?\d{2})?)?/);
  if (!match) return value;
  const [,year,month,day,time,offset] = match;
  return `${year}年${Number(month)}月${Number(day)}日${time ? ` · ${time}${offset ? ` (UTC${offset === 'Z' ? '' : offset})` : '（时区未标注）'}` : ''}`;
}
