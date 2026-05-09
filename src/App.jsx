import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Throwdown Hub — Single-file Demo App.jsx
 * - No router
 * - No external UI imports (no shadcn, no "@/..." aliases)
 * - LocalStorage persistence
 * - Events Directory (calendar + list + CRUD + import/export)
 * - Competition demo (roles, athlete/team mode, judge/head judge workflows, hideable leaderboards)
 */

/* ================================
   LOCAL STORAGE
================================ */
const LS_KEY = "tdh_single_file_demo_v2";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function loadData() {
  const raw = localStorage.getItem(LS_KEY);
  return raw ? safeParse(raw, null) : null;
}

function saveData(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

/* ================================
   SMALL UTILITIES
================================ */
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function yyyyMmDd(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function startOfMonth(year, monthIndex) {
  return new Date(year, monthIndex, 1);
}

function endOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0);
}

function dayOfWeekMonStart(jsDay) {
  // JS: Sun=0..Sat=6, we want Mon=0..Sun=6
  return (jsDay + 6) % 7;
}

function buildMonthGrid(year, monthIndex) {
  const first = startOfMonth(year, monthIndex);
  const last = endOfMonth(year, monthIndex);

  const firstDow = dayOfWeekMonStart(first.getDay());
  const totalDays = last.getDate();

  const cells = [];
  // leading blanks
  for (let i = 0; i < firstDow; i++) cells.push(null);
  // days
  for (let d = 1; d <= totalDays; d++) {
    cells.push(new Date(year, monthIndex, d));
  }
  // trailing blanks to complete weeks (optional)
  while (cells.length % 7 !== 0) cells.push(null);

  return cells; // array of Date|null length multiple of 7
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normaliseStr(s) {
  return String(s ?? "").trim().toLowerCase();
}

function scoreToNumber(v) {
  // Allow numeric strings
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ================================
   DEMO DATA
================================ */
const ROLES = ["spectator", "athlete", "team_manager", "judge", "head_judge", "organiser"];

const DEFAULT_DATA = {
  meta: { version: 2, createdAt: new Date().toISOString() },
  ui: {
    tab: "directory", // directory | competition | admin
    directoryView: "calendar", // calendar | list
    compId: "comp_london",
  },
  role: "spectator",
  mode: "athlete", // athlete | team
  settings: {
    hideLeaderboard: false,
    regClosed: false,
    requireApproval: true,
    finalOnlyLeaderboard: false, // if true, show only approved
    allowProvisionalViewForJudges: true, // judges/organiser/head judge can see provisional even if finalOnlyLeaderboard on
  },
  directory: {
    events: [
      {
        id: "evt_london_throwdown",
        name: "London Throwdown",
        startDate: "2026-06-20",
        endDate: "2026-06-21",
        city: "London",
        venue: "Docklands Arena",
        divisions: ["RX", "Scaled", "Masters 35+"],
        tags: ["throwdown", "two-day"],
        status: "upcoming", // upcoming | past | cancelled
        regOpen: true,
        website: "",
        instagram: "@throwdownhub",
        notes: "Demo event — replace with real data later.",
      },
      {
        id: "evt_midlands_duo",
        name: "Midlands Duo Battle",
        startDate: "2026-07-12",
        endDate: "2026-07-12",
        city: "Birmingham",
        venue: "Unit 7 Training Hall",
        divisions: ["Intermediate", "Scaled"],
        tags: ["pairs", "indoor"],
        status: "upcoming",
        regOpen: true,
        website: "",
        instagram: "",
        notes: "",
      },
      {
        id: "evt_north_warriors",
        name: "North Warriors Cup",
        startDate: "2026-04-05",
        endDate: "2026-04-05",
        city: "Manchester",
        venue: "North Hall",
        divisions: ["RX", "Intermediate"],
        tags: ["single-day"],
        status: "past",
        regOpen: false,
        website: "",
        instagram: "",
        notes: "Past demo event.",
      },
    ],
  },
  competitions: [
    {
      id: "comp_london",
      name: "London Throwdown (Demo Comp)",
      date: "2026-06-20",
      location: "London",
      description: "Single-file demo competition with roles, judging and approvals.",
      divisions: ["RX", "Scaled", "Intermediate", "Masters 35+"],
      workouts: [
        { id: "w1", name: "Event 1 — Sprint", scoring: "time", sort: "asc", unit: "sec" },
        { id: "w2", name: "Event 2 — AMRAP", scoring: "reps", sort: "desc", unit: "reps" },
        { id: "w3", name: "Event 3 — Heavy", scoring: "load", sort: "desc", unit: "kg" },
      ],
      athletes: [
        { name: "Sam Carter", division: "RX" },
        { name: "Jess Morgan", division: "Scaled" },
        { name: "Mike Patel", division: "Intermediate" },
        { name: "Aisha Khan", division: "RX" },
      ],
      teams: [
        { name: "Team Alpha", division: "RX", members: ["Sam Carter", "Aisha Khan"] },
        { name: "Team Beta", division: "Scaled", members: ["Jess Morgan", "Mike Patel"] },
      ],
      registrations: {
        athletes: {
          // "Name": { division, status }
          "Sam Carter": { division: "RX", status: "confirmed" },
          "Jess Morgan": { division: "Scaled", status: "confirmed" },
          "Mike Patel": { division: "Intermediate", status: "confirmed" },
          "Aisha Khan": { division: "RX", status: "confirmed" },
        },
        teams: {
          "Team Alpha": { division: "RX", status: "confirmed" },
          "Team Beta": { division: "Scaled", status: "confirmed" },
        },
      },
      judgePool: ["Jordan Lee", "Taylor Price", "Charlie Scott"],
      judgeAssignments: {
        // workoutId -> judgeName -> [participantNames]
        w1: { "Jordan Lee": ["Sam Carter", "Jess Morgan"], "Taylor Price": ["Mike Patel", "Aisha Khan"] },
        w2: { "Charlie Scott": ["Sam Carter", "Aisha Khan"], "Taylor Price": ["Jess Morgan", "Mike Patel"] },
        w3: { "Jordan Lee": ["Sam Carter", "Mike Patel"], "Charlie Scott": ["Jess Morgan", "Aisha Khan"] },
      },
      scores: {
        // workoutId -> participantName -> { value, status, judge, note, updatedAt }
        w1: {},
        w2: {},
        w3: {},
      },
      reviewQueue: [
        // { id, workoutId, participant, value, judge, action, note, createdAt }
      ],
      audit: [
        // { id, at, whoRole, whoName, message }
      ],
    },
    {
      id: "comp_pairs",
      name: "Pairs Bash (Demo Comp)",
      date: "2026-07-12",
      location: "Birmingham",
      description: "Second demo comp with teams-focused format.",
      divisions: ["RX", "Scaled"],
      workouts: [
        { id: "p1", name: "Pairs 1 — Sync", scoring: "reps", sort: "desc", unit: "reps" },
        { id: "p2", name: "Pairs 2 — Grinder", scoring: "time", sort: "asc", unit: "sec" },
      ],
      athletes: [
        { name: "Ethan Rowe", division: "RX" },
        { name: "Maya Singh", division: "RX" },
        { name: "Noah James", division: "Scaled" },
        { name: "Chloe Evans", division: "Scaled" },
      ],
      teams: [
        { name: "Duo One", division: "RX", members: ["Ethan Rowe", "Maya Singh"] },
        { name: "Duo Two", division: "Scaled", members: ["Noah James", "Chloe Evans"] },
      ],
      registrations: {
        athletes: {},
        teams: {
          "Duo One": { division: "RX", status: "confirmed" },
          "Duo Two": { division: "Scaled", status: "confirmed" },
        },
      },
      judgePool: ["Avery Woods", "Riley Chen"],
      judgeAssignments: {
        p1: { "Avery Woods": ["Duo One"], "Riley Chen": ["Duo Two"] },
        p2: { "Avery Woods": ["Duo One"], "Riley Chen": ["Duo Two"] },
      },
      scores: { p1: {}, p2: {} },
      reviewQueue: [],
      audit: [],
    },
  ],
};

/* ================================
   SIMPLE STYLES (inline)
================================ */
const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0b0f17, #070a10)",
    color: "#e7eefc",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
  },
  container: { maxWidth: 1180, margin: "0 auto", padding: 18 },
  headerRow: { display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  title: { fontSize: 22, fontWeight: 800, letterSpacing: 0.2 },
  subTitle: { fontSize: 12, opacity: 0.8, marginTop: 2 },
  card: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
  },
  row: { display: "flex", gap: 12, flexWrap: "wrap" },
  col: { display: "flex", flexDirection: "column", gap: 10 },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.18)",
    fontSize: 12,
  },
  btn: {
    cursor: "pointer",
    userSelect: "none",
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.07)",
    color: "#e7eefc",
    fontWeight: 650,
    fontSize: 13,
  },
  btnPrimary: {
    cursor: "pointer",
    userSelect: "none",
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid rgba(120,190,255,0.35)",
    background: "linear-gradient(180deg, rgba(45,140,255,0.35), rgba(45,140,255,0.20))",
    color: "#eaf3ff",
    fontWeight: 750,
    fontSize: 13,
  },
  btnDanger: {
    cursor: "pointer",
    userSelect: "none",
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid rgba(255,110,110,0.35)",
    background: "linear-gradient(180deg, rgba(255,70,70,0.25), rgba(255,70,70,0.12))",
    color: "#ffe9e9",
    fontWeight: 750,
    fontSize: 13,
  },
  btnSmall: {
    cursor: "pointer",
    userSelect: "none",
    padding: "7px 9px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.07)",
    color: "#e7eefc",
    fontWeight: 650,
    fontSize: 12,
  },
  input: {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(0,0,0,0.25)",
    color: "#e7eefc",
    outline: "none",
  },
  label: { fontSize: 12, opacity: 0.85, fontWeight: 650 },
  divider: { height: 1, background: "rgba(255,255,255,0.12)", margin: "10px 0" },
  tag: {
    display: "inline-flex",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    opacity: 0.95,
  },
  muted: { opacity: 0.78, fontSize: 12 },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  th: { textAlign: "left", fontSize: 12, opacity: 0.8, padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.12)" },
  td: { padding: "10px", borderBottom: "1px solid rgba(255,255,255,0.08)", verticalAlign: "top", fontSize: 13 },
};

function Button({ variant = "default", style, ...props }) {
  const base = variant === "primary" ? S.btnPrimary : variant === "danger" ? S.btnDanger : S.btn;
  return <button style={{ ...base, ...style }} {...props} />;
}

function SmallButton({ style, ...props }) {
  return <button style={{ ...S.btnSmall, ...style }} {...props} />;
}

function Field({ label, children, style }) {
  return (
    <div style={{ ...style }}>
      {label ? <div style={S.label}>{label}</div> : null}
      {children}
    </div>
  );
}

function Select({ value, onChange, options, style }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...S.input, ...style }}>
      {options.map((o) => (
        <option key={o} value={o} style={{ background: "#0b0f17" }}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
      <div>
        <div style={{ fontWeight: 750, fontSize: 13 }}>{label}</div>
        {hint ? <div style={{ ...S.muted, marginTop: 2 }}>{hint}</div> : null}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 46,
          height: 26,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.18)",
          background: checked ? "rgba(70,170,255,0.35)" : "rgba(255,255,255,0.08)",
          position: "relative",
          cursor: "pointer",
        }}
        aria-label={label}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 24 : 4,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: checked ? "rgba(190,235,255,0.95)" : "rgba(255,255,255,0.75)",
            transition: "left 120ms ease",
          }}
        />
      </button>
    </div>
  );
}

/* ================================
   MAIN APP
================================ */
export default function App() {
  const [data, setData] = useState(() => loadData() || DEFAULT_DATA);

  // Persist
  useEffect(() => {
    saveData(data);
  }, [data]);

  // Ensure compId exists
  const currentComp = useMemo(() => {
    const found = data.competitions.find((c) => c.id === data.ui.compId) || data.competitions[0];
    return found;
  }, [data.competitions, data.ui.compId]);

  // Derived: role helpers
  const role = data.role;
  const isOrganiser = role === "organiser";
  const isHeadJudge = role === "head_judge";
  const isJudge = role === "judge";
  const isTeamManager = role === "team_manager";
  const isAthlete = role === "athlete";
  const canScore = isJudge || isOrganiser; // judges + organisers can submit
  const canReview = isHeadJudge || isOrganiser; // head judge + organiser can approve/override
  const canEditDirectory = isOrganiser; // keep simple: only organiser edits events

  // UI
  const tab = data.ui.tab;

  const setTab = (t) => setData((d) => ({ ...d, ui: { ...d.ui, tab: t } }));
  const setDirectoryView = (v) => setData((d) => ({ ...d, ui: { ...d.ui, directoryView: v } }));
  const setCompId = (id) => setData((d) => ({ ...d, ui: { ...d.ui, compId: id } }));

  const setRole = (r) => setData((d) => ({ ...d, role: r }));
  const toggleMode = () =>
    setData((d) => ({ ...d, mode: d.mode === "athlete" ? "team" : "athlete" }));

  const toggleSetting = (key) =>
    setData((d) => ({ ...d, settings: { ...d.settings, [key]: !d.settings[key] } }));

  const resetDemo = () => {
    localStorage.removeItem(LS_KEY);
    setData(DEFAULT_DATA);
  };

  /* ================================
     DIRECTORY — CRUD + Filters + Calendar/List
  ================================ */
  const [dirMonth, setDirMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(() => yyyyMmDd(new Date()));
  const [dirFilters, setDirFilters] = useState({
    q: "",
    status: "all",
    division: "all",
    reg: "all",
  });

  const directoryEvents = data.directory.events;

  const divisionsInDirectory = useMemo(() => {
    const set = new Set();
    directoryEvents.forEach((e) => (e.divisions || []).forEach((d) => set.add(d)));
    return ["all", ...Array.from(set).sort()];
  }, [directoryEvents]);

  const filteredDirectoryEvents = useMemo(() => {
    const q = normaliseStr(dirFilters.q);
    return directoryEvents
      .slice()
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
      .filter((e) => {
        if (dirFilters.status !== "all" && e.status !== dirFilters.status) return false;
        if (dirFilters.reg !== "all") {
          const wantOpen = dirFilters.reg === "open";
          if (!!e.regOpen !== wantOpen) return false;
        }
        if (dirFilters.division !== "all") {
          if (!(e.divisions || []).includes(dirFilters.division)) return false;
        }
        if (q) {
          const blob = [
            e.name,
            e.city,
            e.venue,
            (e.divisions || []).join(" "),
            (e.tags || []).join(" "),
            e.notes,
          ]
            .join(" ")
            .toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      });
  }, [directoryEvents, dirFilters]);

  const eventsByDate = useMemo(() => {
    // map date -> events that include that date (start..end)
    const map = new Map();
    const add = (dateIso, evt) => {
      const arr = map.get(dateIso) || [];
      arr.push(evt);
      map.set(dateIso, arr);
    };
    directoryEvents.forEach((e) => {
      const start = e.startDate ? new Date(e.startDate + "T00:00:00") : null;
      const end = e.endDate ? new Date(e.endDate + "T00:00:00") : start;
      if (!start || Number.isNaN(start.getTime())) return;
      const endD = end && !Number.isNaN(end.getTime()) ? end : start;
      const days = Math.max(1, Math.round((endD - start) / 86400000) + 1);
      for (let i = 0; i < days; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        add(yyyyMmDd(d), e);
      }
    });
    // Sort each day list
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      map.set(k, arr);
    }
    return map;
  }, [directoryEvents]);

  const monthGrid = useMemo(() => buildMonthGrid(dirMonth.year, dirMonth.monthIndex), [dirMonth]);

  // Directory editor modal
  const [eventEditor, setEventEditor] = useState(null); // { mode: "new"|"edit", draft: eventObj }
  const openNewEvent = () => {
    const today = yyyyMmDd(new Date());
    setEventEditor({
      mode: "new",
      draft: {
        id: uid("evt"),
        name: "",
        startDate: today,
        endDate: today,
        city: "",
        venue: "",
        divisions: ["RX"],
        tags: [],
        status: "upcoming",
        regOpen: true,
        website: "",
        instagram: "",
        notes: "",
      },
    });
  };
  const openEditEvent = (evt) => {
    setEventEditor({ mode: "edit", draft: JSON.parse(JSON.stringify(evt)) });
  };
  const closeEventEditor = () => setEventEditor(null);

  const upsertEvent = (evt) => {
    setData((d) => {
      const events = d.directory.events.slice();
      const idx = events.findIndex((x) => x.id === evt.id);
      if (idx >= 0) events[idx] = evt;
      else events.push(evt);
      return { ...d, directory: { ...d.directory, events } };
    });
    setEventEditor(null);
  };

  const deleteEvent = (id) => {
    setData((d) => ({
      ...d,
      directory: { ...d.directory, events: d.directory.events.filter((e) => e.id !== id) },
    }));
  };

  // Import / Export directory (or full app)
  const fileInputRef = useRef(null);

  const exportDirectory = () => {
    downloadJson(`tdh_directory_${yyyyMmDd(new Date())}.json`, data.directory);
  };

  const exportAll = () => {
    downloadJson(`tdh_demo_all_${yyyyMmDd(new Date())}.json`, data);
  };

  const importJson = async (file) => {
    const text = await file.text();
    const obj = safeParse(text, null);
    if (!obj) return { ok: false, error: "Invalid JSON." };

    // Accept either full data (has competitions + directory) or directory-only
    if (obj.directory && obj.competitions) {
      setData(obj);
      return { ok: true };
    }
    if (obj.events && Array.isArray(obj.events)) {
      setData((d) => ({ ...d, directory: { events: obj.events } }));
      return { ok: true };
    }
    if (obj.directory && obj.directory.events && Array.isArray(obj.directory.events)) {
      setData((d) => ({ ...d, directory: { events: obj.directory.events } }));
      return { ok: true };
    }
    return { ok: false, error: "JSON didn’t match expected schema." };
  };

  const [toast, setToast] = useState(null); // { type, msg }
  const showToast = (type, msg) => {
    setToast({ type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2800);
  };

  /* ================================
     COMPETITION — registrations, scoring, review queue, leaderboard
  ================================ */
  const [compView, setCompView] = useState("overview"); // overview | register | scoring | review | leaderboard | audit
  const setCompViewSafe = (v) => setCompView(v);

  const getComp = (compId) => data.competitions.find((c) => c.id === compId);

  const updateComp = (compId, updater) => {
    setData((d) => {
      const comps = d.competitions.slice();
      const idx = comps.findIndex((c) => c.id === compId);
      if (idx < 0) return d;
      const next = updater(JSON.parse(JSON.stringify(comps[idx])));
      comps[idx] = next;
      return { ...d, competitions: comps };
    });
  };

  const addAudit = (compId, message, whoName = "") => {
    updateComp(compId, (c) => {
      c.audit = c.audit || [];
      c.audit.unshift({
        id: uid("audit"),
        at: new Date().toISOString(),
        whoRole: role,
        whoName: whoName || (role === "judge" ? "Judge" : role === "head_judge" ? "Head Judge" : ""),
        message,
      });
      return c;
    });
  };

  const participants = useMemo(() => {
    const c = currentComp;
    if (!c) return [];
    if (data.mode === "athlete") {
      return (c.athletes || []).map((a) => a.name);
    }
    return (c.teams || []).map((t) => t.name);
  }, [currentComp, data.mode]);

  const participantMeta = useMemo(() => {
    const c = currentComp;
    const map = new Map();
    if (!c) return map;
    (c.athletes || []).forEach((a) => map.set(a.name, { type: "athlete", division: a.division }));
    (c.teams || []).forEach((t) => map.set(t.name, { type: "team", division: t.division, members: t.members || [] }));
    return map;
  }, [currentComp]);

  const isRegistered = (name) => {
    const c = currentComp;
    if (!c) return false;
    if (data.mode === "athlete") return !!c.registrations?.athletes?.[name];
    return !!c.registrations?.teams?.[name];
  };

  const registerParticipant = (name) => {
    if (data.settings.regClosed) {
      showToast("warn", "Registration is currently closed.");
      return;
    }
    updateComp(currentComp.id, (c) => {
      c.registrations = c.registrations || { athletes: {}, teams: {} };
      if (data.mode === "athlete") {
        const div = participantMeta.get(name)?.division || c.divisions?.[0] || "Open";
        c.registrations.athletes[name] = { division: div, status: "confirmed" };
      } else {
        const div = participantMeta.get(name)?.division || c.divisions?.[0] || "Open";
        c.registrations.teams[name] = { division: div, status: "confirmed" };
      }
      return c;
    });
    addAudit(currentComp.id, `Registered ${name} (${data.mode}).`);
    showToast("ok", `${name} registered.`);
  };

  const unregisterParticipant = (name) => {
    if (data.settings.regClosed) {
      showToast("warn", "Registration is currently closed.");
      return;
    }
    updateComp(currentComp.id, (c) => {
      c.registrations = c.registrations || { athletes: {}, teams: {} };
      if (data.mode === "athlete") delete c.registrations.athletes[name];
      else delete c.registrations.teams[name];
      return c;
    });
    addAudit(currentComp.id, `Unregistered ${name} (${data.mode}).`);
    showToast("ok", `${name} removed from registrations.`);
  };

  const assignedJudgeFor = (workoutId, participantName) => {
    const c = currentComp;
    const assignment = c?.judgeAssignments?.[workoutId] || {};
    const entries = Object.entries(assignment);
    for (const [j, list] of entries) {
      if ((list || []).includes(participantName)) return j;
    }
    return "";
  };

  const canThisJudgeScore = (workoutId, participantName) => {
    if (!canScore) return false;
    // If role is judge, only allow if assigned to them (strict). Organiser can score anyone.
    if (role === "organiser") return true;
    const assigned = assignedJudgeFor(workoutId, participantName);
    // For a plain judge, we don't know their "identity" in demo. We'll allow judge to pick a name from judgePool and enforce assignment.
    return !!assigned;
  };

  const submitScore = (workoutId, participantName, value, judgeName, note = "") => {
    const c = currentComp;
    if (!c) return;

    const w = c.workouts.find((x) => x.id === workoutId);
    if (!w) return;

    const n = scoreToNumber(value);
    if (n === null) {
      showToast("warn", "Score must be a number.");
      return;
    }

    const assigned = assignedJudgeFor(workoutId, participantName);
    if (role === "judge" && judgeName && assigned && judgeName !== assigned) {
      showToast("warn", `This lane is assigned to ${assigned}.`);
      return;
    }

    updateComp(c.id, (compDraft) => {
      compDraft.scores = compDraft.scores || {};
      compDraft.scores[workoutId] = compDraft.scores[workoutId] || {};
      const requireApproval = data.settings.requireApproval;
      const status = requireApproval ? "pending" : "approved";
      compDraft.scores[workoutId][participantName] = {
        value: n,
        status,
        judge: judgeName || (role === "organiser" ? "Organiser" : assigned || "Judge"),
        note: note || "",
        updatedAt: new Date().toISOString(),
      };

      if (requireApproval) {
        compDraft.reviewQueue = compDraft.reviewQueue || [];
        compDraft.reviewQueue.unshift({
          id: uid("rq"),
          workoutId,
          participant: participantName,
          value: n,
          judge: judgeName || (role === "organiser" ? "Organiser" : assigned || "Judge"),
          action: "submitted",
          note: note || "",
          createdAt: new Date().toISOString(),
        });
      }

      return compDraft;
    });

    addAudit(c.id, `Score submitted: ${participantName} — ${w.name} = ${n} ${w.unit} (${data.settings.requireApproval ? "pending" : "approved"}).`);
    showToast("ok", "Score submitted.");
  };

  const approveQueueItem = (itemId) => {
    updateComp(currentComp.id, (c) => {
      const item = (c.reviewQueue || []).find((x) => x.id === itemId);
      if (!item) return c;
      c.scores[item.workoutId] = c.scores[item.workoutId] || {};
      const s = c.scores[item.workoutId][item.participant];
      if (s) s.status = "approved";
      c.reviewQueue = (c.reviewQueue || []).filter((x) => x.id !== itemId);
      return c;
    });
    addAudit(currentComp.id, `Approved score: ${itemId}`);
    showToast("ok", "Approved.");
  };

  const requestChangeQueueItem = (itemId, message) => {
    updateComp(currentComp.id, (c) => {
      const item = (c.reviewQueue || []).find((x) => x.id === itemId);
      if (!item) return c;
      c.scores[item.workoutId] = c.scores[item.workoutId] || {};
      const s = c.scores[item.workoutId][item.participant];
      if (s) {
        s.status = "needs_change";
        s.note = message || s.note || "Change requested.";
        s.updatedAt = new Date().toISOString();
      }
      // keep item but mark
      item.action = "change_requested";
      item.note = message || item.note || "";
      item.createdAt = new Date().toISOString();
      return c;
    });
    addAudit(currentComp.id, `Change requested: ${itemId} (${message || "no note"})`);
    showToast("ok", "Change requested.");
  };

  const overrideQueueItem = (itemId, newValue, note) => {
    const n = scoreToNumber(newValue);
    if (n === null) {
      showToast("warn", "Override value must be a number.");
      return;
    }
    updateComp(currentComp.id, (c) => {
      const item = (c.reviewQueue || []).find((x) => x.id === itemId);
      if (!item) return c;
      c.scores[item.workoutId] = c.scores[item.workoutId] || {};
      c.scores[item.workoutId][item.participant] = {
        value: n,
        status: "approved",
        judge: "Head Judge Override",
        note: note || "Override applied.",
        updatedAt: new Date().toISOString(),
      };
      c.reviewQueue = (c.reviewQueue || []).filter((x) => x.id !== itemId);
      return c;
    });
    addAudit(currentComp.id, `Override applied: ${itemId} => ${n}`);
    showToast("ok", "Override applied.");
  };

  const leaderboard = useMemo(() => {
    const c = currentComp;
    if (!c) return [];
    const totals = new Map();
    const details = new Map(); // name -> per workout score/status

    const finalOnly = data.settings.finalOnlyLeaderboard;
    const requireApproval = data.settings.requireApproval;

    const allowProvisional =
      !finalOnly ||
      (data.settings.allowProvisionalViewForJudges && (isJudge || isHeadJudge || isOrganiser));

    // For each workout, aggregate numeric value (simple sum demo)
    c.workouts.forEach((w) => {
      const scoreMap = c.scores?.[w.id] || {};
      Object.entries(scoreMap).forEach(([name, s]) => {
        // If requireApproval: include approved always; include pending only in provisional mode
        const isApproved = s.status === "approved";
        const isPending = s.status === "pending";
        const isNeedsChange = s.status === "needs_change";

        let include = false;
        if (!requireApproval) include = true;
        else if (isApproved) include = true;
        else if (isPending && allowProvisional) include = true;
        else include = false;

        // If finalOnlyLeaderboard is true, hide non-approved unless privileged and allowProvisional
        if (finalOnly && !isApproved && !allowProvisional) include = false;

        if (!include) {
          // still record detail
          const d = details.get(name) || {};
          d[w.id] = { value: s.value, status: s.status, unit: w.unit };
          details.set(name, d);
          return;
        }

        const current = totals.get(name) || 0;
        totals.set(name, current + Number(s.value));

        const d = details.get(name) || {};
        d[w.id] = { value: s.value, status: s.status, unit: w.unit };
        details.set(name, d);
      });
    });

    // Return entries sorted by total (descending by default)
    const rows = Array.from(totals.entries()).map(([name, total]) => ({
      name,
      total,
      division: participantMeta.get(name)?.division || "",
      breakdown: details.get(name) || {},
    }));

    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [
    currentComp,
    data.settings.finalOnlyLeaderboard,
    data.settings.requireApproval,
    data.settings.allowProvisionalViewForJudges,
    isJudge,
    isHeadJudge,
    isOrganiser,
    participantMeta,
  ]);

  // Score entry UI state
  const [scoreDraft, setScoreDraft] = useState({
    workoutId: "",
    participant: "",
    value: "",
    judgeName: "",
    note: "",
  });

  useEffect(() => {
    // reset score form on comp change
    const c = currentComp;
    if (!c) return;
    setScoreDraft((s) => ({
      ...s,
      workoutId: c.workouts?.[0]?.id || "",
      participant: participants?.[0] || "",
      judgeName: c.judgePool?.[0] || "",
      value: "",
      note: "",
    }));
    setCompViewSafe("overview");
  }, [data.ui.compId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ================================
     RENDER HELPERS
  ================================ */
  const Header = () => (
    <div style={S.headerRow}>
      <div>
        <div style={S.title}>Throwdown Hub — Single‑File Demo</div>
        <div style={S.subTitle}>
          Directory + Competition workflows, all in <code>src/App.jsx</code> (localStorage persisted)
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={S.pill}>
          <strong>Role</strong>
          <Select
            value={data.role}
            onChange={(v) => setRole(v)}
            options={ROLES}
            style={{ padding: "6px 8px", borderRadius: 999 }}
          />
        </div>
        <div style={S.pill}>
          <strong>Mode</strong>
          <Button variant="primary" onClick={toggleMode} style={{ padding: "6px 10px", borderRadius: 999 }}>
            {data.mode === "athlete" ? "Athlete" : "Team"}
          </Button>
        </div>

        <Button onClick={exportAll}>Export All</Button>
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="primary"
          title="Import either full demo JSON or directory JSON"
        >
          Import JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const res = await importJson(f);
            if (res.ok) showToast("ok", "Imported successfully.");
            else showToast("warn", res.error || "Import failed.");
            e.target.value = "";
          }}
        />
        <Button variant="danger" onClick={resetDemo}>
          Reset Demo
        </Button>
      </div>
    </div>
  );

  const Tabs = () => (
    <div style={{ ...S.row, marginTop: 12 }}>
      <Button variant={tab === "directory" ? "primary" : "default"} onClick={() => setTab("directory")}>
        Events Directory
      </Button>
      <Button variant={tab === "competition" ? "primary" : "default"} onClick={() => setTab("competition")}>
        Competition Demo
      </Button>
      <Button variant={tab === "admin" ? "primary" : "default"} onClick={() => setTab("admin")}>
        Settings / Admin
      </Button>
    </div>
  );

  const Toast = () =>
    toast ? (
      <div
        style={{
          position: "fixed",
          right: 14,
          bottom: 14,
          padding: "10px 12px",
          borderRadius: 12,
          background: toast.type === "ok" ? "rgba(70,170,255,0.25)" : "rgba(255,160,70,0.22)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          maxWidth: 360,
          zIndex: 1000,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: 0.2 }}>
          {toast.type === "ok" ? "Done" : "Note"}
        </div>
        <div style={{ marginTop: 4, fontSize: 13 }}>{toast.msg}</div>
      </div>
    ) : null;

  /* ================================
     DIRECTORY UI
  ================================ */
  const DirectoryPanel = () => {
    const view = data.ui.directoryView;

    const monthName = new Date(dirMonth.year, dirMonth.monthIndex, 1).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });

    const dayEvents = eventsByDate.get(selectedDate) || [];

    return (
      <div style={{ ...S.row, marginTop: 14 }}>
        <div style={{ flex: "1 1 720px", ...S.card }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 850 }}>Events Directory</div>
              <div style={S.muted}>Calendar + list + filters + CRUD + import/export (demo localStorage)</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant={view === "calendar" ? "primary" : "default"} onClick={() => setDirectoryView("calendar")}>
                Calendar
              </Button>
              <Button variant={view === "list" ? "primary" : "default"} onClick={() => setDirectoryView("list")}>
                List
              </Button>

              <Button onClick={exportDirectory}>Export Directory</Button>

              {canEditDirectory ? (
                <Button variant="primary" onClick={openNewEvent}>
                  + Add Event
                </Button>
              ) : (
                <div style={{ ...S.pill, opacity: 0.9 }}>
                  <strong>Editing:</strong> organiser only
                </div>
              )}
            </div>
          </div>

          <div style={S.divider} />

          {/* Filters */}
          <div style={{ ...S.row, alignItems: "flex-end" }}>
            <Field label="Search">
              <input
                style={{ ...S.input, width: 260 }}
                value={dirFilters.q}
                onChange={(e) => setDirFilters((f) => ({ ...f, q: e.target.value }))}
                placeholder="Name, city, division, tag…"
              />
            </Field>

            <Field label="Status">
              <Select
                value={dirFilters.status}
                onChange={(v) => setDirFilters((f) => ({ ...f, status: v }))}
                options={["all", "upcoming", "past", "cancelled"]}
                style={{ width: 170 }}
              />
            </Field>

            <Field label="Division">
              <Select
                value={dirFilters.division}
                onChange={(v) => setDirFilters((f) => ({ ...f, division: v }))}
                options={divisionsInDirectory}
                style={{ width: 200 }}
              />
            </Field>

            <Field label="Registration">
              <Select
                value={dirFilters.reg}
                onChange={(v) => setDirFilters((f) => ({ ...f, reg: v }))}
                options={["all", "open", "closed"]}
                style={{ width: 160 }}
              />
            </Field>

            <Button
              onClick={() => setDirFilters({ q: "", status: "all", division: "all", reg: "all" })}
              style={{ marginLeft: "auto" }}
            >
              Clear
            </Button>
          </div>

          <div style={S.divider} />

          {view === "calendar" ? (
            <>
              {/* Month controls */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Button
                    onClick={() =>
                      setDirMonth((m) => {
                        const nextMonth = m.monthIndex - 1;
                        if (nextMonth < 0) return { year: m.year - 1, monthIndex: 11 };
                        return { year: m.year, monthIndex: nextMonth };
                      })
                    }
                  >
                    ← Prev
                  </Button>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{monthName}</div>
                  <Button
                    onClick={() =>
                      setDirMonth((m) => {
                        const nextMonth = m.monthIndex + 1;
                        if (nextMonth > 11) return { year: m.year + 1, monthIndex: 0 };
                        return { year: m.year, monthIndex: nextMonth };
                      })
                    }
                  >
                    Next →
                  </Button>
                </div>

                <div style={{ ...S.pill }}>
                  <strong>Selected:</strong> {prettyDate(selectedDate)}
                </div>
              </div>

              <div style={{ height: 10 }} />

              {/* Calendar grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} style={{ ...S.muted, fontWeight: 800, letterSpacing: 0.2, paddingLeft: 6 }}>
                    {d}
                  </div>
                ))}
                {monthGrid.map((cell, idx) => {
                  if (!cell) return <div key={idx} style={{ height: 96, opacity: 0.25 }} />;
                  const iso = yyyyMmDd(cell);
                  const day = cell.getDate();
                  const list = (eventsByDate.get(iso) || []).filter((e) => {
                    // Apply filters to the day list too
                    if (dirFilters.status !== "all" && e.status !== dirFilters.status) return false;
                    if (dirFilters.reg !== "all") {
                      const wantOpen = dirFilters.reg === "open";
                      if (!!e.regOpen !== wantOpen) return false;
                    }
                    if (dirFilters.division !== "all") {
                      if (!(e.divisions || []).includes(dirFilters.division)) return false;
                    }
                    const q = normaliseStr(dirFilters.q);
                    if (q) {
                      const blob = [
                        e.name,
                        e.city,
                        e.venue,
                        (e.divisions || []).join(" "),
                        (e.tags || []).join(" "),
                        e.notes,
                      ]
                        .join(" ")
                        .toLowerCase();
                      if (!blob.includes(q)) return false;
                    }
                    return true;
                  });

                  const isSelected = iso === selectedDate;
                  const hasEvents = list.length > 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(iso)}
                      style={{
                        height: 96,
                        borderRadius: 12,
                        border: isSelected
                          ? "1px solid rgba(70,170,255,0.55)"
                          : "1px solid rgba(255,255,255,0.10)",
                        background: isSelected ? "rgba(70,170,255,0.12)" : "rgba(0,0,0,0.18)",
                        padding: 10,
                        cursor: "pointer",
                        position: "relative",
                        overflow: "hidden",
                      }}
                      title={hasEvents ? `${list.length} event(s)` : "No events"}
                    >
                      <div style={{ fontWeight: 900 }}>{day}</div>
                      {hasEvents ? (
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          {list.slice(0, 2).map((e) => (
                            <div key={e.id} style={{ fontSize: 12, opacity: 0.9, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              • {e.name}
                            </div>
                          ))}
                          {list.length > 2 ? <div style={{ fontSize: 12, opacity: 0.7 }}>+{list.length - 2} more</div> : null}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, opacity: 0.45, marginTop: 6 }}>—</div>
                      )}
                      {hasEvents ? (
                        <div
                          style={{
                            position: "absolute",
                            right: 10,
                            top: 10,
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            background: "rgba(70,170,255,0.8)",
                            boxShadow: "0 0 0 4px rgba(70,170,255,0.12)",
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div style={S.divider} />

              {/* Selected day detail */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>Events on {prettyDate(selectedDate)}</div>
                  <div style={S.muted}>Filtered view (matches the filters above)</div>
                </div>
                <div style={S.muted}>{dayEvents.length} total event(s) on this date (unfiltered)</div>
              </div>

              <div style={{ height: 10 }} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                {(eventsByDate.get(selectedDate) || [])
                  .filter((e) => filteredDirectoryEvents.some((x) => x.id === e.id))
                  .map((e) => (
                    <DirectoryEventCard
                      key={e.id}
                      evt={e}
                      editable={canEditDirectory}
                      onEdit={() => openEditEvent(e)}
                      onDelete={() => {
                        if (window.confirm(`Delete "${e.name}"?`)) {
                          deleteEvent(e.id);
                          showToast("ok", "Event deleted.");
                        }
                      }}
                    />
                  ))}
                {(eventsByDate.get(selectedDate) || []).filter((e) => filteredDirectoryEvents.some((x) => x.id === e.id)).length === 0 ? (
                  <div style={{ ...S.card, opacity: 0.9 }}>
                    <div style={{ fontWeight: 900 }}>No events match your filters on this day.</div>
                    <div style={{ ...S.muted, marginTop: 6 }}>Try clearing filters or switching to List view.</div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              {/* List view */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>Events List</div>
                <div style={S.muted}>{filteredDirectoryEvents.length} event(s) matching filters</div>
              </div>

              <div style={{ height: 10 }} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
                {filteredDirectoryEvents.map((e) => (
                  <DirectoryEventCard
                    key={e.id}
                    evt={e}
                    editable={canEditDirectory}
                    onEdit={() => openEditEvent(e)}
                    onDelete={() => {
                      if (window.confirm(`Delete "${e.name}"?`)) {
                        deleteEvent(e.id);
                        showToast("ok", "Event deleted.");
                      }
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right sidebar — quick help */}
        <div style={{ flex: "0 0 360px", ...S.card, alignSelf: "flex-start" }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Directory Notes</div>
          <div style={{ height: 10 }} />
          <div style={S.muted}>
            This demo stores directory data in <strong>localStorage</strong>.
            <br />
            <br />
            <strong>Organiser</strong> role can add/edit/delete events.
            <br />
            Export directory JSON now, then later you can import it into a backend pipeline.
          </div>

          <div style={S.divider} />

          <div style={{ fontWeight: 900, marginBottom: 6 }}>Quick actions</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={exportDirectory}>Export Directory</Button>
            {canEditDirectory ? (
              <Button variant="primary" onClick={openNewEvent}>
                + Add Event
              </Button>
            ) : (
              <Button onClick={() => setRole("organiser")}>Switch to organiser</Button>
            )}
          </div>

          <div style={S.divider} />

          <div style={{ fontWeight: 900, marginBottom: 6 }}>Tip</div>
          <div style={S.muted}>
            When you connect a real DB later, keep the UI structure the same — just replace the storage layer with API calls.
          </div>
        </div>

        {/* Modal */}
        {eventEditor ? (
          <EventEditorModal
            editor={eventEditor}
            onClose={closeEventEditor}
            onSave={(evt) => {
              // Basic validation
              if (!evt.name.trim()) return showToast("warn", "Event name is required.");
              if (!evt.startDate) return showToast("warn", "Start date is required.");
              if (!evt.endDate) evt.endDate = evt.startDate;
              upsertEvent(evt);
              showToast("ok", eventEditor.mode === "new" ? "Event added." : "Event updated.");
            }}
          />
        ) : null}
      </div>
    );
  };

  function DirectoryEventCard({ evt, editable, onEdit, onDelete }) {
    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, fontSize: 15, lineHeight: 1.2 }}>{evt.name}</div>
            <div style={{ ...S.muted, marginTop: 4 }}>
              {prettyDate(evt.startDate)}
              {evt.endDate && evt.endDate !== evt.startDate ? ` → ${prettyDate(evt.endDate)}` : ""} •{" "}
              {evt.city}
              {evt.venue ? ` • ${evt.venue}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={S.tag}>{evt.status}</span>
            <span style={S.tag}>{evt.regOpen ? "reg open" : "reg closed"}</span>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(evt.divisions || []).slice(0, 6).map((d) => (
            <span key={d} style={S.tag}>
              {d}
            </span>
          ))}
          {(evt.tags || []).slice(0, 6).map((t) => (
            <span key={t} style={{ ...S.tag, opacity: 0.85 }}>
              #{t}
            </span>
          ))}
        </div>

        {evt.notes ? <div style={{ ...S.muted, marginTop: 10 }}>{evt.notes}</div> : null}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {evt.website ? (
              <a href={evt.website} target="_blank" rel="noreferrer" style={{ color: "#bfe3ff", fontSize: 13 }}>
                Website
              </a>
            ) : null}
            {evt.instagram ? (
              <span style={{ ...S.muted, fontSize: 13 }}>
                IG: <strong>{evt.instagram}</strong>
              </span>
            ) : null}
          </div>

          {editable ? (
            <div style={{ display: "flex", gap: 8 }}>
              <SmallButton onClick={onEdit}>Edit</SmallButton>
              <SmallButton onClick={onDelete} style={{ borderColor: "rgba(255,110,110,0.35)" }}>
                Delete
              </SmallButton>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function EventEditorModal({ editor, onClose, onSave }) {
    const [draft, setDraft] = useState(editor.draft);

    const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
    const setArrFromCsv = (k, csv) =>
      set(
        k,
        csv
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      );

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 18,
          zIndex: 999,
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div style={{ ...S.card, width: "min(820px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 18, fontWeight: 950 }}>
              {editor.mode === "new" ? "Add Event" : "Edit Event"}
            </div>
            <div style={S.muted}>Esc: click outside to close</div>
          </div>

          <div style={S.divider} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <Field label="Event name">
              <input style={S.input} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. South Coast Showdown" />
            </Field>

            <Field label="Status">
              <Select value={draft.status} onChange={(v) => set("status", v)} options={["upcoming", "past", "cancelled"]} />
            </Field>

            <Field label="Start date">
              <input style={S.input} type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </Field>

            <Field label="End date">
              <input style={S.input} type="date" value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </Field>

            <Field label="City">
              <input style={S.input} value={draft.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Leeds" />
            </Field>

            <Field label="Venue">
              <input style={S.input} value={draft.venue} onChange={(e) => set("venue", e.target.value)} placeholder="e.g. Sports Hall" />
            </Field>

            <Field label="Divisions (comma separated)">
              <input
                style={S.input}
                value={(draft.divisions || []).join(", ")}
                onChange={(e) => setArrFromCsv("divisions", e.target.value)}
                placeholder="RX, Scaled, Masters 35+"
              />
            </Field>

            <Field label="Tags (comma separated)">
              <input
                style={S.input}
                value={(draft.tags || []).join(", ")}
                onChange={(e) => setArrFromCsv("tags", e.target.value)}
                placeholder="pairs, outdoor, two-day"
              />
            </Field>

            <Field label="Website">
              <input style={S.input} value={draft.website} onChange={(e) => set("website", e.target.value)} placeholder="https://..." />
            </Field>

            <Field label="Instagram">
              <input style={S.input} value={draft.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@handle" />
            </Field>

            <div style={{ gridColumn: "1 / -1" }}>
              <Toggle checked={!!draft.regOpen} onChange={(v) => set("regOpen", v)} label="Registration open" hint="Used for filtering badges only (demo)." />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Notes">
                <textarea
                  style={{ ...S.input, minHeight: 90, resize: "vertical" }}
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Anything helpful for the listing…"
                />
              </Field>
            </div>
          </div>

          <div style={S.divider} />

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => onSave(draft)}>
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ================================
     COMPETITION UI
  ================================ */
  const CompetitionPanel = () => {
    const c = currentComp;
    if (!c) return <div style={{ ...S.card, marginTop: 14 }}>No competition selected.</div>;

    const privilegedCanSeeProvisional =
      !data.settings.finalOnlyLeaderboard ||
      (data.settings.allowProvisionalViewForJudges && (isJudge || isHeadJudge || isOrganiser));

    const showLeaderboard = !data.settings.hideLeaderboard;

    return (
      <div style={{ ...S.row, marginTop: 14 }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>{c.name}</div>
              <div style={S.muted}>
                {prettyDate(c.date)} • {c.location} • {c.description}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Field label="Competition">
                <Select
                  value={data.ui.compId}
                  onChange={(v) => setCompId(v)}
                  options={data.competitions.map((x) => x.id)}
                  style={{ width: 240 }}
                />
              </Field>

              <div style={S.pill}>
                <strong>View</strong>
                <Select
                  value={compView}
                  onChange={(v) => setCompViewSafe(v)}
                  options={["overview", "register", "scoring", "review", "leaderboard", "audit"]}
                  style={{ padding: "6px 8px", borderRadius: 999 }}
                />
              </div>
            </div>
          </div>

          <div style={S.divider} />

          {/* Overview */}
          {compView === "overview" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              <div style={S.card}>
                <div style={{ fontWeight: 950 }}>Workouts</div>
                <div style={{ height: 8 }} />
                {(c.workouts || []).map((w) => (
                  <div key={w.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0" }}>
                    <div style={{ fontWeight: 750 }}>{w.name}</div>
                    <div style={S.muted}>
                      {w.scoring} ({w.sort})
                    </div>
                  </div>
                ))}
              </div>

              <div style={S.card}>
                <div style={{ fontWeight: 950 }}>Participants ({data.mode})</div>
                <div style={{ height: 8 }} />
                <div style={S.muted}>
                  Switching mode changes who appears in registrations, scoring and leaderboard.
                </div>
                <div style={{ height: 10 }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {participants.slice(0, 10).map((p) => (
                    <span key={p} style={S.tag}>
                      {p}
                    </span>
                  ))}
                  {participants.length > 10 ? <span style={S.tag}>+{participants.length - 10}</span> : null}
                </div>
              </div>

              <div style={S.card}>
                <div style={{ fontWeight: 950 }}>Workflow status</div>
                <div style={{ height: 8 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={S.pill}>
                    <strong>Registration</strong> {data.settings.regClosed ? "Closed" : "Open"}
                  </div>
                  <div style={S.pill}>
                    <strong>Approval</strong> {data.settings.requireApproval ? "Required" : "Not required"}
                  </div>
                  <div style={S.pill}>
                    <strong>Leaderboard</strong>{" "}
                    {data.settings.hideLeaderboard ? "Hidden" : data.settings.finalOnlyLeaderboard ? "Final-only" : "Provisional"}
                  </div>
                  {!privilegedCanSeeProvisional && data.settings.finalOnlyLeaderboard ? (
                    <div style={{ ...S.muted }}>
                      Final-only is enabled — spectators/athletes/team managers will not see pending scores.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* Register */}
          {compView === "register" ? (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 16, fontWeight: 950 }}>Registrations ({data.mode})</div>
                <div style={S.muted}>
                  {data.settings.regClosed ? "Registration is closed by settings toggle." : "Registration is open."}
                </div>
              </div>

              <div style={{ height: 10 }} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
                {participants.map((p) => {
                  const reg = isRegistered(p);
                  const meta = participantMeta.get(p) || {};
                  return (
                    <div key={p} style={{ ...S.card, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 950 }}>{p}</div>
                          <div style={S.muted}>
                            Division: <strong>{meta.division || "—"}</strong>
                            {meta.type === "team" && meta.members?.length ? ` • Members: ${meta.members.join(", ")}` : ""}
                          </div>
                        </div>
                        <span style={S.tag}>{reg ? "registered" : "not registered"}</span>
                      </div>

                      <div style={{ height: 10 }} />

                      {(isAthlete || isTeamManager || isOrganiser) ? (
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {!reg ? (
                            <Button variant="primary" onClick={() => registerParticipant(p)} disabled={data.settings.regClosed}>
                              Register
                            </Button>
                          ) : (
                            <Button onClick={() => unregisterParticipant(p)} disabled={data.settings.regClosed}>
                              Remove
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div style={S.muted}>Only athlete/team manager/organiser can change registrations in this demo.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Scoring */}
          {compView === "scoring" ? (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 16, fontWeight: 950 }}>Scoring</div>
                <div style={S.muted}>
                  Judges/organiser can submit scores. If approval required, scores enter the head judge queue.
                </div>
              </div>

              <div style={{ height: 10 }} />

              <div style={{ ...S.card, padding: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                  <Field label="Workout">
                    <Select
                      value={scoreDraft.workoutId}
                      onChange={(v) => setScoreDraft((s) => ({ ...s, workoutId: v }))}
                      options={(c.workouts || []).map((w) => w.id)}
                    />
                  </Field>

                  <Field label={`Participant (${data.mode})`}>
                    <Select
                      value={scoreDraft.participant}
                      onChange={(v) => setScoreDraft((s) => ({ ...s, participant: v }))}
                      options={participants.length ? participants : ["—"]}
                    />
                  </Field>

                  <Field label="Judge name (demo identity)">
                    <Select
                      value={scoreDraft.judgeName}
                      onChange={(v) => setScoreDraft((s) => ({ ...s, judgeName: v }))}
                      options={(c.judgePool || []).length ? c.judgePool : ["Judge"]}
                    />
                  </Field>

                  <Field label="Score (number)">
                    <input
                      style={S.input}
                      value={scoreDraft.value}
                      onChange={(e) => setScoreDraft((s) => ({ ...s, value: e.target.value }))}
                      placeholder="e.g. 245"
                    />
                  </Field>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Note (optional)">
                      <input
                        style={S.input}
                        value={scoreDraft.note}
                        onChange={(e) => setScoreDraft((s) => ({ ...s, note: e.target.value }))}
                        placeholder="e.g. No-rep count, equipment issue…"
                      />
                    </Field>
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div style={S.muted}>
                    Assigned judge for this lane:{" "}
                    <strong>{assignedJudgeFor(scoreDraft.workoutId, scoreDraft.participant) || "—"}</strong>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button
                      variant="primary"
                      onClick={() => submitScore(scoreDraft.workoutId, scoreDraft.participant, scoreDraft.value, scoreDraft.judgeName, scoreDraft.note)}
                      disabled={!canScore || !scoreDraft.workoutId || !scoreDraft.participant}
                      title={!canScore ? "Switch role to judge or organiser" : ""}
                    >
                      Submit score
                    </Button>

                    <Button
                      onClick={() =>
                        setScoreDraft((s) => ({ ...s, value: String(Math.floor(Math.random() * 300) + 1) }))
                      }
                      disabled={!canScore}
                    >
                      Random demo score
                    </Button>
                  </div>
                </div>

                {!canScore ? (
                  <div style={{ ...S.muted, marginTop: 10 }}>
                    You’re currently <strong>{role}</strong>. Switch to <strong>judge</strong> or <strong>organiser</strong> to submit.
                  </div>
                ) : null}
              </div>

              <div style={S.divider} />

              {/* Scoreboard snapshot */}
              <div style={{ fontSize: 14, fontWeight: 950, marginBottom: 8 }}>Scores snapshot</div>
              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Participant</th>
                      {(c.workouts || []).map((w) => (
                        <th key={w.id} style={S.th}>
                          {w.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p) => (
                      <tr key={p}>
                        <td style={S.td}>
                          <div style={{ fontWeight: 900 }}>{p}</div>
                          <div style={S.muted}>{participantMeta.get(p)?.division || ""}</div>
                        </td>
                        {(c.workouts || []).map((w) => {
                          const s = c.scores?.[w.id]?.[p];
                          const badge =
                            s?.status === "approved"
                              ? "approved"
                              : s?.status === "pending"
                              ? "pending"
                              : s?.status === "needs_change"
                              ? "needs change"
                              : "—";
                          return (
                            <td key={w.id} style={S.td}>
                              {s ? (
                                <>
                                  <div style={{ fontWeight: 900 }}>
                                    {s.value} {w.unit}
                                  </div>
                                  <div style={S.muted}>
                                    {badge} • {s.judge}
                                  </div>
                                  {s.note ? <div style={{ ...S.muted, marginTop: 4 }}>“{s.note}”</div> : null}
                                </>
                              ) : (
                                <div style={{ opacity: 0.5 }}>—</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Review */}
          {compView === "review" ? (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 16, fontWeight: 950 }}>Head Judge Review Queue</div>
                <div style={S.muted}>
                  {data.settings.requireApproval ? "Approval required is ON." : "Approval required is OFF (queue may be empty)."}
                </div>
              </div>

              <div style={{ height: 10 }} />

              {!canReview ? (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 950 }}>You can’t review in this role.</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>
                    Switch to <strong>head_judge</strong> or <strong>organiser</strong> to approve/request change/override.
                  </div>
                </div>
              ) : null}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
                {(c.reviewQueue || []).map((item) => (
                  <ReviewCard
                    key={item.id}
                    item={item}
                    workout={c.workouts.find((w) => w.id === item.workoutId)}
                    onApprove={() => approveQueueItem(item.id)}
                    onRequestChange={(msg) => requestChangeQueueItem(item.id, msg)}
                    onOverride={(v, note) => overrideQueueItem(item.id, v, note)}
                    disabled={!canReview}
                  />
                ))}
              </div>

              {(c.reviewQueue || []).length === 0 ? (
                <div style={{ ...S.card, marginTop: 12 }}>
                  <div style={{ fontWeight: 950 }}>Queue is empty.</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>
                    Submit a score while “Require head judge approval” is ON to populate this list.
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Leaderboard */}
          {compView === "leaderboard" ? (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 16, fontWeight: 950 }}>Leaderboard</div>
                <div style={S.muted}>
                  {data.settings.hideLeaderboard ? "Leaderboard hidden by settings." : data.settings.finalOnlyLeaderboard ? "Final-only view enabled." : "Provisional view enabled."}
                </div>
              </div>

              <div style={{ height: 10 }} />

              {!showLeaderboard ? (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 950 }}>Leaderboard is hidden.</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>
                    Toggle “Hide leaderboards” off in Settings / Admin to show it.
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Rank</th>
                        <th style={S.th}>Name</th>
                        <th style={S.th}>Division</th>
                        <th style={S.th}>Total</th>
                        {(c.workouts || []).map((w) => (
                          <th key={w.id} style={S.th}>
                            {w.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((row, i) => (
                        <tr key={row.name}>
                          <td style={S.td}>
                            <div style={{ fontWeight: 950 }}>{i + 1}</div>
                          </td>
                          <td style={S.td}>
                            <div style={{ fontWeight: 950 }}>{row.name}</div>
                            {!isRegistered(row.name) ? <div style={S.muted}>Not registered (still scored)</div> : null}
                          </td>
                          <td style={S.td}>{row.division || "—"}</td>
                          <td style={S.td}>
                            <div style={{ fontWeight: 950 }}>{row.total}</div>
                            <div style={S.muted}>
                              {data.settings.finalOnlyLeaderboard && !privilegedCanSeeProvisional
                                ? "Final-only"
                                : data.settings.requireApproval
                                ? "Approved + (optional pending)"
                                : "All scores"}
                            </div>
                          </td>
                          {(c.workouts || []).map((w) => {
                            const d = row.breakdown[w.id];
                            return (
                              <td key={w.id} style={S.td}>
                                {d ? (
                                  <>
                                    <div style={{ fontWeight: 900 }}>
                                      {d.value} {d.unit}
                                    </div>
                                    <div style={S.muted}>{d.status}</div>
                                  </>
                                ) : (
                                  <div style={{ opacity: 0.5 }}>—</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {leaderboard.length === 0 ? (
                    <div style={{ ...S.card, marginTop: 12 }}>
                      <div style={{ fontWeight: 950 }}>No leaderboard entries yet.</div>
                      <div style={{ ...S.muted, marginTop: 6 }}>
                        Submit some scores in the Scoring tab.
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {/* Audit */}
          {compView === "audit" ? (
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 16, fontWeight: 950 }}>Audit Log</div>
                <div style={S.muted}>Tracks demo actions (register/score/review) in this competition.</div>
              </div>

              <div style={{ height: 10 }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(c.audit || []).map((a) => (
                  <div key={a.id} style={{ ...S.card, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 950 }}>{a.message}</div>
                      <div style={S.muted}>
                        {new Date(a.at).toLocaleString("en-GB")} • {a.whoRole}
                        {a.whoName ? ` (${a.whoName})` : ""}
                      </div>
                    </div>
                  </div>
                ))}
                {(c.audit || []).length === 0 ? (
                  <div style={{ ...S.card, padding: 12 }}>
                    <div style={{ fontWeight: 950 }}>No audit entries yet.</div>
                    <div style={{ ...S.muted, marginTop: 6 }}>Register someone or submit a score to create entries.</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Competition sidebar */}
        <div style={{ flex: "0 0 360px", ...S.card, alignSelf: "flex-start" }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Competition Controls</div>

          <div style={S.divider} />

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Toggle
              checked={data.settings.regClosed}
              onChange={() => toggleSetting("regClosed")}
              label="Close registration"
              hint="Blocks register/unregister in the demo UI."
            />
            <Toggle
              checked={data.settings.requireApproval}
              onChange={() => toggleSetting("requireApproval")}
              label="Require head judge approval"
              hint="Score submissions go into review queue when ON."
            />
            <Toggle
              checked={data.settings.finalOnlyLeaderboard}
              onChange={() => toggleSetting("finalOnlyLeaderboard")}
              label="Final-only leaderboard"
              hint="Non-privileged users won’t see pending scores."
            />
            <Toggle
              checked={data.settings.hideLeaderboard}
              onChange={() => toggleSetting("hideLeaderboard")}
              label="Hide leaderboards"
              hint="Removes leaderboard view entirely."
            />
          </div>

          <div style={S.divider} />

          <div style={{ fontWeight: 950, marginBottom: 8 }}>Judge assignments (demo)</div>
          <div style={S.muted}>
            Assignments are pre-seeded per workout. In a real build, you’d attach this to users + lanes.
          </div>

          <div style={{ height: 10 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(c.workouts || []).map((w) => (
              <div key={w.id} style={{ ...S.card, padding: 10 }}>
                <div style={{ fontWeight: 900 }}>{w.name}</div>
                <div style={{ height: 8 }} />
                {Object.entries(c.judgeAssignments?.[w.id] || {}).map(([j, list]) => (
                  <div key={j} style={{ ...S.muted, marginBottom: 6 }}>
                    <strong>{j}:</strong> {(list || []).join(", ")}
                  </div>
                ))}
                {Object.keys(c.judgeAssignments?.[w.id] || {}).length === 0 ? (
                  <div style={S.muted}>No assignments.</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  function ReviewCard({ item, workout, onApprove, onRequestChange, onOverride, disabled }) {
    const [changeMsg, setChangeMsg] = useState("");
    const [overrideVal, setOverrideVal] = useState(String(item.value));
    const [overrideNote, setOverrideNote] = useState("");

    return (
      <div style={{ ...S.card, padding: 12, opacity: disabled ? 0.75 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950 }}>{item.participant}</div>
            <div style={S.muted}>
              {workout ? workout.name : item.workoutId} • Submitted by <strong>{item.judge}</strong>
            </div>
          </div>
          <span style={S.tag}>pending</span>
        </div>

        <div style={{ height: 10 }} />

        <div style={{ fontWeight: 900 }}>
          Proposed score: {item.value} {workout?.unit || ""}
        </div>
        {item.note ? <div style={{ ...S.muted, marginTop: 6 }}>Note: “{item.note}”</div> : null}

        <div style={S.divider} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="primary" onClick={onApprove} disabled={disabled}>
            Approve
          </Button>
        </div>

        <div style={{ height: 10 }} />

        <div style={{ ...S.muted, fontWeight: 800, letterSpacing: 0.2 }}>Request change</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input
            style={{ ...S.input, flex: 1 }}
            value={changeMsg}
            onChange={(e) => setChangeMsg(e.target.value)}
            placeholder="e.g. verify reps / check time standard…"
            disabled={disabled}
          />
          <SmallButton onClick={() => onRequestChange(changeMsg)} disabled={disabled}>
            Send
          </SmallButton>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ ...S.muted, fontWeight: 800, letterSpacing: 0.2 }}>Override</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <input
            style={{ ...S.input, width: 140 }}
            value={overrideVal}
            onChange={(e) => setOverrideVal(e.target.value)}
            placeholder="New value"
            disabled={disabled}
          />
          <input
            style={{ ...S.input, flex: 1 }}
            value={overrideNote}
            onChange={(e) => setOverrideNote(e.target.value)}
            placeholder="Override note (optional)"
            disabled={disabled}
          />
          <SmallButton onClick={() => onOverride(overrideVal, overrideNote)} disabled={disabled}>
            Apply
          </SmallButton>
        </div>
      </div>
    );
  }

  /* ================================
     ADMIN UI
  ================================ */
  const AdminPanel = () => {
    return (
      <div style={{ ...S.row, marginTop: 14 }}>
        <div style={{ flex: "1 1 680px", ...S.card }}>
          <div style={{ fontSize: 18, fontWeight: 950 }}>Settings / Admin</div>
          <div style={S.muted}>Feature toggles + quick notes for turning this into a real product.</div>

          <div style={S.divider} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            <div style={S.card}>
              <div style={{ fontWeight: 950 }}>Role & permissions (demo rules)</div>
              <div style={{ height: 8 }} />
              <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.9 }}>
                <li><strong>organiser</strong>: edit directory, submit scores, review/override, export/import</li>
                <li><strong>head_judge</strong>: review/override scores</li>
                <li><strong>judge</strong>: submit scores (assigned lanes enforced by judge name)</li>
                <li><strong>athlete</strong>/<strong>team_manager</strong>: register/unregister</li>
                <li><strong>spectator</strong>: read-only</li>
              </ul>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 950 }}>Feature toggles</div>
              <div style={{ height: 10 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Toggle checked={data.settings.hideLeaderboard} onChange={() => toggleSetting("hideLeaderboard")} label="Hide leaderboards" />
                <Toggle checked={data.settings.regClosed} onChange={() => toggleSetting("regClosed")} label="Close registration" />
                <Toggle checked={data.settings.requireApproval} onChange={() => toggleSetting("requireApproval")} label="Require head judge approval" />
                <Toggle checked={data.settings.finalOnlyLeaderboard} onChange={() => toggleSetting("finalOnlyLeaderboard")} label="Final-only leaderboard" />
                <Toggle
                  checked={data.settings.allowProvisionalViewForJudges}
                  onChange={() => toggleSetting("allowProvisionalViewForJudges")}
                  label="Allow provisional view for judges"
                  hint="If final-only is ON, judges/head judges/organisers can still see pending."
                />
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 950 }}>Import/Export expectations</div>
              <div style={{ height: 8 }} />
              <div style={S.muted}>
                Import accepts either:
                <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                  <li><strong>Full app JSON</strong> (contains <code>directory</code> and <code>competitions</code>)</li>
                  <li><strong>Directory JSON</strong> with <code>{`{ events: [...] }`}</code> or <code>{`{ directory: { events: [...] } }`}</code></li>
                </ul>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 950 }}>Next steps to go “real”</div>
              <div style={{ height: 8 }} />
              <div style={S.muted}>
                Replace localStorage with API calls:
                <ol style={{ marginTop: 8, paddingLeft: 18 }}>
                  <li>Move <code>DEFAULT_DATA</code> seeding into your backend</li>
                  <li>Create endpoints: directory events CRUD, comp scoring, approvals</li>
                  <li>Attach judge assignments to authenticated users</li>
                  <li>Persist audit log server-side for compliance</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: "0 0 360px", ...S.card, alignSelf: "flex-start" }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Build‑safe by design</div>
          <div style={{ height: 10 }} />
          <div style={S.muted}>
            This file intentionally avoids:
            <ul style={{ marginTop: 8, paddingLeft: 18 }}>
              <li><code>@/</code> path aliases</li>
              <li>shadcn UI imports</li>
              <li>router configuration</li>
              <li>non-ASCII corrupted strings</li>
            </ul>
            So it should run cleanly under a default Vite React setup.
          </div>

          <div style={S.divider} />

          <Button variant="primary" onClick={() => setTab("directory")} style={{ width: "100%" }}>
            Go to Directory
          </Button>
          <div style={{ height: 10 }} />
          <Button variant="primary" onClick={() => setTab("competition")} style={{ width: "100%" }}>
            Go to Competition
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        <Header />
        <Tabs />

        {tab === "directory" ? <DirectoryPanel /> : null}
        {tab === "competition" ? <CompetitionPanel /> : null}
        {tab === "admin" ? <AdminPanel /> : null}
      </div>
      <Toast />
    </div>
  );
}