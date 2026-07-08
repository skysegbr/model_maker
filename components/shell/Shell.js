// Shell.js — layout principal: topbar + sidebar + canvas

import { h, useState, useEffect, useRef, useCallback } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { Button, Dialog, PaletteSwitcher, ThemeToggle } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa-components.min.js';
import Sidebar from '../sidebar/Sidebar.js';
import DiagramCanvas from '../canvas/DiagramCanvas.js';
import { useModelCtx } from '../model-context/ModelContext.js';
import { useEntityDialogs } from '../entity-dialogs/useEntityDialogs.js';

export default function Shell() {
  const [selectedTables, setSelectedTables] = useState([]); // seleção múltipla, ordem de clique
  const [confirmNew, setConfirmNew] = useState(false);
  const [focusRequest, setFocusRequest] = useState(null); // { id, n } — centralizar no canvas
  const [fitRequest, setFitRequest] = useState(null);     // { n } — enquadrar tudo no canvas
  const { tables, relations, replaceModel, autoLayout, undo, redo, canUndo, canRedo } = useModelCtx();

  const selectedTable = selectedTables.length ? selectedTables[selectedTables.length - 1] : null;

  // Handlers estáveis (useCallback) para não quebrar o memo dos nós do canvas
  const selectTable = useCallback((id) => setSelectedTables(id ? [id] : []), []);
  const toggleSelect = useCallback((id) =>
    setSelectedTables((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]), []);
  const selectMany = useCallback((ids) => setSelectedTables(ids), []);

  const { requestDeleteTable, requestDeleteTables, dialogs } =
    useEntityDialogs({ selectedTable, onSelectTable: selectTable });
  const isEmpty = tables.length === 0 && relations.length === 0;

  // Refs para o handler de teclado ler o estado mais recente sem re-assinar
  const keyStateRef = useRef(null);
  keyStateRef.current = { selectedTables, tables, requestDeleteTable, requestDeleteTables };

  useEffect(() => {
    function handleKey(e) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
        return;
      }

      // Delete/Escape não valem enquanto se digita ou com foco em diálogo
      const active = document.activeElement;
      const tag = active?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (active?.closest?.('.m-dialog, [role="dialog"]')) return;

      const st = keyStateRef.current;
      if (e.key === 'Escape') { setSelectedTables([]); return; }
      if (e.key === 'Delete' && st.selectedTables.length) {
        const sel = st.tables.filter((t) => st.selectedTables.includes(t.id));
        if (!sel.length) return;
        e.preventDefault();
        if (sel.length > 1) st.requestDeleteTables(sel);
        else st.requestDeleteTable(sel[0]);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [undo, redo]);

  function focusTable(id) {
    setFocusRequest({ id, n: Date.now() }); // n força o efeito mesmo repetindo o id
  }

  function organize() {
    autoLayout();
    setFitRequest({ n: Date.now() }); // enquadra o resultado
  }

  function startNewModel() {
    replaceModel({ tables: [], relations: [] });
    setSelectedTables([]);
    setConfirmNew(false);
  }

  return h('div', { className: 'mm-shell' },
    h('header', { className: 'mm-topbar' },
      h('span', { className: 'mm-logo' }, '⬡ Model Maker'),
      h('span', { className: 'mm-tagline' }, 'Diagrama ER visual'),
      h('div', { className: 'mm-topbar-actions' },
        h('button', {
          className: 'mm-topbar-btn mm-topbar-btn--label',
          onClick: () => setConfirmNew(true),
          disabled: isEmpty,
          title: 'Descartar o modelo atual e começar do zero',
        }, '🗎 Novo'),
        h('button', {
          className: 'mm-topbar-btn mm-topbar-btn--label',
          onClick: organize,
          disabled: tables.length === 0,
          title: 'Organizar tabelas por dependência (Ctrl+Z desfaz)',
        }, '⚏ Organizar'),
        h('button', { className: 'mm-topbar-btn', onClick: undo, disabled: !canUndo, title: 'Desfazer (Ctrl+Z)' }, '↩'),
        h('button', { className: 'mm-topbar-btn', onClick: redo, disabled: !canRedo, title: 'Refazer (Ctrl+Y)' }, '↪'),
      ),
      h('div', { className: 'mm-topbar-tools' },
        h(PaletteSwitcher, { className: 'mm-palette-switcher' }),
        h(ThemeToggle, { className: 'mm-theme-toggle' }),
      ),
    ),
    h('div', { className: 'mm-body' },
      h(Sidebar, { selectedTable, onSelectTable: selectTable, onFocusTable: focusTable }),
      h(DiagramCanvas, {
        selectedTable,
        selectedTables,
        onSelectTable: selectTable,
        onToggleSelect: toggleSelect,
        onSelectMany: selectMany,
        focusRequest,
        fitRequest,
      }),
    ),
    dialogs,
    h(Dialog, {
      open: confirmNew,
      onClose: () => setConfirmNew(false),
      title: 'Novo modelo',
      className: 'mm-entity-dialog',
      actions: h('div', { className: 'mm-dialog-actions' },
        h(Button, { variant: 'tonal', onClick: () => setConfirmNew(false) }, 'Cancelar'),
        h(Button, { variant: 'danger', onClick: startNewModel }, 'Descartar e começar'),
      ),
    },
      h('div', { className: 'mm-dialog-confirm' },
        h('p', null, 'Começar um novo modelo em branco?'),
        h('p', { className: 'mm-dialog-muted' },
          `O modelo atual (${tables.length} tabela(s), ${relations.length} relação(ões)) será substituído. Ctrl+Z desfaz.`),
      ),
    ),
  );
}
