import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  CASE_FORMATS,
  DEFAULT_STATE,
  MAX_HISTORY,
  type CaseFormat,
  type ConversionRow,
  type TextStats,
  type ToolState,
} from './types';

/* ------------------------------------------------------------------ */
/* Tokenization                                                        */
/* ------------------------------------------------------------------ */

const DEFAULT_ACRONYMS = new Set([
  'html',
  'css',
  'api',
  'url',
  'uri',
  'http',
  'https',
  'xml',
  'json',
  'sql',
  'id',
  'ui',
  'ux',
  'csv',
  'pdf',
  'aws',
  'ios',
  'seo',
]);

function isUpperCase(char: string): boolean {
  return char >= 'A' && char <= 'Z';
}

/**
 * Split text into word tokens. Handles:
 * - whitespace, punctuation and separators ( _ - . ) as boundaries
 * - camelCase humps (parseUser -> parse, User)
 * - digit boundaries (html5 -> html, 5)
 * - existing ALL-CAPS acronym runs (HTMLParser -> HTML, Parser)
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const cleaned = input.replace(/[^A-Za-z0-9_\-.]+/g, ' ');
  for (const chunk of cleaned.split(/[\s_\-.\n]+/)) {
    if (!chunk) continue;
    tokens.push(...splitWord(chunk));
  }
  return tokens;
}

function splitWord(word: string): string[] {
  const out: string[] = [];
  let current = '';
  const flush = (): void => {
    if (current) {
      out.push(current);
      current = '';
    }
  };

  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i] ?? '';
    if (/[0-9]/.test(char)) {
      if (current && !/[0-9]/.test(current[current.length - 1] ?? '')) {
        flush();
      }
      current += char;
      continue;
    }

    if (isUpperCase(char)) {
      // Find the full run of consecutive uppercase chars starting here.
      let j = i;
      while (j < chars.length && isUpperCase(chars[j] ?? '')) j++;
      const capRun = chars.slice(i, j).join('');
      const nextIsLower = j < chars.length && /[a-z]/.test(chars[j] ?? '');
      if (nextIsLower && capRun.length >= 2) {
        // e.g. HTTPServer -> HTTP + Server; IDFollower -> ID + Follower
        flush();
        out.push(capRun.slice(0, -1));
        current = capRun.slice(-1);
        i = j - 1;
        continue;
      }
      if (current && /[a-z0-9]/.test(current[current.length - 1] ?? '')) {
        flush();
      }
      current += char;
      continue;
    }

    current += char;
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ */
/* Serializing tokens into target cases                                */
/* ------------------------------------------------------------------ */

function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Words recognized as acronyms stay fully uppercase in mixed formats. */
function acronymOf(word: string): string | null {
  return DEFAULT_ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : null;
}

const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'if',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'so',
  'the',
  'to',
  'up',
  'yet',
]);

export function tokensToCase(tokens: string[], format: CaseFormat): string {
  if (tokens.length === 0) return '';
  const words = tokens;
  switch (format) {
    case 'camel':
      return words
        .map((w, i) => {
          if (i === 0) return w.toLowerCase();
          const ac = acronymOf(w);
          if (ac) return ac;
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join('');
    case 'pascal':
      return words
        .map((w) => {
          const ac = acronymOf(w);
          if (ac) return ac;
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join('');
    case 'snake':
      return words.map((w) => w.toLowerCase()).join('_');
    case 'kebab':
      return words.map((w) => w.toLowerCase()).join('-');
    case 'constant':
      return words
        .map((w) => w.toLowerCase())
        .join('_')
        .toUpperCase();
    case 'dot':
      return words.map((w) => w.toLowerCase()).join('.');
    case 'train':
      return words
        .map((w) => {
          const ac = acronymOf(w);
          if (ac) return ac;
          return capitalize(w);
        })
        .join('-');
    case 'title':
      return words
        .map((w, i) => {
          const ac = acronymOf(w);
          if (ac) return ac;
          // Title Case: minor words stay lowercase unless first
          const lower = w.toLowerCase();
          if (i > 0 && MINOR_WORDS.has(lower)) return lower;
          return capitalize(w);
        })
        .join(' ');
    case 'sentence':
      return words
        .map((w, i) => {
          const ac = acronymOf(w);
          if (ac) return ac;
          if (i === 0) return capitalize(w);
          return w.toLowerCase();
        })
        .join(' ');
  }
}

/**
 * Convert arbitrary text into every supported case format.
 * When `multiLine` is true each non-empty line is converted independently
 * and results are joined with the same line structure.
 */
export function convertAll(state: ToolState): ConversionRow[] {
  const convert = (text: string): string[] =>
    CASE_FORMATS.map((f) => tokensToCase(tokenize(text), f.id));
  let values: string[];
  if (state.multiLine) {
    const lines = state.input.split('\n');
    const perFormat: string[][] = CASE_FORMATS.map(() => []);
    for (const line of lines) {
      const converted = convert(line);
      for (let i = 0; i < converted.length; i++) {
        perFormat[i]?.push(converted[i] ?? '');
      }
    }
    values = perFormat.map((fmtLines) => fmtLines.join('\n'));
  } else {
    values = convert(state.input);
  }
  return CASE_FORMATS.map((f, i) => ({ format: f.id, label: f.label, value: values[i] ?? '' }));
}

/** Word / character / line counts for a given text. */
export function computeStats(text: string): TextStats {
  const trimmed = text.trim();
  return {
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    chars: text.length,
    lines: text === '' ? 0 : text.split('\n').length,
  };
}

/** Push a snapshot of the input onto history (most recent first). */
export function pushHistory(history: string[], input: string): string[] {
  if (!input) return history;
  if (history[0] === input) return history;
  return [input, ...history].slice(0, MAX_HISTORY);
}

/* ------------------------------------------------------------------ */
/* Tool definition                                                     */
/* ------------------------------------------------------------------ */

export const caseConverterTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: (state) => JSON.stringify(state),
  deserialize: (data): DeserializeResult<ToolState> => {
    if (typeof data !== 'object' || data === null) {
      return { success: false, error: 'Invalid data format: expected case converter state object' };
    }
    const v = data as Partial<ToolState>;
    if (typeof v.input !== 'string') {
      return {
        success: false,
        error:
          'Invalid data format: expected { input: string, multiLine?: boolean, history?: string[] }',
      };
    }
    const multiLine = typeof v.multiLine === 'boolean' ? v.multiLine : DEFAULT_STATE.multiLine;
    const history = Array.isArray(v.history)
      ? v.history.filter((h): h is string => typeof h === 'string').slice(0, MAX_HISTORY)
      : [];
    return {
      success: true,
      data: { input: v.input, multiLine, history },
    };
  },
};

export { caseConverterTool as baseConverterTool };
