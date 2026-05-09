import React, { useEffect, useMemo, useRef, useState } from "react";import React, { useEffect, useMemo, use — Single-file Demo App.jsx (Role-specific UX)
 * Improvements:
 * - Division leaderboards (Overall + per division tabs)
 * - Workout scaling per division (description/standards/equipment/unit/cap overrides)
 * - Missing workout scores show as 0 (instead of blank) in leaderboards ("0s")
 * - Fixes prior build issues (missing bracket + broken anchors)
 *
 * Workflow:
 * - Athlete/Team Manager submits online score (per workout, per division rules)
 * - Judge reviews submissions and creates adjustments
 * - Head Judge confirms adjustments -> FINAL scores
 * - Organiser can set workouts, scaling, and live windows, and hide leaderboard / close submissions
 */

/* ================================
   LOCAL STORAGE
================================ */
const LS_KEY = "tdh_single_file_demo_v4";

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
  const d = new Date(isoDate + "T00:00:00");
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

function csvToArr(csv) {
  return String(csv || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/* ================================
   ROLES
================================ */
const ROLES = ["spectator", "athlete", "team_manager", "judge", "head_judge", "organiser"];

/* ================================
   DEFAULT DEMO DATA
================================ */
function defaultWindow(hoursFromNowOpen, hoursDuration) {
  const now = new Date();
  const open = new Date(now.getTime() + hoursFromNowOpen * 3600 * 1000);
  const close = new Date(open.getTime() + hoursDuration * 3600 * 1000);
  return { openAt: open.toISOString(), closeAt: close.toISOString() };
}

/**
 * scalingByDivision: per-division overrides for the workout.
 * If a division is missing, the base workout fields apply.
 */
const DEFAULT_DATA = {
  meta: { version: 4, createdAt: new Date().toISOString() },

  role: "spectator",
  mode: "athlete", // athlete | team

  ui: {
    tab: "competition", // directory | competition | admin
    compId: "comp_london",
  },

  settings: {
    hideLeaderboard: false,
    submissionsClosed: false,
    finalOnlyLeaderboard: false, // non-staff see only FINAL if true
    allowProvisionalForStaff: true, // staff can still see provisional when final-only is on
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

  competitions: [
    {
      id: "comp_london",
      name: "London Throwdown (Online Qualifier Demo)",
      date: "2026-06-20",
      location: "London",
      description:
        "Role-based demo: athletes submit online scores, judges adjust, head judge confirms. Organiser controls workouts + scaling + live windows.",
      divisions: ["RX", "Scaled", "Intermediate", "Masters 35+"],

      athletes: [
        { name: "Sam Carter", division: "RX" },
        { name: "Jess Morgan", division: "Scaled" },
        { name: "Mike Patel", division: "Intermediate" },
        { name: "Aisha Khan", division: "Masters 35+" },
      ],
      teams: [
        { name: "Team Alpha", division: "RX", members: ["Sam Carter", "Aisha Khan"] },
        { name: "Team Beta", division: "Scaled", members: ["Jess Morgan", "Mike Patel"] },
      ],

      workouts: [
        {
          id: "w1",
          name: "Qualifier 1 — Engine",
          divisionNotes: "All divisions (scaled options below)",
          scoreType: "time",
          sort: "asc",
          unit: "sec",
          cap: "12:00",
          tiebreak: "Split time at round 6",
          equipment: ["Row erg", "Pull-up bar", "Kettlebell"],
          standards: [
            "Row for calories shown on monitor",
            "Pulling standard: chin over bar or chest-to-bar per division",
            "KB swings overhead (American) – arms locked out",
          ],
          description:
            "For time: 30/24 cal row, 30 pull-ups / C2B (per division), 60 KB swings (per division load).",
          media: { demoVideoUrl: "", scorecardUrl: "" },
          liveWindow: defaultWindow(2, 72),
          scalingByDivision: {
            RX: {
              equipment: ["Row erg", "Pull-up bar", "KB 24/16"],
              standards: ["Chest-to-bar", "KB 24/16"],
              description:
                "RX: 30/24 cal row, 30 C2B, 60 American KB swings (24/16).",
            },
            "Masters 35+": {
              equipment: ["Row erg", "Pull-up bar", "KB 20/12"],
              standards: ["Chest-to-bar OR pull-ups allowed (masters)", "KB 20/12"],
              description:
                "Masters: 30/24 cal row, 30 pull-ups (or C2B), 60 American KB swings (20/12).",
            },
            Intermediate: {
              equipment: ["Row erg", "Pull-up bar", "KB 20/12"],
              standards: ["Pull-ups", "KB 20/12"],
              description:
                "Intermediate: 30/24 cal row, 30 pull-ups, 60 American KB swings (20/12).",
            },
            Scaled: {
              equipment: ["Row erg", "Pull-up bar", "KB 16/12"],
              standards: ["Jumping pull-ups allowed", "KB 16/12"],
              description:
                "Scaled: 30/24 cal row, 30 jumping pull-ups, 60 American KB swings (16/12).",
            },
          },
        },
        {
          id: "w2",
          name: "Qualifier 2 — AMRAP",
          divisionNotes: "Scaled uses lighter DB + step-overs",
          scoreType: "reps",
          sort: "desc",
          unit: "reps",
          cap: "15:00",
          tiebreak: "Time to finish round 5",
          equipment: ["Dumbbells", "Box", "Floor space"],
          standards: [
            "DB snatch: one head touches floor each rep",
            "Box jump overs: two-foot takeoff (unless scaled option)",
            "Burpee over DB: chest + thighs touch floor",
          ],
          description:
            "AMRAP 15: 10 DB snatch, 12 box jump overs, 14 burpee over DB.",
          media: { demoVideoUrl: "", scorecardUrl: "" },
          liveWindow: defaultWindow(2, 72),
          scalingByDivision: {
            RX: { equipment: ["DB 22.5/15", "Box 24/20"], standards: ["DB 22.5/15", "BJO 24/20"] },
            Intermediate: { equipment: ["DB 20/12.5", "Box 24/20"], standards: ["DB 20/12.5"] },
            "Masters 35+": { equipment: ["DB 20/12.5", "Box 20/18"], standards: ["Lower box option 20/18"] },
            Scaled: {
              equipment: ["DB 15/10", "Box 20/18"],
              standards: ["Box step-over allowed", "DB 15/10"],
              description:
                "Scaled: AMRAP 15 — 10 DB snatch (15/10), 12 box step-overs (20/18), 14 burpee over DB.",
            },
          },
        },
        {
          id: "w3",
          name: "Qualifier 3 — Strength Ladder",
          divisionNotes: "RX: clean & jerk, others: clean only",
          scoreType: "load",
          sort: "desc",
          unit: "kg",
          cap: "10:00",
          tiebreak: "Fastest time to heaviest successful lift",
          equipment: ["Barbell", "Plates", "Collars"],
          standards: [
            "Full lockout overhead required for C&J (RX)",
            "No bouncing on shoulders between reps",
            "Video must show plates clearly",
          ],
          description:
            "Build to a heavy complex within 10 minutes (division dependent).",
          media: { demoVideoUrl: "", scorecardUrl: "" },
          liveWindow: defaultWindow(2, 72),
          scalingByDivision: {
            RX: { description: "RX: build to heavy (1 clean + 1 jerk)." },
            Intermediate: { description: "Intermediate: build to heavy single clean." },
            "Masters 35+": { description: "Masters: build to heavy single clean." },
            Scaled: { description: "Scaled: build to heavy single clean (technique focus)." },
          },
        },
      ],

      submissions: {}, // submissions[workoutId][participant]
      adjustments: [], // awaiting head judge etc
      finalScores: {}, // finalScores[workoutId][participant]

      judgePool: ["Jordan Lee", "Taylor Price", "Charlie Scott"],
      headJudgePool: ["Harper Adams"],

      audit: [],
    },
  ],
};

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
  headerRow: { display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  title: { fontSize: 22, fontWeight: 900, letterSpacing: 0.2 },
  subTitle: { fontSize: 12, opacity: 0.8, marginTop: 2 },
  card: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 14,
    boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
  },
  row: { display: "flex", gap: 12, flexWrap: "wrap" },
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
  label: { fontSize: 12, opacity: 0.85, fontWeight: 800 },
  muted: { opacity: 0.78, fontSize: 12 },
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
  th: { textAlign: "left", fontSize: 12, opacity: 0.8, padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.12)" },
  td: { padding: "10px", borderBottom: "1px solid rgba(255,255,255,0.08)", verticalAlign: "top", fontSize: 13 },
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
  const [toast, setToast] = useState(null); // { type, msg }

  useEffect(() => saveData(data), [data]);

  const role = data.role;
  const mode = data.mode;

  const isStaff = role === "judge" || role === "head_judge" || role === "organiser";
  const isOrganiser = role === "organiser";
  const isJudge = role === "judge";
  const isHeadJudge = role === "head_judge";
  const isAthleteSide = role === "athlete" || role === "team_manager";

  const currentComp = useMemo(() => {
    const found = data.competitions.find((c) => c.id === data.ui.compId);
    return found || data.competitions[0];
  }, [data.competitions, data.ui.compId]);

  const now = Date.now();

  function showToast(type, msg) {
    setToast({ type, msg });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2600);
  }

  function resetDemo() {
    localStorage.removeItem(LS_KEY);
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

  // Export/import
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

  // Participants
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
    // also include any division found on participants
    for (const [, meta] of participantMeta.entries()) {
      if (meta.division) set.add(meta.division);
    }
    return Array.from(set);
  }, [currentComp, participantMeta]);

  // Workout scaling merge
  function workoutForDivision(workout, division) {
    const scaled = workout?.scalingByDivision?.[division];
    if (!scaled) return workout;
    return {
      ...workout,
      ...scaled,
      // If scaled overrides equipment/standards, ensure arrays
      equipment: Array.isArray(scaled.equipment) ? scaled.equipment : workout.equipment,
      standards: Array.isArray(scaled.standards) ? scaled.standards : workout.standards,
      // allow unit/cap overrides if present
      unit: scaled.unit || workout.unit,
      cap: scaled.cap || workout.cap,
    };
  }

  // Workout live logic
  function workoutIsLive(w) {
    const open = w.liveWindow?.openAt ? new Date(w.liveWindow.openAt).getTime() : null;
    const close = w.liveWindow?.closeAt ? new Date(w.liveWindow.closeAt).getTime() : null;
    if (open && now < open) return false;
    if (close && now > close) return false;
    return true;
  }

  function workoutLiveLabel(w) {
    const live = workoutIsLive(w);
    const openAt = w.liveWindow?.openAt;
    const closeAt = w.liveWindow?.closeAt;
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
     Athlete submissions
  ================================ */
  const [athleteView, setAthleteView] = useState("workouts"); // workouts | submit | leaderboard | my_submissions
  const [mySelection, setMySelection] = useState(() => participantList[0] || "");
  const [lbDivision, setLbDivision] = useState("Overall"); // Overall or division

  useEffect(() => {
    if (!participantList.includes(mySelection)) {
      setMySelection(participantList[0] || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, data.ui.compId, participantList.join("|")]);

  // Keep lbDivision valid
  useEffect(() => {
    const opts = ["Overall", ...compDivisions];
    if (!opts.includes(lbDivision)) setLbDivision("Overall");
  }, [compDivisions, lbDivision]);

  const [submitDraft, setSubmitDraft] = useState({
    workoutId: "",
    value: "",
    videoUrl: "",
    notes: "",
  });

  useEffect(() => {
    const firstWorkout = currentComp?.workouts?.[0]?.id || "";
    setSubmitDraft((d) => ({ ...d, workoutId: firstWorkout }));
  }, [data.ui.compId]);

  function submitOnlineScore() {
    const comp = currentComp;
    if (!comp) return;

    if (submissionsClosed) {
      showToast("warn", "Submissions are closed by the organiser.");
      return;
    }

    const wBase = comp.workouts.find((x) => x.id === submitDraft.workoutId);
    if (!wBase) return;

    const participant = mySelection;
    if (!participant) {
      showToast("warn", "Select an athlete/team.");
      return;
    }

    const division = participantMeta.get(participant)?.division || "";
    const w = workoutForDivision(wBase, division);

    if (!workoutIsLive(wBase)) {
      showToast("warn", "This workout is not live right now.");
      return;
    }

    const n = toNumberOrNull(submitDraft.value);
    if (n === null) {
      showToast("warn", "Score must be a number.");
      return;
    }

    updateComp(comp.id, (c) => {
      c.submissions = c.submissions || {};
      c.submissions[wBase.id] = c.submissions[wBase.id] || {};
      c.submissions[wBase.id][participant] = {
        value: n,
        videoUrl: submitDraft.videoUrl || "",
        notes: submitDraft.notes || "",
        submittedAt: new Date().toISOString(),
        status: "submitted",
        judgeNote: "",
        division,
      };
      return c;
    });

    addAudit(`Online submission: ${participant} (${division}) submitted ${n} for ${w.name}`);
    showToast("ok", "Submitted! Judge will review.");
  }

  /* ================================
     Judge review & adjust
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
          status: s.status,
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
        const blob = `${r.participant} ${r.workoutName} ${r.division} ${r.notes}`.toLowerCase();
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

    const n = toNumberOrNull(adjustDraft.adjustedValue);
    if (n === null) {
      showToast("warn", "Adjusted score must be a number.");
      return;
    }

    const w = c.workouts.find((x) => x.id === adjustDraft.workoutId);
    if (!w) return;

    const original = c.submissions?.[w.id]?.[adjustDraft.participant];
    if (!original) {
      showToast("warn", "Original submission not found.");
      return;
    }

    updateComp(c.id, (draft) => {
      draft.adjustments = draft.adjustments || [];
      draft.adjustments.unshift({
        id: adjustDraft.id,
        workoutId: w.id,
        workoutName: w.name,
        participant: adjustDraft.participant,
        division: original.division || participantMeta.get(adjustDraft.participant)?.division || "",
        originalValue: original.value,
        adjustedValue: n,
        judgeName: judgeName || "Judge",
        judgeNote: adjustDraft.note || "",
        adjustedAt: new Date().toISOString(),
        status: "awaiting_head_judge",
      });

      draft.submissions = draft.submissions || {};
      draft.submissions[w.id] = draft.submissions[w.id] || {};
      draft.submissions[w.id][adjustDraft.participant] = {
        ...draft.submissions[w.id][adjustDraft.participant],
        status: "submitted",
        judgeNote: adjustDraft.note || "",
      };

      return draft;
    });

    addAudit(
      `Judge adjusted ${adjustDraft.participant} on ${w.name}: ${original.value} -> ${n} (awaiting head judge)`
    );
    showToast("ok", "Adjustment sent to Head Judge.");
    setAdjustDraft({ id: "", workoutId: "", participant: "", adjustedValue: "", note: "" });
  }

  /* ================================
     Head Judge confirm adjustments
  ================================ */
  const [headJudgeView, setHeadJudgeView] = useState("confirm"); // confirm | leaderboard | audit
  const [headJudgeName, setHeadJudgeName] = useState(() => currentComp?.headJudgePool?.[0] || "Head Judge");

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

    updateComp(c.id, (draft) => {
      draft.finalScores = draft.finalScores || {};
      draft.finalScores[adj.workoutId] = draft.finalScores[adj.workoutId] || {};
      draft.finalScores[adj.workoutId][adj.participant] = {
        value: adj.adjustedValue,
        confirmedBy: headJudgeName || "Head Judge",
        confirmedAt: new Date().toISOString(),
        note: adj.judgeNote || "",
        division: adj.division || "",
      };

      const item = (draft.adjustments || []).find((x) => x.id === adjId);
      if (item) item.status = "confirmed";

      return draft;
    });

    addAudit(
      `Head Judge confirmed adjustment for ${adj.participant} (${adj.division}) on ${adj.workoutName}: final=${adj.adjustedValue}`
    );
    showToast("ok", "Confirmed -> Final score updated.");
  }

  function rejectAdjustment(adjId, reason) {
    const c = currentComp;
    if (!c) return;

    const adj = (c.adjustments || []).find((x) => x.id === adjId);
    if (!adj) return;

    updateComp(c.id, (draft) => {
      const item = (draft.adjustments || []).find((x) => x.id === adjId);
      if (item) {
        item.status = "rejected";
        item.headJudgeNote = reason || "Rejected";
      }

      draft.submissions = draft.submissions || {};
      draft.submissions[adj.workoutId] = draft.submissions[adj.workoutId] || {};
      const sub = draft.submissions[adj.workoutId][adj.participant];
      if (sub) {
        sub.status = "needs_change";
        sub.judgeNote = reason || "Please resubmit / clarify score evidence.";
      }

      return draft;
    });

    addAudit(
      `Head Judge rejected adjustment for ${adj.participant} (${adj.division}) on ${adj.workoutName}: ${reason || "no note"}`
    );
    showToast("ok", "Rejected (athlete marked needs change).");
  }

  /* ================================
     Leaderboard (division tabs + 0s)
================================ */
  const leaderboard = useMemo(() => {
    const c = currentComp;
    if (!c) return [];

    const privileged = isStaff && staffCanSeeProvisional;
    const showProvisional = !finalOnly || privileged;

    // Base participants list (so everyone appears with 0s)
    const participants =
      mode === "athlete"
        ? (c.athletes || []).map((a) => ({ name: a.name, division: a.division }))
        : (c.teams || []).map((t) => ({ name: t.name, division: t.division }));

    const rows = new Map();
    participants.forEach((p) => {
      rows.set(p.name, { name: p.name, division: p.division || "", total: 0, per: {} });
    });

    // For each workout, choose effective score per participant:
    // - finalScores (best)
    // - else (if showProvisional) awaiting adjustment (adjustedValue)
    // - else (if showProvisional) submission value
    // - else missing => 0
    for (const w of c.workouts || []) {
      const finals = c.finalScores?.[w.id] || {};

      const awaiting = (c.adjustments || [])
        .filter((a) => a.workoutId === w.id && a.status === "awaiting_head_judge")
        .sort((a, b) => String(b.adjustedAt || "").localeCompare(String(a.adjustedAt || "")));
      const awaitingBy = new Map();
      awaiting.forEach((a) => {
        if (!awaitingBy.has(a.participant)) awaitingBy.set(a.participant, a);
      });

      const subs = c.submissions?.[w.id] || {};

      for (const p of participants) {
        const r = rows.get(p.name);
        if (!r) continue;

        let value = 0;
        let status = "0";
        if (finals[p.name]) {
          value = Number(finals[p.name].value || 0);
          status = "FINAL";
        } else if (showProvisional && awaitingBy.get(p.name)) {
          const a = awaitingBy.get(p.name);
          value = Number(a.adjustedValue || 0);
          status = "ADJUSTED";
        } else if (showProvisional && subs[p.name] && subs[p.name].status !== "withdrawn") {
          value = Number(subs[p.name].value || 0);
          status = subs[p.name].status || "submitted";
        } else {
          value = 0;
          status = "0";
        }

        r.per[w.id] = { value, unit: w.unit, status };
        r.total += value;
      }
    }

    const arr = Array.from(rows.values());
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [currentComp, mode, isStaff, staffCanSeeProvisional, finalOnly]);

  const leaderboardFiltered = useMemo(() => {
    if (lbDivision === "Overall") return leaderboard;
    return leaderboard.filter((r) => r.division === lbDivision);
  }, [leaderboard, lbDivision]);

  /* ================================
     Organiser: workouts + scaling editor + scheduling
================================ */
  const [orgView, setOrgView] = useState("workouts"); // workouts | schedule | controls | audit
  const [workoutEditor, setWorkoutEditor] = useState(null); // {mode, draft}

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
      const idx = c.workouts.findIndex((x) => x.id === draftWorkout.id);
      if (idx >= 0) c.workouts[idx] = draftWorkout;
      else c.workouts.push(draftWorkout);

      c.submissions = c.submissions || {};
      c.submissions[draftWorkout.id] = c.submissions[draftWorkout.id] || {};
      c.finalScores = c.finalScores || {};
      c.finalScores[draftWorkout.id] = c.finalScores[draftWorkout.id] || {};

      return c;
    });

    addAudit(`${workoutEditor.mode === "new" ? "Created" : "Updated"} workout: ${draftWorkout.name}`);
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
     UI: header & tabs
================================ */
  const tab = data.ui.tab;

  const Header = () => (
    <div style={S.headerRow}>
      <div>
        <div style={S.title}>Throwdown Hub — Role‑based Demo (Divisions + Scaling)</div>
        <div style={S.subTitle}>
          Athletes submit → Judges adjust → Head Judge confirms → Organiser controls workouts + scaling + live windows
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={S.pill}>
          <strong>Role</strong>
          <Select value={data.role} onChange={setRole} options={ROLES} style={{ padding: "6px 8px", borderRadius: 999 }} />
        </div>

        <div style={S.pill}>
          <strong>Mode</strong>
          <Button variant="primary" onClick={toggleMode} style={{ padding: "6px 10px", borderRadius: 999 }}>
            {mode === "athlete" ? "Athlete" : "Team"}
          </Button>
        </div>

        <Field label="Competition" style={{ minWidth: 260 }}>
          <Select value={data.ui.compId} onChange={setCompId} options={data.competitions.map((c) => c.id)} />
        </Field>

        <Button onClick={exportAll}>Export All</Button>
        <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
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
      <Button variant={tab === "competition" ? "primary" : "default"} onClick={() => setTab("competition")}>
        Competition
      </Button>
      <Button variant={tab === "directory" ? "primary" : "default"} onClick={() => setTab("directory")}>
        Directory (lite)
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
        <div style={{ fontWeight: 900, fontSize: 12, letterSpacing: 0.2 }}>{toast.type === "ok" ? "Done" : "Note"}</div>
        <div style={{ marginTop: 4, fontSize: 13 }}>{toast.msg}</div>
      </div>
    ) : null;

  /* ================================
     DIRECTORY (lite placeholder)
================================ */
  const DirectoryPanel = () => {
    const evt = data.directory.events?.[0];
    return (
      <div style={{ ...S.row, marginTop: 14 }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Events Directory (lite)</div>
          <div style={S.muted}>Qualifier workflow demo. You can reinsert your full calendar/list directory here.</div>
          <div style={S.divider} />
          {evt ? (
            <div style={S.card}>
              <div style={{ fontWeight: 900, fontSize: 15 }}>{evt.name}</div>
              <div style={S.muted}>
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
                    #{t}
                  </span>
                ))}
              </div>
              {evt.instagram ? (
                <div style={{ marginTop: 8, ...S.muted }}>
                  IG: <strong>{evt.instagram}</strong>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={S.muted}>No events in directory.</div>
          )}
        </div>
      </div>
    );
  };

  /* ================================
     COMPETITION: role-specific shells
================================ */
  const CompetitionPanel = () => {
    if (!currentComp) return <div style={{ ...S.card, marginTop: 14 }}>No competition selected.</div>;

    return (
      <div style={{ ...S.row, marginTop: 14 }}>
        <div style={{ flex: "1 1 760px", ...S.card }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 950 }}>{currentComp.name}</div>
              <div style={S.muted}>
                {prettyDate(currentComp.date)} • {currentComp.location} • {currentComp.description}
              </div>
            </div>
            <div style={S.pill}>
              <strong>Role view:</strong> {role}
            </div>
          </div>

          <div style={S.divider} />

          {role === "spectator" ? <SpectatorView /> : null}
          {isAthleteSide ? <AthleteTeamView /> : null}
          {isJudge ? <JudgeView /> : null}
          {isHeadJudge ? <HeadJudgeView /> : null}
          {isOrganiser ? <OrganiserView /> : null}
        </div>

        <div style={{ flex: "0 0 360px", ...S.card, alignSelf: "flex-start" }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Competition Status</div>
          <div style={S.divider} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={S.pill}>
              <strong>Submissions</strong> {submissionsClosed ? "Closed" : "Open"}
            </div>
            <div style={S.pill}>
              <strong>Leaderboard</strong> {leaderboardHidden ? "Hidden" : finalOnly ? "Final-only" : "Provisional"}
            </div>
            <div style={S.pill}>
              <strong>Now</strong> {prettyDateTime(new Date().toISOString())}
            </div>
          </div>

          <div style={S.divider} />

          <div style={{ fontWeight: 900, marginBottom: 6 }}>Workouts (live windows)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(currentComp.workouts || []).map((w) => (
              <div key={w.id} style={{ ...S.card, padding: 10 }}>
                <div style={{ fontWeight: 900 }}>{w.name}</div>
                <div style={S.muted}>{workoutLiveLabel(w)}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={S.tag}>{w.scoreType}</span>
                  <span style={S.tag}>{w.cap}</span>
                </div>
              </div>
            ))}
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
          You can view workouts and the leaderboard (if enabled). Switch role to Athlete/Team Manager to submit.
        </div>

        <div style={S.divider} />

        <WorkoutsList readOnly />
        <div style={S.divider} />
        <LeaderboardPanel />
      </div>
    );
  }

  /* ================================
     ROLE: Athlete / Team Manager
================================ */
  function AthleteTeamView() {
    const myDivision = participantMeta.get(mySelection)?.division || "";

    const mySubs = useMemo(() => {
      const c = currentComp;
      if (!c || !mySelection) return [];
      const rows = [];
      for (const w of c.workouts || []) {
        const s = c.submissions?.[w.id]?.[mySelection];
        if (s) rows.push({ workoutId: w.id, workoutName: w.name, ...s });
      }
      return rows;
    }, [currentComp, mySelection]);

    return (
      <div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button variant={athleteView === "workouts" ? "primary" : "default"} onClick={() => setAthleteView("workouts")}>
            Workouts
          </Button>
          <Button variant={athleteView === "submit" ? "primary" : "default"} onClick={() => setAthleteView("submit")}>
            Submit Score
          </Button>
          <Button variant={athleteView === "my_submissions" ? "primary" : "default"} onClick={() => setAthleteView("my_submissions")}>
            My Submissions
          </Button>
          <Button variant={athleteView === "leaderboard" ? "primary" : "default"} onClick={() => setAthleteView("leaderboard")}>
            Leaderboard
          </Button>

          <div style={{ marginLeft: "auto", minWidth: 280 }}>
            <Field label={mode === "athlete" ? "Athlete" : "Team"}>
              <Select value={mySelection} onChange={setMySelection} options={participantList.length ? participantList : ["—"]} />
            </Field>
          </div>
        </div>

        <div style={S.divider} />

        {athleteView === "workouts" ? <WorkoutsList division={myDivision} /> : null}

        {athleteView === "submit" ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Submit an online score</div>
            <div style={{ ...S.muted, marginTop: 6 }}>
              You can only submit while the workout is LIVE and submissions are open. Your division: <strong>{myDivision || "—"}</strong>
            </div>

            <div style={S.divider} />

            <div style={{ ...S.card, padding: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <Field label="Workout">
                  <Select
                    value={submitDraft.workoutId}
                    onChange={(v) => setSubmitDraft((d) => ({ ...d, workoutId: v }))}
                    options={(currentComp.workouts || []).map((w) => w.id)}
                  />
                </Field>

                <Field label="Score (number)">
                  <input
                    style={S.input}
                    value={submitDraft.value}
                    onChange={(e) => setSubmitDraft((d) => ({ ...d, value: e.target.value }))}
                    placeholder="e.g. 542"
                  />
                </Field>

                <Field label="Video URL (optional)">
                  <input
                    style={S.input}
                    value={submitDraft.videoUrl}
                    onChange={(e) => setSubmitDraft((d) => ({ ...d, videoUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </Field>

                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="Notes (optional)">
                    <input
                      style={S.input}
                      value={submitDraft.notes}
                      onChange={(e) => setSubmitDraft((d) => ({ ...d, notes: e.target.value }))}
                      placeholder="Anything the judge should know…"
                    />
                  </Field>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
                <div style={S.muted}>
                  Workout status:{" "}
                  <strong>
                    {(() => {
                      const w = currentComp.workouts.find((x) => x.id === submitDraft.workoutId);
                      return w ? workoutLiveLabel(w) : "—";
                    })()}
                  </strong>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button variant="primary" onClick={submitOnlineScore} disabled={!mySelection || !submitDraft.workoutId}>
                    Submit
                  </Button>
                  <Button onClick={() => setSubmitDraft((d) => ({ ...d, value: String(Math.floor(Math.random() * 300) + 1) }))}>
                    Random demo score
                  </Button>
                </div>
              </div>

              {submissionsClosed ? (
                <div style={{ ...S.muted, marginTop: 10 }}>
                  Submissions are currently <strong>closed</strong> by the organiser.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {athleteView === "my_submissions" ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>My submissions ({mySelection || "—"})</div>
            <div style={S.divider} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
              {mySubs.map((s) => (
                <div key={s.workoutId} style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>{s.workoutName}</div>
                  <div style={S.muted}>
                    Submitted: {prettyDateTime(s.submittedAt)} • Status: <strong>{s.status}</strong>
                  </div>
                  <div style={{ height: 8 }} />
                  <div style={{ fontWeight: 900 }}>Score: {s.value}</div>

                  {s.videoUrl ? (
                    <div style={{ ...S.muted, marginTop: 6 }}>
                      Video:{" "}
                      <a href={s.videoUrl} target="_blank" rel="noreferrer" style={{ color: "#a7d7ff" }}>
                        Open
                      </a>
                    </div>
                  ) : null}

                  {s.judgeNote ? <div style={{ ...S.muted, marginTop: 6 }}>Judge note: “{s.judgeNote}”</div> : null}
                  {s.notes ? <div style={{ ...S.muted, marginTop: 6 }}>Your note: “{s.notes}”</div> : null}
                </div>
              ))}
              {mySubs.length === 0 ? (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>No submissions yet.</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>Go to “Submit Score” to add your first entry.</div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {athleteView === "leaderboard" ? <LeaderboardPanel /> : null}
      </div>
    );
  }

  /* ================================
     ROLE: Judge
================================ */
  function JudgeView() {
    return (
      <div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button variant={judgeView === "review" ? "primary" : "default"} onClick={() => setJudgeView("review")}>
            Review Submissions
          </Button>
          <Button variant={judgeView === "adjusted_queue" ? "primary" : "default"} onClick={() => setJudgeView("adjusted_queue")}>
            Adjustments Sent
          </Button>
          <Button variant={judgeView === "leaderboard" ? "primary" : "default"} onClick={() => setJudgeView("leaderboard")}>
            Leaderboard
          </Button>

          <div style={{ marginLeft: "auto", minWidth: 260 }}>
            <Field label="Judge identity (demo)">
              <Select value={judgeName} onChange={setJudgeName} options={currentComp.judgePool || ["Judge"]} />
            </Field>
          </div>
        </div>

        <div style={S.divider} />

        {judgeView === "review" ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Submission review</div>
            <div style={{ ...S.muted, marginTop: 6 }}>
              Select a submission → adjust score → it goes to Head Judge to confirm.
            </div>

            <div style={S.divider} />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <Field label="Search">
                <input
                  style={{ ...S.input, width: 260 }}
                  value={judgeFilter.q}
                  onChange={(e) => setJudgeFilter((f) => ({ ...f, q: e.target.value }))}
                  placeholder="participant, workout…"
                />
              </Field>

              <Field label="Workout">
                {/* FIXED: closes the array properly */}
                <Select
                  value={judgeFilter.workoutId}
                  onChange={(v) => setJudgeFilter((f) => ({ ...f, workoutId: v }))}
                  options={["all", ...(currentComp.workouts || []).map((w) => w.id)]}
                  style={{ width: 240 }}
                />
              </Field>

              <Field label="Division">
                <Select
                  value={judgeFilter.division}
                  onChange={(v) => setJudgeFilter((f) => ({ ...f, division: v }))}
                  options={["all", ...compDivisions]}
                  style={{ width: 200 }}
                />
              </Field>

              <Field label="Status">
                <Select
                  value={judgeFilter.status}
                  onChange={(v) => setJudgeFilter((f) => ({ ...f, status: v }))}
                  options={["all", "submitted", "needs_change"]}
                  style={{ width: 180 }}
                />
              </Field>

              <Button onClick={() => setJudgeFilter({ q: "", workoutId: "all", status: "submitted", division: "all" })} style={{ marginLeft: "auto" }}>
                Clear
              </Button>
            </div>

            <div style={S.divider} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
              {judgeFiltered.map((r) => (
                <div key={`${r.workoutId}_${r.participant}`} style={{ ...S.card, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{r.participant}</div>
                      <div style={S.muted}>
                        {r.workoutName} • {r.division || "—"} • {prettyDateTime(r.submittedAt)}
                      </div>
                    </div>
                    <span style={S.tag}>{r.status}</span>
                  </div>

                  <div style={{ height: 8 }} />
                  <div style={{ fontWeight: 900 }}>Submitted score: {r.value}</div>

                  {r.videoUrl ? (
                    <div style={{ ...S.muted, marginTop: 6 }}>
                      Video:{" "}
                      <a href={r.videoUrl} target="_blank" rel="noreferrer" style={{ color: "#a7d7ff" }}>
                        Open
                      </a>
                    </div>
                  ) : null}

                  {r.notes ? <div style={{ ...S.muted, marginTop: 6 }}>Athlete note: “{r.notes}”</div> : null}
                  {r.judgeNote ? <div style={{ ...S.muted, marginTop: 6 }}>Previous judge note: “{r.judgeNote}”</div> : null}

                  <div style={S.divider} />

                  <Button variant="primary" onClick={() => startAdjust(r)}>
                    Adjust / Send to Head Judge
                  </Button>
                </div>
              ))}

              {judgeFiltered.length === 0 ? (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>No submissions match your filters.</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>Switch to Athlete role and submit some demo scores to populate this list.</div>
                </div>
              ) : null}
            </div>

            {adjustDraft.workoutId ? (
              <div style={{ ...S.card, marginTop: 12, padding: 12 }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>Adjust score</div>
                <div style={S.muted}>
                  Participant: <strong>{adjustDraft.participant}</strong> • Workout:{" "}
                  <strong>{currentComp.workouts.find((w) => w.id === adjustDraft.workoutId)?.name || adjustDraft.workoutId}</strong>
                </div>

                <div style={{ height: 10 }} />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                  <Field label="Adjusted value (number)">
                    <input
                      style={S.input}
                      value={adjustDraft.adjustedValue}
                      onChange={(e) => setAdjustDraft((d) => ({ ...d, adjustedValue: e.target.value }))}
                      placeholder="e.g. 512"
                    />
                  </Field>
                  <Field label="Judge note (optional)">
                    <input
                      style={S.input}
                      value={adjustDraft.note}
                      onChange={(e) => setAdjustDraft((d) => ({ ...d, note: e.target.value }))}
                      placeholder="e.g. 2 no-reps"
                    />
                  </Field>
                </div>

                <div style={{ height: 10 }} />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Button onClick={() => setAdjustDraft({ id: "", workoutId: "", participant: "", adjustedValue: "", note: "" })}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={saveAdjustment}>
                    Send to Head Judge
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {judgeView === "adjusted_queue" ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Adjustments you’ve sent</div>
            <div style={S.divider} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
              {(currentComp.adjustments || []).filter((a) => a.judgeName === judgeName).map((a) => (
                <div key={a.id} style={{ ...S.card, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{a.participant}</div>
                      <div style={S.muted}>{a.workoutName} • {a.division || "—"} • {prettyDateTime(a.adjustedAt)}</div>
                    </div>
                    <span style={S.tag}>{a.status}</span>
                  </div>
                  <div style={{ height: 8 }} />
                  <div style={{ fontWeight: 900 }}>Original: {a.originalValue} → Adjusted: {a.adjustedValue}</div>
                  {a.judgeNote ? <div style={{ ...S.muted, marginTop: 6 }}>Note: “{a.judgeNote}”</div> : null}
                  {a.headJudgeNote ? <div style={{ ...S.muted, marginTop: 6 }}>HJ note: “{a.headJudgeNote}”</div> : null}
                </div>
              ))}
              {(currentComp.adjustments || []).filter((a) => a.judgeName === judgeName).length === 0 ? (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>No adjustments sent yet.</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>Go to “Review Submissions” and adjust a score.</div>
                </div>
              ) : null}
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
    const [rejectNote, setRejectNote] = useState("");

    return (
      <div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button variant={headJudgeView === "confirm" ? "primary" : "default"} onClick={() => setHeadJudgeView("confirm")}>
            Confirm Adjustments
          </Button>
          <Button variant={headJudgeView === "leaderboard" ? "primary" : "default"} onClick={() => setHeadJudgeView("leaderboard")}>
            Leaderboard
          </Button>
          <Button variant={headJudgeView === "audit" ? "primary" : "default"} onClick={() => setHeadJudgeView("audit")}>
            Audit
          </Button>

          <div style={{ marginLeft: "auto", minWidth: 260 }}>
            <Field label="Head Judge identity (demo)">
              <Select value={headJudgeName} onChange={setHeadJudgeName} options={currentComp.headJudgePool || ["Head Judge"]} />
            </Field>
          </div>
        </div>

        <div style={S.divider} />

        {headJudgeView === "confirm" ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Adjusted scores awaiting confirmation</div>
            <div style={{ ...S.muted, marginTop: 6 }}>
              Confirmed adjustments become FINAL scores. Rejected ones mark the submission as “needs_change”.
            </div>

            <div style={S.divider} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
              {awaitingAdjustments.map((a) => (
                <div key={a.id} style={{ ...S.card, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{a.participant}</div>
                      <div style={S.muted}>
                        {a.workoutName} • {a.division || "—"} • Judge: <strong>{a.judgeName}</strong> • {prettyDateTime(a.adjustedAt)}
                      </div>
                    </div>
                    <span style={S.tag}>awaiting</span>
                  </div>

                  <div style={{ height: 8 }} />
                  <div style={{ fontWeight: 900 }}>Original: {a.originalValue} → Adjusted: {a.adjustedValue}</div>
                  {a.judgeNote ? <div style={{ ...S.muted, marginTop: 6 }}>Judge note: “{a.judgeNote}”</div> : null}

                  <div style={S.divider} />

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button variant="primary" onClick={() => confirmAdjustment(a.id)}>
                      Confirm -> Final
                    </Button>
                    <Button variant="danger" onClick={() => rejectAdjustment(a.id, rejectNote || "Rejected — please resubmit with clearer evidence.")}>
                      Reject
                    </Button>
                  </div>

                  <div style={{ height: 10 }} />
                  <Field label="Reject note (applies to Reject button)">
                    <input
                      style={S.input}
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder="e.g. Video angle unclear; resubmit…"
                    />
                  </Field>
                </div>
              ))}

              {awaitingAdjustments.length === 0 ? (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>No adjustments awaiting confirmation.</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>Switch to Judge role and adjust a submission to populate this list.</div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {headJudgeView === "leaderboard" ? <LeaderboardPanel /> : null}

        {headJudgeView === "audit" ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Audit log</div>
            <div style={S.divider} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(currentComp.audit || []).map((a) => (
                <div key={a.id} style={{ ...S.card, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{a.message}</div>
                    <div style={S.muted}>{prettyDateTime(a.at)} • {a.whoRole}</div>
                  </div>
                </div>
              ))}
              {(currentComp.audit || []).length === 0 ? (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>No audit entries yet.</div>
                  <div style={{ ...S.muted, marginTop: 6 }}>Submit/adjust/confirm scores to generate audit.</div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* ================================
     ROLE: Organiser
================================ */
  function OrganiserView() {
    return (
      <div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button variant={orgView === "workouts" ? "primary" : "default"} onClick={() => setOrgView("workouts")}>
            Workouts + Scaling
          </Button>
          <Button variant={orgView === "schedule" ? "primary" : "default"} onClick={() => setOrgView("schedule")}>
            Scheduling
          </Button>
          <Button variant={orgView === "controls" ? "primary" : "default"} onClick={() => setOrgView("controls")}>
            Controls
          </Button>
          <Button variant={orgView === "audit" ? "primary" : "default"} onClick={() => setOrgView("audit")}>
            Audit
          </Button>

          <div style={{ marginLeft: "auto" }}>
            <Button variant="primary" onClick={openNewWorkout}>+ Add workout</Button>
          </div>
        </div>

        <div style={S.divider} />

        {orgView === "workouts" ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Workout builder + scaling</div>
            <div style={{ ...S.muted, marginTop: 6 }}>Edit base workout + per-division overrides (scaling).</div>

            <div style={S.divider} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
              {(currentComp.workouts || []).map((w) => (
                <div key={w.id} style={{ ...S.card, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>{w.name}</div>
                      <div style={S.muted}>{w.scoreType} • cap {w.cap} • {workoutLiveLabel(w)}</div>
                    </div>
                    <span style={S.tag}>{w.id}</span>
                  </div>

                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={S.tag}>sort: {w.sort}</span>
                    <span style={S.tag}>unit: {w.unit}</span>
                    <span style={S.tag}>scales: {Object.keys(w.scalingByDivision || {}).length}</span>
                  </div>

                  <div style={S.divider} />

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button variant="primary" onClick={() => openEditWorkout(w)}>Edit</Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`Delete workout "${w.name}"?`)) deleteWorkout(w.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {workoutEditor ? (
              <WorkoutEditorModal
                editor={workoutEditor}
                onClose={() => setWorkoutEditor(null)}
                onSave={saveWorkout}
                divisions={compDivisions}
              />
            ) : null}
          </div>
        ) : null}

        {orgView === "schedule" ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Workout live windows</div>
            <div style={{ ...S.muted, marginTop: 6 }}>Set open/close date-times (browser local time).</div>

            <div style={S.divider} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
              {(currentComp.workouts || []).map((w) => (
                <div key={w.id} style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontWeight: 900 }}>{w.name}</div>
                  <div style={S.muted}>{workoutLiveLabel(w)}</div>

                  <div style={{ height: 10 }} />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Open at">
                      <input
                        style={S.input}
                        type="datetime-local"
                        value={isoToLocalInput(w.liveWindow?.openAt)}
                        onChange={(e) => {
                          const openIso = localInputToIso(e.target.value);
                          updateComp(currentComp.id, (c) => {
                            const ww = c.workouts.find((x) => x.id === w.id);
                            ww.liveWindow = ww.liveWindow || {};
                            ww.liveWindow.openAt = openIso;
                            return c;
                          });
                        }}
                      />
                    </Field>
                    <Field label="Close at">
                      <input
                        style={S.input}
                        type="datetime-local"
                        value={isoToLocalInput(w.liveWindow?.closeAt)}
                        onChange={(e) => {
                          const closeIso = localInputToIso(e.target.value);
                          updateComp(currentComp.id, (c) => {
                            const ww = c.workouts.find((x) => x.id === w.id);
                            ww.liveWindow = ww.liveWindow || {};
                            ww.liveWindow.closeAt = closeIso;
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
        ) : null}

        {orgView === "controls" ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Controls</div>
            <div style={{ ...S.muted, marginTop: 6 }}>Hide leaderboard, close submissions, final-only visibility.</div>

            <div style={S.divider} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
              <div style={{ ...S.card, padding: 12 }}>
                <Toggle
                  checked={data.settings.hideLeaderboard}
                  onChange={() => toggleSetting("hideLeaderboard")}
                  label="Hide leaderboard"
                  hint="Athletes & spectators won’t see the leaderboard at all."
                />
                <div style={{ height: 10 }} />
                <Toggle
                  checked={data.settings.submissionsClosed}
                  onChange={() => toggleSetting("submissionsClosed")}
                  label="Close submissions"
                  hint="Blocks athlete/team online score submissions."
                />
                <div style={{ height: 10 }} />
                <Toggle
                  checked={data.settings.finalOnlyLeaderboard}
                  onChange={() => toggleSetting("finalOnlyLeaderboard")}
                  label="Final-only leaderboard"
                  hint="Non-staff see only FINAL confirmed scores."
                />
                <div style={{ height: 10 }} />
                <Toggle
                  checked={data.settings.allowProvisionalForStaff}
                  onChange={() => toggleSetting("allowProvisionalForStaff")}
                  label="Allow provisional for staff"
                  hint="Staff can still see provisional when final-only is ON."
                />
              </div>

              <div style={{ ...S.card, padding: 12 }}>
                <div style={{ fontWeight: 900 }}>Quick demo actions</div>
                <div style={{ ...S.muted, marginTop: 6 }}>Populate data fast for screenshots.</div>
                <div style={{ height: 10 }} />
                <Button
                  variant="primary"
                  onClick={() => {
                    const w = currentComp.workouts?.[0];
                    if (!w) return;
                    updateComp(currentComp.id, (c) => {
                      c.submissions = c.submissions || {};
                      c.submissions[w.id] = c.submissions[w.id] || {};
                      const participants =
                        mode === "athlete" ? (c.athletes || []).map((a) => ({ name: a.name, division: a.division })) : (c.teams || []).map((t) => ({ name: t.name, division: t.division }));
                      participants.forEach((p) => {
                        c.submissions[w.id][p.name] = {
                          value: Math.floor(Math.random() * 300) + 1,
                          videoUrl: "",
                          notes: "Auto-generated demo submission",
                          submittedAt: new Date().toISOString(),
                          status: "submitted",
                          judgeNote: "",
                          division: p.division,
                        };
                      });
                      return c;
                    });
                    addAudit(`Organiser generated random demo submissions for ${currentComp.workouts?.[0]?.name}`);
                    showToast("ok", "Random submissions generated for workout 1.");
                  }}
                >
                  Generate submissions (workout 1)
                </Button>
                <div style={{ height: 10 }} />
                <Button
                  onClick={() => {
                    updateComp(currentComp.id, (c) => {
                      c.submissions = {};
                      c.adjustments = [];
                      c.finalScores = {};
                      return c;
                    });
                    addAudit("Organiser cleared all submissions/adjustments/final scores");
                    showToast("ok", "Cleared all qualifier scoring data.");
                  }}
                >
                  Clear qualifier data
                </Button>
              </div>
            </div>

            <div style={S.divider} />

            <LeaderboardPanel />
          </div>
        ) : null}

        {orgView === "audit" ? (
          <div>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Audit log</div>
            <div style={S.divider} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(currentComp.audit || []).map((a) => (
                <div key={a.id} style={{ ...S.card, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{a.message}</div>
                    <div style={S.muted}>{prettyDateTime(a.at)} • {a.whoRole}</div>
                  </div>
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
        ) : null}
      </div>
    );
  }

  /* ================================
     Common panels
================================ */
  function WorkoutsList({ readOnly = false, division = "" }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
        {(currentComp.workouts || []).map((wBase) => {
          const w = division ? workoutForDivision(wBase, division) : wBase;
          const scaled = !!(division && wBase.scalingByDivision?.[division]);
          return (
            <div key={wBase.id} style={{ ...S.card, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>{w.name}</div>
                  <div style={S.muted}>
                    {w.scoreType} • cap {w.cap} • <strong>{workoutLiveLabel(wBase)}</strong>
                    {division ? ` • division: ${division}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {scaled ? <span style={S.tag}>SCALED</span> : null}
                  <span style={S.tag}>{w.unit}</span>
                </div>
              </div>

              <div style={{ height: 10 }} />
              <div style={{ fontWeight: 900 }}>Description</div>
              <div style={{ ...S.muted, marginTop: 4 }}>{w.description || "—"}</div>

              <div style={{ height: 10 }} />
              <div style={{ fontWeight: 900 }}>Standards</div>
              <ul style={{ marginTop: 6, marginBottom: 0, paddingLeft: 18, opacity: 0.92 }}>
                {(w.standards || []).slice(0, 8).map((s, i) => (
                  <li key={i} style={{ fontSize: 13, marginBottom: 4 }}>{s}</li>
                ))}
                {(w.standards || []).length === 0 ? <li style={{ fontSize: 13, opacity: 0.7 }}>—</li> : null}
              </ul>

              <div style={{ height: 10 }} />
              <div style={{ fontWeight: 900 }}>Equipment</div>
              <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(w.equipment || []).slice(0, 12).map((e) => (
                  <span key={e} style={S.tag}>{e}</span>
                ))}
                {(w.equipment || []).length === 0 ? <span style={S.tag}>—</span> : null}
              </div>

              <div style={S.divider} />
              <div style={S.muted}>
                Opens: <strong>{prettyDateTime(wBase.liveWindow?.openAt)}</strong><br />
                Closes: <strong>{prettyDateTime(wBase.liveWindow?.closeAt)}</strong><br />
                Tiebreak: <strong>{w.tiebreak || "—"}</strong>
              </div>

              {!readOnly && isAthleteSide ? (
                <div style={{ marginTop: 10, ...S.muted }}>
                  Tip: go to <strong>Submit Score</strong> to enter your result.
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  function LeaderboardPanel() {
    if (leaderboardHidden) {
      return (
        <div style={{ ...S.card, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>Leaderboard hidden</div>
          <div style={{ ...S.muted, marginTop: 6 }}>The organiser has hidden the leaderboard for this competition.</div>
        </div>
      );
    }

    const privileged = isStaff && staffCanSeeProvisional;
    const showProvisional = !finalOnly || privileged;

    const divisionOptions = ["Overall", ...compDivisions];

    return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>
            Leaderboard ({showProvisional ? "Provisional" : "Final-only"}) • Mode: {mode}
          </div>
          <div style={S.muted}>
            {finalOnly && !privileged ? "You are viewing FINAL confirmed scores only." : "Includes provisional where applicable."}
          </div>
        </div>

        <div style={{ ...S.row, marginTop: 10, alignItems: "center" }}>
          <div style={S.pill}>
            <strong>Division</strong>
            <Select value={lbDivision} onChange={setLbDivision} options={divisionOptions} style={{ padding: "6px 8px", borderRadius: 999 }} />
          </div>
          <div style={{ ...S.muted, marginLeft: "auto" }}>
            Showing <strong>{leaderboardFiltered.length}</strong> entries • Missing scores display as <strong>0</strong>
          </div>
        </div>

        <div style={S.divider} />

        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Rank</th>
                <th style={S.th}>{mode === "athlete" ? "Athlete" : "Team"}</th>
                <th style={S.th}>Division</th>
                <th style={S.th}>Total</th>
                {(currentComp.workouts || []).map((w) => (
                  <th key={w.id} style={S.th}>{w.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboardFiltered.map((r, idx) => (
                <tr key={r.name}>
                  <td style={S.td}><div style={{ fontWeight: 900 }}>{idx + 1}</div></td>
                  <td style={S.td}><div style={{ fontWeight: 900 }}>{r.name}</div></td>
                  <td style={S.td}>{r.division || "—"}</td>
                  <td style={S.td}><div style={{ fontWeight: 900 }}>{r.total}</div></td>
                  {(currentComp.workouts || []).map((w) => {
                    const s = r.per[w.id];
                    return (
                      <td key={w.id} style={S.td}>
                        <div style={{ fontWeight: 900 }}>{s ? s.value : 0} {w.unit}</div>
                        <div style={S.muted}>{s ? s.status : "0"}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {leaderboardFiltered.length === 0 ? (
                <tr>
                  <td style={S.td} colSpan={4 + (currentComp.workouts || []).length}>
                    <div style={{ fontWeight: 900 }}>No entries for this division yet.</div>
                    <div style={{ ...S.muted, marginTop: 6 }}>Try “Overall” or submit scores for athletes/teams in this division.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function WorkoutEditorModal({ editor, onClose, onSave, divisions }) {
    const [draft, setDraft] = useState(editor.draft);

    const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

    function setScale(division, patch) {
      setDraft((d) => {
        const next = { ...(d.scalingByDivision || {}) };
        next[division] = { ...(next[division] || {}), ...patch };
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
        <div style={{ ...S.card, width: "min(980px, 100%)", maxHeight: "90vh", overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 18, fontWeight: 950 }}>{editor.mode === "new" ? "Add Workout" : "Edit Workout"}</div>
            <div style={S.muted}>Click outside to close</div>
          </div>

          <div style={S.divider} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <Field label="Name">
              <input style={S.input} value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </Field>

            <Field label="Division notes">
              <input style={S.input} value={draft.divisionNotes} onChange={(e) => set("divisionNotes", e.target.value)} />
            </Field>

            <Field label="Score type">
              <Select value={draft.scoreType} onChange={(v) => set("scoreType", v)} options={["time", "reps", "load", "points"]} />
            </Field>

            <Field label="Sort">
              <Select value={draft.sort} onChange={(v) => set("sort", v)} options={["asc", "desc"]} />
            </Field>

            <Field label="Unit">
              <input style={S.input} value={draft.unit} onChange={(e) => set("unit", e.target.value)} placeholder="sec / reps / kg / pts" />
            </Field>

            <Field label="Cap">
              <input style={S.input} value={draft.cap} onChange={(e) => set("cap", e.target.value)} placeholder="e.g. 12:00" />
            </Field>

            <Field label="Tiebreak">
              <input style={S.input} value={draft.tiebreak} onChange={(e) => set("tiebreak", e.target.value)} placeholder="Optional" />
            </Field>

            <Field label="Equipment (comma separated)">
              <input
                style={S.input}
                value={(draft.equipment || []).join(", ")}
                onChange={(e) => set("equipment", csvToArr(e.target.value))}
              />
            </Field>

            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Description">
                <textarea
                  style={{ ...S.input, minHeight: 90, resize: "vertical" }}
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Standards (comma separated)">
                <input
                  style={S.input}
                  value={(draft.standards || []).join(", ")}
                  onChange={(e) => set("standards", csvToArr(e.target.value))}
                />
              </Field>
            </div>
          </div>

          <div style={S.divider} />

          <div style={{ fontWeight: 950, fontSize: 14 }}>Scaling (per division overrides)</div>
          <div style={{ ...S.muted, marginTop: 4 }}>
            Add overrides for divisions that need different description/standards/equipment/unit/cap.
          </div>

          <div style={{ height: 10 }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 12 }}>
            {divisions.map((div) => {
              const s = draft.scalingByDivision?.[div] || null;
              return (
                <div key={div} style={{ ...S.card, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 950 }}>{div}</div>
                    <span style={S.tag}>{s ? "override" : "base"}</span>
                  </div>

                  <div style={{ height: 10 }} />

                  <Field label="Description override (optional)">
                    <textarea
                      style={{ ...S.input, minHeight: 70, resize: "vertical" }}
                      value={s?.description || ""}
                      onChange={(e) => setScale(div, { description: e.target.value })}
                      placeholder="If blank, base description is used."
                    />
                  </Field>

                  <div style={{ height: 10 }} />

                  <Field label="Standards override (comma separated, optional)">
                    <input
                      style={S.input}
                      value={Array.isArray(s?.standards) ? s.standards.join(", ") : ""}
                      onChange={(e) => setScale(div, { standards: csvToArr(e.target.value) })}
                      placeholder="If blank, base standards are used."
                    />
                  </Field>

                  <div style={{ height: 10 }} />

                  <Field label="Equipment override (comma separated, optional)">
                    <input
                      style={S.input}
                      value={Array.isArray(s?.equipment) ? s.equipment.join(", ") : ""}
                      onChange={(e) => setScale(div, { equipment: csvToArr(e.target.value) })}
                      placeholder="If blank, base equipment is used."
                    />
                  </Field>

                  <div style={{ height: 10 }} />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Unit override (optional)">
                      <input
                        style={S.input}
                        value={s?.unit || ""}
                        onChange={(e) => setScale(div, { unit: e.target.value })}
                        placeholder="e.g. sec"
                      />
                    </Field>
                    <Field label="Cap override (optional)">
                      <input
                        style={S.input}
                        value={s?.cap || ""}
                        onChange={(e) => setScale(div, { cap: e.target.value })}
                        placeholder="e.g. 12:00"
                      />
                    </Field>
                  </div>

                  <div style={{ height: 10 }} />

                  {s ? (
                    <Button variant="danger" onClick={() => removeScale(div)}>
                      Remove override
                    </Button>
                  ) : (
                    <div style={S.muted}>No override set (uses base workout).</div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={S.divider} />

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => onSave(draft)}>
              Save workout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // datetime-local helpers (local time UI)
  function isoToLocalInput(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
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
    <div style={{ ...S.row, marginTop: 14 }}>
      <div style={{ flex: "1 1 760px", ...S.card }}>
        <div style={{ fontSize: 18, fontWeight: 950 }}>Settings / Admin</div>
        <div style={S.muted}>Global demo toggles. Organiser view includes the important qualifier controls.</div>

        <div style={S.divider} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
          <div style={{ ...S.card, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>Global controls</div>
            <div style={{ height: 10 }} />
            <Toggle
              checked={data.settings.hideLeaderboard}
              onChange={() => toggleSetting("hideLeaderboard")}
              label="Hide leaderboard"
            />
            <div style={{ height: 10 }} />
            <Toggle
              checked={data.settings.submissionsClosed}
              onChange={() => toggleSetting("submissionsClosed")}
              label="Close submissions"
            />
            <div style={{ height: 10 }} />
            <Toggle
              checked={data.settings.finalOnlyLeaderboard}
              onChange={() => toggleSetting("finalOnlyLeaderboard")}
              label="Final-only leaderboard"
              hint="Non-staff see only head-judge-confirmed scores."
            />
            <div style={{ height: 10 }} />
            <Toggle
              checked={data.settings.allowProvisionalForStaff}
              onChange={() => toggleSetting("allowProvisionalForStaff")}
              label="Allow provisional for staff"
              hint="Staff can see submissions/awaiting adjustments even in final-only."
            />
          </div>

          <div style={{ ...S.card, padding: 12 }}>
            <div style={{ fontWeight: 900 }}>Workflow summary</div>
            <div style={{ height: 8 }} />
            <ol style={{ margin: 0, paddingLeft: 18, opacity: 0.92 }}>
              <li>Athlete/Team submits score (status: submitted)</li>
              <li>Judge reviews and creates an adjustment (awaiting head judge)</li>
              <li>Head Judge confirms → score becomes FINAL</li>
              <li>Leaderboard tabs show Overall and per-division rankings</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.container}>
        <Header />
        <Tabs />

        {tab === "competition" ? <CompetitionPanel /> : null}
        {tab === "directory" ? <DirectoryPanel /> : null}
        {tab === "admin" ? <AdminPanel /> : null}
      </div>
      <Toast />
    </div>
  );
}
``

/**
