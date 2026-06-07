import type { LandmarkContent, Location } from '../types';
import { ModuleHero } from './ModuleHero';
import { ModuleTabs, type TabDef } from './ModuleTabs';
import { OpsteTab } from './OpsteTab';
import {
  LocationEventsList,
  LocationNewsList,
  useLocationDesavanja,
} from './LocationDesavanjaTabs';

interface Props { loc: Location; content: LandmarkContent }

export function LandmarkModule({ loc, content }: Props) {
  const facts = content.facts ?? [];
  const story = content.story ?? [];
  const tagline = content.tagline ?? 'Znamenitost u opštini Žabari.';

  const desavanja = useLocationDesavanja(loc.id, loc.slug);

  const tabs: TabDef[] = [
    {
      key: 'osnovni',
      label: 'Opšte',
      render: () => (
        <OpsteTab
          loc={loc}
          infoLabel="O znamenitosti"
          tagline={tagline}
          facts={facts}
          desavanja={desavanja}
        />
      ),
    },
    {
      key: 'dogadjaji',
      label: 'Najavljeni događaji',
      isEmpty: !desavanja.loading && desavanja.events.length === 0,
      render: () => (
        <div className="module-section">
          <div className="section-label">Najavljeni događaji</div>
          <LocationEventsList items={desavanja.events} loading={desavanja.loading} />
        </div>
      ),
    },
    {
      key: 'obavestenja',
      label: 'Obaveštenja',
      isEmpty: !desavanja.loading && desavanja.news.length === 0,
      render: () => (
        <div className="module-section">
          <div className="section-label">Obaveštenja</div>
          <LocationNewsList items={desavanja.news} loading={desavanja.loading} />
        </div>
      ),
    },
    {
      key: 'istorijat',
      label: 'Istorijat',
      isEmpty: story.length === 0,
      render: () => (
        <div className="module-section">
          <div className="section-label">Istorijat</div>
          {story.length === 0 ? (
            <div className="loc-desavanja-empty">Istorijat još nije unet.</div>
          ) : (
            <div className="prose">
              <p className="prose-lead">{tagline}</p>
              {story.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="module-page">
      <ModuleHero loc={loc} tagline={tagline} />
      <div className="module-body tabs">
        <ModuleTabs tabs={tabs} />
      </div>
    </div>
  );
}
