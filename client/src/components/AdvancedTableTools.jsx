import { useState } from 'react';

export default function AdvancedTableTools({ columns, visible, setVisible, order, setOrder, density, setDensity, views, onSaveView, onLoadView, onExportSelected, selectedCount }) {
  const [viewName, setViewName] = useState('');
  const move = (direction) => {
    const index = order.indexOf(order.find((key) => visible.includes(key)));
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    const next = [...order]; [next[index], next[target]] = [next[target], next[index]]; setOrder(next);
  };
  return <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2" aria-label="Table preferences">
    <label className="sr-only" htmlFor="table-density">Table density</label><select id="table-density" className="field w-auto" value={density} onChange={(e) => setDensity(e.target.value)}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select>
    <details className="relative"><summary className="button secondary-button cursor-pointer list-none">Columns</summary><div className="absolute left-0 z-20 mt-2 min-w-48 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">{columns.map((column) => <label key={column.key} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={visible.includes(column.key)} onChange={(e) => setVisible(e.target.checked ? [...visible, column.key] : visible.filter((key) => key !== column.key))}/>{column.label}</label>)}<div className="mt-2 flex gap-2"><button className="inline-action" onClick={() => move(-1)}>Move left</button><button className="inline-action" onClick={() => move(1)}>Move right</button></div></div></details>
    <label className="sr-only" htmlFor="saved-table-views">Saved views</label><select id="saved-table-views" className="field w-auto" defaultValue="" onChange={(e) => { if (e.target.value) onLoadView(e.target.value); e.target.value = ''; }}><option value="">Saved views</option>{views.map((view) => <option key={view.name} value={view.name}>{view.name}</option>)}</select>
    <label className="sr-only" htmlFor="new-table-view">Saved view name</label><input id="new-table-view" className="field w-36" value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="Name this view" maxLength={40}/><button className="button secondary-button" disabled={!viewName.trim()} onClick={() => { onSaveView(viewName.trim()); setViewName(''); }}>Save view</button>
    {selectedCount > 0 && <button className="button secondary-button" onClick={onExportSelected}>Export selected ({selectedCount})</button>}
  </div>;
}
