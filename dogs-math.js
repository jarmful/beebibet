/* ============================================================
   Dogs of Olympics — matemaatikamootor (puhtad funktsioonid, DOM-vaba)
   Gates of Olympus stiilis scatter-pays slott: 6x5, tumble'id,
   kuldsete maiuste kordajad igal keerutusel, tasuta keerutustes
   püsiv kogukordaja. Zeus Koer võib iga keerutuse õnnistada.
   Kasutavad nii dogs.html (brauser) kui simulate-dogs.js (node).
   ============================================================ */
(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.DogsMath = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var COLS = 6, ROWS = 5, CELLS = COLS * ROWS;
  var SCATTER = 8;   // Zeus Koera käpajälg
  var ORB = 9;       // Kuldne maius (kordaja) — võib maanduda IGAL keerutusel
  var MIN_MATCH = 8; // 8+ sama sümbolit ükskõik kus = võit
  var MAX_WIN_X = 5000;
  var FS_START = 15, FS_RETRIGGER = 5;

  // 0..7 madalast kõrgeni
  var SYMBOLS = [
    { key: "kont",     name: "Kont",            emoji: "🦴", color: "#e8d9bd" },
    { key: "pall",     name: "Tennisepall",     emoji: "🎾", color: "#cddc39" },
    { key: "kauss",    name: "Toidukauss",      emoji: "🥣", color: "#90caf9" },
    { key: "mänguasi", name: "Närimislelu",     emoji: "🧸", color: "#bcaaa4" },
    { key: "korgi",    name: "Korgi",           emoji: "🐶", color: "#ffb74d" },
    { key: "husky",    name: "Husky",           emoji: "🐕", color: "#b0bec5" },
    { key: "puudel",   name: "Puudel",          emoji: "🐩", color: "#f48fb1" },
    { key: "retriiver",name: "Kuldne Retriiver",emoji: "🦮", color: "#ffd54f" },
    { key: "käpp",     name: "Käpajälg",        emoji: "🐾", color: "#ffe082" },
    { key: "maius",    name: "Kuldne Maius",    emoji: "✨", color: "#ffd700" }
  ];

  // Sümbolikaalud (madalad sagedased, Kuldne Retriiver haruldane).
  // Häälestatud simulaatoriga (simulate-dogs.js): RTP ~99%, sage väike võit.
  var WEIGHTS = [68, 66, 64, 61, 56, 50, 41, 23];

  // Väljamaksed (x panus) tasemete kaupa: 8-9 / 10-11 / 12+ sümbolit
  var PAYS = [
    [0.25, 0.75, 2],   // Kont
    [0.40, 0.90, 4],   // Tennisepall
    [0.50, 1.00, 5],   // Toidukauss
    [0.80, 1.20, 8],   // Närimislelu
    [1.00, 1.50, 10],  // Korgi
    [1.50, 2.00, 12],  // Husky
    [2.00, 5.00, 15],  // Puudel
    [10.0, 25.0, 50]   // Kuldne Retriiver
  ];

  // Scatteri otsemaksed (x panus): 4 / 5 / 6+
  var SCATTER_PAYS = { 4: 3, 5: 5, 6: 100 };

  // Scatterite ARVU jaotus keerutuse algseisus (kaalud).
  // Ante ("Zeusi soosing") korrutab kõik nullist erinevad kaalud 2-ga.
  var SCATTER_COUNT_WEIGHTS = [79809, 14000, 4800, 1100, 231, 52, 8]; // 0..6

  // Kuldse maiuse tõenäosus lahtri kohta IGAL kukkumisel (nii algseis
  // kui tumble-täited). Tasuta keerutustes maandub maiuseid sagedamini,
  // et püsiv kogukordaja kasvaks ja boonus tunduks eriline.
  var ORB_P = 0.005;
  var ORB_P_FS = 0.021;

  // Maiusekordajate kaalutud pool: x2-x10 tavaline, x12-x50 harvem,
  // x100+ haruldane, x500 üliharuldane.
  var ORB_MULTS = [
    [2, 4200], [3, 2800], [4, 1800], [5, 1200], [6, 800], [8, 500], [10, 340],
    [12, 200], [15, 130], [20, 90], [25, 60],
    [50, 30], [100, 15], [250, 7], [500, 3]
  ];

  // Zeus Koera õnnistus: tõenäosus, et ta viskab keerutuse alguses
  // 1-3 lisamaiust ruudustikule (bark + sähvatus).
  var BLESS_P = 0.03;
  var BLESS_COUNTS = [[1, 55], [2, 33], [3, 12]];

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
  var ORB_W_TOTAL = ORB_MULTS.reduce(function (a, b) { return a + b[1]; }, 0);
  var BLESS_C_TOTAL = BLESS_COUNTS.reduce(function (a, b) { return a + b[1]; }, 0);

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
    if (cfg.orbP != null) { ORB_P = cfg.orbP; api.ORB_P = ORB_P; }
    if (cfg.orbPFs != null) { ORB_P_FS = cfg.orbPFs; api.ORB_P_FS = ORB_P_FS; }
    if (cfg.orbMults) {
      ORB_MULTS = cfg.orbMults.map(function (r) { return r.slice(); });
      ORB_W_TOTAL = ORB_MULTS.reduce(function (a, b) { return a + b[1]; }, 0);
      api.ORB_MULTS = ORB_MULTS;
    }
    if (cfg.blessP != null) { BLESS_P = cfg.blessP; api.BLESS_P = BLESS_P; }
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
  // ante=true kahekordistab iga >0 arvu tõenäosuse.
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

  function drawOrbMult(rng) {
    var r = rng() * ORB_W_TOTAL;
    for (var i = 0; i < ORB_MULTS.length; i++) {
      r -= ORB_MULTS[i][1];
      if (r < 0) return ORB_MULTS[i][0];
    }
    return ORB_MULTS[0][0];
  }

  function drawBlessCount(rng) {
    var r = rng() * BLESS_C_TOTAL;
    for (var i = 0; i < BLESS_COUNTS.length; i++) {
      r -= BLESS_COUNTS[i][1];
      if (r < 0) return BLESS_COUNTS[i][0];
    }
    return 1;
  }

  /* ---------- Ruudustik ---------- */

  // Algseis: 30 lahtrit; scatterCount scatterit juhupositsioonidele;
  // igasse tavalahtrisse võib maanduda kuldne maius (ORB_P / ORB_P_FS).
  // Tagastab { grid, orbMult } — orbMult[c] > 0 ainult maiuselahtril.
  function generateGrid(rng, scatterCount, freeSpin) {
    var orbP = freeSpin ? ORB_P_FS : ORB_P;
    var grid = new Array(CELLS);
    var orbMult = new Array(CELLS).fill(0);
    var i;
    for (i = 0; i < CELLS; i++) {
      if (rng() < orbP) {
        grid[i] = ORB;
        orbMult[i] = drawOrbMult(rng);
      } else {
        grid[i] = drawSymbol(rng);
      }
    }
    var placed = 0, guard = 0;
    while (placed < scatterCount && guard++ < 1000) {
      var c = Math.floor(rng() * CELLS);
      if (grid[c] !== SCATTER) {
        if (grid[c] === ORB) orbMult[c] = 0;
        grid[c] = SCATTER;
        placed++;
      }
    }
    return { grid: grid, orbMult: orbMult };
  }

  // Zeus Koera õnnistus: viska 1-3 maiust juhuslikele tavalahtritele.
  // Muteerib grid + orbMult; tagastab õnnistatud lahtrite loendi.
  function applyBless(rng, grid, orbMult) {
    var n = drawBlessCount(rng);
    var cells = [];
    var guard = 0;
    while (cells.length < n && guard++ < 500) {
      var c = Math.floor(rng() * CELLS);
      if (grid[c] !== SCATTER && grid[c] !== ORB) {
        grid[c] = ORB;
        orbMult[c] = drawOrbMult(rng);
        cells.push(c);
      }
    }
    return cells;
  }

  // Leia kõik võitvad sümbolid: 8+ sama sümbolit ükskõik kus ekraanil.
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

  // Tumble: eemalda võidulahtrid, kukuta veerud alla (scatterid ja maiused
  // kukuvad kaasa, aga neid ei eemaldata), täida uued lahtrid ülevalt.
  // Ka uued lahtrid võivad olla maiused (igal keerutusel).
  // Muteerib grid + orbMult kohapeal; tagastab uute maiuste lahtrid.
  function tumble(grid, orbMult, removedSet, rng, freeSpin) {
    var orbP = freeSpin ? ORB_P_FS : ORB_P;
    var newOrbCells = [];
    for (var col = 0; col < COLS; col++) {
      var stack = []; // altpoolt üles: [sym, orbMult]
      for (var r = ROWS - 1; r >= 0; r--) {
        var c = r * COLS + col;
        if (!removedSet[c]) stack.push([grid[c], orbMult[c]]);
      }
      for (var r2 = ROWS - 1; r2 >= 0; r2--) {
        var idx = ROWS - 1 - r2;
        var cell = r2 * COLS + col;
        if (idx < stack.length) {
          grid[cell] = stack[idx][0];
          orbMult[cell] = stack[idx][1];
        } else if (rng() < orbP) {
          grid[cell] = ORB;
          orbMult[cell] = drawOrbMult(rng);
          newOrbCells.push(cell);
        } else {
          grid[cell] = drawSymbol(rng);
          orbMult[cell] = 0;
        }
      }
    }
    return newOrbCells;
  }

  /* ---------- Keerutus ---------- */

  // Üks täielik keerutus koos tumble-ahelaga.
  // opts: { freeSpin, ante, totalMult, capRemaining }
  //  - scatterid maanduvad AINULT algseisus (mitte tumble'ites)
  //  - maiused maanduvad igal kukkumisel ega kao tumble'is
  //  - ahela lõpus: kui ahel võitis ja ekraanil on maiuseid, korrutatakse
  //    tumble-võit maiuste SUMMAGA (baasmängus). Tasuta keerutustes
  //    liidetakse maiuste summa püsivasse kogukordajasse (totalMult) ja
  //    võitev ahel korrutatakse uue kogukordajaga.
  //  - scatteri otsemakse liidetakse eraldi
  function playSpin(rng, bet, opts) {
    opts = opts || {};
    var capRemaining = opts.capRemaining != null ? opts.capRemaining : MAX_WIN_X * bet;
    var totalMult = opts.totalMult || 0;
    var scatterCount = drawScatterCount(rng, !!opts.ante);
    var g = generateGrid(rng, scatterCount, !!opts.freeSpin);
    var grid = g.grid, orbMult = g.orbMult;

    // Zeus Koera õnnistus — enne võitude arvestust, animatsioon pärast maandumist
    var blessCells = [];
    if (rng() < BLESS_P) blessCells = applyBless(rng, grid, orbMult);

    var initialGrid = grid.slice(), initialOrbs = orbMult.slice();
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
      var newOrbCells = tumble(grid, orbMult, removedSet, rng, !!opts.freeSpin);
      steps.push({
        wins: wins, stepWin: stepWin, removed: removedSet,
        gridAfter: grid.slice(), orbAfter: orbMult.slice(),
        newOrbCells: newOrbCells
      });
      // ülempiir on juba garanteeritult ületatud — kordaja vaid kasvatab
      if (tumbleWin >= capRemaining) break;
    }

    // Maiusekordajad ahela lõpus, ainult kui ahel võitis
    var orbSum = 0, orbCells = [];
    for (var c = 0; c < CELLS; c++) {
      if (grid[c] === ORB && orbMult[c] > 0) {
        orbSum += orbMult[c];
        orbCells.push({ cell: c, mult: orbMult[c] });
      }
    }

    var multiplied = tumbleWin;
    var appliedMult = 0;
    var newTotalMult = totalMult;
    if (tumbleWin > 0) {
      if (opts.freeSpin) {
        // püsiv kogukordaja: maiused liituvad, uus summa rakendub kohe
        if (orbSum > 0) newTotalMult = totalMult + orbSum;
        if (newTotalMult > 0) {
          appliedMult = newTotalMult;
          multiplied = tumbleWin * newTotalMult;
        }
      } else if (orbSum > 0) {
        appliedMult = orbSum;
        multiplied = tumbleWin * orbSum;
      }
    }

    var scatPay = scatterPay(scatterCount) * bet;
    var win = multiplied + scatPay;
    var capped = false;
    if (win >= capRemaining) { win = capRemaining; capped = true; }

    return {
      initialGrid: initialGrid,
      initialOrbs: initialOrbs,
      finalGrid: grid.slice(),
      finalOrbs: orbMult.slice(),
      blessCells: blessCells,
      steps: steps,
      tumbleWin: tumbleWin,
      orbSum: orbSum,
      orbCells: orbCells,
      appliedMult: appliedMult,   // 0 = kordajat ei rakendatud
      newTotalMult: newTotalMult, // tasuta keerutuste püsikordaja pärast seda keerutust
      scatterCount: scatterCount,
      scatterPay: scatPay,
      win: win,
      capped: capped
    };
  }

  /* ---------- Terve ring (simulaatori jaoks) ---------- */

  // Baaskeerutus + võimalikud tasuta keerutused. Tagastab koondnumbrid.
  function playRound(rng, bet, opts) {
    opts = opts || {};
    var cap = MAX_WIN_X * bet;
    var base = playSpin(rng, bet, { ante: !!opts.ante, capRemaining: cap });
    var total = base.win;
    var bonus = null;

    if (!base.capped && base.scatterCount >= 4) {
      var remaining = FS_START;
      var played = 0, bonusWin = 0, retriggers = 0, cappedFs = false;
      var totalMult = 0;
      while (remaining > 0 && total < cap) {
        remaining--; played++;
        var s = playSpin(rng, bet, { freeSpin: true, totalMult: totalMult, capRemaining: cap - total });
        totalMult = s.newTotalMult;
        bonusWin += s.win;
        total += s.win;
        if (s.capped) { cappedFs = true; break; }
        if (s.scatterCount >= 3) {
          remaining += FS_RETRIGGER;
          retriggers++;
        }
      }
      bonus = { spinsPlayed: played, win: bonusWin, retriggers: retriggers, capped: cappedFs, totalMult: totalMult };
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
    SYMBOLS: SYMBOLS, SCATTER: SCATTER, ORB: ORB,
    MIN_MATCH: MIN_MATCH, MAX_WIN_X: MAX_WIN_X,
    FS_START: FS_START, FS_RETRIGGER: FS_RETRIGGER,
    WEIGHTS: WEIGHTS, PAYS: PAYS, SCATTER_PAYS: SCATTER_PAYS,
    SCATTER_COUNT_WEIGHTS: SCATTER_COUNT_WEIGHTS,
    ORB_P: ORB_P, ORB_P_FS: ORB_P_FS, ORB_MULTS: ORB_MULTS,
    BLESS_P: BLESS_P, BLESS_COUNTS: BLESS_COUNTS,
    makeRng: makeRng, randomSeed: randomSeed,
    drawSymbol: drawSymbol, drawScatterCount: drawScatterCount,
    drawOrbMult: drawOrbMult, drawBlessCount: drawBlessCount,
    generateGrid: generateGrid, applyBless: applyBless,
    findWins: findWins, scatterPay: scatterPay,
    tumble: tumble, playSpin: playSpin, playRound: playRound,
    setConfig: setConfig
  };
  return api;
});
