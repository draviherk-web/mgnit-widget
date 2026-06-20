/*!
 * Mags — MGNIT Gaming free support widget (v2 — smarter matching)
 * Rule-based, runs fully in the browser. No AI/API calls, no backend, no cost.
 * Install: paste <script src="mgnit-mags-widget.js"></script> right before </body>
 * Edit: update the GAMES / CATEGORIES / FAQS / NAV arrays below to add or change content.
 *
 * v2 changes:
 *  - Fuzzy/typo-tolerant matching (Levenshtein distance) layered on top of exact matching.
 *  - Token-overlap scoring: best match wins instead of first match, handles word-order
 *    and partial-phrase input ("how play hero" / "rules for the inc hero game").
 *  - Expanded keyword/synonym lists per FAQ, category, and nav entry based on how
 *    real players actually phrase things (typos, slang, shorthand).
 *  - Friendlier, less templated fallback + a few varied bot phrasings so it doesn't
 *    feel like a scripted wall every time.
 *
 * v2.1 fixes (see CHANGELOG comment near the bottom of this file for details):
 *  - FAQ topics (kids safety, accounts, etc.) now take priority over loose category
 *    matches, so e.g. "is this safe for my kid" no longer gets hijacked into a Kids
 *    game recommendation instead of the safety answer.
 *  - Fuzzy word matching tightened (same-first-letter + stricter length-scaled edit
 *    distance) to remove false-positive collisions like "gaming"~"racing" or
 *    "offline"~"online" that were misrouting unrelated questions.
 *  - Onboarding trigger phrases widened ("give me a tour", "how do i get started",
 *    "what is this site", etc.) so common new-player phrasing isn't missed.
 *  - Greeting typo-tolerance fixed for 4-5 letter typos (e.g. "helo").
 *  - Multi-word game titles that contain filler words ("Anime Find The Differences",
 *    "What Number is it?") can now actually be fuzzy-matched by name.
 */
(function () {
  "use strict";

  var SITE = "https://mgnitgaming.com";

  /* ---------------- KNOWLEDGE BASE ---------------- */

  var GAMES = [
    { name: "Hero Inc", slug: "hero-inc", category: "adventure",
      rules: "Use the keyboard or on-screen controls to move your hero through each 3D level. Explore the map, fight enemies in real-time combat, and pick up items or skills as you go. Defeat the level's boss or reach the exit to clear the stage and unlock the next one." },
    { name: "Neon Pong", slug: "neon-pong", category: "arcade",
      rules: "Control your paddle with the mouse, touch, or arrow keys and keep the neon ball from passing your side. Hit the ball back toward the opponent's side to score a point. First to the target score (or whoever's ahead when time runs out) wins." },
    { name: "Candy Ice Cream Crush", slug: "candy-ice-cream-crush-6803344d99ba5", category: "puzzles",
      rules: "Swap two neighboring pieces so 3 or more of the same type line up in a row or column. Matching clears them and scores points; matching 4+ creates a power-up. Hit the level's target score before you run out of moves or time." },
    { name: "Claritas Dungeon Crawler RPG", slug: "claritas-dungeon-crawler-rpg-demo", category: "adventure",
      rules: "A turn-based dungeon crawler: you take one move or action, then enemies take theirs. There's no time pressure, so plan attacks, defense, and item use carefully. Clear each room of enemies to move deeper into the dungeon." },
    { name: "Juicy Run", slug: "juicy-run", category: "casual",
      rules: "Tap, click, or use the arrow keys to run, jump, and dodge obstacles on the track. Collect coins or fruit for extra points. Hitting an obstacle ends the run, so timing your jumps right is the key skill." },
    { name: "Anime Find The Differences", slug: "anime-find-the-differences", category: "puzzles",
      rules: "Two anime-style images are shown side by side. Click every spot where they differ. Find all the differences before time runs out (if a timer is set) to clear the level and unlock the next picture." },
    { name: "Poker2048", slug: "poker2048", category: "puzzles",
      rules: "Played on a 4x4 grid: slide and merge matching cards to build poker hands like Pair, Three of a Kind, Straight, or Flush. Stronger hands score more. Draw new cards as needed — the game ends when the deck is empty or no moves remain." },
    { name: "Bus Parking Unblocked", slug: "bus-parking-unblocked", category: "action",
      rules: "Steer, accelerate, brake, and reverse a long city bus through tight turns and around cones using the on-screen or arrow-key controls. Park inside the marked bay without hitting obstacles. Each level is timed — park accurately and fast to earn up to three stars." },
    { name: "Abyssal Echoes", slug: "abyssal-echoes", category: "action",
      rules: "An atmospheric underwater exploration game — guide your character through a deep-sea facility, solving environmental puzzles and avoiding dangers as you uncover what happened there. Move carefully and manage your resources to keep progressing." },
    { name: "Bhoolu", slug: "bhoolu", category: "monster",
      rules: "A platformer/runner game — guide the Bhoolu character past obstacles and monsters, collecting items along the way. Reach the end of the level without losing all your lives to win the stage." },
    { name: "BounceShift", slug: "bounceshift", category: "hypercasual",
      rules: "A one-tap physics game — tap to make your character bounce and shift direction, timing each bounce to land on platforms and avoid hazards. Travel as far as possible without falling to set a new high score." },
    { name: "Algerian Solitaire", slug: "algerian-solitaire", category: "board",
      rules: "A solitaire card variant played with a standard deck. Sort all cards into the four foundation piles by suit, Ace to King, by moving cards between tableau columns following standard solitaire rules." },
    { name: "The Dry Rains", slug: "the-dry-rains", category: "hypercasual",
      rules: "A casual reflex/timing game — tap or click at the right moment to keep your character safe as conditions on screen change. Survive as long as possible for the highest score." },
    { name: "All Golf!", slug: "all-golf", category: "arcade",
      rules: "Aim your shot with the on-screen power and direction control, then release to hit the ball toward the hole. Finish each hole in as few strokes as possible, accounting for slopes and obstacles." },
    { name: "Pixcade 2 Player Escape", slug: "pixcade-2-player-escape", category: "arcade",
      rules: "Built for two players sharing one keyboard — each player controls their own character with a separate set of keys. Work together to solve each level's puzzles and reach the exit before time runs out." },
    { name: "Crowd Runners 3D", slug: "crowd-runners-3d", category: "action",
      rules: "Guide your crowd of runners down the track through gates that multiply, shrink, or eliminate runners. Keep as many alive as possible to win crowd battles and cross the finish line with the biggest crowd." },
    { name: "Diamont", slug: "diamont", category: "kids",
      rules: "A simple collect-and-avoid game for younger players — guide your character to gather diamonds while steering clear of hazards. Collect the target number of diamonds, or reach the end of the level, to win." },
    { name: "What Number is it?", slug: "what-number-is-it", category: "kids",
      rules: "A number-recognition mini-game — look at the number or pattern shown and tap the matching answer. Answer correctly to move to the next round." }
  ];

  var CATEGORIES = [
    { key: "arcade", label: "Arcade", keywords: ["arcade", "arcad", "arkade"],
      rules: "Arcade games are quick, skill-based games played with mouse, touch, or arrow keys. The goal is usually to score as many points as possible or survive as long as you can.",
      picks: ["neon-pong", "all-golf", "pixcade-2-player-escape"] },
    { key: "puzzles", label: "Puzzles", keywords: ["puzzle", "puzzles", "match-3", "match 3", "match3", "puzzel", "puzzal", "brain game", "brain teaser"],
      rules: "Puzzle games are about logic and pattern-solving. You'll match, sort, slide, or rearrange pieces to meet each level's goal within a limited number of moves or amount of time.",
      picks: ["candy-ice-cream-crush-6803344d99ba5", "poker2048", "anime-find-the-differences"] },
    { key: "hypercasual", label: "Hypercasual", keywords: ["hypercasual", "hyper casual", "hyper-casual", "hyper", "one tap", "one-tap"],
      rules: "Hypercasual games use one-tap or one-swipe controls. The goal is usually to survive, travel as far as possible, or repeat an action correctly to set a new high score.",
      picks: ["bounceshift", "the-dry-rains"] },
    { key: "adventure", label: "Adventure", keywords: ["adventure", "adventur", "story game", "rpg"],
      rules: "Adventure games let you control a character through levels or a story — fighting enemies, solving challenges, and collecting items. Progress by completing each level's objective.",
      picks: ["hero-inc", "claritas-dungeon-crawler-rpg-demo"] },
    { key: "action", label: "Action", keywords: ["action", "fighting", "combat", "shooter", "racing", "race game"],
      rules: "Action games are fast-paced — combat, racing, or quick-reflex challenges. The goal is usually to defeat opponents, finish a course, or survive a level while avoiding damage.",
      picks: ["crowd-runners-3d", "bus-parking-unblocked", "abyssal-echoes"] },
    { key: "kids", label: "Kids", keywords: ["kid", "kids", "child", "children", "for kids", "kid friendly", "kid-friendly", "toddler"],
      rules: "Kids games use very simple, friendly controls — tap, click, or drag. They focus on matching, coloring, counting, or simple obstacle courses, with no violence.",
      picks: ["diamont", "what-number-is-it"] },
    { key: "casual", label: "Casual", keywords: ["casual", "relaxing", "relaxed", "chill game", "easy game"],
      rules: "Casual games are easy to pick up — swap, tap, or run to match items or clear obstacles. Built for short, relaxed play sessions, no prior gaming experience needed.",
      picks: ["juicy-run"] },
    { key: "board", label: "Board", keywords: ["board", "card game", "cards", "solitaire", "boardgame"],
      rules: "Board games follow the same rules as their classic tabletop versions, like solitaire or checkers, just played digitally with click or tap controls.",
      picks: ["algerian-solitaire"] }
  ];

  var FAQS = [
    { key: "loading", keywords: ["load", "loading", "lode", "loding", "not working", "isnt working", "isn't working", "doesnt work", "doesn't work", "wont play", "won't play", "wont open", "won't open", "not opening", "stuck", "black screen", "white screen", "blank screen", "lag", "lagging", "laggy", "freeze", "freezing", "frozen", "slow", "buffering", "crash", "crashing", "crashed", "404", "error", "glitch", "glitchy", "broken"],
      label: "Game not loading", answer: "All games run straight in your browser — no downloads or installs needed. If a game won't load: refresh the page, try a different browser (latest Chrome/Edge works best), check your internet connection, and temporarily disable any ad-blocker, since it can sometimes block the game embed. Still stuck? Use the Report button on the game page so our team can take a look." },
    { key: "account", keywords: ["account", "register", "registration", "sign up", "signup", "sign-up", "login", "log in", "log-in", "logged in", "logging in", "password", "forgot password", "reset password", "email", "verify", "verification", "create account", "delete account", "username", "change email", "change username"],
      label: "Accounts & login", answer: "You don't need an account to play — just click Play Now on any game. If you'd like to track your stats and appear on the leaderboard, create a free account with a username, email, and password (8+ characters), or sign up instantly with Google.",
      links: [{ label: "Register", url: SITE + "/register" }, { label: "Login", url: SITE + "/login" }] },
    { key: "leaderboard", keywords: ["leaderboard", "leaderboards", "leader board", "rank", "ranking", "ranked", "coins", "top player", "top players", "score board", "scoreboard", "high score", "high scores", "playtime", "favorites", "most played"],
      label: "Leaderboard & coins", answer: "The leaderboard ranks players by Most Games Played, Most Coins Earned, Most Playtime, and Most Favorites. Create a free account and start playing — your stats update automatically as you go.",
      links: [{ label: "View leaderboard", url: SITE + "/leaderboards" }] },
    { key: "safety", keywords: ["safe", "safety", "is it safe", "appropriate", "age", "age limit", "parent", "parental", "parental control", "violence", "violent", "explicit", "nsfw"],
      label: "Kids safety", answer: "Our Community Guidelines keep the platform safe for all ages — hate speech, harassment, and sexually explicit or illegal content are never allowed. Every game, comment, and profile has a Report button, and our team reviews every report.",
      links: [{ label: "Community Guidelines", url: SITE + "/page/mgnit-gaming-ltd-community-guidelines" }] },
    { key: "report", keywords: ["report", "abuse", "inappropriate", "bug", "complain", "complaint", "violation", "issue", "offensive", "harassment", "flag this", "flag a"],
      label: "Report a problem", answer: "Use the Report button on the game, comment, or profile in question, and include as much detail as you can (a screenshot or URL helps a lot). You can also reach the team directly at info@mgnitgaming.com." },
    { key: "free", keywords: ["free to play", "is this free", "cost money", "does it cost", "price", "paid", "subscription", "free to use"],
      label: "Is it free?", answer: "Yep — MGNIT Gaming is 100% free to play. No subscriptions, no paywalls, no downloads. Just pick a game and hit Play." },
    { key: "offline", keywords: ["offline", "without internet", "no internet", "download the game", "play offline"],
      label: "Offline play", answer: "All our games run in-browser, so you'll need an internet connection to load and play them. We don't currently offer offline or downloadable versions." },
    { key: "device", keywords: ["mobile", "phone", "tablet", "ipad", "android", "iphone", "which browser", "best browser", "browser support"],
      label: "Devices & browsers", answer: "Most games work great on phones and tablets through your mobile browser, though a few play best on desktop. For the smoothest experience, use an up-to-date Chrome, Firefox, Edge, or Safari." },
    { key: "ads", keywords: ["ads", "advertisement", "advertisements", "advert", "commercials"],
      label: "Ads on the site", answer: "Like most free gaming sites, we show some advertising to help cover hosting costs — we keep it as light as possible so it doesn't get in the way of your gameplay." },
    { key: "submit", keywords: ["submit a game", "submit my game", "upload a game", "add my game", "developer", "publish my game"],
      label: "Submitting a game", answer: "Got a browser game you'd like featured? Head to the Submit a Game page, log in, and follow the upload steps with your game's files/link, title, and description. Our team reviews submissions and you'll hear back by email.",
      links: [{ label: "Submit a game", url: SITE + "/submit-game" }] },
    { key: "human", keywords: ["talk to a human", "real person", "human support", "contact support", "speak to someone", "customer service", "support email"],
      label: "Talk to a human", answer: "If I can't sort it out, our team is just an email away at info@mgnitgaming.com — include screenshots or details about your device/browser if it's a bug, that helps a lot." }
  ];

  var NAV = [
    { keywords: ["home", "homepage", "main page", "go home"], label: "Home", answer: "Here's the homepage, where you'll find featured and recently added games.", url: SITE + "/" },
    { keywords: ["categories", "category", "genres", "genre", "browse", "browse games", "all games"], label: "Categories", answer: "All game categories — Arcade, Puzzles, Adventure, Action, Hypercasual, Kids, and more — live here.", url: SITE + "/categories" },
    { keywords: ["leaderboard", "leaderboards", "rank", "rankings"], label: "Leaderboards", answer: "Here's the leaderboard, ranked by games played, coins, playtime, and favorites.", url: SITE + "/leaderboards" },
    { keywords: ["blog", "news", "article", "articles", "guides"], label: "Blog", answer: "Our blog has game guides, tips, and platform news.", url: SITE + "/blog" },
    { keywords: ["submit", "developer", "upload game", "add game", "publish game"], label: "Submit a game", answer: "Game developers can submit their own game for the platform here.", url: SITE + "/submit-game" },
    { keywords: ["login", "log in", "log-in", "sign in", "signin"], label: "Login", answer: "You can sign in here.", url: SITE + "/login" },
    { keywords: ["register", "sign up", "signup", "sign-up", "create account"], label: "Register", answer: "Create your free account here.", url: SITE + "/register" }
  ];

  var RECOMMEND_TRIGGERS = ["recommend", "suggest", "what should i play", "what should i", "bored", "something fun", "what game", "any game", "good game", "fun game", "best game", "play something", "give me a game"];
  var ONBOARD_TRIGGERS = ["new here", "first time", "getting started", "get started", "how does this site work", "how does this work", "what is this site", "what's this site", "tutorial", "take a tour", "give me a tour", "show me a tour", "i'm new", "im new", "new player", "new to this", "how do i start", "where do i start", "show me around", "how do i get started"];
  var GREETING_WORDS = { "hi": 1, "hello": 1, "hey": 1, "yo": 1, "hiya": 1, "heya": 1, "sup": 1, "howdy": 1, "salam": 1, "assalam": 1, "assalamualaikum": 1, "hola": 1 };
  var GREETING_REPLIES = [
    "Hey there! \u{1F44B} I'm Mags. What can I help you with?",
    "Hi! Good to see you \u2014 what do you need?",
    "Hello! How can I help today?"
  ];

  function isGreeting(text) {
    // Treat as a greeting only if the message is SHORT and made up of greeting
    // words (plus minor punctuation/typos) \u2014 so "hi" and "hey there" count, but
    // "hi, how do i reset my password" still falls through to real matching.
    var words = tokenize(text);
    if (words.length === 0 || words.length > 3) return false;
    var greetingKeys = Object.keys(GREETING_WORDS);
    for (var i = 0; i < words.length; i++) {
      if (words[i] === "there" || words[i] === "guys" || words[i] === "team") continue;
      if (GREETING_WORDS[words[i]]) continue;
      var fuzzyHit = false;
      for (var j = 0; j < greetingKeys.length; j++) {
        if (fuzzyWordMatch(words[i], greetingKeys[j])) { fuzzyHit = true; break; }
        // fuzzyWordMatch only kicks in at 5+ chars; greeting words/typos are
        // almost always shorter than that ("hi"/"hey"/"helo"/"hii"/"sup"), so
        // handle the short range directly with a tight Levenshtein check
        // against this small, fixed dictionary (low collision risk since
        // there are only ~12 candidates, unlike general vocabulary matching).
        if (words[i].length <= 5 && greetingKeys[j].length <= 5 && levenshtein(words[i], greetingKeys[j]) <= 1) { fuzzyHit = true; break; }
      }
      if (!fuzzyHit) return false;
    }
    return true;
  }

  // Friendlier varied phrasing so the bot doesn't feel like a scripted wall every time
  var FALLBACK_LINES = [
    "Hmm, I'm not totally sure on that one \u2014 but here's what I can help with:",
    "I don't have an exact answer for that yet, but maybe one of these helps:",
    "Not quite catching that \u2014 try rephrasing, or pick something below:"
  ];
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------------- FUZZY / TOKEN MATCHING ---------------- */

  // Damerau-Levenshtein edit distance — like standard Levenshtein but also treats
  // an adjacent-letter swap (e.g. "icn" for "inc") as a single edit instead of two.
  // That's the most common real typo pattern, so it matters for short words.
  function levenshtein(a, b) {
    if (a === b) return 0;
    var al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    var d = [];
    for (var i = 0; i <= al; i++) { d[i] = []; d[i][0] = i; }
    for (var j = 0; j <= bl; j++) d[0][j] = j;
    for (i = 1; i <= al; i++) {
      for (j = 1; j <= bl; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        var val = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        );
        if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
          val = Math.min(val, d[i - 2][j - 2] + 1);
        }
        d[i][j] = val;
      }
    }
    return d[al][bl];
  }

  // Two words are a "fuzzy match" if they're close enough relative to their length.
  // Short words need an exact/near-exact match (avoids "a" matching everything);
  // longer words tolerate 1-2 typo'd characters — but ONLY if they also start with
  // the same letter. Real-world typos (fat-finger, missed key, transposition)
  // overwhelmingly preserve the first character; requiring it eliminates most
  // false-positive collisions between same-length-but-unrelated words (e.g.
  // "racing"/"gaming", "offline"/"online", "appropriate"/"inappropriate") while
  // costing almost no legitimate typo matches.
  function fuzzyWordMatch(w1, w2) {
    if (w1 === w2) return true;
    // Words under 5 chars are too collision-prone for fuzzy tolerance — a single
    // edit on a short word ("slow"/"show", "blog"/"log", "free"/"tree") usually
    // lands on a completely different real word rather than a typo of the same
    // word. Common short-word typos are instead handled by adding explicit
    // variants to the keyword lists (e.g. "lode"/"loding" alongside "load").
    if (w1.length < 5 || w2.length < 5) return false;
    if (w1.charAt(0) !== w2.charAt(0)) return false;
    var maxLen = Math.max(w1.length, w2.length);
    // Roughly 1 edit allowed per 4 characters — stricter than a flat "2 edits
    // for anything under 10 chars", which was loose enough to match unrelated
    // 6-7 letter words against each other.
    var allowed = maxLen <= 8 ? 1 : (maxLen <= 12 ? 2 : 3);
    return levenshtein(w1, w2) <= allowed;
  }

  function tokenize(text) {
    return (text || "").toLowerCase().match(/[a-z0-9']+/g) || [];
  }

  // Filler words that shouldn't count toward a fuzzy/token match score on their own —
  // without this, generic phrases like "download the game" would score points just
  // because the input also contains "the" and "game".
  var STOPWORDS = { "the": 1, "a": 1, "an": 1, "is": 1, "it": 1, "to": 1, "of": 1, "in": 1,
    "on": 1, "my": 1, "me": 1, "i": 1, "you": 1, "do": 1, "does": 1, "did": 1, "this": 1,
    "for": 1, "and": 1, "or": 1, "game": 1, "games": 1, "play": 1, "playing": 1, "with": 1 };

  function meaningfulTokens(tokens) {
    var out = [];
    for (var i = 0; i < tokens.length; i++) {
      if (!STOPWORDS[tokens[i]]) out.push(tokens[i]);
    }
    return out;
  }

  // Scores how well `text` matches a single keyword/phrase:
  //  +2 per exact substring hit of the whole phrase (cheap win for short exact phrases)
  //  +1 per token in the keyword phrase that fuzzy-matches a token in the input
  // Returns a numeric score (0 = no match at all).
  function wholeWordBoundaryMatch(fullText, normPhrase) {
    // Escape regex special chars in the phrase (keywords can contain things like
    // "match-3" or "log-in"), then require word boundaries on both sides so a
    // short keyword can't score just by being embedded inside a longer word
    // (e.g. "board" inside "leaderboard", "log" inside "blog" or "catalog").
    var escaped = normPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var re = new RegExp("\\b" + escaped + "\\b");
    return re.test(fullText);
  }

  function scorePhrase(textTokens, fullText, phrase) {
    var score = 0;
    var normPhrase = norm(phrase);
    if (wholeWordBoundaryMatch(fullText, normPhrase)) score += 2;

    var phraseTokens = meaningfulTokens(tokenize(normPhrase));
    if (phraseTokens.length === 0) return score; // pure-stopword phrase, substring hit only

    var hits = 0;
    for (var i = 0; i < phraseTokens.length; i++) {
      for (var j = 0; j < textTokens.length; j++) {
        if (fuzzyWordMatch(phraseTokens[i], textTokens[j])) { hits++; break; }
      }
    }
    // For multi-word phrases, a single overlapping word isn't enough on its own —
    // e.g. input "no" shouldn't score against keyword "no internet" just because
    // "no" is technically one of its two words. Require matching MORE than half
    // the phrase's words before counting token-overlap score. Single-word phrases
    // (most FAQ/category keywords) are unaffected — 1 of 1 still clears "more than half".
    var neededHits = phraseTokens.length === 1 ? 1 : Math.floor(phraseTokens.length / 2) + 1;
    if (hits >= neededHits) score += hits;
    return score;
  }

  // Scores text against a list of keyword phrases, returns the best single score.
  function scoreKeywordList(textTokens, fullText, keywords) {
    var best = 0;
    for (var i = 0; i < keywords.length; i++) {
      var s = scorePhrase(textTokens, fullText, keywords[i]);
      if (s > best) best = s;
    }
    return best;
  }

  function norm(s) { return (s || "").toLowerCase().trim(); }

  function containsAny(text, keywords) {
    for (var i = 0; i < keywords.length; i++) {
      if (text.indexOf(keywords[i]) !== -1) return true;
    }
    return false;
  }

  // Picks the best-scoring entry from a list, given a function that returns
  // that entry's keyword array. Requires a minimum score to avoid noisy matches.
  function bestMatch(text, items, getKeywords, minScore) {
    var textTokens = meaningfulTokens(tokenize(text));
    var best = null, bestScore = 0;
    for (var i = 0; i < items.length; i++) {
      var s = scoreKeywordList(textTokens, text, getKeywords(items[i]));
      if (s > bestScore) { bestScore = s; best = items[i]; }
    }
    return bestScore >= minScore ? best : null;
  }

  function findGameByName(text) {
    // Exact substring still wins outright (handles "play hero inc now" cleanly).
    var sorted = GAMES.slice().sort(function (a, b) { return b.name.length - a.name.length; });
    for (var i = 0; i < sorted.length; i++) {
      if (text.indexOf(norm(sorted[i].name)) !== -1) return sorted[i];
    }
    // Space-insensitive substring check — handles names with no internal space
    // in the data (e.g. "Poker2048") that players naturally type WITH a space
    // ("poker 2048"), and the reverse case too.
    var textNoSpace = text.replace(/\s+/g, "");
    for (i = 0; i < sorted.length; i++) {
      var nameNoSpace = norm(sorted[i].name).replace(/\s+/g, "");
      if (textNoSpace.indexOf(nameNoSpace) !== -1) return sorted[i];
    }
    // Fuzzy/token fallback for typo'd or partial game names, e.g. "hiro inc rules".
    var textTokens = tokenize(text);
    var best = null, bestScore = 0;
    // Filler words that can appear INSIDE a game's own title but that a player
    // would basically never bother typing ("the", "is", "it"...). Counting them
    // toward the "words you must match" total made multi-word titles like
    // "Anime Find The Differences" or "What Number is it?" nearly impossible to
    // fuzzy-match, since a player typing "find the differences game" can never
    // supply "the" as a meaningful signal. They're excluded from BOTH the score
    // and the required-hit count below, so they can't inflate or block a match.
    var NAME_FILLER = { "the": 1, "is": 1, "it": 1, "a": 1, "an": 1, "of": 1, "this": 1 };
    for (i = 0; i < GAMES.length; i++) {
      var nameTokens = tokenize(GAMES[i].name);
      var significantTokens = nameTokens.filter(function (t) { return !NAME_FILLER[t]; });
      var score = 0;
      for (var j = 0; j < significantTokens.length; j++) {
        for (var k = 0; k < textTokens.length; k++) {
          if (fuzzyWordMatch(significantTokens[j], textTokens[k])) { score += 1; break; }
        }
      }
      // Require matching MOST of the significant words in the game's name (not
      // just one generic word like "run" or "echoes") so short/common words
      // don't falsely trigger a game page. Single-word names still need that
      // one word to match.
      var needed = significantTokens.length <= 1 ? 1 : Math.max(2, significantTokens.length - 1);
      if (score >= needed && score > bestScore) { bestScore = score; best = GAMES[i]; }
    }
    return best;
  }

  function findCategory(text) {
    return bestMatch(text, CATEGORIES, function (c) { return c.keywords; }, 1);
  }

  function findFAQ(text) {
    return bestMatch(text, FAQS, function (f) { return f.keywords; }, 1);
  }

  function findNav(text) {
    return bestMatch(text, NAV, function (n) { return n.keywords; }, 1);
  }

  function gameUrl(slug) { return SITE + "/game/" + slug; }
  function gameByslug(slug) {
    for (var i = 0; i < GAMES.length; i++) if (GAMES[i].slug === slug) return GAMES[i];
    return null;
  }

  /* ---------------- WIDGET UI ---------------- */

  var css = "" +
    "#mgw-launcher{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:50%;background:#1DBF73;border:none;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);z-index:999998;display:flex;align-items:center;justify-content:center;transition:transform .15s ease}" +
    "#mgw-launcher:hover{transform:scale(1.06)}" +
    "#mgw-launcher svg{width:26px;height:26px;fill:#fff}" +
    "#mgw-panel{position:fixed;bottom:96px;right:24px;width:360px;max-width:92vw;height:540px;max-height:78vh;background:#fff;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;z-index:999999;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}" +
    "#mgw-panel.mgw-open{display:flex}" +
    "#mgw-head{background:#15A864;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex:0 0 auto}" +
    "#mgw-head .mgw-title{font-size:15px;font-weight:600}" +
    "#mgw-head .mgw-sub{font-size:11px;opacity:.85;margin-top:2px}" +
    "#mgw-close{background:transparent;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;padding:4px}" +
    "#mgw-body{flex:1 1 auto;overflow-y:auto;padding:14px;background:#F4F6F8;display:flex;flex-direction:column;gap:10px}" +
    ".mgw-row{display:flex}" +
    ".mgw-row.bot{justify-content:flex-start}" +
    ".mgw-row.user{justify-content:flex-end}" +
    ".mgw-bubble{max-width:82%;padding:10px 13px;border-radius:14px;font-size:13.5px;line-height:1.45;white-space:pre-wrap}" +
    ".mgw-bubble.bot{background:#fff;color:#222;border:1px solid #E6E9EC;border-bottom-left-radius:4px}" +
    ".mgw-bubble.user{background:#1DBF73;color:#fff;border-bottom-right-radius:4px}" +
    ".mgw-bubble a{color:#0F6E56;font-weight:600;text-decoration:underline}" +
    ".mgw-bubble.user a{color:#fff}" +
    ".mgw-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}" +
    ".mgw-chip{background:#fff;border:1px solid #1DBF73;color:#0F6E56;border-radius:999px;padding:6px 12px;font-size:12.5px;cursor:pointer;transition:background .15s}" +
    ".mgw-chip:hover{background:#E1F5EE}" +
    ".mgw-typing{display:flex;gap:4px;padding:12px 14px;align-items:center}" +
    ".mgw-typing span{width:7px;height:7px;border-radius:50%;background:#B7BEC4;display:inline-block;animation:mgw-bounce 1.1s infinite ease-in-out}" +
    ".mgw-typing span:nth-child(2){animation-delay:.15s}" +
    ".mgw-typing span:nth-child(3){animation-delay:.3s}" +
    "@keyframes mgw-bounce{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}" +
    "#mgw-foot{flex:0 0 auto;display:flex;gap:8px;padding:10px;border-top:1px solid #E6E9EC;background:#fff}" +
    "#mgw-input{flex:1;border:1px solid #DADEE2;border-radius:999px;padding:10px 14px;font-size:13.5px;outline:none;background:#fff !important;color:#1a1a1a !important;caret-color:#1a1a1a !important;box-sizing:border-box;-webkit-text-fill-color:#1a1a1a}" +
    "#mgw-input::placeholder{color:#8a8f94 !important}" +
    "#mgw-input:focus{border-color:#1DBF73}" +
    "#mgw-panel{color:#1a1a1a}" +
    "#mgw-foot{color:#1a1a1a}" +
    "#mgw-send{background:#1DBF73;border:none;color:#fff;border-radius:50%;width:38px;height:38px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:0 0 auto}" +
    "#mgw-send svg{width:16px;height:16px;fill:#fff}" +
    "@media (max-width:480px){#mgw-panel{right:0;bottom:0;width:100%;height:100%;max-height:100%;border-radius:0}#mgw-launcher{bottom:16px;right:16px}}";

  function injectCSS() {
    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  var bodyEl, panelEl;

  function scrollToBottom() { bodyEl.scrollTop = bodyEl.scrollHeight; }

  function addBubble(role, html) {
    if (role === "bot") {
      return addBotBubbleWithTyping(html);
    }
    var row = el("div", { class: "mgw-row " + role });
    var bubble = el("div", { class: "mgw-bubble " + role }, html);
    row.appendChild(bubble);
    bodyEl.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  // Shows a brief animated "typing" bubble, then swaps it for the real bot message.
  // Keeps addBubble's signature/return value the same so every existing call site
  // (mainMenu, FAQ answers, fallback, etc.) keeps working without changes.
  var TYPING_DELAY_MS = 1000;
  function addBotBubbleWithTyping(html) {
    var row = el("div", { class: "mgw-row bot" });
    var bubble = el("div", { class: "mgw-bubble bot mgw-typing" }, "<span></span><span></span><span></span>");
    row.appendChild(bubble);
    bodyEl.appendChild(row);
    scrollToBottom();
    setTimeout(function () {
      bubble.classList.remove("mgw-typing");
      bubble.innerHTML = html;
      scrollToBottom();
    }, TYPING_DELAY_MS);
    return bubble;
  }

  function addChips(items) {
    setTimeout(function () {
      var row = el("div", { class: "mgw-row bot" });
      var wrap = el("div", { class: "mgw-chips" });
      items.forEach(function (item) {
        var chip = el("button", { class: "mgw-chip", type: "button" }, item.label);
        chip.addEventListener("click", function () { onUserSubmit(item.value || item.label, true); });
        wrap.appendChild(chip);
      });
      row.appendChild(wrap);
      bodyEl.appendChild(row);
      scrollToBottom();
    }, TYPING_DELAY_MS);
  }

  function linkHtml(label, url) {
    return '<a href="' + url + '" target="_blank" rel="noopener">' + label + " &rarr;</a>";
  }

  function mainMenu() {
    addChips([
      { label: "🎮 Recommend a game", value: "recommend a game" },
      { label: "📜 Game rules", value: "game rules" },
      { label: "🧭 Site navigation", value: "site navigation" },
      { label: "❓ FAQ / Help", value: "faq help" },
      { label: "👋 New here? Quick tour", value: "new here take a tour" }
    ]);
  }

  function categoryChips(onPick) {
    setTimeout(function () {
      var row = el("div", { class: "mgw-row bot" });
      var wrap = el("div", { class: "mgw-chips" });
      CATEGORIES.forEach(function (c) {
        var chip = el("button", { class: "mgw-chip", type: "button" }, c.label);
        chip.addEventListener("click", function () { onPick(c); });
        wrap.appendChild(chip);
      });
      row.appendChild(wrap);
      bodyEl.appendChild(row);
      scrollToBottom();
    }, TYPING_DELAY_MS);
  }

  function showRecommendations(category) {
    var lines = category.picks.map(function (slug) {
      var g = gameByslug(slug);
      return g ? "&bull; " + linkHtml(g.name, gameUrl(g.slug)) : "";
    }).join("<br>");
    addBubble("bot", "Here are some " + category.label + " games to try:<br>" + lines);
    addChips([{ label: "Pick another category", value: "recommend a game" }, { label: "Main menu", value: "menu" }]);
  }

  function showGameRules(game) {
    addBubble("bot", "<b>" + game.name + "</b><br>" + game.rules + "<br><br>" + linkHtml("Play " + game.name, gameUrl(game.slug)));
    addChips([{ label: "Another game", value: "game rules" }, { label: "Main menu", value: "menu" }]);
  }

  function showCategoryRules(category) {
    addBubble("bot", "<b>" + category.label + " games</b><br>" + category.rules);
    addChips([{ label: "Another category", value: "game rules" }, { label: "Main menu", value: "menu" }]);
  }

  function runOnboarding() {
    var steps = [
      "Welcome to MGNIT Gaming! Everything here plays straight in your browser \u2014 no downloads, no installs, no sign-up required to start playing.",
      "Browse by category from the menu \u2014 Arcade, Puzzles, Adventure, Action, Hypercasual, Kids, and more. Just click a game's Play Now button.",
      "Want to track your progress and show up on the leaderboard? Create a free account anytime \u2014 it only takes an email and a username.",
      "We also keep things safe for every age \u2014 check our Community Guidelines, and use the Report button if anything ever looks off."
    ];
    var i = 0;
    function next() {
      if (i < steps.length) {
        // addBotBubbleWithTyping already waits TYPING_DELAY_MS before showing the
        // text, so just chain straight off that instead of adding a second delay
        // on top (which used to make steps lag further behind each typing animation).
        addBotBubbleWithTyping(steps[i]);
        i++;
        setTimeout(next, TYPING_DELAY_MS + 300);
      } else {
        addChips([{ label: "🎮 Recommend me a game", value: "recommend a game" }, { label: "Main menu", value: "menu" }]);
      }
    }
    next();
  }

  function onUserSubmit(raw, isChip) {
    var text = norm(raw);
    if (!isChip) addBubble("user", escapeHtml(raw));

    if (text === "menu" || text === "main menu") { addBubble("bot", "Sure \u2014 what do you need?"); mainMenu(); return; }

    if (isGreeting(text)) { addBubble("bot", pick(GREETING_REPLIES)); mainMenu(); return; }

    if (text === "recommend a game" || containsAny(text, RECOMMEND_TRIGGERS)) {
      addBubble("bot", "What kind of game are you in the mood for?");
      categoryChips(showRecommendations);
      return;
    }

    if (text === "game rules") {
      addBubble("bot", "Type a game name (e.g. \"Hero Inc\") or pick a category:");
      categoryChips(showCategoryRules);
      return;
    }

    if (text === "site navigation") {
      addBubble("bot", "Where would you like to go?");
      addChips(NAV.map(function (n) { return { label: n.label, value: n.label }; }));
      return;
    }

    if (text === "faq help" || text === "faq" || text === "help") {
      addBubble("bot", "What do you need help with?");
      addChips(FAQS.map(function (f) { return { label: f.label, value: f.key }; }));
      return;
    }

    if (text === "new here take a tour" || containsAny(text, ONBOARD_TRIGGERS)) {
      runOnboarding();
      return;
    }

    // exact-key chip clicks for FAQ
    var faqByKey = FAQS.filter(function (f) { return f.key === text; })[0];
    if (faqByKey) {
      var ans = faqByKey.answer;
      if (faqByKey.links) ans += "<br><br>" + faqByKey.links.map(function (l) { return linkHtml(l.label, l.url); }).join(" &nbsp;|&nbsp; ");
      addBubble("bot", ans);
      addChips([{ label: "Another topic", value: "faq help" }, { label: "Main menu", value: "menu" }]);
      return;
    }

    // exact-label chip clicks for nav
    var navByLabel = NAV.filter(function (n) { return norm(n.label) === text; })[0];
    if (navByLabel) {
      addBubble("bot", navByLabel.answer + "<br>" + linkHtml("Open " + navByLabel.label, navByLabel.url));
      addChips([{ label: "Somewhere else", value: "site navigation" }, { label: "Main menu", value: "menu" }]);
      return;
    }

    // free-text matching, in priority order — now fuzzy + scored instead of plain substring.
    // Order: specific game name > specific FAQ topic > general category > site nav.
    // FAQ is checked BEFORE category so a clear topic match (e.g. "is this safe for
    // my kid" -> Kids safety FAQ) isn't swallowed by a loose category-name hit
    // (e.g. the word "kid" also being a Kids-category keyword).
    var game = findGameByName(text);
    if (game) { showGameRules(game); return; }

    var faq = findFAQ(text);
    if (faq) {
      var a = faq.answer;
      if (faq.links) a += "<br><br>" + faq.links.map(function (l) { return linkHtml(l.label, l.url); }).join(" &nbsp;|&nbsp; ");
      addBubble("bot", a);
      addChips([{ label: "Another topic", value: "faq help" }, { label: "Main menu", value: "menu" }]);
      return;
    }

    var category = findCategory(text);
    if (category && (text.indexOf("rule") !== -1 || text.indexOf("how") !== -1 || text.indexOf("play") !== -1)) {
      showCategoryRules(category);
      return;
    }
    if (category) { showRecommendations(category); return; }

    var nav = findNav(text);
    if (nav) {
      addBubble("bot", nav.answer + "<br>" + linkHtml("Open " + nav.label, nav.url));
      addChips([{ label: "Somewhere else", value: "site navigation" }, { label: "Main menu", value: "menu" }]);
      return;
    }

    addBubble("bot", pick(FALLBACK_LINES));
    mainMenu();
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function buildUI() {
    injectCSS();

    var launcher = el("button", { id: "mgw-launcher", type: "button", "aria-label": "Open chat support" },
      '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.04 2 11c0 2.6 1.32 4.92 3.41 6.59L4.5 22l4.32-1.73C9.74 20.42 10.85 20.6 12 20.6c5.52 0 10-4.04 10-9.6S17.52 2 12 2z"/></svg>');

    panelEl = el("div", { id: "mgw-panel" });
    var head = el("div", { id: "mgw-head" },
      '<div><div class="mgw-title">Mags \u00b7 MGNIT Gaming Support</div><div class="mgw-sub">Usually replies instantly</div></div>');
    var closeBtn = el("button", { id: "mgw-close", type: "button", "aria-label": "Close chat" }, "&times;");
    head.appendChild(closeBtn);

    bodyEl = el("div", { id: "mgw-body" });

    var foot = el("div", { id: "mgw-foot" });
    var input = el("input", { id: "mgw-input", type: "text", placeholder: "Type your question..." });
    var sendBtn = el("button", { id: "mgw-send", type: "button", "aria-label": "Send" },
      '<svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>');
    foot.appendChild(input);
    foot.appendChild(sendBtn);

    panelEl.appendChild(head);
    panelEl.appendChild(bodyEl);
    panelEl.appendChild(foot);

    document.body.appendChild(launcher);
    document.body.appendChild(panelEl);

    var opened = false;
    function openPanel() {
      panelEl.classList.add("mgw-open");
      opened = true;
      if (bodyEl.children.length === 0) {
        addBubble("bot", "Hi! I'm Mags, MGNIT Gaming's support bot. I can help with site navigation, FAQs, game rules, game recommendations, or a quick new-player tour.");
        mainMenu();
      }
      input.focus();
    }
    function closePanel() { panelEl.classList.remove("mgw-open"); }

    launcher.addEventListener("click", function () { opened ? closePanel() : openPanel(); });
    closeBtn.addEventListener("click", closePanel);

    function submit() {
      var v = input.value.trim();
      if (!v) return;
      input.value = "";
      onUserSubmit(v, false);
    }
    sendBtn.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildUI);
  } else {
    buildUI();
  }
})();
