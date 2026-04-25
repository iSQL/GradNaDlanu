import type { ReactNode } from 'react';

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="field-label">{label}</div>
      {children}
    </div>
  );
}

export function TextInput({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="field-input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export function TextArea({
  value, onChange, placeholder, rows = 3,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      className="field-input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ resize: 'vertical', fontFamily: 'inherit' }}
    />
  );
}

export function ListEditor<T>({
  items,
  onChange,
  empty,
  renderItem,
  addLabel = '+ Dodaj',
}: {
  items: T[];
  onChange: (next: T[]) => void;
  empty: T;
  renderItem: (item: T, update: (next: T) => void, remove: () => void, idx: number) => ReactNode;
  addLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, idx) => (
        <div key={idx} style={{
          padding: 12,
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          position: 'relative',
        }}>
          {renderItem(
            item,
            (next) => {
              const copy = items.slice();
              copy[idx] = next;
              onChange(copy);
            },
            () => onChange(items.filter((_, i) => i !== idx)),
            idx,
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, structuredClone(empty)])}
        style={{
          padding: '10px 14px',
          background: 'transparent',
          border: '1px dashed var(--line-2)',
          borderRadius: 6,
          color: 'var(--navy)',
          fontWeight: 500,
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        {addLabel}
      </button>
    </div>
  );
}

export function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ukloni"
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: '1px solid var(--line)',
        background: 'transparent',
        color: 'var(--ink-2)',
        cursor: 'pointer',
        fontSize: 14,
        lineHeight: 1,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      ×
    </button>
  );
}
