import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import type { LocationWithContent } from '../types';
import { IconCheck, IconHeart, IconStar } from './Icons';

interface Props {
  loc: LocationWithContent;
  onChanged: () => void;
}

export function SocialActions({ loc, onChanged }: Props) {
  const ctx = useOutletContext<AppContext>();
  const loggedIn = !!ctx.currentUser;

  const [favorited, setFavorited] = useState(loc.favoritedByMe);
  const [checkedIn, setCheckedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleFavorite = async () => {
    if (!loggedIn || busy) return;
    setBusy(true);
    const next = !favorited;
    setFavorited(next); // optimistic
    try {
      if (next) await api.favorite(loc.slug);
      else await api.unfavorite(loc.slug);
      onChanged();
    } catch {
      setFavorited(!next); // rollback
    } finally {
      setBusy(false);
    }
  };

  const checkIn = async () => {
    if (!loggedIn || busy || checkedIn) return;
    setBusy(true);
    try {
      await api.checkin(loc.slug);
      setCheckedIn(true);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const summary = loc.commentSummary;

  return (
    <div className="social-bar">
      <div className="social-stats">
        {summary.count > 0 && (
          <div className="social-stat" title={`${summary.count} komentara`}>
            <IconStar filled />
            {summary.avgRating !== null
              ? `${summary.avgRating.toFixed(1)} · ${summary.count}`
              : `${summary.count} komentara`}
          </div>
        )}
        {loc.checkinsLast24h > 0 && (
          <div className="social-stat" title="prijave u poslednja 24 sata">
            <IconCheck />
            {loc.checkinsLast24h} danas
          </div>
        )}
      </div>

      <div className="social-actions">
        {loggedIn ? (
          <>
            <button
              type="button"
              className={`social-btn ${favorited ? 'active' : ''}`}
              onClick={toggleFavorite}
              disabled={busy}
              aria-pressed={favorited}
            >
              <IconHeart filled={favorited} />
              {favorited ? 'Otprati' : 'Zaprati'}
            </button>
            <button
              type="button"
              className={`social-btn ${checkedIn ? 'active' : ''}`}
              onClick={checkIn}
              disabled={busy || checkedIn}
            >
              <IconCheck />
              {checkedIn ? 'Prijavljeni ste' : 'Prijavi se ovde'}
            </button>
          </>
        ) : (
          <Link to="/prijava" className="social-btn">
            <IconHeart /> Prijavite se da zapratite
          </Link>
        )}
      </div>
    </div>
  );
}
