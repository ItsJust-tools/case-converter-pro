import { describe, it, expect } from 'vitest';
import {
  caseConverterTool,
  tokenize,
  tokensToCase,
  convertAll,
  computeStats,
  pushHistory,
} from '../../src/tool/tool-definition';
import { CASE_FORMATS, DEFAULT_STATE, MAX_HISTORY } from '../../src/tool/types';
import type { ToolState } from '../../src/tool/types';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('tokenize', () => {
  it('splits on whitespace and punctuation', () => {
    expect(tokenize('hello world')).toEqual(['hello', 'world']);
    expect(tokenize('hello, world!')).toEqual(['hello', 'world']);
    expect(tokenize('snake_case kebab-case dot.case')).toEqual([
      'snake',
      'case',
      'kebab',
      'case',
      'dot',
      'case',
    ]);
  });

  it('splits camelCase humps', () => {
    expect(tokenize('parseUser')).toEqual(['parse', 'User']);
    expect(tokenize('getUserByIDFromCache')).toEqual(['get', 'User', 'By', 'ID', 'From', 'Cache']);
  });

  it('splits digit boundaries', () => {
    expect(tokenize('html5')).toEqual(['html', '5']);
  });

  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ,,.. ')).toEqual([]);
  });
});

describe('tokensToCase', () => {
  it('converts to snake_case', () => {
    expect(tokensToCase(tokenize('getUserByIDFromCache'), 'snake')).toBe(
      'get_user_by_id_from_cache'
    );
  });

  it('converts to camelCase', () => {
    expect(tokensToCase(tokenize('get user data'), 'camel')).toBe('getUserData');
  });

  it('converts to PascalCase', () => {
    expect(tokensToCase(tokenize('get user data'), 'pascal')).toBe('GetUserData');
  });

  it('converts to kebab-case and CONSTANT_CASE and dot.case and train-case', () => {
    expect(tokensToCase(tokenize('some random words'), 'kebab')).toBe('some-random-words');
    expect(tokensToCase(tokenize('some random words'), 'constant')).toBe('SOME_RANDOM_WORDS');
    expect(tokensToCase(tokenize('some random words'), 'dot')).toBe('some.random.words');
    expect(tokensToCase(tokenize('some random words'), 'train')).toBe('Some-Random-Words');
  });

  it('converts to Title Case and Sentence case', () => {
    expect(tokensToCase(tokenize('the quick brown fox'), 'title')).toBe('The Quick Brown Fox');
    expect(tokensToCase(tokenize('the quick brown fox'), 'sentence')).toBe('The quick brown fox');
  });

  it('preserves acronyms in mixed formats', () => {
    expect(tokensToCase(tokenize('parse HTML API response'), 'camel')).toBe('parseHTMLAPIResponse');
    expect(tokensToCase(tokenize('parse HTML API response'), 'pascal')).toBe(
      'ParseHTMLAPIResponse'
    );
    expect(tokensToCase(tokenize('parse HTML API response'), 'title')).toBe(
      'Parse HTML API Response'
    );
    expect(tokensToCase(tokenize('parse HTML API response'), 'train')).toBe(
      'Parse-HTML-API-Response'
    );
  });

  it('returns empty string for empty tokens', () => {
    expect(tokensToCase([], 'snake')).toBe('');
  });
});

describe('convertAll', () => {
  it('produces a row for every supported format', () => {
    const rows = convertAll(state({ input: 'hello world' }));
    expect(rows.map((r) => r.format)).toEqual(CASE_FORMATS.map((f) => f.id));
    expect(rows.find((r) => r.format === 'snake')?.value).toBe('hello_world');
    expect(rows.find((r) => r.format === 'camel')?.value).toBe('helloWorld');
  });

  it('converts mixed-case input correctly', () => {
    const rows = convertAll(state({ input: 'parseUserData' }));
    expect(rows.find((r) => r.format === 'snake')?.value).toBe('parse_user_data');
    expect(rows.find((r) => r.format === 'camel')?.value).toBe('parseUserData');
  });

  it('handles empty input', () => {
    const rows = convertAll(state({ input: '' }));
    for (const row of rows) expect(row.value).toBe('');
  });
});

describe('multi-line mode', () => {
  it('converts each line independently', () => {
    const rows = convertAll(state({ input: 'hello world\nparse user data', multiLine: true }));
    const snake = rows.find((r) => r.format === 'snake');
    expect(snake?.value).toBe('hello_world\nparse_user_data');
    const camel = rows.find((r) => r.format === 'camel');
    expect(camel?.value).toBe('helloWorld\nparseUserData');
  });

  it('keeps blank lines', () => {
    const rows = convertAll(state({ input: 'one\n\ntwo', multiLine: true }));
    const kebab = rows.find((r) => r.format === 'kebab');
    expect(kebab?.value).toBe('one\n\ntwo');
  });

  it('single-line mode joins the whole text', () => {
    const rows = convertAll(state({ input: 'hello world\nparse data', multiLine: false }));
    const snake = rows.find((r) => r.format === 'snake');
    expect(snake?.value).toBe('hello_world_parse_data');
  });
});

describe('acronym preservation', () => {
  it('keeps HTML and API uppercase in title case', () => {
    const rows = convertAll(state({ input: 'html api' }));
    expect(rows.find((r) => r.format === 'title')?.value).toBe('HTML API');
  });

  it('keeps acronyms uppercase at camelCase boundaries', () => {
    const rows = convertAll(state({ input: 'use html api data' }));
    const camel = rows.find((r) => r.format === 'camel')?.value;
    expect(camel).toBe('useHTMLAPIData');
  });

  it('lowercases acronyms in all-lower formats', () => {
    const rows = convertAll(state({ input: 'HTML API' }));
    expect(rows.find((r) => r.format === 'snake')?.value).toBe('html_api');
    expect(rows.find((r) => r.format === 'kebab')?.value).toBe('html-api');
  });
});

describe('computeStats', () => {
  it('counts words, chars and lines', () => {
    expect(computeStats('one two three')).toEqual({ words: 3, chars: 13, lines: 1 });
    expect(computeStats('a\nb\nc')).toEqual({ words: 3, chars: 5, lines: 3 });
    expect(computeStats('')).toEqual({ words: 0, chars: 0, lines: 0 });
    expect(computeStats('   ')).toEqual({ words: 0, chars: 3, lines: 1 });
  });
});

describe('pushHistory', () => {
  it('pushes new entries most recent first', () => {
    expect(pushHistory([], 'a')).toEqual(['a']);
    expect(pushHistory(['a'], 'b')).toEqual(['b', 'a']);
  });

  it('deduplicates consecutive duplicates and skips empty', () => {
    expect(pushHistory(['a'], 'a')).toEqual(['a']);
    expect(pushHistory(['a'], '')).toEqual(['a']);
  });

  it('caps history length', () => {
    let history: string[] = [];
    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      history = pushHistory(history, `entry-${i}`);
    }
    expect(history.length).toBe(MAX_HISTORY);
    expect(history[0]).toBe(`entry-${MAX_HISTORY + 9}`);
  });
});

describe('state serialization', () => {
  it('round-trips tool state through serialize/deserialize faithfully', () => {
    const original: ToolState = {
      input: 'convert Me RIGHT now',
      multiLine: true,
      history: ['earlier input', 'first input'],
    };
    const serialized = caseConverterTool.serialize(original);
    const parsed: unknown = JSON.parse(serialized);
    const result = caseConverterTool.deserialize(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(original);
    }
  });

  it('round-trips URL query string via lz-string', async () => {
    const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } =
      await import('lz-string');
    const original: ToolState = { input: 'round trip state', multiLine: true, history: ['h1'] };
    const encoded = compressToEncodedURIComponent(caseConverterTool.serialize(original));
    const params = new URLSearchParams({ state: encoded });
    const decoded = decompressFromEncodedURIComponent(params.get('state') ?? '');
    const parsed: unknown = JSON.parse(decoded ?? '');
    const result = caseConverterTool.deserialize(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(original);
    }
  });

  it('accepts partial state with defaults', () => {
    const result = caseConverterTool.deserialize({ input: 'only input' });
    expect(result).toEqual({
      success: true,
      data: { input: 'only input', multiLine: false, history: [] },
    });
  });

  it('rejects invalid payloads', () => {
    expect(caseConverterTool.deserialize(null).success).toBe(false);
    expect(caseConverterTool.deserialize('str').success).toBe(false);
    expect(caseConverterTool.deserialize({}).success).toBe(false);
    expect(caseConverterTool.deserialize({ input: 42 }).success).toBe(false);
  });

  it('sanitizes history entries and caps length', () => {
    const history = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => (i % 2 === 0 ? `h${i}` : 7));
    const stringCount = history.filter((h) => typeof h === 'string').length;
    const result = caseConverterTool.deserialize({ input: 'x', history });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.history.length).toBe(Math.min(stringCount, MAX_HISTORY));
      expect(result.data.history.every((h) => typeof h === 'string')).toBe(true);
    }
  });
});

describe('URL state wiring', () => {
  it('deserialize handles data coming from query param flows', async () => {
    const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } =
      await import('lz-string');
    const original: ToolState = { input: 'url shared text', multiLine: false, history: [] };
    const url = new URL('https://example.com/');
    url.searchParams.set(
      'state',
      compressToEncodedURIComponent(caseConverterTool.serialize(original))
    );
    const fromUrl = decompressFromEncodedURIComponent(
      new URLSearchParams(url.search).get('state') ?? ''
    );
    const result = caseConverterTool.deserialize(JSON.parse(fromUrl ?? ''));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.input).toBe('url shared text');
  });
});
