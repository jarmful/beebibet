/* ============================================================
   KosmosBet — matemaatikamootor (puhtad funktsioonid, DOM-vaba)
   Kasutavad nii kosmos.html (brauser) kui simulate.js (node).
   ============================================================ */
(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.KosmosMath = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ROWS = 7, COLS = 7, CELLS = ROWS * COLS;
  var SCATTER = 7;          // Must Auk
  var MAX_MULT = 128;
  var MAX_WIN_X = 5000;
  var MIN_CLUSTER = 5;

  // 0 Asteroid, 1 Komeet, 2 Satelliit, 3 Saturn, 4 Rakett, 5 UFO, 6 Kuldne Päike
  var SYMBOLS = [
    { key: "asteroid",  emoji: "🪨", color: "#9aa3b2" },
    { key: "komeet",    emoji: "☄️", color: "#4fc3f7" },
    { key: "satelliit", emoji: "🛰️", color: "#66d98a" },
    { key: "saturn",    emoji: "🪐", color: "#ffb74d" },
    { key: "rakett",    emoji: "🚀", color: "#ff5c6c" },
    { key: "ufo",       emoji: "🛸", color: "#c07bff" },
    { key: "paike",     emoji: "🌞", color: "#ffd54f" },
    { key: "mustauk",   emoji: "🕳️", color: "#7de8ff" }
  ];

  // Sümbolikaalud (madalad sagedased, kõrged haruldased).
  // Häälestatud simulaatoriga (simulate.js): RTP ~96%, kõrge volatiilsus.
  var WEIGHTS = [28, 23, 18, 13, 9, 5, 3];

  // Klastri suurustasemed: 5 / 6-7 / 8-9 / 10-11 / 12-14 / 15+
  var TIERS = [5, 6, 8, 10, 12, 15];

  // Väljamaksed (x panus) klastri kohta, tase kaupa
  var PAYS = [
    [0.05, 0.10, 0.20, 0.40, 1.0,  2.5],  // Asteroid
    [0.07, 0.15, 0.30, 0.60, 1.5,  4],    // Komeet
    [0.10, 0.20, 0.40, 0.80, 2.0,  5],    // Satelliit
    [0.15, 0.30, 0.60, 1.20, 3.0,  8],    // Saturn
    [0.25, 0.50, 1.00, 2.00, 5.0, 12],    // Rakett
    [0.40, 0.80, 1.60, 4.00, 10., 20],    // UFO
    [0.60, 1.20, 2.50, 6.00, 15., 32]     // Kuldne Päike
  ];

  // Scatteri tõenäosus lahtri kohta (ainult keerutuse algseisus, mitte tumble'is)
  var SCATTER_P = 0.00755;

  var FS_AWARD = { 3: 10, 4: 12, 5: 15, 6: 20, 7: 30 };

  // Boonusostu scatterite arvu jaotus (ostu-EV ~99x, hind 100x)
  var BUY_SCATTER_DIST = [[3, 0.74], [4, 0.19], [5, 0.05], [6, 0.015], [7, 0.005]];

  /* ---------- Juhuslikkus ---------- */

  // mulberry32 — deterministlik seemnega PRNG
  function makeRng(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      var a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0];
    }
    try {
      return require("crypto").randomBytes(4).readUInt32LE(0);
    } catch (e) {
      return (Math.random() * 4294967296) >>> 0;
    }
  }

  var WEIGHT_TOTAL = WEIGHTS.reduce(function (a, b) { return a + b; }, 0);

  // Häälestuse abifunktsioon (simulaator/testid): muuda kaale, väljamakseid
  // või scatteri tõenäosust jooksvalt.
  function setConfig(cfg) {
    if (cfg.weights) {
      WEIGHTS = cfg.weights.slice();
      WEIGHT_TOTAL = WEIGHTS.reduce(function (a, b) { return a + b; }, 0);
      api.WEIGHTS = WEIGHTS;
    }
    if (cfg.pays) { PAYS = cfg.pays.map(function (r) { return r.slice(); }); api.PAYS = PAYS; }
    if (cfg.scatterP != null) { SCATTER_P = cfg.scatterP; api.SCATTER_P = SCATTER_P; }
  }

  function drawSymbol(rng) {
    var r = rng() * WEIGHT_TOTAL;
    for (var i = 0; i < WEIGHTS.length; i++) {
      r -= WEIGHTS[i];
      if (r < 0) return i;
    }
    return WEIGHTS.length - 1;
  }

  /* ---------- Ruudustik ---------- */

  // Genereeri 49 lahtrit; scatterid ainult kui allowScatter,
  // forcedScatters (arv) asetab täpselt nii mitu scatterit.
  function generateGrid(rng, allowScatter, forcedScatters) {
    var grid = new Array(CELLS);
    var i;
    for (i = 0; i < CELLS; i++) grid[i] = drawSymbol(rng);
    if (forcedScatters) {
      var placed = 0;
      while (placed < forcedScatters) {
        var c = Math.floor(rng() * CELLS);
        if (grid[c] !== SCATTER) { grid[c] = SCATTER; placed++; }
      }
    } else if (allowScatter) {
      for (i = 0; i < CELLS; i++) if (rng() < SCATTER_P) grid[i] = SCATTER;
    }
    return grid;
  }

  function countScatters(grid) {
    var n = 0;
    for (var i = 0; i < CELLS; i++) if (grid[i] === SCATTER) n++;
    return n;
  }

  // Leia kõik >=5 samasümboliga ristühendusega klastrid (mitte diagonaal)
  function findClusters(grid) {
    var seen = new Array(CELLS);
    var clusters = [];
    for (var start = 0; start < CELLS; start++) {
      if (seen[start]) continue;
      var sym = grid[start];
      seen[start] = true;
      if (sym === SCATTER || sym == null) continue;
      var stack = [start], cells = [start];
      while (stack.length) {
        var c = stack.pop();
        var r = (c / COLS) | 0, col = c % COLS;
        var nb = [];
        if (r > 0) nb.push(c - COLS);
        if (r < ROWS - 1) nb.push(c + COLS);
        if (col > 0) nb.push(c - 1);
        if (col < COLS - 1) nb.push(c + 1);
        for (var k = 0; k < nb.length; k++) {
          var n = nb[k];
          if (!seen[n] && grid[n] === sym) {
            seen[n] = true;
            stack.push(n);
            cells.push(n);
          }
        }
      }
      if (cells.length >= MIN_CLUSTER) clusters.push({ sym: sym, cells: cells });
    }
    return clusters;
  }

  function tierIndex(size) {
    for (var i = TIERS.length - 1; i >= 0; i--) if (size >= TIERS[i]) return i;
    return 0;
  }

  function clusterPay(sym, size) {
    return PAYS[sym][tierIndex(size)];
  }

  // Tumble: eemalda antud lahtrid, kukuta veerud alla, täida uutega (scattereid ei teki)
  function tumble(grid, removedSet, rng) {
    for (var col = 0; col < COLS; col++) {
      var stack = [];
      for (var r = ROWS - 1; r >= 0; r--) {
        var c = r * COLS + col;
        if (!removedSet[c]) stack.push(grid[c]);
      }
      for (var r2 = ROWS - 1; r2 >= 0; r2--) {
        var idx = (ROWS - 1 - r2);
        grid[r2 * COLS + col] = idx < stack.length ? stack[idx] : drawSymbol(rng);
      }
    }
  }

  /* ---------- Keerutus ---------- */

  // Üks täielik keerutus koos tumble-ahelaga.
  // marks (bool[49]) ja mults (num[49]) muteeritakse kohapeal — kutsuja
  // otsustab püsivuse (tavamäng nullib, tasuta keerutused hoiavad).
  // capRemaining: mitu x panust tohib see keerutus veel maksimaalselt maksta.
  function playSpin(rng, bet, marks, mults, allowScatter, forcedScatters, capRemaining) {
    if (capRemaining == null) capRemaining = MAX_WIN_X * bet;
    var grid = generateGrid(rng, allowScatter, forcedScatters || 0);
    var initialGrid = grid.slice();
    var steps = [];
    var win = 0;
    var capped = false;

    for (;;) {
      var clusters = findClusters(grid);
      if (!clusters.length) break;

      var stepClusters = [];
      var removedSet = new Array(CELLS);
      var stepWin = 0;

      for (var ci = 0; ci < clusters.length; ci++) {
        var cl = clusters[ci];
        var upgrades = [];
        var newMarks = [];
        var multSum = 0;
        for (var j = 0; j < cl.cells.length; j++) {
          var cell = cl.cells[j];
          if (mults[cell] > 0) {
            if (mults[cell] < MAX_MULT) {
              upgrades.push({ cell: cell, from: mults[cell], to: mults[cell] * 2 });
              mults[cell] *= 2;
            }
            multSum += mults[cell];
          } else if (marks[cell]) {
            mults[cell] = 2;
            upgrades.push({ cell: cell, from: 0, to: 2 });
            multSum += 2;
          } else {
            marks[cell] = true;
            newMarks.push(cell);
          }
          removedSet[cell] = true;
        }
        var basePay = clusterPay(cl.sym, cl.cells.length) * bet;
        var factor = multSum > 0 ? multSum : 1;
        var pay = basePay * factor;
        stepWin += pay;
        stepClusters.push({
          sym: cl.sym, cells: cl.cells, size: cl.cells.length,
          basePay: basePay, multSum: multSum, pay: pay,
          upgrades: upgrades, newMarks: newMarks
        });
      }

      if (win + stepWin >= capRemaining) {
        stepWin = capRemaining - win;
        capped = true;
      }
      win += stepWin;

      tumble(grid, removedSet, rng);
      steps.push({
        clusters: stepClusters,
        stepWin: stepWin,
        removed: removedSet,
        gridAfter: grid.slice()
      });
      if (capped) break;
    }

    return {
      initialGrid: initialGrid,
      finalGrid: grid.slice(),
      steps: steps,
      win: win,
      capped: capped,
      scatterCount: countScatters(initialGrid)
    };
  }

  function spinsForScatters(n) {
    if (n >= 7) return FS_AWARD[7];
    return FS_AWARD[n] || 0;
  }

  function drawBuyScatters(rng) {
    var r = rng();
    for (var i = 0; i < BUY_SCATTER_DIST.length; i++) {
      r -= BUY_SCATTER_DIST[i][1];
      if (r < 0) return BUY_SCATTER_DIST[i][0];
    }
    return 3;
  }

  function freshMarks() { return new Array(CELLS).fill(false); }
  function freshMults() { return new Array(CELLS).fill(0); }

  /* ---------- Terve ring (simulaatori jaoks) ---------- */

  // Baaskeerutus + võimalikud tasuta keerutused. Tagastab koondnumbrid.
  function playRound(rng, bet, buyBonus) {
    var cap = MAX_WIN_X * bet;
    var marks = freshMarks(), mults = freshMults();
    var forced = buyBonus ? drawBuyScatters(rng) : 0;
    var base = playSpin(rng, bet, marks, mults, true, forced, cap);
    var total = base.win;
    var bonus = null;

    if (!base.capped && base.scatterCount >= 3) {
      var fsMarks = freshMarks(), fsMults = freshMults();
      var remaining = spinsForScatters(base.scatterCount);
      var played = 0, bonusWin = 0, retriggers = 0, cappedFs = false;
      while (remaining > 0 && total < cap) {
        remaining--; played++;
        var s = playSpin(rng, bet, fsMarks, fsMults, true, 0, cap - total);
        bonusWin += s.win;
        total += s.win;
        if (s.capped) { cappedFs = true; break; }
        if (s.scatterCount >= 3) {
          remaining += spinsForScatters(s.scatterCount);
          retriggers++;
        }
      }
      bonus = { spinsPlayed: played, win: bonusWin, retriggers: retriggers, capped: cappedFs };
    }

    return {
      baseWin: base.win,
      scatterCount: base.scatterCount,
      bonus: bonus,
      totalWin: total,
      capped: base.capped || (bonus && bonus.capped)
    };
  }

  var api = {
    ROWS: ROWS, COLS: COLS, CELLS: CELLS,
    SYMBOLS: SYMBOLS, SCATTER: SCATTER, WEIGHTS: WEIGHTS,
    PAYS: PAYS, TIERS: TIERS, SCATTER_P: SCATTER_P,
    FS_AWARD: FS_AWARD, MAX_MULT: MAX_MULT, MAX_WIN_X: MAX_WIN_X,
    MIN_CLUSTER: MIN_CLUSTER,
    makeRng: makeRng, randomSeed: randomSeed,
    generateGrid: generateGrid, countScatters: countScatters,
    findClusters: findClusters, tierIndex: tierIndex, clusterPay: clusterPay,
    tumble: tumble, playSpin: playSpin, playRound: playRound,
    spinsForScatters: spinsForScatters, drawBuyScatters: drawBuyScatters,
    freshMarks: freshMarks, freshMults: freshMults,
    setConfig: setConfig
  };
  return api;
});
