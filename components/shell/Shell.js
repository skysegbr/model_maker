// Shell.js — layout principal: topbar + sidebar + canvas

import { h, useState } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { PaletteSwitcher, ThemeToggle } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa-components.min.js';
import Sidebar from '../sidebar/Sidebar.js';
import DiagramCanvas from '../canvas/DiagramCanvas.js';

export default function Shell() {
  const [selectedTable, setSelectedTable] = useState(null);

  return h('div', { className: 'mm-shell' },
    h('header', { className: 'mm-topbar' },
      h('span', { className: 'mm-logo' }, '⬡ Model Maker'),
      h('span', { className: 'mm-tagline' }, 'Diagrama ER visual'),
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
