import { useCallback, useRef, useState } from 'react';
import type { FloorPlanItem, FloorPlanLayout } from '../../types';

interface Props {
  layout: FloorPlanLayout;
  onChange: (layout: FloorPlanLayout) => void;
}

const GRID = 10;
const HANDLE = 12;

const DEFAULTS = {
  table: { w: 50, h: 50, label: '1', capacity: 4 },
  room:  { w: 80, h: 60, label: 'Soba', capacity: 2 },
  wall:  { w: 100, h: 8 },
};

type DragKind = 'move' | 'resize';

interface DragState {
  id: string;
  kind: DragKind;
  startPointer: { x: number; y: number };
  startBox: { x: number; y: number; w: number; h: number };
}

function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

function nextItemId(items: FloorPlanItem[], type: FloorPlanItem['type']): string {
  let n = 1;
  while (items.some((it) => it.id === `${type}-${n}`)) n++;
  return `${type}-${n}`;
}

function nextRoomKey(items: FloorPlanItem[]): string {
  let n = 1;
  while (items.some((it) => it.type === 'room' && it.roomKey === `r-${n}`)) n++;
  return `r-${n}`;
}

function clone(layout: FloorPlanLayout): FloorPlanLayout {
  return { ...layout, items: layout.items.map((it) => ({ ...it })) };
}

export function FloorPlanEditor({ layout, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const selected = selectedId ? layout.items.find((it) => it.id === selectedId) ?? null : null;

  const toLogical = useCallback((evt: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((evt.clientX - rect.left) / rect.width) * layout.width,
      y: ((evt.clientY - rect.top) / rect.height) * layout.height,
    };
  }, [layout.width, layout.height]);

  const updateItem = useCallback((id: string, patch: Partial<FloorPlanItem>) => {
    const next = clone(layout);
    const idx = next.items.findIndex((it) => it.id === id);
    if (idx === -1) return;
    next.items[idx] = { ...next.items[idx], ...patch } as FloorPlanItem;
    onChange(next);
  }, [layout, onChange]);

  const onItemPointerDown = (e: React.PointerEvent<SVGGElement>, item: FloorPlanItem, kind: DragKind) => {
    e.stopPropagation();
    setSelectedId(item.id);
    const p = toLogical(e);
    const box = {
      x: item.x,
      y: item.y,
      w: 'w' in item ? item.w : 0,
      h: 'h' in item ? item.h : 0,
    };
    setDrag({ id: item.id, kind, startPointer: p, startBox: box });
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const p = toLogical(e);
    const dx = p.x - drag.startPointer.x;
    const dy = p.y - drag.startPointer.y;
    if (drag.kind === 'move') {
      const item = layout.items.find((it) => it.id === drag.id);
      if (!item) return;
      const w = 'w' in item ? item.w : 0;
      const h = 'h' in item ? item.h : 0;
      const x = Math.max(0, Math.min(layout.width - w, snap(drag.startBox.x + dx)));
      const y = Math.max(0, Math.min(layout.height - h, snap(drag.startBox.y + dy)));
      updateItem(drag.id, { x, y } as Partial<FloorPlanItem>);
    } else {
      // resize from bottom-right handle
      const item = layout.items.find((it) => it.id === drag.id);
      if (!item || !('w' in item)) return;
      const w = Math.max(GRID, Math.min(layout.width - item.x, snap(drag.startBox.w + dx)));
      const h = Math.max(GRID, Math.min(layout.height - item.y, snap(drag.startBox.h + dy)));
      updateItem(drag.id, { w, h } as Partial<FloorPlanItem>);
    }
  };

  const endDrag = () => setDrag(null);

  const addItem = (type: FloorPlanItem['type']) => {
    const next = clone(layout);
    const id = nextItemId(next.items, type);
    const x = snap(layout.width / 2 - 30);
    const y = snap(layout.height / 2 - 30);
    if (type === 'table') {
      next.items.push({ id, type: 'table', x, y, ...DEFAULTS.table });
    } else if (type === 'room') {
      next.items.push({ id, type: 'room', x, y, ...DEFAULTS.room, roomKey: nextRoomKey(next.items) });
    } else if (type === 'wall') {
      next.items.push({ id, type: 'wall', x, y, ...DEFAULTS.wall });
    } else if (type === 'door') {
      next.items.push({ id, type: 'door', x, y });
    }
    onChange(next);
    setSelectedId(id);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    const next = clone(layout);
    next.items = next.items.filter((it) => it.id !== selectedId);
    onChange(next);
    setSelectedId(null);
  };

  const updateCanvasSize = (dim: 'width' | 'height', v: number) => {
    onChange({ ...layout, [dim]: Math.max(100, v) });
  };

  return (
    <div className="floorplan-editor">
      <div className="floorplan-toolbar">
        <button type="button" className="row-action" onClick={() => addItem('table')}>+ Sto</button>
        <button type="button" className="row-action" onClick={() => addItem('room')}>+ Soba</button>
        <button type="button" className="row-action" onClick={() => addItem('wall')}>+ Zid</button>
        <button type="button" className="row-action" onClick={() => addItem('door')}>+ Vrata</button>
        <button
          type="button"
          className="row-action danger"
          disabled={!selectedId}
          onClick={removeSelected}
        >
          Obriši
        </button>
        <div className="floorplan-canvas-size">
          <label>š
            <input
              type="number"
              value={layout.width}
              min={100}
              step={10}
              onChange={(e) => updateCanvasSize('width', Number(e.target.value))}
            />
          </label>
          <label>v
            <input
              type="number"
              value={layout.height}
              min={100}
              step={10}
              onChange={(e) => updateCanvasSize('height', Number(e.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="floorplan-stage">
        <div className="floorplan editor-canvas">
          <svg
            ref={svgRef}
            className="floorplan-svg"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerMove={onSvgPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerDown={() => setSelectedId(null)}
          >
            <defs>
              <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#E0DACB" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect x="0" y="0" width={layout.width} height={layout.height} fill="url(#grid)" stroke="#5B6878" strokeWidth="0.5" />

            {layout.items.map((item) => {
              const isSelected = selectedId === item.id;
              if (item.type === 'door') {
                return (
                  <g
                    key={item.id}
                    className={`fp-door clickable ${isSelected ? 'selected' : ''}`}
                    transform={`translate(${item.x},${item.y})`}
                    onPointerDown={(e) => onItemPointerDown(e, item, 'move')}
                  >
                    <circle r="6" />
                    <line x1="-6" y1="0" x2="6" y2="0" />
                  </g>
                );
              }
              if (item.type === 'wall') {
                return (
                  <g
                    key={item.id}
                    className={`fp-wall clickable ${isSelected ? 'selected' : ''}`}
                    onPointerDown={(e) => onItemPointerDown(e, item, 'move')}
                  >
                    <rect x={item.x} y={item.y} width={item.w} height={item.h} />
                    {isSelected && (
                      <rect
                        className="fp-handle"
                        x={item.x + item.w - HANDLE / 2}
                        y={item.y + item.h - HANDLE / 2}
                        width={HANDLE}
                        height={HANDLE}
                        onPointerDown={(e) => onItemPointerDown(e, item, 'resize')}
                      />
                    )}
                  </g>
                );
              }
              const cx = item.x + item.w / 2;
              const cy = item.y + item.h / 2;
              return (
                <g
                  key={item.id}
                  className={`fp-${item.type} clickable ${isSelected ? 'selected' : ''}`}
                  onPointerDown={(e) => onItemPointerDown(e, item, 'move')}
                >
                  <rect x={item.x} y={item.y} width={item.w} height={item.h} rx="4" />
                  <text x={cx} y={cy + 4} textAnchor="middle" className="fp-label">{item.label}</text>
                  {isSelected && (
                    <rect
                      className="fp-handle"
                      x={item.x + item.w - HANDLE / 2}
                      y={item.y + item.h - HANDLE / 2}
                      width={HANDLE}
                      height={HANDLE}
                      onPointerDown={(e) => onItemPointerDown(e, item, 'resize')}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="floorplan-side">
          {!selected ? (
            <div className="floorplan-side-empty">
              Izaberite stavku da je uredite, ili dodajte novu sa trake iznad.
              <br /><br />
              <strong>Saveti:</strong>
              <ul>
                <li>Stolovi i sobe se mogu rezervisati.</li>
                <li>Soba mora imati jedinstveni „roomKey" — koristi se u rezervacijama.</li>
                <li>Snap je {GRID} jedinica.</li>
              </ul>
            </div>
          ) : (
            <>
              <div className="section-label" style={{ margin: 0, marginBottom: 12 }}>
                Stavka · {selected.type}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', opacity: 0.7, marginBottom: 10 }}>
                id: {selected.id}
              </div>

              {(selected.type === 'table' || selected.type === 'room') && (
                <>
                  <div className="field-label">Oznaka</div>
                  <input
                    className="field-input"
                    value={selected.label}
                    onChange={(e) => updateItem(selected.id, { label: e.target.value } as Partial<FloorPlanItem>)}
                  />
                  <div className="field-label" style={{ marginTop: 10 }}>Kapacitet</div>
                  <input
                    className="field-input"
                    type="number"
                    min={1}
                    value={selected.capacity}
                    onChange={(e) => updateItem(selected.id, { capacity: Number(e.target.value) } as Partial<FloorPlanItem>)}
                  />
                </>
              )}

              {selected.type === 'room' && (
                <>
                  <div className="field-label" style={{ marginTop: 10 }}>roomKey (rezervacioni ključ)</div>
                  <input
                    className="field-input"
                    value={selected.roomKey}
                    onChange={(e) => updateItem(selected.id, { roomKey: e.target.value } as Partial<FloorPlanItem>)}
                  />
                  <div style={{ fontSize: 11, color: 'var(--rust)', marginTop: 4 }}>
                    Ne menjajte ako postoje aktivne rezervacije.
                  </div>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <div>
                  <div className="field-label">x</div>
                  <input
                    className="field-input"
                    type="number"
                    value={selected.x}
                    step={GRID}
                    onChange={(e) => updateItem(selected.id, { x: Number(e.target.value) } as Partial<FloorPlanItem>)}
                  />
                </div>
                <div>
                  <div className="field-label">y</div>
                  <input
                    className="field-input"
                    type="number"
                    value={selected.y}
                    step={GRID}
                    onChange={(e) => updateItem(selected.id, { y: Number(e.target.value) } as Partial<FloorPlanItem>)}
                  />
                </div>
                {'w' in selected && (
                  <>
                    <div>
                      <div className="field-label">š</div>
                      <input
                        className="field-input"
                        type="number"
                        value={selected.w}
                        step={GRID}
                        min={GRID}
                        onChange={(e) => updateItem(selected.id, { w: Number(e.target.value) } as Partial<FloorPlanItem>)}
                      />
                    </div>
                    <div>
                      <div className="field-label">v</div>
                      <input
                        className="field-input"
                        type="number"
                        value={selected.h}
                        step={GRID}
                        min={GRID}
                        onChange={(e) => updateItem(selected.id, { h: Number(e.target.value) } as Partial<FloorPlanItem>)}
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                className="row-action danger"
                style={{ width: '100%', marginTop: 14 }}
                onClick={removeSelected}
              >
                Obriši stavku
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
