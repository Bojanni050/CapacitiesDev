import React, { useCallback, useEffect, useRef, useState } from "react";
import "@/App.css";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import AIPanel from "./components/AIPanel";
import ObjectList from "./components/ObjectList";
import SearchDialog from "./components/SearchDialog";
import PulseSheet from "./components/PulseSheet";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { api } from "./lib/api";
import { getTypeMeta } from "./lib/objectTypes";

export default function App() {
  const [activeType, setActiveType] = useState("all");
  const [objects, setObjects] = useState([]);
  const [allObjects, setAllObjects] = useState([]); // full list for lookups (backlinks/mentions)
  const [activeId, setActiveId] = useState(null);
  const [activeObject, setActiveObject] = useState(null);
  const [stats, setStats] = useState({ counts: {}, total: 0 });
  const [wovenCount, setWovenCount] = useState(0);
  const [pulseNeedsNew, setPulseNeedsNew] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pulseOpen, setPulseOpen] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [aiRefreshKey, setAiRefreshKey] = useState(0);
  const enhanceTimerRef = useRef(null);
  const dailyCreatedRef = useRef(false);

  // Load list & stats
  const refreshList = useCallback(async (typeKey = activeType) => {
    let params = {};
    if (typeKey && typeKey.startsWith("filter:")) {
      params = { tag: typeKey.slice("filter:".length) };
    } else if (typeKey && typeKey !== "all") {
      params = { type: typeKey };
    }
    const [list, st, full] = await Promise.all([
      api.listObjects(params),
      api.stats(),
      // Only refetch full list on `all` change to keep it fresh but cheap
      api.listObjects({ limit: 500 }),
    ]);
    setObjects(list);
    setStats(st);
    setAllObjects(full);
    const woven = full.filter((o) => (o.tags || []).includes("pulse-weave")).length;
    setWovenCount(woven);
    return list;
  }, [activeType]);

  useEffect(() => {
    refreshList(activeType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType]);

  // Pulse status on load
  useEffect(() => {
    api.pulseStatus().then((s) => setPulseNeedsNew(!!s?.needs_new)).catch(() => {});
  }, []);

  // Load active object detail
  useEffect(() => {
    if (!activeId) {
      setActiveObject(null);
      return;
    }
    api.getObject(activeId).then(setActiveObject).catch(() => setActiveObject(null));
  }, [activeId]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNew();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType]);

  async function handleNew(type, title = "") {
    const t = type || (
      activeType && !activeType.startsWith("filter:") && activeType !== "all"
        ? activeType
        : "note"
    );
    const obj = await api.createObject({ type: t, title, body: "", tags: [] });
    toast(`New ${getTypeMeta(t).label.toLowerCase().replace(/s$/, "")} created`);
    setActiveId(obj.id);
    setActiveObject(obj);
    await refreshList();
    return obj;
  }

  // Daily note auto-create when switching to Daily type
  useEffect(() => {
    if (activeType !== "daily") {
      dailyCreatedRef.current = false;
      return;
    }
    if (dailyCreatedRef.current) return;
    const today = new Date();
    const todayLabel = today.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const todayIso = today.toISOString().slice(0, 10); // YYYY-MM-DD
    const existing = objects.find(
      (o) => o.type === "daily" && (o.title === todayLabel || o.title === todayIso || (o.title || "").startsWith(todayIso))
    );
    if (existing) {
      setActiveId(existing.id);
      dailyCreatedRef.current = true;
      return;
    }
    // Only auto-create when we've actually loaded (avoid firing on empty pre-fetch)
    if (objects.length === 0 && !dailyCreatedRef.current) {
      // Guard: fetch to be sure before creating
    }
    dailyCreatedRef.current = true;
    handleNew("daily", todayLabel).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, objects]);

  async function handleChange(updates) {
    if (!activeObject) return;
    // Skip noop saves
    const same =
      updates.title === activeObject.title &&
      updates.body === activeObject.body &&
      updates.type === activeObject.type &&
      JSON.stringify(updates.tags) === JSON.stringify(activeObject.tags);
    if (same) return;

    const updated = await api.updateObject(activeObject.id, updates);
    setActiveObject(updated);
    setObjects((prev) =>
      prev.map((o) => (o.id === updated.id ? updated : o)).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    );

    // Auto enhance after a pause once there's content
    if (enhanceTimerRef.current) clearTimeout(enhanceTimerRef.current);
    if ((updated.title || "").length + (updated.body || "").length > 30) {
      enhanceTimerRef.current = setTimeout(async () => {
        try {
          const enhanced = await api.enhanceObject(updated.id);
          setActiveObject((cur) => (cur && cur.id === enhanced.id ? enhanced : cur));
          setObjects((prev) => prev.map((o) => (o.id === enhanced.id ? enhanced : o)));
          setAiRefreshKey((k) => k + 1);
        } catch (_) {
          /* silent */
        }
      }, 2200);
    }
  }

  async function handleEnhance() {
    if (!activeObject) return;
    setEnhancing(true);
    try {
      const enhanced = await api.enhanceObject(activeObject.id);
      setActiveObject(enhanced);
      setObjects((prev) => prev.map((o) => (o.id === enhanced.id ? enhanced : o)));
      setAiRefreshKey((k) => k + 1);
      toast("AI tags refreshed");
    } catch (e) {
      toast.error("AI couldn't reach the server.");
    } finally {
      setEnhancing(false);
    }
  }

  async function handleDelete() {
    if (!activeObject) return;
    const id = activeObject.id;
    await api.deleteObject(id);
    setActiveId(null);
    setActiveObject(null);
    setObjects((prev) => prev.filter((o) => o.id !== id));
    const st = await api.stats();
    setStats(st);
    toast("Object deleted");
  }

  return (
    <div className="App flex">
      <Sidebar
        activeType={activeType}
        onSelectType={(t) => {
          setActiveType(t);
          setActiveId(null);
          setActiveObject(null);
        }}
        counts={stats.counts}
        total={stats.total}
        wovenCount={wovenCount}
        pulseNeedsNew={pulseNeedsNew}
        onNew={() => handleNew()}
        onSearch={() => setSearchOpen(true)}
        onPulse={() => setPulseOpen(true)}
      />

      {/* Object list column */}
      <div
        className="h-full flex flex-col"
        style={{
          width: 320,
          borderRight: "1px solid var(--border-soft)",
          background: "var(--bg-primary)",
        }}
      >
        <div className="px-5 pt-6 pb-3 flex items-center justify-between">
          <div>
            <div className="font-display text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {activeType === "all"
                ? "All objects"
                : activeType === "filter:pulse-weave"
                ? "Pulse-woven ideas"
                : getTypeMeta(activeType).plural}
            </div>
            <div className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-secondary)" }}>
              {objects.length} {objects.length === 1 ? "object" : "objects"}
            </div>
          </div>
          <button
            onClick={() => handleNew()}
            data-testid="new-in-list-button"
            className="px-3 py-1.5 text-sm rounded-md transition-colors"
            style={{
              background: "var(--brand-primary)",
              color: "var(--bg-primary)",
            }}
          >
            New
          </button>
        </div>
        <div style={{ height: 1, background: "var(--border-soft)" }} />
        <ObjectList
          objects={objects}
          activeId={activeId}
          onSelect={setActiveId}
          activeType={activeType}
        />
      </div>

      {/* Editor */}
      <div className="flex-1 h-full overflow-hidden" style={{ background: "var(--bg-primary)" }}>
        <Editor
          object={activeObject}
          onChange={handleChange}
          onDelete={handleDelete}
          onEnhance={handleEnhance}
          enhancing={enhancing}
          allObjects={allObjects}
          onOpenObject={setActiveId}
        />
      </div>

      {/* AI Panel */}
      <AIPanel object={activeObject} onOpen={setActiveId} refreshKey={aiRefreshKey} />

      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={setActiveId}
        onCreate={handleNew}
      />

      <PulseSheet
        open={pulseOpen}
        onOpenChange={setPulseOpen}
        onOpenObject={setActiveId}
        onPulseGenerated={() => {
          setPulseNeedsNew(false);
          refreshList();
        }}
      />

      <Toaster position="bottom-right" />
    </div>
  );
}
