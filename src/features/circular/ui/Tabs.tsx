import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: ReactNode;
}

interface TabsProps<T extends string> {
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  idPrefix: string;
}

/** WAI-ARIA tablist with arrow-key navigation. Panels use `${idPrefix}-panel-${id}`. */
export function Tabs<T extends string>({ label, items, value, onChange, idPrefix }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (event: KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + items.length) % items.length;
    onChange(items[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div className="cso-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button key={item.id} ref={(node) => { refs.current[index] = node; }} type="button" role="tab"
          id={`${idPrefix}-tab-${item.id}`} aria-controls={`${idPrefix}-panel-${item.id}`}
          aria-selected={item.id === value} tabIndex={item.id === value ? 0 : -1}
          className={`cso-tab ${item.id === value ? "is-active" : ""}`}
          onClick={() => onChange(item.id)} onKeyDown={(event) => onKey(event, index)}>
          {item.label}{item.badge !== undefined ? <span className="cso-tab__badge">{item.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ idPrefix, id, active, children }: { idPrefix: string; id: string; active: boolean; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`} hidden={!active} className="cso-tabpanel" tabIndex={0}>
      {active ? children : null}
    </div>
  );
}
