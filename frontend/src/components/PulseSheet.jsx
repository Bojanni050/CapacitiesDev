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
import { Sparkles, RefreshCw, Activity, Lightbulb, Check, History, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

function fmtRange(startIso, endIso) {
  if (!startIso || !endIso) return "";
  const s = new Date(startIso);
  const e = new Date(endIso);
  const opts = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

export default function PulseSheet({ open, onOpenChange, onOpenObject, onPulseGenerated }) {
  const [pulse, setPulse] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [wovenIndex, setWovenIndex] = useState({}); // { [i]: idea_id }
  const [weavingIndex, setWeavingIndex] = useState(null);

  async function weaveIntoIdea(c, i) {
    setWeavingIndex(i);
    try {
      const sourcesLine = c.objects
        .map((o) => `- ${o.title || "Untitled"} (${o.type})`)
        .join("\n");
      const body =
        `${c.insight}\n\n` +
        `— Woven from AI Pulse on ${new Date().toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}\n\n` +
        `Sources:\n${sourcesLine}`;

      const idea = await api.createObject({
        type: "idea",
        title: c.title,
        body,
        tags: ["pulse-weave"],
        metadata: {
          source_ids: c.objects.map((o) => o.id),
          woven_from: "ai-pulse",
          woven_at: new Date().toISOString(),
        },
      });
      setWovenIndex((prev) => ({ ...prev, [i]: idea.id }));
      toast(`Idea created: ${idea.title}`, {
        action: {
          label: "Open",
          onClick: () => {
            onOpenObject(idea.id);
            onOpenChange(false);
          },
        },
      });
    } catch (e) {
      toast.error("Couldn't weave the idea.");
    } finally {
      setWeavingIndex(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setWovenIndex({});
    setHistoryOpen(false);
    Promise.all([api.getPulse(), api.listPulses()])
      .then(([p, hist]) => {
        if (cancelled) return;
        setPulse(p);
        setHistory(hist || []);
      })
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
      setHistory((prev) => [fresh, ...prev.filter((p) => p.id !== fresh.id)]);
      setWovenIndex({});
      onPulseGenerated && onPulseGenerated();
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
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {historyOpen ? (
                <button
                  onClick={() => setHistoryOpen(false)}
                  data-testid="history-back-button"
                  className="flex items-center gap-1 text-[0.65rem] uppercase font-mono tracking-[0.14em] hover:text-[var(--text-primary)] transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <ChevronLeft size={12} strokeWidth={2} />
                  Back
                </button>
              ) : (
                <>
                  <Activity size={14} strokeWidth={1.7} style={{ color: "var(--accent-ai-text)" }} />
                  <span
                    className="text-[0.65rem] uppercase font-mono tracking-[0.18em]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    AI Pulse · weekly
                  </span>
                </>
              )}
            </div>
            {!historyOpen && history.length > 0 && (
              <button
                onClick={() => setHistoryOpen(true)}
                data-testid="open-history-button"
                className="flex items-center gap-1 text-[0.65rem] uppercase font-mono tracking-[0.14em] hover:text-[var(--text-primary)] transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <History size={11} strokeWidth={1.7} />
                History · {history.length}
              </button>
            )}
          </div>
          <SheetTitle
            className="font-display text-3xl font-light tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {historyOpen ? "Pulse history" : "3 verbanden die je miste"}
          </SheetTitle>
          <SheetDescription
            className="text-sm font-mono"
            style={{ color: "var(--text-secondary)" }}
          >
            {historyOpen
              ? `${history.length} briefing${history.length === 1 ? "" : "s"} archived`
              : pulse
              ? `${fmtRange(pulse.week_start, pulse.week_end)} · ${pulse.object_count} objects`
              : "Your weekly briefing across new objects"}
          </SheetDescription>
        </SheetHeader>

        <div style={{ height: 1, background: "var(--border-soft)" }} />

        {historyOpen ? (
          <div className="px-6 py-5 reveal">
            {history.length === 0 && (
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                No pulses yet. Generate your first one from the main view.
              </div>
            )}
            <div className="space-y-2">
              {history.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPulse(p);
                    setHistoryOpen(false);
                    setWovenIndex({});
                  }}
                  data-testid={`history-item-${p.id}`}
                  className="w-full text-left p-4 rounded-xl border bg-white hover:border-[var(--brand-secondary)] transition-colors"
                  style={{ borderColor: "var(--border-soft)" }}
                >
                  <div
                    className="text-[0.65rem] uppercase font-mono tracking-[0.14em] mb-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {fmtRange(p.week_start, p.week_end)} · {p.object_count} objects
                  </div>
                  <div
                    className="font-display text-base font-medium mb-1 line-clamp-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.connections[0]?.title || "Not enough objects"}
                  </div>
                  <div
                    className="text-xs line-clamp-2"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {p.intro}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span
                      className="text-[0.65rem] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: "var(--surface-ai)", color: "var(--accent-ai-text)" }}
                    >
                      {p.connections.length} connections
                    </span>
                    <span
                      className="text-[0.65rem] font-mono"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      · {new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
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

                    <div
                      className="mt-3 pt-3 flex items-center justify-end"
                      style={{ borderTop: "1px solid var(--border-soft)" }}
                    >
                      {wovenIndex[i] ? (
                        <button
                          onClick={() => {
                            onOpenObject(wovenIndex[i]);
                            onOpenChange(false);
                          }}
                          data-testid={`pulse-open-woven-${i}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors"
                          style={{
                            background: "var(--surface-ai)",
                            color: "var(--accent-ai-text)",
                            border: "1px solid rgba(178, 201, 161, 0.5)",
                          }}
                        >
                          <Check size={11} strokeWidth={2} />
                          Woven — open idea
                        </button>
                      ) : (
                        <button
                          onClick={() => weaveIntoIdea(c, i)}
                          disabled={weavingIndex === i}
                          data-testid={`pulse-weave-${i}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors hover:bg-[var(--hover-bg)]"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {weavingIndex === i ? (
                            <>
                              <RefreshCw size={11} strokeWidth={1.8} className="animate-spin" />
                              Weaving…
                            </>
                          ) : (
                            <>
                              <Lightbulb size={11} strokeWidth={1.7} style={{ color: "#C9A86A" }} />
                              Weave into idea
                            </>
                          )}
                        </button>
                      )}
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
        </>
        )}
      </SheetContent>
    </Sheet>
  );
}
