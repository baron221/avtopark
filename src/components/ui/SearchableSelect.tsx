"use client";

import { useEffect, useRef, useState } from "react";

export type SearchableOption = { id: string; label: string; searchText: string };

/**
 * A text-input combobox over a hidden <input name=...> — lets a user type
 * part of a plate number (or anything in searchText) to filter a long list
 * instead of scrolling a native <select>, while still submitting a plain
 * form field like one.
 */
export function SearchableSelect({
  name,
  options,
  placeholder,
  className,
  defaultValue,
}: {
  name: string;
  options: SearchableOption[];
  placeholder?: string;
  className?: string;
  defaultValue?: string;
}) {
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selected = options.find((o) => o.id === selectedId);
  const filtered = query.trim()
    ? options.filter((o) => o.searchText.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={selectedId} />
      <input
        type="text"
        value={open ? query : (selected?.label ?? "")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-card border-2 border-border rounded-xl shadow-lg">
          {filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setSelectedId(o.id);
                setOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 text-sm font-bold text-heading hover:bg-page"
            >
              {o.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3.5 py-2.5 text-sm text-muted-2 font-semibold">Топилмади</div>
          )}
        </div>
      )}
    </div>
  );
}
