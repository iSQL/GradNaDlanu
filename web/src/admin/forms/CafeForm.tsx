import type { CafeContent } from '../../types';
import { FieldRow, ListEditor, RemoveBtn, TextArea, TextInput } from './widgets';

interface Props { value: CafeContent; onChange: (next: CafeContent) => void }

export function CafeForm({ value, onChange }: Props) {
  const set = <K extends keyof CafeContent>(k: K, v: CafeContent[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div>
      <FieldRow label="Tagline (kratak opis)">
        <TextArea
          value={value.tagline ?? ''}
          onChange={(v) => set('tagline', v)}
          placeholder="npr. Mali kafić u centru — savršen za jutarnju kafu."
        />
      </FieldRow>

      <FieldRow label="Telefon">
        <TextInput value={value.contact?.phone ?? ''} onChange={(v) => set('contact', { ...value.contact, phone: v })} />
      </FieldRow>
      <FieldRow label="Veb sajt">
        <TextInput value={value.contact?.web ?? ''} onChange={(v) => set('contact', { ...value.contact, web: v })} />
      </FieldRow>

      <FieldRow label="Radno vreme">
        <ListEditor
          items={value.hours ?? []}
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

      <FieldRow label="Meni">
        <ListEditor
          items={value.menu ?? []}
          onChange={(items) => set('menu', items)}
          empty={{ cat: '', items: [{ name: '', desc: '', price: '' }] }}
          renderItem={(group, upd, remove) => (
            <>
              <RemoveBtn onClick={remove} />
              <FieldRow label="Naziv grupe">
                <TextInput value={group.cat} onChange={(v) => upd({ ...group, cat: v })} placeholder="topli napici" />
              </FieldRow>
              <FieldRow label="Stavke">
                <ListEditor
                  items={group.items ?? []}
                  onChange={(items) => upd({ ...group, items })}
                  empty={{ name: '', desc: '', price: '' }}
                  renderItem={(item, updItem, removeItem) => (
                    <>
                      <RemoveBtn onClick={removeItem} />
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr', gap: 8 }}>
                        <TextInput value={item.name} onChange={(v) => updItem({ ...item, name: v })} placeholder="Naziv" />
                        <TextInput value={item.desc} onChange={(v) => updItem({ ...item, desc: v })} placeholder="Opis" />
                        <TextInput value={item.price} onChange={(v) => updItem({ ...item, price: v })} placeholder="cena" />
                      </div>
                    </>
                  )}
                  addLabel="+ Stavka"
                />
              </FieldRow>
            </>
          )}
          addLabel="+ Grupa"
        />
      </FieldRow>
    </div>
  );
}
