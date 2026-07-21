"use strict";
/* ============================================================
   USA LAHTISED — jagatud loogika (kõik kuus mängu + admin)
   Laadi PÄRAST React'i, Supabase'i ja usopen-data.js faili.
   ============================================================ */
window.USH = (function () {
  const D = window.USOPEN;

  /* ---------------- Supabase ---------------- */
  const SUPABASE_URL = "https://thrsacygpqwbnkcppmpk.supabase.co";
  const SUPABASE_KEY = "sb_publishable_-QaY7mGpitakhestu3w1fg_sCGquRvx";
  let sb = null;
  try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch (err) { console.error("Supabase init:", err); }

  /* ---------------- abifunktsioonid ---------------- */
  function randInt(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[randInt(arr.length)]; }
  function round2(x) { return Math.round(x * 100) / 100; }
  function fmt2(x) { return (+x).toFixed(2); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function buzz(pattern) { if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} } }
  function chipText(hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? "#14141a" : "#ffffff";
  }
  function weightedPick(items, weightOf) {
    let total = 0;
    for (const it of items) total += weightOf(it);
    let r = Math.random() * total;
    for (const it of items) { r -= weightOf(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }

  /* ---------------- andmete abid ---------------- */
  const playerById = {};
  D.players.forEach(p => { playerById[p.id] = p; });
  const matchById = {};
  D.matches.forEach(m => { matchById[m.id] = m; });

  function player(id) { return playerById[id]; }
  function match(id) { return matchById[id]; }
  function favOf(m) { return m.odds1 <= m.odds2 ? { id: m.p1, odds: m.odds1, straight: m.straight1 } : { id: m.p2, odds: m.odds2, straight: m.straight2 }; }
  function dogOf(m) { return m.odds1 > m.odds2 ? { id: m.p1, odds: m.odds1 } : { id: m.p2, odds: m.odds2 }; }
  function matchOf(playerId) { return D.matches.find(m => m.p1 === playerId || m.p2 === playerId) || null; }
  function maxSets(m) { return m.tour === "ATP" ? 5 : 3; }
  function cleanScore(m) { return m.tour === "ATP" ? "3:0" : "2:0"; }

  /* Sloti turud — kasutab ka arveldus */
  const MARKETS = [
    { key: "match",    label: "Võidab matši",
      odds: (m, pid) => pid === m.p1 ? m.odds1 : m.odds2 },
    { key: "clean",    label: "Võidab puhtalt",
      odds: (m, pid) => pid === m.p1 ? m.straight1 : m.straight2 },
    { key: "distance", label: "Matš läheb täispikkuseks",
      odds: (m) => m.totalSets[String(maxSets(m))] },
    { key: "tiebreak", label: "Matšis tuleb kiire lõppmäng (tiebreak)",
      odds: (m) => m.tiebreakYes }
  ];
  const marketByKey = {};
  MARKETS.forEach(mk => { marketByKey[mk.key] = mk; });

  /* ---------------- nimi ---------------- */
  const NAME_KEY = "usopen_name";
  function getName() { return (localStorage.getItem(NAME_KEY) || "").trim(); }
  function saveName(n) { localStorage.setItem(NAME_KEY, n.trim()); }

  /* ---------------- heliefektid ---------------- */
  const SFX = (() => {
    let ctx = null;
    let on = localStorage.getItem("usopen_sfx") !== "0";
    function ac() {
      if (!on) return null;
      try {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === "suspended") ctx.resume();
        return ctx;
      } catch (e) { return null; }
    }
    function beep(freq, dur, type, gain, slideTo) {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      g.gain.setValueAtTime(gain || .08, c.currentTime);
      g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur);
    }
    return {
      isOn: () => on,
      toggle() { on = !on; localStorage.setItem("usopen_sfx", on ? "1" : "0"); return on; },
      click() { beep(700, .06, "square", .05); },
      tick() { beep(1500 + Math.random() * 600, .025, "square", .025); },
      snap() { beep(420, .09, "square", .09); setTimeout(() => beep(880, .12, "sine", .1), 45); },
      win() { [520, 660, 880].forEach((f, i) => setTimeout(() => beep(f, .16, "sine", .1), i * 90)); },
      fanfare() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, .3, "sine", .12), i * 110)); },
      dud() { beep(300, .25, "sine", .07, 160); }
    };
  })();

  /* ---------------- konfetid + emoji-vihm ---------------- */
  const Confetti = (() => {
    const cv = document.getElementById("confetti");
    const cx = cv ? cv.getContext("2d") : null;
    let parts = [], raf = null;
    function resize() { if (cv) { cv.width = innerWidth; cv.height = innerHeight; } }
    resize(); addEventListener("resize", resize);
    const COLORS = ["#ffd54f", "#00e676", "#2478cc", "#ffd400", "#ffffff", "#ff5c6c"];
    function burst(n) {
      if (!cx) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 8;
        parts.push({
          kind: "rect",
          x: cv.width / 2 + (Math.random() - .5) * cv.width * .4,
          y: cv.height * .35 + (Math.random() - .5) * 60,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4,
          w: 5 + Math.random() * 6, h: 3 + Math.random() * 4,
          rot: Math.random() * Math.PI * 2, vr: (Math.random() - .5) * .3,
          col: pick(COLORS), life: 90 + Math.random() * 60
        });
      }
      if (!raf) loop();
    }
    function rain(emojis, n) {
      if (!cx) return;
      for (let i = 0; i < n; i++) {
        parts.push({
          kind: "emoji", txt: pick(emojis),
          x: Math.random() * cv.width, y: -30 - Math.random() * cv.height * .8,
          vx: (Math.random() - .5) * 1.5, vy: 2 + Math.random() * 3,
          size: 22 + Math.random() * 20,
          rot: (Math.random() - .5) * .8, vr: (Math.random() - .5) * .1,
          col: "#fff", life: 400
        });
      }
      if (!raf) loop();
    }
    function loop() {
      raf = requestAnimationFrame(loop);
      cx.clearRect(0, 0, cv.width, cv.height);
      parts = parts.filter(p => p.life > 0 && p.y < cv.height + 40);
      if (!parts.length) { cancelAnimationFrame(raf); raf = null; return; }
      for (const p of parts) {
        if (p.kind === "rect") { p.vy += .18; p.vx *= .985; }
        p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
        cx.save();
        cx.translate(p.x, p.y); cx.rotate(p.rot);
        cx.globalAlpha = Math.min(1, p.life / 40);
        if (p.kind === "rect") {
          cx.fillStyle = p.col;
          cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          cx.font = p.size + "px serif";
          cx.textAlign = "center"; cx.textBaseline = "middle";
          cx.fillText(p.txt, 0, 0);
        }
        cx.restore();
      }
    }
    return { burst, rain };
  })();

  /* ---------------- andmebaas ---------------- */
  function withTimeout(p, ms) {
    return Promise.race([
      Promise.resolve(p),
      new Promise((_, rej) => setTimeout(() => rej(new Error("Ajalõpp — server ei vasta")), ms))
    ]);
  }

  /* Salvesta pilet; tagastab {ok, id} */
  async function saveTicket(t) {
    if (!sb) return { ok: false };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { data, error } = await withTimeout(sb.from("usopen_tickets").insert({
          game: t.game, name: t.name, buy_in: t.buyIn,
          details: t.details, potential_win: t.potentialWin
        }).select("id").single(), 15000);
        if (error) throw error;
        return { ok: true, id: data && data.id };
      } catch (err) { console.error("Pileti salvestus (katse " + attempt + "):", err); }
    }
    return { ok: false };
  }

  async function loadMyTickets(game, name) {
    const { data, error } = await withTimeout(sb.from("usopen_tickets")
      .select("id,game,name,buy_in,details,potential_win,status,win_amount,created_at")
      .eq("game", game).eq("name", name)
      .order("created_at", { ascending: false })
      .limit(20), 15000);
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function loadBoard(game) {
    const { data, error } = await withTimeout(sb.from("usopen_tickets")
      .select("name,buy_in,potential_win,status,win_amount")
      .eq("game", game)
      .order("potential_win", { ascending: false })
      .limit(10), 15000);
    if (error) throw new Error(error.message);
    return data || [];
  }

  /* Tulemused: { matches:{m1:{...}}, players:{a1:{...}} } */
  async function loadResults() {
    const { data, error } = await withTimeout(sb.from("usopen_results")
      .select("id,kind,data"), 15000);
    if (error) throw new Error(error.message);
    const out = { matches: {}, players: {} };
    (data || []).forEach(r => {
      if (r.kind === "match") out.matches[r.id] = r.data;
      else if (r.kind === "player") out.players[r.id] = r.data;
    });
    return out;
  }

  async function saveResult(id, kind, resultData) {
    const { error } = await withTimeout(sb.from("usopen_results")
      .upsert({ id, kind, data: resultData, updated_at: new Date().toISOString() }), 15000);
    if (error) throw new Error(error.message);
  }

  async function updateTicket(id, fields) {
    const { error } = await withTimeout(sb.from("usopen_tickets")
      .update(fields).eq("id", id), 15000);
    if (error) throw new Error(error.message);
  }

  /* ---------------- arveldus ---------------- */
  function parseScore(s) {
    const m = /^(\d)[-:](\d)$/.exec(String(s || "").trim());
    if (!m) return null;
    return { won: +m[1], lost: +m[2], total: +m[1] + +m[2], straight: +m[2] === 0 };
  }

  /* Survivor: kordaja pärast n võidetud ringi */
  function survivorMult(advOdds, roundsWon) {
    let mult = 1;
    const n = Math.min(roundsWon, 7, (advOdds || []).length);
    for (let i = 0; i < n; i++) mult *= advOdds[i];
    return round2(mult);
  }

  /* Tagastab null (jääb ootele) või { status:'won'|'lost', win } */
  function settleTicket(t, results) {
    const d = t.details || {};
    const buyIn = +t.buy_in;
    switch (t.game) {
      case "survivor": {
        const pr = results.players[d.playerId];
        if (!pr) return null;
        if (pr.eliminated) return { status: "lost", win: 0 };
        if ((pr.roundsWon || 0) >= 7)
          return { status: "won", win: round2(buyIn * survivorMult(d.advOdds, 7)) };
        return null;
      }
      case "slot": {
        const mr = results.matches[d.matchId];
        if (!mr) return null;
        const m = match(d.matchId);
        const sc = parseScore(mr.score);
        let hit = false;
        if (d.market === "match") hit = mr.winner === d.playerId;
        else if (d.market === "clean") hit = mr.winner === d.playerId && !!(sc && sc.straight);
        else if (d.market === "distance") hit = !!(sc && m && sc.total === maxSets(m));
        else if (d.market === "tiebreak") hit = !!mr.tiebreak;
        return hit ? { status: "won", win: round2(buyIn * d.totalOdds) } : { status: "lost", win: 0 };
      }
      case "bagel": {
        const mr = results.matches[d.matchId];
        if (!mr) return null;
        if (mr.bagel) return { status: "won", win: round2(buyIn * 25) };
        if (mr.sixOne) return { status: "won", win: round2(buyIn * 3) };
        return { status: "lost", win: 0 };
      }
      case "rulett": {
        const mr = results.matches[d.matchId];
        if (!mr) return null;
        const sc = parseScore(mr.score);
        let hit = false;
        if (d.pocket.kind === "sets") hit = !!(sc && sc.total === d.pocket.n);
        else if (d.pocket.kind === "tb") hit = !!mr.tiebreak === !!d.pocket.yes;
        return hit ? { status: "won", win: round2(buyIn * d.odds) } : { status: "lost", win: 0 };
      }
      case "puhaspaev": {
        let misses = 0, unresolved = 0;
        for (const leg of d.legs) {
          const mr = results.matches[leg.matchId];
          if (!mr) { unresolved++; continue; }
          const sc = parseScore(mr.score);
          const clean = mr.winner === leg.playerId && !!(sc && sc.straight);
          if (!clean) misses++;
        }
        if (misses >= 2) return { status: "lost", win: 0 };
        if (unresolved > 0) return null;
        const jackpot = round2(buyIn * d.jackpotOdds);
        if (misses === 0) return { status: "won", win: jackpot };
        return { status: "won", win: round2(jackpot * 0.25) };  /* täpselt 1 mööda → 25% */
      }
      case "yllataja": {
        const mr = results.matches[d.matchId];
        if (!mr) return null;
        if (mr.winner === d.playerId)
          return { status: "won", win: round2(buyIn * d.odds * d.bonus) };
        return { status: "lost", win: 0 };
      }
    }
    return null;
  }

  /* Arvelda kõik ootel piletid; tagastab arveldatud arvu */
  async function settleAllPending() {
    const results = await loadResults();
    const { data, error } = await withTimeout(sb.from("usopen_tickets")
      .select("id,game,buy_in,details,status")
      .eq("status", "pending")
      .limit(1000), 20000);
    if (error) throw new Error(error.message);
    let settled = 0;
    for (const t of (data || [])) {
      let verdict = null;
      try { verdict = settleTicket(t, results); } catch (e) { console.error("Arveldus:", t.id, e); }
      if (!verdict) continue;
      await updateTicket(t.id, { status: verdict.status, win_amount: verdict.win });
      settled++;
    }
    return settled;
  }

  /* ============================================================
     Jagatud React-komponendid
     ============================================================ */
  const e = React.createElement;
  const { useState, useEffect } = React;

  const BUYINS = [5, 50, 100];
  const STATUS_ET = { pending: "Ootel", won: "Võidetud", lost: "Kaotatud" };

  function PlayerChip(props) {
    const p = typeof props.p === "string" ? player(props.p) : props.p;
    if (!p) return null;
    return e("span", { className: "chip", style: { background: p.color, color: chipText(p.color) } },
      p.name + (p.seed && props.seedless !== true ? " (" + p.seed + ")" : ""));
  }

  function MatchLine(props) {
    const m = typeof props.m === "string" ? match(props.m) : props.m;
    if (!m) return null;
    return e("div", { className: "fixline" },
      e(PlayerChip, { p: m.p1, seedless: true }),
      e("span", { className: "vs" }, "vs"),
      e(PlayerChip, { p: m.p2, seedless: true }),
      e("span", { className: "kotime" }, m.tour + " · " + m.court + " · " + m.time));
  }

  function Topbar(props) {
    const [sfxOn, setSfxOn] = useState(SFX.isOn());
    return e("div", { className: "topbar" },
      e("a", { className: "back", href: props.backHref || "/usalahtised" }, "← " + (props.backLabel || "USA LAHTISED")),
      e("div", { className: "iconbtns" },
        props.onBoard ? e("button", { className: "icobtn", title: "Edetabel", onClick: () => { SFX.click(); props.onBoard(); } }, "🏆") : null,
        e("button", {
          className: "icobtn" + (sfxOn ? "" : " off"), title: "Heliefektid",
          onClick: () => { setSfxOn(SFX.toggle()); SFX.click(); }
        }, "🔊")));
  }

  function NameGate(props) {
    const [val, setVal] = useState(getName());
    function go() {
      const n = val.trim();
      if (!n) return;
      saveName(n);
      SFX.click();
      props.onDone(n);
    }
    return e("div", { className: "setup namegate rise" },
      e("h2", null, "Kes mängib? 🎾"),
      e("p", null, "Sisesta oma nimi — piletid ja võidud salvestatakse selle nime alla."),
      e("input", {
        className: "nameinput", value: val, maxLength: 24,
        placeholder: "Sinu nimi",
        onChange: ev => setVal(ev.target.value),
        onKeyDown: ev => { if (ev.key === "Enter") go(); }
      }),
      e("button", { className: "mainbtn", disabled: !val.trim(), onClick: go }, "ALUSTA 🎾"));
  }

  function BuyinRow(props) {
    return e(React.Fragment, null,
      e("div", { className: "optlbl" }, "Panus"),
      e("div", { className: "optrow" },
        BUYINS.map(b => e("button", {
          key: b, className: "optbtn" + (props.value === b ? " on" : ""),
          onClick: () => { SFX.click(); props.onChange(b); }
        }, b))));
  }

  /* "Minu piletid" — describe(t) → {title, sub}; renderExtra(t) → lisasisu (nt cash-out nupp) */
  function MyTickets(props) {
    const [rows, setRows] = useState(null);
    const [err, setErr] = useState(null);
    useEffect(() => {
      let dead = false;
      setErr(null);
      if (!sb || !props.name) { setRows([]); return; }
      loadMyTickets(props.game, props.name)
        .then(d => { if (!dead) setRows(d); })
        .catch(er => { if (!dead) { setErr(er.message); setRows([]); } });
      return () => { dead = true; };
    }, [props.game, props.name, props.refreshKey]);
    return e(React.Fragment, null,
      e("div", { className: "seclbl" }, "🎫 Minu piletid"),
      err ? e("div", { className: "db-error" }, "Laadimine ebaõnnestus: " + err) :
        rows == null ? e("div", { className: "board-empty" }, "Laen…") :
          rows.length === 0 ? e("div", { className: "board-empty" }, "Sul pole veel piletit. Keeruta!") :
            rows.map(t => {
              const info = props.describe(t);
              const amount = t.status === "won" ? +t.win_amount : +t.potential_win;
              return e("div", { className: "tk-row", key: t.id },
                e("div", { className: "tk-top" },
                  e("span", { className: "status " + t.status }, STATUS_ET[t.status] || t.status),
                  e("span", { className: "tk-title" }, info.title),
                  e("span", { className: "tk-amt" }, t.status === "lost" ? "0.00" : fmt2(amount))),
                info.sub ? e("div", { className: "tk-sub" }, info.sub) : null,
                props.renderExtra ? props.renderExtra(t) : null);
            }));
  }

  function Board(props) {
    const [rows, setRows] = useState(null);
    const [err, setErr] = useState(null);
    useEffect(() => {
      let dead = false;
      setErr(null); setRows(null);
      if (!sb) { setErr("Andmebaas pole saadaval"); return; }
      loadBoard(props.game)
        .then(d => { if (!dead) setRows(d); })
        .catch(er => { if (!dead) setErr(er.message); });
      return () => { dead = true; };
    }, [props.game, props.refreshKey]);
    return e(React.Fragment, null,
      e("div", { className: "seclbl" }, "🏆 Edetabel — suurimad võidud"),
      err ? e("div", { className: "db-error" }, "Laadimine ebaõnnestus: " + err) :
        rows == null ? e("div", { className: "board-empty" }, "Laen…") :
          rows.length === 0 ? e("div", { className: "board-empty" }, "Ole esimene — keeruta endale pilet!") :
            rows.map((r, i) => e("div", { className: "board-row", key: i },
              e("span", { className: "board-rank" }, i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1) + "."),
              e("span", { className: "board-name" }, r.name || "—"),
              e("span", { className: "status " + r.status, style: { fontSize: 9 } }, STATUS_ET[r.status] || r.status),
              e("span", { className: "board-amt" }, fmt2(r.status === "won" ? +r.win_amount : +r.potential_win)))));
  }

  return {
    sb, D, BUYINS, MARKETS, marketByKey, STATUS_ET,
    randInt, pick, round2, fmt2, sleep, buzz, chipText, weightedPick, withTimeout,
    player, match, favOf, dogOf, matchOf, maxSets, cleanScore,
    getName, saveName,
    SFX, Confetti,
    saveTicket, loadMyTickets, loadBoard, loadResults, saveResult, updateTicket,
    parseScore, survivorMult, settleTicket, settleAllPending,
    ui: { PlayerChip, MatchLine, Topbar, NameGate, BuyinRow, MyTickets, Board }
  };
})();
