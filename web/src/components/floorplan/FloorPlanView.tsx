import type { FloorPlanLayout } from '../../types';

interface Props {
  layout: FloorPlanLayout;
  // For tables: ids in this set render as taken. For rooms: roomKeys in this set render as taken.
  unavailable?: Set<string>;
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
}

// Read-only renderer used in visitor reservation pickers and (with onSelect) the cafe/hotel module.
// Bookable items expose their booking key:
//   - tables → item.id
//   - rooms  → item.roomKey
export function FloorPlanView({ layout, unavailable, selectedKey, onSelect }: Props) {
  const { width, height, items } = layout;
  return (
    <div className="floorplan">
      <svg className="floorplan-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width={width} height={height} className="floorplan-bg" />
        {items.map((item) => {
          if (item.type === 'wall') {
            return <rect key={item.id} className="fp-wall" x={item.x} y={item.y} width={item.w} height={item.h} />;
          }
          if (item.type === 'door') {
            return (
              <g key={item.id} className="fp-door" transform={`translate(${item.x},${item.y})`}>
                <circle r="6" />
                <line x1="-6" y1="0" x2="6" y2="0" />
              </g>
            );
          }
          const key = item.type === 'table' ? item.id : item.roomKey;
          const taken = unavailable?.has(key) ?? false;
          const selected = selectedKey === key;
          const cx = item.x + item.w / 2;
          const cy = item.y + item.h / 2;
          const cls = `fp-${item.type} ${taken ? 'taken' : ''} ${selected ? 'selected' : ''} ${onSelect ? 'clickable' : ''}`;
          return (
            <g
              key={item.id}
              className={cls}
              onClick={() => !taken && onSelect?.(key)}
            >
              <rect x={item.x} y={item.y} width={item.w} height={item.h} rx="4" />
              <text x={cx} y={cy + 4} textAnchor="middle" className="fp-label">{item.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
