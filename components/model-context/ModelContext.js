// ModelContext.js — contexto global + hook de estado do modelo ER

import { createContext, useContext, useState, useCallback, useMemo } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';

export const ModelCtx = createContext(null);

export const useModelCtx = () => useContext(ModelCtx);

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function useModelState() {
  const [tables, setTables] = useState([]);
  const [relations, setRelations] = useState([]);

  const addTable = useCallback((name) => {
    const id = genId();
    setTables((p) => [
      ...p,
      {
        id,
        name,
        x: 80 + Math.floor(Math.random() * 460),
        y: 60 + Math.floor(Math.random() * 300),
        columns: [],
      },
    ]);
    return id;
  }, []);

  const updateTable = useCallback((id, patch) =>
    setTables((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t))), []);

  const removeTable = useCallback((id) => {
    setTables((p) => p.filter((t) => t.id !== id));
    setRelations((p) => p.filter((r) => r.fromTable !== id && r.toTable !== id));
  }, []);

  const moveTable = useCallback((id, x, y) =>
    setTables((p) => p.map((t) => (t.id === id ? { ...t, x, y } : t))), []);

  const addColumn = useCallback((tableId, col) =>
    setTables((p) =>
      p.map((t) =>
        t.id === tableId
          ? { ...t, columns: [...t.columns, { id: genId(), ...col }] }
          : t
      )
    ), []);

  const updateColumn = useCallback((tableId, colId, patch) =>
    setTables((p) =>
      p.map((t) =>
        t.id === tableId
          ? { ...t, columns: t.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) }
          : t
      )
    ), []);

  const moveColumn = useCallback((tableId, colId, direction) =>
    setTables((p) =>
      p.map((t) => {
        if (t.id !== tableId) return t;
        const from = t.columns.findIndex((c) => c.id === colId);
        const to = direction === 'up' ? from - 1 : from + 1;
        if (from < 0 || to < 0 || to >= t.columns.length) return t;

        const columns = [...t.columns];
        const [column] = columns.splice(from, 1);
        columns.splice(to, 0, column);
        return { ...t, columns };
      })
    ), []);

  const removeColumn = useCallback((tableId, colId) => {
    setTables((p) =>
      p.map((t) =>
        t.id === tableId
          ? { ...t, columns: t.columns.filter((c) => c.id !== colId) }
          : t
      )
    );
    setRelations((p) => p.filter((r) => r.fromColumn !== colId && r.toColumn !== colId));
  }, []);

  const addRelation = useCallback((rel) =>
    setRelations((p) => {
      const exists = p.some((r) =>
        r.fromTable === rel.fromTable &&
        r.toTable === rel.toTable &&
        r.fromColumn === rel.fromColumn &&
        r.toColumn === rel.toColumn &&
        r.cardinality === rel.cardinality
      );
      return exists ? p : [...p, { id: genId(), ...rel }];
    }), []);

  const removeRelation = useCallback((id) =>
    setRelations((p) => p.filter((r) => r.id !== id)), []);

  const importModel = useCallback(({ tables: importedTables = [], relations: importedRelations = [] }) => {
    setTables((p) => [...p, ...importedTables]);
    setRelations((p) => [...p, ...importedRelations]);
  }, []);

  const replaceModel = useCallback(({ tables: nextTables = [], relations: nextRelations = [] }) => {
    setTables(nextTables);
    setRelations(nextRelations);
  }, []);

  return useMemo(() => ({
    tables,
    relations,
    addTable,
    updateTable,
    removeTable,
    moveTable,
    addColumn,
    updateColumn,
    moveColumn,
    removeColumn,
    addRelation,
    removeRelation,
    importModel,
    replaceModel,
  }), [tables, relations, addTable, updateTable, removeTable, moveTable, addColumn, updateColumn, moveColumn, removeColumn, addRelation, removeRelation, importModel, replaceModel]);
}
