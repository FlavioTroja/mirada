/** «tra 40 min», «2 h fa», «Tra 1 h 20 min». */
export function minutesText(ms: number, word: 'fa' | 'tra' | 'Tra'): string {
  const total = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  const h = Math.floor(total / 60), m = total % 60;
  const span = h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
  return word === 'fa' ? `${span} fa` : `${word} ${span}`;
}
