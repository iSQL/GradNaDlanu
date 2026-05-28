import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import type { NewsItem } from '../types';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'short' });
}

export function HomePage() {
  const { categories, locations, currentUser } = useOutletContext<AppContext>();
  const [latestNews, setLatestNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listNews({ limit: 3 })
      .then((rows) => {
        if (!cancelled) setLatestNews(rows);
      })
      .catch(() => {
        if (!cancelled) setLatestNews([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const publishedCount = locations.filter((l) => l.status === 'published').length;
  const dashboardTarget = currentUser ? '/dashboard' : '/prijava';

  return (
    <div className="landing">
      <header className="landing-hero">
        <h1>Grad na dlanu — Žabari</h1>
        <p>Tvoja opština na jednom mestu: dešavanja, mapa, objekti i lični pregled.</p>
      </header>

      <div className="landing-grid">
        <Link to="/desavanja" className="landing-card landing-card-wide">
          <div className="landing-card-head">
            <h2>Najnovija dešavanja</h2>
            <span className="landing-card-cta">Otvori →</span>
          </div>
          {latestNews === null ? (
            <p className="landing-card-sub">Učitavam…</p>
          ) : latestNews.length === 0 ? (
            <p className="landing-card-sub">
              Još nema objavljenih dešavanja. Vrati se uskoro — vlasnici objekata objavljuju novosti.
            </p>
          ) : (
            <ul className="landing-news-preview">
              {latestNews.map((n) => (
                <li key={n.id}>
                  <span className="landing-news-date">{formatDate(n.publishedAt ?? n.createdAt)}</span>
                  <span className="landing-news-title">{n.title}</span>
                  <span className="landing-news-loc">· {n.locationName}</span>
                </li>
              ))}
            </ul>
          )}
        </Link>

        <Link to="/mapa" className="landing-card">
          <h2>Pregled mape</h2>
          <p className="landing-card-sub">
            Otvori satelitsku mapu opštine sa svim objektima — kafićima, javnim službama, znamenitostima i
            smeštajem.
          </p>
          <span className="landing-card-cta">Otvori mapu →</span>
        </Link>

        <Link to="/objekti" className="landing-card">
          <h2>Objekti i kategorije</h2>
          <p className="landing-card-sub">
            {publishedCount} objekata u {categories.length} kategorija. Pretraži po selu, imenu ili tipu.
          </p>
          <span className="landing-card-cta">Otvori katalog →</span>
        </Link>

        <Link to={dashboardTarget} className="landing-card">
          <h2>Moj prostor</h2>
          <p className="landing-card-sub">
            {currentUser
              ? 'Pratim objekte, dešavanja iz mojih sela, poruke.'
              : 'Uloguj se da personalizuješ pregled, pratiš objekte i primaš obaveštenja.'}
          </p>
          <span className="landing-card-cta">{currentUser ? 'Otvori' : 'Prijava'} →</span>
        </Link>
      </div>
    </div>
  );
}
