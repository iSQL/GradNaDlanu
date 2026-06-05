import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface TabDef {
  key: string;
  label: string;
  isEmpty?: boolean;
  render: () => React.ReactNode;
}

interface Props {
  tabs: TabDef[];
  paramName?: string;
}

export function ModuleTabs({ tabs, paramName = 'tab' }: Props) {
  const [params, setParams] = useSearchParams();
  const urlKey = params.get(paramName);

  // Default to the first non-empty tab so users don't land on a dimmed placeholder.
  const fallbackKey = useMemo(
    () => tabs.find((t) => !t.isEmpty)?.key ?? tabs[0]?.key ?? '',
    [tabs],
  );

  const activeKey = useMemo(() => {
    const hit = tabs.find((t) => t.key === urlKey);
    if (hit && !hit.isEmpty) return hit.key;
    return fallbackKey;
  }, [tabs, urlKey, fallbackKey]);

  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  const setActive = (key: string) => {
    const next = new URLSearchParams(params);
    next.set(paramName, key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <nav className="module-tabs" role="tablist" aria-label="Sekcije objekta">
        <div className="module-tabs-inner">
          {tabs.map((t) => {
            const isActive = t.key === active?.key;
            const cls = [
              'module-tab',
              isActive ? 'active' : '',
              t.isEmpty ? 'empty' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-disabled={t.isEmpty || undefined}
                tabIndex={t.isEmpty ? -1 : 0}
                className={cls}
                onClick={() => {
                  if (!t.isEmpty) setActive(t.key);
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="module-tab-panel" role="tabpanel">
        {active?.render()}
      </div>
    </>
  );
}
