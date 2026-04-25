import type { PublicContent } from '../../types';
import { FieldRow, ListEditor, RemoveBtn, TextArea, TextInput } from './widgets';

interface Props { value: PublicContent; onChange: (next: PublicContent) => void }

export function PublicForm({ value, onChange }: Props) {
  const set = <K extends keyof PublicContent>(k: K, v: PublicContent[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div>
      <FieldRow label="Tagline">
        <TextArea value={value.tagline ?? ''} onChange={(v) => set('tagline', v)} />
      </FieldRow>

      <FieldRow label="Telefon">
        <TextInput value={value.contact?.phone ?? ''} onChange={(v) => set('contact', { ...value.contact, phone: v })} />
      </FieldRow>
      <FieldRow label="E-pošta">
        <TextInput value={value.contact?.email ?? ''} onChange={(v) => set('contact', { ...value.contact, email: v })} />
      </FieldRow>
      <FieldRow label="Adresa (puna)">
        <TextInput value={value.contact?.address ?? ''} onChange={(v) => set('contact', { ...value.contact, address: v })} />
      </FieldRow>

      <FieldRow label="Radno vreme (label · vreme)">
        <ListEditor
          items={(value.hours ?? []) as [string, string][]}
          onChange={(items) => set('hours', items)}
          empty={['', ''] as [string, string]}
          renderItem={(row, upd, remove) => (
            <>
              <RemoveBtn onClick={remove} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <TextInput value={row[0]} onChange={(v) => upd([v, row[1]])} placeholder="pon — pet" />
                <TextInput value={row[1]} onChange={(v) => upd([row[0], v])} placeholder="08 — 16" />
              </div>
            </>
          )}
          addLabel="+ Termin"
        />
      </FieldRow>

      <FieldRow label="Usluge i nadležnosti">
        <ListEditor
          items={value.services ?? []}
          onChange={(items) => set('services', items)}
          empty=""
          renderItem={(s, upd, remove) => (
            <>
              <RemoveBtn onClick={remove} />
              <TextInput value={s} onChange={upd} placeholder="npr. Izdavanje izvoda iz matične knjige rođenih" />
            </>
          )}
          addLabel="+ Usluga"
        />
      </FieldRow>
    </div>
  );
}
