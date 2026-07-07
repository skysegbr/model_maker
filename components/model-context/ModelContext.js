// ModelContext.js — contexto global + hook de estado do modelo ER

import { createContext, useContext, useState, useCallback, useMemo, useHistory } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';

export const ModelCtx = createContext(null);

export const useModelCtx = () => useContext(ModelCtx);

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function useModelState() {
  const { state: model, set: setModel, undo, redo, canUndo, canRedo } = useHistory(
    { tables: [], relations: [] },
    { limit: 100 },
  );

  // dragPos: posição efêmera durante drag — NÃO entra no histórico
  const [dragPos, setDragPos] = useState(null); // { id, x, y } | null

  // tables com override da posição de drag (para RelationLines acompanhar em tempo real)
  const tables = useMemo(() =>
    dragPos
      ? model.tables.map((t) => (t.id === dragPos.id ? { ...t, x: dragPos.x, y: dragPos.y } : t))
      : model.tables,
  [model.tables, dragPos]);

  const { relations } = model;

  const addTable = useCallback((name) => {
    const id = genId();
    setModel((p) => ({
      ...p,
      tables: [...p.tables, {
        id, name,
        x: 80 + Math.floor(Math.random() * 460),
        y: 60 + Math.floor(Math.random() * 300),
        columns: [],
      }],
    }));
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

  // moveTable: atualiza dragPos (sem histórico) — para linhas seguirem durante o drag
  const moveTable = useCallback((id, x, y) =>
    setDragPos({ id, x, y }), []);

  // commitMove: limpa dragPos e grava UMA entrada no histórico (chamado no mouseUp)
  const commitMove = useCallback((id, x, y) => {
    setDragPos(null);
    setModel((p) => ({ ...p, tables: p.tables.map((t) => (t.id === id ? { ...t, x, y } : t)) }));
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

  const addRelation = useCallback((rel) =>
    setModel((p) => {
      const exists = p.relations.some((r) =>
        r.fromTable === rel.fromTable &&
        r.toTable === rel.toTable &&
        r.fromColumn === rel.fromColumn &&
        r.toColumn === rel.toColumn &&
        r.cardinality === rel.cardinality
      );
      return exists ? p : { ...p, relations: [...p.relations, { id: genId(), ...rel }] };
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

  return useMemo(() => ({
    tables,
    relations,
    addTable,
    updateTable,
    removeTable,
    moveTable,
    commitMove,
    addColumn,
    updateColumn,
    moveColumn,
    removeColumn,
    addRelation,
    updateRelation,
    removeRelation,
    importModel,
    replaceModel,
    undo,
    redo,
    canUndo,
    canRedo,
  }), [
    tables, relations,
    addTable, updateTable, removeTable, moveTable, commitMove,
    addColumn, updateColumn, moveColumn, removeColumn,
    addRelation, updateRelation, removeRelation,
    importModel, replaceModel,
    undo, redo, canUndo, canRedo,
  ]);
}
