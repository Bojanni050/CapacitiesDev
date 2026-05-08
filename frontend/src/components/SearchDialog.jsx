import React, { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { api } from "../lib/api";
import { getTypeMeta, OBJECT_TYPES } from "../lib/objectTypes";

export default function SearchDialog({ open, onOpenChange, onSelect, onCreate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const data = await api.listObjects(query ? { search: query, limit: 20 } : { limit: 20 });
      if (!cancelled) setResults(data || []);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search objects or create new…"
        value={query}
        onValueChange={setQuery}
        data-testid="search-input"
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {query && (
          <CommandGroup heading="Create new">
            {OBJECT_TYPES.slice(0, 4).map((t) => {
              const Icon = t.icon;
              return (
                <CommandItem
                  key={`new-${t.key}`}
                  value={`__new__${t.key}__${query}`}
                  onSelect={() => {
                    onCreate(t.key, query);
                    onOpenChange(false);
                  }}
                  data-testid={`search-create-${t.key}`}
                >
                  <Icon size={14} strokeWidth={1.7} style={{ color: t.color, marginRight: 8 }} />
                  New {t.label.toLowerCase().replace(/s$/, "")}: <span className="ml-1 font-medium">{query}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        <CommandGroup heading="Objects">
          {results.map((o) => {
            const meta = getTypeMeta(o.type);
            const Icon = meta.icon;
            return (
              <CommandItem
                key={o.id}
                value={`${o.title || "untitled"} ${o.body || ""} ${o.id}`}
                onSelect={() => {
                  onSelect(o.id);
                  onOpenChange(false);
                }}
                data-testid={`search-result-${o.id}`}
              >
                <Icon size={14} strokeWidth={1.7} style={{ color: meta.color, marginRight: 8 }} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{o.title || "Untitled"}</div>
                </div>
                <span className="text-[0.65rem] font-mono opacity-60">{meta.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
