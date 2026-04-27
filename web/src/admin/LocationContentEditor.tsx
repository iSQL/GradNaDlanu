import type {
  CafeContent, CategoryId, HotelContent, LandmarkContent,
  PublicContent, SchoolContent,
} from '../types';
import { CafeForm } from './forms/CafeForm';
import { PublicForm } from './forms/PublicForm';
import { HotelForm } from './forms/HotelForm';
import { LandmarkForm } from './forms/LandmarkForm';
import { SchoolForm } from './forms/SchoolForm';

interface Props {
  catId: CategoryId;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

// Shared between admin (full edit) and owner (own-object edit) — both render
// the same per-category form against the jsonb content blob.
export function LocationContentEditor({ catId, value, onChange }: Props) {
  const update = (v: unknown) => onChange(v as Record<string, unknown>);
  const v = value as unknown;
  switch (catId) {
    case 'cafe':     return <CafeForm     value={v as CafeContent}     onChange={update} />;
    case 'public':   return <PublicForm   value={v as PublicContent}   onChange={update} />;
    case 'hotel':    return <HotelForm    value={v as HotelContent}    onChange={update} />;
    case 'landmark': return <LandmarkForm value={v as LandmarkContent} onChange={update} />;
    case 'school':   return <SchoolForm   value={v as SchoolContent}   onChange={update} />;
  }
}
