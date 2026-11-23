'use client';

import React from 'react';
import type { ToolState } from '../types';

interface ToolbarProps {
  state: ToolState;
  onChange: (state: ToolState) => void;
  onClear?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ state, onChange }) => {
  return (
    <div
      className="converter-toolbar flex flex-wrap items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-800"
      data-testid="case-toolbar"
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.multiLine}
          onChange={(e) => onChange({ ...state, multiLine: e.target.checked })}
          aria-label="Multi-line mode"
          data-testid="toolbar-multiline-toggle"
        />
        Multi-line
      </label>
    </div>
  );
};
