import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { getTypeMeta } from "../lib/objectTypes";
import { Sparkles, Network, RefreshCw } from "lucide-react";

export default function AIPanel({ object, onOpen, refreshKey }) {
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function fetchRelated() {
    if (!object) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.relatedObjects(object.id);
      setRelated(data || []);
    } catch (e) {
      setError("Couldn't reach AI.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!object) {
      setRelated([]);
      return;
    }
    fetchRelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object?.id, refreshKey]);

  return (
    <aside
      className="h-full flex flex-col glass-panel"
      style={{ width: 320, borderLeft: "1px solid var(--border-soft)" }}
      data-testid="ai-panel"
    >
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} strokeWidth={1.7} style={{ color: "var(--accent-ai-text)" }} />
          <span className="font-display text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
            AI weave
          </span>
        </div>
        <button
          onClick={fetchRelated}
          disabled={!object || loading}
          data-testid="refresh-related-button"
          className="p-1 rounded hover:bg-[var(--hover-bg)] transition-colors"
          title="Refresh"
        >
          <RefreshCw
            size={12}
            strokeWidth={1.7}
            style={{ color: "var(--text-secondary)" }}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>

      <div style={{ height: 1, background: "var(--border-soft)" }} />

      <div className="px-5 py-4 flex-1 overflow-y-auto">
        {/* AI Summary */}
        {object?.ai_summary && (
          <div className="mb-5 reveal">
            <div className="text-[0.65rem] uppercase font-mono tracking-[0.14em] mb-2" style={{ color: "var(--text-secondary)" }}>
              Summary
            </div>
            <div className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {object.ai_summary}
            </div>
          </div>
        )}

        {/* AI Tags */}
        {object?.ai_tags && object.ai_tags.length > 0 && (
          <div className="mb-6 reveal">
            <div className="text-[0.65rem] uppercase font-mono tracking-[0.14em] mb-2" style={{ color: "var(--text-secondary)" }}>
              Auto tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {object.ai_tags.map((t) => (
                <span key={t} className="tag ai" data-testid={`ai-panel-tag-${t}`}>
                  <Sparkles size={9} strokeWidth={2} />
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <Network size={12} strokeWidth={1.7} style={{ color: "var(--text-secondary)" }} />
            <div className="text-[0.65rem] uppercase font-mono tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
              Related objects
            </div>
          </div>

          {!object && (
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Open an object to see what it connects to.
            </div>
          )}

          {object && loading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl ai-shimmer" />
              ))}
            </div>
          )}

          {object && !loading && error && (
            <div className="text-xs" style={{ color: "var(--accent-terracotta)" }}>
              {error}
            </div>
          )}

          {object && !loading && !error && related.length === 0 && (
            <div className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              No connections yet. Add more objects and Mindstack will weave them together.
            </div>
          )}

          <div className="space-y-2">
            {related.map((r) => {
              const meta = getTypeMeta(r.type);
              const Icon = meta.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => onOpen(r.id)}
                  data-testid={`related-${r.id}`}
                  className="w-full text-left p-3 rounded-xl border bg-white hover:border-[var(--brand-secondary)] transition-colors shadow-sm reveal"
                  style={{ borderColor: "var(--border-soft)" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon size={12} strokeWidth={1.7} style={{ color: meta.color, flexShrink: 0 }} />
                      <span
                        className="text-sm font-medium font-display truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {r.title || "Untitled"}
                      </span>
                    </div>
                    <span
                      className="text-[0.65rem] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        background: "var(--surface-ai)",
                        color: "var(--accent-ai-text)",
                      }}
                    >
                      {r.score}%
                    </span>
                  </div>
                  {r.reason && (
                    <div className="text-[0.72rem] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {r.reason}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
