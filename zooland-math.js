/* ============================================================
   Zooland — matemaatikamootor (puhtad funktsioonid, DOM-vaba)
   Sweet Bonanza stiilis scatter-pays slott: 6x5, tumble'id,
   tasuta keerutuste pommikordajad.
   Kasutavad nii zooland.html (brauser) kui simulate-zooland.js (node).
   ============================================================ */
(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.ZoolandMath = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var COLS = 6, ROWS = 5, CELLS = COLS * ROWS;
  var SCATTER = 8;   // Kuldne Banaan
  var BOMB = 9;      // Vikerkaare Papagoi (ainult tasuta keerutustes)
  var MIN_MATCH = 8; // 8+ sama sümbolit ükskõik kus = võit
  var MAX_WIN_X = 21100;
  var FS_START = 10, FS_RETRIGGER = 5;

  // 0..7 madalast kõrgeni
  var SYMBOLS = [
    { key: "kilpkonn", name: "Kilpkonn", emoji: "🐢", color: "#66bb6a" },
    { key: "papagoi",  name: "Papagoi",  emoji: "🦜", color: "#26a69a" },
    { key: "flamingo", name: "Flamingo", emoji: "🦩", color: "#f06292" },
    { key: "sebra",    name: "Sebra",    emoji: "🦓", color: "#b0bec5" },
    { key: "elevant",  name: "Elevant",  emoji: "🐘", color: "#90a4ae" },
    { key: "lovi",     name: "Lõvi",     emoji: "🦁", color: "#ffb74d" },
    { key: "ahv",      name: "Ahv",      emoji: "🐵", color: "#a1887f" },
    { key: "gorilla",  name: "Gorilla",  emoji: "🦍", color: "#8d6e63" },
    { key: "banaan",   name: "Kuldne Banaan", emoji: "🍌", color: "#ffd54f" },
    { key: "pomm",     name: "Vikerkaare Papagoi", emoji: "🦜", color: "#e040fb" }
  ];

  // Sümbolikaalud (madalad sagedased, Gorilla haruldane).
  // Häälestatud simulaatoriga (simulate-zooland.js): RTP ~96%, kõrge volatiilsus.
  var WEIGHTS = [93, 81, 68, 58, 48, 40, 32, 20];

  // Väljamaksed (x panus) tasemete kaupa: 8-9 / 10-11 / 12+ sümbolit
  var PAYS = [
    [0.25, 0.75, 2],   // Kilpkonn
    [0.40, 0.90, 4],   // Papagoi
    [0.50, 1.00, 5],   // Flamingo
    [0.80, 1.20, 8],   // Sebra
    [1.00, 1.50, 10],  // Elevant
    [1.50, 2.00, 12],  // Lõvi
    [2.00, 5.00, 15],  // Ahv
    [10.0, 25.0, 50]   // Gorilla
  ];

  // Scatteri otsemaksed (x panus): 4 / 5 / 6+
  var SCATTER_PAYS = { 4: 3, 5: 5, 6: 100 };

  // Scatterite ARVU jaotus keerutuse algseisus (kaalud).
  // Ante ("Topelt banaanid") korrutab kõik nullist erinevad kaalud 2-ga —
  // iga scatteri maandumise tõenäosus kahekordistub.
  var SCATTER_COUNT_WEIGHTS = [79809, 14000, 4800, 1100, 231, 52, 8]; // 0..6

  // Pommi tõenäosus lahtri kohta IGAL kukkumisel tasuta keerutustes
  // (nii algseis kui tumble-täited).
  var BOMB_P = 0.052;

  // Pommikordajate kaalutud pool: x2-x10 tavaline, x12-x25 harvem,
  // x50 haruldane, x100 väga haruldane.
  var BOMB_MULTS = [
    [2, 200], [3, 190], [4, 180], [5, 170], [6, 160], [8, 140], [10, 120],
    [12, 100], [15, 85], [20, 70], [25, 55],
    [50, 26], [100, 11]
  ];

  // Boonusostu scatterite arvu jaotus (ostu hind 100x)
  var BUY_SCATTER_DIST = [[4, 0.87], [5, 0.11], [6, 0.02]];

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
  var SCW_TOTAL = SCATTER_COUNT_WEIGHTS.reduce(function (a, b) { return a + b; }, 0);
  var BOMB_W_TOTAL = BOMB_MULTS.reduce(function (a, b) { return a + b[1]; }, 0);

  // Häälestuse abifunktsioon (simulaator): muuda parameetreid jooksvalt.
  function setConfig(cfg) {
    if (cfg.weights) {
      WEIGHTS = cfg.weights.slice();
      WEIGHT_TOTAL = WEIGHTS.reduce(function (a, b) { return a + b; }, 0);
      api.WEIGHTS = WEIGHTS;
    }
    if (cfg.pays) { PAYS = cfg.pays.map(function (r) { return r.slice(); }); api.PAYS = PAYS; }
    if (cfg.scatterCountWeights) {
      SCATTER_COUNT_WEIGHTS = cfg.scatterCountWeights.slice();
      SCW_TOTAL = SCATTER_COUNT_WEIGHTS.reduce(function (a, b) { return a + b; }, 0);
      api.SCATTER_COUNT_WEIGHTS = SCATTER_COUNT_WEIGHTS;
    }
    if (cfg.bombP != null) { BOMB_P = cfg.bombP; api.BOMB_P = BOMB_P; }
    if (cfg.bombMults) {
      BOMB_MULTS = cfg.bombMults.map(function (r) { return r.slice(); });
      BOMB_W_TOTAL = BOMB_MULTS.reduce(function (a, b) { return a + b[1]; }, 0);
      api.BOMB_MULTS = BOMB_MULTS;
    }
  }

  function drawSymbol(rng) {
    var r = rng() * WEIGHT_TOTAL;
    for (var i = 0; i < WEIGHTS.length; i++) {
      r -= WEIGHTS[i];
      if (r < 0) return i;
    }
    return WEIGHTS.length - 1;
  }

  // Mitu scatterit maandub sellel keerutusel (0..6).
  // ante=true kahekordistab TÄPSELT iga >0 arvu tõenäosuse
  // (0 scatteri kaal väheneb vastavalt, kogusumma ei muutu).
  function drawScatterCount(rng, ante) {
    var r = rng() * SCW_TOTAL;
    if (!ante) {
      for (var i = 0; i < SCATTER_COUNT_WEIGHTS.length; i++) {
        r -= SCATTER_COUNT_WEIGHTS[i];
        if (r < 0) return i;
      }
      return 0;
    }
    var nonzero = SCW_TOTAL - SCATTER_COUNT_WEIGHTS[0];
    r -= SCW_TOTAL - 2 * nonzero; // uus 0-kaal
    if (r < 0) return 0;
    for (var j = 1; j < SCATTER_COUNT_WEIGHTS.length; j++) {
      r -= SCATTER_COUNT_WEIGHTS[j] * 2;
      if (r < 0) return j;
    }
    return 0;
  }

  function drawBombMult(rng) {
    var r = rng() * BOMB_W_TOTAL;
    for (var i = 0; i < BOMB_MULTS.length; i++) {
      r -= BOMB_MULTS[i][1];
      if (r < 0) return BOMB_MULTS[i][0];
    }
    return BOMB_MULTS[0][0];
  }

  function drawBuyScatters(rng) {
    var r = rng();
    for (var i = 0; i < BUY_SCATTER_DIST.length; i++) {
      r -= BUY_SCATTER_DIST[i][1];
      if (r < 0) return BUY_SCATTER_DIST[i][0];
    }
    return 4;
  }

  /* ---------- Ruudustik ---------- */

  // Algseis: 30 lahtrit; scatterCount scatterit juhupositsioonidele;
  // freeSpin korral võib igasse tavalahtrisse maanduda pomm (BOMB_P).
  // Tagastab { grid, bombMult } — bombMult[c] > 0 ainult pommilahtril.
  function generateGrid(rng, scatterCount, freeSpin) {
    var grid = new Array(CELLS);
    var bombMult = new Array(CELLS).fill(0);
    var i;
    for (i = 0; i < CELLS; i++) {
      if (freeSpin && rng() < BOMB_P) {
        grid[i] = BOMB;
        bombMult[i] = drawBombMult(rng);
      } else {
        grid[i] = drawSymbol(rng);
      }
    }
    var placed = 0, guard = 0;
    while (placed < scatterCount && guard++ < 1000) {
      var c = Math.floor(rng() * CELLS);
      if (grid[c] !== SCATTER) {
        if (grid[c] === BOMB) bombMult[c] = 0;
        grid[c] = SCATTER;
        placed++;
      }
    }
    return { grid: grid, bombMult: bombMult };
  }

  // Leia kõik võitvad sümbolid: 8+ sama sümbolit ükskõik kus ekraanil.
  // Tagastab [{sym, count, cells, pay}] — pay on x panus (bet=1).
  function findWins(grid) {
    var counts = new Array(8).fill(0);
    var c;
    for (c = 0; c < CELLS; c++) if (grid[c] < 8) counts[grid[c]]++;
    var wins = [];
    for (var s = 0; s < 8; s++) {
      if (counts[s] >= MIN_MATCH) {
        var cells = [];
        for (c = 0; c < CELLS; c++) if (grid[c] === s) cells.push(c);
        var tier = counts[s] >= 12 ? 2 : counts[s] >= 10 ? 1 : 0;
        wins.push({ sym: s, count: counts[s], cells: cells, pay: PAYS[s][tier] });
      }
    }
    return wins;
  }

  function scatterPay(n) {
    if (n >= 6) return SCATTER_PAYS[6];
    return SCATTER_PAYS[n] || 0;
  }

  // Tumble: eemalda võidulahtrid, kukuta veerud alla (scatterid ja pommid
  // kukuvad kaasa, aga neid ei eemaldata), täida uued lahtrid ülevalt.
  // Tasuta keerutustes võivad ka uued lahtrid olla pommid.
  // Muteerib grid + bombMult kohapeal; tagastab uute pommide lahtrid.
  function tumble(grid, bombMult, removedSet, rng, freeSpin) {
    var newBombCells = [];
    for (var col = 0; col < COLS; col++) {
      var stack = []; // altpoolt üles: [sym, bombMult]
      for (var r = ROWS - 1; r >= 0; r--) {
        var c = r * COLS + col;
        if (!removedSet[c]) stack.push([grid[c], bombMult[c]]);
      }
      for (var r2 = ROWS - 1; r2 >= 0; r2--) {
        var idx = ROWS - 1 - r2;
        var cell = r2 * COLS + col;
        if (idx < stack.length) {
          grid[cell] = stack[idx][0];
          bombMult[cell] = stack[idx][1];
        } else if (freeSpin && rng() < BOMB_P) {
          grid[cell] = BOMB;
          bombMult[cell] = drawBombMult(rng);
          newBombCells.push(cell);
        } else {
          grid[cell] = drawSymbol(rng);
          bombMult[cell] = 0;
        }
      }
    }
    return newBombCells;
  }

  /* ---------- Keerutus ---------- */

  // Üks täielik keerutus koos tumble-ahelaga.
  // opts: { freeSpin, ante, forcedScatters, capRemaining }
  //  - scatterid maanduvad AINULT algseisus (mitte tumble'ites)
  //  - pommid (ainult freeSpin) maanduvad igal kukkumisel ega kao tumble'is
  //  - ahela lõpus: kui ahel võitis, korrutatakse tumble-võit ekraanil
  //    olevate pommikordajate SUMMAGA; scatteri otsemakse liidetakse eraldi
  function playSpin(rng, bet, opts) {
    opts = opts || {};
    var capRemaining = opts.capRemaining != null ? opts.capRemaining : MAX_WIN_X * bet;
    var scatterCount = opts.forcedScatters != null
      ? opts.forcedScatters
      : drawScatterCount(rng, !!opts.ante);
    var g = generateGrid(rng, scatterCount, !!opts.freeSpin);
    var grid = g.grid, bombMult = g.bombMult;
    var initialGrid = grid.slice(), initialBombs = bombMult.slice();
    var steps = [];
    var tumbleWin = 0;

    for (;;) {
      var wins = findWins(grid);
      if (!wins.length) break;
      var removedSet = new Array(CELLS);
      var stepWin = 0;
      for (var i = 0; i < wins.length; i++) {
        stepWin += wins[i].pay * bet;
        for (var j = 0; j < wins[i].cells.length; j++) removedSet[wins[i].cells[j]] = true;
      }
      tumbleWin += stepWin;
      var newBombCells = tumble(grid, bombMult, removedSet, rng, !!opts.freeSpin);
      steps.push({
        wins: wins, stepWin: stepWin, removed: removedSet,
        gridAfter: grid.slice(), bombAfter: bombMult.slice(),
        newBombCells: newBombCells
      });
      // 21100x on juba garanteeritult ületatud — kordaja saab võitu vaid kasvatada
      if (tumbleWin >= capRemaining) break;
    }

    // Pommikordajad: ahela lõpus, ainult kui ahel võitis
    var bombSum = 0, bombCells = [];
    for (var c = 0; c < CELLS; c++) {
      if (grid[c] === BOMB && bombMult[c] > 0) {
        bombSum += bombMult[c];
        bombCells.push({ cell: c, mult: bombMult[c] });
      }
    }
    var multiplied = tumbleWin;
    var bombApplied = false;
    if (opts.freeSpin && tumbleWin > 0 && bombSum > 0) {
      multiplied = tumbleWin * bombSum;
      bombApplied = true;
    }

    var scatPay = scatterPay(scatterCount) * bet;
    var win = multiplied + scatPay;
    var capped = false;
    if (win >= capRemaining) { win = capRemaining; capped = true; }

    return {
      initialGrid: initialGrid,
      initialBombs: initialBombs,
      finalGrid: grid.slice(),
      finalBombs: bombMult.slice(),
      steps: steps,
      tumbleWin: tumbleWin,
      bombSum: bombSum,
      bombCells: bombCells,
      bombApplied: bombApplied,
      scatterCount: scatterCount,
      scatterPay: scatPay,
      win: win,
      capped: capped
    };
  }

  /* ---------- Terve ring (simulaatori jaoks) ---------- */

  // Baaskeerutus + võimalikud tasuta keerutused. Tagastab koondnumbrid.
  // opts: { buy, ante } (vastastikku välistavad — buy võidab)
  function playRound(rng, bet, opts) {
    opts = opts || {};
    var cap = MAX_WIN_X * bet;
    var base = playSpin(rng, bet, {
      freeSpin: false,
      ante: !opts.buy && !!opts.ante,
      forcedScatters: opts.buy ? drawBuyScatters(rng) : null,
      capRemaining: cap
    });
    var total = base.win;
    var bonus = null;

    if (!base.capped && base.scatterCount >= 4) {
      var remaining = FS_START;
      var played = 0, bonusWin = 0, retriggers = 0, cappedFs = false;
      while (remaining > 0 && total < cap) {
        remaining--; played++;
        var s = playSpin(rng, bet, { freeSpin: true, capRemaining: cap - total });
        bonusWin += s.win;
        total += s.win;
        if (s.capped) { cappedFs = true; break; }
        if (s.scatterCount >= 3) {
          remaining += FS_RETRIGGER;
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
      capped: base.capped || (bonus != null && bonus.capped)
    };
  }

  var api = {
    ROWS: ROWS, COLS: COLS, CELLS: CELLS,
    SYMBOLS: SYMBOLS, SCATTER: SCATTER, BOMB: BOMB,
    MIN_MATCH: MIN_MATCH, MAX_WIN_X: MAX_WIN_X,
    FS_START: FS_START, FS_RETRIGGER: FS_RETRIGGER,
    WEIGHTS: WEIGHTS, PAYS: PAYS, SCATTER_PAYS: SCATTER_PAYS,
    SCATTER_COUNT_WEIGHTS: SCATTER_COUNT_WEIGHTS,
    BOMB_P: BOMB_P, BOMB_MULTS: BOMB_MULTS,
    BUY_SCATTER_DIST: BUY_SCATTER_DIST,
    makeRng: makeRng, randomSeed: randomSeed,
    drawSymbol: drawSymbol, drawScatterCount: drawScatterCount,
    drawBombMult: drawBombMult, drawBuyScatters: drawBuyScatters,
    generateGrid: generateGrid, findWins: findWins, scatterPay: scatterPay,
    tumble: tumble, playSpin: playSpin, playRound: playRound,
    setConfig: setConfig
  };
  return api;
});
