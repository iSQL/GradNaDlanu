import type { SchoolContent } from '../../types';
import { FieldRow, ListEditor, RemoveBtn, TextArea, TextInput } from './widgets';

interface Props { value: SchoolContent; onChange: (next: SchoolContent) => void }

export function SchoolForm({ value, onChange }: Props) {
  const set = <K extends keyof SchoolContent>(k: K, v: SchoolContent[K]) =>
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
      <FieldRow label="Adresa">
        <TextInput value={value.contact?.address ?? ''} onChange={(v) => set('contact', { ...value.contact, address: v })} />
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
                <TextInput value={f.num} onChange={(v) => upd({ ...f, num: v })} placeholder="1857" />
                <TextInput value={f.em ?? ''} onChange={(v) => upd({ ...f, em: v })} placeholder="(opcionalno)" />
                <TextInput value={f.label} onChange={(v) => upd({ ...f, label: v })} placeholder="Osnovana" />
              </div>
            </>
          )}
          addLabel="+ Broj"
        />
      </FieldRow>

      <FieldRow label="Programi">
        <ListEditor
          items={value.programs ?? []}
          onChange={(items) => set('programs', items)}
          empty=""
          renderItem={(p, upd, remove) => (
            <>
              <RemoveBtn onClick={remove} />
              <TextInput value={p} onChange={upd} placeholder="npr. Redovna nastava 1—8" />
            </>
          )}
          addLabel="+ Program"
        />
      </FieldRow>
    </div>
  );
}
