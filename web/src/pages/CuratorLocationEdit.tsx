import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { FieldRow, ListEditor, RemoveBtn, TextArea, TextInput } from '../admin/forms/widgets';
import type {
  CafeContent,
  CategoryId,
  HotelContent,
  LandmarkContent,
  LocationWithContent,
  MajstorContent,
  PublicContent,
  SchoolContent,
} from '../types';
import { isMajstorCategory } from '../types';

export function CuratorLocationEdit() {
  const ctx = useOutletContext<AppContext>();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loc, setLoc] = useState<LocationWithContent | null>(null);
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setError(null);
    setSaved(false);
    api.getLocation(slug)
      .then((data: LocationWithContent) => {
        setLoc(data);
        setName(data.name);
        setSubtitle(data.subtitle ?? '');
        setAddress(data.address);
        setContent((data.content as Record<string, unknown>) ?? {});
      })
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  const inScope = !!loc && (
    ctx.currentUser?.role === 'admin' ||
    !!(loc.village && ctx.currentUser?.curatedVillages.includes(loc.village))
  );

  if (error && !loc) {
    return <div className="account-page"><div className="account-shell"><p className="login-error">{error}</p></div></div>;
  }
  if (!loc) return <div className="account-page" />;
  if (!inScope) {
    return (
      <div className="account-page">
        <div className="account-shell">
          <h1>Nemate dozvolu</h1>
          <p>Ovaj objekat nije u selu koje vi kurirate.</p>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // Backend filtrira content kroz mergeCuratorContent, ali pošaljemo samo
      // dozvoljene ključeve da izbegnemo nepotrebne 400 odgovore.
      const allowed = ALLOWED_CONTENT_KEYS[loc.catId] ?? new Set<string>();
      const filteredContent: Record<string, unknown> = {};
      for (const key of Object.keys(content)) {
        if (allowed === 'ALL' || allowed.has(key)) {
          filteredContent[key] = content[key];
        }
      }
      await api.curatorUpdateLocation(loc.id, {
        name,
        subtitle: subtitle || null,
        address,
        content: filteredContent,
      });
      await ctx.reloadLocations();
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const catLabel = ctx.categories.find((c) => c.id === loc.catId)?.label ?? loc.catId;

  return (
    <div className="module-page">
      <div style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '32px 48px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <button className="module-back" onClick={() => navigate('/kustos')} style={{ marginBottom: 12 }}>
            ← Nazad u kustos panel
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'space-between' }}>
            <div>
              <div className="module-cat">{catLabel} · {loc.village ?? 'bez sela'}</div>
              <h1 style={{ fontFamily: 'Fraunces, serif', fontWeight: 500, fontSize: 32, letterSpacing: '-0.02em', margin: '4px 0 0', color: 'var(--paper)' }}>
                Uredi: {loc.name}
              </h1>
              {loc.status === 'draft' && (
                <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 6 }}>
                  Status: nacrt — admin tek treba da objavi.
                </div>
              )}
            </div>
            <button className="nav-btn" onClick={() => window.open(`/objekat/${loc.slug}`, '_blank')}>
              Pregled →
            </button>
          </div>
        </div>
      </div>

      <div className="module-body" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 48px' }}>
        <div className="admin-card">
          <div className="section-label" style={{ margin: 0, marginBottom: 16 }}>Osnovni podaci</div>
          <FieldRow label="Naziv"><TextInput value={name} onChange={setName} /></FieldRow>
          <FieldRow label="Podnaslov"><TextInput value={subtitle} onChange={setSubtitle} /></FieldRow>
          <FieldRow label="Adresa"><TextInput value={address} onChange={setAddress} /></FieldRow>
          <div style={{ fontSize: 11, color: 'var(--ink-2)', opacity: 0.7, lineHeight: 1.5, marginTop: 4 }}>
            Selo, kategorija i položaj na mapi se ne mogu menjati ovde — kontaktirajte administraciju.
          </div>
        </div>

        <div className="admin-card" style={{ marginTop: 16 }}>
          <div className="section-label" style={{ margin: 0, marginBottom: 16 }}>Sadržaj</div>
          <CuratorContentEditor catId={loc.catId} value={content} onChange={setContent} />
          <div style={{ fontSize: 11, color: 'var(--ink-2)', opacity: 0.7, lineHeight: 1.5, marginTop: 12 }}>
            {CURATOR_RESTRICTION_HINTS[loc.catId] ?? null}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <button
            className="btn-primary"
            disabled={busy || !name || !address}
            onClick={submit}
          >
            {busy ? 'Čuvanje…' : 'Sačuvaj izmene'}
          </button>
          {saved && <div style={{ fontSize: 12, color: 'var(--moss)', marginTop: 8 }}>✓ Sačuvano</div>}
          {error && <div className="login-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}

// Whitelist mora odgovarati mergeCuratorContent u server/src/lib/locations.ts —
// menjati zajedno.
const ALLOWED_CONTENT_KEYS: Record<CategoryId, ReadonlySet<string> | 'ALL'> = {
  cafe:           new Set(['tagline', 'hours', 'contact']),
  public:         new Set(['tagline', 'hours', 'contact']),
  landmark:       'ALL',
  hotel:          new Set(['tagline', 'contact', 'facts']),
  school:         new Set(['tagline', 'contact', 'facts']),
  vodoinstalater: new Set(['tagline', 'contact', 'note']),
  elektricar:     new Set(['tagline', 'contact', 'note']),
  automehanicar:  new Set(['tagline', 'contact', 'note']),
};

const CURATOR_RESTRICTION_HINTS: Partial<Record<CategoryId, string>> = {
  cafe: 'Kustos ne uređuje meni — to radi vlasnik objekta.',
  public: 'Kustos ne uređuje listu usluga — to radi vlasnik javne službe.',
  hotel: 'Kustos ne uređuje sobe ni cene — to radi vlasnik smeštaja.',
  school: 'Kustos ne uređuje programe nastave ni alumni — to radi škola.',
  vodoinstalater: 'Kustos ne uređuje listu usluga ni radno vreme.',
  elektricar: 'Kustos ne uređuje listu usluga ni radno vreme.',
  automehanicar: 'Kustos ne uređuje listu usluga ni radno vreme.',
};

interface ContentEditorProps {
  catId: CategoryId;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

function CuratorContentEditor({ catId, value, onChange }: ContentEditorProps) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });

  if (catId === 'landmark') {
    const c = value as unknown as LandmarkContent;
    return (
      <>
        <FieldRow label="Tagline">
          <TextArea value={c.tagline ?? ''} onChange={(v) => set('tagline', v)} />
        </FieldRow>
        <FieldRow label="Brojke (facts)">
          <ListEditor
            items={c.facts ?? []}
            onChange={(items) => set('facts', items)}
            empty={{ num: '', label: '' }}
            renderItem={(f, upd, remove) => (
              <>
                <RemoveBtn onClick={remove} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
                  <TextInput value={f.num} onChange={(v) => upd({ ...f, num: v })} placeholder="vrednost" />
                  <TextInput value={f.em ?? ''} onChange={(v) => upd({ ...f, em: v })} placeholder="sufiks (opciono)" />
                  <TextInput value={f.label} onChange={(v) => upd({ ...f, label: v })} placeholder="opis" />
                </div>
              </>
            )}
          />
        </FieldRow>
        <FieldRow label="Priča (svaki pasus na novom redu)">
          <TextArea
            value={(c.story ?? []).join('\n\n')}
            onChange={(v) => set('story', v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean))}
            rows={8}
          />
        </FieldRow>
      </>
    );
  }

  if (catId === 'cafe') {
    const c = value as unknown as CafeContent;
    return (
      <>
        <FieldRow label="Tagline">
          <TextArea value={c.tagline ?? ''} onChange={(v) => set('tagline', v)} />
        </FieldRow>
        <FieldRow label="Telefon">
          <TextInput value={c.contact?.phone ?? ''} onChange={(v) => set('contact', { ...c.contact, phone: v })} />
        </FieldRow>
        <FieldRow label="Veb sajt">
          <TextInput value={c.contact?.web ?? ''} onChange={(v) => set('contact', { ...c.contact, web: v })} />
        </FieldRow>
        <FieldRow label="Radno vreme">
          <ListEditor
            items={c.hours ?? []}
            onChange={(items) => set('hours', items)}
            empty={{ day: '', hours: '' }}
            renderItem={(h, upd, remove) => (
              <>
                <RemoveBtn onClick={remove} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <TextInput value={h.day} onChange={(v) => upd({ ...h, day: v })} placeholder="Dan" />
                  <TextInput value={h.hours} onChange={(v) => upd({ ...h, hours: v })} placeholder="08 — 22" />
                </div>
              </>
            )}
            addLabel="+ Dodaj dan"
          />
        </FieldRow>
      </>
    );
  }

  if (catId === 'public') {
    const c = value as unknown as PublicContent;
    return (
      <>
        <FieldRow label="Tagline">
          <TextArea value={c.tagline ?? ''} onChange={(v) => set('tagline', v)} />
        </FieldRow>
        <FieldRow label="Telefon">
          <TextInput value={c.contact?.phone ?? ''} onChange={(v) => set('contact', { ...c.contact, phone: v })} />
        </FieldRow>
        <FieldRow label="Email">
          <TextInput value={c.contact?.email ?? ''} onChange={(v) => set('contact', { ...c.contact, email: v })} />
        </FieldRow>
        <FieldRow label="Adresa (kontakt)">
          <TextInput value={c.contact?.address ?? ''} onChange={(v) => set('contact', { ...c.contact, address: v })} />
        </FieldRow>
        <FieldRow label="Radno vreme — parovi (npr. „pon — pet“ / „07:30 — 15:30“)">
          <ListEditor
            items={c.hours ?? []}
            onChange={(items) => set('hours', items)}
            empty={['', ''] as [string, string]}
            renderItem={(pair, upd, remove) => (
              <>
                <RemoveBtn onClick={remove} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <TextInput value={pair[0]} onChange={(v) => upd([v, pair[1]] as [string, string])} placeholder="dani" />
                  <TextInput value={pair[1]} onChange={(v) => upd([pair[0], v] as [string, string])} placeholder="vreme" />
                </div>
              </>
            )}
            addLabel="+ Dodaj red"
          />
        </FieldRow>
      </>
    );
  }

  if (catId === 'hotel' || catId === 'school') {
    const c = value as unknown as HotelContent | SchoolContent;
    return (
      <>
        <FieldRow label="Tagline">
          <TextArea value={c.tagline ?? ''} onChange={(v) => set('tagline', v)} />
        </FieldRow>
        <FieldRow label="Telefon">
          <TextInput value={c.contact?.phone ?? ''} onChange={(v) => set('contact', { ...c.contact, phone: v })} />
        </FieldRow>
        <FieldRow label="Email">
          <TextInput value={c.contact?.email ?? ''} onChange={(v) => set('contact', { ...c.contact, email: v })} />
        </FieldRow>
        <FieldRow label="Adresa (kontakt)">
          <TextInput value={c.contact?.address ?? ''} onChange={(v) => set('contact', { ...c.contact, address: v })} />
        </FieldRow>
        <FieldRow label="Brojke (facts)">
          <ListEditor
            items={c.facts ?? []}
            onChange={(items) => set('facts', items)}
            empty={{ num: '', label: '' }}
            renderItem={(f, upd, remove) => (
              <>
                <RemoveBtn onClick={remove} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
                  <TextInput value={f.num} onChange={(v) => upd({ ...f, num: v })} placeholder="vrednost" />
                  <TextInput value={f.em ?? ''} onChange={(v) => upd({ ...f, em: v })} placeholder="sufiks" />
                  <TextInput value={f.label} onChange={(v) => upd({ ...f, label: v })} placeholder="opis" />
                </div>
              </>
            )}
          />
        </FieldRow>
      </>
    );
  }

  if (isMajstorCategory(catId)) {
    const c = value as unknown as MajstorContent;
    return (
      <>
        <FieldRow label="Tagline">
          <TextArea value={c.tagline ?? ''} onChange={(v) => set('tagline', v)} />
        </FieldRow>
        <FieldRow label="Telefon">
          <TextInput value={c.contact?.phone ?? ''} onChange={(v) => set('contact', { ...c.contact, phone: v })} />
        </FieldRow>
        <FieldRow label="Adresa (kontakt)">
          <TextInput value={c.contact?.address ?? ''} onChange={(v) => set('contact', { ...c.contact, address: v })} />
        </FieldRow>
        <FieldRow label="Napomena">
          <TextArea value={c.note ?? ''} onChange={(v) => set('note', v)} rows={3} />
        </FieldRow>
      </>
    );
  }

  return null;
}
