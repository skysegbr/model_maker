// ModelContext.js — contexto global + hook de estado do modelo ER

import { createContext, useContext, useState } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.js';

export const ModelCtx = createContext(null);

export const useModelCtx = () => useContext(ModelCtx);

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function useModelState() {
  const [tables, setTables] = useState([]);
  const [relations, setRelations] = useState([]);

  const addTable = (name) => {
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
  };

  const updateTable = (id, patch) =>
    setTables((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeTable = (id) => {
    setTables((p) => p.filter((t) => t.id !== id));
    setRelations((p) => p.filter((r) => r.fromTable !== id && r.toTable !== id));
  };

  const moveTable = (id, x, y) =>
    setTables((p) => p.map((t) => (t.id === id ? { ...t, x, y } : t)));

  const addColumn = (tableId, col) =>
    setTables((p) =>
      p.map((t) =>
        t.id === tableId
          ? { ...t, columns: [...t.columns, { id: genId(), ...col }] }
          : t
      )
    );

  const updateColumn = (tableId, colId, patch) =>
    setTables((p) =>
      p.map((t) =>
        t.id === tableId
          ? { ...t, columns: t.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) }
          : t
      )
    );

  const removeColumn = (tableId, colId) => {
    setTables((p) =>
      p.map((t) =>
        t.id === tableId
          ? { ...t, columns: t.columns.filter((c) => c.id !== colId) }
          : t
      )
    );
    setRelations((p) => p.filter((r) => r.fromColumn !== colId && r.toColumn !== colId));
  };

  const addRelation = (rel) =>
    setRelations((p) => {
      const exists = p.some((r) =>
        r.fromTable === rel.fromTable &&
        r.toTable === rel.toTable &&
        r.fromColumn === rel.fromColumn &&
        r.toColumn === rel.toColumn &&
        r.cardinality === rel.cardinality
      );
      return exists ? p : [...p, { id: genId(), ...rel }];
    });

  const removeRelation = (id) =>
    setRelations((p) => p.filter((r) => r.id !== id));

  const importModel = ({ tables: importedTables = [], relations: importedRelations = [] }) => {
    setTables((p) => [...p, ...importedTables]);
    setRelations((p) => [...p, ...importedRelations]);
  };

  return {
    tables,
    relations,
    addTable,
    updateTable,
    removeTable,
    moveTable,
    addColumn,
    updateColumn,
    removeColumn,
    addRelation,
    removeRelation,
    importModel,
  };
}
