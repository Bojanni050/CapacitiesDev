import React from "react";
import { OBJECT_TYPES } from "../lib/objectTypes";
import { Plus, Search, Sparkles, Inbox } from "lucide-react";

export default function Sidebar({
  activeType,
  onSelectType,
  counts = {},
  total = 0,
  onNew,
  onSearch,
}) {
  return (
    <aside
      className="h-full flex flex-col"
      style={{
        width: 280,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-soft)",
      }}
      data-testid="sidebar"
    >
      {/* Brand */}
      <div className="px-6 pt-6 pb-4 flex items-center gap-2.5">
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center"
          style={{ background: "var(--brand-primary)" }}
        >
          <Sparkles size={14} strokeWidth={1.8} color="#FBFBF9" />
        </div>
        <div className="font-display text-[1.05rem] font-semibold tracking-tight">
          mindstack
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 pb-2 flex flex-col gap-1">
        <button
          onClick={onNew}
          data-testid="new-object-button"
          className="side-item"
          style={{ color: "var(--text-primary)", fontWeight: 500 }}
        >
          <Plus size={15} strokeWidth={1.8} />
          <span>New object</span>
          <span className="count font-mono">⌘N</span>
        </button>
        <button
          onClick={onSearch}
          data-testid="search-button"
          className="side-item"
        >
          <Search size={15} strokeWidth={1.8} />
          <span>Search</span>
          <span className="count font-mono">⌘K</span>
        </button>
      </div>

      <div
        className="mx-6 my-3 h-px"
        style={{ background: "var(--border-soft)" }}
      />

      {/* All */}
      <div className="px-3 pb-1">
        <button
          onClick={() => onSelectType("all")}
          data-testid="sidebar-type-all"
          className={`side-item w-full ${activeType === "all" ? "active" : ""}`}
        >
          <Inbox size={15} strokeWidth={1.6} />
          <span>All objects</span>
          <span className="count">{total}</span>
        </button>
      </div>

      {/* Type label */}
      <div className="px-6 pt-4 pb-2">
        <div className="font-mono text-[0.65rem] uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
          Object types
        </div>
      </div>

      {/* Types list */}
      <nav className="px-3 flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {OBJECT_TYPES.map((t) => {
          const Icon = t.icon;
          const active = activeType === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onSelectType(t.key)}
              data-testid={`sidebar-type-${t.key}`}
              className={`side-item ${active ? "active" : ""}`}
            >
              <Icon size={15} strokeWidth={1.6} style={{ color: t.color }} />
              <span>{t.plural}</span>
              <span className="count">{counts[t.key] || 0}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-6 py-4 border-t flex items-center gap-3"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div
          className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3ODEzNjE4N3ww&ixlib=rb-4.1.0&q=85)",
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[0.82rem] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            Personal workspace
          </div>
          <div className="text-[0.72rem] truncate" style={{ color: "var(--text-secondary)" }}>
            {total} objects · solo mode
          </div>
        </div>
      </div>
    </aside>
  );
}
