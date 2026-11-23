'use client';

import React from 'react';
import { convertAll, computeStats } from '../tool-definition';
import type { ToolState } from '../types';

interface CanvasProps {
  state: ToolState;
  onChange: (state: ToolState) => void;
  onUndo?: () => void;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="copy-btn text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label={`Copy ${label} value`}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onUndo }) => {
  const rows = React.useMemo(() => convertAll(state), [state]);
  const stats = React.useMemo(() => computeStats(state.input), [state.input]);

  const update = (patch: Partial<ToolState>) => onChange({ ...state, ...patch });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    update({ input: e.target.value, history: [state.input, ...state.history].slice(0, 50) });
  };

  const allText = rows.map((r) => `${r.label}: ${r.value}`).join('\n');

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full" data-testid="case-converter-canvas">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="case-input"
            className="text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300"
          >
            Input text
          </label>
          <div className="flex items-center gap-2">
            {onUndo ? (
              <button
                type="button"
                onClick={onUndo}
                className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Undo last conversion"
              >
                Undo
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => update({ input: '' })}
              className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Clear input"
            >
              Clear
            </button>
          </div>
        </div>
        <textarea
          id="case-input"
          value={state.input}
          onChange={handleInputChange}
          placeholder="Type text to convert..."
          rows={3}
          data-testid="case-input"
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.multiLine}
            onChange={(e) => update({ multiLine: e.target.checked })}
            data-testid="multiline-toggle"
            aria-label="Multi-line mode"
          />
          Multi-line mode (convert each line independently)
        </label>
        <div
          className="stats-panel flex gap-4 text-xs text-gray-600 dark:text-gray-400"
          data-testid="stats-panel"
        >
          <span data-testid="stat-words">{stats.words} words</span>
          <span data-testid="stat-chars">{stats.chars} chars</span>
          <span data-testid="stat-lines">{stats.lines} lines</span>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.format}
            className="case-row flex items-center gap-2"
            data-testid={`case-row-${row.format}`}
          >
            <span className="case-label w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
              {row.label}
            </span>
            <code className="case-value flex-1 break-all rounded bg-gray-50 dark:bg-gray-900 px-2 py-1 text-sm">
              {row.value}
            </code>
            <CopyButton value={row.value} label={row.label} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(allText);
        }}
        className="copy-all-btn text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        aria-label="Copy all conversions"
        data-testid="copy-all"
      >
        Copy all
      </button>
    </div>
  );
};
