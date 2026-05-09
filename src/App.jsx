import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Throwdown Hub — Single-file Demo App.jsx
 * Roles: athlete, judge, head_judge, organiser
 *
 * Implemented per your request:
 * - Athlete: video REQUIRED for every qualifier submission (no optional copy)
 * - Judge: adjustment note REQUIRED (no optional copy)
 * - Judge: added "Confirm score" option (review without adjustment)
 * - Organiser: added "Create New Event" (online qualifier OR live/in-person)
 * - Live event workflow:
 *    - organiser creates LIVE event and adds workouts + athletes
 *    - Head Judge enters scores for EVERY athlete for a workout, incl. scorecard image URL
 *    - leaderboard counts a live workout only once ALL athlete scores are entered for that workout
 */

const LS_KEY = "tdh_single_file_demo_v8";

const ROLES = ["athlete", "judge", "head_judge", "organiser"];

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

function defaultSchedule(hoursFromNowRelease, hoursDuration) {
  const now = new Date();
  const release = new Date(now.getTime() + hoursFromNowRelease * 3600 * 1000);
  const close = new Date(release.getTime() + hoursDuration * 3600 * 1000);
  return { releaseAt: release.toISOString(), closeAt: close.toISOString() };
}

const DEFAULT_DATA = (() => {
  const compOnlineId = "comp_london_online";
  const compLiveId = "comp_london_live";

  const onlineComp = {
    id: compOnlineId,
    type: "online", // online qualifier
    name: "London Throwdown (Online Qualifier Demo)",
    date: "2026-06-20",
    location: "London",
    description:
      "Athletes submit scores WITH VIDEO, judges review/confirm or adjust, Head Judge finalises. Leaderboard is rank-based (1 best).",
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
        schedule: defaultSchedule(-8, 24), // already released
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
        schedule: defaultSchedule(+6, 24), // not yet released
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
          videoUrl: "https://example.com/video/ava-w1",
          notes: "All reps shown",
          submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
          status: "submitted", // submitted | confirmed | final
          division: "RX",
          judgeNote: "",
          confirmedBy: "",
          confirmedAt: "",
        },
        "Liam Patel": {
          value: "09:02",
          videoUrl: "https://example.com/video/liam-w1",
          notes: "",
          submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
          status: "submitted",
          division: "RX",
          judgeNote: "",
          confirmedBy: "",
          confirmedAt: "",
        },
        "Mia Brown": {
          value: "10:35",
          videoUrl: "https://example.com/video/mia-w1",
          notes: "Scaled",
          submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
          status: "submitted",
          division: "Scaled",
          judgeNote: "",
          confirmedBy: "",
          confirmedAt: "",
        },
      },
      w2: {
        "Ava Johnson": {
          value: "92.5",
          videoUrl: "https://example.com/video/ava-w2",
          notes: "",
          submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
          status: "submitted",
          division: "RX",
          judgeNote: "",
          confirmedBy: "",
          confirmedAt: "",
        },
        "Noah Smith": {
          value: "110",
          videoUrl: "https://example.com/video/noah-w2",
          notes: "Felt heavy",
          submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          status: "submitted",
          division: "Intermediate",
          judgeNote: "",
          confirmedBy: "",
          confirmedAt: "",
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
    finalScores: {},
    audit: [],
  };

  // Live / in-person demo competition (Head Judge enters scores + scorecard image URL)
  const liveComp = {
    id: compLiveId,
    type: "live",
    name: "Edinburgh Summer Throwdown (LIVE Demo)",
    date: "2026-07-12",
    location: "Edinburgh",
    description:
      "LIVE in-person event: athletes do NOT submit videos. Head Judge inputs scores for each athlete per workout, including scorecard image URLs.",
    divisions: ["RX", "Scaled"],
    judgePool: ["Judge Flo", "Judge Ben"],
    headJudgePool: ["Head Judge Morgan"],
    workouts: [
      {
        id: "lw1",
        name: "LIVE WOD 1 — Floor & Bar",
        divisionNotes: "All divisions",
        scoreType: "reps",
        sort: "desc",
        unit: "reps",
        cap: "12:00",
        tiebreak: "Tie-break = time to finish last round",
        equipment: ["Barbell", "Plates", "Mat"],
        standards: ["Standards briefed on the floor by Head Judge"],
        description: "12-min AMRAP: 10 deadlifts, 10 burpees over bar.",
        media: { demoVideoUrl: "", scorecardUrl: "" },
        schedule: defaultSchedule(-1, 6),
        scalingByDivision: {},
      },
      {
        id: "lw2",
        name: "LIVE WOD 2 — Sprint",
        divisionNotes: "All divisions",
        scoreType: "time",
        sort: "asc",
        unit: "time (mm:ss)",
        cap: "06:00",
        tiebreak: "None",
        equipment: ["Assault bike", "Box"],
        standards: ["Standards briefed on the floor by Head Judge"],
        description: "For time: 30 cal bike + 30 box jump overs.",
        media: { demoVideoUrl: "", scorecardUrl: "" },
        schedule: defaultSchedule(+2, 6),
        scalingByDivision: {},
      },
    ],
    athletes: [
      { name: "Ruby King", division: "RX" },
      { name: "Charlie Ward", division: "RX" },
      { name: "Sophie Lane", division: "Scaled" },
      { name: "Harry Cole", division: "Scaled" },
    ],
    submissions: {}, // not used for live
    adjustments: [], // optional for live
    finalScores: {
      // structure: { [workoutId]: { [participant]: { value, finalAt, source, decidedBy, note, scorecardImageUrl } } }
    },
    audit: [],
  };

  return {
    meta: { version: 8, createdAt: new Date().toISOString() },
    role: "athlete",
    ui: { tab: "competition", compId: compOnlineId },
    settings: {
      submissionsClosed: false,
      leaderboardPublished: false,
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
    competitions: [onlineComp, liveComp],
  };
})();

/* ================================
STYLES (inline)
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
  subTitle: { fontSize: 12, opacity: 0.82, marginTop: 2, lineHeight: 1.35 },
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
    width: "min(920px, 96vw)",
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
      <div style={{ fontWeight: 900, fontSize: 13 }}>
        {label}
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

  // Import / Export
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

  // Participants & divisions
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

  // Scheduling helpers (used mainly for online)
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

    const relText = relMs ? prettyDateTime(r) : "—";
    const closeText = closeMs ? prettyDateTime(c) : "—";
    const relState = relMs ? (nowMs >= relMs ? "Released" : "Not released") : "Always released";
    const closeState = closeMs ? (nowMs >= closeMs ? "Closed" : "Open") : "No close time";
    return `${relState} (${relText}) • ${closeState} (${closeText})`;
  }

  // Score accessors
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

  // Completion rules:
  // - ONLINE: workout counts on leaderboard only if CLOSED AND has FINAL for every participant
  // - LIVE: workout counts only if FINAL for every participant AND each final has scorecardImageUrl
  function workoutIsCompleteForLeaderboard(w) {
    const c = currentComp;
    if (!c) return false;
    const all = participantList;
    const finals = c.finalScores?.[w.id] || {};
    const hasAllFinals = all.every((p) => {
      const f = finals?.[p];
      return f && f.value != null && String(f.value).trim() !== "";
    });
    if (!hasAllFinals) return false;

    if (c.type === "online") {
      return isClosed(w);
    }
    // live:
    const hasAllScorecards = all.every((p) => {
      const f = finals?.[p];
      return f && String(f.scorecardImageUrl || "").trim() !== "";
    });
    return hasAllScorecards;
  }

  // Rank leaderboard (1 best)
  function computeRanksTable() {
    const c = currentComp;
    if (!c) return { rows: [], completeWorkoutIds: new Set(), perWorkout: {} };

    const workouts = c.workouts || [];
    const perWorkout = {};
    const completeWorkoutIds = new Set();

    for (const w of workouts) {
      if (!workoutIsCompleteForLeaderboard(w)) continue;
      completeWorkoutIds.add(w.id);

      const finals = c.finalScores?.[w.id] || {};
      const entries = participantList
        .map((p) => {
          const f = finals[p];
          const sortable = scoreToSortable(w, f?.value);
          return { participant: p, value: f?.value ?? "", sortable };
        })
        .filter((e) => e.sortable != null);

      const asc = isAscForWorkout(w);
      entries.sort((a, b) => (asc ? a.sortable - b.sortable : b.sortable - a.sortable));

      const ranks = {};
      // simple ranking (no tie handling beyond stable order)
      entries.forEach((e, idx) => (ranks[e.participant] = idx + 1));
      perWorkout[w.id] = ranks;
    }

    const rows = participantList.map((p) => {
      let totalRank = 0;
      let counted = 0;
      const per = {};
      for (const w of currentComp.workouts || []) {
        if (!completeWorkoutIds.has(w.id)) continue;
        const r = perWorkout[w.id]?.[p];
        if (r != null) {
          per[w.id] = r;
          totalRank += r;
          counted += 1;
        }
      }
      return {
        participant: p,
        division: participantMeta.get(p)?.division || "",
        totalRank,
        counted,
        perWorkout: per,
      };
    });

    // overall = lowest totalRank wins; if counted=0 push down
    rows.sort((a, b) => {
      const aKey = a.counted ? a.totalRank : Number.POSITIVE_INFINITY;
      const bKey = b.counted ? b.totalRank : Number.POSITIVE_INFINITY;
      if (aKey !== bKey) return aKey - bKey;
      return String(a.participant).localeCompare(String(b.participant));
    });

    return { rows, completeWorkoutIds, perWorkout };
  }

  const ranksTable = useMemo(() => computeRanksTable(), [currentComp, nowMs]); // eslint-disable-line

  // Publish gating:
  // - cannot publish if any pending adjustments
  // - ONLINE: every CLOSED workout must be complete (finals for all)
  // - LIVE: every workout must be complete (final+scorecard for all) to publish overall leaderboard
  const publishStatus = useMemo(() => {
    const c = currentComp;
    if (!c) return { canPublish: false, reasons: ["No competition loaded"] };

    const pending = (c.adjustments || []).some((a) => a.status === "awaiting_head_judge");
    if (pending) return { canPublish: false, reasons: ["There are adjustments awaiting Head Judge decision"] };

    const workouts = c.workouts || [];
    if (c.type === "online") {
      const closed = workouts.filter((w) => isClosed(w));
      const incompleteClosed = closed.filter((w) => !workoutIsCompleteForLeaderboard(w));
      if (incompleteClosed.length) {
        return { canPublish: false, reasons: [`Closed workouts still missing final scores (${incompleteClosed.length})`] };
      }
      if (!closed.length) return { canPublish: false, reasons: ["No closed workouts yet"] };
      return { canPublish: true, reasons: [] };
    }

    // live
    const incomplete = workouts.filter((w) => !workoutIsCompleteForLeaderboard(w));
    if (incomplete.length) {
      return { canPublish: false, reasons: [`LIVE workouts incomplete (need scores + scorecards for all athletes)`] };
    }
    return { canPublish: true, reasons: [] };
  }, [currentComp, nowMs]); // eslint-disable-line

  function setLeaderboardPublished(next) {
    if (next === true) {
      if (!publishStatus.canPublish) {
        showToast("warn", `Cannot publish yet: ${publishStatus.reasons[0] || "Judging incomplete"}`);
        return;
      }
      if (!data.settings.leaderboardPublished) toggleSetting("leaderboardPublished");
      addAudit("Leaderboard published");
      showToast("ok", "Leaderboard published.");
    } else {
      if (data.settings.leaderboardPublished) toggleSetting("leaderboardPublished");
      addAudit("Leaderboard unpublished");
      showToast("ok", "Leaderboard unpublished.");
    }
  }

  /* ================================
ATHLETE PANEL
================================ */
  const [athleteName, setAthleteName] = useState(() => participantList[0] || "");
  const [athleteTab, setAthleteTab] = useState("workout"); // workout | leaderboard | my
  const [workoutPick, setWorkoutPick] = useState(() => currentComp?.workouts?.[0]?.id || "");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitDraft, setSubmitDraft] = useState({ value: "", videoUrl: "", notes: "" });

  useEffect(() => {
    if (!participantList.includes(athleteName)) setAthleteName(participantList[0] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantList.join("\n")]);

  const athleteDivision = participantMeta.get(athleteName)?.division || "";

  const athleteVisibleWorkouts = useMemo(() => {
    const ws = currentComp?.workouts || [];
    if (currentComp?.type === "live") return ws; // athletes can view workouts, but can't submit
    return ws.filter((w) => isReleased(w)); // online: released only
  }, [currentComp, nowMs]); // eslint-disable-line

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
    if (currentComp?.type === "live") return { ok: false, reason: "This is a LIVE event. Scores are entered by the Head Judge." };
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
    const videoUrl = String(submitDraft.videoUrl || "").trim();
    const notes = String(submitDraft.notes || "").trim();

    if (!value) return showToast("warn", "Score is required.");
    // REQUIRED per your instruction:
    if (!videoUrl) return showToast("warn", "Video URL is required for every qualifier submission.");

    updateComp(currentComp.id, (c) => {
      c.submissions = c.submissions || {};
      c.submissions[wBase.id] = c.submissions[wBase.id] || {};
      c.submissions[wBase.id][athleteName] = {
        value,
        videoUrl,
        notes,
        submittedAt: new Date().toISOString(),
        status: "submitted",
        division: athleteDivision,
        judgeNote: "",
        confirmedBy: "",
        confirmedAt: "",
      };
      return c;
    });

    addAudit(`Submission: ${athleteName} submitted ${wBase.id} (${value})`);
    showToast("ok", "Submitted.");
    setShowSubmitModal(false);
  }

  /* ================================
JUDGE PANEL
================================ */
  const [judgeName, setJudgeName] = useState(() => currentComp?.judgePool?.[0] || "Judge");
  const [judgeView, setJudgeView] = useState("review"); // review | sent
  const [judgeFilter, setJudgeFilter] = useState({ q: "", workoutId: "all", status: "submitted", division: "all" });
  const [adjustDraft, setAdjustDraft] = useState({ id: "", workoutId: "", participant: "", adjustedValue: "", note: "" });

  useEffect(() => setJudgeName(currentComp?.judgePool?.[0] || "Judge"), [data.ui.compId]); // eslint-disable-line

  const submissionsFlat = useMemo(() => {
    const c = currentComp;
    if (!c) return [];
    if (c.type === "live") return []; // live: no athlete submissions
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
          confirmedBy: s.confirmedBy || "",
          confirmedAt: s.confirmedAt || "",
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
        const blob = `${r.workoutName} ${r.participant} ${r.division} ${r.value} ${r.notes} ${r.videoUrl}`.toLowerCase();
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
    const note = String(adjustDraft.note || "").trim();

    // REQUIRED per your instruction:
    if (!note) return showToast("warn", "Adjustment note is required.");

    const adj = {
      id: adjustDraft.id || uid("adj"),
      workoutId: adjustDraft.workoutId,
      participant: adjustDraft.participant,
      adjustedValue: String(adjustDraft.adjustedValue || "").trim(),
      note,
      judgeName,
      createdAt: new Date().toISOString(),
      status: "awaiting_head_judge",
      decidedAt: "",
      headJudgeName: "",
      rejectReason: "",
    };

    if (!adj.workoutId || !adj.participant || !adj.adjustedValue) return showToast("warn", "Workout, athlete and adjusted value are required.");

    updateComp(c.id, (comp) => {
      comp.adjustments = comp.adjustments || [];
      comp.adjustments.unshift(adj);
      // mark submission as "submitted" still; head judge finalises
      return comp;
    });

    addAudit(`Adjustment proposed: ${judgeName} for ${adj.participant} on ${adj.workoutId} -> ${adj.adjustedValue}`);
    showToast("ok", "Adjustment sent to Head Judge.");
    setAdjustDraft({ id: "", workoutId: "", participant: "", adjustedValue: "", note: "" });
    setJudgeView("sent");
  }

  function confirmScore(row) {
    const c = currentComp;
    if (!c || c.type === "live") return;

    updateComp(c.id, (comp) => {
      comp.submissions = comp.submissions || {};
      comp.submissions[row.workoutId] = comp.submissions[row.workoutId] || {};
      const s = comp.submissions[row.workoutId][row.participant];
      if (!s) return comp;
      s.status = "confirmed";
      s.confirmedBy = judgeName;
      s.confirmedAt = new Date().toISOString();
      return comp;
    });

    addAudit(`Score confirmed: ${judgeName} confirmed ${row.participant} on ${row.workoutId}`);
    showToast("ok", "Score confirmed.");
  }

  const judgeSent = useMemo(() => {
    return (currentComp?.adjustments || []).filter((a) => a.judgeName === judgeName);
  }, [currentComp, judgeName]);

  /* ================================
HEAD JUDGE PANEL
================================ */
  const [headJudgeName, setHeadJudgeName] = useState(() => currentComp?.headJudgePool?.[0] || "Head Judge");
  const [headJudgeView, setHeadJudgeView] = useState("confirm"); // confirm | finalise | live_entry | audit
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => setHeadJudgeName(currentComp?.headJudgePool?.[0] || "Head Judge"), [data.ui.compId]); // eslint-disable-line

  const awaitingAdjustments = useMemo(() => {
    return (currentComp?.adjustments || []).filter((a) => a.status === "awaiting_head_judge");
  }, [currentComp]);

  function ensureFinalScore(comp, workoutId, participant, payload) {
    comp.finalScores = comp.finalScores || {};
    comp.finalScores[workoutId] = comp.finalScores[workoutId] || {};
    comp.finalScores[workoutId][participant] = payload;
  }

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
      a.headJudgeName = headJudgeName;

      // Write final score from adjustment
      ensureFinalScore(comp, a.workoutId, a.participant, {
        value: a.adjustedValue,
        finalAt: new Date().toISOString(),
        source: "adjustment",
        decidedBy: headJudgeName,
        note: a.note,
        scorecardImageUrl: comp.type === "live" ? "" : undefined,
      });

      // Mark submission as final if exists (online)
      if (comp.type === "online") {
        comp.submissions = comp.submissions || {};
        comp.submissions[a.workoutId] = comp.submissions[a.workoutId] || {};
        if (comp.submissions[a.workoutId][a.participant]) {
          comp.submissions[a.workoutId][a.participant].status = "final";
        }
      }

      return comp;
    });

    addAudit(`Adjustment approved: ${headJudgeName} approved ${adj.participant} on ${adj.workoutId}`);
    showToast("ok", "Adjustment approved and final score written.");
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
      a.headJudgeName = headJudgeName;
      a.rejectReason = reason;
      return comp;
    });

    addAudit(`Adjustment rejected: ${headJudgeName} rejected ${adj.participant} on ${adj.workoutId} (${reason})`);
    showToast("ok", "Adjustment rejected.");
    setRejectNote("");
  }

  // Finalise for online: accept submissions as final or override
  const [finaliseDraft, setFinaliseDraft] = useState({ workoutId: "", participant: "", value: "" });

  const nonFinalSubmissions = useMemo(() => {
    const c = currentComp;
    if (!c || c.type !== "online") return [];
    const rows = [];
    for (const w of c.workouts || []) {
      // only closed workouts require finals for publishing
      if (!isClosed(w)) continue;
      const per = c.submissions?.[w.id] || {};
      for (const [participant, s] of Object.entries(per)) {
        const f = c.finalScores?.[w.id]?.[participant];
        if (f && f.value != null && String(f.value).trim() !== "") continue;
        const pending = getPendingAdjustment(w.id, participant);
        if (pending) continue;
        rows.push({
          workoutId: w.id,
          workoutName: w.name,
          participant,
          division: s.division || participantMeta.get(participant)?.division || "",
          submittedValue: s.value,
          status: s.status || "submitted",
          confirmedBy: s.confirmedBy || "",
          confirmedAt: s.confirmedAt || "",
          videoUrl: s.videoUrl || "",
          submittedAt: s.submittedAt || "",
        });
      }
    }
    rows.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
    return rows;
  }, [currentComp, participantMeta, nowMs]); // eslint-disable-line

  function acceptAsFinal(row) {
    const c = currentComp;
    if (!c || c.type !== "online") return;

    updateComp(c.id, (comp) => {
      ensureFinalScore(comp, row.workoutId, row.participant, {
        value: row.submittedValue,
        finalAt: new Date().toISOString(),
        source: "submission",
        decidedBy: headJudgeName,
        note: "",
      });
      comp.submissions = comp.submissions || {};
      comp.submissions[row.workoutId] = comp.submissions[row.workoutId] || {};
      if (comp.submissions[row.workoutId][row.participant]) {
        comp.submissions[row.workoutId][row.participant].status = "final";
      }
      return comp;
    });

    addAudit(`Finalised: ${headJudgeName} accepted ${row.participant} on ${row.workoutId}`);
    showToast("ok", "Accepted as final.");
  }

  function startOverrideFinal(row) {
    setFinaliseDraft({
      workoutId: row.workoutId,
      participant: row.participant,
      value: String(row.submittedValue ?? ""),
    });
  }

  function saveOverrideFinal() {
    const c = currentComp;
    if (!c) return;
    const value = String(finaliseDraft.value || "").trim();
    if (!finaliseDraft.workoutId || !finaliseDraft.participant) return;
    if (!value) return showToast("warn", "Final value required.");

    updateComp(c.id, (comp) => {
      ensureFinalScore(comp, finaliseDraft.workoutId, finaliseDraft.participant, {
        value,
        finalAt: new Date().toISOString(),
        source: "override",
        decidedBy: headJudgeName,
        note: "Override final entered by Head Judge",
      });
      if (comp.type === "online") {
        comp.submissions = comp.submissions || {};
        comp.submissions[finaliseDraft.workoutId] = comp.submissions[finaliseDraft.workoutId] || {};
        if (comp.submissions[finaliseDraft.workoutId][finaliseDraft.participant]) {
          comp.submissions[finaliseDraft.workoutId][finaliseDraft.participant].status = "final";
        }
      }
      return comp;
    });

    addAudit(`Final override: ${headJudgeName} set ${finaliseDraft.participant} on ${finaliseDraft.workoutId} -> ${value}`);
    showToast("ok", "Final overridden.");
    setFinaliseDraft({ workoutId: "", participant: "", value: "" });
  }

  // LIVE score entry: Head Judge enters a full workout's scores for all athletes, incl scorecard image URL
  const [livePickWorkoutId, setLivePickWorkoutId] = useState(() => currentComp?.workouts?.[0]?.id || "");
  const [liveScoreDraft, setLiveScoreDraft] = useState({}); // { participant: { value, scorecardImageUrl } }

  useEffect(() => {
    if (currentComp?.type !== "live") return;
    const wid = currentComp?.workouts?.[0]?.id || "";
    setLivePickWorkoutId(wid);
    setLiveScoreDraft({});
  }, [data.ui.compId]); // eslint-disable-line

  const liveSelectedWorkout = useMemo(() => {
    return (currentComp?.workouts || []).find((w) => w.id === livePickWorkoutId) || null;
  }, [currentComp, livePickWorkoutId]);

  function primeLiveDraft() {
    if (!currentComp || currentComp.type !== "live") return;
    const wid = livePickWorkoutId;
    if (!wid) return;
    const existing = currentComp.finalScores?.[wid] || {};
    const next = {};
    participantList.forEach((p) => {
      const e = existing[p];
      next[p] = {
        value: e?.value != null ? String(e.value) : "",
        scorecardImageUrl: e?.scorecardImageUrl ? String(e.scorecardImageUrl) : "",
      };
    });
    setLiveScoreDraft(next);
  }

  function saveLiveWorkoutScores() {
    const c = currentComp;
    if (!c || c.type !== "live") return;
    const wid = livePickWorkoutId;
    const w = (c.workouts || []).find((x) => x.id === wid);
    if (!w) return;

    // Validate: require value + scorecard image for every athlete (per your requirement)
    for (const p of participantList) {
      const entry = liveScoreDraft[p] || {};
      const v = String(entry.value || "").trim();
      const img = String(entry.scorecardImageUrl || "").trim();
      if (!v) return showToast("warn", `Missing score for ${p}`);
      if (!img) return showToast("warn", `Missing scorecard image URL for ${p}`);
    }

    updateComp(c.id, (comp) => {
      participantList.forEach((p) => {
        const entry = liveScoreDraft[p];
        ensureFinalScore(comp, wid, p, {
          value: String(entry.value).trim(),
          finalAt: new Date().toISOString(),
          source: "live_scorecard",
          decidedBy: headJudgeName,
          note: "Live score entered by Head Judge",
          scorecardImageUrl: String(entry.scorecardImageUrl).trim(),
        });
      });
      return comp;
    });

    addAudit(`LIVE scores saved: ${headJudgeName} entered full workout scores for ${wid}`);
    showToast("ok", "LIVE workout scores saved. Leaderboard updated for that workout.");
  }

  /* ================================
ORGANISER: CREATE NEW EVENT/COMP
================================ */
  const [orgView, setOrgView] = useState("controls"); // controls | schedule | create | roster
  const [createDraft, setCreateDraft] = useState({
    type: "online",
    name: "",
    date: yyyyMmDd(new Date()),
    location: "",
    description: "",
    divisionsCsv: "RX,Scaled",
    judgePoolCsv: "Judge One,Judge Two",
    headJudgePoolCsv: "Head Judge",
  });
  const [createAthleteName, setCreateAthleteName] = useState("");
  const [createAthleteDivision, setCreateAthleteDivision] = useState("RX");
  const [createAthletes, setCreateAthletes] = useState([]);
  const [createWorkoutDraft, setCreateWorkoutDraft] = useState({
    name: "",
    scoreType: "time",
    sort: "asc",
    unit: "time (mm:ss)",
    cap: "",
    description: "",
  });
  const [createWorkouts, setCreateWorkouts] = useState([]);

  useEffect(() => {
    // keep division dropdown sensible when draft divisions change
    const divs = String(createDraft.divisionsCsv || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (divs.length && !divs.includes(createAthleteDivision)) setCreateAthleteDivision(divs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createDraft.divisionsCsv]);

  function addCreateAthlete() {
    const name = String(createAthleteName || "").trim();
    const div = String(createAthleteDivision || "").trim();
    if (!name) return showToast("warn", "Athlete name required.");
    if (!div) return showToast("warn", "Division required.");
    if (createAthletes.some((a) => normaliseStr(a.name) === normaliseStr(name))) return showToast("warn", "Athlete already added.");
    setCreateAthletes((xs) => xs.concat([{ name, division: div }]));
    setCreateAthleteName("");
  }

  function addCreateWorkout() {
    const name = String(createWorkoutDraft.name || "").trim();
    if (!name) return showToast("warn", "Workout name required.");
    const w = {
      id: uid("w"),
      name,
      divisionNotes: "All divisions",
      scoreType: createWorkoutDraft.scoreType,
      sort: createWorkoutDraft.sort,
      unit: String(createWorkoutDraft.unit || "").trim() || (createWorkoutDraft.scoreType === "time" ? "time (mm:ss)" : "points"),
      cap: String(createWorkoutDraft.cap || "").trim(),
      tiebreak: "",
      equipment: [],
      standards: [],
      description: String(createWorkoutDraft.description || "").trim(),
      media: { demoVideoUrl: "", scorecardUrl: "" },
      schedule: defaultSchedule(+1, 24),
      scalingByDivision: {},
    };
    setCreateWorkouts((xs) => xs.concat([w]));
    setCreateWorkoutDraft({ name: "", scoreType: "time", sort: "asc", unit: "time (mm:ss)", cap: "", description: "" });
  }

  function createNewCompetition() {
    const type = createDraft.type === "live" ? "live" : "online";
    const name = String(createDraft.name || "").trim();
    const date = String(createDraft.date || "").trim();
    const location = String(createDraft.location || "").trim();
    const description = String(createDraft.description || "").trim();

    if (!name) return showToast("warn", "Event name required.");
    if (!date) return showToast("warn", "Event date required.");

    const divisions = String(createDraft.divisionsCsv || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!divisions.length) return showToast("warn", "At least one division required.");

    const judgePool = String(createDraft.judgePoolCsv || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const headJudgePool = String(createDraft.headJudgePoolCsv || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (!headJudgePool.length) return showToast("warn", "At least one Head Judge name required.");

    if (!createWorkouts.length) return showToast("warn", "Add at least one workout for the event.");
    if (!createAthletes.length) return showToast("warn", "Add at least one athlete for the event.");

    const id = uid(type === "live" ? "comp_live" : "comp_online");

    const newComp = {
      id,
      type,
      name,
      date,
      location,
      description,
      divisions,
      judgePool,
      headJudgePool,
      workouts: createWorkouts,
      athletes: createAthletes,
      submissions: type === "online" ? {} : {},
      adjustments: [],
      finalScores: {},
      audit: [],
    };

    setData((d) => {
      const next = { ...d };
      next.competitions = (d.competitions || []).concat([newComp]);
      next.ui = { ...d.ui, compId: id, tab: "competition" };
      next.directory = next.directory || { events: [] };
      next.directory.events = (next.directory.events || []).concat([
        {
          id: uid("evt"),
          name,
          startDate: date,
          endDate: date,
          city: location || "—",
          venue: location || "—",
          divisions,
          tags: [type === "live" ? "live" : "online-qualifier"],
          status: "upcoming",
          regOpen: type === "online",
          website: "",
          instagram: "",
          notes: type === "live" ? "LIVE in-person event (Head Judge score entry)" : "Online qualifier event",
        },
      ]);
      return next;
    });

    showToast("ok", "New event created and selected.");

    // Reset create form
    setCreateDraft({
      type: "online",
      name: "",
      date: yyyyMmDd(new Date()),
      location: "",
      description: "",
      divisionsCsv: "RX,Scaled",
      judgePoolCsv: "Judge One,Judge Two",
      headJudgePoolCsv: "Head Judge",
    });
    setCreateAthletes([]);
    setCreateWorkouts([]);
    setOrgView("controls");
  }

  /* ================================
UI: HEADER / TABS
================================ */
  const tab = data.ui.tab;
  const canSeeDirectory = isOrganiser;
  const canSeeAdmin = isOrganiser;

  const Header = () => (
    <div style={{ ...S.card }}>
      <div style={S.headerRow}>
        <div>
          <div style={S.title}>Throwdown Hub — Demo</div>
          <div style={S.subTitle}>
            Online qualifier: athlete submits (video required) → judge confirms/adjusts (adjustment note required) → Head Judge finalises.
            Live: Head Judge enters scores + scorecard images for all athletes per workout.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={S.pill}>
            <span style={{ opacity: 0.8 }}>Role</span>
            <Select
              value={role}
              onChange={setRole}
              options={ROLES.map((r) => ({ value: r, label: r.replace("_", " ") }))}
              style={{ width: 170 }}
            />
          </div>
          <div style={S.pill}>
            <span style={{ opacity: 0.8 }}>Competition</span>
            <Select
              value={currentComp?.id || ""}
              onChange={setCompId}
              options={(data.competitions || []).map((c) => ({
                value: c.id,
                label: `${c.type === "live" ? "LIVE" : "ONLINE"} • ${c.name}`,
              }))}
              style={{ width: 320 }}
            />
          </div>
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
              if (res.ok) showToast("ok", "Imported.");
              else showToast("warn", res.error || "Import failed.");
              e.target.value = "";
            }}
          />
          <Button variant="danger" onClick={resetDemo} type="button">
            Reset Demo
          </Button>
        </div>
      </div>
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

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={S.pill}>
            <span style={{ opacity: 0.8 }}>Event Type</span>
            <span style={{ fontWeight: 900 }}>{currentComp?.type === "live" ? "LIVE" : "ONLINE"}</span>
          </div>
          <div style={S.pill}>
            <span style={{ opacity: 0.8 }}>Leaderboard</span>
            <span style={{ fontWeight: 900 }}>{data.settings.leaderboardPublished ? "Published" : "Hidden"}</span>
          </div>
        </div>
      </div>
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
DIRECTORY (organiser only)
================================ */
  const DirectoryPanel = () => {
    const events = data.directory.events || [];
    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Events Directory</div>
          <div style={{ ...S.muted, marginTop: 6 }}>Organiser-only directory view (demo).</div>
          <div style={S.divider} />
          {events.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {events.map((evt) => (
                <div key={evt.id} style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 950, fontSize: 15 }}>{evt.name}</div>
                  <div style={{ ...S.muted, marginTop: 4 }}>
                    {prettyDate(evt.startDate)} → {prettyDate(evt.endDate)} • {evt.city} • {evt.venue}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(evt.divisions || []).map((d) => (
                      <span key={d} style={S.tag}>
                        {d}
                      </span>
                    ))}
                    {(evt.tags || []).map((t) => (
                      <span key={t} style={{ ...S.tag, opacity: 0.85 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  {evt.notes ? <div style={{ marginTop: 8, ...S.muted }}>{evt.notes}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <div style={S.muted}>No events in directory.</div>
          )}
        </div>
      </div>
    );
  };

  /* ================================
LEADERBOARD PANEL
================================ */
  function LeaderboardPanel({ viewerRole }) {
    const c = currentComp;
    if (!c) return null;

    const isAthleteViewer = viewerRole === "athlete";
    const canShowToAthlete = data.settings.leaderboardPublished && publishStatus.canPublish;

    if (isAthleteViewer && !canShowToAthlete) {
      return (
        <div style={{ ...S.card, marginTop: 12 }}>
          <div style={{ fontWeight: 950, fontSize: 15 }}>Leaderboard</div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            Leaderboard is hidden until the organiser publishes it and judging is complete.
          </div>
        </div>
      );
    }

    const workouts = c.workouts || [];
    const completeSet = ranksTable.completeWorkoutIds;

    return (
      <div style={{ ...S.card, marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Leaderboard (Rank-based)</div>
            <div style={{ ...S.muted, marginTop: 4 }}>
              Per workout: rank 1 is best. Overall: lowest total rank wins. Only COMPLETE workouts count.
            </div>
          </div>
          <div style={S.pill}>
            <span style={{ opacity: 0.8 }}>Complete workouts</span>
            <span style={{ fontWeight: 900 }}>{completeSet.size}</span>
          </div>
        </div>

        <div style={S.divider} />

        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Overall</th>
                <th style={S.th}>Athlete</th>
                <th style={S.th}>Division</th>
                {workouts.map((w) => (
                  <th key={w.id} style={S.th}>
                    {w.name}
                    <div style={{ ...S.muted, marginTop: 4 }}>
                      {completeSet.has(w.id) ? "COUNTED" : c.type === "online" ? (isClosed(w) ? "Missing finals" : "Not closed") : "Missing scores/scorecards"}
                    </div>
                  </th>
                ))}
                <th style={S.th}>Total Rank</th>
              </tr>
            </thead>
            <tbody>
              {ranksTable.rows.map((r, idx) => (
                <tr key={r.participant}>
                  <td style={S.td} title="Overall placing">{idx + 1}</td>
                  <td style={{ ...S.td, fontWeight: 900 }}>…</td>
                  <td style={S.td}>{r.division || "—"}</td>
                  {workouts.map((w) => {
                    const fin = getFinal(w.id, r.participant);
                    const display = fin?.value ?? "—";
                    const counted = completeSet.has(w.id);
                    const rank = counted ? r.perWorkout[w.id] : null;
                    return (
                      <td key={w.id} style={S.td}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontWeight: 900, opacity: counted ? 1 : 0.55 }}>{display}</div>
                          <div style={{ ...S.muted }}>
                            {counted ? `Rank ${rank ?? "—"}` : "Not counted"}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ ...S.td, fontWeight: 900 }}>
                    {r.counted ? r.totalRank : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ================================
ATHLETE VIEW
================================ */
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
              <Button onClick={onClose} type="button">Close</Button>
              <Button
                variant="primary"
                onClick={onSubmit}
                type="button"
                disabled={!gate.ok}
                style={!gate.ok ? { opacity: 0.6 } : null}
              >
                Submit
              </Button>
            </div>
          </div>

          <div style={S.divider} />

          {!gate.ok ? (
            <div style={{ ...S.card, padding: 12, borderColor: "rgba(255,160,70,0.35)" }}>
              <div style={{ fontWeight: 900 }}>Cannot submit</div>
              <div style={{ ...S.muted, marginTop: 6 }}>{gate.reason}</div>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <Field label={`Score (${workout?.unit || workoutBase?.unit || "value"})`}>
              <input
                style={S.input}
                value={draft.value}
                onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                placeholder={workout?.scoreType === "time" ? "e.g. 08:44" : "e.g. 110"}
              />
            </Field>

            <Field label="Video URL (required)">
              <input
                style={S.input}
                value={draft.videoUrl}
                onChange={(e) => setDraft((d) => ({ ...d, videoUrl: e.target.value }))}
                placeholder="Paste a link to the athlete video (required)"
              />
              <div style={{ ...S.muted, marginTop: 6 }}>
                Every qualifier submission must include a video link.
              </div>
            </Field>

            <Field label="Notes (optional)">
              <textarea
                style={{ ...S.input, minHeight: 90 }}
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Anything you want the judges to know (optional)"
              />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  function MySubmissionsPanel() {
    const c = currentComp;
    if (!c) return null;

    if (c.type === "live") {
      return (
        <div style={{ ...S.card, marginTop: 12 }}>
          <div style={{ fontWeight: 950, fontSize: 15 }}>My Scores</div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            This is a LIVE event. Scores are entered by the Head Judge. You can view finals below as they’re entered.
          </div>
          <div style={S.divider} />
          <div style={{ display: "grid", gap: 10 }}>
            {(c.workouts || []).map((w) => {
              const fin = c.finalScores?.[w.id]?.[athleteName];
              return (
                <div key={w.id} style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 950 }}>{w.name}</div>
                  <div style={{ ...S.muted, marginTop: 4 }}>Final: {fin?.value ?? "—"}</div>
                  {fin?.scorecardImageUrl ? (
                    <div style={{ ...S.muted, marginTop: 6 }}>
                      Scorecard image URL: <span style={{ opacity: 0.95 }}>{fin.scorecardImageUrl}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const rows = (c.workouts || [])
      .filter((w) => isReleased(w))
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
          confirmedBy: sub?.confirmedBy || "",
          confirmedAt: sub?.confirmedAt || "",
          videoUrl: sub?.videoUrl || "",
        };
      });

    return (
      <div style={{ ...S.card, marginTop: 12 }}>
        <div style={{ fontWeight: 950, fontSize: 15 }}>My Submissions</div>
        <div style={{ ...S.muted, marginTop: 6 }}>Released workouts only.</div>
        <div style={S.divider} />
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Workout</th>
                <th style={S.th}>Submitted</th>
                <th style={S.th}>Video</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Final</th>
                <th style={S.th}>Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
  <tr key={r.workoutId}>
    <td style={tdBold}>{r.workoutName}</td>

    <td style={S.td}>
      <div style={{ fontWeight: 900 }}>{r.submittedValue ?? "—"}</div>
      <div style={S.muted}>
        {r.submittedAt ? prettyDateTime(r.submittedAt) : "—"}
      </div>
    </td>

    <td style={S.td}>
      <div style={{ fontWeight: 900, opacity: r.videoUrl ? 1 : 0.55 }}>
        {r.videoUrl ? "Provided" : "—"}
      </div>
    </td>

    <td style={S.td}>
      <div style={{ fontWeight: 900 }}>
        {r.pending ? "Pending Head Judge" : r.status}
      </div>
    </td>

    {/* FINAL VALUE CELL — this was the broken one */}
    <td style={{ ...S.td, fontWeight: 950 }}>
      {r.finalValue ?? "—"}
    </td>

    <td style={S.td}>
      {r.confirmedBy ? (
        <>
          <div style={{ fontWeight: 900 }}>{r.confirmedBy}</div>
          <div style={S.muted}>{prettyDateTime(r.confirmedAt)}</div>
        </>
      ) : (
        <span style={S.muted}>—</span>
      )}
    </td>
  </tr>
))}
              {!rows.length ? (
                <tr>
                  <td style={S.td} colSpan={6}>
                    <span style={S.muted}>No submissions yet.</span>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function AthletePanel() {
    const c = currentComp;
    const wBase = selectedWorkoutBase;
    const w = selectedWorkout;

    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Athlete</div>
              <div style={{ ...S.muted, marginTop: 4 }}>
                {c.type === "online"
                  ? "Submit scores with required video links. Leaderboard appears only when published."
                  : "LIVE event: view workouts and finals; Head Judge enters all scores + scorecard images."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={S.pill}>
                <span style={{ opacity: 0.8 }}>Athlete</span>
                <Select
                  value={athleteName}
                  onChange={setAthleteName}
                  options={(participantList || []).map((p) => ({ value: p, label: p }))}
                  style={{ width: 220 }}
                />
              </div>
              <div style={S.pill}>
                <span style={{ opacity: 0.8 }}>Division</span>
                <span style={{ fontWeight: 900 }}>{athleteDivision || "—"}</span>
              </div>
            </div>
          </div>

          <div style={S.divider} />

          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant={athleteTab === "workout" ? "primary" : "default"} onClick={() => setAthleteTab("workout")} type="button">
                Workouts
              </Button>
              <Button variant={athleteTab === "my" ? "primary" : "default"} onClick={() => setAthleteTab("my")} type="button">
                My Scores
              </Button>
              <Button variant={athleteTab === "leaderboard" ? "primary" : "default"} onClick={() => setAthleteTab("leaderboard")} type="button">
                Leaderboard
              </Button>
            </div>
          </div>

          {athleteTab === "leaderboard" ? <LeaderboardPanel viewerRole="athlete" /> : null}
          {athleteTab === "my" ? <MySubmissionsPanel /> : null}

          {athleteTab === "workout" ? (
            <>
              <div style={{ ...S.card, marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 950, fontSize: 15 }}>Workout Viewer</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={S.pill}>
                      <span style={{ opacity: 0.8 }}>Workout</span>
                      <Select
                        value={workoutPick}
                        onChange={setWorkoutPick}
                        options={athleteVisibleWorkouts.map((x) => ({ value: x.id, label: x.name }))}
                        style={{ width: 320 }}
                      />
                    </div>
                    <Button
                      variant="primary"
                      onClick={openSubmitModal}
                      type="button"
                      disabled={currentComp.type !== "online"}
                      style={currentComp.type !== "online" ? { opacity: 0.6 } : null}
                      title={currentComp.type !== "online" ? "LIVE event: Head Judge enters scores" : "Submit score"}
                    >
                      Submit score
                    </Button>
                  </div>
                </div>

                <div style={S.divider} />

                {!wBase ? (
                  <div style={S.muted}>No workout selected.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ ...S.row, justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 16 }}>{w?.name || wBase.name}</div>
                        <div style={{ ...S.muted, marginTop: 4 }}>{wBase.divisionNotes || ""}</div>
                      </div>
                      <div style={S.pill}>
                        <span style={{ opacity: 0.8 }}>Schedule</span>
                        <span style={{ fontWeight: 900 }}>{currentComp.type === "online" ? scheduleLabel(wBase) : "LIVE event"}</span>
                      </div>
                    </div>

                    <div style={{ ...S.card, padding: 12 }}>
                      <div style={{ fontWeight: 900 }}>Description</div>
                      <div style={{ ...S.muted, marginTop: 6 }}>{w?.description || wBase.description}</div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ ...S.card, padding: 12 }}>
                        <div style={{ fontWeight: 900 }}>Scoring</div>
                        <div style={{ ...S.muted, marginTop: 6 }}>
                          Type: <b>{w?.scoreType || wBase.scoreType}</b> • Unit: <b>{w?.unit || wBase.unit}</b> • Sort:{" "}
                          <b>{(w?.sort || wBase.sort) === "asc" ? "Lower is better" : "Higher is better"}</b>
                        </div>
                        <div style={{ ...S.muted, marginTop: 6 }}>
                          Cap: <b>{w?.cap || wBase.cap || "—"}</b>
                        </div>
                        {w?.tiebreak || wBase.tiebreak ? (
                          <div style={{ ...S.muted, marginTop: 6 }}>
                            Tie-break: <b>{w?.tiebreak || wBase.tiebreak}</b>
                          </div>
                        ) : null}
                      </div>

                      <div style={{ ...S.card, padding: 12 }}>
                        <div style={{ fontWeight: 900 }}>Standards</div>
                        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                          {(w?.standards || wBase.standards || []).map((s, i) => (
                            <li key={i} style={{ ...S.muted, marginBottom: 6 }}>
                              {s}
                            </li>
                          ))}
                          {currentComp.type === "online" ? (
                            <li style={{ ...S.muted, marginBottom: 6 }}>
                              Video submission is required for every qualifier entry.
                            </li>
                          ) : (
                            <li style={{ ...S.muted, marginBottom: 6 }}>
                              LIVE event: scorecards are captured and uploaded by the Head Judge.
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
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

  /* ================================
JUDGE VIEW
================================ */
  function JudgePanel() {
    if (currentComp.type === "live") {
      return (
        <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
          <div style={{ flex: "1 1 760px", ...S.card }}>
            <div style={{ fontSize: 18, fontWeight: 950 }}>Judge</div>
            <div style={{ ...S.muted, marginTop: 6 }}>LIVE event: athlete submissions are not used. Head Judge enters all scores.</div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Judge</div>
              <div style={{ ...S.muted, marginTop: 4 }}>Review submissions, confirm scores, or propose adjustments (note required).</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={S.pill}>
                <span style={{ opacity: 0.8 }}>Judge</span>
                <Select value={judgeName} onChange={setJudgeName} options={(currentComp.judgePool || []).map((j) => ({ value: j, label: j }))} style={{ width: 220 }} />
              </div>
              <Button variant={judgeView === "review" ? "primary" : "default"} onClick={() => setJudgeView("review")} type="button">
                Review
              </Button>
              <Button variant={judgeView === "sent" ? "primary" : "default"} onClick={() => setJudgeView("sent")} type="button">
                My adjustments
              </Button>
            </div>
          </div>

          <div style={S.divider} />

          {judgeView === "sent" ? (
            <>
              <div style={{ fontWeight: 950, fontSize: 15 }}>Adjustments sent by {judgeName}</div>
              <div style={S.divider} />
              <div style={{ display: "grid", gap: 10 }}>
                {judgeSent.map((a) => (
                  <div key={a.id} style={{ ...S.card, padding: 12 }}>
                    <div style={{ fontWeight: 950 }}>
                      {a.participant} • {a.workoutId} → <span style={{ opacity: 0.95 }}>{a.adjustedValue}</span>
                    </div>
                    <div style={{ ...S.muted, marginTop: 6 }}>{a.note}</div>
                    <div style={{ ...S.muted, marginTop: 6 }}>
                      Status: <b>{a.status}</b> • Created: {prettyDateTime(a.createdAt)}
                    </div>
                  </div>
                ))}
                {!judgeSent.length ? <div style={S.muted}>No adjustments yet.</div> : null}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                <Field label="Search">
                  <input style={S.input} value={judgeFilter.q} onChange={(e) => setJudgeFilter((f) => ({ ...f, q: e.target.value }))} placeholder="Athlete, workout, value..." />
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
                      { value: "submitted", label: "submitted" },
                      { value: "confirmed", label: "confirmed" },
                      { value: "final", label: "final" },
                      { value: "all", label: "all" },
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

              <div style={S.divider} />

              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Workout</th>
                      <th style={S.th}>Athlete</th>
                      <th style={S.th}>Division</th>
                      <th style={S.th}>Score</th>
                      <th style={S.th}>Video</th>
                      <th style={S.th}>Submitted</th>
                      <th style={S.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {judgeFiltered.map((r) => (
                      <tr key={`${r.workoutId}_${r.participant}`}>
                        <td style={{ ...S.td, fontWeight: 900 }}>{r.workoutName}</td>
                        <td style={{ ...S.td, fontWeight: 900 }}>{r.participant}</td>
                        <td style={S.td}>{r.division || "—"}</td>
                        <td style={{ ...S.td, fontWeight: 900 }}>{r.value ?? "—"}</td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 900, opacity: r.videoUrl ? 1 : 0.55 }}>{r.videoUrl ? "Provided" : "Missing"}</div>
                          <div style={S.muted}>{r.videoUrl ? r.videoUrl.slice(0, 40) + (r.videoUrl.length > 40 ? "…" : "") : ""}</div>
                        </td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 900 }}>{r.status}</div>
                          <div style={S.muted}>{r.submittedAt ? prettyDateTime(r.submittedAt) : "—"}</div>
                          {r.confirmedBy ? <div style={S.muted}>Confirmed by {r.confirmedBy}</div> : null}
                        </td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Button variant="primary" onClick={() => confirmScore(r)} type="button" disabled={r.status === "final"}>
                              Confirm score
                            </Button>
                            <Button onClick={() => startAdjust(r)} type="button">
                              Adjust
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!judgeFiltered.length ? (
                      <tr>
                        <td style={S.td} colSpan={7}>
                          <span style={S.muted}>No submissions match your filters.</span>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {adjustDraft.workoutId ? (
                <div style={{ ...S.card, marginTop: 12 }}>
                  <div style={{ fontWeight: 950, fontSize: 15 }}>Propose adjustment</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>
                    Athlete: <b>{adjustDraft.participant}</b> • Workout: <b>{adjustDraft.workoutId}</b>
                  </div>
                  <div style={S.divider} />
                  <div style={{ display: "grid", gap: 10 }}>
                    <Field label="Adjusted score (required)">
                      <input
                        style={S.input}
                        value={adjustDraft.adjustedValue}
                        onChange={(e) => setAdjustDraft((d) => ({ ...d, adjustedValue: e.target.value }))}
                        placeholder="New score"
                      />
                    </Field>
                    <Field label="Adjustment note (required)">
                      <textarea
                        style={{ ...S.input, minHeight: 90 }}
                        value={adjustDraft.note}
                        onChange={(e) => setAdjustDraft((d) => ({ ...d, note: e.target.value }))}
                        placeholder="Explain the adjustment and why it changed"
                      />
                    </Field>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button variant="primary" onClick={saveAdjustment} type="button">
                        Send to Head Judge
                      </Button>
                      <Button onClick={() => setAdjustDraft({ id: "", workoutId: "", participant: "", adjustedValue: "", note: "" })} type="button">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }

  /* ================================
HEAD JUDGE VIEW
================================ */
  function AuditPanel() {
    const audit = currentComp?.audit || [];
    return (
      <div style={{ ...S.card, padding: 12, marginTop: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 900 }}>Audit log</div>
        <div style={{ ...S.muted, marginTop: 6 }}>Key actions: submissions, confirmations, adjustments, finals, publish, schedule edits, live score entry.</div>
        <div style={S.divider} />
        <div style={{ display: "grid", gap: 8 }}>
          {audit.map((a) => (
            <div key={a.id} style={{ ...S.card, padding: 10 }}>
              <div style={{ fontWeight: 900 }}>{a.message}</div>
              <div style={S.muted}>
                {prettyDateTime(a.at)} • {a.whoRole}
              </div>
            </div>
          ))}
          {!audit.length ? <div style={S.muted}>No audit items yet.</div> : null}
        </div>
      </div>
    );
  }

  function HeadJudgePanel() {
    const c = currentComp;
    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Head Judge</div>
              <div style={{ ...S.muted, marginTop: 4 }}>
                {c.type === "online"
                  ? "Approve/reject adjustments and finalise submissions. (No leaderboard view.)"
                  : "LIVE event: enter workout scores for all athletes (scorecard image URL required)."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={S.pill}>
                <span style={{ opacity: 0.8 }}>Head Judge</span>
                <Select value={headJudgeName} onChange={setHeadJudgeName} options={(c.headJudgePool || []).map((h) => ({ value: h, label: h }))} style={{ width: 240 }} />
              </div>
              <Button variant={headJudgeView === "confirm" ? "primary" : "default"} onClick={() => setHeadJudgeView("confirm")} type="button">
                Adjustments
              </Button>
              {c.type === "online" ? (
                <Button variant={headJudgeView === "finalise" ? "primary" : "default"} onClick={() => setHeadJudgeView("finalise")} type="button">
                  Finalise
                </Button>
              ) : (
                <Button
                  variant={headJudgeView === "live_entry" ? "primary" : "default"}
                  onClick={() => {
                    setHeadJudgeView("live_entry");
                    primeLiveDraft();
                  }}
                  type="button"
                >
                  Live score entry
                </Button>
              )}
              <Button variant={headJudgeView === "audit" ? "primary" : "default"} onClick={() => setHeadJudgeView("audit")} type="button">
                Audit
              </Button>
            </div>
          </div>

          {headJudgeView === "confirm" ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 950, fontSize: 15 }}>Awaiting adjustments</div>
              <div style={S.divider} />
              <div style={{ display: "grid", gap: 10 }}>
                {awaitingAdjustments.map((a) => (
                  <div key={a.id} style={{ ...S.card, padding: 12 }}>
                    <div style={{ fontWeight: 950, fontSize: 14 }}>
                      {a.participant} • {a.workoutId} → <span style={{ opacity: 0.95 }}>{a.adjustedValue}</span>
                    </div>
                    <div style={{ ...S.muted, marginTop: 6 }}>{a.note}</div>
                    <div style={{ ...S.muted, marginTop: 6 }}>
                      Judge: <b>{a.judgeName}</b> • Created: {prettyDateTime(a.createdAt)}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      <Button variant="primary" onClick={() => confirmAdjustment(a.id)} type="button">
                        Approve
                      </Button>
                      <Button variant="danger" onClick={() => rejectAdjustment(a.id)} type="button">
                        Reject
                      </Button>
                      <input
                        style={{ ...S.input, maxWidth: 380 }}
                        placeholder="Reject reason (optional)"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                {!awaitingAdjustments.length ? <div style={S.muted}>No pending adjustments.</div> : null}
              </div>
            </div>
          ) : null}

          {headJudgeView === "finalise" && c.type === "online" ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 950, fontSize: 15 }}>Finalise (closed workouts)</div>
              <div style={{ ...S.muted, marginTop: 6 }}>
                These are submissions for CLOSED workouts that still need final scores (and no pending adjustments).
              </div>
              <div style={S.divider} />

              <div style={{ overflowX: "auto" }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Workout</th>
                      <th style={S.th}>Athlete</th>
                      <th style={S.th}>Division</th>
                      <th style={S.th}>Submitted</th>
                      <th style={S.th}>Confirmed</th>
                      <th style={S.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nonFinalSubmissions.map((r) => (
                      <tr key={`${r.workoutId}_${r.participant}`}>
                        <td style={tdBold}>{r.workoutName}</td>
                        <td style={tdBold}>{r.participant}</td>
                        <td style={S.td}>{r.division || "—"}</td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 900 }}>{r.submittedValue}</div>
                          <div style={S.muted}>{prettyDateTime(r.submittedAt)}</div>
                        </td>
                        <td style={S.td}>
                          {r.confirmedBy ? (
                            <>
                              <div style={{ fontWeight: 900 }}>{r.confirmedBy}</div>
                              <div style={S.muted}>{prettyDateTime(r.confirmedAt)}</div>
                            </>
                          ) : (
                            <span style={S.muted}>—</span>
                          )}
                        </td>
                        <td style={S.td}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Button variant="primary" onClick={() => acceptAsFinal(r)} type="button">
                              Accept as final
                            </Button>
                            <Button onClick={() => startOverrideFinal(r)} type="button">
                              Override
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!nonFinalSubmissions.length ? (
                      <tr>
                        <td style={S.td} colSpan={6}>
                          <span style={S.muted}>Nothing to finalise right now.</span>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {finaliseDraft.workoutId ? (
                <div style={{ ...S.card, marginTop: 12 }}>
                  <div style={{ fontWeight: 950, fontSize: 15 }}>Override final</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>
                    Workout: <b>{finaliseDraft.workoutId}</b> • Athlete: <b>{finaliseDraft.participant}</b>
                  </div>
                  <div style={S.divider} />
                  <Field label="Final value (required)">
                    <input style={S.input} value={finaliseDraft.value} onChange={(e) => setFinaliseDraft((d) => ({ ...d, value: e.target.value }))} />
                  </Field>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <Button variant="primary" onClick={saveOverrideFinal} type="button">
                      Save final
                    </Button>
                    <Button onClick={() => setFinaliseDraft({ workoutId: "", participant: "", value: "" })} type="button">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {headJudgeView === "live_entry" && c.type === "live" ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 950, fontSize: 15 }}>Live score entry (full workout)</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>
                    Enter scores for every athlete for one workout. Scorecard image URL is required for each athlete.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={S.pill}>
                    <span style={{ opacity: 0.8 }}>Workout</span>
                    <Select
                      value={livePickWorkoutId}
                      onChange={(v) => {
                        setLivePickWorkoutId(v);
                        setLiveScoreDraft({});
                        // prime with existing values
                        setTimeout(primeLiveDraft, 0);
                      }}
                      options={(c.workouts || []).map((w) => ({ value: w.id, label: w.name }))}
                      style={{ width: 340 }}
                    />
                  </div>
                  <Button onClick={primeLiveDraft} type="button">Load existing</Button>
                  <Button variant="primary" onClick={saveLiveWorkoutScores} type="button">
                    Save full workout
                  </Button>
                </div>
              </div>

              <div style={S.divider} />

              {!liveSelectedWorkout ? (
                <div style={S.muted}>Select a workout.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Athlete</th>
                        <th style={S.th}>Division</th>
                        <th style={S.th}>Score (required)</th>
                        <th style={S.th}>Scorecard image URL (required)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participantList.map((p) => {
                        const entry = liveScoreDraft[p] || { value: "", scorecardImageUrl: "" };
                        return (
                          <tr key={p}>
                            <td style={{ ...S.td, fontWeight: 900 }}>{p}</td>
                            <td style={S.td}>{participantMeta.get(p)?.division || "—"}</td>
                            <td style={S.td}>
                              <input
                                style={S.input}
                                value={entry.value}
                                onChange={(e) =>
                                  setLiveScoreDraft((d) => ({ ...d, [p]: { ...(d[p] || {}), value: e.target.value } }))
                                }
                                placeholder={liveSelectedWorkout.scoreType === "time" ? "e.g. 05:21" : "e.g. 145"}
                              />
                            </td>
                            <td style={S.td}>
                              <input
                                style={S.input}
                                value={entry.scorecardImageUrl}
                                onChange={(e) =>
                                  setLiveScoreDraft((d) => ({ ...d, [p]: { ...(d[p] || {}), scorecardImageUrl: e.target.value } }))
                                }
                                placeholder="Paste image URL of scorecard"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {headJudgeView === "audit" ? <AuditPanel /> : null}
        </div>
      </div>
    );
  }

  /* ================================
ORGANISER VIEW
================================ */
  function SchedulePanel() {
    const c = currentComp;
    if (!c) return null;
    if (c.type !== "online") {
      return (
        <div style={{ ...S.card, padding: 12, marginTop: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>Workout scheduling</div>
          <div style={{ ...S.muted, marginTop: 6 }}>
            Scheduling is mainly used for ONLINE qualifiers. This competition is LIVE — release/close is not enforced.
          </div>
        </div>
      );
    }

    return (
      <div style={{ ...S.card, padding: 12, marginTop: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 900 }}>Workout scheduling (Release + Close)</div>
        <div style={{ ...S.muted, marginTop: 6 }}>
          Athletes cannot see workouts until Release. Leaderboard counts a workout only when it is CLOSED and all finals are in.
        </div>
        <div style={S.divider} />

        <div style={{ display: "grid", gap: 10 }}>
          {(c.workouts || []).map((w) => (
            <div key={w.id} style={{ ...S.card, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 950 }}>{w.name}</div>
                <div style={S.pill}>
                  <span style={{ opacity: 0.8 }}>Status</span>
                  <span style={{ fontWeight: 900 }}>{scheduleLabel(w)}</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <Field label="Release (datetime-local)">
                  <input
                    type="datetime-local"
                    style={S.input}
                    value={isoToLocalInput(w?.schedule?.releaseAt || "")}
                    onChange={(e) =>
                      updateComp(c.id, (comp) => {
                        const ww = (comp.workouts || []).find((x) => x.id === w.id);
                        if (!ww) return comp;
                        ww.schedule = ww.schedule || {};
                        ww.schedule.releaseAt = localInputToIso(e.target.value);
                        return comp;
                      })
                    }
                  />
                </Field>
                <Field label="Close (datetime-local)">
                  <input
                    type="datetime-local"
                    style={S.input}
                    value={isoToLocalInput(w?.schedule?.closeAt || "")}
                    onChange={(e) =>
                      updateComp(c.id, (comp) => {
                        const ww = (comp.workouts || []).find((x) => x.id === w.id);
                        if (!ww) return comp;
                        ww.schedule = ww.schedule || {};
                        ww.schedule.closeAt = localInputToIso(e.target.value);
                        return comp;
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function CreateEventPanel() {
    return (
      <div style={{ ...S.card, marginTop: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Create New Event</div>
        <div style={{ ...S.muted, marginTop: 6 }}>
          Create an ONLINE qualifier or LIVE in-person event. LIVE requires workouts + athletes so the Head Judge can enter scores + scorecard images.
        </div>

        <div style={S.divider} />

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Event type">
              <Select
                value={createDraft.type}
                onChange={(v) => setCreateDraft((d) => ({ ...d, type: v }))}
                options={[
                  { value: "online", label: "ONLINE qualifier" },
                  { value: "live", label: "LIVE in-person" },
                ]}
              />
            </Field>
            <Field label="Date">
              <input
                style={S.input}
                value={createDraft.date}
                onChange={(e) => setCreateDraft((d) => ({ ...d, date: e.target.value }))}
                placeholder="YYYY-MM-DD"
              />
            </Field>
          </div>

          <Field label="Event name">
            <input style={S.input} value={createDraft.name} onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Glasgow Throwdown" />
          </Field>

          <Field label="Location / venue">
            <input style={S.input} value={createDraft.location} onChange={(e) => setCreateDraft((d) => ({ ...d, location: e.target.value }))} placeholder="e.g. Glasgow" />
          </Field>

          <Field label="Description">
            <textarea style={{ ...S.input, minHeight: 90 }} value={createDraft.description} onChange={(e) => setCreateDraft((d) => ({ ...d, description: e.target.value }))} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Divisions (comma separated)">
              <input style={S.input} value={createDraft.divisionsCsv} onChange={(e) => setCreateDraft((d) => ({ ...d, divisionsCsv: e.target.value }))} />
            </Field>
            <Field label="Judge pool (comma separated)">
              <input style={S.input} value={createDraft.judgePoolCsv} onChange={(e) => setCreateDraft((d) => ({ ...d, judgePoolCsv: e.target.value }))} />
            </Field>
            <Field label="Head judge pool (comma separated)">
              <input style={S.input} value={createDraft.headJudgePoolCsv} onChange={(e) => setCreateDraft((d) => ({ ...d, headJudgePoolCsv: e.target.value }))} />
            </Field>
          </div>

          <div style={{ ...S.card, padding: 12 }}>
            <div style={{ fontWeight: 950 }}>Add athletes</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, marginTop: 10 }}>
              <input style={S.input} value={createAthleteName} onChange={(e) => setCreateAthleteName(e.target.value)} placeholder="Athlete name" />
              <Select
                value={createAthleteDivision}
                onChange={setCreateAthleteDivision}
                options={String(createDraft.divisionsCsv || "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
                  .map((d) => ({ value: d, label: d }))}
              />
              <Button variant="primary" onClick={addCreateAthlete} type="button">
                Add
              </Button>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {createAthletes.map((a) => (
                <span key={a.name} style={S.tag}>
                  {a.name} • {a.division}
                </span>
              ))}
              {!createAthletes.length ? <span style={S.muted}>No athletes added yet.</span> : null}
            </div>
          </div>

          <div style={{ ...S.card, padding: 12 }}>
            <div style={{ fontWeight: 950 }}>Add workouts</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginTop: 10 }}>
              <Field label="Workout name">
                <input style={S.input} value={createWorkoutDraft.name} onChange={(e) => setCreateWorkoutDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. WOD 1 — Engine" />
              </Field>
              <Field label="Score type">
                <Select
                  value={createWorkoutDraft.scoreType}
                  onChange={(v) =>
                    setCreateWorkoutDraft((d) => ({
                      ...d,
                      scoreType: v,
                      sort: v === "time" ? "asc" : "desc",
                      unit: v === "time" ? "time (mm:ss)" : d.unit,
                    }))
                  }
                  options={[
                    { value: "time", label: "time" },
                    { value: "reps", label: "reps" },
                    { value: "load", label: "load" },
                    { value: "points", label: "points" },
                  ]}
                />
              </Field>
              <Field label="Sort">
                <Select
                  value={createWorkoutDraft.sort}
                  onChange={(v) => setCreateWorkoutDraft((d) => ({ ...d, sort: v }))}
                  options={[
                    { value: "asc", label: "asc (lower better)" },
                    { value: "desc", label: "desc (higher better)" },
                  ]}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Unit">
                <input style={S.input} value={createWorkoutDraft.unit} onChange={(e) => setCreateWorkoutDraft((d) => ({ ...d, unit: e.target.value }))} placeholder="e.g. time (mm:ss), reps, kg" />
              </Field>
              <Field label="Cap">
                <input style={S.input} value={createWorkoutDraft.cap} onChange={(e) => setCreateWorkoutDraft((d) => ({ ...d, cap: e.target.value }))} placeholder="e.g. 12:00" />
              </Field>
            </div>

            <Field label="Workout description">
              <textarea style={{ ...S.input, minHeight: 80 }} value={createWorkoutDraft.description} onChange={(e) => setCreateWorkoutDraft((d) => ({ ...d, description: e.target.value }))} />
            </Field>

            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" onClick={addCreateWorkout} type="button">
                Add workout
              </Button>
              <div style={S.muted}>Workouts are required for both ONLINE and LIVE events.</div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {createWorkouts.map((w) => (
                <div key={w.id} style={{ ...S.card, padding: 10 }}>
                  <div style={{ fontWeight: 950 }}>{w.name}</div>
                  <div style={S.muted}>
                    {w.scoreType} • {w.unit} • {w.sort} {w.cap ? `• cap ${w.cap}` : ""}
                  </div>
                </div>
              ))}
              {!createWorkouts.length ? <div style={S.muted}>No workouts added yet.</div> : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Button variant="primary" onClick={createNewCompetition} type="button">
              Create event
            </Button>
            <div style={S.muted}>
              After creation: select role <b>Head Judge</b> to enter LIVE scores (or finalise ONLINE submissions).
            </div>
          </div>
        </div>
      </div>
    );
  }

  function OrganiserPanel() {
    const c = currentComp;

    return (
      <div style={{ ...S.row, marginTop: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>Organiser</div>
              <div style={{ ...S.muted, marginTop: 4 }}>
                You have: Quick Controls, scheduling (online), publish leaderboard, and Create New Event (online/live).
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant={orgView === "controls" ? "primary" : "default"} onClick={() => setOrgView("controls")} type="button">
                Controls
              </Button>
              <Button variant={orgView === "schedule" ? "primary" : "default"} onClick={() => setOrgView("schedule")} type="button">
                Scheduling
              </Button>
              <Button variant={orgView === "create" ? "primary" : "default"} onClick={() => setOrgView("create")} type="button">
                Create new event
              </Button>
            </div>
          </div>

          {orgView === "controls" ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...S.card, padding: 12 }}>
                <div style={{ fontWeight: 950, fontSize: 15 }}>Quick Controls</div>
                <div style={{ ...S.muted, marginTop: 6 }}>
                  Publish is gated: no pending adjustments + finals complete (online: for closed workouts; live: all workouts require scores + scorecards).
                </div>
                <div style={S.divider} />
                <div style={{ display: "grid", gap: 10 }}>
                  {c.type === "online" ? (
                    <Toggle
                      checked={data.settings.submissionsClosed}
                      onChange={() => {
                        toggleSetting("submissionsClosed");
                        addAudit(`Submissions ${data.settings.submissionsClosed ? "opened" : "closed"}`);
                      }}
                      label="Close submissions"
                      hint="If on, athletes cannot submit new scores."
                    />
                  ) : (
                    <div style={{ ...S.muted }}>
                      LIVE event: athlete submissions are not used (Head Judge enters all scores).
                    </div>
                  )}

                  <Toggle
                    checked={data.settings.leaderboardPublished}
                    onChange={(next) => setLeaderboardPublished(next)}
                    label="Publish leaderboard"
                    hint={publishStatus.canPublish ? "Ready to publish." : `Blocked: ${publishStatus.reasons[0] || "Incomplete"}`}
                  />
                </div>
              </div>

              <LeaderboardPanel viewerRole="organiser" />
            </div>
          ) : null}

          {orgView === "schedule" ? <SchedulePanel /> : null}
          {orgView === "create" ? <CreateEventPanel /> : null}
        </div>
      </div>
    );
  }

  /* ================================
ADMIN PANEL (organiser only)
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
          <Button variant="danger" onClick={resetDemo} type="button">
            Reset Demo
          </Button>
        </div>
      </div>
    </div>
  );

  /* ================================
COMPETITION PANEL ROOT
================================ */
  const CompetitionPanel = () => {
    if (!currentComp) return <div style={{ ...S.card, marginTop: 14 }}>No competition selected.</div>;
    if (isOrganiser) return <OrganiserPanel />;
    if (isHeadJudge) return <HeadJudgePanel />;
    if (isJudge) return <JudgePanel />;
    return <AthletePanel />;
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        <Header />
        {tab === "competition" ? <CompetitionPanel /> : null}
        {tab === "directory" ? <DirectoryPanel /> : null}
        {tab === "admin" ? <AdminPanel /> : null}
      </div>
      <Toast />
    </div>
  );
}
