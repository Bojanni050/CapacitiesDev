import React from "react";
import { getTypeMeta } from "../lib/objectTypes";
import { FileX } from "lucide-react";

function formatRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ObjectList({ objects, activeId, onSelect, activeType }) {
  if (!objects || objects.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center" data-testid="empty-list">
        <div
          className="h-32 w-32 rounded-2xl mb-4 bg-cover bg-center opacity-60"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1761888856976-c4bc8303f65f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwYWJzdHJhY3QlMjBzaGFwZXMlMjBjYWxtfGVufDB8fHx8MTc3ODI1MTc5Mnww&ixlib=rb-4.1.0&q=85)",
          }}
        />
        <FileX size={18} strokeWidth={1.4} style={{ color: "var(--text-secondary)" }} />
        <div className="font-display text-base mt-2" style={{ color: "var(--text-primary)" }}>
          Nothing here yet
        </div>
        <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          Capture a thought to begin your stack.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="object-list">
      {objects.map((o) => {
        const meta = getTypeMeta(o.type);
        const Icon = meta.icon;
        const active = o.id === activeId;
        const tags = [...(o.tags || []), ...(o.ai_tags || [])].slice(0, 3);
        return (
          <div
            key={o.id}
            className={`row-item ${active ? "active" : ""}`}
            onClick={() => onSelect(o.id)}
            data-testid={`list-row-${o.id}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon
                size={14}
                strokeWidth={1.6}
                style={{ color: meta.color, marginTop: 3, flexShrink: 0 }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-[0.92rem] font-medium truncate font-display"
                  style={{ color: "var(--text-primary)" }}
                >
                  {o.title || "Untitled"}
                </div>
                {o.body && (
                  <div
                    className="text-xs mt-0.5 line-clamp-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {o.body.slice(0, 140)}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span
                    className="text-[0.65rem] font-mono uppercase tracking-wider"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {meta.label} · {formatRelative(o.updated_at)}
                  </span>
                  {tags.map((t, i) => (
                    <span key={i} className="tag" style={{ fontSize: "0.65rem" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
