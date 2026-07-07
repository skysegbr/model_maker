// JsonImport.js — inferência de tabelas e relações a partir de JSON

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function sanitizeName(name, fallback = 'tabela') {
  return String(name || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .toLowerCase() || fallback;
}

function singular(name) {
  return name.endsWith('s') && name.length > 3 ? name.slice(0, -1) : name;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function inferType(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? 'INT' : 'DECIMAL';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'DATE';
    if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(value)) return 'DATETIME';
    if (value.length > 255) return 'TEXT';
    return 'VARCHAR';
  }
  return 'JSON';
}

function mergeType(current, next) {
  if (!current || current === next) return next;
  if (current === 'JSON' || next === 'JSON') return 'JSON';
  if ((current === 'INT' && next === 'DECIMAL') || (current === 'DECIMAL' && next === 'INT')) {
    return 'DECIMAL';
  }
  return 'VARCHAR';
}

function ensureTable(registry, name, level) {
  const tableName = sanitizeName(name);
  let table = registry.get(tableName);
  if (!table) {
    table = {
      id: genId(),
      name: tableName,
      x: 80 + level * 420,
      y: 70 + registry.size * 130,
      columns: [],
      columnMap: new Map(),
    };
    registry.set(tableName, table);
  }
  return table;
}

function ensureColumn(table, name, value, patch = {}) {
  const colName = sanitizeName(name, 'campo');
  let column = table.columnMap.get(colName);
  if (!column) {
    column = {
      id: genId(),
      name: colName,
      type: inferType(value),
      pk: false,
      fk: false,
      nullable: value === null || value === undefined,
      ...patch,
    };
    table.columnMap.set(colName, column);
    table.columns.push(column);
    return column;
  }

  column.type = mergeType(column.type, inferType(value));
  column.nullable = column.nullable || value === null || value === undefined;
  Object.assign(column, patch);
  return column;
}

function ensurePrimaryKey(table) {
  const existing = table.columns.find((c) => c.pk);
  if (existing) return existing;
  const idColumn = ensureColumn(table, 'id', 1, { type: 'INT', pk: true, nullable: false });
  table.columns = [idColumn, ...table.columns.filter((c) => c.id !== idColumn.id)];
  return idColumn;
}

function addRelation(relations, fromTable, fromColumn, toTable, toColumn) {
  const exists = relations.some((r) =>
    r.fromTable === fromTable.id &&
    r.toTable === toTable.id &&
    r.fromColumn === fromColumn.id &&
    r.toColumn === toColumn.id
  );
  if (!exists) {
    relations.push({
      id: genId(),
      fromTable: fromTable.id,
      fromColumn: fromColumn.id,
      toTable: toTable.id,
      toColumn: toColumn.id,
      cardinality: '1:N',
    });
  }
}

function sampleObjects(value) {
  if (Array.isArray(value)) return value.filter(isPlainObject);
  return isPlainObject(value) ? [value] : [];
}

function visitObject(obj, tableName, registry, relations, level, parent) {
  const table = ensureTable(registry, tableName, level);
  const pk = ensurePrimaryKey(table);

  if (parent) {
    const fk = ensureColumn(table, `${parent.table.name}_id`, 1, {
      type: parent.pk.type,
      fk: true,
      nullable: false,
    });
    addRelation(relations, parent.table, parent.pk, table, fk);
  }

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      const children = sampleObjects(value);
      if (children.length) {
        const childName = `${table.name}_${singular(sanitizeName(key, 'item'))}`;
        children.forEach((child) => visitObject(child, childName, registry, relations, level + 1, { table, pk }));
      } else {
        ensureColumn(table, key, value);
      }
      continue;
    }

    if (isPlainObject(value)) {
      const entries = Object.entries(value);
      const hasNestedCollection = entries.some(([, nested]) => Array.isArray(nested) || isPlainObject(nested));
      if (hasNestedCollection) {
        visitObject(value, key, registry, relations, level + 1, parent);
      } else {
        ensureColumn(table, key, value);
      }
      continue;
    }

    ensureColumn(table, key, value);
  }
}

export function inferModelFromJsonText(text) {
  const parsed = JSON.parse(text);
  const roots = sampleObjects(parsed);
  if (!roots.length) {
    throw new Error('O JSON precisa ser um objeto ou uma lista de objetos.');
  }

  const registry = new Map();
  const relations = [];

  roots.forEach((root, index) => {
    const entries = Object.entries(root);
    if (entries.length === 1 && isPlainObject(entries[0][1])) {
      visitObject(entries[0][1], entries[0][0], registry, relations, 0, null);
    } else {
      visitObject(root, parsed.length ? 'root' : `root_${index + 1}`, registry, relations, 0, null);
    }
  });

  const tables = Array.from(registry.values()).map(({ columnMap, ...table }) => table);
  return { tables, relations };
}
