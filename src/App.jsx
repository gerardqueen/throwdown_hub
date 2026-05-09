import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Throwdown Hub — Single-file Demo App.jsx (Role-based UX + Points Leaderboard)
 *
 * Key features:
 * - Workout scaling per division (overrides for description/standards/equipment/unit/cap/sort)
 * - Athletes/Teams submit online scores (raw values)
 * - Judges review submissions and propose adjusted values
 * - Head Judge confirms adjustments into FINAL scores
 * - Organiser controls: workouts, scaling, live windows, leaderboard visibility, submissions
 * - Leaderboards are points-based (per workout ranking -> points) to aggregate mixed score types
 * - Build-safe: no external UI libs, no alias imports, clean syntax, Vite/React friendly.
 */

/* ================================
   LOCAL STORAGE
================================ */
const LS_KEY = "tdh_single_file_demo_v6_points";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function loadData() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LS_KEY);
  return raw ? safeParse(raw, null) : null;
}

function saveData(data) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(data));
}

/* ================================
   UTIL
================================ */
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function yyyyMmDd(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prettyDate(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function normaliseStr(s) {
  return String(s ?? "").trim().toLowerCase();
}

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function defaultWindow(hoursFromNowOpen, hoursDuration) {
  const now = new Date();
  const open = new Date(now.getTime() + hoursFromNowOpen * 3600 * 1000);
  const close = new Date(open.getTime() + hoursDuration * 3600 * 1000);
  return { openAt: open.toISOString(), closeAt: close.toISOString() };
}

function parseTimeToSeconds(v) {
  // Accept:
  // - number (seconds)
  // - "mm:ss"
  // - "hh:mm:ss"
  // - "ss" (as string)
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;

  // numeric string
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);

  // time formats
  const parts = s.split(":").map((x) => x.trim());
  if (parts.length === 2 || parts.length === 3) {
    const nums = parts.map((p) => (p === "" ? NaN : Number(p)));
    if (nums.some((n) => !Number.isFinite(n))) return null;
    if (parts.length === 2) {
      const [mm, ss] = nums;
      return mm * 60 + ss;
    }
    const [hh, mm, ss] = nums;
    return hh * 3600 + mm * 60 + ss;
  }

  return null;
}

/* ================================
   ROLES
================================ */
const ROLES = ["spectator", "athlete", "team_manager", "judge", "head_judge", "organiser"];

/* ================================
   DEFAULT DEMO DATA
================================ */
const DEFAULT_DATA = (() => {
  const compId = "comp_london";
  const comp = {
    id: compId,
    name: "London Throwdown (Online Qualifier Demo)",
    date: "2026-06-20",
    location: "London",
    description:
      "Role demo: athletes submit online scores, judges adjust, head judge confirms. Points leaderboard aggregates across workouts.",
    divisions: ["RX", "Scaled", "Intermediate", "Masters 35+"],
    judgePool: ["Judge Alex", "Judge Sam", "Judge Priya"],
    headJudgePool: ["Head Judge Casey"],
    workouts: [
      {
        id: "w1",
        name: "WOD 1 — Engine",
        divisionNotes: "All divisions",
        scoreType: "time", // time, reps, load, distance, calories
        sort: "asc",
        unit: "time (mm:ss)",
        cap: "12:00",
        tiebreak: "Optional: split time after round 3",
        equipment: ["Row erg", "Wall ball", "Pull-up bar"],
        standards: ["Video must show full ROM", "Wall ball to target", "Chin over bar"],
        description:
          "For time: 30/24 cal row, 50 wall balls, 30 pull-ups. Time stops when last pull-up is complete.",
        media: { demoVideoUrl: "", scorecardUrl: "" },
        liveWindow: defaultWindow(-2, 72),
        scalingByDivision: {
          Scaled: {
            equipment: ["Row erg", "Wall ball", "Pull-up bar / band"],
            standards: ["Jumping pull-ups allowed", "Wall ball lighter"],
            description:
              "For time: 24/18 cal row, 50 wall balls, 30 jumping pull-ups. Time stops when last rep is complete.",
          },
          "Masters 35+": {
            standards: ["Chest-to-bar not required unless stated", "Movement standards apply"],
          },
        },
      },
      {
        id: "w2",
        name: "WOD 2 — Strength",
        divisionNotes: "All divisions",
        scoreType: "load",
        sort: "desc",
        unit: "kg",
        cap: "10:00",
        tiebreak: "Heaviest successful lift wins",
        equipment: ["Barbell", "Plates", "Clips"],
        standards: ["Full lockout required", "Video shows plates clearly"],
        description: "Find a 1RM clean & jerk in 10 minutes.",
        media: { demoVideoUrl: "", scorecardUrl: "" },
        liveWindow: defaultWindow(-2, 72),
        scalingByDivision: {
          Scaled: {
            description: "Find a heavy clean & jerk (not necessarily 1RM) in 10 minutes.",
          },
        },
      },
      {
        id: "w3",
        name: "WOD 3 — Sprint AMRAP",
        divisionNotes: "All divisions",
        scoreType: "reps",
        sort: "desc",
        unit: "reps",
        cap: "8:00",
        tiebreak: "Extra reps after cap not allowed",
        equipment: ["Kettlebell", "Box", "Skipping rope"],
        standards: ["Box jump full extension", "KB to eye level (American)"],
        description:
          "8-min AMRAP: 30 double-unders, 12 box jumps, 9 American KB swings. Score = total reps.",
        media: { demoVideoUrl: "", scorecardUrl: "" },
        liveWindow: defaultWindow(-2, 72),
        scalingByDivision: {
          Scaled: {
            description:
              "8-min AMRAP: 60 single-unders, 12 step-ups, 9 Russian KB swings. Score = total reps.",
            standards: ["Step-ups allowed", "KB swing to shoulder height (Russian)"],
          },
          Intermediate: {
            standards: ["Double-unders required", "KB American swings"],
          },
        },
      },
    ],
    athletes: [
      { name: "Ava Johnson", division: "RX" },
      { name: "Liam Patel", division: "RX" },
      { name: "Noah Smith", division: "Intermediate" },
      { name: "Mia Brown", division: "Scaled" },
      { name: "Olivia Green", division: "Masters 35+" },
      { name: "Ethan Taylor", division: "Intermediate" },
    ],
    teams: [
      { name: "Team Docklands", division: "RX", members: ["Ava Johnson", "Liam Patel"] },
      { name: "Team Fife Fire", division: "Intermediate", members: ["Noah Smith", "Ethan Taylor"] },
      { name: "Team Scaled Squad", division: "Scaled", members: ["Mia Brown", "Olivia Green"] },
    ],
    submissions: {
      // workoutId -> participantName -> submission
      w1: {
        "Ava Johnson": {
          value: "08:44",
          videoUrl: "",
          notes: "All reps shown",
          submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
          status: "submitted",
          division: "RX",
          judgeNote: "",
        },
        "Liam Patel": {
          value: "09:02",
          videoUrl: "",
          notes: "",
          submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
          status: "submitted",
          division: "RX",
          judgeNote: "",
        },
        "Mia Brown": {
          value: "10:35",
          videoUrl: "",
          notes: "Scaled",
          submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
          status: "submitted",
          division: "Scaled",
          judgeNote: "",
        },
      },
      w2: {
        "Ava Johnson": {
          value: "92.5",
          videoUrl: "",
          notes: "",
          submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
          status: "submitted",
          division: "RX",
          judgeNote: "",
        },
        "Noah Smith": {
          value: "110",
          videoUrl: "",
          notes: "Felt heavy",
          submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          status: "submitted",
          division: "Intermediate",
          judgeNote: "",
        },
      },
      w3: {},
    },
    adjustments: [
      // example pending adjustment (head judge will approve/reject)
      {
        id: "adj_seed_1",
        workoutId: "w1",
        participant: "Liam Patel",
        adjustedValue: "09:12",
        note: "No-rep on 5 pull-ups (reps redone). Added time.",
        judgeName: "Judge Alex",
        judgeRole: "judge",
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        status: "awaiting_head_judge",
        decidedAt: "",
        headJudgeName: "",
        rejectReason: "",
      },
    ],
    finalScores: {
      // workoutId -> participant -> final
      // w1: { "Ava Johnson": { value: "08:44", finalAt: "...", source: "submission", decidedBy: "system", note: "" } }
    },
    audit: [],
  };

  return {
    meta: { version: 6, createdAt: new Date().toISOString() },
    role: "spectator",
    mode: "athlete", // athlete | team
    ui: { tab: "competition", compId },
    settings: {
      hideLeaderboard: false,
      submissionsClosed: false,
      finalOnlyLeaderboard: false,
      allowProvisionalForStaff: true,
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
          divisions: ["RX", "Scaled", "Intermediate", "Masters 35+"],
          tags: ["throwdown", "two-day"],
          status: "upcoming",
          regOpen: true,
          website: "",
          instagram: "@throwdownhub",
          notes: "Demo event — replace with real data later.",
        },
      ],
    },
    competitions: [comp],
  };
})();

/* ================================
   STYLES
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
  headerRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  title: { fontSize: 22, fontWeight: 900, letterSpacing: 0.2 },
  subTitle: { fontSize: 12, opacity: 0.8, marginTop: 2, lineHeight: 1.35 },
  card: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
  },
  row: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },
  col: { display: "flex", flexDirection: "column", gap: 10 },
  btn: {
    cursor: "pointer",
    userSelect: "none",
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.07)",
    color: "#e7eefc",
    fontWeight: 750,
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
    fontWeight: 850,
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
    fontWeight: 850,
    fontSize: 13,
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
  label: { fontSize: 12, opacity: 0.85, fontWeight: 800, marginBottom: 6 },
  muted: { opacity: 0.78, fontSize: 12, lineHeight: 1.35 },
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
  tag: {
    display: "inline-flex",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    opacity: 0.95,
  },
  divider: { height: 1, background: "rgba(255,255,255,0.12)", margin: "10px 0" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  th: {
    textAlign: "left",
    fontSize: 12,
    opacity: 0.8,
    padding: "8px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
  },
  td: { padding: "10px", borderBottom: "1px solid rgba(255,255,255,0.08)", verticalAlign: "top", fontSize: 13 },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: 14,
  },
  modal: {
    width: "min(980px, 96vw)",
    maxHeight: "90vh",
    overflow: "auto",
    borderRadius: 14,
    background: "rgba(14,18,28,0.98)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 16px 60px rgba(0,0,0,0.55)",
    padding: 14,
  },
};

function Button({ variant = "default", style, ...props }) {
  const base = variant === "primary" ? S.btnPrimary : variant === "danger" ? S.btnDanger : S.btn;
  return <button style={{ ...base, ...style }} {...props} />;
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
        <option key={String(o.value ?? o)} value={String(o.value ?? o)} style={{ background: "#0b0f17" }}>
          {String(o.label ?? o)}
        </option>
      ))}
    </select>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: 13 }}>{label}</div>
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
        type="button"
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
  const [toast, setToast] = useState(null);

  useEffect(() => saveData(data), [data]);

  const role = data.role;
  const mode = data.mode;
  const isStaff = role === "judge" || role === "head_judge" || role === "organiser";
  const isOrganiser = role === "organiser";
  const isJudge = role === "judge";
  const isHeadJudge = role === "head_judge";
  const isAthleteSide = role === "athlete" || role === "team_manager";
  const now = Date.now();

  const currentComp = useMemo(() => {
    const found = data.competitions.find((c) => c.id === data.ui.compId);
    return found || data.competitions[0];
  }, [data.competitions, data.ui.compId]);

  function showToast(type, msg) {
    setToast({ type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }

  function addAudit(message) {
    updateComp(currentComp.id, (c) => {
      c.audit = c.audit || [];
      c.audit.unshift({
        id: uid("audit"),
        at: new Date().toISOString(),
        whoRole: role,
        message,
      });
      return c;
    });
  }

  function resetDemo() {
    window.localStorage.removeItem(LS_KEY);
    setData(DEFAULT_DATA);
  }

  function setRole(r) {
    setData((d) => ({ ...d, role: r }));
  }

  function toggleMode() {
    setData((d) => ({ ...d, mode: d.mode === "athlete" ? "team" : "athlete" }));
  }

  function setTab(tab) {
    setData((d) => ({ ...d, ui: { ...d.ui, tab } }));
  }

  function setCompId(compId) {
    setData((d) => ({ ...d, ui: { ...d.ui, compId } }));
  }

  function toggleSetting(key) {
    setData((d) => ({ ...d, settings: { ...d.settings, [key]: !d.settings[key] } }));
  }

  function updateComp(compId, updater) {
    setData((d) => {
      const comps = d.competitions.slice();
      const idx = comps.findIndex((c) => c.id === compId);
      if (idx < 0) return d;
      const draft = JSON.parse(JSON.stringify(comps[idx]));
      const next = updater(draft) || draft;
      comps[idx] = next;
      return { ...d, competitions: comps };
    });
  }

  /* ----------------
     Import / Export
  ---------------- */
  const fileInputRef = useRef(null);

  function exportAll() {
    downloadJson(`tdh_demo_all_${yyyyMmDd(new Date())}.json`, data);
  }

  async function importJson(file) {
    const text = await file.text();
    const obj = safeParse(text, null);
    if (!obj) return { ok: false, error: "Invalid JSON." };
    if (!obj.competitions || !Array.isArray(obj.competitions)) return { ok: false, error: "Missing competitions array." };
    setData(obj);
    return { ok: true };
  }

  /* ----------------
     Participants
  ---------------- */
  const participantList = useMemo(() => {
    if (!currentComp) return [];
    if (mode === "athlete") return (currentComp.athletes || []).map((a) => a.name);
    return (currentComp.teams || []).map((t) => t.name);
  }, [currentComp, mode]);

  const participantMeta = useMemo(() => {
    const map = new Map();
    if (!currentComp) return map;
    (currentComp.athletes || []).forEach((a) => map.set(a.name, { type: "athlete", division: a.division }));
    (currentComp.teams || []).forEach((t) => map.set(t.name, { type: "team", division: t.division, members: t.members || [] }));
    return map;
  }, [currentComp]);

  const compDivisions = useMemo(() => {
    const c = currentComp;
    if (!c) return [];
    const set = new Set();
    (c.divisions || []).forEach((d) => set.add(d));
    for (const [, meta] of participantMeta.entries()) {
      if (meta.division) set.add(meta.division);
    }
    return Array.from(set);
  }, [currentComp, participantMeta]);

  function workoutForDivision(workout, division) {
    const scaled = workout?.scalingByDivision?.[division];
    if (!scaled) return workout;
    return {
      ...workout,
      ...scaled,
      equipment: Array.isArray(scaled.equipment) ? scaled.equipment : workout.equipment,
      standards: Array.isArray(scaled.standards) ? scaled.standards : workout.standards,
      unit: scaled.unit || workout.unit,
      cap: scaled.cap || workout.cap,
      sort: scaled.sort || workout.sort,
      scoreType: scaled.scoreType || workout.scoreType,
      tiebreak: scaled.tiebreak || workout.tiebreak,
    };
  }

  /* ----------------
     Live windows
  ---------------- */
  function workoutIsLive(wBase) {
    const open = wBase.liveWindow?.openAt ? new Date(wBase.liveWindow.openAt).getTime() : null;
    const close = wBase.liveWindow?.closeAt ? new Date(wBase.liveWindow.closeAt).getTime() : null;
    if (open && now < open) return false;
    if (close && now > close) return false;
    return true;
  }

  function workoutLiveLabel(wBase) {
    const live = workoutIsLive(wBase);
    const openAt = wBase.liveWindow?.openAt;
    const closeAt = wBase.liveWindow?.closeAt;
    if (live) return `LIVE (closes ${prettyDateTime(closeAt)})`;
    if (openAt && now < new Date(openAt).getTime()) return `Opens ${prettyDateTime(openAt)}`;
    if (closeAt && now > new Date(closeAt).getTime()) return `Closed ${prettyDateTime(closeAt)}`;
    return "Not live";
  }

  const submissionsClosed = data.settings.submissionsClosed;
  const leaderboardHidden = data.settings.hideLeaderboard;
  const finalOnly = data.settings.finalOnlyLeaderboard;
  const staffCanSeeProvisional = data.settings.allowProvisionalForStaff;

  /* ================================
     EFFECTIVE SCORE RESOLUTION
     (Final > awaiting adjustment > submission)
  ================================ */
  function getEffectiveScore(workoutId, participant) {
    const c = currentComp;
    if (!c) return { value: null, status: "none", note: "" };

    const final = c.finalScores?.[workoutId]?.[participant];
    if (final && final.value != null && String(final.value) !== "") {
      return { value: final.value, status: "final", note: final.note || "" };
    }

    const pending = (c.adjustments || []).find(
      (a) => a.workoutId === workoutId && a.participant === participant && a.status === "awaiting_head_judge"
    );
    if (pending && pending.adjustedValue != null && String(pending.adjustedValue) !== "") {
      return { value: pending.adjustedValue, status: "awaiting", note: pending.note || "" };
    }

    const sub = c.submissions?.[workoutId]?.[participant];
    if (sub && sub.value != null && String(sub.value) !== "") {
      return { value: sub.value, status: sub.status || "submitted", note: sub.judgeNote || "" };
    }

    return { value: null, status: "none", note: "" };
  }

  function canSeeProvisional() {
    // if final-only mode: staff may still see provisional if toggle enabled
    if (!finalOnly) return true;
    if (!isStaff) return false;
    return !!staffCanSeeProvisional;
  }

  /* ================================
     POINTS-BASED LEADERBOARD
     - ranks per workout
     - points = N - rank + 1
     - missing score => 0 points
     - supports Overall + per division
  ================================ */
  function isAscForWorkout(w) {
    if (w.sort === "asc") return true;
    if (w.sort === "desc") return false;
    return w.scoreType === "time";
  }

  function scoreToSortable(w, value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s) return null;
    if (w.scoreType === "time") return parseTimeToSeconds(s);
    return toNumberOrNull(s);
  }

  function computePointsLeaderboard(scopeParticipants) {
    const c = currentComp;
    if (!c) return [];

    const N = scopeParticipants.length;
    const workouts = c.workouts || [];

    // Precompute per workout ranking + points
    const perWorkout = {};
    workouts.forEach((wBase) => {
      const rows = scopeParticipants.map((p) => {
        const eff = getEffectiveScore(wBase.id, p.name);
        // apply visibility rule:
        if (!canSeeProvisional() && eff.status !== "final") {
          return { name: p.name, division: p.division, value: null, status: "hidden", sortable: null };
        }
        const sortable = scoreToSortable(wBase, eff.value);
        return { name: p.name, division: p.division, value: eff.value, status: eff.status, sortable };
      });

      const asc = isAscForWorkout(wBase);
      const scored = rows.filter((r) => r.sortable != null);
      scored.sort((a, b) => {
        if (a.sortable === b.sortable) return 0;
        return asc ? a.sortable - b.sortable : b.sortable - a.sortable;
      });

      // competition ranking (ties share rank)
      const rankMap = new Map();
      let rank = 1;
      for (let i = 0; i < scored.length; i++) {
        if (i > 0 && scored[i].sortable !== scored[i - 1].sortable) rank = i + 1;
        rankMap.set(scored[i].name, rank);
      }

      const pointsMap = new Map();
      rows.forEach((r) => {
        const rnk = rankMap.get(r.name);
        if (!rnk) pointsMap.set(r.name, 0);
        else pointsMap.set(r.name, N - rnk + 1);
      });

      perWorkout[wBase.id] = { rankMap, pointsMap, rows };
    });

    // Build final table
    const table = scopeParticipants.map((p) => {
      const breakdown = (currentComp.workouts || []).map((w) => {
        const wk = perWorkout[w.id];
        const points = wk?.pointsMap?.get(p.name) ?? 0;
        const rank = wk?.rankMap?.get(p.name) ?? null;
        const row = (wk?.rows || []).find((r) => r.name === p.name) || {};
        return { workoutId: w.id, workoutName: w.name, points, rank, value: row.value ?? null, status: row.status ?? "none" };
      });
      const totalPoints = breakdown.reduce((sum, b) => sum + (b.points || 0), 0);
      return { name: p.name, division: p.division, totalPoints, breakdown };
    });

    // Sort by total points desc, then name
    table.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return a.name.localeCompare(b.name);
    });

    return table;
  }

  /* ================================
     Athlete-side selections
  ================================ */
  const [athleteView, setAthleteView] = useState("workouts"); // workouts | submit | leaderboard | my_submissions
  const [mySelection, setMySelection] = useState(() => participantList[0] || "");
  const [lbDivision, setLbDivision] = useState("Overall"); // Overall or division name

  useEffect(() => {
    if (!participantList.includes(mySelection)) setMySelection(participantList[0] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, data.ui.compId, participantList.join("\n")]);

  useEffect(() => {
    const opts = ["Overall", ...compDivisions];
    if (!opts.includes(lbDivision)) setLbDivision("Overall");
  }, [compDivisions, lbDivision]);

  /* ================================
     SUBMIT DRAFT
  ================================ */
  const [submitDraft, setSubmitDraft] = useState({ workoutId: "", value: "", videoUrl: "", notes: "" });

  useEffect(() => {
    const firstWorkout = currentComp?.workouts?.[0]?.id || "";
    setSubmitDraft((d) => ({ ...d, workoutId: firstWorkout }));
  }, [data.ui.compId]); // eslint-disable-line react-hooks/exhaustive-deps

  function submitOnlineScore() {
    const comp = currentComp;
    if (!comp) return;

    const participant = mySelection;
    if (!participant) return showToast("warn", "Select an athlete/team first.");
    const w = (comp.workouts || []).find((x) => x.id === submitDraft.workoutId);
    if (!w) return showToast("warn", "Select a workout.");

    if (submissionsClosed) return showToast("warn", "Submissions are closed by organiser.");
    if (!workoutIsLive(w)) return showToast("warn", "This workout is not currently live.");

    const value = String(submitDraft.value || "").trim();
    if (!value) return showToast("warn", "Enter a score value.");

    const division = participantMeta.get(participant)?.division || "";

    updateComp(comp.id, (c) => {
      c.submissions = c.submissions || {};
      c.submissions[w.id] = c.submissions[w.id] || {};
      c.submissions[w.id][participant] = {
        value,
        videoUrl: String(submitDraft.videoUrl || "").trim(),
        notes: String(submitDraft.notes || "").trim(),
        submittedAt: new Date().toISOString(),
        status: "submitted",
        division,
        judgeNote: "",
      };
      return c;
    });

    addAudit(`Submission: ${participant} -> ${w.name} = ${value}`);
    showToast("ok", "Score submitted.");
    setAthleteView("my_submissions");
  }

  /* ================================
     JUDGE VIEW
  ================================ */
  const [judgeView, setJudgeView] = useState("review"); // review | adjusted_queue | leaderboard
  const [judgeName, setJudgeName] = useState(() => currentComp?.judgePool?.[0] || "Judge");

  useEffect(() => {
    setJudgeName(currentComp?.judgePool?.[0] || "Judge");
  }, [data.ui.compId]);

  const submissionsFlat = useMemo(() => {
    const c = currentComp;
    if (!c) return [];
    const rows = [];
    const subs = c.submissions || {};
    for (const w of c.workouts || []) {
      const per = subs[w.id] || {};
      for (const [participant, s] of Object.entries(per)) {
        rows.push({
          workoutId: w.id,
          workoutName: w.name,
          participant,
          division: s.division || participantMeta.get(participant)?.division || "",
          value: s.value,
          videoUrl: s.videoUrl,
          notes: s.notes,
          submittedAt: s.submittedAt,
          status: s.status || "submitted",
          judgeNote: s.judgeNote || "",
        });
      }
    }
    rows.sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
    return rows;
  }, [currentComp, participantMeta]);

  const [judgeFilter, setJudgeFilter] = useState({ q: "", workoutId: "all", status: "submitted", division: "all" });

  const judgeFiltered = useMemo(() => {
    const q = normaliseStr(judgeFilter.q);
    return submissionsFlat.filter((r) => {
      if (judgeFilter.workoutId !== "all" && r.workoutId !== judgeFilter.workoutId) return false;
      if (judgeFilter.status !== "all" && r.status !== judgeFilter.status) return false;
      if (judgeFilter.division !== "all" && r.division !== judgeFilter.division) return false;
      if (q) {
        const blob = `${r.participant} ${r.workoutName} ${r.value} ${r.notes} ${r.division}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [submissionsFlat, judgeFilter]);

  const [adjustDraft, setAdjustDraft] = useState({ id: "", workoutId: "", participant: "", adjustedValue: "", note: "" });

  function startAdjust(row) {
    setAdjustDraft({
      id: uid("adj"),
      workoutId: row.workoutId,
      participant: row.participant,
      adjustedValue: String(row.value ?? ""),
      note: "",
    });
  }

  function saveAdjustment() {
    const c = currentComp;
    if (!c) return;

    const value = String(adjustDraft.adjustedValue || "").trim();
    if (!adjustDraft.workoutId || !adjustDraft.participant) return;
    if (!value) return showToast("warn", "Adjusted value required.");

    updateComp(c.id, (comp) => {
      comp.adjustments = comp.adjustments || [];
      comp.adjustments.unshift({
        id: adjustDraft.id || uid("adj"),
        workoutId: adjustDraft.workoutId,
        participant: adjustDraft.participant,
        adjustedValue: value,
        note: String(adjustDraft.note || "").trim(),
        judgeName: judgeName || "Judge",
        judgeRole: "judge",
        createdAt: new Date().toISOString(),
        status: "awaiting_head_judge",
        decidedAt: "",
        headJudgeName: "",
        rejectReason: "",
      });

      // mark submission as adjusted (provisional)
      comp.submissions = comp.submissions || {};
      comp.submissions[adjustDraft.workoutId] = comp.submissions[adjustDraft.workoutId] || {};
      const existing = comp.submissions[adjustDraft.workoutId][adjustDraft.participant];
      if (existing) {
        existing.status = "adjusted";
        existing.judgeNote = `Proposed adjustment: ${value}${adjustDraft.note ? ` — ${adjustDraft.note}` : ""}`;
      }
      return comp;
    });

    addAudit(`Adjustment proposed: ${adjustDraft.participant} -> ${adjustDraft.workoutId} = ${value}`);
    showToast("ok", "Adjustment sent to Head Judge.");
    setAdjustDraft({ id: "", workoutId: "", participant: "", adjustedValue: "", note: "" });
    setJudgeView("adjusted_queue");
  }

  /* ================================
     HEAD JUDGE VIEW
  ================================ */
  const [headJudgeView, setHeadJudgeView] = useState("confirm"); // confirm | leaderboard | audit
  const [headJudgeName, setHeadJudgeName] = useState(() => currentComp?.headJudgePool?.[0] || "Head Judge");
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    setHeadJudgeName(currentComp?.headJudgePool?.[0] || "Head Judge");
  }, [data.ui.compId]);

  const awaitingAdjustments = useMemo(() => {
    const c = currentComp;
    if (!c) return [];
    return (c.adjustments || []).filter((a) => a.status === "awaiting_head_judge");
  }, [currentComp]);

  function confirmAdjustment(adjId) {
    const c = currentComp;
    if (!c) return;
    const adj = (c.adjustments || []).find((x) => x.id === adjId);
    if (!adj) return;

    updateComp(c.id, (comp) => {
      const a = (comp.adjustments || []).find((x) => x.id === adjId);
      if (!a) return comp;
      a.status = "approved";
      a.decidedAt = new Date().toISOString();
      a.headJudgeName = headJudgeName || "Head Judge";
      a.rejectReason = "";

      // write final score
      comp.finalScores = comp.finalScores || {};
      comp.finalScores[a.workoutId] = comp.finalScores[a.workoutId] || {};
      comp.finalScores[a.workoutId][a.participant] = {
        value: a.adjustedValue,
        finalAt: a.decidedAt,
        source: "adjustment",
        decidedBy: a.headJudgeName,
        note: a.note || "",
      };

      // mark submission status final
      comp.submissions = comp.submissions || {};
      comp.submissions[a.workoutId] = comp.submissions[a.workoutId] || {};
      if (comp.submissions[a.workoutId][a.participant]) {
        comp.submissions[a.workoutId][a.participant].status = "final";
      }
      return comp;
    });

    addAudit(`FINAL approved: ${adj.participant} -> ${adj.workoutId} = ${adj.adjustedValue}`);
    showToast("ok", "Final score confirmed.");
  }

  function rejectAdjustment(adjId) {
    const c = currentComp;
    if (!c) return;
    const adj = (c.adjustments || []).find((x) => x.id === adjId);
    if (!adj) return;

    const reason = String(rejectNote || "").trim();
    updateComp(c.id, (comp) => {
      const a = (comp.adjustments || []).find((x) => x.id === adjId);
      if (!a) return comp;
      a.status = "rejected";
      a.decidedAt = new Date().toISOString();
      a.headJudgeName = headJudgeName || "Head Judge";
      a.rejectReason = reason || "Rejected";

      // revert submission status back to submitted (still editable)
      comp.submissions = comp.submissions || {};
      comp.submissions[a.workoutId] = comp.submissions[a.workoutId] || {};
      if (comp.submissions[a.workoutId][a.participant]) {
        comp.submissions[a.workoutId][a.participant].status = "submitted";
        comp.submissions[a.workoutId][a.participant].judgeNote = `Adjustment rejected: ${a.rejectReason}`;
      }
      return comp;
    });

    addAudit(`Adjustment rejected: ${adj.participant} -> ${adj.workoutId}`);
    showToast("ok", "Adjustment rejected.");
    setRejectNote("");
  }

  /* ================================
     LEADERBOARD (memo)
  ================================ */
  const scopeParticipants = useMemo(() => {
    const c = currentComp;
    if (!c) return [];
    const all =
      mode === "athlete"
        ? (c.athletes || []).map((a) => ({ name: a.name, division: a.division || "" }))
        : (c.teams || []).map((t) => ({ name: t.name, division: t.division || "" }));

    if (lbDivision === "Overall") return all;
    return all.filter((p) => p.division === lbDivision);
  }, [currentComp, mode, lbDivision]);

  const pointsLeaderboard = useMemo(() => {
    return computePointsLeaderboard(scopeParticipants);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentComp, mode, lbDivision, isStaff, staffCanSeeProvisional, finalOnly]);

  /* ================================
     ORGANISER: workout editor + controls
  ================================ */
  const [orgView, setOrgView] = useState("workouts"); // workouts | schedule | controls | audit
  const [workoutEditor, setWorkoutEditor] = useState(null); // { mode, draft }

  function openNewWorkout() {
    setWorkoutEditor({
      mode: "new",
      draft: {
        id: uid("w"),
        name: "New Workout",
        divisionNotes: "All divisions",
        scoreType: "reps",
        sort: "desc",
        unit: "reps",
        cap: "10:00",
        tiebreak: "",
        equipment: [],
        standards: [],
        description: "",
        media: { demoVideoUrl: "", scorecardUrl: "" },
        liveWindow: defaultWindow(1, 72),
        scalingByDivision: {},
      },
    });
  }

  function openEditWorkout(w) {
    setWorkoutEditor({ mode: "edit", draft: JSON.parse(JSON.stringify(w)) });
  }

  function saveWorkout(draftWorkout) {
    if (!draftWorkout.name?.trim()) return showToast("warn", "Workout name is required.");

    updateComp(currentComp.id, (c) => {
      c.workouts = c.workouts || [];
      const idx = c.workouts.findIndex((w) => w.id === draftWorkout.id);
      if (idx >= 0) c.workouts[idx] = draftWorkout;
      else c.workouts.unshift(draftWorkout);
      return c;
    });

    addAudit(`${workoutEditor?.mode === "edit" ? "Edited" : "Created"} workout: ${draftWorkout.name}`);
    showToast("ok", "Workout saved.");
    setWorkoutEditor(null);
  }

  function deleteWorkout(workoutId) {
    updateComp(currentComp.id, (c) => {
      c.workouts = (c.workouts || []).filter((w) => w.id !== workoutId);
      if (c.submissions) delete c.submissions[workoutId];
      if (c.finalScores) delete c.finalScores[workoutId];
      c.adjustments = (c.adjustments || []).filter((a) => a.workoutId !== workoutId);
      return c;
    });
    addAudit(`Deleted workout: ${workoutId}`);
    showToast("ok", "Workout deleted.");
  }

  /* ================================
     HEADER / TABS
  ================================ */
  const tab = data.ui.tab;

  const Header = () => (
    <div style={S.headerRow}>
      <div>
        <div style={S.title}>Throwdown Hub — Demo (Points Leaderboard)</div>
        <div style={S.subTitle}>
          Points per workout (rank-based) → aggregate total points. Includes judge → head judge finalisation workflow, plus
          division scaling & organiser controls.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
        <div style={S.pill}>
          <strong>Role</strong>
          <Select value={role} onChange={setRole} options={ROLES} style={{ width: 170 }} />
        </div>

        <div style={S.pill}>
          <strong>Mode</strong>
          <Button onClick={toggleMode} variant="default" type="button">
            {mode === "athlete" ? "Athletes" : "Teams"}
          </Button>
        </div>

        <div style={S.pill}>
          <strong>Competition</strong>
          <Select
            value={data.ui.compId}
            onChange={setCompId}
            options={(data.competitions || []).map((c) => ({ value: c.id, label: c.name }))}
            style={{ width: 260 }}
          />
        </div>
      </div>
    </div>
  );

  const Tabs = () => (
    <div style={{ ...S.row, marginTop: 12 }}>
      <Button variant={tab === "competition" ? "primary" : "default"} onClick={() => setTab("competition")} type="button">
        Competition
      </Button>
      <Button variant={tab === "directory" ? "primary" : "default"} onClick={() => setTab("directory")} type="button">
        Directory (lite)
      </Button>
      <Button variant={tab === "admin" ? "primary" : "default"} onClick={() => setTab("admin")} type="button">
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
          maxWidth: 420,
          zIndex: 1000,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: 0.2 }}>{toast.type === "ok" ? "Done" : "Note"}</div>
        <div style={{ marginTop: 4, fontSize: 13 }}>{toast.msg}</div>
      </div>
    ) : null;

  /* ================================
     DIRECTORY (lite)
  ================================ */
  const DirectoryPanel = () => {
    const evt = data.directory.events?.[0];
    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Events Directory (lite)</div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            Placeholder directory panel. You can reinsert your full calendar/list directory later.
          </div>

          <div style={S.divider} />

          {evt ? (
            <div>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{evt.name}</div>
              <div style={{ ...S.muted, marginTop: 4 }}>
                {prettyDate(evt.startDate)} → {prettyDate(evt.endDate)} • {evt.city} • {evt.venue}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(evt.divisions || []).map((d) => (
                  <span key={d} style={S.tag}>
                    {d}
                  </span>
                ))}
              </div>
              {evt.instagram ? (
                <div style={{ marginTop: 8, ...S.muted }}>
                  IG: <span style={{ opacity: 0.95 }}>{evt.instagram}</span>
                </div>
              ) : null}
              {evt.notes ? <div style={{ marginTop: 8, ...S.muted }}>{evt.notes}</div> : null}
            </div>
          ) : (
            <div style={S.muted}>No events in directory.</div>
          )}
        </div>

        <div style={{ flex: "0 0 360px", ...S.card }}>
          <div style={{ fontWeight: 900 }}>Demo tips</div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            • Switch roles in the header to see role-based UX.
            <br />• Submit scores as Athlete/Team Manager.
            <br />• Propose adjustments as Judge.
            <br />• Confirm finals as Head Judge.
            <br />• Toggle visibility controls as Organiser.
          </div>
        </div>
      </div>
    );
  };

  /* ================================
     COMPETITION PANEL
  ================================ */
  const CompetitionPanel = () => {
    if (!currentComp) return <div style={{ ...S.card, marginTop: 14 }}>No competition selected.</div>;

    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>{currentComp.name}</div>
              <div style={{ ...S.muted, marginTop: 4 }}>
                {prettyDate(currentComp.date)} • {currentComp.location}
              </div>
              <div style={{ ...S.muted, marginTop: 6 }}>{currentComp.description}</div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={S.pill}>
                <strong>Leaderboard</strong>
                <span style={{ opacity: 0.85 }}>{leaderboardHidden ? "Hidden" : "Visible"}</span>
              </div>
              <div style={S.pill}>
                <strong>Submissions</strong>
                <span style={{ opacity: 0.85 }}>{submissionsClosed ? "Closed" : "Open"}</span>
              </div>
              <div style={S.pill}>
                <strong>Final-only</strong>
                <span style={{ opacity: 0.85 }}>{finalOnly ? "On" : "Off"}</span>
              </div>
            </div>
          </div>

          <div style={S.divider} />

          {role === "spectator" ? <SpectatorView /> : null}
          {isAthleteSide ? <AthleteTeamView /> : null}
          {isJudge ? <JudgeView /> : null}
          {isHeadJudge ? <HeadJudgeView /> : null}
          {isOrganiser ? <OrganiserView /> : null}
        </div>

        <div style={{ flex: "0 0 360px", ...S.card }}>
          <div style={{ fontWeight: 900 }}>Quick controls</div>
          <div style={{ ...S.muted, marginTop: 6 }}>For demo: organiser can toggle these from Settings/Admin too.</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <Toggle
              checked={data.settings.hideLeaderboard}
              onChange={() => toggleSetting("hideLeaderboard")}
              label="Hide leaderboard"
              hint="If on, spectators/athletes won't see it."
            />
            <Toggle
              checked={data.settings.submissionsClosed}
              onChange={() => toggleSetting("submissionsClosed")}
              label="Close submissions"
              hint="Stops athletes/teams submitting new scores."
            />
            <Toggle
              checked={data.settings.finalOnlyLeaderboard}
              onChange={() => toggleSetting("finalOnlyLeaderboard")}
              label="Final-only visibility"
              hint="Non-staff only see FINAL scores."
            />
            <Toggle
              checked={data.settings.allowProvisionalForStaff}
              onChange={() => toggleSetting("allowProvisionalForStaff")}
              label="Staff can view provisional"
              hint="Allows staff to see submitted/awaiting scores in final-only mode."
            />
          </div>
        </div>
      </div>
    );
  };

  /* ================================
     ROLE: Spectator
  ================================ */
  function SpectatorView() {
    return (
      <div>
        <div style={{ fontSize: 15, fontWeight: 900 }}>Spectator</div>
        <div style={{ ...S.muted, marginTop: 6 }}>
          View workouts + leaderboard. Switch to Athlete/Team Manager to submit.
        </div>

        <div style={S.divider} />

        <div style={{ ...S.row, marginBottom: 10 }}>
          <Field label="Leaderboard scope" style={{ width: 220 }}>
            <Select value={lbDivision} onChange={setLbDivision} options={["Overall", ...compDivisions]} />
          </Field>
        </div>

        <WorkoutsList />
        <div style={{ marginTop: 12 }}>
          <LeaderboardPanel />
        </div>
      </div>
    );
  }

  /* ================================
     ROLE: Athlete / Team Manager
  ================================ */
  function AthleteTeamView() {
    const myDivision = participantMeta.get(mySelection)?.division || "";
    const myMembers = participantMeta.get(mySelection)?.members || [];

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>
              {role === "team_manager" ? "Team Manager" : "Athlete"} — {mode === "athlete" ? "Athletes" : "Teams"}
            </div>
            <div style={{ ...S.muted, marginTop: 4 }}>
              Select {mode === "athlete" ? "athlete" : "team"}, view workouts (scaled by division), submit scores, and view your submissions.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Field label={mode === "athlete" ? "Athlete" : "Team"} style={{ width: 240 }}>
              <Select value={mySelection} onChange={setMySelection} options={participantList.length ? participantList : ["—"]} />
            </Field>
            <div style={S.pill}>
              <strong>Division</strong>
              <span style={{ opacity: 0.9 }}>{myDivision || "—"}</span>
            </div>
          </div>
        </div>

        {mode === "team" && myMembers?.length ? (
          <div style={{ marginTop: 10, ...S.muted }}>
            Team members: <span style={{ opacity: 0.95 }}>{myMembers.join(", ")}</span>
          </div>
        ) : null}

        <div style={S.divider} />

        <div style={{ ...S.row, marginBottom: 10 }}>
          <Button variant={athleteView === "workouts" ? "primary" : "default"} onClick={() => setAthleteView("workouts")} type="button">
            Workouts
          </Button>
          <Button variant={athleteView === "submit" ? "primary" : "default"} onClick={() => setAthleteView("submit")} type="button">
            Submit Score
          </Button>
          <Button
            variant={athleteView === "my_submissions" ? "primary" : "default"}
            onClick={() => setAthleteView("my_submissions")}
            type="button"
          >
            My Submissions
          </Button>
          <Button
            variant={athleteView === "leaderboard" ? "primary" : "default"}
            onClick={() => setAthleteView("leaderboard")}
            type="button"
          >
            Leaderboard
          </Button>

          <div style={{ flex: 1 }} />

          <Field label="Leaderboard scope" style={{ width: 220 }}>
            <Select value={lbDivision} onChange={setLbDivision} options={["Overall", ...compDivisions]} />
          </Field>
        </div>

        {athleteView === "workouts" ? <WorkoutsList division={myDivision} /> : null}
        {athleteView === "submit" ? (
          <div style={{ ...S.card, padding: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Submit an online score</div>
            <div style={{ ...S.muted, marginTop: 6 }}>
              Submissions must be within the workout live window. Value format depends on workout (e.g. time as mm:ss).
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <Field label="Workout">
                <Select
                  value={submitDraft.workoutId}
                  onChange={(v) => setSubmitDraft((d) => ({ ...d, workoutId: v }))}
                  options={(currentComp.workouts || []).map((w) => ({ value: w.id, label: w.name }))}
                />
              </Field>

              <Field label="Score value">
                <input
                  style={S.input}
                  value={submitDraft.value}
                  onChange={(e) => setSubmitDraft((d) => ({ ...d, value: e.target.value }))}
                  placeholder="e.g. 08:44 (time) or 110 (kg) or 245 (reps)"
                />
              </Field>

              <Field label="Video URL (optional)" style={{ gridColumn: "1 / -1" }}>
                <input
                  style={S.input}
                  value={submitDraft.videoUrl}
                  onChange={(e) => setSubmitDraft((d) => ({ ...d, videoUrl: e.target.value }))}
                  placeholder="Paste a video link"
                />
              </Field>

              <Field label="Notes (optional)" style={{ gridColumn: "1 / -1" }}>
                <textarea
                  style={{ ...S.input, minHeight: 90, resize: "vertical" }}
                  value={submitDraft.notes}
                  onChange={(e) => setSubmitDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Anything the judge should know..."
                />
              </Field>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <Button variant="primary" onClick={submitOnlineScore} type="button">
                Submit
              </Button>
              <div style={{ ...S.muted, marginLeft: 6 }}>
                {submissionsClosed ? "Submissions are closed." : "Submissions are open."}{" "}
                {(() => {
                  const w = (currentComp.workouts || []).find((x) => x.id === submitDraft.workoutId);
                  if (!w) return null;
                  return `• ${workoutLiveLabel(w)}`;
                })()}
              </div>
            </div>
          </div>
        ) : null}

        {athleteView === "my_submissions" ? <MySubmissionsPanel participant={mySelection} /> : null}
        {athleteView === "leaderboard" ? <LeaderboardPanel /> : null}
      </div>
    );
  }

  function MySubmissionsPanel({ participant }) {
    const c = currentComp;
    const rows = (c.workouts || []).map((w) => {
      const sub = c.submissions?.[w.id]?.[participant];
      const eff = getEffectiveScore(w.id, participant);
      return {
        workoutId: w.id,
        workoutName: w.name,
        submittedAt: sub?.submittedAt || "",
        submittedValue: sub?.value ?? null,
        status: sub?.status || "none",
        effectiveValue: eff.value,
        effectiveStatus: eff.status,
        judgeNote: sub?.judgeNote || "",
      };
    });

    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>My Submissions</div>
        <div style={{ ...S.muted, marginTop: 6 }}>Shows your submitted score, plus effective score (final `{'>'}` awaiting `{'>'}` submission).</div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Workout</th>
                <th style={S.th}>Submitted</th>
                <th style={S.th}>Submitted at</th>
                <th style={S.th}>Effective</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.workoutId}>
                  <td style={S.td}>{r.workoutName}</td>
                  <td style={S.td}>{r.submittedValue ?? "—"}</td>
                  <td style={S.td}>{r.submittedAt ? prettyDateTime(r.submittedAt) : "—"}</td>
                  <td style={S.td}>{r.effectiveValue ?? "—"}</td>
                  <td style={S.td}>
                    <span style={S.tag}>{r.effectiveStatus}</span>
                  </td>
                  <td style={S.td}>
                    <div style={S.muted}>{r.judgeNote || "—"}</div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td style={S.td} colSpan={6}>
                    <div style={S.muted}>No workouts.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ================================
     ROLE: Judge
  ================================ */
  function JudgeView() {
    const c = currentComp;

    const myAdjustments = (c.adjustments || []).filter((a) => a.judgeName === judgeName);

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Judge</div>
            <div style={{ ...S.muted, marginTop: 4 }}>Review submissions and propose adjustments to Head Judge.</div>
          </div>

          <Field label="Judge name" style={{ width: 240 }}>
            <Select value={judgeName} onChange={setJudgeName} options={currentComp?.judgePool?.length ? currentComp.judgePool : ["Judge"]} />
          </Field>
        </div>

        <div style={S.divider} />

        <div style={{ ...S.row, marginBottom: 10 }}>
          <Button variant={judgeView === "review" ? "primary" : "default"} onClick={() => setJudgeView("review")} type="button">
            Review Submissions
          </Button>
          <Button
            variant={judgeView === "adjusted_queue" ? "primary" : "default"}
            onClick={() => setJudgeView("adjusted_queue")}
            type="button"
          >
            Adjustments Sent ({myAdjustments.length})
          </Button>
          <Button variant={judgeView === "leaderboard" ? "primary" : "default"} onClick={() => setJudgeView("leaderboard")} type="button">
            Leaderboard
          </Button>

          <div style={{ flex: 1 }} />

          <Field label="Leaderboard scope" style={{ width: 220 }}>
            <Select value={lbDivision} onChange={setLbDivision} options={["Overall", ...compDivisions]} />
          </Field>
        </div>

        {judgeView === "review" ? (
          <div>
            <div style={{ ...S.card, padding: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Filters</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                <Field label="Search">
                  <input
                    style={S.input}
                    value={judgeFilter.q}
                    onChange={(e) => setJudgeFilter((f) => ({ ...f, q: e.target.value }))}
                    placeholder="Name, workout, notes..."
                  />
                </Field>
                <Field label="Workout">
                  <Select
                    value={judgeFilter.workoutId}
                    onChange={(v) => setJudgeFilter((f) => ({ ...f, workoutId: v }))}
                    options={[
                      { value: "all", label: "All" },
                      ...(currentComp.workouts || []).map((w) => ({ value: w.id, label: w.name })),
                    ]}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={judgeFilter.status}
                    onChange={(v) => setJudgeFilter((f) => ({ ...f, status: v }))}
                    options={[
                      { value: "all", label: "All" },
                      { value: "submitted", label: "Submitted" },
                      { value: "adjusted", label: "Adjusted (proposed)" },
                      { value: "final", label: "Final" },
                    ]}
                  />
                </Field>
                <Field label="Division">
                  <Select
                    value={judgeFilter.division}
                    onChange={(v) => setJudgeFilter((f) => ({ ...f, division: v }))}
                    options={[{ value: "all", label: "All" }, ...compDivisions.map((d) => ({ value: d, label: d }))]}
                  />
                </Field>
              </div>
            </div>

            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Submitted at</th>
                    <th style={S.th}>Participant</th>
                    <th style={S.th}>Division</th>
                    <th style={S.th}>Workout</th>
                    <th style={S.th}>Value</th>
                    <th style={S.th}>Notes</th>
                    <th style={S.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {judgeFiltered.map((r) => (
                    <tr key={`${r.workoutId}_${r.participant}`}>
                      <td style={S.td}>{r.submittedAt ? prettyDateTime(r.submittedAt) : "—"}</td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 900 }}>{r.participant}</div>
                        {r.videoUrl ? <div style={S.muted}>Video: {r.videoUrl}</div> : null}
                      </td>
                      <td style={S.td}>{r.division || "—"}</td>
                      <td style={S.td}>{r.workoutName}</td>
                      <td style={S.td}>
                        <span style={S.tag}>{r.value ?? "—"}</span>
                        <div style={{ ...S.muted, marginTop: 6 }}>{r.status}</div>
                      </td>
                      <td style={S.td}>
                        <div style={S.muted}>{r.notes || "—"}</div>
                        {r.judgeNote ? <div style={{ ...S.muted, marginTop: 6 }}>Judge note: {r.judgeNote}</div> : null}
                      </td>
                      <td style={S.td}>
                        <Button variant="primary" onClick={() => startAdjust(r)} type="button">
                          Propose adjustment
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {judgeFiltered.length === 0 ? (
                    <tr>
                      <td style={S.td} colSpan={7}>
                        <div style={S.muted}>No submissions match your filters.</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {adjustDraft.workoutId ? (
              <div style={{ ...S.card, padding: 12, marginTop: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>Propose adjustment</div>
                <div style={{ ...S.muted, marginTop: 6 }}>
                  Sends to Head Judge for approval. Until approved, leaderboard shows “awaiting” to staff (depending on settings).
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                  <Field label="Participant">
                    <input style={S.input} value={adjustDraft.participant} readOnly />
                  </Field>
                  <Field label="Workout">
                    <input
                      style={S.input}
                      value={(currentComp.workouts || []).find((w) => w.id === adjustDraft.workoutId)?.name || adjustDraft.workoutId}
                      readOnly
                    />
                  </Field>
                  <Field label="Adjusted value" style={{ gridColumn: "1 / -1" }}>
                    <input
                      style={S.input}
                      value={adjustDraft.adjustedValue}
                      onChange={(e) => setAdjustDraft((d) => ({ ...d, adjustedValue: e.target.value }))}
                      placeholder="e.g. 09:12 or 105"
                    />
                  </Field>
                  <Field label="Reason / note (optional)" style={{ gridColumn: "1 / -1" }}>
                    <textarea
                      style={{ ...S.input, minHeight: 90, resize: "vertical" }}
                      value={adjustDraft.note}
                      onChange={(e) => setAdjustDraft((d) => ({ ...d, note: e.target.value }))}
                      placeholder="Explain the adjustment (no-reps, standards, missing rep, etc.)"
                    />
                  </Field>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  <Button variant="primary" onClick={saveAdjustment} type="button">
                    Send to Head Judge
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setAdjustDraft({ id: "", workoutId: "", participant: "", adjustedValue: "", note: "" })}
                    type="button"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {judgeView === "adjusted_queue" ? (
          <div style={{ ...S.card, padding: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Adjustments sent</div>
            <div style={{ ...S.muted, marginTop: 6 }}>Track the adjustments you’ve proposed and their status.</div>

            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Created</th>
                    <th style={S.th}>Participant</th>
                    <th style={S.th}>Workout</th>
                    <th style={S.th}>Adjusted value</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {myAdjustments.map((a) => (
                    <tr key={a.id}>
                      <td style={S.td}>{prettyDateTime(a.createdAt)}</td>
                      <td style={S.td}>{a.participant}</td>
                      <td style={S.td}>{(currentComp.workouts || []).find((w) => w.id === a.workoutId)?.name || a.workoutId}</td>
                      <td style={S.td}>
                        <span style={S.tag}>{a.adjustedValue}</span>
                      </td>
                      <td style={S.td}>
                        <span style={S.tag}>{a.status}</span>
                      </td>
                      <td style={S.td}>
                        <div style={S.muted}>{a.note || "—"}</div>
                        {a.status === "rejected" ? (
                          <div style={{ ...S.muted, marginTop: 6 }}>Rejected: {a.rejectReason || "—"}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {myAdjustments.length === 0 ? (
                    <tr>
                      <td style={S.td} colSpan={6}>
                        <div style={S.muted}>No adjustments yet.</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {judgeView === "leaderboard" ? <LeaderboardPanel /> : null}
      </div>
    );
  }

  /* ================================
     ROLE: Head Judge
  ================================ */
  function HeadJudgeView() {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Head Judge</div>
            <div style={{ ...S.muted, marginTop: 4 }}>Approve/reject judge adjustments to write FINAL scores.</div>
          </div>

          <Field label="Head Judge name" style={{ width: 240 }}>
            <Select
              value={headJudgeName}
              onChange={setHeadJudgeName}
              options={currentComp?.headJudgePool?.length ? currentComp.headJudgePool : ["Head Judge"]}
            />
          </Field>
        </div>

        <div style={S.divider} />

        <div style={{ ...S.row, marginBottom: 10 }}>
          <Button variant={headJudgeView === "confirm" ? "primary" : "default"} onClick={() => setHeadJudgeView("confirm")} type="button">
            Confirm Adjustments ({awaitingAdjustments.length})
          </Button>
          <Button
            variant={headJudgeView === "leaderboard" ? "primary" : "default"}
            onClick={() => setHeadJudgeView("leaderboard")}
            type="button"
          >
            Leaderboard
          </Button>
          <Button variant={headJudgeView === "audit" ? "primary" : "default"} onClick={() => setHeadJudgeView("audit")} type="button">
            Audit
          </Button>

          <div style={{ flex: 1 }} />

          <Field label="Leaderboard scope" style={{ width: 220 }}>
            <Select value={lbDivision} onChange={setLbDivision} options={["Overall", ...compDivisions]} />
          </Field>
        </div>

        {headJudgeView === "confirm" ? (
          <div style={{ ...S.card, padding: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Awaiting confirmation</div>
            <div style={{ ...S.muted, marginTop: 6 }}>Approve to set final score. Reject to return to submitted state with a note.</div>

            <Field label="Reject note (optional)" style={{ marginTop: 10 }}>
              <input style={S.input} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Reason for rejection..." />
            </Field>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {awaitingAdjustments.map((a) => (
                <div key={a.id} style={{ ...S.card, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 950 }}>
                        {a.participant} • {(currentComp.workouts || []).find((w) => w.id === a.workoutId)?.name || a.workoutId}
                      </div>
                      <div style={{ ...S.muted, marginTop: 4 }}>
                        Proposed by {a.judgeName} at {prettyDateTime(a.createdAt)}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span style={S.tag}>Adjusted: {a.adjustedValue}</span>
                      </div>
                      {a.note ? <div style={{ ...S.muted, marginTop: 8 }}>Note: {a.note}</div> : null}
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Button variant="primary" onClick={() => confirmAdjustment(a.id)} type="button">
                        Approve FINAL
                      </Button>
                      <Button variant="danger" onClick={() => rejectAdjustment(a.id)} type="button">
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {awaitingAdjustments.length === 0 ? (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>No pending adjustments.</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>Judges can propose adjustments from their view.</div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {headJudgeView === "leaderboard" ? <LeaderboardPanel /> : null}
        {headJudgeView === "audit" ? <AuditPanel /> : null}
      </div>
    );
  }

  /* ================================
     ROLE: Organiser
  ================================ */
  function OrganiserView() {
    return (
      <div>
        <div style={{ fontSize: 15, fontWeight: 900 }}>Organiser</div>
        <div style={{ ...S.muted, marginTop: 4 }}>Edit workouts/scaling, manage live windows and visibility controls.</div>

        <div style={S.divider} />

        <div style={{ ...S.row, marginBottom: 10 }}>
          <Button variant={orgView === "workouts" ? "primary" : "default"} onClick={() => setOrgView("workouts")} type="button">
            Workouts + Scaling
          </Button>
          <Button variant={orgView === "schedule" ? "primary" : "default"} onClick={() => setOrgView("schedule")} type="button">
            Scheduling
          </Button>
          <Button variant={orgView === "controls" ? "primary" : "default"} onClick={() => setOrgView("controls")} type="button">
            Controls
          </Button>
          <Button variant={orgView === "audit" ? "primary" : "default"} onClick={() => setOrgView("audit")} type="button">
            Audit
          </Button>

          <div style={{ flex: 1 }} />

          <Button variant="primary" onClick={openNewWorkout} type="button">
            + New workout
          </Button>
        </div>

        {orgView === "workouts" ? (
          <div>
            <div style={{ ...S.muted, marginBottom: 10 }}>Tip: open a workout to add division-specific scaling overrides.</div>
            <WorkoutsList allowEdit />
          </div>
        ) : null}

        {orgView === "schedule" ? <SchedulePanel /> : null}
        {orgView === "controls" ? <ControlsPanel /> : null}
        {orgView === "audit" ? <AuditPanel /> : null}
      </div>
    );
  }

  function SchedulePanel() {
    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 900 }}>Workout live windows</div>
        <div style={{ ...S.muted, marginTop: 6 }}>Set open/close date-times (browser local time). Athletes can only submit while live.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {(currentComp.workouts || []).map((w) => (
            <div key={w.id} style={{ ...S.card, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>{w.name}</div>
                <div style={S.tag}>{workoutLiveLabel(w)}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                <Field label="Opens">
                  <input
                    style={S.input}
                    type="datetime-local"
                    value={isoToLocalInput(w.liveWindow?.openAt)}
                    onChange={(e) => {
                      const iso = localInputToIso(e.target.value);
                      updateComp(currentComp.id, (c) => {
                        const ww = (c.workouts || []).find((x) => x.id === w.id);
                        if (!ww) return c;
                        ww.liveWindow = ww.liveWindow || {};
                        ww.liveWindow.openAt = iso;
                        return c;
                      });
                    }}
                  />
                </Field>
                <Field label="Closes">
                  <input
                    style={S.input}
                    type="datetime-local"
                    value={isoToLocalInput(w.liveWindow?.closeAt)}
                    onChange={(e) => {
                      const iso = localInputToIso(e.target.value);
                      updateComp(currentComp.id, (c) => {
                        const ww = (c.workouts || []).find((x) => x.id === w.id);
                        if (!ww) return c;
                        ww.liveWindow = ww.liveWindow || {};
                        ww.liveWindow.closeAt = iso;
                        return c;
                      });
                    }}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function ControlsPanel() {
    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 900 }}>Controls</div>
        <div style={{ ...S.muted, marginTop: 6 }}>Visibility + submission gates.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          <Toggle checked={data.settings.hideLeaderboard} onChange={() => toggleSetting("hideLeaderboard")} label="Hide leaderboard" />
          <Toggle checked={data.settings.submissionsClosed} onChange={() => toggleSetting("submissionsClosed")} label="Close submissions" />
          <Toggle checked={data.settings.finalOnlyLeaderboard} onChange={() => toggleSetting("finalOnlyLeaderboard")} label="Final-only visibility" />
          <Toggle
            checked={data.settings.allowProvisionalForStaff}
            onChange={() => toggleSetting("allowProvisionalForStaff")}
            label="Staff can view provisional"
          />
        </div>

        <div style={S.divider} />

        <div style={{ fontWeight: 900 }}>Admin actions</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <Button variant="default" onClick={exportAll} type="button">
            Export JSON
          </Button>
          <Button variant="default" onClick={() => fileInputRef.current?.click()} type="button">
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
              if (!res.ok) showToast("warn", res.error);
              else showToast("ok", "Imported.");
              e.target.value = "";
            }}
          />
          <Button variant="danger" onClick={resetDemo} type="button">
            Reset demo
          </Button>
        </div>
      </div>
    );
  }

  function AuditPanel() {
    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 900 }}>Audit log</div>
        <div style={{ ...S.muted, marginTop: 6 }}>Shows key demo actions (submissions, adjustments, finals, workout edits).</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {(currentComp.audit || []).map((a) => (
            <div key={a.id} style={{ ...S.card, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900 }}>{prettyDateTime(a.at)}</div>
                <div style={S.tag}>{a.whoRole}</div>
              </div>
              <div style={{ marginTop: 8 }}>{a.message}</div>
            </div>
          ))}

          {(currentComp.audit || []).length === 0 ? (
            <div style={{ ...S.card, padding: 12 }}>
              <div style={{ fontWeight: 900 }}>No audit entries yet.</div>
              <div style={{ ...S.muted, marginTop: 6 }}>Create/edit workouts and process scores to generate audit.</div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  /* ================================
     COMMON: Workouts List
  ================================ */
  function WorkoutsList({ division = "", allowEdit = false }) {
    const list = currentComp.workouts || [];
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
        {list.map((wBase) => {
          const w = division ? workoutForDivision(wBase, division) : wBase;
          const scaled = !!(division && wBase.scalingByDivision?.[division]);

          return (
            <div key={wBase.id} style={{ ...S.card, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>{w.name}</div>
                  <div style={{ ...S.muted, marginTop: 4 }}>
                    {w.scoreType} • {w.unit || "—"} • cap {w.cap || "—"} • {workoutLiveLabel(wBase)}
                    {division ? ` • division: ${division}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                    {scaled ? <span style={S.tag}>SCALED</span> : null}
                    <span style={S.tag}>Sort: {isAscForWorkout(w) ? "ASC (lower wins)" : "DESC (higher wins)"}</span>
                    {w.divisionNotes ? <span style={S.tag}>{w.divisionNotes}</span> : null}
                  </div>
                </div>

                {allowEdit ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <Button variant="primary" onClick={() => openEditWorkout(wBase)} type="button">
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => deleteWorkout(wBase.id)} type="button">
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>

              <div style={S.divider} />

              {w.description ? <div style={{ whiteSpace: "pre-wrap" }}>{w.description}</div> : <div style={S.muted}>No description.</div>}

              {w.equipment?.length ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>Equipment</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {w.equipment.map((x, i) => (
                      <span key={`${x}_${i}`} style={S.tag}>
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {w.standards?.length ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>Standards</div>
                  <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18 }}>
                    {w.standards.map((x, i) => (
                      <li key={`${x}_${i}`} style={{ ...S.muted, marginBottom: 4 }}>
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {w.tiebreak ? (
                <div style={{ marginTop: 10, ...S.muted }}>
                  <strong style={{ opacity: 0.95 }}>Tiebreak:</strong> {w.tiebreak}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  /* ================================
     COMMON: Leaderboard Panel (Points)
  ================================ */
  function LeaderboardPanel() {
    if (leaderboardHidden) {
      return (
        <div style={{ ...S.card, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>Leaderboard hidden</div>
          <div style={{ ...S.muted, marginTop: 6 }}>The organiser has hidden the leaderboard for this competition.</div>
        </div>
      );
    }

    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Leaderboard (Points)</div>
            <div style={{ ...S.muted, marginTop: 4 }}>
              Each workout ranks participants; points = N - rank + 1. Missing/hidden score = 0 points. Scope: {lbDivision}.
              {finalOnly && !isStaff ? " (final-only enabled)" : ""}
            </div>
          </div>
          <div style={S.pill}>
            <strong>Visible scores</strong>
            <span style={{ opacity: 0.9 }}>{canSeeProvisional() ? "Provisional + Final" : "Final only"}</span>
          </div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Rank</th>
                <th style={S.th}>{mode === "athlete" ? "Athlete" : "Team"}</th>
                <th style={S.th}>Division</th>
                <th style={S.th}>Total points</th>
                {(currentComp.workouts || []).map((w) => (
                  <th key={w.id} style={S.th}>
                    {w.name}
                    <div style={S.muted}>pts / value</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pointsLeaderboard.map((row, idx) => (
                <tr key={row.name}>
                  <td style={S.td}>
                    <span style={S.tag}>{idx + 1}</span>
                  </td>
                  <td style={S.td}>
                    <div style={{ fontWeight: 900 }}>{row.name}</div>
                  </td>
                  <td style={S.td}>{row.division || "—"}</td>
                  <td style={S.td}>
                    <span style={S.tag}>{row.totalPoints}</span>
                  </td>

                  {row.breakdown.map((b) => (
                    <td key={b.workoutId} style={S.td}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={S.tag}>{b.points} pts</span>
                        <div style={S.muted}>
                          {b.value == null ? "—" : String(b.value)} • {b.status}
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}

              {pointsLeaderboard.length === 0 ? (
                <tr>
                  <td style={S.td} colSpan={5 + (currentComp.workouts || []).length}>
                    <div style={S.muted}>No participants in this scope.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ================================
     WORKOUT EDITOR MODAL
  ================================ */
  function WorkoutEditorModal({ editor, onClose, onSave, divisions }) {
    const [draft, setDraft] = useState(editor.draft);

    function setField(key, value) {
      setDraft((d) => ({ ...d, [key]: value }));
    }

    function setScale(division, key, value) {
      setDraft((d) => {
        const next = { ...(d.scalingByDivision || {}) };
        next[division] = { ...(next[division] || {}) };
        if (value === "" || value == null) {
          // allow clearing specific fields by setting empty string
          next[division][key] = "";
        } else {
          next[division][key] = value;
        }
        return { ...d, scalingByDivision: next };
      });
    }

    function setScaleList(division, key, text) {
      const arr = String(text || "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      setDraft((d) => {
        const next = { ...(d.scalingByDivision || {}) };
        next[division] = { ...(next[division] || {}) };
        next[division][key] = arr;
        return { ...d, scalingByDivision: next };
      });
    }

    function removeScale(division) {
      setDraft((d) => {
        const next = { ...(d.scalingByDivision || {}) };
        delete next[division];
        return { ...d, scalingByDivision: next };
      });
    }

    return (
      <div style={S.modalBackdrop} onMouseDown={onClose}>
        <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>
              {editor.mode === "edit" ? "Edit workout" : "New workout"}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Button variant="default" onClick={onClose} type="button">
                Close
              </Button>
              <Button variant="primary" onClick={() => onSave(draft)} type="button">
                Save
              </Button>
            </div>
          </div>

          <div style={S.divider} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Workout name">
              <input style={S.input} value={draft.name} onChange={(e) => setField("name", e.target.value)} />
            </Field>

            <Field label="Division notes">
              <input style={S.input} value={draft.divisionNotes} onChange={(e) => setField("divisionNotes", e.target.value)} />
            </Field>

            <Field label="Score type">
              <Select
                value={draft.scoreType}
                onChange={(v) => setField("scoreType", v)}
                options={[
                  { value: "time", label: "time" },
                  { value: "reps", label: "reps" },
                  { value: "load", label: "load" },
                  { value: "distance", label: "distance" },
                  { value: "calories", label: "calories" },
                ]}
              />
            </Field>

            <Field label="Sort">
              <Select value={draft.sort} onChange={(v) => setField("sort", v)} options={[{ value: "asc", label: "asc" }, { value: "desc", label: "desc" }]} />
            </Field>

            <Field label="Unit">
              <input style={S.input} value={draft.unit} onChange={(e) => setField("unit", e.target.value)} placeholder="e.g. time (mm:ss), reps, kg" />
            </Field>

            <Field label="Cap">
              <input style={S.input} value={draft.cap} onChange={(e) => setField("cap", e.target.value)} placeholder="e.g. 12:00" />
            </Field>

            <Field label="Tiebreak (optional)" style={{ gridColumn: "1 / -1" }}>
              <input style={S.input} value={draft.tiebreak} onChange={(e) => setField("tiebreak", e.target.value)} />
            </Field>

            <Field label="Description" style={{ gridColumn: "1 / -1" }}>
              <textarea
                style={{ ...S.input, minHeight: 110, resize: "vertical" }}
                value={draft.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Workout details..."
              />
            </Field>

            <Field label="Equipment (one per line)">
              <textarea
                style={{ ...S.input, minHeight: 110, resize: "vertical" }}
                value={(draft.equipment || []).join("\n")}
                onChange={(e) =>
                  setField(
                    "equipment",
                    e.target.value
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean)
                  )
                }
              />
            </Field>

            <Field label="Standards (one per line)">
              <textarea
                style={{ ...S.input, minHeight: 110, resize: "vertical" }}
                value={(draft.standards || []).join("\n")}
                onChange={(e) =>
                  setField(
                    "standards",
                    e.target.value
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean)
                  )
                }
              />
            </Field>
          </div>

          <div style={S.divider} />

          <div style={{ fontWeight: 950 }}>Live window</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
            <Field label="Opens">
              <input
                style={S.input}
                type="datetime-local"
                value={isoToLocalInput(draft.liveWindow?.openAt)}
                onChange={(e) => setField("liveWindow", { ...(draft.liveWindow || {}), openAt: localInputToIso(e.target.value) })}
              />
            </Field>
            <Field label="Closes">
              <input
                style={S.input}
                type="datetime-local"
                value={isoToLocalInput(draft.liveWindow?.closeAt)}
                onChange={(e) => setField("liveWindow", { ...(draft.liveWindow || {}), closeAt: localInputToIso(e.target.value) })}
              />
            </Field>
          </div>

          <div style={S.divider} />

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 950 }}>Division scaling overrides</div>
              <div style={{ ...S.muted, marginTop: 4 }}>
                Add overrides per division (optional). Any field left blank falls back to base workout.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            {(divisions || []).map((div) => {
              const has = !!draft.scalingByDivision?.[div];
              const s = draft.scalingByDivision?.[div] || {};
              return (
                <div key={div} style={{ ...S.card, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>
                      {div} {has ? <span style={{ ...S.tag, marginLeft: 8 }}>OVERRIDES ON</span> : <span style={{ ...S.tag, marginLeft: 8 }}>OFF</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {has ? (
                        <Button variant="danger" onClick={() => removeScale(div)} type="button">
                          Remove overrides
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() =>
                            setDraft((d) => ({ ...d, scalingByDivision: { ...(d.scalingByDivision || {}), [div]: {} } }))
                          }
                          type="button"
                        >
                          Add overrides
                        </Button>
                      )}
                    </div>
                  </div>

                  {has ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                      <Field label="Description override" style={{ gridColumn: "1 / -1" }}>
                        <textarea
                          style={{ ...S.input, minHeight: 90, resize: "vertical" }}
                          value={s.description || ""}
                          onChange={(e) => setScale(div, "description", e.target.value)}
                          placeholder="Leave blank to use base description"
                        />
                      </Field>

                      <Field label="Unit override">
                        <input style={S.input} value={s.unit || ""} onChange={(e) => setScale(div, "unit", e.target.value)} />
                      </Field>

                      <Field label="Cap override">
                        <input style={S.input} value={s.cap || ""} onChange={(e) => setScale(div, "cap", e.target.value)} />
                      </Field>

                      <Field label="Sort override">
                        <Select
                          value={s.sort || ""}
                          onChange={(v) => setScale(div, "sort", v)}
                          options={[
                            { value: "", label: "(use base)" },
                            { value: "asc", label: "asc" },
                            { value: "desc", label: "desc" },
                          ]}
                        />
                      </Field>

                      <Field label="Score type override">
                        <Select
                          value={s.scoreType || ""}
                          onChange={(v) => setScale(div, "scoreType", v)}
                          options={[
                            { value: "", label: "(use base)" },
                            { value: "time", label: "time" },
                            { value: "reps", label: "reps" },
                            { value: "load", label: "load" },
                            { value: "distance", label: "distance" },
                            { value: "calories", label: "calories" },
                          ]}
                        />
                      </Field>

                      <Field label="Equipment override (one per line)" style={{ gridColumn: "1 / -1" }}>
                        <textarea
                          style={{ ...S.input, minHeight: 90, resize: "vertical" }}
                          value={Array.isArray(s.equipment) ? s.equipment.join("\n") : ""}
                          onChange={(e) => setScaleList(div, "equipment", e.target.value)}
                        />
                      </Field>

                      <Field label="Standards override (one per line)" style={{ gridColumn: "1 / -1" }}>
                        <textarea
                          style={{ ...S.input, minHeight: 90, resize: "vertical" }}
                          value={Array.isArray(s.standards) ? s.standards.join("\n") : ""}
                          onChange={(e) => setScaleList(div, "standards", e.target.value)}
                        />
                      </Field>
                    </div>
                  ) : (
                    <div style={{ ...S.muted, marginTop: 10 }}>No overrides for this division.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // datetime-local helpers
  function isoToLocalInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function localInputToIso(localValue) {
    if (!localValue) return "";
    const d = new Date(localValue);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString();
  }

  /* ================================
     SETTINGS / ADMIN
  ================================ */
  const AdminPanel = () => (
    <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
      <div style={{ flex: "1 1 760px", ...S.card }}>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Settings / Admin</div>
        <div style={{ ...S.muted, marginTop: 6 }}>Global demo toggles + import/export. Stored in localStorage.</div>

        <div style={S.divider} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Toggle checked={data.settings.hideLeaderboard} onChange={() => toggleSetting("hideLeaderboard")} label="Hide leaderboard" />
          <Toggle checked={data.settings.submissionsClosed} onChange={() => toggleSetting("submissionsClosed")} label="Close submissions" />
          <Toggle checked={data.settings.finalOnlyLeaderboard} onChange={() => toggleSetting("finalOnlyLeaderboard")} label="Final-only visibility" />
          <Toggle
            checked={data.settings.allowProvisionalForStaff}
            onChange={() => toggleSetting("allowProvisionalForStaff")}
            label="Staff can view provisional"
          />
        </div>

        <div style={S.divider} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="default" onClick={exportAll} type="button">
            Export JSON
          </Button>
          <Button variant="default" onClick={() => fileInputRef.current?.click()} type="button">
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
              if (!res.ok) showToast("warn", res.error);
              else showToast("ok", "Imported.");
              e.target.value = "";
            }}
          />
          <Button variant="danger" onClick={resetDemo} type="button">
            Reset demo
          </Button>
        </div>

        <div style={{ ...S.muted, marginTop: 10 }}>
          Tip: to “go production”, you’ll remove DEFAULT_DATA and replace updateComp() calls with API calls (and hydrate state from backend).
        </div>
      </div>

      <div style={{ flex: "0 0 360px", ...S.card }}>
        <div style={{ fontWeight: 900 }}>Demo workflow script</div>
        <div style={{ ...S.muted, marginTop: 6 }}>
          1) Set role to Athlete, submit a score.
          <br />
          2) Set role to Judge, propose adjustment.
          <br />
          3) Set role to Head Judge, approve FINAL.
          <br />
          4) Set role to Spectator to see leaderboard changes.
          <br />
          5) Set role to Organiser to hide leaderboard / close submissions.
        </div>
      </div>
    </div>
  );

  /* ================================
     APP ROOT
  ================================ */
  return (
    <div style={S.page}>
      <div style={S.container}>
        <Header />
        <Tabs />

        {tab === "competition" ? <CompetitionPanel /> : null}
        {tab === "directory" ? <DirectoryPanel /> : null}
        {tab === "admin" ? <AdminPanel /> : null}
      </div>

      {workoutEditor ? (
        <WorkoutEditorModal
          editor={workoutEditor}
          onClose={() => setWorkoutEditor(null)}
          onSave={saveWorkout}
          divisions={compDivisions}
        />
      ) : null}

      <Toast />
    </div>
  );
}