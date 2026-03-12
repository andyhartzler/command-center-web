'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Search, X, Check, Filter } from 'lucide-react';

interface FilterField {
  key: string;
  label: string;
  options: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fields: FilterField[];
  activeFilters: Record<string, string[]>;
  onApply: (filters: Record<string, string[]>) => void;
}

export function GlobalAdvancedFilter({ isOpen, onClose, fields, activeFilters, onApply }: Props) {
  const [draft, setDraft] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const field of fields) {
      init[field.key] = new Set(activeFilters[field.key] || []);
    }
    return init;
  });

  const [searchTerms, setSearchTerms] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = '';
    return init;
  });

  const [activeTab, setActiveTab] = useState(fields[0]?.key || '');

  const toggleItem = useCallback((fieldKey: string, value: string) => {
    setDraft(prev => {
      const next = { ...prev };
      const s = new Set(prev[fieldKey]);
      if (s.has(value)) s.delete(value);
      else s.add(value);
      next[fieldKey] = s;
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    const cleared: Record<string, Set<string>> = {};
    for (const f of fields) cleared[f.key] = new Set<string>();
    setDraft(cleared);
  }, [fields]);

  const handleApply = useCallback(() => {
    const result: Record<string, string[]> = {};
    for (const [key, set] of Object.entries(draft)) {
      if (set.size > 0) result[key] = Array.from(set);
    }
    onApply(result);
    onClose();
  }, [draft, onApply, onClose]);

  const totalSelected = Object.values(draft).reduce((acc, s) => acc + s.size, 0);
  const activeField = fields.find(f => f.key === activeTab);

  const filteredOptions = useMemo(() => {
    if (!activeField) return [];
    const term = (searchTerms[activeTab] || '').toLowerCase();
    if (!term) return activeField.options;
    return activeField.options.filter(o => o.toLowerCase().includes(term));
  }, [activeField, activeTab, searchTerms]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999]" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] max-h-[70vh] bg-[#0a0e1a]/95 backdrop-blur-xl border border-cyan-500/20 rounded-xl shadow-[0_8px_60px_rgba(0,0,0,0.3)] flex flex-col font-mono overflow-hidden">
        {/* Title */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Filter size={14} className="text-cyan-400" />
            <span className="text-[11px] text-cyan-400 tracking-[0.25em] font-semibold">ADVANCED FILTER</span>
            {totalSelected > 0 && (
              <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded-sm">
                {totalSelected} SELECTED
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors p-1 rounded hover:bg-white/5">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        {fields.length > 1 && (
          <div className="flex border-b border-white/10 px-3 pt-2 gap-1">
            {fields.map(field => {
              const isActive = activeTab === field.key;
              const count = draft[field.key]?.size || 0;
              return (
                <button
                  key={field.key}
                  onClick={() => setActiveTab(field.key)}
                  className={`px-3 py-1.5 text-[9px] tracking-widest rounded-t transition-colors relative ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-b-0 border-cyan-500/30'
                      : 'text-white/30 hover:text-white/50 border border-transparent'
                  }`}
                >
                  {field.label}
                  {count > 0 && <span className="ml-1.5 text-[8px] text-cyan-400 bg-black/40 px-1 rounded">{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Selected chips */}
        {activeField && draft[activeTab]?.size > 0 && (
          <div className="px-4 pt-3 pb-1 flex flex-wrap gap-1.5 max-h-16 overflow-y-auto styled-scrollbar">
            {Array.from(draft[activeTab]).map(val => (
              <span key={val} className="inline-flex items-center gap-1 text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full px-2 py-0.5 group">
                {val.length > 20 ? val.slice(0, 20) + '...' : val}
                <button onClick={() => toggleItem(activeTab, val)} className="opacity-50 group-hover:opacity-100">
                  <X size={8} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              value={searchTerms[activeTab] || ''}
              onChange={e => setSearchTerms(prev => ({ ...prev, [activeTab]: e.target.value }))}
              placeholder={`Search ${activeField?.label.toLowerCase() || ''}...`}
              className="w-full bg-white/5 border border-white/10 rounded-lg text-[11px] text-white/70 pl-8 pr-8 py-2 font-mono tracking-wide focus:outline-none focus:border-cyan-500/30 placeholder-white/15 transition-all"
              autoFocus
            />
            {searchTerms[activeTab] && (
              <button
                onClick={() => setSearchTerms(prev => ({ ...prev, [activeTab]: '' }))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[8px] text-white/20 tracking-widest">{filteredOptions.length} AVAILABLE</span>
            <span className="text-[8px] text-white/20 tracking-widest">{draft[activeTab]?.size || 0} SELECTED</span>
          </div>
        </div>

        {/* Options list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 styled-scrollbar" style={{ maxHeight: '35vh' }}>
          {filteredOptions.length === 0 ? (
            <div className="text-center py-8 text-white/20 text-[10px] tracking-widest">NO RESULTS</div>
          ) : (
            <div className="flex flex-col gap-px">
              {filteredOptions.map(option => {
                const isChecked = draft[activeTab]?.has(option);
                return (
                  <button
                    key={option}
                    onClick={() => toggleItem(activeTab, option)}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-left transition-all group ${
                      isChecked
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-white/50 hover:bg-white/5 hover:text-white/70'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 transition-all ${
                      isChecked
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-white/15 group-hover:border-white/25'
                    }`}>
                      {isChecked && <Check size={9} strokeWidth={3} />}
                    </div>
                    <span className="text-[10px] tracking-wide truncate">{option}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
          <button onClick={clearAll} className="text-[9px] text-red-400/70 hover:text-red-300 tracking-widest">CLEAR ALL</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-[9px] text-white/30 tracking-widest border border-white/10 rounded-md px-4 py-1.5 hover:bg-white/5 transition-all">
              CANCEL
            </button>
            <button
              onClick={handleApply}
              className="text-[9px] text-cyan-400 tracking-widest border border-cyan-500/30 rounded-md px-4 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/15 transition-all font-semibold"
            >
              APPLY{totalSelected > 0 ? ` (${totalSelected})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
