// DiagramCanvas.js — canvas SVG com tabelas e relações draggable

import { h, useRef, useState, useContextMenu } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.js';
import { ContextMenu } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa-components.js';
import { useModelCtx } from '../model-context/ModelContext.js';
import { TableNode } from './TableNode.js';
import { RelationLines } from './RelationLines.js';
import { EntityDeleteDialog, EntityEditDialog } from '../entity-dialogs/EntityDialogs.js';

const SVG_W = 2600;
const SVG_H = 1900;

export default function DiagramCanvas({ selectedTable, onSelectTable }) {
  const { tables, relations, moveTable, updateTable, removeTable, updateColumn, removeColumn, removeRelation } = useModelCtx();
  const containerRef = useRef(null);
  const { menu, openMenu, closeMenu } = useContextMenu();
  const [contextTarget, setContextTarget] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  /** Converte coordenadas do mouse (viewport) para coordenadas SVG */
  function toSVGCoords(clientX, clientY) {
    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    return {
      x: clientX - rect.left + el.scrollLeft,
      y: clientY - rect.top  + el.scrollTop,
    };
  }

  function startDrag(tableId, e) {
    e.preventDefault();
    const table   = tables.find((t) => t.id === tableId);
    const origin  = toSVGCoords(e.clientX, e.clientY);
    const offsetX = origin.x - table.x;
    const offsetY = origin.y - table.y;

    function onMove(e) {
      const pos = toSVGCoords(e.clientX, e.clientY);
      moveTable(tableId, Math.max(0, pos.x - offsetX), Math.max(0, pos.y - offsetY));
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function findColumnTarget() {
    if (contextTarget?.type !== 'column') return null;
    const table = tables.find((t) => t.id === contextTarget.tableId);
    const column = table?.columns.find((c) => c.id === contextTarget.columnId);
    return table && column ? { table, column } : null;
  }

  function findTableTarget() {
    if (contextTarget?.type !== 'table') return null;
    return tables.find((t) => t.id === contextTarget.tableId) || null;
  }

  function openTableMenu(tableId, e) {
    e.stopPropagation();
    setContextTarget({ type: 'table', tableId });
    onSelectTable(tableId);
    openMenu(e);
  }

  function openColumnMenu(tableId, columnId, e) {
    e.stopPropagation();
    setContextTarget({ type: 'column', tableId, columnId });
    onSelectTable(tableId);
    openMenu(e);
  }

  function closeEntityMenu() {
    closeMenu();
  }

  function editColumnFromMenu() {
    const target = findColumnTarget();
    if (!target) return;
    setEditDraft({
      kind: 'column',
      tableId: target.table.id,
      columnId: target.column.id,
      name: target.column.name,
      type: target.column.type,
      error: '',
    });
  }

  function deleteColumnFromMenu() {
    const target = findColumnTarget();
    if (!target) return;
    setDeleteTarget({
      kind: 'column',
      tableId: target.table.id,
      columnId: target.column.id,
      name: target.column.name,
    });
  }

  function editTableFromMenu() {
    const table = findTableTarget();
    if (!table) return;
    setEditDraft({ kind: 'table', tableId: table.id, name: table.name, error: '' });
  }

  function deleteTableFromMenu() {
    const table = findTableTarget();
    if (!table) return;
    setDeleteTarget({ kind: 'table', tableId: table.id, name: table.name });
  }

  function updateEditDraft(patch) {
    setEditDraft((draft) => draft ? { ...draft, ...patch, error: '' } : draft);
  }

  function closeEditDialog() {
    setEditDraft(null);
  }

  function submitEditDialog() {
    if (!editDraft) return;
    const cleanName = editDraft.name.trim();
    if (!cleanName) {
      setEditDraft((draft) => ({ ...draft, error: 'Informe um nome.' }));
      return;
    }

    if (editDraft.kind === 'table') {
      updateTable(editDraft.tableId, { name: cleanName });
      closeEditDialog();
      return;
    }

    updateColumn(editDraft.tableId, editDraft.columnId, {
      name: cleanName,
      type: editDraft.type,
    });
    closeEditDialog();
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
  }

  function confirmDeleteDialog() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'table') {
      removeTable(deleteTarget.tableId);
      if (selectedTable === deleteTarget.tableId) onSelectTable(null);
    } else {
      removeColumn(deleteTarget.tableId, deleteTarget.columnId);
    }
    closeDeleteDialog();
  }

  function contextMenuItems() {
    if (contextTarget?.type === 'table') {
      return [
        { label: 'Editar tabela', icon: '✎', onClick: editTableFromMenu },
        { divider: true },
        { label: 'Apagar tabela', icon: '×', danger: true, onClick: deleteTableFromMenu },
      ];
    }

    return [
      { label: 'Editar coluna', icon: '✎', onClick: editColumnFromMenu },
      { divider: true },
      { label: 'Apagar coluna', icon: '×', danger: true, onClick: deleteColumnFromMenu },
    ];
  }

  return h('div', { ref: containerRef, className: 'mm-canvas-wrap' },
    h('svg', {
      className: 'mm-canvas-svg',
      width: SVG_W,
      height: SVG_H,
      onClick: () => onSelectTable(null),
    },
      // Grade de pontos
      h('defs', null,
        h('pattern', {
          id: 'mm-grid',
          x: 0, y: 0,
          width: 24, height: 24,
          patternUnits: 'userSpaceOnUse',
        },
          h('circle', { className: 'mm-grid-dot', cx: 1.5, cy: 1.5, r: 1.5 }),
        ),
      ),
      h('rect', { className: 'mm-canvas-bg', width: SVG_W, height: SVG_H, fill: 'url(#mm-grid)' }),

      // Relações (abaixo dos nós)
      h(RelationLines, { tables, relations, onRemove: removeRelation }),

      // Nós de tabela
      ...tables.map((table) =>
        h(TableNode, {
          key: table.id,
          table,
          selected: selectedTable === table.id,
          onSelect: onSelectTable,
          onDragStart: startDrag,
          onTableContextMenu: openTableMenu,
          onColumnContextMenu: openColumnMenu,
        })
      ),

      // Mensagem de estado vazio
      tables.length === 0 && h('g', null,
        h('text', {
          className: 'mm-canvas-empty',
          x: SVG_W / 2, y: SVG_H / 2 - 12,
          'text-anchor': 'middle',
        }, 'Nenhuma tabela ainda.'),
        h('text', {
          className: 'mm-canvas-empty-sub',
          x: SVG_W / 2, y: SVG_H / 2 + 14,
          'text-anchor': 'middle',
        }, 'Use o painel à esquerda para criar tabelas.'),
      ),
    ),
    h(ContextMenu, {
      open: menu.open && Boolean(contextTarget),
      x: menu.x,
      y: menu.y,
      onClose: closeEntityMenu,
      ariaLabel: contextTarget?.type === 'table' ? 'Ações da tabela' : 'Ações da coluna',
      items: contextMenuItems(),
    }),
    h(EntityEditDialog, {
      draft: editDraft,
      onChange: updateEditDraft,
      onCancel: closeEditDialog,
      onSubmit: submitEditDialog,
    }),
    h(EntityDeleteDialog, {
      target: deleteTarget,
      onCancel: closeDeleteDialog,
      onConfirm: confirmDeleteDialog,
    }),
  );
}
