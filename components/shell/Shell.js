// Shell.js — layout principal: topbar + sidebar + canvas

import { h, useState, useEffect } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { PaletteSwitcher, ThemeToggle } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa-components.min.js';
import Sidebar from '../sidebar/Sidebar.js';
import DiagramCanvas from '../canvas/DiagramCanvas.js';
import { useModelCtx } from '../model-context/ModelContext.js';

export default function Shell() {
  const [selectedTable, setSelectedTable] = useState(null);
  const { undo, redo, canUndo, canRedo } = useModelCtx();

  useEffect(() => {
    function handleKey(e) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [undo, redo]);

  return h('div', { className: 'mm-shell' },
    h('header', { className: 'mm-topbar' },
      h('span', { className: 'mm-logo' }, '⬡ Model Maker'),
      h('span', { className: 'mm-tagline' }, 'Diagrama ER visual'),
      h('div', { className: 'mm-topbar-actions' },
        h('button', { className: 'mm-topbar-btn', onClick: undo, disabled: !canUndo, title: 'Desfazer (Ctrl+Z)' }, '↩'),
        h('button', { className: 'mm-topbar-btn', onClick: redo, disabled: !canRedo, title: 'Refazer (Ctrl+Y)' }, '↪'),
      ),
      h('div', { className: 'mm-topbar-tools' },
        h(PaletteSwitcher, { className: 'mm-palette-switcher' }),
        h(ThemeToggle, { className: 'mm-theme-toggle' }),
      ),
    ),
    h('div', { className: 'mm-body' },
      h(Sidebar, { selectedTable, onSelectTable: setSelectedTable }),
      h(DiagramCanvas, { selectedTable, onSelectTable: setSelectedTable }),
    ),
  );
}
