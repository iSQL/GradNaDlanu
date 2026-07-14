import { useEffect, useState } from 'react';
import { getToken } from '../lib/auth';
import { mediaUrl } from '../lib/api';

interface Props {
  mediaId: number;
  alt: string;
  className?: string;
}

// <img> ne šalje Authorization header, a privatni mediji (service_photo) na
// GET /api/media/:id zahtevaju Bearer token. Ova komponenta preuzme sliku
// fetch-om sa tokenom i prikaže je kao blob URL. Klik otvara punu sliku u
// novom tabu (isti blob).
export function AuthImage({ mediaId, alt, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    fetch(mediaUrl(mediaId), { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  if (failed) return null;
  if (!url) return <span className={className} aria-hidden="true" />;
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      style={{ cursor: 'pointer' }}
      onClick={() => window.open(url, '_blank', 'noopener')}
    />
  );
}
