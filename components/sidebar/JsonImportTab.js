// JsonImportTab.js — aba JSON: editor com highlight + importação inferida

import { h, useRef, useState, useMemo } from 'https://cdn.jsdelivr.net/gh/skysegbr/Nexa@main/dist/nexa.min.js';
import { inferModelFromJsonText } from './JsonImport.js';

// ─── Highlight de JSON ────────────────────────────────────────────────────────

const JSON_HIGHLIGHT_RE = /("(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b|[{}\[\],:])/g;

function jsonTokenClass(token, rest) {
  if (token === '{' || token === '}' || token === '[' || token === ']') return 'mm-json-token-punct';
  if (token === ',' || token === ':') return 'mm-json-token-mark';
  if (token === 'true' || token === 'false') return 'mm-json-token-bool';
  if (token === 'null') return 'mm-json-token-null';
  if (/^-?\d/.test(token)) return 'mm-json-token-number';
  if (token.startsWith('"')) return /^\s*:/.test(rest) ? 'mm-json-token-key' : 'mm-json-token-string';
  return '';
}

function highlightJson(text) {
  if (!text) return '';

  const parts = [];
  let last = 0;
  let match;
  let key = 0;
  JSON_HIGHLIGHT_RE.lastIndex = 0;

  while ((match = JSON_HIGHLIGHT_RE.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    parts.push(h('span', {
      key: `tok-${key++}`,
      className: jsonTokenClass(token, text.slice(JSON_HIGHLIGHT_RE.lastIndex)),
    }, token));
    last = JSON_HIGHLIGHT_RE.lastIndex;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function JsonHighlightedEditor({ value, onInput }) {
  const highlightRef = useRef(null);

  function syncScroll(e) {
    if (!highlightRef.current) return;
    highlightRef.current.scrollTop = e.target.scrollTop;
    highlightRef.current.scrollLeft = e.target.scrollLeft;
  }

  const highlighted = useMemo(() => value ? highlightJson(value) : '\n', [value]);

  return h('div', { className: 'mm-json-editor' },
    h('pre', { ref: highlightRef, className: 'mm-json-highlight', ariaHidden: 'true' },
      highlighted
    ),
    h('textarea', {
      className: 'mm-json-textarea',
      value,
      placeholder: 'Cole o JSON aqui...',
      spellCheck: false,
      onInput,
      onScroll: syncScroll,
    }),
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function JsonImportTab({ onImport, onSelectTable }) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError]       = useState('');
  const [summary, setSummary]   = useState('');
  const jsonInputRef = useRef(null);

  async function openJsonFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setSummary('');

    try {
      const text = await file.text();
      JSON.parse(text);
      setJsonText(text);
      setSummary(`Arquivo ${file.name} aberto.`);
    } catch (err) {
      setError(err?.message || 'JSON inválido.');
    } finally {
      e.target.value = '';
    }
  }

  function submitJson(e) {
    e.preventDefault();
    setError('');
    setSummary('');

    try {
      const model = inferModelFromJsonText(jsonText);
      onImport(model);
      if (model.tables[0]) onSelectTable(model.tables[0].id);
      setSummary(`${model.tables.length} tabela(s) e ${model.relations.length} relação(ões) importadas.`);
    } catch (err) {
      setError(err?.message || 'JSON inválido.');
    }
  }

  function formatJson() {
    setError('');
    setSummary('');
    try {
      setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2));
    } catch (err) {
      setError(err?.message || 'JSON inválido.');
    }
  }

  function clearJson() {
    setJsonText('');
    setError('');
    setSummary('');
  }

  return h('form', { className: 'mm-json-import', onSubmit: submitJson },
    h('input', {
      ref: jsonInputRef,
      className: 'mm-file-input',
      type: 'file',
      accept: '.json,application/json',
      onChange: openJsonFile,
    }),
    h(JsonHighlightedEditor, {
      value: jsonText,
      onInput: (e) => setJsonText(e.target.value),
    }),
    h('div', { className: 'mm-json-actions' },
      h('button', {
        className: 'mm-cancel-btn',
        type: 'button',
        onClick: () => jsonInputRef.current?.click(),
      }, 'Abrir JSON'),
      h('button', {
        className: 'mm-cancel-btn',
        type: 'button',
        disabled: !jsonText.trim(),
        onClick: formatJson,
      }, 'Formatar'),
      h('button', {
        className: 'mm-cancel-btn',
        type: 'button',
        disabled: !jsonText.trim(),
        onClick: clearJson,
      }, 'Limpar'),
      h('button', {
        className: 'mm-submit-btn',
        type: 'submit',
        disabled: !jsonText.trim(),
      }, 'Importar JSON'),
    ),
    error && h('p', { className: 'mm-msg-error' }, error),
    summary && h('p', { className: 'mm-msg-ok' }, summary),
  );
}
