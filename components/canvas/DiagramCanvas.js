// DiagramCanvas.js — canvas SVG com tabelas e relações draggable, zoom e pan

import { h, useRef, useState, useCallback, useEffect, useContextMenu } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { ContextMenu } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa-components.min.js';
import { CANVAS_SIZE, CARDINALITIES } from '../../data.js';
import { useModelCtx } from '../model-context/ModelContext.js';
import { TableNode, TABLE_W, tableNodeHeight, tableAnchors } from './TableNode.js';
import { RelationLines, bezierPath } from './RelationLines.js';
import { Minimap } from './Minimap.js';
import { useEntityDialogs } from '../entity-dialogs/useEntityDialogs.js';

const WORLD_W = CANVAS_SIZE.w;
const WORLD_H = CANVAS_SIZE.h;
const MIN_VIEW_W = 420;      // zoom máximo (mais perto)
const MAX_VIEW_W = WORLD_W;  // zoom mínimo (mais longe)
const DEFAULT_VIEW_W = 1400;
const FIT_PAD = 80;
const GRID = 24;             // passo do snap (igual à grade de pontos)

const snap = (v) => Math.round(v / GRID) * GRID;

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

export default function DiagramCanvas({ selectedTable, onSelectTable, focusRequest, fitRequest }) {
  const { tables, relations, moveTable, commitMove, addRelation, updateRelation, removeRelation, canvasView } = useModelCtx();
  const svgRef    = useRef(null);
  const tablesRef  = useRef(tables);
  tablesRef.current = tables;
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: DEFAULT_VIEW_W, h: DEFAULT_VIEW_W * 0.65 });
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;
  const pointersRef = useRef(new Map()); // pointers ativos (pinça em touch)
  const zoomFitRef  = useRef(null);      // zoomFit mais recente, para efeitos
  const { menu, openMenu, closeMenu } = useContextMenu();
  const [contextTarget, setContextTarget] = useState(null);
  const [relMenu, setRelMenu] = useState(null); // { relId, x, y } | null
  const [connecting, setConnecting] = useState(null); // { fromId, fx, fy, tx, ty, targetId } | null
  const { editTable, editColumn, requestDeleteTable, requestDeleteColumn, dialogs } =
    useEntityDialogs({ selectedTable, onSelectTable });
  const dialogFnsRef = useRef(null);
  dialogFnsRef.current = { editTable, editColumn };

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
      if (pointersRef.current.size > 1) return; // 2 dedos = pinça, não drag
      const pos = toSVG(mv.clientX, mv.clientY);
      finalX = Math.min(maxX, Math.max(0, snap(pos.x - offsetX)));
      finalY = Math.min(maxY, Math.max(0, snap(pos.y - offsetY)));
      groupEl?.setAttribute('transform', `translate(${finalX},${finalY})`);
      moveTable(tableId, finalX, finalY); // atualiza dragPos → linhas acompanham
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      commitMove(tableId, finalX, finalY); // grava UMA entrada no histórico
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [moveTable, commitMove]);

  // ── Criar relação por arraste (porta → outra tabela) ───────────────────

  const startConnect = useCallback((tableId, side, e) => {
    const table = tablesRef.current.find((t) => t.id === tableId);
    const svgEl = svgRef.current;
    if (!table || !svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const from = tableAnchors(table)[side];

    function toSVG(cx, cy) {
      const vb = viewBoxRef.current;
      return {
        x: vb.x + (cx - rect.left) / rect.width  * vb.w,
        y: vb.y + (cy - rect.top)  / rect.height * vb.h,
      };
    }

    const start = toSVG(e.clientX, e.clientY);
    setConnecting({ fromId: tableId, fx: from.x, fy: from.y, tx: start.x, ty: start.y, targetId: null });

    function findTarget(cx, cy) {
      const el = document.elementFromPoint(cx, cy);
      const id = el?.closest?.('[data-table-id]')?.getAttribute('data-table-id');
      return id && id !== tableId ? id : null;
    }

    function onMove(mv) {
      const pos = toSVG(mv.clientX, mv.clientY);
      const targetId = findTarget(mv.clientX, mv.clientY); // realça o alvo
      setConnecting((c) => c && { ...c, tx: pos.x, ty: pos.y, targetId });
    }

    function onUp(mv) {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const targetId = findTarget(mv.clientX, mv.clientY);
      if (targetId) {
        // origem = lado "1"; colunas ausentes são completadas pelo addRelation
        addRelation({ fromTable: tableId, fromColumn: '', toTable: targetId, toColumn: '', cardinality: '1:N' });
      }
      setConnecting(null);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [addRelation]);

  // ── Duplo clique: editar tabela/coluna ──────────────────────────────────

  const openTableEdit = useCallback((tableId) => {
    const table = tablesRef.current.find((t) => t.id === tableId);
    if (table) dialogFnsRef.current.editTable(table);
  }, []);

  const openColumnEdit = useCallback((tableId, columnId) => {
    const table = tablesRef.current.find((t) => t.id === tableId);
    const column = table?.columns.find((c) => c.id === columnId);
    if (table && column) dialogFnsRef.current.editColumn(table.id, column);
  }, []);

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

  // ── Menu da relação (clique no rótulo de cardinalidade) ────────────────

  const openRelMenu = useCallback((relId, e) => {
    setRelMenu({ relId, x: e.clientX, y: e.clientY });
  }, []);

  function relMenuItems() {
    const rel = relations.find((r) => r.id === relMenu?.relId);
    if (!rel) return [];
    return [
      ...CARDINALITIES.map((c) => ({
        label: c.label,
        icon: rel.cardinality === c.value ? '✓' : '·',
        onClick: () => updateRelation(rel.id, { cardinality: c.value }),
      })),
      { divider: true },
      { label: 'Remover relação', icon: '×', danger: true, onClick: () => removeRelation(rel.id) },
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
      if (pointersRef.current.size > 1) return; // 2 dedos = pinça, não pan
      const dx = (mv.clientX - startX) / rect.width  * vb0.w;
      const dy = (mv.clientY - startY) / rect.height * vb0.h;
      setViewBox(clampView({ x: vb0.x - dx, y: vb0.y - dy, w: vb0.w, h: vb0.h }));
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // Pinça (touch): dois dedos ajustam zoom + pan em torno do ponto médio
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const pts = pointersRef.current;

    function onDown(e) {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    function onMove(e) {
      if (!pts.has(e.pointerId)) return;
      if (pts.size !== 2) {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        return;
      }
      const prev = [...pts.values()];
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const curr = [...pts.values()];
      const dist = (p) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      const mid  = (p) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
      const d0 = dist(prev);
      const d1 = dist(curr);
      if (!d0 || !d1) return;
      const rect = svgEl.getBoundingClientRect();
      const m0 = mid(prev);
      const m1 = mid(curr);
      setViewBox((vb) => {
        const w = Math.min(MAX_VIEW_W, Math.max(MIN_VIEW_W, vb.w * (d0 / d1)));
        const h = vb.h * (w / vb.w);
        // o ponto do mundo sob o ponto médio anterior segue o ponto médio novo
        const px = vb.x + (m0.x - rect.left) / rect.width  * vb.w;
        const py = vb.y + (m0.y - rect.top)  / rect.height * vb.h;
        return clampView({
          x: px - (m1.x - rect.left) / rect.width  * w,
          y: py - (m1.y - rect.top)  / rect.height * h,
          w, h,
        });
      });
    }

    function onUp(e) {
      pts.delete(e.pointerId);
    }

    svgEl.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      svgEl.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // Centraliza a tabela pedida pela sidebar (mantém o zoom atual)
  useEffect(() => {
    if (!focusRequest) return;
    const table = tablesRef.current.find((t) => t.id === focusRequest.id);
    if (!table) return;
    const cx = table.x + TABLE_W / 2;
    const cy = table.y + tableNodeHeight(table.columns) / 2;
    setViewBox((vb) => clampView({ x: cx - vb.w / 2, y: cy - vb.h / 2, w: vb.w, h: vb.h }));
  }, [focusRequest]);

  // Enquadra tudo quando pedido pelo Shell (após "Organizar") — o rAF
  // garante que as novas posições já renderizaram
  useEffect(() => {
    if (!fitRequest) return;
    const id = requestAnimationFrame(() => zoomFitRef.current?.());
    return () => cancelAnimationFrame(id);
  }, [fitRequest]);

  // Navegação pelo minimap: centraliza a vista no ponto clicado
  const navigateTo = useCallback((cx, cy) => {
    setViewBox((vb) => clampView({ x: cx - vb.w / 2, y: cy - vb.h / 2, w: vb.w, h: vb.h }));
  }, []);

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
  zoomFitRef.current = zoomFit;

  // ── Render ──────────────────────────────────────────────────────────────

  return h('div', { className: 'mm-canvas-wrap' },
    h('svg', {
      ref: svgRef,
      className: 'mm-canvas-svg',
      onPointerDown: startPan,
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
      // Folha (fundo sólido) + grade — separados porque um fill via CSS
      // sobrescreveria o fill="url(#mm-grid)" do atributo
      h('rect', { className: 'mm-canvas-bg mm-canvas-sheet', width: WORLD_W, height: WORLD_H }),
      h('rect', { className: 'mm-canvas-bg mm-canvas-grid', width: WORLD_W, height: WORLD_H, fill: 'url(#mm-grid)' }),

      // Relações (abaixo dos nós)
      h(RelationLines, { tables, relations, onLabelClick: openRelMenu }),

      // Nós de tabela
      ...tables.map((table) =>
        h(TableNode, {
          key: table.id,
          table,
          selected: selectedTable === table.id,
          connectTarget: connecting?.targetId === table.id,
          onSelect: onSelectTable,
          onDragStart: startDrag,
          onConnectStart: startConnect,
          onTableDblClick: openTableEdit,
          onColumnDblClick: openColumnEdit,
          onTableContextMenu: openTableMenu,
          onColumnContextMenu: openColumnMenu,
        })
      ),

      // Linha temporária durante a criação de relação por arraste
      connecting && h('path', {
        className: 'mm-connect-line',
        d: bezierPath({ x: connecting.fx, y: connecting.fy }, { x: connecting.tx, y: connecting.ty }),
      }),
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
    h(ContextMenu, {
      open: Boolean(relMenu),
      x: relMenu?.x || 0,
      y: relMenu?.y || 0,
      onClose: () => setRelMenu(null),
      ariaLabel: 'Ações da relação',
      items: relMenuItems(),
    }),
    dialogs,
    h('div', { className: 'mm-zoom-controls' },
      h('span', { className: 'mm-zoom-pct', title: 'Nível de zoom' },
        `${Math.round((DEFAULT_VIEW_W / viewBox.w) * 100)}%`),
      h('button', { className: 'mm-zoom-btn', title: 'Ampliar', onClick: () => zoomBy(1 / 1.25) }, '+'),
      h('button', { className: 'mm-zoom-btn', title: 'Reduzir', onClick: () => zoomBy(1.25) }, '−'),
      h('button', { className: 'mm-zoom-btn', title: 'Enquadrar tabelas', onClick: zoomFit }, '⛶'),
    ),
    tables.length > 0 && h(Minimap, { tables, viewBox, onNavigate: navigateTo }),
  );
}
