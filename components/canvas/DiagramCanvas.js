// DiagramCanvas.js — canvas SVG com tabelas e relações draggable

import { h, useRef, useState, useCallback, useEffect, useContextMenu } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { ContextMenu } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa-components.min.js';
import { useModelCtx } from '../model-context/ModelContext.js';
import { TableNode } from './TableNode.js';
import { RelationLines } from './RelationLines.js';
import { EntityDeleteDialog, EntityEditDialog } from '../entity-dialogs/EntityDialogs.js';

const SVG_W = 2600;
const SVG_H = 1900;

export default function DiagramCanvas({ selectedTable, onSelectTable }) {
  const { tables, relations, moveTable, commitMove, updateTable, removeTable, updateColumn, removeColumn, removeRelation } = useModelCtx();
  const svgRef    = useRef(null);
  const tablesRef  = useRef(tables);
  tablesRef.current = tables;
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: SVG_W, h: SVG_H });
  const viewBoxRef = useRef({ x: 0, y: 0, w: SVG_W, h: SVG_H });
  viewBoxRef.current = viewBox;
  const { menu, openMenu, closeMenu } = useContextMenu();
  const [contextTarget, setContextTarget] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const startDrag = useCallback((tableId, e) => {
    e.preventDefault();
    const table   = tablesRef.current.find((t) => t.id === tableId);
    const svgEl   = svgRef.current;
    const vb      = viewBoxRef.current;
    const rect    = svgEl.getBoundingClientRect();
    const groupEl = svgEl.querySelector(`[data-table-id="${tableId}"]`);

    function toSVG(cx, cy) {
      return {
        x: vb.x + (cx - rect.left) / rect.width  * vb.w,
        y: vb.y + (cy - rect.top)  / rect.height * vb.h,
      };
    }

    const origin  = toSVG(e.clientX, e.clientY);
    const offsetX = origin.x - table.x;
    const offsetY = origin.y - table.y;
    let finalX = table.x;
    let finalY = table.y;

    function onMove(mv) {
      const pos = toSVG(mv.clientX, mv.clientY);
      finalX = Math.max(0, pos.x - offsetX);
      finalY = Math.max(0, pos.y - offsetY);
      groupEl?.setAttribute('transform', `translate(${finalX},${finalY})`);
      moveTable(tableId, finalX, finalY); // atualiza dragPos → linhas acompanham
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      commitMove(tableId, finalX, finalY); // grava UMA entrada no histórico
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [moveTable, commitMove]);

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

  const openTableMenu = useCallback((tableId, e) => {
    e.stopPropagation();
    setContextTarget({ type: 'table', tableId });
    onSelectTable(tableId);
    openMenu(e);
  }, [onSelectTable, openMenu]);

  const openColumnMenu = useCallback((tableId, columnId, e) => {
    e.stopPropagation();
    setContextTarget({ type: 'column', tableId, columnId });
    onSelectTable(tableId);
    openMenu(e);
  }, [onSelectTable, openMenu]);

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

  // ── Zoom / Pan ──────────────────────────────────────────────────────────

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    setViewBox((vb) => {
      const newW = Math.min(SVG_W, Math.max(600, vb.w * factor));
      const newH = (SVG_H / SVG_W) * newW;
      const mx   = (e.clientX - rect.left) / rect.width;
      const my   = (e.clientY - rect.top)  / rect.height;
      return {
        x: Math.max(0, Math.min(SVG_W - newW, vb.x + (vb.w - newW) * mx)),
        y: Math.max(0, Math.min(SVG_H - newH, vb.y + (vb.h - newH) * my)),
        w: newW, h: newH,
      };
    });
  }, []);

  // viewBox é read-only como propriedade DOM — deve ser definido via setAttribute
  // Roda antes do paint (índice mais alto de prioridade), garantindo sem flash
  useEffect(() => {
    svgRef.current?.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  }, [viewBox]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    svgEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => svgEl.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  function startPan(e) {
    if (e.button !== 0) return;
    const cls  = e.target.getAttribute('class') || '';
    const isBg = cls.includes('mm-canvas-bg') || e.target === svgRef.current;
    if (!isBg) return;
    e.preventDefault();
    const svgEl  = svgRef.current;
    const rect   = svgEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const vb0    = { ...viewBoxRef.current };

    function onMove(mv) {
      const dx = (mv.clientX - startX) / rect.width  * vb0.w;
      const dy = (mv.clientY - startY) / rect.height * vb0.h;
      setViewBox({
        x: Math.max(0, Math.min(SVG_W - vb0.w, vb0.x - dx)),
        y: Math.max(0, Math.min(SVG_H - vb0.h, vb0.y - dy)),
        w: vb0.w, h: vb0.h,
      });
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function zoomIn() {
    setViewBox((vb) => {
      const newW = Math.max(600, vb.w / 1.25);
      const newH = (SVG_H / SVG_W) * newW;
      const cx   = vb.x + vb.w / 2;
      const cy   = vb.y + vb.h / 2;
      return { x: Math.max(0, cx - newW / 2), y: Math.max(0, cy - newH / 2), w: newW, h: newH };
    });
  }

  function zoomOut() {
    setViewBox((vb) => {
      const newW = Math.min(SVG_W, vb.w * 1.25);
      const newH = (SVG_H / SVG_W) * newW;
      const cx   = vb.x + vb.w / 2;
      const cy   = vb.y + vb.h / 2;
      return {
        x: Math.max(0, Math.min(SVG_W - newW, cx - newW / 2)),
        y: Math.max(0, Math.min(SVG_H - newH, cy - newH / 2)),
        w: newW, h: newH,
      };
    });
  }

  function zoomReset() {
    setViewBox({ x: 0, y: 0, w: SVG_W, h: SVG_H });
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

  return h('div', { className: 'mm-canvas-wrap' },
    h('svg', {
      ref: svgRef,
      className: 'mm-canvas-svg',
      onMouseDown: startPan,
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
    h('div', { className: 'mm-zoom-controls' },
      h('button', { className: 'mm-zoom-btn', title: 'Ampliar (+)', onClick: zoomIn }, '+'),
      h('button', { className: 'mm-zoom-btn', title: 'Reduzir (−)', onClick: zoomOut }, '−'),
      h('button', { className: 'mm-zoom-btn', title: 'Redefinir zoom', onClick: zoomReset }, '⊟'),
    ),
  );
}
