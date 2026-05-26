import type { CategoryId, FloorPlanLayout } from '../../types';

// Starter templates returned by "Vrati na podrazumevani" in FloorPlanEditPage.
// Coords are snapped to the editor's GRID=10 and sit comfortably inside the
// default 600x400 canvas so the user can immediately tweak / save.

const CAFE_DEFAULT: FloorPlanLayout = {
  width: 600,
  height: 400,
  items: [
    { id: 't1', type: 'table', x:  80, y:  80, w: 60, h: 60, label: 'Sto 1', capacity: 4 },
    { id: 't2', type: 'table', x: 280, y:  80, w: 60, h: 60, label: 'Sto 2', capacity: 4 },
    { id: 't3', type: 'table', x: 480, y:  80, w: 60, h: 60, label: 'Sto 3', capacity: 2 },
    { id: 't4', type: 'table', x:  80, y: 250, w: 60, h: 60, label: 'Sto 4', capacity: 4 },
    { id: 't5', type: 'table', x: 280, y: 250, w: 60, h: 60, label: 'Sto 5', capacity: 4 },
    { id: 't6', type: 'table', x: 480, y: 250, w: 60, h: 60, label: 'Sto 6', capacity: 2 },
    { id: 'd1', type: 'door',  x: 290, y: 380 },
  ],
};

const HOTEL_DEFAULT: FloorPlanLayout = {
  width: 600,
  height: 400,
  items: [
    { id: 'r101', type: 'room', x:  40, y:  60, w: 140, h: 100, label: 'Soba 101', roomKey: '101', capacity: 2 },
    { id: 'r102', type: 'room', x: 230, y:  60, w: 140, h: 100, label: 'Soba 102', roomKey: '102', capacity: 2 },
    { id: 'r103', type: 'room', x: 420, y:  60, w: 140, h: 100, label: 'Soba 103', roomKey: '103', capacity: 3 },
    { id: 'r201', type: 'room', x:  40, y: 220, w: 140, h: 100, label: 'Soba 201', roomKey: '201', capacity: 2 },
    { id: 'r202', type: 'room', x: 230, y: 220, w: 140, h: 100, label: 'Soba 202', roomKey: '202', capacity: 2 },
    { id: 'r203', type: 'room', x: 420, y: 220, w: 140, h: 100, label: 'Soba 203', roomKey: '203', capacity: 4 },
  ],
};

export function defaultLayoutFor(catId: CategoryId): FloorPlanLayout | null {
  if (catId === 'cafe')  return structuredClone(CAFE_DEFAULT);
  if (catId === 'hotel') return structuredClone(HOTEL_DEFAULT);
  return null;
}
