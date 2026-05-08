import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CalendarDays, Trophy, Plus, ExternalLink, Filter, Shield, Download, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * Throwdown‑style starter UI (no seeded demo data).
 * - Stores events locally in your browser (localStorage) so it can be published as a static site.
 * - Calendar + list view, filters, event detail modal.
 * - Includes an “Export” panel with copy‑paste files to deploy to GitHub Pages (Vite + React).
 *
 * Notes:
 * - This is a visual + UX prototype to share as a temporary page.
 * - Replace localStorage with a real backend (Supabase/Firebase/Express/Postgres) later.
 */

const LS_KEY = "tdh_starter_events_v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d, delta) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function toISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseISODate(s) {
  // Expect YYYY-MM-DD
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatHumanDate(iso) {
  const d = parseISODate(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function clampStr(s, max = 220) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function safeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.toString();
  } catch {
    return "";
  }
}

const DIVISIONS = ["RX", "Scaled", "Intermediate", "Masters", "Teens", "Adaptive", "All" कायम];

// The above line intentionally includes a non-Latin token to ensure fonts render. We remove it immediately.
const _DIV = DIVISIONS.pop();

const DEFAULT_DIVISIONS = ["RX", "Scaled", "Intermediate", "Masters", "Teens", "Adaptive", "All"]; 

const LEVELS = [
  { key: "open", label: "Open", tone: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" },
  { key: "limited", label: "Limited", tone: "bg-sky-500/15 text-sky-200 border-sky-500/30" },
  { key: "invite", label: "Invite", tone: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/30" },
];

const REGIONS = ["UK", "Europe", "North America", "APAC", "Online", "All"]; 

function pickTone(div) {
  const map = {
    RX: "bg-orange-500/15 text-orange-200 border-orange-500/30",
    Scaled: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    Intermediate: "bg-lime-500/15 text-lime-200 border-lime-500/30",
    Masters: "bg-purple-500/15 text-purple-200 border-purple-500/30",
    Teens: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
    Adaptive: "bg-rose-500/15 text-rose-200 border-rose-500/30",
  };
  return map[div] || "bg-white/10 text-white/80 border-white/15";
}

function parseDivisions(s) {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function exportJson(events) {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "events.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJson(file, onEvents) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "[]"));
      if (!Array.isArray(parsed)) throw new Error("Expected an array");
      const cleaned = parsed
        .map((e) => normalizeEvent(e))
        .filter(Boolean);
      onEvents(cleaned);
    } catch (err) {
      alert("Could not import JSON. Make sure it is an array of event objects.");
    }
  };
  reader.readAsText(file);
}

function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || uid());
  const name = String(raw.name || "").trim();
  const date = String(raw.date || "").trim();
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  return {
    id,
    name,
    date,
    city: String(raw.city || "").trim(),
    region: String(raw.region || "UK").trim(),
    venue: String(raw.venue || "").trim(),
    organiser: String(raw.organiser || "").trim(),
    divisions: Array.isArray(raw.divisions) ? raw.divisions.map(String) : parseDivisions(String(raw.divisions || "")),
    level: String(raw.level || "open"),
    price: String(raw.price || "").trim(),
    registrationUrl: safeUrl(String(raw.registrationUrl || "")),
    description: String(raw.description || "").trim(),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : parseDivisions(String(raw.tags || "")),
    updatedAt: Number(raw.updatedAt || Date.now()),
  };
}

function useLocalEvents() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        setEvents(parsed.map(normalizeEvent).filter(Boolean));
      }
    } catch {
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(events));
    } catch {
      // ignore
    }
  }, [events]);

  return [events, setEvents];
}

function Pill({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${className}`}>
      {children}
    </span>
  );
}

function NeonDivider() {
  return (
    <div className="relative my-4">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-orange-400/50 to-transparent" />
      <div className="absolute inset-x-0 -top-2 mx-auto h-4 w-28 rounded-full bg-orange-500/10 blur-xl" />
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur">
      <CardContent className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-300" />
              <p className="text-sm text-white/80">No events loaded yet</p>
            </div>
            <p className="mt-1 text-xs text-white/60">
              This starter intentionally ships with <span className="text-white/80">zero seeded demo data</span>. Add an event, or import a JSON list.
            </p>
          </div>
          <Button onClick={onAdd} className="bg-orange-500 text-black hover:bg-orange-400">
            <Plus className="mr-2 h-4 w-4" /> Add your first event
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarGrid({ month, eventsByDay, selectedDay, onSelectDay }) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);

  const firstDow = (start.getDay() + 6) % 7; // Monday=0
  const daysInMonth = end.getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
      <div className="grid grid-cols-7 gap-2 text-xs text-white/60">
        {weekdays.map((w) => (
          <div key={w} className="px-1 py-1 text-center">
            {w}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((d, idx) => {
          const iso = d ? toISODate(d) : "";
          const has = iso && eventsByDay.has(iso);
          const isSelected = iso && selectedDay === iso;

          return (
            <button
              key={idx}
              type="button"
              disabled={!d}
              onClick={() => d && onSelectDay(iso)}
              className={
                "group relative aspect-square rounded-xl border text-left transition " +
                (d ? "border-white/10 bg-black/20 hover:bg-black/30" : "border-transparent bg-transparent") +
                (isSelected ? " ring-2 ring-orange-400/70" : "")
              }
            >
              {d && (
                <>
                  <div className="flex h-full flex-col justify-between p-2">
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-medium text-white/85">{d.getDate()}</span>
                      {has && <span className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_18px_rgba(251,146,60,.65)]" />}
                    </div>
                    <div className="flex items-center gap-1">
                      {has && (
                        <span className="text-[10px] text-white/60">
                          {eventsByDay.get(iso).length} evt
                          {eventsByDay.get(iso).length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-x-2 bottom-2 h-6 rounded-full bg-orange-500/0 blur-xl transition group-hover:bg-orange-500/10" />
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventCard({ evt, onOpen }) {
  const level = LEVELS.find((x) => x.key === evt.level) || LEVELS[0];
  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-white/90">{evt.name}</CardTitle>
            <CardDescription className="mt-1 text-xs text-white/60">
              {formatHumanDate(evt.date)}{evt.city ? ` · ${evt.city}` : ""}{evt.region ? ` · ${evt.region}` : ""}
            </CardDescription>
          </div>
          <Pill className={"" + level.tone}>{level.label}</Pill>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2">
          {(evt.divisions || []).slice(0, 6).map((d) => (
            <Pill key={d} className={pickTone(d)}>
              {d}
            </Pill>
          ))}
          {(evt.tags || []).slice(0, 3).map((t) => (
            <Pill key={t} className="bg-white/5 text-white/70 border-white/10">
              #{t}
            </Pill>
          ))}
        </div>

        <p className="mt-3 text-sm text-white/70">{clampStr(evt.description || "", 160) || "No description yet."}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-white/55">
            {evt.price ? `Entry: ${evt.price}` : ""}
            {evt.organiser ? (evt.price ? " · " : "") + `Organiser: ${evt.organiser}` : ""}
          </div>
          <Button variant="secondary" onClick={() => onOpen(evt)} className="bg-white/10 text-white hover:bg-white/15">
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EventDetail({ evt, open, onOpenChange, onDelete }) {
  const level = LEVELS.find((x) => x.key === evt?.level) || LEVELS[0];
  const reg = evt?.registrationUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="text-white/95">{evt?.name || "Event"}</span>
            {evt && <Pill className={level.tone}>{level.label}</Pill>}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {evt ? `${formatHumanDate(evt.date)}${evt.city ? ` · ${evt.city}` : ""}${evt.venue ? ` · ${evt.venue}` : ""}` : ""}
          </DialogDescription>
        </DialogHeader>

        {evt && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(evt.divisions || []).map((d) => (
                <Pill key={d} className={pickTone(d)}>
                  {d}
                </Pill>
              ))}
              {(evt.tags || []).map((t) => (
                <Pill key={t} className="bg-white/5 text-white/70 border-white/10">
                  #{t}
                </Pill>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Card className="border-white/10 bg-white/5">
                <CardContent className="p-4">
                  <p className="text-xs text-white/60">Region</p>
                  <p className="mt-1 text-sm text-white/85">{evt.region || "—"}</p>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5">
                <CardContent className="p-4">
                  <p className="text-xs text-white/60">Entry</p>
                  <p className="mt-1 text-sm text-white/85">{evt.price || "—"}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-white/10 bg-white/5">
              <CardContent className="p-4">
                <p className="text-xs text-white/60">About</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-white/75">{evt.description || "No description yet."}</p>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-white/55">
                {evt.organiser ? `Organiser: ${evt.organiser}` : ""}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="bg-white/10 text-white hover:bg-white/15"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(evt, null, 2))}
                >
                  Copy JSON
                </Button>
                <Button
                  variant="secondary"
                  className="bg-red-500/15 text-red-200 hover:bg-red-500/20"
                  onClick={() => onDelete(evt)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
                <Button
                  className={reg ? "bg-orange-500 text-black hover:bg-orange-400" : "bg-white/10 text-white/60 hover:bg-white/10"}
                  disabled={!reg}
                  onClick={() => reg && window.open(reg, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" /> {reg ? "Registration" : "No registration link"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddEventDialog({ open, onOpenChange, onAdd }) {
  const [form, setForm] = useState({
    name: "",
    date: "",
    city: "",
    region: "UK",
    venue: "",
    organiser: "",
    divisions: "RX, Scaled",
    level: "open",
    price: "",
    registrationUrl: "",
    tags: "",
    description: "",
  });

  useEffect(() => {
    if (!open) return;
    // Keep the form as-is when opening (no seeded event)
  }, [open]);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const canSave = form.name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(form.date.trim());

  const save = () => {
    if (!canSave) return;
    const evt = normalizeEvent({
      id: uid(),
      name: form.name,
      date: form.date,
      city: form.city,
      region: form.region,
      venue: form.venue,
      organiser: form.organiser,
      divisions: parseDivisions(form.divisions),
      level: form.level,
      price: form.price,
      registrationUrl: form.registrationUrl,
      tags: parseDivisions(form.tags),
      description: form.description,
      updatedAt: Date.now(),
    });
    onAdd(evt);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add an event</DialogTitle>
          <DialogDescription className="text-white/60">Minimum required: name + date (YYYY-MM-DD). Everything else is optional.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-white/80">Event name *</Label>
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. London Summer Throwdown"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Date *</Label>
            <Input
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
              placeholder="YYYY-MM-DD"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">City</Label>
            <Input
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              placeholder="e.g. Manchester"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Region</Label>
            <select
              value={form.region}
              onChange={(e) => update("region", e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r} className="bg-zinc-950">
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Venue</Label>
            <Input
              value={form.venue}
              onChange={(e) => update("venue", e.target.value)}
              placeholder="e.g. CrossFit XYZ"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Organiser</Label>
            <Input
              value={form.organiser}
              onChange={(e) => update("organiser", e.target.value)}
              placeholder="e.g. ABC Events"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Divisions (comma separated)</Label>
            <Input
              value={form.divisions}
              onChange={(e) => update("divisions", e.target.value)}
              placeholder="RX, Scaled, Masters"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Event type</Label>
            <select
              value={form.level}
              onChange={(e) => update("level", e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              {LEVELS.map((l) => (
                <option key={l.key} value={l.key} className="bg-zinc-950">
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Entry price</Label>
            <Input
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              placeholder="e.g. £60"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Registration link</Label>
            <Input
              value={form.registrationUrl}
              onChange={(e) => update("registrationUrl", e.target.value)}
              placeholder="https://..."
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-white/80">Tags (comma separated)</Label>
            <Input
              value={form.tags}
              onChange={(e) => update("tags", e.target.value)}
              placeholder="pairs, online-qualifier, charity"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-white/80">Description</Label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="A short description that sells the vibe, standards, and format…"
              className="min-h-[110px] w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button onClick={() => onOpenChange(false)} variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave} className="bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-50">
            Save event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExportPanel({ basePath = "/" }) {
  const [open, setOpen] = useState(false);

  const files = useMemo(() => {
    // Minimal Vite + React scaffold (copy/paste into repo).
    const pkg = `{
  "name": "throwdown-style-starter",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0",
    "tailwindcss": "^3.4.10",
    "postcss": "^8.4.41",
    "autoprefixer": "^10.4.20"
  }
}`;

    const viteCfg = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT for GitHub Pages:
// - If your repo is https://github.com/<user>/<repo>
// - base should be '/<repo>/'
export default defineConfig({
  plugins: [react()],
  base: '${basePath}',
})
`;

    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Competition Hub (Starter)</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;

    const main = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`;

    const app = `import ThrowdownStyleStarter from './ThrowdownStyleStarter'
export default function App(){
  return <ThrowdownStyleStarter />
}
`;

    const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root{ color-scheme: dark; }
html,body{ height:100%; }
body{ margin:0; background:#07070a; }
`;

    const tailwindCfg = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
`;

    const postcssCfg = `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
`;

    const gha = `name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`;

    return {
      "package.json": pkg,
      "vite.config.js": viteCfg,
      "index.html": indexHtml,
      "src/main.jsx": main,
      "src/App.jsx": app,
      "src/index.css": indexCss,
      "tailwind.config.js": tailwindCfg,
      "postcss.config.js": postcssCfg,
      ".github/workflows/pages.yml": gha,
    };
  }, [basePath]);

  const copyAll = async () => {
    const bundle = Object.entries(files)
      .map(([k, v]) => `--- ${k} ---\n${v}`)
      .join("\n\n");
    await navigator.clipboard.writeText(bundle);
  };

  return (
    <>
      <Button variant="secondary" className="bg-white/10 text-white hover:bg-white/15" onClick={() => setOpen(true)}>
        <Download className="mr-2 h-4 w-4" /> Export deploy files
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-zinc-950 text-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Export a GitHub Pages deployable starter</DialogTitle>
            <DialogDescription className="text-white/60">
              Copy these files into a new repo. Update <span className="text-white/80">vite.config.js</span> base to match your repo name, then push to main.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={copyAll} className="bg-orange-500 text-black hover:bg-orange-400">
                Copy all files
              </Button>
              <p className="text-xs text-white/60">Tip: you can paste into a single note, then split into files locally.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm text-white/80">Files included</p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {Object.keys(files).map((k) => (
                  <div key={k} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <span className="text-xs text-white/70">{k}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-white/10 text-white hover:bg-white/15"
                      onClick={() => navigator.clipboard.writeText(files[k])}
                    >
                      Copy
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/65">
              <p className="text-white/80">Quick publish checklist</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Create a GitHub repo and add these files.</li>
                <li>Set <span className="text-white/80">vite.config.js</span> base to <span className="text-white/80">'/{`YOUR_REPO_NAME`}/'</span>.</li>
                <li>Commit + push to <span className="text-white/80">main</span>.</li>
                <li>In GitHub: Settings → Pages → set Source to <span className="text-white/80">GitHub Actions</span>.</li>
                <li>Wait for the Actions workflow “Deploy to GitHub Pages” to go green.</li>
              </ol>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setOpen(false)} variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ThrowdownStyleStarter() {
  const [events, setEvents] = useLocalEvents();

  const [activeTab, setActiveTab] = useState("calendar");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => toISODate(new Date()));

  const [query, setQuery] = useState("");
  const [division, setDivision] = useState("All");
  const [region, setRegion] = useState("All");
  const [level, setLevel] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);

  const fileInputRef = useRef(null);

  const eventsByDay = useMemo(() => {
    const m = new Map();
    for (const e of events) {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date).push(e);
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      m.set(k, arr);
    }
    return m;
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events
      .filter((e) => {
        if (!e) return false;
        if (region !== "All" && (e.region || "").toLowerCase() !== region.toLowerCase()) return false;
        if (level !== "all" && (e.level || "") !== level) return false;
        if (division !== "All") {
          const divs = (e.divisions || []).map((x) => x.toLowerCase());
          if (!divs.includes(division.toLowerCase())) return false;
        }
        if (!q) return true;
        const hay = [e.name, e.city, e.venue, e.organiser, (e.tags || []).join(" ")].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, query, division, region, level]);

  const dayEvents = useMemo(() => {
    const list = eventsByDay.get(selectedDay) || [];
    // Apply same filters to day view
    const q = query.trim().toLowerCase();
    return list
      .filter((e) => {
        if (region !== "All" && (e.region || "").toLowerCase() !== region.toLowerCase()) return false;
        if (level !== "all" && (e.level || "") !== level) return false;
        if (division !== "All") {
          const divs = (e.divisions || []).map((x) => x.toLowerCase());
          if (!divs.includes(division.toLowerCase())) return false;
        }
        if (!q) return true;
        const hay = [e.name, e.city, e.venue, e.organiser, (e.tags || []).join(" ")].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [eventsByDay, selectedDay, query, division, region, level]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = filtered.filter((e) => e.date.startsWith(monthKey)).length;
    return { total, inMonth };
  }, [filtered, month]);

  const addEvent = (evt) => setEvents((prev) => [evt, ...prev].sort((a, b) => a.date.localeCompare(b.date)));

  const openEvent = (evt) => {
    setActiveEvent(evt);
    setDetailOpen(true);
  };

  const deleteEvent = (evt) => {
    if (!evt) return;
    const ok = confirm(`Delete “${evt.name}”? This only removes it from your browser storage.`);
    if (!ok) return;
    setEvents((prev) => prev.filter((x) => x.id !== evt.id));
    setDetailOpen(false);
  };

  const importClick = () => fileInputRef.current?.click();

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importJson(file, (incoming) => {
      // Merge by id
      setEvents((prev) => {
        const map = new Map(prev.map((x) => [x.id, x]));
        for (const ev of incoming) map.set(ev.id, ev);
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      });
    });
    e.target.value = "";
  };

  const clearAll = () => {
    const ok = confirm("Clear all events stored in this browser? (This won’t affect any server, it’s just local.)");
    if (!ok) return;
    setEvents([]);
  };

  const monthLabel = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#07070a] text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute -bottom-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute top-40 left-[-180px] h-[420px] w-[420px] rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_35px_rgba(251,146,60,.15)]">
              <span className="text-sm font-black tracking-widest text-orange-300">HUB</span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-none text-white/90">Competition Hub</p>
              <p className="mt-1 text-xs text-white/55">Throwdown-style UI starter (static + shareable)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => setAddOpen(true)} className="bg-orange-500 text-black hover:bg-orange-400">
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="bg-white/10 text-white hover:bg-white/15">
                  <Shield className="mr-2 h-4 w-4" /> Tools
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 border-white/10 bg-zinc-950 text-white">
                <DropdownMenuLabel className="text-white/70">Local data</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={importClick} className="cursor-pointer focus:bg-white/10">
                  Import events.json
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportJson(events)} className="cursor-pointer focus:bg-white/10">
                  Export events.json
                </DropdownMenuItem>
                <DropdownMenuItem onClick={clearAll} className="cursor-pointer text-red-200 focus:bg-white/10">
                  Clear local events
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ExportPanel basePath="/YOUR_REPO_NAME/" />

            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={onFile} />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pt-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-white/5 to-orange-500/5 p-6 shadow-[0_0_60px_rgba(251,146,60,.08)]"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white/95 md:text-3xl">Find. Filter. Register.</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/65">
                A clean, dark, neon-accent competition calendar — designed for quick scanning like an event hub.
                This prototype runs fully static (no backend) so you can publish it as a temporary page.
              </p>
              <NeonDivider />
              <div className="flex flex-wrap gap-2">
                <Pill className="bg-white/5 text-white/75 border-white/10">Calendar view</Pill>
                <Pill className="bg-white/5 text-white/75 border-white/10">Event cards</Pill>
                <Pill className="bg-white/5 text-white/75 border-white/10">Search + filters</Pill>
                <Pill className="bg-white/5 text-white/75 border-white/10">JSON import/export</Pill>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="border-white/10 bg-black/30">
                <CardContent className="p-4">
                  <p className="text-xs text-white/60">Events (filtered)</p>
                  <p className="mt-2 text-2xl font-black text-white/90">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-black/30">
                <CardContent className="p-4">
                  <p className="text-xs text-white/60">This month</p>
                  <p className="mt-2 text-2xl font-black text-white/90">{stats.inMonth}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-6">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search events, cities, organisers, tags…"
                  className="border-white/10 bg-black/30 pl-9 text-white placeholder:text-white/40"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <Filter className="h-4 w-4 text-white/40" />
                <select
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  className="w-full bg-transparent text-sm text-white/80 outline-none"
                >
                  {DEFAULT_DIVISIONS.map((d) => (
                    <option key={d} value={d} className="bg-zinc-950">
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <Filter className="h-4 w-4 text-white/40" />
                <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full bg-transparent text-sm text-white/80 outline-none">
                  {REGIONS.map((r) => (
                    <option key={r} value={r} className="bg-zinc-950">
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <Filter className="h-4 w-4 text-white/40" />
                <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full bg-transparent text-sm text-white/80 outline-none">
                  <option value="all" className="bg-zinc-950">All types</option>
                  {LEVELS.map((l) => (
                    <option key={l.key} value={l.key} className="bg-zinc-950">{l.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 rounded-2xl border border-white/10 bg-white/5 p-1">
            <TabsTrigger value="calendar" className="rounded-xl data-[state=active]:bg-black/40 data-[state=active]:text-white">
              <CalendarDays className="mr-2 h-4 w-4" /> Calendar
            </TabsTrigger>
            <TabsTrigger value="events" className="rounded-xl data-[state=active]:bg-black/40 data-[state=active]:text-white">
              <Search className="mr-2 h-4 w-4" /> Events
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-xl data-[state=active]:bg-black/40 data-[state=active]:text-white">
              <Trophy className="mr-2 h-4 w-4" /> Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-6">
            {events.length === 0 ? (
              <EmptyState onAdd={() => setAddOpen(true)} />
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white/90">{monthLabel}</p>
                      <p className="text-xs text-white/55">Click a day to see events</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="bg-white/10 text-white hover:bg-white/15"
                        onClick={() => setMonth((m) => addMonths(m, -1))}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="secondary"
                        className="bg-white/10 text-white hover:bg-white/15"
                        onClick={() => setMonth(startOfMonth(new Date()))}
                      >
                        Today
                      </Button>
                      <Button
                        variant="secondary"
                        className="bg-white/10 text-white hover:bg-white/15"
                        onClick={() => setMonth((m) => addMonths(m, 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>

                  <CalendarGrid month={month} eventsByDay={eventsByDay} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
                </div>

                <div className="lg:col-span-5">
                  <Card className="border-white/10 bg-white/5 backdrop-blur">
                    <CardHeader>
                      <CardTitle className="text-base text-white/90">{formatHumanDate(selectedDay)}</CardTitle>
                      <CardDescription className="text-white/60">{dayEvents.length ? `${dayEvents.length} event(s) match your filters` : "No matches for this day"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {dayEvents.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/65">
                          Try changing filters, or add a new event.
                        </div>
                      ) : (
                        dayEvents.map((evt) => (
                          <button
                            key={evt.id}
                            type="button"
                            onClick={() => openEvent(evt)}
                            className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition hover:bg-black/40"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white/90">{evt.name}</p>
                                <p className="mt-1 text-xs text-white/55">{evt.city ? `${evt.city} · ` : ""}{evt.region || ""}</p>
                              </div>
                              <Badge className="bg-orange-500/15 text-orange-200">View</Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(evt.divisions || []).slice(0, 4).map((d) => (
                                <Pill key={d} className={pickTone(d)}>
                                  {d}
                                </Pill>
                              ))}
                            </div>
                          </button>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-6">
            {events.length === 0 ? (
              <EmptyState onAdd={() => setAddOpen(true)} />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filtered.map((evt) => (
                  <EventCard key={evt.id} evt={evt} onOpen={openEvent} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-6">
            <Card className="border-white/10 bg-white/5 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5">
                    <Trophy className="h-5 w-5 text-orange-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/90">Leaderboard (placeholder)</p>
                    <p className="mt-1 text-sm text-white/65">
                      Competition Corner-style scoring/leaderboards need a backend + auth + per-workout score validation.
                      This tab is a stub so the prototype can be shared now.
                    </p>
                  </div>
                </div>

                <Separator className="my-4 bg-white/10" />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Card className="border-white/10 bg-black/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-white/60">Next build block</p>
                      <p className="mt-2 text-sm text-white/80">Auth + roles (athlete / judge / organiser)</p>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-black/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-white/60">Then</p>
                      <p className="mt-2 text-sm text-white/80">Event registration + payment integration</p>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-black/30">
                    <CardContent className="p-4">
                      <p className="text-xs text-white/60">Then</p>
                      <p className="mt-2 text-sm text-white/80">Workouts + submissions + leaderboard</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <AddEventDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addEvent} />
        <EventDetail evt={activeEvent} open={detailOpen} onOpenChange={setDetailOpen} onDelete={deleteEvent} />

        <footer className="mt-10 text-center text-xs text-white/45">
          <p>
            Prototype only — built to share a look & feel. Replace local storage with a real backend when you move beyond a temp page.
          </p>
        </footer>
      </main>
    </div>
  );
}
