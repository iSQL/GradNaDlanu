import { mediaUrl } from '../lib/api';
import { AD_CATEGORY_LABELS, type Ad } from '../types';

function formatPrice(priceRsd: number | null): string {
  if (priceRsd === null) return 'Po dogovoru';
  return `${priceRsd.toLocaleString('sr-RS')} RSD`;
}

interface Props {
  ad: Ad;
  onOpen: (ad: Ad) => void;
}

export function AdCard({ ad, onOpen }: Props) {
  return (
    <button type="button" className="oglas-card" onClick={() => onOpen(ad)}>
      <div className="oglas-card-thumb">
        {ad.photoMediaId ? (
          <img src={mediaUrl(ad.photoMediaId)} alt={ad.title} loading="lazy" />
        ) : (
          <div className="oglas-card-noimg" aria-hidden>
            {AD_CATEGORY_LABELS[ad.category]}
          </div>
        )}
        <span className={`oglas-badge cat-${ad.category}`}>{AD_CATEGORY_LABELS[ad.category]}</span>
      </div>
      <div className="oglas-card-body">
        <div className="oglas-card-title">{ad.title}</div>
        <div className="oglas-card-price">{formatPrice(ad.priceRsd)}</div>
        <div className="oglas-card-meta">
          <span>{ad.village}</span>
          <span className="oglas-card-author">{ad.authorDisplayName}</span>
        </div>
      </div>
    </button>
  );
}
