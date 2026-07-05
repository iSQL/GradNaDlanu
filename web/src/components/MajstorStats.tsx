import { useState } from 'react';
import { IconStar } from './Icons';
import type { MajstorStats } from '../types';

// Zajednički prikaz metrika majstora (★ ocena · N poslova · ~brzina odgovora)
// i unos ocene zvezdicama — koriste ga /usluge picker, /majstori imenik,
// Moj prostor → Usluge i majstorski panel.

// Srpska množina: 1 posao, 2–4 posla, 5+ poslova (uz 11–14 izuzetke).
export function poslovaLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'posao';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'posla';
  return 'poslova';
}

export function formatResponseTime(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes < 60) return `~${Math.max(minutes, 1)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `~${hours} h`;
  return `~${Math.round(hours / 24)} d`;
}

// Read-only red zvezdica (za prikaz date/dobijene ocene).
export function Stars({ value }: { value: number }) {
  return (
    <span className="stars-row" aria-label={`ocena ${value} od 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`star-glyph ${i <= value ? 'is-filled' : ''}`}>
          <IconStar filled={i <= value} />
        </span>
      ))}
    </span>
  );
}

// Klikabilne zvezdice za unos ocene (hover pregled, klik bira).
export function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (stars: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <span className="stars-row stars-input" role="radiogroup" aria-label="Ocena majstora">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} ${i === 1 ? 'zvezdica' : 'zvezdice'}`}
          className={`star-btn ${i <= shown ? 'is-filled' : ''}`}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(i)}
        >
          <IconStar filled={i <= shown} />
        </button>
      ))}
    </span>
  );
}

// Kompaktna linija metrika na kartici majstora: „★ 4.8 · 12 poslova · ~1 h".
// Majstor bez završenih poslova i ocena → „Nov majstor".
export function MajstorStatLine({ stats }: { stats: MajstorStats }) {
  const parts: React.ReactNode[] = [];
  if (stats.avgRating !== null) {
    parts.push(
      <span key="rating" className="majstor-stat-rating">
        <IconStar filled /> {stats.avgRating.toLocaleString('sr-RS')}
      </span>,
    );
  }
  if (stats.completedJobs > 0) {
    parts.push(
      <span key="jobs">
        {stats.completedJobs} {poslovaLabel(stats.completedJobs)}
      </span>,
    );
  }
  const rt = formatResponseTime(stats.avgResponseMinutes);
  if (rt !== null) parts.push(<span key="rt">{rt}</span>);

  if (parts.length === 0) {
    return <span className="majstor-stat-line is-new">Nov majstor</span>;
  }
  return (
    <span className="majstor-stat-line">
      {parts.map((p, i) => (
        <span key={i} className="majstor-stat-part">
          {i > 0 && <span className="majstor-stat-dot" aria-hidden="true">·</span>}
          {p}
        </span>
      ))}
    </span>
  );
}
