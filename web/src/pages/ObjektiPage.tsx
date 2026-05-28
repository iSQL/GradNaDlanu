import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { SELA_ZABARI } from '../lib/villages';
import { CATEGORY_LABELS, type CategoryId } from '../types';
import { PinGlyph } from '../components/PinGlyph';

export function ObjektiPage() {
  const { categories, locations, activeFilter, setActiveFilter, search } =
    useOutletContext<AppContext>();
  const [village, setVillage] = useState<string>('');
  const [localSearch, setLocalSearch] = useState(search);

  // Search state je deljen sa AppContext-om (top-nav search se preliva ovde),
  // ali držimo i lokalni input za nezavisno tipkanje na samoj stranici.
  const q = (localSearch || search).trim().toLowerCase();

  const filtered = useMemo(() => {
    return locations.filter((l) => {
      if (l.status !== 'published') return false;
      if (activeFilter !== 'all' && l.catId !== activeFilter) return false;
      if (village && l.village !== village) return false;
      if (q && !l.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [locations, activeFilter, village, q]);

  return (
    <div className="page page-objekti">
      <div className="page-shell">
        <header className="page-head">
          <h1>Objekti</h1>
          <p className="page-sub">Pretraži objekte u opštini Žabari po kategoriji, selu i imenu.</p>
        </header>

        <div className="objekti-filters">
          <label className="filter-field">
            <span>Kategorija</span>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as CategoryId | 'all')}
            >
              <option value="all">Sve kategorije</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Selo</span>
            <select value={village} onChange={(e) => setVillage(e.target.value)}>
              <option value="">Sva sela</option>
              {SELA_ZABARI.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field filter-field-grow">
            <span>Pretraga po imenu</span>
            <input
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Npr. Kafić Korzo…"
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">Nema objekata koji odgovaraju filteru.</div>
        ) : (
          <ul className="objekti-grid">
            {filtered.map((l) => {
              const cat = categories.find((c) => c.id === l.catId);
              return (
                <li key={l.id} className="objekti-card">
                  <Link to={`/objekat/${l.slug}`} className="objekti-card-link">
                    <div className="objekti-card-icon" style={{ color: cat?.color }}>
                      <PinGlyph cat={l.catId} size={28} />
                    </div>
                    <div className="objekti-card-body">
                      <div className="objekti-card-name">{l.name}</div>
                      <div className="objekti-card-cat" style={{ color: cat?.color }}>
                        {CATEGORY_LABELS[l.catId]}
                      </div>
                      <div className="objekti-card-meta">
                        {l.village ? <span>{l.village} · </span> : null}
                        {l.address}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
