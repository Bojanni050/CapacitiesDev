import React, { useEffect, useRef, useState } from "react";
import { OBJECT_TYPES, getTypeMeta } from "../lib/objectTypes";
import {
  Trash2,
  Sparkles,
  ChevronDown,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Editor({ object, onChange, onDelete, onEnhance, enhancing }) {
  const [title, setTitle] = useState(object?.title || "");
  const [body, setBody] = useState(object?.body || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(object?.tags || []);
  const [type, setType] = useState(object?.type || "note");
  const lastSyncedId = useRef(null);
  const debounceRef = useRef(null);

  // Sync local state when active object changes
  useEffect(() => {
    if (!object) return;
    if (lastSyncedId.current !== object.id) {
      setTitle(object.title || "");
      setBody(object.body || "");
      setTags(object.tags || []);
      setType(object.type || "note");
      lastSyncedId.current = object.id;
    } else {
      // Same id: pick up server-side updates (e.g., ai_tags) without breaking user input
      setTags(object.tags || []);
      setType(object.type || "note");
    }
  }, [object]);

  // Debounced save
  useEffect(() => {
    if (!object) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ title, body, tags, type });
    }, 600);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, tags, type]);

  if (!object) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-8 text-center" data-testid="editor-empty">
        <div
          className="h-40 w-40 rounded-3xl mb-6 bg-cover bg-center opacity-50"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1761888856976-c4bc8303f65f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwYWJzdHJhY3QlMjBzaGFwZXMlMjBjYWxtfGVufDB8fHx8MTc3ODI1MTc5Mnww&ixlib=rb-4.1.0&q=85)",
          }}
        />
        <div className="font-display text-2xl font-light" style={{ color: "var(--text-primary)" }}>
          A calm space to think
        </div>
        <div className="text-sm mt-2 max-w-md" style={{ color: "var(--text-secondary)" }}>
          Capture notes, people, ideas and projects as objects. Mindstack&apos;s AI quietly
          weaves them together for you.
        </div>
      </div>
    );
  }

  const meta = getTypeMeta(type);
  const TypeIcon = meta.icon;

  function addTag(e) {
    e.preventDefault();
    const v = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!v) return;
    if (tags.includes(v)) {
      setTagInput("");
      return;
    }
    setTags([...tags, v]);
    setTagInput("");
  }

  function removeTag(t) {
    setTags(tags.filter((x) => x !== t));
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="editor">
      {/* Top action bar */}
      <div className="sticky top-0 z-10 glass-panel">
        <div className="max-w-3xl mx-auto px-12 lg:px-20 py-4 flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="editor-type-dropdown"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
              >
                <TypeIcon size={14} strokeWidth={1.7} style={{ color: meta.color }} />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>{meta.label}</span>
                <ChevronDown size={13} strokeWidth={1.6} style={{ color: "var(--text-secondary)" }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {OBJECT_TYPES.map((t) => {
                const I = t.icon;
                return (
                  <DropdownMenuItem
                    key={t.key}
                    onClick={() => setType(t.key)}
                    data-testid={`type-option-${t.key}`}
                  >
                    <I size={14} strokeWidth={1.7} style={{ color: t.color, marginRight: 8 }} />
                    {t.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2">
            <button
              onClick={onEnhance}
              disabled={enhancing}
              data-testid="ai-enhance-button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors"
              style={{
                background: enhancing ? "var(--surface-ai)" : "transparent",
                color: "var(--accent-ai-text)",
                border: "1px solid rgba(178, 201, 161, 0.5)",
              }}
            >
              <Sparkles size={13} strokeWidth={1.7} />
              {enhancing ? "Thinking…" : "Enhance with AI"}
            </button>
            <button
              onClick={onDelete}
              data-testid="delete-button"
              className="p-1.5 rounded-md hover:bg-[var(--hover-bg)] transition-colors"
              title="Delete"
            >
              <Trash2 size={14} strokeWidth={1.6} style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>
        </div>
        <div style={{ height: 1, background: "var(--border-soft)" }} />
      </div>

      {/* Editor body */}
      <div className="max-w-3xl mx-auto px-12 lg:px-20 py-12 reveal">
        {/* Metadata */}
        <div
          className="flex items-center gap-4 pb-5 mb-7 text-xs font-mono"
          style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-soft)" }}
        >
          <span>id · {object.id.slice(0, 8)}</span>
          <span>·</span>
          <span>updated {formatDate(object.updated_at)}</span>
          {object.ai_summary && (
            <>
              <span>·</span>
              <span style={{ color: "var(--accent-ai-text)" }}>ai · {object.ai_summary}</span>
            </>
          )}
        </div>

        {/* Title */}
        <input
          data-testid="editor-title"
          className="editor-title text-5xl sm:text-6xl"
          placeholder="Untitled"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5 mt-6">
          {tags.map((t) => (
            <span key={t} className="tag" data-testid={`user-tag-${t}`}>
              #{t}
              <button onClick={() => removeTag(t)} className="ml-0.5 opacity-60 hover:opacity-100">
                <X size={10} strokeWidth={2} />
              </button>
            </span>
          ))}
          {(object.ai_tags || []).map((t) => (
            <span key={`ai-${t}`} className="tag ai" data-testid={`ai-tag-${t}`}>
              <Sparkles size={9} strokeWidth={2} />
              {t}
            </span>
          ))}
          <form onSubmit={addTag}>
            <input
              data-testid="tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="+ tag"
              className="bg-transparent text-xs outline-none px-1 py-0.5 w-20"
              style={{ color: "var(--text-secondary)" }}
            />
          </form>
        </div>

        {/* Body */}
        <textarea
          data-testid="editor-body"
          className="editor-body mt-8"
          placeholder="Begin writing… your thoughts become objects, and Mindstack quietly connects them."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
    </div>
  );
}
