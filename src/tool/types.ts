export type CaseFormat =
  'camel' | 'pascal' | 'snake' | 'kebab' | 'constant' | 'title' | 'dot' | 'train' | 'sentence';

export interface CaseFormatDef {
  id: CaseFormat;
  label: string;
}

export const CASE_FORMATS: CaseFormatDef[] = [
  { id: 'camel', label: 'camelCase' },
  { id: 'pascal', label: 'PascalCase' },
  { id: 'snake', label: 'snake_case' },
  { id: 'kebab', label: 'kebab-case' },
  { id: 'constant', label: 'CONSTANT_CASE' },
  { id: 'title', label: 'Title Case' },
  { id: 'dot', label: 'dot.case' },
  { id: 'train', label: 'train-case' },
  { id: 'sentence', label: 'Sentence case' },
];

/** Maximum stored entries in the input history for undo. */
export const MAX_HISTORY = 50;

export interface ToolState {
  /** Raw multi-line input as typed by the user. */
  input: string;
  /** When true, each line is converted independently. */
  multiLine: boolean;
  /** Previous inputs (most recent first) for undoing the last conversion. */
  history: string[];
}

export const DEFAULT_STATE: ToolState = {
  input: 'parse HTML API response text',
  multiLine: false,
  history: [],
};

export interface ConversionRow {
  format: CaseFormat;
  label: string;
  /** Converted value for the current mode. */
  value: string;
}

export interface TextStats {
  words: number;
  chars: number;
  lines: number;
}
