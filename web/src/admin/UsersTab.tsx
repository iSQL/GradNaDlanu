import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { SELA_ZABARI } from '../lib/villages';
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, isServiceCategory } from '../lib/usluge';
import type { AdminUserRow, Location } from '../types';
import type { Role } from '../lib/auth';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'admin',
  business: 'vlasnik',
  user: 'posetilac',
  guest: 'gost',
  curator: 'kustos',
  majstor: 'majstor',
};

function serviceCatLabel(id: string): string {
  return isServiceCategory(id) ? SERVICE_CATEGORY_LABELS[id] : id;
}

export function UsersTab() {
  const ctx = useOutletContext<AppContext>();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allObjects, setAllObjects] = useState<Location[]>([]);
  const [grantPicker, setGrantPicker] = useState<{ userId: number; locationId: number } | null>(null);
  const [curatorPicker, setCuratorPicker] = useState<{ userId: number; village: string } | null>(null);
  const [majstorPicker, setMajstorPicker] = useState<{ userId: number; category: string } | null>(null);

  const reload = async () => {
    setUsers(await api.adminListUsers(q || undefined));
  };

  useEffect(() => {
    reload().catch((e: Error) => setError(e.message));
    api.adminListLocations().then(setAllObjects).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => reload().catch((e: Error) => setError(e.message)), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const setRole = async (u: AdminUserRow, role: Role) => {
    setBusyId(u.id);
    setError(null);
    try {
      await api.adminUpdateUser(u.id, { role });
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const grant = async (u: AdminUserRow, locationId: number) => {
    setBusyId(u.id);
    setError(null);
    try {
      await api.adminGrantOwnership(u.id, locationId);
      setGrantPicker(null);
      await reload();
      await ctx.reloadCurrentUser();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (u: AdminUserRow, locationId: number) => {
    if (!window.confirm('Ukinuti vlasništvo objekta?')) return;
    setBusyId(u.id);
    setError(null);
    try {
      await api.adminRevokeOwnership(u.id, locationId);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const grantOptions = useMemo(() => {
    if (!grantPicker) return [];
    const owned = new Set(
      users.find((u) => u.id === grantPicker.userId)?.ownedLocations.map((o) => o.id) ?? [],
    );
    return allObjects.filter((o) => !owned.has(o.id));
  }, [grantPicker, allObjects, users]);

  const curatorOptions = useMemo(() => {
    if (!curatorPicker) return [];
    const already = new Set(
      users.find((u) => u.id === curatorPicker.userId)?.curatedVillages ?? [],
    );
    return SELA_ZABARI.filter((v) => !already.has(v));
  }, [curatorPicker, users]);

  const grantCurator = async (u: AdminUserRow, village: string) => {
    setBusyId(u.id);
    setError(null);
    try {
      await api.adminGrantCurator(u.id, village);
      setCuratorPicker(null);
      await reload();
      await ctx.reloadCurrentUser();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const revokeCurator = async (u: AdminUserRow, village: string) => {
    if (!window.confirm(`Ukinuti kustoska prava za "${village}"?`)) return;
    setBusyId(u.id);
    setError(null);
    try {
      await api.adminRevokeCurator(u.id, village);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const majstorOptions = useMemo(() => {
    if (!majstorPicker) return [];
    const already = new Set(
      users.find((u) => u.id === majstorPicker.userId)?.majstorCategories ?? [],
    );
    return SERVICE_CATEGORIES.filter((c) => !already.has(c));
  }, [majstorPicker, users]);

  const grantMajstor = async (u: AdminUserRow, category: string) => {
    setBusyId(u.id);
    setError(null);
    try {
      await api.adminGrantMajstor(u.id, category);
      setMajstorPicker(null);
      await reload();
      await ctx.reloadCurrentUser();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const revokeMajstor = async (u: AdminUserRow, category: string) => {
    if (!window.confirm(`Ukinuti majstorska prava za "${serviceCatLabel(category)}"?`)) return;
    setBusyId(u.id);
    setError(null);
    try {
      await api.adminRevokeMajstor(u.id, category);
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="users-tab">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="section-label" style={{ margin: 0 }}>Korisnici · {users.length}</div>
        <input
          className="field-input"
          placeholder="Pretraga po imenu ili e-pošti…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 280 }}
        />
      </div>

      {error && <div className="login-error">{error}</div>}

      <div className="users-list">
        {users.map((u) => (
          <div className="user-row" key={u.id}>
            <div>
              <div className="favorite-name">{u.displayName}</div>
              <div className="favorite-meta">{u.email} · od {formatDate(u.createdAt)}</div>
              {u.ownedLocations.length > 0 && (
                <div className="user-owned">
                  Vlasnik:&nbsp;
                  {u.ownedLocations.map((o, i) => (
                    <span key={o.id}>
                      {i > 0 && ', '}
                      <span>{o.name}</span>
                      <button className="user-owned-x" onClick={() => revoke(u, o.id)} title="Ukini">×</button>
                    </span>
                  ))}
                </div>
              )}
              {u.curatedVillages.length > 0 && (
                <div className="user-owned">
                  Kustos sela:&nbsp;
                  {u.curatedVillages.map((v, i) => (
                    <span key={v}>
                      {i > 0 && ', '}
                      <span>{v}</span>
                      <button className="user-owned-x" onClick={() => revokeCurator(u, v)} title="Ukini">×</button>
                    </span>
                  ))}
                </div>
              )}
              {u.majstorCategories.length > 0 && (
                <div className="user-owned">
                  Majstor:&nbsp;
                  {u.majstorCategories.map((c, i) => (
                    <span key={c}>
                      {i > 0 && ', '}
                      <span>{serviceCatLabel(c)}</span>
                      <button className="user-owned-x" onClick={() => revokeMajstor(u, c)} title="Ukini">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <select
              className="field-select"
              value={u.role}
              disabled={busyId === u.id}
              onChange={(e) => setRole(u, e.target.value as Role)}
              style={{ maxWidth: 150 }}
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <div>
              {grantPicker?.userId === u.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    className="field-select"
                    value={grantPicker.locationId || ''}
                    onChange={(e) => setGrantPicker({ userId: u.id, locationId: Number(e.target.value) })}
                  >
                    <option value="">— odaberi objekat —</option>
                    {grantOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                  <button
                    className="row-action"
                    disabled={!grantPicker.locationId || busyId === u.id}
                    onClick={() => grant(u, grantPicker.locationId)}
                  >
                    OK
                  </button>
                  <button className="row-action" onClick={() => setGrantPicker(null)}>×</button>
                </div>
              ) : curatorPicker?.userId === u.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    className="field-select"
                    value={curatorPicker.village}
                    onChange={(e) => setCuratorPicker({ userId: u.id, village: e.target.value })}
                  >
                    <option value="">— odaberi selo —</option>
                    {curatorOptions.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <button
                    className="row-action"
                    disabled={!curatorPicker.village || busyId === u.id}
                    onClick={() => grantCurator(u, curatorPicker.village)}
                  >
                    OK
                  </button>
                  <button className="row-action" onClick={() => setCuratorPicker(null)}>×</button>
                </div>
              ) : majstorPicker?.userId === u.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    className="field-select"
                    value={majstorPicker.category}
                    onChange={(e) => setMajstorPicker({ userId: u.id, category: e.target.value })}
                  >
                    <option value="">— odaberi kategoriju —</option>
                    {majstorOptions.map((c) => (
                      <option key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                  <button
                    className="row-action"
                    disabled={!majstorPicker.category || busyId === u.id}
                    onClick={() => grantMajstor(u, majstorPicker.category)}
                  >
                    OK
                  </button>
                  <button className="row-action" onClick={() => setMajstorPicker(null)}>×</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="row-action" onClick={() => setGrantPicker({ userId: u.id, locationId: 0 })}>
                    + Dodeli objekat
                  </button>
                  <button className="row-action" onClick={() => setCuratorPicker({ userId: u.id, village: '' })}>
                    + Dodeli selo
                  </button>
                  <button className="row-action" onClick={() => setMajstorPicker({ userId: u.id, category: '' })}>
                    + Dodeli uslugu
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
