import type { Location } from '../types';
import { ModuleHero } from './ModuleHero';

export function EmptyContent({ loc, hint }: { loc: Location; hint?: string }) {
  return (
    <div className="module-page">
      <ModuleHero
        loc={loc}
        tagline={hint ?? 'Sadržaj za ovaj objekat još nije unet. Vratite se uskoro.'}
      />
      <div className="module-body single">
        <div className="prose">
          <p className="prose-lead">Stranica u pripremi.</p>
          <p>
            Ovaj objekat je dodat na mapu, ali detalji (radno vreme, kontakt, opis i slično) još nisu uneti.
            Administrator će ih dodati uskoro.
          </p>
        </div>
      </div>
    </div>
  );
}

/** True when a content blob has no useful payload. */
export function isEmptyContent(content: unknown): boolean {
  if (!content || typeof content !== 'object') return true;
  return Object.keys(content as object).length === 0;
}
