// Cross-browser 24h time picker: dva nativna select-a (sat + minut). HTML5
// <input type="time"> ima nekonzistentno ponašanje preko browsera (Edge AM/PM,
// Firefox bez vidljivog picker-a u nekim verzijama), pa idemo na select-e koje
// kontrolišemo u potpunosti.
//
// Vrednost je string `'HH:MM'` u 24h formatu ili prazan string. Minut step je
// 15 minuta (00 / 15 / 30 / 45) — pokriva 99% upotrebnih slučajeva za najave
// događaja; ako treba precizniji unos kasnije, lako se dodaju opcije.

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export function TimeSelect({ value, onChange }: Props) {
  const [hh = '', mm = ''] = value.split(':');

  const setHour = (h: string) => {
    if (!h) {
      // Reset sata briše celu vrednost — submit forma može da padne na 08:00 default.
      onChange('');
      return;
    }
    onChange(`${h}:${mm || '00'}`);
  };

  const setMinute = (m: string) => {
    if (!m) {
      // Reset minuta a sat je postavljen — ostavljamo sat sa minutom '00'.
      if (hh) onChange(`${hh}:00`);
      else onChange('');
      return;
    }
    // Ako sat nije izabran a korisnik klikne minut, postavljamo 08:MM.
    onChange(`${hh || '08'}:${m}`);
  };

  return (
    <div className="time-select">
      <select
        className="field-input time-select-part"
        value={hh}
        onChange={(e) => setHour(e.target.value)}
        aria-label="Sat"
      >
        <option value="">--</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="time-select-sep" aria-hidden="true">:</span>
      <select
        className="field-input time-select-part"
        value={mm}
        onChange={(e) => setMinute(e.target.value)}
        aria-label="Minut"
      >
        <option value="">--</option>
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
