/* ============================================================
   Bomb Pot — pokkerimootor (puhtad funktsioonid, DOM-vaba)
   Kasutavad nii bombpot.html (brauser) kui node (kontrollid).

   Kaart = täisarv 0..51:
     aste  = kaart % 13   (0="2" ... 8="10", 9=poiss, 10=emand, 11=kuningas, 12=äss)
     mast  = (kaart / 13) | 0   (0=♠, 1=♥, 2=♦, 3=♣)
   ============================================================ */
(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.BombpotMath = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RANK_CHARS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  var SUIT_CHARS = ["♠", "♥", "♦", "♣"];
  var SUIT_RED = [false, true, true, false];

  // Astmenimed eesti keeles: ainsus (kõrge kaart, rea/masti tipp) ja
  // mitmus (paarid, kolmikud, nelikud, täismaja).
  var RANK_SING = ["kaks", "kolm", "neli", "viis", "kuus", "seitse", "kaheksa", "üheksa", "kümme", "poiss", "emand", "kuningas", "äss"];
  var RANK_PLUR = ["kahed", "kolmed", "neljad", "viied", "kuued", "seitsmed", "kaheksad", "üheksad", "kümned", "poisid", "emandad", "kuningad", "ässad"];

  var CAT_NAMES = ["Kõrge kaart", "Paar", "Kaks paari", "Kolmik", "Rida", "Mast", "Täismaja", "Nelik", "Mastirida"];

  function rankOf(c) { return c % 13; }
  function suitOf(c) { return (c / 13) | 0; }
  function cardText(c) { return RANK_CHARS[rankOf(c)] + SUIT_CHARS[suitOf(c)]; }
  function isRed(c) { return SUIT_RED[suitOf(c)]; }

  /* ---------- juhuslikkus ---------- */

  // Krüptograafiline RNG kui saadaval (aus jagamine), muidu Math.random.
  function makeRng() {
    var g = typeof globalThis !== "undefined" ? globalThis : this;
    var cr = g && g.crypto && g.crypto.getRandomValues ? g.crypto : null;
    if (!cr) return Math.random;
    var buf = new Uint32Array(64), pos = buf.length;
    return function () {
      if (pos >= buf.length) { cr.getRandomValues(buf); pos = 0; }
      return buf[pos++] / 4294967296;
    };
  }

  function shuffledDeck(rand) {
    var deck = new Array(52), i, j, t;
    for (i = 0; i < 52; i++) deck[i] = i;
    for (i = 51; i > 0; i--) {
      j = (rand() * (i + 1)) | 0;
      t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;
  }

  /* ---------- 5 kaardi hindaja ----------
     Tagastab täisarvu: suurem = tugevam käsi. Skoor kodeerib
     kategooria (0..8) ja viis võrdlusastet 13-süsteemis, seega
     võrdne skoor = täpselt võrdne käsi (poti jagamine). */
  function eval5(cs) {
    var cnt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var suit0 = suitOf(cs[0]), flush = true, i, r;
    for (i = 0; i < 5; i++) {
      cnt[rankOf(cs[i])]++;
      if (suitOf(cs[i]) !== suit0) flush = false;
    }
    var uniq = [];
    for (r = 12; r >= 0; r--) if (cnt[r]) uniq.push(r);

    var straightHigh = -1;
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
      else if (uniq[0] === 12 && uniq[1] === 3) straightHigh = 3; // ratas A-2-3-4-5
    }

    // Grupid: suurem hulk enne, sama hulga sees kõrgem aste enne
    var groups = [];
    for (r = 12; r >= 0; r--) if (cnt[r]) groups.push([cnt[r], r]);
    groups.sort(function (a, b) { return b[0] - a[0] || b[1] - a[1]; });

    var cat, t = [0, 0, 0, 0, 0];
    if (straightHigh >= 0 && flush) { cat = 8; t[0] = straightHigh; }
    else if (groups[0][0] === 4) { cat = 7; t[0] = groups[0][1]; t[1] = groups[1][1]; }
    else if (groups[0][0] === 3 && groups[1][0] === 2) { cat = 6; t[0] = groups[0][1]; t[1] = groups[1][1]; }
    else if (flush) { cat = 5; for (i = 0; i < 5; i++) t[i] = uniq[i]; }
    else if (straightHigh >= 0) { cat = 4; t[0] = straightHigh; }
    else if (groups[0][0] === 3) { cat = 3; t[0] = groups[0][1]; t[1] = groups[1][1]; t[2] = groups[2][1]; }
    else if (groups[0][0] === 2 && groups[1][0] === 2) { cat = 2; t[0] = groups[0][1]; t[1] = groups[1][1]; t[2] = groups[2][1]; }
    else if (groups[0][0] === 2) { cat = 1; t[0] = groups[0][1]; t[1] = groups[1][1]; t[2] = groups[2][1]; t[3] = groups[3][1]; }
    else { cat = 0; for (i = 0; i < 5; i++) t[i] = uniq[i]; }

    return ((((cat * 13 + t[0]) * 13 + t[1]) * 13 + t[2]) * 13 + t[3]) * 13 + t[4];
  }

  function catOf(score) {
    return (score / (13 * 13 * 13 * 13 * 13)) | 0;
  }

  // Skoor → eestikeelne käenimi, nt "Kaks paari, kuningad ja viied"
  function handName(score) {
    var t4 = score % 13; score = (score / 13) | 0;
    var t3 = score % 13; score = (score / 13) | 0;
    var t2 = score % 13; score = (score / 13) | 0;
    var t1 = score % 13; score = (score / 13) | 0;
    var t0 = score % 13;
    var cat = (score / 13) | 0;
    switch (cat) {
      case 8: return t0 === 12 ? "Kuninglik mastirida" : "Mastirida, kõrgeim " + RANK_SING[t0];
      case 7: return "Nelik, " + RANK_PLUR[t0];
      case 6: return "Täismaja, " + RANK_PLUR[t0] + " ja " + RANK_PLUR[t1];
      case 5: return "Mast, kõrgeim " + RANK_SING[t0];
      case 4: return "Rida, kõrgeim " + RANK_SING[t0];
      case 3: return "Kolmik, " + RANK_PLUR[t0];
      case 2: return "Kaks paari, " + RANK_PLUR[t0] + " ja " + RANK_PLUR[t1];
      case 1: return "Paar, " + RANK_PLUR[t0];
      default: return "Kõrge kaart, " + RANK_SING[t0];
    }
  }

  /* ---------- kombinatsioonid ---------- */

  function combos(n, k) {
    var out = [], idx = [], i;
    for (i = 0; i < k; i++) idx[i] = i;
    while (true) {
      out.push(idx.slice());
      i = k - 1;
      while (i >= 0 && idx[i] === n - k + i) i--;
      if (i < 0) break;
      idx[i]++;
      for (i++; i < k; i++) idx[i] = idx[i - 1] + 1;
    }
    return out;
  }

  var C5_OF_7 = combos(7, 5);   // Hold'em: 21 viisikut 7 kaardist
  var C2_OF_4 = combos(4, 2);   // Omaha: 6 taskupaari
  var C3_OF_5 = combos(5, 3);   // Omaha: 10 lauakolmikut

  // Hold'em: parim 5 kaardi käsi mistahes 2+5 kombinatsioonist
  function bestHoldem(hole, board) {
    var seven = hole.concat(board);
    var best = -1, bestCards = null, i, j;
    var pick = [0, 0, 0, 0, 0];
    for (i = 0; i < C5_OF_7.length; i++) {
      for (j = 0; j < 5; j++) pick[j] = seven[C5_OF_7[i][j]];
      var s = eval5(pick);
      if (s > best) { best = s; bestCards = pick.slice(); }
    }
    return { score: best, cards: bestCards };
  }

  // Omaha: TÄPSELT 2 taskukaarti + TÄPSELT 3 lauakaarti
  function bestOmaha(hole, board) {
    var best = -1, bestCards = null, i, j;
    var pick = [0, 0, 0, 0, 0];
    for (i = 0; i < C2_OF_4.length; i++) {
      pick[0] = hole[C2_OF_4[i][0]];
      pick[1] = hole[C2_OF_4[i][1]];
      for (j = 0; j < C3_OF_5.length; j++) {
        pick[2] = board[C3_OF_5[j][0]];
        pick[3] = board[C3_OF_5[j][1]];
        pick[4] = board[C3_OF_5[j][2]];
        var s = eval5(pick);
        if (s > best) { best = s; bestCards = pick.slice(); }
      }
    }
    return { score: best, cards: bestCards };
  }

  function bestHand(variant, hole, board) {
    return variant === "omaha" ? bestOmaha(hole, board) : bestHoldem(hole, board);
  }

  /* ---------- jagamine & arveldus ---------- */

  // Üks panus: jaga kõigile taskukaardid ja laud/lauad ÜHEST segatud pakist
  // (duplikaate ei teki). players = vastased + mängija (mängija indeks 0).
  function dealBet(opponents, variant, nBoards, rand) {
    var holeSize = variant === "omaha" ? 4 : 2;
    var players = opponents + 1;
    var deck = shuffledDeck(rand || makeRng());
    var pos = 0, hands = [], boards = [], p, b;
    for (p = 0; p < players; p++) { hands.push(deck.slice(pos, pos + holeSize)); pos += holeSize; }
    for (b = 0; b < nBoards; b++) { boards.push(deck.slice(pos, pos + 5)); pos += 5; }
    return { hands: hands, boards: boards };
  }

  // Ühe laua arveldus: iga mängija parim käsi + võitjate indeksid (viik = mitu)
  function settleBoard(hands, board, variant) {
    var results = hands.map(function (h) { return bestHand(variant, h, board); });
    var best = -1, i;
    for (i = 0; i < results.length; i++) if (results[i].score > best) best = results[i].score;
    var winners = [];
    for (i = 0; i < results.length; i++) if (results[i].score === best) winners.push(i);
    return { results: results, winners: winners, bestScore: best };
  }

  /* ---------- kontrollid ----------
     Väikesed ühiktesti-laadsed kontrollid. Käivita konsoolis:
       BombpotMath.runChecks()
     või node's: node -e "require('./bombpot-math.js').runChecks()" */

  function card(str) { // "As" = pada äss, "Th" = ärtu kümme, "9d" = ruutu üheksa
    var rc = str.slice(0, -1).toUpperCase(), sc = str.slice(-1).toLowerCase();
    var r = { "T": 8, "10": 8, "J": 9, "Q": 10, "K": 11, "A": 12 }[rc];
    if (r === undefined) r = parseInt(rc, 10) - 2;
    var s = { "s": 0, "h": 1, "d": 2, "c": 3 }[sc];
    return s * 13 + r;
  }
  function cards(str) { return str.trim().split(/\s+/).map(card); }

  function runChecks() {
    var checks = [];
    function chk(name, ok) { checks.push({ name: name, ok: !!ok }); }

    // Ratasrida A-2-3-4-5 on rida (kõrgeim 5) ja kaotab 6-kõrgele reale
    var wheel = eval5(cards("As 2h 3d 4c 5s"));
    var six = eval5(cards("2h 3d 4c 5s 6h"));
    chk("ratas A-2-3-4-5 on rida", catOf(wheel) === 4);
    chk("ratas kaotab 6-kõrgele reale", wheel < six);

    // Käteliigi järjestus: mastirida > nelik > täismaja > mast > rida > kolmik > kaks paari > paar > kõrge kaart
    var ladder = [
      eval5(cards("Ah Kd Qs Jc 9h")),  // kõrge kaart
      eval5(cards("Ah Ad Qs Jc 9h")),  // paar
      eval5(cards("Ah Ad Qs Qc 9h")),  // kaks paari
      eval5(cards("Ah Ad As Qc 9h")),  // kolmik
      eval5(cards("9h 8d 7s 6c 5h")),  // rida
      eval5(cards("Ah Jh 8h 5h 2h")),  // mast
      eval5(cards("Ah Ad As Qc Qh")),  // täismaja
      eval5(cards("Ah Ad As Ac 9h")),  // nelik
      eval5(cards("9h 8h 7h 6h 5h"))   // mastirida
    ];
    var ordered = true;
    for (var li = 1; li < ladder.length; li++) if (ladder[li] <= ladder[li - 1]) ordered = false;
    chk("käteliikide järjestus õige", ordered);

    // Hold'em: parim 5 seitsmest — tasku 2♣3♣ ei riku laua täismaja
    var he = bestHoldem(cards("2c 3c"), cards("Ah Ad As Kh Kd"));
    chk("hold'em mängib laua täismaja", catOf(he.score) === 6);

    // Omaha "täpselt 2": laual 4 ärtut, taskus vaid ÜKS ärtu → masti EI OLE
    var oHole = cards("Ah Ks Qd Jc"), oBoard = cards("2h 5h 9h Th 3s");
    var om = bestOmaha(oHole, oBoard);
    chk("omaha: 1 ärtu taskus + 4 laual ei anna masti", catOf(om.score) !== 5);
    var heSame = bestHoldem(cards("Ah Ks"), oBoard);
    chk("hold'em: sama olukord annab masti", catOf(heSame.score) === 5);

    // Omaha "täpselt 2" teistpidi: 2 ärtut taskus + 3 laual → mast ON
    var om2 = bestOmaha(cards("Ah 7h Qd Jc"), cards("2h 5h 9h Ts 3s"));
    chk("omaha: 2 ärtut taskus + 3 laual annab masti", catOf(om2.score) === 5);

    // Omaha: laua nelik ilma taskupaarita ei ole mängija nelik
    var om3 = bestOmaha(cards("2c 3d 7s 8h"), cards("As Ah Ad Ac Kh"));
    chk("omaha: laua nelikut ei saa mängida (max kolmik + 2 taskut)", catOf(om3.score) < 7);

    // Poti jagamine: mõlemad mängivad laua rida → viik
    var split = settleBoard([cards("2c 3d"), cards("7s 8h")], cards("Th Jd Qs Kc Ah"), "holdem");
    chk("laua rida = viik, pott pooleks", split.winners.length === 2);

    // Jagamine: 52 kaarti, duplikaate pole (6 mängijat, omaha, 2 lauda = 34 kaarti)
    var d = dealBet(5, "omaha", 2, makeRng());
    var all = [];
    d.hands.forEach(function (h) { all = all.concat(h); });
    d.boards.forEach(function (b) { all = all.concat(b); });
    var seen = {}, dup = false;
    all.forEach(function (c) { if (seen[c]) dup = true; seen[c] = 1; });
    chk("jagamisel pole duplikaatkaarte (34 kaarti)", !dup && all.length === 34);

    // Käenimed
    chk("käenime näide: kaks paari", handName(eval5(cards("Kh Kd 5s 5c 9h"))) === "Kaks paari, kuningad ja viied");
    chk("käenime näide: kuninglik mastirida", handName(eval5(cards("Ah Kh Qh Jh Th"))) === "Kuninglik mastirida");

    var allOk = checks.every(function (c) { return c.ok; });
    if (typeof console !== "undefined") {
      checks.forEach(function (c) { console.log((c.ok ? "✅" : "❌") + " " + c.name); });
      console.log(allOk ? "Bomb Pot: kõik kontrollid läbitud" : "Bomb Pot: MÕNI KONTROLL EBAÕNNESTUS!");
    }
    return allOk;
  }

  return {
    RANK_CHARS: RANK_CHARS, SUIT_CHARS: SUIT_CHARS, CAT_NAMES: CAT_NAMES,
    rankOf: rankOf, suitOf: suitOf, cardText: cardText, isRed: isRed,
    makeRng: makeRng, shuffledDeck: shuffledDeck,
    eval5: eval5, catOf: catOf, handName: handName,
    bestHoldem: bestHoldem, bestOmaha: bestOmaha, bestHand: bestHand,
    dealBet: dealBet, settleBoard: settleBoard,
    card: card, cards: cards, runChecks: runChecks
  };
});
