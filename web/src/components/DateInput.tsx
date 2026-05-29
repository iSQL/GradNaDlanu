import { useEffect, useState } from 'react';

// Cross-browser dd/mm/yyyy date input. Native <input type="date"> renderuje display
// prema OS locale-u korisnika (en-US OS daje mm/dd/yyyy bez obzira na HTML `lang`),
// pa idemo na običan text input sa auto-formatiranjem i strogom validacijom.
//
// Vrednost koju primamo i emitujemo je **ISO yyyy-mm-dd** (isti format koji daje
// native <input type="date">, tako da je drop-in zamena). Interno držimo
// "dd/mm/yyyy" display string.

function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function displayToIso(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  // Round-trip kroz Date da uhvatimo nemoguće datume (npr. 31/02/2026).
  const iso = `${yyyy}-${mm}-${dd}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (
    Number.isNaN(check.getTime()) ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return iso;
}

// Pri svakom kucanju, auto-umetamo "/" posle 2. i 4. cifre. Korisnik može i
// ručno da otkuca "/" — strip-ujemo sve što nije cifra pre re-formatiranja.
function autoFormat(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

interface Props {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
}

export function DateInput({ value, onChange, className }: Props) {
  const [text, setText] = useState(() => isoToDisplay(value));

  // Eksterna value je istina — ako se promeni (npr. reset forme), pokloni
  // display ka njoj. U toku tipkanja unutar inputa, eksterni `value` se ažurira
  // kroz onChange, pa će ovaj effect rerunovati ali sa istom display vrednošću
  // (no-op).
  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  const handleChange = (raw: string) => {
    const formatted = autoFormat(raw);
    setText(formatted);
    const iso = displayToIso(formatted);
    if (iso !== null) onChange(iso);
    else if (formatted === '') onChange('');
    // Inače: text je polu-otkucan ('15/' ili '15/05/202'), čekamo dalje cifre
    // pre pozivanja onChange-a. Roditelj zadržava staru vrednost dok je input
    // nepotpun.
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/yyyy"
      maxLength={10}
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      className={className ?? 'field-input'}
      autoComplete="off"
    />
  );
}
