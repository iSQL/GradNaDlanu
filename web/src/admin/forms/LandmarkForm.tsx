import type { LandmarkContent } from '../../types';
import { FieldRow, ListEditor, RemoveBtn, TextArea, TextInput } from './widgets';

interface Props { value: LandmarkContent; onChange: (next: LandmarkContent) => void }

export function LandmarkForm({ value, onChange }: Props) {
  const set = <K extends keyof LandmarkContent>(k: K, v: LandmarkContent[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div>
      <FieldRow label="Tagline"><TextArea value={value.tagline ?? ''} onChange={(v) => set('tagline', v)} /></FieldRow>

      <FieldRow label="Brojevi (facts)">
        <ListEditor
          items={value.facts ?? []}
          onChange={(items) => set('facts', items)}
          empty={{ num: '', label: '' }}
          renderItem={(f, upd, remove) => (
            <>
              <RemoveBtn onClick={remove} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
                <TextInput value={f.num} onChange={(v) => upd({ ...f, num: v })} placeholder="1847" />
                <TextInput value={f.em ?? ''} onChange={(v) => upd({ ...f, em: v })} placeholder="× (opcionalno)" />
                <TextInput value={f.label} onChange={(v) => upd({ ...f, label: v })} placeholder="Godina osvećenja" />
              </div>
            </>
          )}
          addLabel="+ Broj"
        />
      </FieldRow>

      <FieldRow label="Istorijat (paragrafi)">
        <ListEditor
          items={value.story ?? []}
          onChange={(items) => set('story', items)}
          empty=""
          renderItem={(p, upd, remove) => (
            <>
              <RemoveBtn onClick={remove} />
              <TextArea value={p} onChange={upd} rows={4} />
            </>
          )}
          addLabel="+ Paragraf"
        />
      </FieldRow>
    </div>
  );
}
