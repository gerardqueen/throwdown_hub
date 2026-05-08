import React, { useState, useEffect } from "react";

/* ================================
   LOCAL STORAGE
================================ */
const LS_KEY = "tdh_demo_v1";

function loadData() {
  try {
    const d = localStorage.getItem(LS_KEY);
    return d ? JSON.parse(d) : null;
  } catch {
    return null;
  }
}

function saveData(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

/* ================================
   DEFAULT DEMO DATA
================================ */
const DEFAULT_DATA = {
  role: "spectator",
  mode: "athlete", // athlete | team
  settings: {
    hideLeaderboard: false,
    regClosed: false,
    requireApproval: true,
  },
  competitions: [
    {
      id: "comp1",
      name: "London Throwdown",
      workouts: [
        { id: "w1", name: "Fran", scores: {} },
        { id: "w2", name: "Heavy Clean", scores: {} },
      ],
      athletes: ["Sam", "Jess", "Mike"],
      teams: ["Team Alpha", "Team Beta"],
      leaderboard: [],
      reviewQueue: [],
    },
  ],
};

/* ================================
   MAIN APP
================================ */
export default function App() {
  const [data, setData] = useState(() => loadData() || DEFAULT_DATA);
  const [tab, setTab] = useState("directory");

  useEffect(() => {
    saveData(data);
  }, [data]);

  const comp = data.competitions[0];

  /* ================================
     ROLE CHANGE
  ================================= */
  const setRole = (role) =>
    setData((d) => ({ ...d, role }));

  const toggleMode = () =>
    setData((d) => ({
      ...d,
      mode: d.mode === "athlete" ? "team" : "athlete",
    }));

  const toggleSetting = (key) =>
    setData((d) => ({
      ...d,
      settings: {
        ...d.settings,
        [key]: !d.settings[key],
      },
    }));

  /* ================================
     SCORING
  ================================= */
  const submitScore = (workoutId, name, score) => {
    setData((d) => {
      const c = d.competitions[0];
      const w = c.workouts.find((x) => x.id === workoutId);

      w.scores[name] = {
        value: score,
        status: d.settings.requireApproval ? "pending" : "approved",
      };

      if (d.settings.requireApproval) {
        c.reviewQueue.push({ workoutId, name, score });
      }

      return { ...d };
    });
  };

  const approveScore = (item) => {
    setData((d) => {
      const c = d.competitions[0];
      const w = c.workouts.find((x) => x.id === item.workoutId);

      w.scores[item.name].status = "approved";

      c.reviewQueue = c.reviewQueue.filter(
        (x) => x !== item
      );

      return { ...d };
    });
  };

  /* ================================
     LEADERBOARD
  ================================= */
  const leaderboard = (() => {
    const scores = {};

    comp.workouts.forEach((w) => {
      Object.entries(w.scores).forEach(([name, s]) => {
        if (
          s.status === "approved" ||
          !data.settings.requireApproval
        ) {
          scores[name] = (scores[name] || 0) + Number(s.value);
        }
      });
    });

    return Object.entries(scores)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  })();

  /* ================================
     RESET
  ================================= */
  const reset = () => {
    localStorage.removeItem(LS_KEY);
    setData(DEFAULT_DATA);
  };

  /* ================================
     UI
  ================================= */
  return (
    <div style={{ padding: 20, color: "white", background: "#111", minHeight: "100vh" }}>
      <h1>Throwdown Hub Demo</h1>

      {/* ROLE */}
      <div>
        <strong>Role:</strong>
        {["spectator", "athlete", "judge", "head judge", "organiser"].map((r) => (
          <button key={r} onClick={() => setRole(r)} style={{ margin: 5 }}>
            {r}
          </button>
        ))}
      </div>

      {/* MODE */}
      <button onClick={toggleMode}>
        Mode: {data.mode}
      </button>

      {/* SETTINGS */}
      <div>
        <button onClick={() => toggleSetting("hideLeaderboard")}>
          Toggle Leaderboard
        </button>
        <button onClick={() => toggleSetting("regClosed")}>
          Toggle Registration
        </button>
        <button onClick={() => toggleSetting("requireApproval")}>
          Toggle Approval
        </button>
      </div>

      {/* TABS */}
      <div>
        {["directory", "competition"].map((t) => (
          <button key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* DIRECTORY */}
      {tab === "directory" && (
        <div>
          <h2>Events Directory</h2>
          <p>Demo only — add backend later</p>
        </div>
      )}

      {/* COMPETITION */}
      {tab === "competition" && (
        <div>
          <h2>{comp.name}</h2>

          {/* WORKOUTS */}
          {comp.workouts.map((w) => (
            <div key={w.id}>
              <h3>{w.name}</h3>

              {(data.mode === "athlete"
                ? comp.athletes
                : comp.teams
              ).map((name) => (
                <div key={name}>
                  {name}
                  {(data.role === "judge" ||
                    data.role === "organiser") && (
                    <button
                      onClick={() =>
                        submitScore(w.id, name, Math.floor(Math.random() * 100))
                      }
                    >
                      Submit Score
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* REVIEW */}
          {data.role === "head judge" && (
            <div>
              <h3>Review Queue</h3>
              {comp.reviewQueue.map((item, i) => (
                <div key={i}>
                  {item.name} - {item.score}
                  <button onClick={() => approveScore(item)}>
                    Approve
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* LEADERBOARD */}
          {!data.settings.hideLeaderboard && (
            <div>
              <h3>Leaderboard</h3>
              {leaderboard.map((l, i) => (
                <div key={i}>
                  {i + 1}. {l.name} - {l.total}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={reset}>Reset Demo</button>
    </div>
  );
}