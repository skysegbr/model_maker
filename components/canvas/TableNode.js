// TableNode.js — nó SVG de uma tabela no diagrama

import { h, memo } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';

export const TABLE_W = 340;
export const HEADER_H = 38;
export const ROW_H = 28;

/**
 * Trunca uma string para caber dentro de `maxPx` pixels.
 * Usa factor empírico de 7.5px por caractere (fontes de 12px usadas nos nós).
 */
function svgTrunc(str, maxPx, charW = 7.5) {
  const max = Math.floor(maxPx / charW);
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

const TITLE_MAX_PX  = TABLE_W - 28;  // margem de 14px em cada lado
const COL_TYPE_PX   = 86;            // espaço reservado para tipos longos
const COL_GAP_PX    = 12;            // respiro entre nome e tipo
const COL_PAD_X     = 10;
const BADGE_W       = 22;
const BADGE_GAP     = 8;

/** Calcula a altura total do nó com base na qtd de colunas */
export function tableNodeHeight(columns) {
  return HEADER_H + columns.length * ROW_H + (columns.length > 0 ? 2 : 0);
}

/** Retorna os pontos de ancoragem (left/right center) de uma tabela */
export function tableAnchors(table) {
  const h = tableNodeHeight(table.columns);
  return {
    left:  { x: table.x,            y: table.y + h / 2 },
    right: { x: table.x + TABLE_W,  y: table.y + h / 2 },
  };
}

export const TableNode = memo(function TableNode({ table, selected, onSelect, onDragStart, onConnectStart, onTableDblClick, onColumnDblClick, onTableContextMenu, onColumnContextMenu }) {
  const totalH = tableNodeHeight(table.columns);

  const grabProps = (id, e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onDragStart(id, e);
  };

  const portProps = (side) => ({
    className: 'mm-node-port',
    cx: side === 'left' ? 0 : TABLE_W,
    cy: totalH / 2,
    r: 6,
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onConnectStart?.(table.id, side, e);
    },
  });

  const clipId = `mm-clip-${table.id}`;

  return h('g', {
    dataset: { tableId: table.id },
    className: `mm-node${selected ? ' mm-node--sel' : ''}`,
    transform: `translate(${table.x},${table.y})`,
    onClick: (e) => { e.stopPropagation(); onSelect(table.id); },
  },
    // ClipPath: limita todo conteúdo aos bounds do card
    h('defs', null,
      h('clipPath', { id: clipId },
        h('rect', { x: 0, y: 0, width: TABLE_W, height: totalH }),
      ),
    ),

    // Sombra
    h('rect', {
      className: 'mm-node-shadow',
      x: 4, y: 4,
      width: TABLE_W, height: totalH,
      rx: 8,
    }),

    // Fundo do corpo
    h('rect', {
      className: 'mm-node-body',
      x: 0, y: 0,
      width: TABLE_W, height: totalH,
      rx: 8,
    }),

    // Cabeçalho (arredondado no topo)
    h('rect', {
      className: 'mm-node-header',
      x: 0, y: 0,
      width: TABLE_W, height: HEADER_H,
      rx: 8,
      onPointerDown: (e) => grabProps(table.id, e),
      onDblClick: (e) => { e.stopPropagation(); onTableDblClick?.(table.id); },
      onContextMenu: (e) => onTableContextMenu?.(table.id, e),
      style: { cursor: 'grab' },
    }),
    // Cobre os arredondamentos inferiores do cabeçalho
    h('rect', {
      className: 'mm-node-header',
      x: 0, y: HEADER_H - 10,
      width: TABLE_W, height: 10,
      onPointerDown: (e) => grabProps(table.id, e),
      onDblClick: (e) => { e.stopPropagation(); onTableDblClick?.(table.id); },
      onContextMenu: (e) => onTableContextMenu?.(table.id, e),
      style: { cursor: 'grab' },
    }),

    // Nome da tabela (truncado se necessário + tooltip com nome completo)
    h('text', {
      className: 'mm-node-title',
      x: TABLE_W / 2,
      y: HEADER_H - 11,
      'text-anchor': 'middle',
      'clip-path': `url(#${clipId})`,
      onPointerDown: (e) => grabProps(table.id, e),
      onDblClick: (e) => { e.stopPropagation(); onTableDblClick?.(table.id); },
      onContextMenu: (e) => onTableContextMenu?.(table.id, e),
      style: { cursor: 'grab', userSelect: 'none' },
    },
      table.name !== svgTrunc(table.name, TITLE_MAX_PX)
        && h('title', null, table.name),
      svgTrunc(table.name, TITLE_MAX_PX),
    ),

    // Linhas de coluna
    ...table.columns.flatMap((col, i) => {
      const ry = HEADER_H + i * ROW_H;
      const badge = col.pk ? 'PK' : col.fk ? 'FK' : null;
      const rows = [];

      // Área da linha: permite abrir menu de contexto em qualquer ponto da coluna
      rows.push(h('rect', {
        key: `hit-${col.id}`,
        className: `mm-col-hit${i % 2 === 1 ? ' mm-col-alt' : ''}`,
        x: 1, y: ry,
        width: TABLE_W - 2, height: ROW_H,
        onDblClick: (e) => { e.stopPropagation(); onColumnDblClick?.(table.id, col.id); },
        onContextMenu: (e) => onColumnContextMenu?.(table.id, col.id, e),
      }));

      // Badge PK / FK
      if (badge) {
        rows.push(
          h('rect', {
            key: `br-${col.id}`,
            className: `mm-badge mm-badge-${badge.toLowerCase()}`,
            x: 8, y: ry + 6,
            width: 22, height: 16,
            rx: 3,
            onContextMenu: (e) => onColumnContextMenu?.(table.id, col.id, e),
          }),
          h('text', {
            key: `bt-${col.id}`,
            className: `mm-badge-lbl mm-badge-lbl-${badge.toLowerCase()}`,
            x: 19, y: ry + 19,
            'text-anchor': 'middle',
            style: { userSelect: 'none', pointerEvents: 'none' },
          }, badge),
        );
      }

      // Nome da coluna (truncado)
      rows.push(h('text', {
        key: `cn-${col.id}`,
        className: 'mm-col-name',
        x: badge ? COL_PAD_X + BADGE_W + BADGE_GAP : COL_PAD_X,
        y: ry + 19,
        'clip-path': `url(#${clipId})`,
        style: { userSelect: 'none', pointerEvents: 'none' },
      },
        col.name !== svgTrunc(
          col.name,
          TABLE_W - (badge ? COL_PAD_X + BADGE_W + BADGE_GAP : COL_PAD_X) - COL_TYPE_PX - COL_GAP_PX
        ) && h('title', null, col.name),
        svgTrunc(
          col.name,
          TABLE_W - (badge ? COL_PAD_X + BADGE_W + BADGE_GAP : COL_PAD_X) - COL_TYPE_PX - COL_GAP_PX
        ),
      ));

      // Tipo da coluna
      rows.push(h('text', {
        key: `ct-${col.id}`,
        className: 'mm-col-type',
        x: TABLE_W - 8,
        y: ry + 19,
        'text-anchor': 'end',
        'clip-path': `url(#${clipId})`,
        style: { userSelect: 'none', pointerEvents: 'none' },
      }, col.type + (col.nullable === false && !col.pk ? '!' : '')));

      // Separador entre linhas
      if (i < table.columns.length - 1) {
        rows.push(h('line', {
          key: `sep-${col.id}`,
          className: 'mm-col-sep',
          x1: 8, y1: ry + ROW_H,
          x2: TABLE_W - 8, y2: ry + ROW_H,
        }));
      }

      return rows;
    }),

    // Borda exterior (sem pointer events — apenas visual)
    h('rect', {
      className: `mm-node-border${selected ? ' mm-node-border--sel' : ''}`,
      x: 0, y: 0,
      width: TABLE_W, height: totalH,
      rx: 8,
      style: { pointerEvents: 'none' },
    }),

    // Portas de conexão — arrastar de uma porta até outra tabela cria relação
    h('circle', portProps('left'),
      h('title', null, 'Arraste até outra tabela para criar uma relação'),
    ),
    h('circle', portProps('right'),
      h('title', null, 'Arraste até outra tabela para criar uma relação'),
    ),
  );
});
