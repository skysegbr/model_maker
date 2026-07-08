// ModelContext.js — contexto global + hook de estado do modelo ER

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, useHistory } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { CANVAS_SIZE } from '../../data.js';
import { TABLE_W, tableNodeHeight } from '../canvas/TableNode.js';

export const ModelCtx = createContext(null);

export const useModelCtx = () => useContext(ModelCtx);

const STORAGE_KEY = 'mm-model';

function loadSavedModel() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(parsed?.tables) || !Array.isArray(parsed?.relations)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Avaliado uma vez no carregamento do módulo — não a cada render
const INITIAL_MODEL = loadSavedModel() || { tables: [], relations: [] };

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Validação de nomes (identificadores SQL) ──────────────────────────────

export function validateEntityName(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
    ? ''
    : 'Use apenas letras, números e _ (não pode começar com número).';
}

export function validateTableName(tables, name, excludeId = null) {
  const err = validateEntityName(name);
  if (err) return err;
  const dup = tables.some((t) => t.id !== excludeId && t.name.toLowerCase() === name.toLowerCase());
  return dup ? 'Já existe uma tabela com esse nome.' : '';
}

export function validateColumnName(table, name, excludeId = null) {
  const err = validateEntityName(name);
  if (err) return err;
  const dup = table.columns.some((c) => c.id !== excludeId && c.name.toLowerCase() === name.toLowerCase());
  return dup ? 'Já existe uma coluna com esse nome nesta tabela.' : '';
}

export function useModelState() {
  const { state: model, set: setModel, undo, redo, canUndo, canRedo } = useHistory(
    INITIAL_MODEL,
    { limit: 100 },
  );

  // Auto-save: qualquer mudança no modelo persiste no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
    } catch { /* armazenamento cheio/indisponível — segue sem persistir */ }
  }, [model]);

  // dragPos: posições efêmeras durante drag — NÃO entram no histórico
  const [dragPos, setDragPos] = useState(null); // { [tableId]: {x,y} } | null

  // canvasView: viewBox atual do canvas ({ x, y, w, h }) — escrito pelo
  // DiagramCanvas para que tabelas novas nasçam no centro da vista atual
  const canvasView = useRef(null);

  // tables com override das posições de drag (para RelationLines acompanhar em tempo real)
  const tables = useMemo(() =>
    dragPos
      ? model.tables.map((t) => (dragPos[t.id] ? { ...t, ...dragPos[t.id] } : t))
      : model.tables,
  [model.tables, dragPos]);

  const { relations } = model;

  const addTable = useCallback((name) => {
    const id = genId();
    setModel((p) => {
      const view = canvasView.current;
      const cx = view ? view.x + view.w / 2 : 480;
      const cy = view ? view.y + view.h / 2 : 300;
      const step = (p.tables.length % 6) * 32; // cascata para não empilhar
      return {
        ...p,
        tables: [...p.tables, {
          id, name,
          x: Math.max(0, Math.min(CANVAS_SIZE.w - TABLE_W, cx - TABLE_W / 2 + step)),
          y: Math.max(0, Math.min(CANVAS_SIZE.h - 200, cy - 90 + step)),
          columns: [],
        }],
      };
    });
    return id;
  }, [setModel]);

  const updateTable = useCallback((id, patch) =>
    setModel((p) => ({ ...p, tables: p.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  [setModel]);

  const removeTable = useCallback((id) =>
    setModel((p) => ({
      tables: p.tables.filter((t) => t.id !== id),
      relations: p.relations.filter((r) => r.fromTable !== id && r.toTable !== id),
    })),
  [setModel]);

  // moveTables: atualiza dragPos (sem histórico) — para linhas seguirem
  // durante o drag; moveTables(null) cancela o drag sem gravar nada
  const moveTables = useCallback((posMap) => setDragPos(posMap), []);

  // commitMoveTables: limpa dragPos e grava UMA entrada no histórico
  const commitMoveTables = useCallback((posMap) => {
    setDragPos(null);
    setModel((p) => ({
      ...p,
      tables: p.tables.map((t) => (posMap[t.id] ? { ...t, ...posMap[t.id] } : t)),
    }));
  }, [setModel]);

  const addColumn = useCallback((tableId, col) =>
    setModel((p) => ({
      ...p,
      tables: p.tables.map((t) =>
        t.id === tableId
          ? { ...t, columns: [...t.columns, { id: genId(), ...col }] }
          : t
      ),
    })),
  [setModel]);

  const updateColumn = useCallback((tableId, colId, patch) =>
    setModel((p) => ({
      ...p,
      tables: p.tables.map((t) =>
        t.id === tableId
          ? { ...t, columns: t.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) }
          : t
      ),
    })),
  [setModel]);

  const moveColumn = useCallback((tableId, colId, direction) =>
    setModel((p) => ({
      ...p,
      tables: p.tables.map((t) => {
        if (t.id !== tableId) return t;
        const from = t.columns.findIndex((c) => c.id === colId);
        const to = direction === 'up' ? from - 1 : from + 1;
        if (from < 0 || to < 0 || to >= t.columns.length) return t;
        const columns = [...t.columns];
        const [column] = columns.splice(from, 1);
        columns.splice(to, 0, column);
        return { ...t, columns };
      }),
    })),
  [setModel]);

  const removeColumn = useCallback((tableId, colId) =>
    setModel((p) => ({
      tables: p.tables.map((t) =>
        t.id === tableId
          ? { ...t, columns: t.columns.filter((c) => c.id !== colId) }
          : t
      ),
      relations: p.relations.filter((r) => r.fromColumn !== colId && r.toColumn !== colId),
    })),
  [setModel]);

  // addRelation: completa colunas ausentes — origem assume a PK do lado "1";
  // destino (lado "N") ganha uma coluna FK "tabela_coluna" criada na hora.
  // N:M fica sem auto-FK (o correto é tabela de junção, gerada no SQL).
  const addRelation = useCallback((rel) =>
    setModel((p) => {
      const next = { ...rel };
      const fromT = p.tables.find((t) => t.id === next.fromTable);
      const toT   = p.tables.find((t) => t.id === next.toTable);
      if (!fromT || !toT) return p;

      let tables = p.tables;

      if (!next.fromColumn) {
        const pk = fromT.columns.find((c) => c.pk);
        if (pk) next.fromColumn = pk.id;
      }

      if (!next.toColumn && next.fromColumn && next.cardinality !== 'N:M') {
        const fromCol = fromT.columns.find((c) => c.id === next.fromColumn);
        if (fromCol) {
          const fkName = `${fromT.name}_${fromCol.name}`;
          let fkCol = toT.columns.find((c) => c.name === fkName);
          if (!fkCol) {
            fkCol = {
              id: genId(), name: fkName,
              type: fromCol.type, size: fromCol.size || '',
              pk: false, fk: true, nullable: false, unique: false, autoInc: false, default: '',
            };
            tables = tables.map((t) =>
              t.id === toT.id ? { ...t, columns: [...t.columns, fkCol] } : t
            );
          } else if (!fkCol.fk) {
            tables = tables.map((t) =>
              t.id === toT.id
                ? { ...t, columns: t.columns.map((c) => (c.id === fkCol.id ? { ...c, fk: true } : c)) }
                : t
            );
          }
          next.toColumn = fkCol.id;
        }
      }

      const exists = p.relations.some((r) =>
        r.fromTable === next.fromTable &&
        r.toTable === next.toTable &&
        r.fromColumn === next.fromColumn &&
        r.toColumn === next.toColumn &&
        r.cardinality === next.cardinality
      );
      return exists ? p : { tables, relations: [...p.relations, { id: genId(), ...next }] };
    }),
  [setModel]);

  const updateRelation = useCallback((id, patch) =>
    setModel((p) => ({ ...p, relations: p.relations.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  [setModel]);

  const removeRelation = useCallback((id) =>
    setModel((p) => ({ ...p, relations: p.relations.filter((r) => r.id !== id) })),
  [setModel]);

  const importModel = useCallback(({ tables: importedTables = [], relations: importedRelations = [] }) =>
    setModel((p) => ({
      tables: [...p.tables, ...importedTables],
      relations: [...p.relations, ...importedRelations],
    })),
  [setModel]);

  const replaceModel = useCallback(({ tables: nextTables = [], relations: nextRelations = [] }) =>
    setModel({ tables: nextTables, relations: nextRelations }),
  [setModel]);

  // autoLayout: organiza por nível de dependência — pais (lado "1") à
  // esquerda, filhos (donos de FK) à direita, empilhados por coluna
  const autoLayout = useCallback(() =>
    setModel((p) => {
      if (!p.tables.length) return p;

      const level = {};
      p.tables.forEach((t) => { level[t.id] = 0; });
      // relaxamento limitado ao nº de tabelas — termina mesmo com ciclos
      for (let i = 0; i < p.tables.length; i++) {
        let changed = false;
        p.relations.forEach((r) => {
          if (level[r.fromTable] === undefined || level[r.toTable] === undefined) return;
          if (level[r.toTable] < level[r.fromTable] + 1) {
            level[r.toTable] = level[r.fromTable] + 1;
            changed = true;
          }
        });
        if (!changed) break;
      }

      const GAP_X = 140, GAP_Y = 48, START_X = 80, START_Y = 70;
      const nextY = {};
      const pos = {};
      [...p.tables]
        .sort((a, b) => level[a.id] - level[b.id] || a.name.localeCompare(b.name))
        .forEach((t) => {
          const lv = level[t.id];
          const y = nextY[lv] ?? START_Y;
          nextY[lv] = y + tableNodeHeight(t.columns) + GAP_Y;
          pos[t.id] = {
            x: Math.min(CANVAS_SIZE.w - TABLE_W, START_X + lv * (TABLE_W + GAP_X)),
            y: Math.min(CANVAS_SIZE.h - 120, y),
          };
        });

      return { ...p, tables: p.tables.map((t) => ({ ...t, ...pos[t.id] })) };
    }),
  [setModel]);

  return useMemo(() => ({
    tables,
    relations,
    canvasView,
    addTable,
    updateTable,
    removeTable,
    moveTables,
    commitMoveTables,
    addColumn,
    updateColumn,
    moveColumn,
    removeColumn,
    addRelation,
    updateRelation,
    removeRelation,
    importModel,
    replaceModel,
    autoLayout,
    undo,
    redo,
    canUndo,
    canRedo,
  }), [
    tables, relations,
    addTable, updateTable, removeTable, moveTables, commitMoveTables,
    addColumn, updateColumn, moveColumn, removeColumn,
    addRelation, updateRelation, removeRelation,
    importModel, replaceModel, autoLayout,
    undo, redo, canUndo, canRedo,
  ]);
}
