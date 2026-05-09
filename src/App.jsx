import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Throwdown Hub — Single-file Demo App.jsx (Ranks Leaderboard + Role Workflows)
 *
 * Roles: athlete, judge, head_judge, organiser
 *
 * Key behaviour changes (per your request):
 * - Removed spectator + team_manager roles
 * - Athlete selects workout via dropdown; submit is a workout-specific popup modal
 * - Leaderboard is rank-based: 1 = best per workout; overall = lowest total rank wins
 * - Directory + Settings/Admin tabs only visible to organiser
 * - Judge + Head Judge have no leaderboard views
 * - Organiser controls quick controls, scheduling (release/close), publish leaderboard
 * - Workouts hidden from athletes until release time
 * - If a workout hasn't hit completion/close date, scores are blurred + excluded from totals
 * - Leaderboard only visible to athletes when organiser has published AND judging complete
 */

/* ================================
   LOCAL STORAGE
================================ */
const LS_KEY = "tdh_single_file_demo_v7_ranks";

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

function parseTimeToSeconds(v) {
  // Accept:
  // - number (seconds)
  // - "mm:ss"
  // - "hh:mm:ss"
  // - "ss" (string)
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;

  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);

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
const ROLES = ["athlete", "judge", "head_judge", "organiser"];

/* ================================
   DEFAULT DEMO DATA
================================ */
function defaultSchedule(hoursFromNowRelease, hoursDuration) {
  const now = new Date();
  const release = new Date(now.getTime() + hoursFromNowRelease * 3600 * 1000);
  const close = new Date(release.getTime() + hoursDuration * 3600 * 1000);
  return { releaseAt: release.toISOString(), closeAt: close.toISOString() };
}

const DEFAULT_DATA = (() => {
  const compId = "comp_london";
  const comp = {
    id: compId,
    name: "London Throwdown (Online Qualifier Demo)",
    date: "2026-06-20",
    location: "London",
    description:
      "Athletes submit scores, judges adjust, head judge finalises. Leaderboard is rank-based (1 best). Workouts release on schedule.",
    divisions: ["RX", "Scaled", "Intermediate", "Masters 35+"],
    judgePool: ["Judge Alex", "Judge Sam", "Judge Priya"],
    headJudgePool: ["Head Judge Casey"],
    workouts: [
      {
        id: "w1",
        name: "WOD 1 — Engine",
        divisionNotes: "All divisions",
        scoreType: "time",
        sort: "asc",
        unit: "time (mm:ss)",
        cap: "12:00",
        tiebreak: "Optional: split time after round 3",
        equipment: ["Row erg", "Wall ball", "Pull-up bar"],
        standards: ["Video must show full ROM", "Wall ball to target", "Chin over bar"],
        description:
          "For time: 30/24 cal row, 50 wall balls, 30 pull-ups. Time stops when last pull-up is complete.",
        media: { demoVideoUrl: "", scorecardUrl: "" },
        schedule: defaultSchedule(-8, 24), // already released, closes in 24h
        scalingByDivision: {
          Scaled: {
            equipment: ["Row erg", "Wall ball", "Pull-up bar / band"],
            standards: ["Jumping pull-ups allowed", "Wall ball lighter"],
            description:
              "For time: 24/18 cal row, 50 wall balls, 30 jumping pull-ups. Time stops when last rep is complete.",
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
        schedule: defaultSchedule(-6, 18),
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
        schedule: defaultSchedule(+6, 24), // not yet released (athletes can't see)
        scalingByDivision: {
          Scaled: {
            description:
              "8-min AMRAP: 60 single-unders, 12 step-ups, 9 Russian KB swings. Score = total reps.",
            standards: ["Step-ups allowed", "KB swing to shoulder height (Russian)"],
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
    submissions: {
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
      {
        id: "adj_seed_1",
        workoutId: "w1",
        participant: "Liam Patel",
        adjustedValue: "09:12",
        note: "No-rep on 5 pull-ups (reps redone). Added time.",
        judgeName: "Judge Alex",
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        status: "awaiting_head_judge",
        decidedAt: "",
        headJudgeName: "",
        rejectReason: "",
      },
    ],
    finalScores: {
      // workoutId -> participant -> final
      // w1: { "Ava Johnson": { value: "08:44", finalAt: "...", source: "submission", decidedBy: "Head Judge", note: "" } }
    },
    audit: [],
  };

  return {
    meta: { version: 7, createdAt: new Date().toISOString() },
    role: "athlete",
    ui: { tab: "competition", compId },
    settings: {
      submissionsClosed: false,
      leaderboardPublished: false, // athletes can only see leaderboard when true (and judging complete)
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
  tag: {
    display: "inline-flex",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    opacity: 0.95,
  },
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
  divider: { height: 1, background: "rgba(255,255,255,0.12)", margin: "10px 0" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  th: {
    textAlign: "left",
    fontSize: 12,
    opacity: 0.8,
    padding: "8px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    verticalAlign: "bottom",
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
    width: "min(860px, 96vw)",
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
  const isOrganiser = role === "organiser";
  const isJudge = role === "judge";
  const isHeadJudge = role === "head_judge";
  const nowMs = Date.now();

  const currentComp = useMemo(() => {
    const found = data.competitions.find((c) => c.id === data.ui.compId);
    return found || data.competitions[0];
  }, [data.competitions, data.ui.compId]);

  function showToast(type, msg) {
    setToast({ type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }

  function resetDemo() {
    window.localStorage.removeItem(LS_KEY);
    setData(DEFAULT_DATA);
  }

  function setRole(r) {
    setData((d) => ({ ...d, role: r }));
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
     Participants & divisions
  ---------------- */
  const participantList = useMemo(() => {
    if (!currentComp) return [];
    return (currentComp.athletes || []).map((a) => a.name);
  }, [currentComp]);

  const participantMeta = useMemo(() => {
    const map = new Map();
    (currentComp?.athletes || []).forEach((a) => map.set(a.name, { division: a.division || "" }));
    return map;
  }, [currentComp]);

  const compDivisions = useMemo(() => {
    const c = currentComp;
    if (!c) return [];
    const set = new Set();
    (c.divisions || []).forEach((d) => set.add(d));
    (c.athletes || []).forEach((a) => a.division && set.add(a.division));
    return Array.from(set);
  }, [currentComp]);

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
     Scheduling helpers
  ---------------- */
  function isReleased(w) {
    const t = w?.schedule?.releaseAt ? new Date(w.schedule.releaseAt).getTime() : null;
    if (!t) return true;
    return nowMs >= t;
  }

  function isClosed(w) {
    const t = w?.schedule?.closeAt ? new Date(w.schedule.closeAt).getTime() : null;
    if (!t) return false;
    return nowMs >= t;
  }

  function scheduleLabel(w) {
    const r = w?.schedule?.releaseAt;
    const c = w?.schedule?.closeAt;
    const relMs = r ? new Date(r).getTime() : null;
    const closeMs = c ? new Date(c).getTime() : null;

    if (relMs && nowMs < relMs) return `Releases ${prettyDateTime(r)}`;
    if (closeMs && nowMs < closeMs) return `Open (closes ${prettyDateTime(c)})`;
    if (closeMs && nowMs >= closeMs) return `Closed ${prettyDateTime(c)}`;
    return "Scheduled";
  }

  /* ================================
     Effective score (FINAL > pending adj > submission)
     BUT: leaderboard uses FINAL only
  ================================ */
  function getFinal(workoutId, participant) {
    return currentComp?.finalScores?.[workoutId]?.[participant] || null;
  }

  function getSubmission(workoutId, participant) {
    return currentComp?.submissions?.[workoutId]?.[participant] || null;
  }

  function getPendingAdjustment(workoutId, participant) {
    return (currentComp?.adjustments || []).find(
      (a) => a.workoutId === workoutId && a.participant === participant && a.status === "awaiting_head_judge"
    );
  }

  /* ================================
     Rank Leaderboard (1 best)
     - per workout: best = rank 1
     - overall: sum of ranks for CLOSED workouts only (completion reached)
     - workouts NOT CLOSED: blurred values for athletes, excluded from totals
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

  function computeRanksTable() {
    const c = currentComp;
    if (!c) return { rows: [], closedWorkoutIds: new Set(), perWorkout: {} };

    const workouts = c.workouts || [];
    const participants = (c.athletes || []).map((a) => ({ name: a.name, division: a.division || "" }));
    const N = participants.length;

    const closedWorkoutIds = new Set(workouts.filter((w) => isClosed(w)).map((w) => w.id));
    const perWorkout = {}; // workoutId -> { rankMap, valueMap }

    workouts.forEach((wBase) => {
      const asc = isAscForWorkout(wBase);
      const valueMap = new Map();
      const scored = [];

      participants.forEach((p) => {
        const final = getFinal(wBase.id, p.name);
        const val = final?.value ?? null;
        valueMap.set(p.name, val);

        const sortable = scoreToSortable(wBase, val);
        if (sortable != null) scored.push({ name: p.name, sortable });
      });

      scored.sort((a, b) => (asc ? a.sortable - b.sortable : b.sortable - a.sortable));

      const rankMap = new Map();
      let rank = 1;
      for (let i = 0; i < scored.length; i++) {
        if (i > 0 && scored[i].sortable !== scored[i - 1].sortable) rank = i + 1;
        rankMap.set(scored[i].name, rank);
      }

      perWorkout[wBase.id] = { rankMap, valueMap };
    });

    const rows = participants.map((p) => {
      let totalRank = 0;
      let counted = 0;
      const breakdown = workouts.map((w) => {
        const wk = perWorkout[w.id];
        const rank = wk?.rankMap?.get(p.name) ?? null; // null if no final
        const value = wk?.valueMap?.get(p.name) ?? null;
        const closed = closedWorkoutIds.has(w.id);

        // Penalty: if workout is CLOSED and missing final -> treat as worst rank (N + 1)
        const effectiveRank = closed ? (rank ?? N + 1) : null;

        if (closed && effectiveRank != null) {
          totalRank += effectiveRank;
          counted += 1;
        }

        return {
          workoutId: w.id,
          workoutName: w.name,
          closed,
          rank: rank,
          effectiveRank,
          value,
        };
      });

      return {
        name: p.name,
        division: p.division,
        totalRank,
        countedWorkouts: counted,
        breakdown,
      };
    });

    // Sort overall: lowest totalRank wins (only meaningful if countedWorkouts > 0)
    rows.sort((a, b) => {
      // if no workouts counted, keep alphabetical
      if (a.countedWorkouts === 0 && b.countedWorkouts === 0) return a.name.localeCompare(b.name);
      if (a.countedWorkouts === 0) return 1;
      if (b.countedWorkouts === 0) return -1;

      if (a.totalRank !== b.totalRank) return a.totalRank - b.totalRank;
      return a.name.localeCompare(b.name);
    });

    return { rows, closedWorkoutIds, perWorkout };
  }

  const ranksTable = useMemo(() => computeRanksTable(), [currentComp, nowMs]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ================================
     Publish gating: "judging completed"
     Interpretation implemented:
     - No pending adjustments anywhere
     - Every CLOSED workout has FINAL scores for every participant
  ================================ */
  const publishStatus = useMemo(() => {
    const c = currentComp;
    if (!c) return { canPublish: false, reasons: ["No competition loaded"] };

    const workouts = c.workouts || [];
    const participants = (c.athletes || []).map((a) => a.name);
    const closedWorkouts = workouts.filter((w) => isClosed(w));

    const pending = (c.adjustments || []).filter((a) => a.status === "awaiting_head_judge");
    const reasons = [];

    if (pending.length > 0) reasons.push(`Pending adjustments: ${pending.length}`);

    // For each closed workout, ensure finals exist for all participants
    let missingFinals = 0;
    for (const w of closedWorkouts) {
      for (const p of participants) {
        const f = c.finalScores?.[w.id]?.[p];
        if (!f || f.value == null || String(f.value).trim() === "") missingFinals += 1;
      }
    }
    if (closedWorkouts.length === 0) reasons.push("No workouts have reached completion/close date yet");
    if (missingFinals > 0) reasons.push(`Missing final scores on closed workouts: ${missingFinals}`);

    return { canPublish: reasons.length === 0, reasons };
  }, [currentComp, nowMs]);

  function setLeaderboardPublished(next) {
    if (next === true) {
      if (!publishStatus.canPublish) {
        showToast("warn", `Cannot publish yet: ${publishStatus.reasons[0] || "Judging incomplete"}`);
        return;
      }
      toggleSetting("leaderboardPublished");
      addAudit("Leaderboard published");
      showToast("ok", "Leaderboard published.");
    } else {
      toggleSetting("leaderboardPublished");
      addAudit("Leaderboard unpublished");
      showToast("ok", "Leaderboard unpublished.");
    }
  }

  /* ================================
     Athlete: workout dropdown + submit modal
  ================================ */
  const [athleteName, setAthleteName] = useState(() => participantList[0] || "");
  const [workoutPick, setWorkoutPick] = useState(() => currentComp?.workouts?.[0]?.id || "");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitDraft, setSubmitDraft] = useState({ value: "", videoUrl: "", notes: "" });
  const [athleteTab, setAthleteTab] = useState("workout"); // workout | leaderboard | my

  useEffect(() => {
    if (!participantList.includes(athleteName)) setAthleteName(participantList[0] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantList.join("\n")]);

  const athleteDivision = participantMeta.get(athleteName)?.division || "";

  const athleteVisibleWorkouts = useMemo(() => {
    const ws = currentComp?.workouts || [];
    // Athletes only see released workouts
    return ws.filter((w) => isReleased(w));
  }, [currentComp, nowMs]);

  useEffect(() => {
    const ids = athleteVisibleWorkouts.map((w) => w.id);
    if (!ids.includes(workoutPick)) setWorkoutPick(ids[0] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteVisibleWorkouts.map((w) => w.id).join("|")]);

  const selectedWorkoutBase = useMemo(() => {
    return (currentComp?.workouts || []).find((w) => w.id === workoutPick) || null;
  }, [currentComp, workoutPick]);

  const selectedWorkout = useMemo(() => {
    if (!selectedWorkoutBase) return null;
    return workoutForDivision(selectedWorkoutBase, athleteDivision);
  }, [selectedWorkoutBase, athleteDivision]);

  function canAthleteSubmitForWorkout(wBase) {
    if (!wBase) return { ok: false, reason: "No workout selected" };
    if (data.settings.submissionsClosed) return { ok: false, reason: "Submissions are closed" };
    if (!isReleased(wBase)) return { ok: false, reason: "Workout not released yet" };
    const closeAt = wBase?.schedule?.closeAt ? new Date(wBase.schedule.closeAt).getTime() : null;
    if (closeAt && nowMs > closeAt) return { ok: false, reason: "Workout has closed" };
    return { ok: true, reason: "" };
  }

  function openSubmitModal() {
    const gate = canAthleteSubmitForWorkout(selectedWorkoutBase);
    if (!gate.ok) return showToast("warn", gate.reason);
    setSubmitDraft({ value: "", videoUrl: "", notes: "" });
    setShowSubmitModal(true);
  }

  function submitScore() {
    const wBase = selectedWorkoutBase;
    if (!wBase) return;
    const gate = canAthleteSubmitForWorkout(wBase);
    if (!gate.ok) return showToast("warn", gate.reason);

    const value = String(submitDraft.value || "").trim();
    if (!value) return showToast("warn", "Enter a score value.");

    const division = athleteDivision;

    updateComp(currentComp.id, (c) => {
      c.submissions = c.submissions || {};
      c.submissions[wBase.id] = c.submissions[wBase.id] || {};
      c.submissions[wBase.id][athleteName] = {
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

    addAudit(`Submission: ${athleteName} -> ${wBase.name} = ${value}`);
    showToast("ok", "Score submitted.");
    setShowSubmitModal(false);
    setAthleteTab("my");
  }

  /* ================================
     Judge view (NO leaderboard option)
  ================================ */
  const [judgeName, setJudgeName] = useState(() => currentComp?.judgePool?.[0] || "Judge");
  const [judgeView, setJudgeView] = useState("review"); // review | sent
  const [judgeFilter, setJudgeFilter] = useState({ q: "", workoutId: "all", status: "submitted", division: "all" });
  const [adjustDraft, setAdjustDraft] = useState({ id: "", workoutId: "", participant: "", adjustedValue: "", note: "" });

  useEffect(() => setJudgeName(currentComp?.judgePool?.[0] || "Judge"), [data.ui.compId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        createdAt: new Date().toISOString(),
        status: "awaiting_head_judge",
        decidedAt: "",
        headJudgeName: "",
        rejectReason: "",
      });

      // mark submission as adjusted (proposed)
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
    setJudgeView("sent");
  }

  const judgeSent = useMemo(() => {
    return (currentComp?.adjustments || []).filter((a) => a.judgeName === judgeName);
  }, [currentComp, judgeName]);

  /* ================================
     Head Judge view (NO leaderboard option)
     - approve/reject adjustments
     - finalise submissions (accept as final, or override final)
  ================================ */
  const [headJudgeName, setHeadJudgeName] = useState(() => currentComp?.headJudgePool?.[0] || "Head Judge");
  const [headJudgeView, setHeadJudgeView] = useState("confirm"); // confirm | finalise | audit
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => setHeadJudgeName(currentComp?.headJudgePool?.[0] || "Head Judge"), [data.ui.compId]); // eslint-disable-line react-hooks/exhaustive-deps

  const awaitingAdjustments = useMemo(() => {
    return (currentComp?.adjustments || []).filter((a) => a.status === "awaiting_head_judge");
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

      // write final score (from adjustment)
      comp.finalScores = comp.finalScores || {};
      comp.finalScores[a.workoutId] = comp.finalScores[a.workoutId] || {};
      comp.finalScores[a.workoutId][a.participant] = {
        value: a.adjustedValue,
        finalAt: a.decidedAt,
        source: "adjustment",
        decidedBy: a.headJudgeName,
        note: a.note || "",
      };

      // mark submission final
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
    const reason = String(rejectNote || "").trim() || "Rejected";
    const adj = (c.adjustments || []).find((x) => x.id === adjId);
    if (!adj) return;

    updateComp(c.id, (comp) => {
      const a = (comp.adjustments || []).find((x) => x.id === adjId);
      if (!a) return comp;

      a.status = "rejected";
      a.decidedAt = new Date().toISOString();
      a.headJudgeName = headJudgeName || "Head Judge";
      a.rejectReason = reason;

      // revert submission status to submitted (still needs finalisation later)
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

  const [finaliseDraft, setFinaliseDraft] = useState({ workoutId: "", participant: "", value: "" });

  const nonFinalSubmissions = useMemo(() => {
    const c = currentComp;
    if (!c) return [];
    const rows = [];
    for (const w of c.workouts || []) {
      const per = c.submissions?.[w.id] || {};
      for (const [participant, s] of Object.entries(per)) {
        const f = c.finalScores?.[w.id]?.[participant];
        if (f && f.value != null && String(f.value).trim() !== "") continue;
        // if there's a pending adjustment, head judge should handle that in confirm view
        const pending = getPendingAdjustment(w.id, participant);
        if (pending) continue;

        rows.push({
          workoutId: w.id,
          workoutName: w.name,
          participant,
          division: s.division || participantMeta.get(participant)?.division || "",
          submittedValue: s.value,
          submittedAt: s.submittedAt,
          status: s.status || "submitted",
          judgeNote: s.judgeNote || "",
        });
      }
    }
    rows.sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
    return rows;
  }, [currentComp, participantMeta]);

  function acceptAsFinal(row) {
    const c = currentComp;
    if (!c) return;
    updateComp(c.id, (comp) => {
      comp.finalScores = comp.finalScores || {};
      comp.finalScores[row.workoutId] = comp.finalScores[row.workoutId] || {};
      comp.finalScores[row.workoutId][row.participant] = {
        value: row.submittedValue,
        finalAt: new Date().toISOString(),
        source: "submission",
        decidedBy: headJudgeName || "Head Judge",
        note: "",
      };
      // mark submission final
      comp.submissions = comp.submissions || {};
      comp.submissions[row.workoutId] = comp.submissions[row.workoutId] || {};
      if (comp.submissions[row.workoutId][row.participant]) {
        comp.submissions[row.workoutId][row.participant].status = "final";
      }
      return comp;
    });

    addAudit(`FINAL accepted: ${row.participant} -> ${row.workoutId} = ${row.submittedValue}`);
    showToast("ok", "Accepted as final.");
  }

  function startOverrideFinal(row) {
    setFinaliseDraft({ workoutId: row.workoutId, participant: row.participant, value: String(row.submittedValue ?? "") });
  }

  function saveOverrideFinal() {
    const c = currentComp;
    if (!c) return;
    const value = String(finaliseDraft.value || "").trim();
    if (!finaliseDraft.workoutId || !finaliseDraft.participant) return;
    if (!value) return showToast("warn", "Final value required.");

    updateComp(c.id, (comp) => {
      comp.finalScores = comp.finalScores || {};
      comp.finalScores[finaliseDraft.workoutId] = comp.finalScores[finaliseDraft.workoutId] || {};
      comp.finalScores[finaliseDraft.workoutId][finaliseDraft.participant] = {
        value,
        finalAt: new Date().toISOString(),
        source: "override",
        decidedBy: headJudgeName || "Head Judge",
        note: "Head Judge override",
      };
      comp.submissions = comp.submissions || {};
      comp.submissions[finaliseDraft.workoutId] = comp.submissions[finaliseDraft.workoutId] || {};
      if (comp.submissions[finaliseDraft.workoutId][finaliseDraft.participant]) {
        comp.submissions[finaliseDraft.workoutId][finaliseDraft.participant].status = "final";
      }
      return comp;
    });

    addAudit(`FINAL override: ${finaliseDraft.participant} -> ${finaliseDraft.workoutId} = ${value}`);
    showToast("ok", "Final override saved.");
    setFinaliseDraft({ workoutId: "", participant: "", value: "" });
  }

  /* ================================
     Organiser: tabs, quick controls, scheduling, publish
  ================================ */
  const tab = data.ui.tab;

  const canSeeDirectory = isOrganiser;
  const canSeeAdmin = isOrganiser;

  /* ================================
     Header / Tabs
  ================================ */
  const Header = () => (
    <div style={S.headerRow}>
      <div>
        <div style={S.title}>Throwdown Hub — Demo (Ranks Leaderboard)</div>
        <div style={S.subTitle}>
          Athlete workout dropdown + submit popup. Judge adjusts. Head Judge finalises. Organiser schedules release/close and publishes leaderboard.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
        <div style={S.pill}>
          <strong>Role</strong>
          <Select value={role} onChange={setRole} options={ROLES} style={{ width: 170 }} />
        </div>

        <div style={S.pill}>
          <strong>Competition</strong>
          <Select
            value={data.ui.compId}
            onChange={setCompId}
            options={(data.competitions || []).map((c) => ({ value: c.id, label: c.name }))}
            style={{ width: 280 }}
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

      {canSeeDirectory ? (
        <Button variant={tab === "directory" ? "primary" : "default"} onClick={() => setTab("directory")} type="button">
          Directory
        </Button>
      ) : null}

      {canSeeAdmin ? (
        <Button variant={tab === "admin" ? "primary" : "default"} onClick={() => setTab("admin")} type="button">
          Settings / Admin
        </Button>
      ) : null}
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
          maxWidth: 460,
          zIndex: 1000,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: 0.2 }}>{toast.type === "ok" ? "Done" : "Note"}</div>
        <div style={{ marginTop: 4, fontSize: 13 }}>{toast.msg}</div>
      </div>
    ) : null;

  /* ================================
     Directory (organiser only)
  ================================ */
  const DirectoryPanel = () => {
    const evt = data.directory.events?.[0];
    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Events Directory</div>
          <div style={{ ...S.muted, marginTop: 6 }}>Organiser-only directory view (placeholder).</div>
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
          <div style={{ fontWeight: 900 }}>Organiser notes</div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            This tab is organiser-only per your requirement.
            <br />
            Later: replace with your full directory/search/filters.
          </div>
        </div>
      </div>
    );
  };

  /* ================================
     Leaderboard Panel (rank-based, blurred future workouts)
  ================================ */
  function LeaderboardPanel({ viewerRole }) {
    const workouts = currentComp?.workouts || [];
    const showToAthlete = viewerRole === "athlete";

    // Athletes only see when organiser has published
    if (showToAthlete && !data.settings.leaderboardPublished) {
      return (
        <div style={{ ...S.card, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>Leaderboard not published</div>
          <div style={{ ...S.muted, marginTop: 6 }}>The organiser will publish the leaderboard once judging is complete.</div>
        </div>
      );
    }

    // If no workouts closed, still show structure (but totals will be 0 / not meaningful)
    const rows = ranksTable.rows;

    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Leaderboard (Ranks)</div>
            <div style={{ ...S.muted, marginTop: 4 }}>
              Rank 1 = best score for that workout. Overall = sum of ranks for <strong>closed</strong> workouts only (lower total wins).
              Workouts not yet closed are blurred and excluded from totals.
            </div>
          </div>

          <div style={S.pill}>
            <strong>Published</strong>
            <span style={{ opacity: 0.9 }}>{data.settings.leaderboardPublished ? "Yes" : "No"}</span>
          </div>
        </div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Overall</th>
                <th style={S.th}>Athlete</th>
                <th style={S.th}>Division</th>
                <th style={S.th}>
                  Total rank
                  <div style={S.muted}>Closed workouts only</div>
                </th>
                {workouts.map((w) => (
                  <th key={w.id} style={S.th}>
                    {w.name}
                    <div style={S.muted}>{isClosed(w) ? "Closed (counted)" : "Not closed (excluded)"}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.name}>
                  <td style={S.td}>
                    <span style={S.tag}>{idx + 1}</span>
                  </td>
                  <td style={S.td}>
                    <div style={{ fontWeight: 900 }}>{r.name}</div>
                  </td>
                  <td style={S.td}>{r.division || "—"}</td>
                  <td style={S.td}>
                    <span style={S.tag}>{r.countedWorkouts > 0 ? r.totalRank : "—"}</span>
                    <div style={S.muted}>{r.countedWorkouts} counted</div>
                  </td>

                  {r.breakdown.map((b) => {
                    const blur = !b.closed && viewerRole === "athlete";
                    const displayRank = b.closed ? (b.effectiveRank ?? "—") : "—";
                    const displayValue = b.closed
                      ? b.value ?? "—"
                      : viewerRole === "organiser"
                      ? b.value ?? "—"
                      : "•••";

                    return (
                      <td key={b.workoutId} style={S.td}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={S.tag}>Rank: {displayRank}</span>
                          <div
                            style={{
                              ...S.muted,
                              filter: blur ? "blur(4px)" : "none",
                              userSelect: blur ? "none" : "text",
                            }}
                          >
                            {displayValue}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td style={S.td} colSpan={4 + workouts.length}>
                    <div style={S.muted}>No athletes loaded.</div>
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
     Athlete Panel
  ================================ */
  function AthletePanel() {
    const wBase = selectedWorkoutBase;
    const w = selectedWorkout;

    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Athlete</div>
              <div style={{ ...S.muted, marginTop: 4 }}>
                Select a workout from the dropdown. Submit score via popup. Workouts are hidden until release.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Field label="Athlete" style={{ width: 240 }}>
                <Select value={athleteName} onChange={setAthleteName} options={participantList.length ? participantList : ["—"]} />
              </Field>
              <div style={S.pill}>
                <strong>Division</strong>
                <span style={{ opacity: 0.9 }}>{athleteDivision || "—"}</span>
              </div>
            </div>
          </div>

          <div style={S.divider} />

          <div style={{ ...S.row, marginBottom: 10 }}>
            <Button variant={athleteTab === "workout" ? "primary" : "default"} onClick={() => setAthleteTab("workout")} type="button">
              Workout
            </Button>
            <Button variant={athleteTab === "my" ? "primary" : "default"} onClick={() => setAthleteTab("my")} type="button">
              My Submissions
            </Button>
            <Button
              variant={athleteTab === "leaderboard" ? "primary" : "default"}
              onClick={() => setAthleteTab("leaderboard")}
              type="button"
            >
              Leaderboard
            </Button>
          </div>

          {athleteTab === "workout" ? (
            <div>
              <Field label="Workout">
                <Select
                  value={workoutPick}
                  onChange={setWorkoutPick}
                  options={
                    athleteVisibleWorkouts.length
                      ? athleteVisibleWorkouts.map((x) => ({ value: x.id, label: `${x.name} — ${scheduleLabel(x)}` }))
                      : [{ value: "", label: "No workouts released yet" }]
                  }
                />
              </Field>

              <div style={S.divider} />

              {!wBase ? (
                <div style={S.muted}>No workout selected.</div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{w?.name || wBase.name}</div>
                      <div style={{ ...S.muted, marginTop: 4 }}>
                        {w?.scoreType || wBase.scoreType} • {w?.unit || wBase.unit || "—"} • cap {w?.cap || wBase.cap || "—"} •{" "}
                        {scheduleLabel(wBase)}
                      </div>
                      {wBase?.tiebreak ? <div style={{ ...S.muted, marginTop: 6 }}>Tiebreak: {wBase.tiebreak}</div> : null}
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Button variant="primary" onClick={openSubmitModal} type="button">
                        Submit score
                      </Button>
                      <div style={S.tag}>{data.settings.submissionsClosed ? "Submissions closed" : "Submissions open"}</div>
                    </div>
                  </div>

                  <div style={S.divider} />

                  <div style={{ whiteSpace: "pre-wrap" }}>{w?.description || wBase.description || "No description."}</div>

                  {(w?.equipment || []).length ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>Equipment</div>
                      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(w.equipment || []).map((x, i) => (
                          <span key={`${x}_${i}`} style={S.tag}>
                            {x}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(w?.standards || []).length ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>Standards</div>
                      <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18 }}>
                        {(w.standards || []).map((x, i) => (
                          <li key={`${x}_${i}`} style={{ ...S.muted, marginBottom: 4 }}>
                            {x}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={{ marginTop: 12, ...S.card, padding: 12 }}>
                    <div style={{ fontWeight: 900 }}>Your status for this workout</div>
                    <div style={{ ...S.muted, marginTop: 6 }}>
                      Submitted: {getSubmission(wBase.id, athleteName)?.value ?? "—"} • Final: {getFinal(wBase.id, athleteName)?.value ?? "—"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {athleteTab === "my" ? <MySubmissionsPanel /> : null}
          {athleteTab === "leaderboard" ? <LeaderboardPanel viewerRole="athlete" /> : null}
        </div>

        <div style={{ flex: "0 0 360px", ...S.card }}>
          <div style={{ fontWeight: 900 }}>Release schedule</div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            Athletes only see workouts once released. Workouts not yet released are hidden.
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {(currentComp.workouts || []).map((w) => (
                <div key={w.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontWeight: 800 }}>{w.name}</span>
                  <span style={S.tag}>{scheduleLabel(w)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showSubmitModal ? (
          <SubmitModal
            workoutBase={selectedWorkoutBase}
            workout={selectedWorkout}
            athlete={athleteName}
            division={athleteDivision}
            draft={submitDraft}
            setDraft={setSubmitDraft}
            onClose={() => setShowSubmitModal(false)}
            onSubmit={submitScore}
          />
        ) : null}
      </div>
    );
  }

  function SubmitModal({ workoutBase, workout, athlete, division, draft, setDraft, onClose, onSubmit }) {
    const gate = canAthleteSubmitForWorkout(workoutBase);
    return (
      <div style={S.modalBackdrop} onMouseDown={onClose}>
        <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Submit score</div>
              <div style={{ ...S.muted, marginTop: 4 }}>
                {athlete} • {division || "—"} • {(workout?.name || workoutBase?.name) ?? "Workout"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="default" onClick={onClose} type="button">
                Close
              </Button>
              <Button variant="primary" onClick={onSubmit} type="button" disabled={!gate.ok} style={!gate.ok ? { opacity: 0.6 } : null}>
                Submit
              </Button>
            </div>
          </div>

          <div style={S.divider} />

          {!gate.ok ? (
            <div style={{ ...S.card, padding: 12 }}>
              <div style={{ fontWeight: 900 }}>Submission blocked</div>
              <div style={{ ...S.muted, marginTop: 6 }}>{gate.reason}</div>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <Field label="Score value">
              <input
                style={S.input}
                value={draft.value}
                onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                placeholder={workoutBase?.scoreType === "time" ? "e.g. 08:44" : "e.g. 110"}
              />
              <div style={{ ...S.muted, marginTop: 6 }}>
                Type: <strong>{workoutBase?.scoreType}</strong> • Unit: <strong>{workout?.unit || workoutBase?.unit || "—"}</strong>
              </div>
            </Field>

            <Field label="Video URL (optional)">
              <input
                style={S.input}
                value={draft.videoUrl}
                onChange={(e) => setDraft((d) => ({ ...d, videoUrl: e.target.value }))}
                placeholder="Paste a link"
              />
            </Field>

            <Field label="Notes (optional)" style={{ gridColumn: "1 / -1" }}>
              <textarea
                style={{ ...S.input, minHeight: 100, resize: "vertical" }}
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Anything the judge should know..."
              />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  function MySubmissionsPanel() {
    const c = currentComp;
    const rows = (c.workouts || [])
      .filter((w) => isReleased(w)) // athlete can only see released workouts
      .map((w) => {
        const sub = c.submissions?.[w.id]?.[athleteName];
        const fin = c.finalScores?.[w.id]?.[athleteName];
        const pending = getPendingAdjustment(w.id, athleteName);
        return {
          workoutId: w.id,
          workoutName: w.name,
          submittedAt: sub?.submittedAt || "",
          submittedValue: sub?.value ?? null,
          status: sub?.status || "none",
          finalValue: fin?.value ?? null,
          pending: pending ? "awaiting_head_judge" : "",
          judgeNote: sub?.judgeNote || "",
        };
      });

    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>My Submissions</div>
        <div style={{ ...S.muted, marginTop: 6 }}>Shows your submitted and final score status for released workouts.</div>

        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Workout</th>
                <th style={S.th}>Submitted</th>
                <th style={S.th}>Submitted at</th>
                <th style={S.th}>Final</th>
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
                  <td style={S.td}>
                    <span style={S.tag}>{r.finalValue ?? "—"}</span>
                  </td>
                  <td style={S.td}>
                    <span style={S.tag}>{r.finalValue != null ? "final" : r.pending || r.status}</span>
                  </td>
                  <td style={S.td}>
                    <div style={S.muted}>{r.judgeNote || "—"}</div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td style={S.td} colSpan={6}>
                    <div style={S.muted}>No released workouts yet.</div>
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
     Judge Panel
  ================================ */
  function JudgePanel() {
    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Judge</div>
              <div style={{ ...S.muted, marginTop: 4 }}>Review submissions and propose adjustments (no leaderboard view for judge).</div>
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
            <Button variant={judgeView === "sent" ? "primary" : "default"} onClick={() => setJudgeView("sent")} type="button">
              Adjustments Sent ({judgeSent.length})
            </Button>
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
                      <th style={S.th}>Athlete</th>
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
                  <div style={{ ...S.muted, marginTop: 6 }}>Sends to Head Judge. Final scores are set only by Head Judge.</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                    <Field label="Athlete">
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

          {judgeView === "sent" ? (
            <div style={{ ...S.card, padding: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Adjustments sent</div>
              <div style={{ ...S.muted, marginTop: 6 }}>Track what you proposed and its current status.</div>

              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Created</th>
                      <th style={S.th}>Athlete</th>
                      <th style={S.th}>Workout</th>
                      <th style={S.th}>Adjusted value</th>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {judgeSent.map((a) => (
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
                    {judgeSent.length === 0 ? (
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
        </div>

        <div style={{ flex: "0 0 360px", ...S.card }}>
          <div style={{ fontWeight: 900 }}>Judge reminders</div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            • Propose adjustments where needed
            <br />• Head Judge finalises all scores
            <br />• Leaderboard is organiser-controlled and publish-gated
          </div>
        </div>
      </div>
    );
  }

  /* ================================
     Head Judge Panel
  ================================ */
  function HeadJudgePanel() {
    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Head Judge</div>
              <div style={{ ...S.muted, marginTop: 4 }}>
                Approve/reject adjustments and finalise submissions. (No leaderboard view for Head Judge.)
              </div>
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
            <Button variant={headJudgeView === "finalise" ? "primary" : "default"} onClick={() => setHeadJudgeView("finalise")} type="button">
              Finalise Submissions ({nonFinalSubmissions.length})
            </Button>
            <Button variant={headJudgeView === "audit" ? "primary" : "default"} onClick={() => setHeadJudgeView("audit")} type="button">
              Audit
            </Button>
          </div>

          {headJudgeView === "confirm" ? (
            <div style={{ ...S.card, padding: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Awaiting confirmation</div>
              <div style={{ ...S.muted, marginTop: 6 }}>Approve to set final. Reject to return to submitted.</div>

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
                    <div style={{ ...S.muted, marginTop: 6 }}>Use “Finalise Submissions” to mark remaining scores as final.</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {headJudgeView === "finalise" ? (
            <div style={{ ...S.card, padding: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>Finalise remaining submissions</div>
              <div style={{ ...S.muted, marginTop: 6 }}>
                These are submissions with no final score and no pending adjustment. You can accept as-is, or override the final value.
              </div>

              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Submitted at</th>
                      <th style={S.th}>Athlete</th>
                      <th style={S.th}>Division</th>
                      <th style={S.th}>Workout</th>
                      <th style={S.th}>Submitted</th>
                      <th style={S.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nonFinalSubmissions.map((r) => (
                      <tr key={`${r.workoutId}_${r.participant}`}>
                        <td style={S.td}>{r.submittedAt ? prettyDateTime(r.submittedAt) : "—"}</td>
                        <td style={S.td}>{r.participant}</td>
                        <td style={S.td}>{r.division || "—"}</td>
                        <td style={S.td}>{r.workoutName}</td>
                        <td style={S.td}>
                          <span style={S.tag}>{r.submittedValue ?? "—"}</span>
                        </td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Button variant="primary" onClick={() => acceptAsFinal(r)} type="button">
                              Accept as final
                            </Button>
                            <Button variant="default" onClick={() => startOverrideFinal(r)} type="button">
                              Override final
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {nonFinalSubmissions.length === 0 ? (
                      <tr>
                        <td style={S.td} colSpan={6}>
                          <div style={S.muted}>No remaining submissions to finalise.</div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {finaliseDraft.workoutId ? (
                <div style={{ ...S.card, padding: 12, marginTop: 12 }}>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>Override final score</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>
                    {finaliseDraft.participant} •{" "}
                    {(currentComp.workouts || []).find((w) => w.id === finaliseDraft.workoutId)?.name || finaliseDraft.workoutId}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                    <Field label="Final value">
                      <input
                        style={S.input}
                        value={finaliseDraft.value}
                        onChange={(e) => setFinaliseDraft((d) => ({ ...d, value: e.target.value }))}
                        placeholder="Enter final value"
                      />
                    </Field>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <Button variant="primary" onClick={saveOverrideFinal} type="button">
                      Save final override
                    </Button>
                    <Button variant="default" onClick={() => setFinaliseDraft({ workoutId: "", participant: "", value: "" })} type="button">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {headJudgeView === "audit" ? <AuditPanel /> : null}
        </div>

        <div style={{ flex: "0 0 360px", ...S.card }}>
          <div style={{ fontWeight: 900 }}>Head Judge publish checklist</div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            Publish requires:
            <br />• 0 pending adjustments
            <br />• All closed workouts have final scores for all athletes
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={S.tag}>{publishStatus.canPublish ? "Ready to publish" : "Not ready"}</div>
            {!publishStatus.canPublish ? (
              <div style={{ ...S.muted, marginTop: 8 }}>
                {publishStatus.reasons.map((r, i) => (
                  <div key={i}>• {r}</div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  function AuditPanel() {
    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 900 }}>Audit log</div>
        <div style={{ ...S.muted, marginTop: 6 }}>Key actions: submissions, adjustments, finals, publish, schedule edits.</div>

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
              <div style={{ ...S.muted, marginTop: 6 }}>Run submissions, adjustments, finals, schedule edits, publish to populate.</div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  /* ================================
     Organiser Panel
  ================================ */
  function OrganiserPanel() {
    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Organiser</div>
              <div style={{ ...S.muted, marginTop: 4 }}>
                You alone have: Quick Controls, Directory, Settings/Admin, release/close scheduling, and leaderboard publishing.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={S.tag}>{data.settings.leaderboardPublished ? "Leaderboard: Published" : "Leaderboard: Unpublished"}</div>
              <div style={S.tag}>{publishStatus.canPublish ? "Judging complete" : "Judging incomplete"}</div>
            </div>
          </div>

          <div style={S.divider} />

          <div style={{ ...S.card, padding: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Quick Controls</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              <Toggle
                checked={data.settings.submissionsClosed}
                onChange={() => {
                  toggleSetting("submissionsClosed");
                  addAudit(`Submissions ${!data.settings.submissionsClosed ? "closed" : "opened"}`);
                }}
                label="Close submissions"
                hint="Stops athletes submitting new scores."
              />

              <Toggle
                checked={data.settings.leaderboardPublished}
                onChange={(next) => setLeaderboardPublished(next)}
                label="Publish leaderboard"
                hint={
                  publishStatus.canPublish
                    ? "Judging complete. Publishing will reveal leaderboard to athletes (future workouts still blurred/excluded)."
                    : `Cannot publish yet: ${publishStatus.reasons[0] || "Judging incomplete"}`
                }
              />
            </div>
          </div>

          <div style={S.divider} />

          <SchedulePanel />

          <div style={S.divider} />

          <LeaderboardPanel viewerRole="organiser" />
        </div>

        <div style={{ flex: "0 0 360px", ...S.card }}>
          <div style={{ fontWeight: 900 }}>Organiser tools</div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            • Directory + Settings/Admin tabs appear only for organiser
            <br />• Set release/close per workout below
            <br />• Publish leaderboard only when judging complete
          </div>
        </div>
      </div>
    );
  }

  function SchedulePanel() {
    return (
      <div style={{ ...S.card, padding: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 900 }}>Workout scheduling (Release + Close)</div>
        <div style={{ ...S.muted, marginTop: 6 }}>
          Athletes cannot see workouts until Release. A workout is “counted” on the leaderboard only once it has reached Close/Completion.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {(currentComp.workouts || []).map((w) => (
            <div key={w.id} style={{ ...S.card, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>{w.name}</div>
                <div style={S.tag}>{scheduleLabel(w)}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                <Field label="Release (visible to athletes)">
                  <input
                    style={S.input}
                    type="datetime-local"
                    value={isoToLocalInput(w.schedule?.releaseAt)}
                    onChange={(e) => {
                      const iso = localInputToIso(e.target.value);
                      updateComp(currentComp.id, (c) => {
                        const ww = (c.workouts || []).find((x) => x.id === w.id);
                        if (!ww) return c;
                        ww.schedule = ww.schedule || {};
                        ww.schedule.releaseAt = iso;
                        return c;
                      });
                      addAudit(`Schedule changed: ${w.id} releaseAt`);
                    }}
                  />
                </Field>

                <Field label="Close/Completion (counted on leaderboard after this)">
                  <input
                    style={S.input}
                    type="datetime-local"
                    value={isoToLocalInput(w.schedule?.closeAt)}
                    onChange={(e) => {
                      const iso = localInputToIso(e.target.value);
                      updateComp(currentComp.id, (c) => {
                        const ww = (c.workouts || []).find((x) => x.id === w.id);
                        if (!ww) return c;
                        ww.schedule = ww.schedule || {};
                        ww.schedule.closeAt = iso;
                        return c;
                      });
                      addAudit(`Schedule changed: ${w.id} closeAt`);
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
     Settings / Admin (organiser only)
  ================================ */
  const AdminPanel = () => (
    <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
      <div style={{ flex: "1 1 760px", ...S.card }}>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Settings / Admin (Organiser only)</div>
        <div style={{ ...S.muted, marginTop: 6 }}>Export/import demo JSON, reset storage.</div>

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
          Publish is gated by judging completeness (no pending adjustments, and final scores exist for all athletes on closed workouts).
        </div>
      </div>

      <div style={{ flex: "0 0 360px", ...S.card }}>
        <div style={{ fontWeight: 900 }}>Publish readiness</div>
        <div style={{ marginTop: 10 }}>
          <div style={S.tag}>{publishStatus.canPublish ? "Ready to publish" : "Not ready"}</div>
          {!publishStatus.canPublish ? (
            <div style={{ ...S.muted, marginTop: 8 }}>
              {publishStatus.reasons.map((r, i) => (
                <div key={i}>• {r}</div>
              ))}
            </div>
          ) : (
            <div style={{ ...S.muted, marginTop: 8 }}>You can publish from the organiser quick controls on the Competition tab.</div>
          )}
        </div>
      </div>
    </div>
  );

  /* ================================
     Competition Panel root
  ================================ */
  const CompetitionPanel = () => {
    if (!currentComp) return <div style={{ ...S.card, marginTop: 14 }}>No competition selected.</div>;

    return (
      <div style={{ ...S.card, marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 950 }}>{currentComp.name}</div>
            <div style={{ ...S.muted, marginTop: 4 }}>
              {prettyDate(currentComp.date)} • {currentComp.location}
            </div>
            <div style={{ ...S.muted, marginTop: 6 }}>{currentComp.description}</div>
          </div>

          {isOrganiser ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={S.tag}>{data.settings.submissionsClosed ? "Submissions: Closed" : "Submissions: Open"}</div>
              <div style={S.tag}>{data.settings.leaderboardPublished ? "Leaderboard: Published" : "Leaderboard: Unpublished"}</div>
            </div>
          ) : null}
        </div>

        {role === "athlete" ? <AthletePanel /> : null}
        {role === "judge" ? <JudgePanel /> : null}
        {role === "head_judge" ? <HeadJudgePanel /> : null}
        {role === "organiser" ? <OrganiserPanel /> : null}
      </div>
    );
  };

  /* ================================
     APP ROOT
  ================================ */
  return (
    <div style={S.page}>
      <div style={S.container}>
        <Header />
        <Tabs />

        {tab === "competition" ? <CompetitionPanel /> : null}
        {tab === "directory" && isOrganiser ? <DirectoryPanel /> : null}
        {tab === "admin" && isOrganiser ? <AdminPanel /> : null}
      </div>

      <Toast />
    </div>
  );
}
``

'*/'
