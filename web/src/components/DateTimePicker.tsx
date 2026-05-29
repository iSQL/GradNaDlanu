import DatePicker, { registerLocale, setDefaultLocale } from 'react-datepicker';
import { srLatn } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';

// Srpski latinica (date-fns ima i `sr` što je ćirilica). Mesec/dan labele u
// kalendaru: "Maj 2026", "pon uto sre čet pet sub ned".
registerLocale('sr-Latn', srLatn);
setDefaultLocale('sr-Latn');

// Helperi: konvertuju ISO "yyyy-mm-dd" i "HH:mm" iz/u Date objekat u LOKALNOJ
// zoni korisnika. Bitno: ne koristimo `new Date(iso)` jer to tretira ISO bez
// vremena kao UTC midnight što izaziva off-by-one na zapadnijim zonama.
function isoToDate(iso: string): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function dateToIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeToDate(time: string): Date | null {
  if (!time) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function dateToTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface DateProps {
  value: string; // ISO yyyy-mm-dd ili ''
  onChange: (next: string) => void;
  className?: string;
  placeholder?: string;
}

export function GndDatePicker({ value, onChange, className, placeholder }: DateProps) {
  const selected = isoToDate(value);
  return (
    <DatePicker
      selected={selected}
      onChange={(d: Date | null) => onChange(d ? dateToIso(d) : '')}
      dateFormat="dd/MM/yyyy"
      placeholderText={placeholder ?? 'dd/mm/yyyy'}
      className={className ?? 'field-input'}
      autoComplete="off"
      popperPlacement="bottom-start"
      // Mount-uj popup u top-level portal — bez toga grid-layout roditelja
      // (`.dt-fields`) može da rasteže susedne ćelije dok je popper otvoren.
      portalId="rdp-portal"
    />
  );
}

interface TimeProps {
  value: string; // "HH:mm" ili ''
  onChange: (next: string) => void;
  className?: string;
  placeholder?: string;
}

export function GndTimePicker({ value, onChange, className, placeholder }: TimeProps) {
  const selected = timeToDate(value);
  return (
    <DatePicker
      selected={selected}
      onChange={(d: Date | null) => onChange(d ? dateToTime(d) : '')}
      showTimeSelect
      showTimeSelectOnly
      timeFormat="HH:mm"
      timeIntervals={15}
      dateFormat="HH:mm"
      placeholderText={placeholder ?? 'HH:mm'}
      timeCaption="Vreme"
      className={className ?? 'field-input gnd-time-input'}
      autoComplete="off"
      popperPlacement="bottom-start"
      portalId="rdp-portal"
    />
  );
}
