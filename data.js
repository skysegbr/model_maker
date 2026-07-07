// data.js — dados estáticos e enumerações do Model Maker

export const COLUMN_TYPES = [
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
  'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE',
  'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME',
  'BOOLEAN', 'JSON', 'UUID',
];

export const CARDINALITIES = [
  { value: '1:1', label: '1:1 — Um para Um' },
  { value: '1:N', label: '1:N — Um para Muitos' },
  { value: 'N:M', label: 'N:M — Muitos para Muitos' },
];

export const BLANK_COLUMN = {
  name: '',
  type: 'INT',
  pk: false,
  fk: false,
  nullable: true,
};
