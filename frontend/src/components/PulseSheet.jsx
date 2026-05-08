import React, { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { api } from "../lib/api";
import { getTypeMeta } from "../lib/objectTypes";
import { Sparkles, RefreshCw, Activity } from "lucide-react";

function fmtRange(startIso, endIso) {
  if (!startIso || !endIso) return "";
  const s = new Date(startIso);
  const e = new Date(endIso);
  const opts = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

export default function PulseSheet({ open, onOpenChange, onOpenObject }) {
  const [pulse, setPulse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api
      .getPulse()
      .then((p) => !cancelled && setPulse(p))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const fresh = await api.generatePulse();
      setPulse(fresh);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[480px] p-0 overflow-y-auto"
        style={{ background: "var(--bg-primary)" }}
        data-testid="pulse-sheet"
      >
        <SheetHeader className="px-6 pt-6 pb-4 text-left">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} strokeWidth={1.7} style={{ color: "var(--accent-ai-text)" }} />
            <span
              className="text-[0.65rem] uppercase font-mono tracking-[0.18em]"
              style={{ color: "var(--text-secondary)" }}
            >
              AI Pulse · weekly
            </span>
          </div>
          <SheetTitle
            className="font-display text-3xl font-light tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            3 verbanden die je miste
          </SheetTitle>
          <SheetDescription
            className="text-sm font-mono"
            style={{ color: "var(--text-secondary)" }}
          >
            {pulse
              ? `${fmtRange(pulse.week_start, pulse.week_end)} · ${pulse.object_count} objects`
              : "Your weekly briefing across new objects"}
          </SheetDescription>
        </SheetHeader>

        <div style={{ height: 1, background: "var(--border-soft)" }} />

        <div className="px-6 py-5">
          <button
            onClick={handleGenerate}
            disabled={generating}
            data-testid="generate-pulse-button"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm transition-colors"
            style={{
              background: generating ? "var(--surface-ai)" : "var(--brand-primary)",
              color: generating ? "var(--accent-ai-text)" : "var(--bg-primary)",
            }}
          >
            {generating ? (
              <>
                <RefreshCw size={14} strokeWidth={1.8} className="animate-spin" />
                Weaving this week…
              </>
            ) : (
              <>
                <Sparkles size={14} strokeWidth={1.8} />
                {pulse ? "Generate fresh pulse" : "Generate this week's pulse"}
              </>
            )}
          </button>
        </div>

        <div className="px-6 pb-10">
          {loading && !pulse && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-xl ai-shimmer" />
              ))}
            </div>
          )}

          {!loading && pulse && (
            <div className="reveal">
              {pulse.intro && (
                <div
                  className="text-base leading-relaxed mb-6 italic"
                  style={{ color: "var(--text-primary)" }}
                  data-testid="pulse-intro"
                >
                  {pulse.intro}
                </div>
              )}

              {pulse.connections.length === 0 && pulse.object_count < 2 && (
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Capture more objects this week and Mindstack will surface the threads
                  between them next time.
                </div>
              )}

              <div className="space-y-4">
                {pulse.connections.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-xl border p-4 bg-white reveal"
                    style={{ borderColor: "var(--border-soft)" }}
                    data-testid={`pulse-connection-${i}`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span
                        className="font-mono text-[0.65rem] tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: "var(--surface-ai)", color: "var(--accent-ai-text)" }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div
                        className="font-display text-base font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {c.title}
                      </div>
                    </div>
                    <div
                      className="text-sm leading-relaxed mb-3"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {c.insight}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.objects.map((o) => {
                        const meta = getTypeMeta(o.type);
                        const Icon = meta.icon;
                        return (
                          <button
                            key={o.id}
                            onClick={() => {
                              onOpenObject(o.id);
                              onOpenChange(false);
                            }}
                            data-testid={`pulse-obj-${o.id}`}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors hover:bg-[var(--hover-bg)]"
                            style={{
                              background: "var(--bg-secondary)",
                              color: "var(--text-primary)",
                            }}
                          >
                            <Icon size={11} strokeWidth={1.7} style={{ color: meta.color }} />
                            <span className="truncate max-w-[180px]">
                              {o.title || "Untitled"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !pulse && (
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
              No pulse generated yet. Click the button above to weave this week.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
