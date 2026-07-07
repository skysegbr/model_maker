// DiagramCanvas.js — canvas SVG com tabelas e relações draggable, zoom e pan

import { h, useRef, useState, useCallback, useEffect, useContextMenu } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { ContextMenu } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa-components.min.js';
import { CANVAS_SIZE } from '../../data.js';
import { useModelCtx } from '../model-context/ModelContext.js';
import { TableNode, TABLE_W, tableNodeHeight } from './TableNode.js';
import { RelationLines } from './RelationLines.js';
import { useEntityDialogs } from '../entity-dialogs/useEntityDialogs.js';

const WORLD_W = CANVAS_SIZE.w;
const WORLD_H = CANVAS_SIZE.h;
const MIN_VIEW_W = 420;      // zoom máximo (mais perto)
const MAX_VIEW_W = WORLD_W;  // zoom mínimo (mais longe)
const DEFAULT_VIEW_W = 1400;
const FIT_PAD = 80;

// Prende a vista ao mundo com folga de overscroll (60% da vista) — sem a
// folga, conteúdo encostado na borda do mundo não pode ser puxado para o
// centro da tela e o pan parece "travado"
function clampAxis(pos, view, world) {
  const slack = view * 0.6;
  const min = -slack;
  const max = world - view + slack;
  if (min > max) return (world - view) / 2;
  return Math.max(min, Math.min(max, pos));
}

// A vista mantém sempre a proporção da tela — o zoom só ajusta a escala
function clampView(vb) {
  const ratio = vb.h / vb.w;
  const w = Math.min(MAX_VIEW_W, Math.max(MIN_VIEW_W, vb.w));
  const h = w * ratio;
  return { x: clampAxis(vb.x, w, WORLD_W), y: clampAxis(vb.y, h, WORLD_H), w, h };
}

export default function DiagramCanvas({ selectedTable, onSelectTable }) {
  const { tables, relations, moveTable, commitMove, removeRelation, canvasView } = useModelCtx();
  const svgRef    = useRef(null);
  const tablesRef  = useRef(tables);
  tablesRef.current = tables;
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: DEFAULT_VIEW_W, h: DEFAULT_VIEW_W * 0.65 });
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;
  const { menu, openMenu, closeMenu } = useContextMenu();
  const [contextTarget, setContextTarget] = useState(null);
  const { editTable, editColumn, requestDeleteTable, requestDeleteColumn, dialogs } =
    useEntityDialogs({ selectedTable, onSelectTable });

  // ── Drag de tabelas ─────────────────────────────────────────────────────

  const startDrag = useCallback((tableId, e) => {
    e.preventDefault();
    const table   = tablesRef.current.find((t) => t.id === tableId);
    const svgEl   = svgRef.current;
    const rect    = svgEl.getBoundingClientRect();
    const groupEl = svgEl.querySelector(`[data-table-id="${tableId}"]`);
    const maxX    = WORLD_W - TABLE_W;
    const maxY    = WORLD_H - tableNodeHeight(table.columns);

    // viewBox e tela têm a mesma proporção → mapeamento linear exato
    function toSVG(cx, cy) {
      const vb = viewBoxRef.current;
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
      finalX = Math.min(maxX, Math.max(0, pos.x - offsetX));
      finalY = Math.min(maxY, Math.max(0, pos.y - offsetY));
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

  // ── Menu de contexto ────────────────────────────────────────────────────

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

  function editFromMenu() {
    if (contextTarget?.type === 'table') {
      const table = findTableTarget();
      if (table) editTable(table);
      return;
    }
    const target = findColumnTarget();
    if (target) editColumn(target.table.id, target.column);
  }

  function deleteFromMenu() {
    if (contextTarget?.type === 'table') {
      const table = findTableTarget();
      if (table) requestDeleteTable(table);
      return;
    }
    const target = findColumnTarget();
    if (target) requestDeleteColumn(target.table.id, target.column);
  }

  function contextMenuItems() {
    const isTable = contextTarget?.type === 'table';
    return [
      { label: isTable ? 'Editar tabela' : 'Editar coluna', icon: '✎', onClick: editFromMenu },
      { divider: true },
      { label: isTable ? 'Apagar tabela' : 'Apagar coluna', icon: '×', danger: true, onClick: deleteFromMenu },
    ];
  }

  // ── Zoom / Pan ──────────────────────────────────────────────────────────

  // Mantém a proporção do viewBox igual à da tela — sem isso o SVG
  // "letterboxa" o conteúdo e todo o mapeamento mouse→mundo fica errado
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const sync = () => {
      const rect = svgEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = rect.height / rect.width;
      setViewBox((vb) => clampView({ ...vb, h: vb.w * ratio }));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(svgEl);
    return () => ro.disconnect();
  }, []);

  // viewBox é read-only como propriedade DOM — deve ser definido via setAttribute
  useEffect(() => {
    svgRef.current?.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    canvasView.current = viewBox; // tabelas novas nascem no centro da vista
  }, [viewBox]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const factor = Math.exp(e.deltaY * 0.0012);
    setViewBox((vb) => {
      const w = Math.min(MAX_VIEW_W, Math.max(MIN_VIEW_W, vb.w * factor));
      const scale = w / vb.w;
      const h = vb.h * scale;
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top)  / rect.height;
      // o ponto do mundo sob o cursor permanece fixo durante o zoom
      const px = vb.x + mx * vb.w;
      const py = vb.y + my * vb.h;
      return clampView({ x: px - mx * w, y: py - my * h, w, h });
    });
  }, []);

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
    const rect   = svgRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const vb0    = { ...viewBoxRef.current };

    function onMove(mv) {
      const dx = (mv.clientX - startX) / rect.width  * vb0.w;
      const dy = (mv.clientY - startY) / rect.height * vb0.h;
      setViewBox(clampView({ x: vb0.x - dx, y: vb0.y - dy, w: vb0.w, h: vb0.h }));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const zoomBy = (factor) => setViewBox((vb) => {
    const w = Math.min(MAX_VIEW_W, Math.max(MIN_VIEW_W, vb.w * factor));
    const scale = w / vb.w;
    const h = vb.h * scale;
    return clampView({ x: vb.x + (vb.w - w) / 2, y: vb.y + (vb.h - h) / 2, w, h });
  });

  // Enquadra todas as tabelas (ou volta à vista padrão se não há nenhuma)
  function zoomFit() {
    const rect  = svgRef.current?.getBoundingClientRect();
    const ratio = rect?.width ? rect.height / rect.width : 0.65;
    const list  = tablesRef.current;

    if (!list.length) {
      setViewBox(clampView({ x: 0, y: 0, w: DEFAULT_VIEW_W, h: DEFAULT_VIEW_W * ratio }));
      return;
    }

    const minX = Math.min(...list.map((t) => t.x)) - FIT_PAD;
    const minY = Math.min(...list.map((t) => t.y)) - FIT_PAD;
    const maxX = Math.max(...list.map((t) => t.x + TABLE_W)) + FIT_PAD;
    const maxY = Math.max(...list.map((t) => t.y + tableNodeHeight(t.columns))) + FIT_PAD;

    let w = maxX - minX;
    if ((maxY - minY) / w > ratio) w = (maxY - minY) / ratio;
    w = Math.min(MAX_VIEW_W, Math.max(MIN_VIEW_W, w));
    const h = w * ratio;
    setViewBox(clampView({
      x: (minX + maxX) / 2 - w / 2,
      y: (minY + maxY) / 2 - h / 2,
      w, h,
    }));
  }

  // ── Render ──────────────────────────────────────────────────────────────

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
      h('rect', { className: 'mm-canvas-bg', width: WORLD_W, height: WORLD_H, fill: 'url(#mm-grid)' }),

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
    ),

    // Estado vazio como overlay HTML — sempre centralizado, independe do zoom
    tables.length === 0 && h('div', { className: 'mm-canvas-empty-overlay' },
      h('p', { className: 'mm-canvas-empty' }, 'Nenhuma tabela ainda.'),
      h('p', { className: 'mm-canvas-empty-sub' }, 'Use o painel à esquerda para criar tabelas.'),
    ),

    h(ContextMenu, {
      open: menu.open && Boolean(contextTarget),
      x: menu.x,
      y: menu.y,
      onClose: closeMenu,
      ariaLabel: contextTarget?.type === 'table' ? 'Ações da tabela' : 'Ações da coluna',
      items: contextMenuItems(),
    }),
    dialogs,
    h('div', { className: 'mm-zoom-controls' },
      h('button', { className: 'mm-zoom-btn', title: 'Ampliar', onClick: () => zoomBy(1 / 1.25) }, '+'),
      h('button', { className: 'mm-zoom-btn', title: 'Reduzir', onClick: () => zoomBy(1.25) }, '−'),
      h('button', { className: 'mm-zoom-btn', title: 'Enquadrar tabelas', onClick: zoomFit }, '⛶'),
    ),
  );
}
