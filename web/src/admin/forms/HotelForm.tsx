import type { HotelContent } from '../../types';
import { FieldRow, ListEditor, RemoveBtn, TextArea, TextInput } from './widgets';

interface Props { value: HotelContent; onChange: (next: HotelContent) => void }

export function HotelForm({ value, onChange }: Props) {
  const set = <K extends keyof HotelContent>(k: K, v: HotelContent[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div>
      <FieldRow label="Tagline"><TextArea value={value.tagline ?? ''} onChange={(v) => set('tagline', v)} /></FieldRow>

      <FieldRow label="Telefon">
        <TextInput value={value.contact?.phone ?? ''} onChange={(v) => set('contact', { ...value.contact, phone: v })} />
      </FieldRow>
      <FieldRow label="E-pošta">
        <TextInput value={value.contact?.email ?? ''} onChange={(v) => set('contact', { ...value.contact, email: v })} />
      </FieldRow>
      <FieldRow label="Adresa (puna)">
        <TextInput value={value.contact?.address ?? ''} onChange={(v) => set('contact', { ...value.contact, address: v })} />
      </FieldRow>

      <FieldRow label="Sobe">
        <ListEditor
          items={value.rooms ?? []}
          onChange={(items) => set('rooms', items)}
          empty={{ name: '', beds: '', area: '', price: '', amen: '' }}
          renderItem={(r, upd, remove) => (
            <>
              <RemoveBtn onClick={remove} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <FieldRow label="Naziv"><TextInput value={r.name} onChange={(v) => upd({ ...r, name: v })} /></FieldRow>
                <FieldRow label="Cena (din/noć)"><TextInput value={r.price} onChange={(v) => upd({ ...r, price: v })} placeholder="6.800" /></FieldRow>
                <FieldRow label="Kreveti"><TextInput value={r.beds} onChange={(v) => upd({ ...r, beds: v })} placeholder="1 bračni" /></FieldRow>
                <FieldRow label="Površina"><TextInput value={r.area} onChange={(v) => upd({ ...r, area: v })} placeholder="22 m²" /></FieldRow>
              </div>
              <FieldRow label="Pogodnosti"><TextInput value={r.amen} onChange={(v) => upd({ ...r, amen: v })} placeholder="TV · WiFi · klima" /></FieldRow>
            </>
          )}
          addLabel="+ Soba"
        />
      </FieldRow>

      <FieldRow label="Brojevi (facts)">
        <ListEditor
          items={value.facts ?? []}
          onChange={(items) => set('facts', items)}
          empty={{ num: '', label: '' }}
          renderItem={(f, upd, remove) => (
            <>
              <RemoveBtn onClick={remove} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
                <TextInput value={f.num} onChange={(v) => upd({ ...f, num: v })} placeholder="24" />
                <TextInput value={f.em ?? ''} onChange={(v) => upd({ ...f, em: v })} placeholder="★ (opcionalno)" />
                <TextInput value={f.label} onChange={(v) => upd({ ...f, label: v })} placeholder="Sobe" />
              </div>
            </>
          )}
          addLabel="+ Broj"
        />
      </FieldRow>
    </div>
  );
}
