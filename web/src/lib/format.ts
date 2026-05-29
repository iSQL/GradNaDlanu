// Konzistentno formatiranje datuma širom UI-ja. Sve format funkcije rade na
// lokalnom vremenu korisnika (getDate/getMonth/getFullYear), tako da datum
// koji je server poslao kao UTC midnight i dalje pokazuje "tačan dan" za korisnika.
//
// Format: **dd/mm/yyyy** sa kosim crtama. NE koristimo `toLocaleDateString` jer
// daje različite stringove preko browser-a i OS locale-ova; manuelni pad osigurava
// da je 1. maj uvek "01/05/yyyy", nikad "1/5/yyyy".

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// "dd/mm/yyyy HH:MM"
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDate(iso)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// "HH:MM" — 24h.
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// "dd/mm" — kompaktan oblik bez godine, korisno za kartice gde je godina implicitna.
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

// "dd/mm/yyyy HH:MM → HH:MM" ili "dd/mm/yyyy HH:MM → dd/mm/yyyy HH:MM" kad
// raspon prelazi dan. Koristi se za vremenske raspone (događaji sa endsAt).
export function formatDateTimeRange(startIso: string, endIso: string | null | undefined): string {
  if (!endIso) return formatDateTime(startIso);
  const a = new Date(startIso);
  const b = new Date(endIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return formatDateTime(startIso);
  const sameDay = a.toDateString() === b.toDateString();
  if (sameDay) {
    return `${formatDateTime(startIso)} → ${formatTime(endIso)}`;
  }
  return `${formatDateTime(startIso)} → ${formatDateTime(endIso)}`;
}
