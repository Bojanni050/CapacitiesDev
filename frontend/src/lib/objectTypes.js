import {
  StickyNote,
  User,
  CheckSquare,
  Lightbulb,
  BookOpen,
  Folder,
  CalendarClock,
  Sun,
} from "lucide-react";

export const OBJECT_TYPES = [
  { key: "note", label: "Notes", plural: "Notes", icon: StickyNote, color: "#7A7871" },
  { key: "person", label: "People", plural: "People", icon: User, color: "#D27D66" },
  { key: "task", label: "Tasks", plural: "Tasks", icon: CheckSquare, color: "#8A9482" },
  { key: "idea", label: "Ideas", plural: "Ideas", icon: Lightbulb, color: "#C9A86A" },
  { key: "book", label: "Books", plural: "Books", icon: BookOpen, color: "#7A6BAF" },
  { key: "project", label: "Projects", plural: "Projects", icon: Folder, color: "#5A8A8A" },
  { key: "meeting", label: "Meetings", plural: "Meetings", icon: CalendarClock, color: "#9C7B5A" },
  { key: "daily", label: "Daily", plural: "Daily Logs", icon: Sun, color: "#D9A961" },
];

export const TYPE_MAP = Object.fromEntries(OBJECT_TYPES.map((t) => [t.key, t]));

export function getTypeMeta(key) {
  return TYPE_MAP[key] || OBJECT_TYPES[0];
}
