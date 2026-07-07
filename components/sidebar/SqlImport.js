// SqlImport.js — parser tolerante de CREATE TABLE / ALTER TABLE ... FOREIGN KEY

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const TYPE_ALIASES = {
  'INTEGER': 'INT', 'INT4': 'INT', 'INT8': 'BIGINT', 'INT2': 'SMALLINT',
  'SERIAL': 'INT', 'BIGSERIAL': 'BIGINT', 'SMALLSERIAL': 'SMALLINT',
  'DOUBLE PRECISION': 'DOUBLE', 'REAL': 'FLOAT',
  'CHARACTER VARYING': 'VARCHAR', 'CHARACTER': 'CHAR', 'BOOL': 'BOOLEAN',
  'JSONB': 'JSON', 'TIMESTAMPTZ': 'TIMESTAMP', 'DATETIME2': 'DATETIME',
  'MEDIUMTEXT': 'TEXT', 'TINYTEXT': 'TEXT',
};

function unquote(s) {
  return s.trim().replace(/^[`"\[]/, '').replace(/[`"\]]$/, '');
}

function lastSegment(name) {
  const clean = unquote(name);
  return clean.includes('.') ? clean.split('.').pop() : clean;
}

function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/#[^\n]*/g, ' ');
}

/** Divide o corpo do CREATE TABLE em definições, respeitando parênteses e strings */
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let cur = '';
  let inStr = null;
  for (const ch of body) {
    if (inStr) {
      cur += ch;
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

export function parseSqlDDL(text) {
  const sql = stripComments(text);
  const tables = [];
  const byName = new Map();
  const pendingFks = []; // { owner, ownerCol, refTable, refCol }

  // ── CREATE TABLE ... ( corpo com parênteses balanceados ) ───────────────
  const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?([`"\[]?[\w.]+[`"\]]?)\s*\(/gi;
  let m;
  while ((m = createRe.exec(sql))) {
    let depth = 1;
    let i = createRe.lastIndex;
    while (i < sql.length && depth > 0) {
      if (sql[i] === '(') depth++;
      else if (sql[i] === ')') depth--;
      i++;
    }
    const body = sql.slice(createRe.lastIndex, i - 1);
    const name = lastSegment(m[1]);
    const table = { id: genId(), name, x: 0, y: 0, columns: [] };
    const colByName = new Map();

    for (const part of splitTopLevel(body)) {
      const def = part.trim();
      if (!def) continue;
      let cm;

      if ((cm = def.match(/^(?:constraint\s+\S+\s+)?primary\s+key\s*\(([^)]+)\)/i))) {
        cm[1].split(',').map(unquote).forEach((cn) => {
          const col = colByName.get(cn.toLowerCase());
          if (col) { col.pk = true; col.nullable = false; }
        });
        continue;
      }

      if ((cm = def.match(/^(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]+)\)\s*references\s+([`"\[]?[\w.]+[`"\]]?)\s*\(([^)]+)\)/i))) {
        pendingFks.push({
          owner: name,
          ownerCol: unquote(cm[1].split(',')[0]),
          refTable: lastSegment(cm[2]),
          refCol: unquote(cm[3].split(',')[0]),
        });
        continue;
      }

      if ((cm = def.match(/^(?:constraint\s+\S+\s+)?unique\s*(?:key|index)?\s*(?:[^\s(]+\s*)?\(([^)]+)\)/i))) {
        cm[1].split(',').map(unquote).forEach((cn) => {
          const col = colByName.get(cn.toLowerCase());
          if (col) col.unique = true;
        });
        continue;
      }

      if (/^(key|index|fulltext|spatial|check|exclude)\b/i.test(def)) continue;

      // ── Definição de coluna ────────────────────────────────────────────
      cm = def.match(/^([`"\[]?\w+[`"\]]?)\s+([a-zA-Z]+(?:\s+(?:precision|varying))?)(?:\s*\((\s*\d+(?:\s*,\s*\d+)?\s*)\))?([\s\S]*)$/);
      if (!cm) continue;

      const colName = unquote(cm[1]);
      let type = cm[2].toUpperCase().replace(/\s+/g, ' ');
      const size = (cm[3] || '').replace(/\s+/g, '');
      const rest = cm[4] || '';
      const autoInc = /serial/i.test(type)
        || /auto_increment/i.test(rest)
        || /generated\s+(?:always|by\s+default)\s+as\s+identity/i.test(rest);
      type = TYPE_ALIASES[type] || type;

      const dm = rest.match(/default\s+('(?:[^']|'')*'|[\w.()]+)/i);
      let defVal = dm ? dm[1] : '';
      if (/^'.*'$/.test(defVal)) defVal = defVal.slice(1, -1).replace(/''/g, "'");

      const pk = /primary\s+key/i.test(rest);
      const col = {
        id: genId(),
        name: colName,
        type,
        size,
        pk,
        fk: false,
        nullable: !pk && !/not\s+null/i.test(rest),
        unique: /\bunique\b/i.test(rest),
        autoInc,
        default: defVal,
      };
      table.columns.push(col);
      colByName.set(colName.toLowerCase(), col);

      const rm = rest.match(/references\s+([`"\[]?[\w.]+[`"\]]?)\s*\(\s*([`"\[]?\w+[`"\]]?)\s*\)/i);
      if (rm) {
        pendingFks.push({ owner: name, ownerCol: colName, refTable: lastSegment(rm[1]), refCol: unquote(rm[2]) });
      }
    }

    tables.push(table);
    byName.set(name.toLowerCase(), table);
  }

  if (!tables.length) {
    throw new Error('Nenhum CREATE TABLE encontrado no SQL.');
  }

  // ── ALTER TABLE ... ADD FOREIGN KEY (um statement por vez) ──────────────
  const alterRe = /alter\s+table\s+(?:only\s+)?([`"\[]?[\w.]+[`"\]]?)\s+add\s+(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]+)\)\s*references\s+([`"\[]?[\w.]+[`"\]]?)\s*\(([^)]+)\)/i;
  for (const stmt of sql.split(';')) {
    const am = stmt.match(alterRe);
    if (am) {
      pendingFks.push({
        owner: lastSegment(am[1]),
        ownerCol: unquote(am[2].split(',')[0]),
        refTable: lastSegment(am[3]),
        refCol: unquote(am[4].split(',')[0]),
      });
    }
  }

  // Posições em grade — o botão "Organizar" aplica o layout por dependência
  tables.forEach((t, i) => {
    t.x = 80 + (i % 4) * 480;
    t.y = 70 + Math.floor(i / 4) * 320;
  });

  // ── Resolve FKs em relações ──────────────────────────────────────────────
  const relations = [];
  for (const fk of pendingFks) {
    const owner = byName.get(fk.owner.toLowerCase());
    const ref   = byName.get(fk.refTable.toLowerCase());
    if (!owner || !ref) continue;
    const ownerCol = owner.columns.find((c) => c.name.toLowerCase() === fk.ownerCol.toLowerCase());
    const refCol   = ref.columns.find((c) => c.name.toLowerCase() === fk.refCol.toLowerCase());
    if (!ownerCol || !refCol) continue;
    ownerCol.fk = true;
    relations.push({
      id: genId(),
      fromTable: ref.id,   fromColumn: refCol.id,   // lado "1" (referenciado)
      toTable: owner.id,   toColumn: ownerCol.id,   // lado "N" (dono da FK)
      cardinality: '1:N',
    });
  }

  return { tables, relations };
}
