/*!
 * Mags — MGNIT Gaming free support widget (v5 — AI fallback + human escalation)
 * Rule-based by default. Falls back to AI (via worker.js) when no rule matches,
 * and supports a direct "talk to a human" path that emails the team instead.
 * Install: paste <script src="mgnit-mags-widget.js?v=5.0"></script> right before </body>
 * Edit: update the GAMES / CATEGORIES / FAQS / NAV arrays below to add or change content.
 *
 * v5 changes (on top of v2.3):
 *  - ADD: AI fallback. Leave AI_FALLBACK_URL empty ("") to keep this widget
 *    100% rule-based with zero extra network calls. Once worker.js is
 *    deployed, paste its URL here and any message that fails every
 *    rule-based check gets sent to the AI instead of the old generic
 *    "not sure" reply. Degrades gracefully to FALLBACK_LINES on any
 *    error/timeout/empty response — can only improve things, never break them.
 *  - ADD: "talk to a human" escalation. New trigger phrases (HUMAN_TRIGGERS)
 *    detect when a user explicitly wants a person instead of the bot. When
 *    matched, the user's message is sent to worker.js with type:"escalate",
 *    which emails the team directly — no separate ticket dashboard needed.
 *    This path is checked BEFORE the AI fallback, so explicit human requests
 *    never get an AI-generated answer first.
 *  - Carries forward all v2.3 content (43 games) and v2.1/v2.2 matching fixes
 *    unchanged.
 */
(function () {
  "use strict";

  console.log("Mags widget loaded — v5.6");

  var SITE = "https://mgnitgaming.com";

  // ---- AI fallback config (v5, carried from v4) ----
  // Leave AI_FALLBACK_URL empty ("") to keep this widget fully rule-based.
  // Once worker.js is deployed (Cloudflare Worker), paste its URL here.
  var AI_FALLBACK_URL = "https://mags-ai.draviherk.workers.dev";
  var AI_FALLBACK_TIMEOUT_MS = 8000; // give up and use FALLBACK_LINES after this long

var chatHistory = [];
  var CHAT_HISTORY_MAX_TURNS = 6; // 6 entries = 3 user+assistant pairs

  function pushHistory(role, content) {
    chatHistory.push({ role: role, content: String(content || "").slice(0, 500) });
    if (chatHistory.length > CHAT_HISTORY_MAX_TURNS) {
      chatHistory.splice(0, chatHistory.length - CHAT_HISTORY_MAX_TURNS);
    }
  }

  // v5.5: strips HTML (links, <br> tags) out of a bot answer so it can be
  // stored as plain text in history - the AI only needs the words.
  function stripHtmlForHistory(html) {
    return String(html || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ---- Human escalation config (v5, new) ----
  // Uses the SAME backend URL as AI fallback (worker.js handles both request
  // types). If AI_FALLBACK_URL is empty, escalation is also disabled and the
  // widget falls back to its normal FAQ "human" entry (email link) instead.
  var ESCALATE_TIMEOUT_MS = 8000;
  var ESCALATE_CONFIRM_MSG = "Got it \u2014 I've sent your message straight to our team. They'll follow up by reviewing it directly. In the meantime, is there anything else I can help with?";
  var ESCALATE_FAIL_MSG = "I tried to send that to our team but something went wrong on my end. You can reach them directly at info@mgnitgaming.com in the meantime.";

  /* ---------------- KNOWLEDGE BASE ---------------- */

  var GAMES = [
    /* ---- Original 18 ---- */
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
      rules: "A number-recognition mini-game — look at the number or pattern shown and tap the matching answer. Answer correctly to move to the next round." },

    /* ---- Added in v2.3 — pulled from live homepage, June 2026 ---- */

    // Featured
    { name: "Halloween Blocks", slug: "halloween-blocks", category: "puzzles",
      rules: "A Tetris-style stacking game with a Halloween theme. Falling blocks drop from the top — rotate and move them with the arrow keys or on-screen controls to complete full horizontal lines. Completed lines clear and score points; the game ends if the blocks stack up to the top." },
    { name: "Rocket Jigsaw Picture Puzzle", slug: "rocket-jigsaw-picture-puzzle", category: "board",
      rules: "A sliding picture puzzle — drag puzzle pieces into their correct spot to reassemble the full rocket-themed image. The puzzle is complete once every piece is in its right place." },
    { name: "Bio Zone", slug: "bio-zone", category: "action",
      rules: "A tower-defense game — place and merge weapon turrets along the path to stop waves of zombies before they reach your base. Merging two of the same weapon creates a stronger one. Survive every wave to clear the level." },
    { name: "Metal Match", slug: "metal-match", category: "puzzles",
      rules: "A match-3 puzzle with a chemistry/metals theme. Swap adjacent tiles to line up 3 or more matching elements in a row or column to clear them and score points. Reach the level's target score before you run out of moves." },
    { name: "Knife Target Practice", slug: "knife-target-practice", category: "arcade",
      rules: "Aim and throw knives at the spinning target using the mouse or tap. Land your knife on the target without hitting a previously thrown one. The more accurate and consistent your throws, the higher your score." },
    { name: "Battle of Tank Steel", slug: "battle-of-tank-steel-6803344d80c39", category: "action",
      rules: "Control a tank with the on-screen or arrow-key controls — move and aim independently, then fire to destroy enemy tanks while avoiding their shots. Clear each stage by defeating all enemies before your own tank is destroyed." },
    { name: "Bakery Chefs Shop", slug: "bakery-chefs-shop", category: "casual",
      rules: "A time-management cooking game — follow each customer's order, prepare the requested baked goods by clicking through the steps, and serve them before the order timer runs out. Serve correctly and quickly to earn more stars and coins." },
    { name: "Simply Breakout", slug: "simply-breakout", category: "arcade",
      rules: "A classic Breakout-style game — move the paddle with the mouse, touch, or arrow keys to bounce the ball into the brick wall above. Clear every brick on the screen without letting the ball fall past your paddle to complete the level." },
    { name: "Jump Arrow", slug: "jump-arrow", category: "hypercasual",
      rules: "A one-tap timing game — tap to launch your character along a path of arrows, matching the arrow's direction at the right moment to keep moving forward. Misjudging the timing ends the run, so the goal is to travel as far as possible." },
    { name: "Find The Missing Part", slug: "find-the-missing-part", category: "puzzles",
      rules: "Look at the image shown and identify which piece is missing from a set of options. Tap or click the correct missing piece to complete the picture and move to the next round." },
    { name: "Skibidi Toilet Moto Bike Racing", slug: "skibidi-toilet-moto-bike-racing", category: "action",
      rules: "A motorbike racing game — use the arrow keys or on-screen controls to accelerate, brake, and balance your bike across ramps and obstacle-filled tracks. Reach the finish line as fast as possible without crashing to set your best time." },
    { name: "Akochan Quest", slug: "akochan-quest", category: "adventure",
      rules: "An adventure platformer — guide Akochan through each level, jumping over obstacles and avoiding enemies while collecting items along the way. Reach the end of each stage to progress to the next." },

    // Arcade
    { name: "Space Ark Shooter", slug: "space-ark-shooter", category: "arcade",
      rules: "A classic space shooter — move your ship with the arrow keys or touch controls and fire at incoming enemy ships and asteroids. Destroy enemies for points while dodging their fire; losing all your lives ends the run." },
    { name: "Arcanoid Space Defense", slug: "arcanoid-space-defense", category: "arcade",
      rules: "A Breakout/Arkanoid-style game set in space — move your paddle to bounce the ball into rows of enemy blocks above. Clear every block without letting the ball pass your paddle to complete each level." },
    { name: "Fireball Dodge", slug: "fireball-dodge", category: "arcade",
      rules: "A reflex survival game — move your character left and right (or up and down) to dodge incoming fireballs. The longer you survive without getting hit, the higher your score." },
    { name: "Family Squid Challenge", slug: "family-squid-challenge", category: "arcade",
      rules: "A series of mini-challenge games inspired by popular survival-competition shows. Follow each round's specific instructions (timing, precision, or reaction-based) and avoid elimination to advance to the next challenge." },
    { name: "Passing master 3D", slug: "passing-master-3d", category: "arcade",
      rules: "A sports passing-accuracy game — aim and time your pass toward the target player or zone shown on screen. Land accurate passes to score points and progress through increasingly tricky levels." },
    { name: "Explosive speed", slug: "explosive-speed", category: "arcade",
      rules: "A fast-paced racing/reflex game — control your vehicle or character at high speed, reacting quickly to obstacles as they appear. Survive or finish the course as fast as possible for your best score." },
    { name: "Precise shooting", slug: "precise-shooting", category: "arcade",
      rules: "An aim-and-shoot accuracy game — line up your shot on the moving or stationary target and fire at the right moment. The more accurate your shots, the higher your score." },
    { name: "Long neck", slug: "long-neck", category: "hypercasual",
      rules: "A one-tap stretching/balance game — tap to extend your character's long neck to reach targets or avoid hazards, timing each stretch carefully. Misjudging a stretch ends the run, so the goal is the highest score before that happens." },
    { name: "Cowboy Runners Dash", slug: "cowboy-runners-dash", category: "action",
      rules: "An endless runner with a cowboy/western theme — tap, click, or use the arrow keys to run, jump, and slide past obstacles automatically appearing on the track. Collect coins along the way; hitting an obstacle ends the run." },
    { name: "Tactical Conquest", slug: "tactical-conquest", category: "action",
      rules: "A strategy/tactics game — position and command your units on the map, then plan your moves to defeat the enemy force or capture their territory. Think a few moves ahead, since the AI opponent reacts to your strategy." },
    { name: "ZigZag Animal Road", slug: "zigzag-animal-road", category: "hypercasual",
      rules: "A one-tap timing game — tap to make your animal character turn at each zigzag corner of the path. Time your taps correctly to keep moving forward without falling off the track." },

    // Puzzles
    { name: "Super Tris Tic Tac Toe", slug: "super-tris-tic-tac-toe", category: "puzzles",
      rules: "A classic Tic Tac Toe (Noughts and Crosses) game, playable solo against the computer or with a friend. Take turns placing your X or O on the 3x3 grid — the first to line up three of their own symbol in a row, column, or diagonal wins. If the grid fills up with no line completed, it's a draw." },
    { name: "Brainrot Garden. Merge Cats", slug: "brainrot-garden-merge-cats", category: "puzzles",
      rules: "A merge-puzzle game — drag two matching cat characters together on the board to merge them into a stronger, higher-value cat. Keep merging to unlock new cat types and clear space on the board, aiming for the highest-tier cat possible." },
    { name: "Kpop Puzzle Hunters", slug: "kpop-puzzle-hunters", category: "puzzles",
      rules: "A jigsaw-style picture puzzle with a K-pop theme. Drag the scattered pieces into their correct spots to reassemble the full image. Complete the picture to unlock the next puzzle." },
    { name: "Tung Tung Sahur Funny Face", slug: "tung-tung-sahur-funny-face", category: "puzzles",
      rules: "A lighthearted spot-the-difference or matching puzzle — compare the images or faces shown and click on the correct matches or differences before time runs out (if a timer is set) to clear each round." },
    { name: "Classic Checkers: Forest", slug: "classic-checkers-forest", category: "board",
      rules: "Standard Checkers (Draughts) rules on an 8x8 board with a forest theme. Move your pieces diagonally one square at a time, jumping over an opponent's piece to capture it. Reach the opposite end of the board to crown a piece as a King, which can move diagonally in any direction. Win by capturing all of your opponent's pieces or blocking every legal move they have." },
    { name: "Four in a Row", slug: "four-in-a-row", category: "board",
      rules: "The classic Connect Four game. Take turns dropping a colored disc into one of the seven columns — it falls to the lowest empty spot. The first player to line up four of their own discs in a row, column, or diagonal wins." },
    { name: "Glow Blocks", slug: "glow-blocks", category: "puzzles",
      rules: "A block-sliding or block-placement puzzle with a glowing neon visual style. Move or rotate the blocks to fit them into the target pattern or clear full lines, depending on the level's goal, before you run out of moves." },
    { name: "PinPoint", slug: "pinpoint", category: "puzzles",
      rules: "A precision-aiming puzzle — line up your shot or placement to hit the exact target point shown on screen. Each level requires careful timing or angle adjustment to land precisely where needed." },
    { name: "CANDY MATCH 3 KIT 2025", slug: "candy-match-3-kit-2025", category: "puzzles",
      rules: "A classic match-3 candy game. Swap two adjacent candies to line up 3 or more of the same type in a row or column — matching them clears the candies and scores points, with bigger matches creating special power-up candies. Hit the level's target score within the move or time limit to win." },
    { name: "Koko Loco Block Blast", slug: "koko-loco-block-blast", category: "puzzles",
      rules: "A block-blast puzzle — drag the given block shapes onto the grid to fill complete rows or columns. Completing a line clears it and scores points; the game ends when no more blocks can be placed on the board." },
    { name: "Square Sort Mania", slug: "square-sort-mania", category: "puzzles",
      rules: "A sorting puzzle — drag colored squares into the matching colored container or zone before the level's move or time limit runs out. Sort everything correctly to clear the level and unlock the next one." },
    { name: "WORDLY", slug: "wordly", category: "puzzles",
      rules: "A word-guessing puzzle in the style of Wordle. You have a limited number of attempts to guess the hidden word — after each guess, the tiles show which letters are correct and in the right spot, correct but in the wrong spot, or not in the word at all. Use those clues to find the word before you run out of guesses." },

    // Hypercasual
    { name: "Lost Things", slug: "lost-things", category: "hypercasual",
      rules: "A hidden-object game — scan the scene and tap on every item from the list shown on screen. Find everything before time runs out (if a timer is set) to clear the level." },
    { name: "Draw a skin for Mineblock with physics", slug: "draw-a-skin-for-mineblock-with-physics", category: "hypercasual",
      rules: "A drawing/physics sandbox — draw a custom skin or shape for your blocky character using the on-screen drawing tool, then watch it interact with the physics-based environment. There's no win/lose condition — it's a free creative sandbox." },
    { name: "The Mobs Farm in Mineblock!", slug: "the-mobs-farm-in-mineblock", category: "hypercasual",
      rules: "A blocky farming/management mini-game — place, feed, or manage mob characters on your farm by clicking and dragging within the grid. Complete the level's objectives (like reaching a target number of mobs or resources) to progress." },
    { name: "Wood Cutter Clicker", slug: "wood-cutter-clicker", category: "hypercasual",
      rules: "An idle clicker game — click repeatedly to chop wood and earn currency, then spend it on upgrades that increase how much wood you collect per click or automatically over time. There's no fixed end — the goal is to grow your wood total and upgrades as high as possible." },
    { name: "Geometry Dash: Ultra Mega MOD Playground!", slug: "geometry-dash-ultra-mega-mod-playground", category: "hypercasual",
      rules: "A rhythm-based platformer in the Geometry Dash style — tap or click to jump your character automatically forward through a level full of spikes and obstacles timed to the music. One hit ends the run, so the goal is to memorize the level and reach the end without crashing." },
    { name: "Color 3D Bump it Up", slug: "color-3d-bump-it-up", category: "hypercasual",
      rules: "A 3D ball-rolling game — guide your ball along the track, bumping into color-matched obstacles to grow bigger while avoiding mismatched colors that shrink you. Reach the finish line as large as possible." },
    { name: "Magic Farm : Clicker", slug: "magic-farm-clicker", category: "hypercasual",
      rules: "An idle/clicker farming game — click to plant, grow, and harvest magical crops, earning currency you can spend on upgrades to grow and harvest faster. There's no fixed ending — the goal is to build the biggest, most efficient farm." },
    { name: "Runaway The Truck", slug: "runaway-the-truck", category: "hypercasual",
      rules: "An endless driving/dodging game — steer your truck left and right to avoid oncoming traffic and obstacles on the road. The longer you survive without crashing, the higher your score." },
    { name: "Tropical Tidy", slug: "tropical-tidy", category: "hypercasual",
      rules: "A relaxing sorting/tidying game with a tropical theme — drag items into their correct spot or matching zone to tidy up the scene. Complete each scene to unlock the next one." },
    { name: "Coral Adventure", slug: "coral-adventure", category: "hypercasual",
      rules: "An underwater exploration game — guide your character through the coral reef, collecting items and avoiding hazards as you swim. Reach the end of each level to progress to the next area." },
    { name: "Infinity Roll 3D", slug: "infinity-roll-3d", category: "hypercasual",
      rules: "A 3D rolling-ball runner — your ball moves forward automatically; steer left and right to stay on the path and avoid falling off the edge or hitting obstacles. The further you go without falling, the higher your score." },
    { name: "Ghoul Fusion", slug: "ghoul-fusion", category: "hypercasual",
      rules: "A merge game with a spooky theme — drag two matching ghoul characters together to fuse them into a stronger version. Keep merging to unlock higher-tier ghouls and clear space on the board." },

    // Adventure
    { name: "Ultimate Bottle Flip Game", slug: "ultimate-bottle-flip-game", category: "adventure",
      rules: "Time your tap or click to flip the bottle through the air so it lands upright on the target surface. Landing successfully scores points and moves you to the next, often trickier, level." },
    { name: "Fantasy Brothers", slug: "fantasy-brothers", category: "adventure",
      rules: "An adventure/RPG game — control your fantasy character through each level, battling enemies and collecting items or gear along the way. Defeat the level's enemies or boss to progress to the next stage." },
    { name: "Transform Battle", slug: "transform-battle", category: "adventure",
      rules: "An action-adventure game where your character can transform between different forms, each with its own abilities. Switch forms strategically to defeat enemies and clear obstacles as you progress through each level." },
    { name: "My Happy Farm Land Simulator", slug: "my-happy-farm-land-simulator", category: "adventure",
      rules: "A farming simulation game — plant, water, and harvest crops, and manage your farm's resources by clicking and dragging through each task. There's no fixed ending — the goal is to grow and manage the most successful farm." },
    { name: "Potion Path", slug: "potion-path", category: "adventure",
      rules: "A puzzle-adventure game — guide your character along the path, collecting the right ingredients and avoiding hazards to brew the correct potion at each stage. Complete each level's potion goal to progress." },
    { name: "Bandits Bane", slug: "bandits-bane", category: "adventure",
      rules: "An action-adventure game — battle bandit enemies using the on-screen or keyboard controls as you make your way through each level. Defeat all enemies or reach the level's exit to clear the stage." },
    { name: "Hero Transform Run", slug: "hero-transform-run", category: "adventure",
      rules: "An endless runner where your hero character can transform mid-run to gain new abilities or avoid specific obstacles. Tap or click to run, jump, and transform at the right moments to travel as far as possible." },
    { name: "Modern Bus Driving Game", slug: "modern-bus-driving-game", category: "adventure",
      rules: "A bus driving simulator — use the on-screen or arrow-key controls to accelerate, brake, and steer your bus along realistic city routes, following traffic rules and picking up passengers at marked stops. Complete each route safely and on time." },
    { name: "Dystopia RPG", slug: "dystopia-rpg", category: "adventure",
      rules: "A role-playing adventure set in a dystopian world — explore the map, take on quests, battle enemies, and collect gear or items to grow stronger. Progress by completing objectives and clearing each area's challenges." },
    { name: "City Police Car Chase Game", slug: "city-police-car-chase-game", category: "adventure",
      rules: "A police driving simulator — use the on-screen or arrow-key controls to chase down suspect vehicles through city streets, matching their speed and maneuvers. Successfully catch the suspect or complete each chase scenario to clear the level." },

    // Action
    { name: "Two Player Red Hands Game", slug: "two-player-red-hands-game", category: "action",
      rules: "A two-player reflex game based on the classic 'Red Hands' slap game, played on one device. One player places their hands under the other's, then tries to slap them before the other player can pull their hands away. Take turns being the slapper and the dodger — fastest reactions win each round." },
    { name: "space io", slug: "space-io", category: "action",
      rules: "A multiplayer .io-style space game — pilot your ship around the map, collecting resources and growing stronger while avoiding or battling other players' ships. Survive and grow as large/powerful as possible; getting destroyed usually ends your run and you start over." },
    { name: "Tanks of War Halloween", slug: "tanks-of-war-halloween", category: "action",
      rules: "A tank battle game with a Halloween theme — move and aim your tank independently using the on-screen or keyboard controls, firing at enemy tanks while dodging their shots. Destroy all enemies in the level to win the stage." },
    { name: "Pusha Pusha", slug: "pusha-pusha", category: "action",
      rules: "A pushing/puzzle-action game — push blocks or objects around the level to clear a path, solve the stage's objective, or push enemies into hazards. Complete each level's goal to unlock the next one." },
    { name: "3D Tower Defense", slug: "3d-tower-defense", category: "action",
      rules: "A tower-defense strategy game — place defensive towers along the path in a 3D environment to stop waves of enemies from reaching your base. Earn currency from defeated enemies to build and upgrade more towers between waves. Survive every wave to win." },
    { name: "Fall Skibidi Toilet", slug: "fall-skibidi-toilet", category: "action",
      rules: "A 'fall guys'-style obstacle race — guide your character through a course of moving platforms and obstacles, trying not to fall off, to reach the finish line. The fastest, most careful run gets the best result." },
    { name: "Rogue Runner", slug: "rogue-runner", category: "action",
      rules: "An endless runner with roguelike elements — tap, click, or use the arrow keys to run, jump, and dodge obstacles automatically appearing ahead. Collect power-ups along the way; hitting an obstacle ends the run, so the goal is the longest distance or highest score." },
    { name: "Noob vs Pro But Knife Hit Minecraft", slug: "noob-vs-pro-but-knife-hit-minecraft", category: "action",
      rules: "A knife-throwing accuracy game with a Minecraft-style theme — tap or click at the right moment to throw your knife into the spinning wooden target without hitting a knife you've already thrown. Land enough knives to clear the level." },
    { name: "Stick Warrior", slug: "stick-warrior", category: "action",
      rules: "A stick-figure combat game — use the on-screen or keyboard controls to attack, block, and dodge as you battle enemy stick warriors. Defeat all enemies in the level to progress to the next stage." },

    // Kids
    { name: "Choose Puzzle", slug: "choose-puzzle", category: "kids",
      rules: "A simple jigsaw puzzle picker for younger players — choose an image, then drag the puzzle pieces into their correct spots to complete the picture. There's no time pressure, so kids can go at their own pace." },
    { name: "Funny Animal Faces", slug: "funny-animal-faces", category: "kids",
      rules: "A fun mix-and-match game — combine different animal face parts (eyes, ears, noses) by clicking through the options to create silly animal combinations. There's no win/lose condition — it's a creative, free-play activity." },
    { name: "Black Panther Mask Coloring Pages", slug: "black-panther-mask-coloring-pages", category: "kids",
      rules: "A digital coloring book page — pick a color from the palette and click or tap on sections of the mask outline to fill them in. There's no time limit or scoring — it's a free creative coloring activity." },
    { name: "Santa Girl Running", slug: "santa-girl-running-6803344e10994", category: "kids",
      rules: "An endless runner with a festive theme — tap, click, or use the arrow keys to run, jump, and dodge obstacles automatically appearing on the track. Collect items along the way; hitting an obstacle ends the run, so the goal is to run as far as possible." },
    { name: "Resize Mahjong", slug: "resize-mahjong", category: "kids",
      rules: "A Mahjong tile-matching game — click two identical, unblocked tiles to remove them from the board. Clear all the tiles from the layout to win the level." },
    { name: "Pets Puzzle", slug: "pets-puzzle", category: "kids",
      rules: "A pet-themed jigsaw puzzle — drag the scattered pieces into their correct spot to reassemble the full picture of the pet. Complete the picture to unlock the next one." },
    { name: "Cute Jelly Rush", slug: "cute-jelly-rush", category: "kids",
      rules: "A match-3 style puzzle with cute jelly characters — swap adjacent jellies to line up 3 or more of the same type to clear them and score points. Reach the level's target score before running out of moves." },
    { name: "Find Seven Differences", slug: "find-seven-differences", category: "kids",
      rules: "A classic spot-the-difference game — two similar images are shown side by side. Click each of the seven spots where they differ to clear the level and move to the next picture." },
    { name: "Chubsee", slug: "chubsee", category: "kids",
      rules: "A simple character-based mini-game for younger players — guide the Chubsee character through the level, collecting items and avoiding obstacles using easy click or tap controls. Reach the end of the level to clear it." },
    { name: "15 Puzzle - Collect a picture", slug: "15-puzzle-collect-a-picture", category: "kids",
      rules: "The classic 15-puzzle sliding game — slide numbered or pictured tiles into the single empty space, one at a time, to reassemble the full picture or correct number order. There's no time pressure — take as many moves as you need." }
  ];

  var CATEGORIES = [
    { key: "arcade", label: "Arcade", keywords: ["arcade", "arcad", "arkade"],
      rules: "Arcade games are quick, skill-based games played with mouse, touch, or arrow keys. The goal is usually to score as many points as possible or survive as long as you can.",
      picks: ["neon-pong", "all-golf", "knife-target-practice"] },
    { key: "puzzles", label: "Puzzles", keywords: ["puzzle", "puzzles", "match-3", "match 3", "match3", "puzzel", "puzzal", "brain game", "brain teaser"],
      rules: "Puzzle games are about logic and pattern-solving. You'll match, sort, slide, or rearrange pieces to meet each level's goal within a limited number of moves or amount of time.",
      picks: ["super-tris-tic-tac-toe", "candy-match-3-kit-2025", "wordly"] },
    { key: "hypercasual", label: "Hypercasual", keywords: ["hypercasual", "hyper casual", "hyper-casual", "hyper", "one tap", "one-tap"],
      rules: "Hypercasual games use one-tap or one-swipe controls. The goal is usually to survive, travel as far as possible, or repeat an action correctly to set a new high score.",
      picks: ["bounceshift", "jump-arrow", "infinity-roll-3d"] },
    { key: "adventure", label: "Adventure", keywords: ["adventure", "adventur", "story game", "rpg"],
      rules: "Adventure games let you control a character through levels or a story — fighting enemies, solving challenges, and collecting items. Progress by completing each level's objective.",
      picks: ["hero-inc", "dystopia-rpg", "city-police-car-chase-game"] },
    { key: "action", label: "Action", keywords: ["action", "fighting", "combat", "shooter", "racing", "race game"],
      rules: "Action games are fast-paced — combat, racing, or quick-reflex challenges. The goal is usually to defeat opponents, finish a course, or survive a level while avoiding damage.",
      picks: ["crowd-runners-3d", "bio-zone", "3d-tower-defense"] },
    { key: "kids", label: "Kids", keywords: ["kid", "kids", "child", "children", "for kids", "kid friendly", "kid-friendly", "toddler"],
      rules: "Kids games use very simple, friendly controls — tap, click, or drag. They focus on matching, coloring, counting, or simple obstacle courses, with no violence.",
      picks: ["diamont", "find-seven-differences", "black-panther-mask-coloring-pages"] },
    { key: "casual", label: "Casual", keywords: ["casual", "relaxing", "relaxed", "chill game", "easy game"],
      rules: "Casual games are easy to pick up — swap, tap, or run to match items or clear obstacles. Built for short, relaxed play sessions, no prior gaming experience needed.",
      picks: ["juicy-run", "bakery-chefs-shop"] },
    { key: "board", label: "Board", keywords: ["board", "card game", "cards", "solitaire", "boardgame", "checkers", "chess", "connect four", "connect 4"],
      rules: "Board games follow the same rules as their classic tabletop versions, like checkers, solitaire, or Connect Four, just played digitally with click or tap controls.",
      picks: ["algerian-solitaire", "classic-checkers-forest", "four-in-a-row"] }
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

  // v5: explicit "I want a human, not a bot" intent. Checked BEFORE the AI
  // fallback so an explicit request for a person never gets answered by AI
  // first. Deliberately narrower/more direct than the FAQ "human" keywords
  // above (which include softer phrasing like "customer service") — these
  // are the phrases that mean "stop trying to answer, escalate this now".
  var HUMAN_TRIGGERS = ["talk to a human", "talk to a real person", "speak to a human", "speak to a person", "speak to someone", "i want a human", "i want to talk to someone", "connect me with a human", "real person please", "human please", "can i talk to someone", "can i speak to someone", "get me a human", "is there a real person"];

 var PROBLEM_KEYWORDS = ["not working", "isnt working", "isn't working",
    "doesnt work", "doesn't work", "wont play", "won't play", "wont open",
    "won't open", "not opening", "failing", "fails", "failed", "stuck",
    "black screen", "white screen", "blank screen", "blank square",
    "lag", "lagging", "laggy", "freeze", "freezing", "frozen", "slow",
    "buffering", "crash", "crashing", "crashed", "glitch", "glitchy",
    "broken", "won't start", "wont start", "not starting", "doesn't load",
    "doesnt load", "won't load", "wont load", "not loading", "keeps",
    "error", "bug", "problem", "issue", "help me with", "what do i do"];

  function hasProblemKeyword(text) {
    return containsAny(text, PROBLEM_KEYWORDS);
  }

  var GREETING_WORDS = { "hi": 1, "hello": 1, "hey": 1, "yo": 1, "hiya": 1, "heya": 1, "sup": 1, "howdy": 1, "salam": 1, "assalam": 1, "assalamualaikum": 1, "hola": 1 };
  var GREETING_REPLIES = [
    "Hey there! \u{1F44B} I'm Mags. What can I help you with?",
    "Hi! Good to see you \u2014 what do you need?",
    "Hello! How can I help today?"
  ];

  function isGreeting(text) {
    var words = tokenize(text);
    if (words.length === 0 || words.length > 3) return false;
    var greetingKeys = Object.keys(GREETING_WORDS);
    for (var i = 0; i < words.length; i++) {
      if (words[i] === "there" || words[i] === "guys" || words[i] === "team") continue;
      if (GREETING_WORDS[words[i]]) continue;
      var fuzzyHit = false;
      for (var j = 0; j < greetingKeys.length; j++) {
        if (fuzzyWordMatch(words[i], greetingKeys[j])) { fuzzyHit = true; break; }
        if (words[i].length <= 5 && greetingKeys[j].length <= 5 && levenshtein(words[i], greetingKeys[j]) <= 1) { fuzzyHit = true; break; }
      }
      if (!fuzzyHit) return false;
    }
    return true;
  }

  var FALLBACK_LINES = [
    "Hmm, I'm not totally sure on that one \u2014 but here's what I can help with:",
    "I don't have an exact answer for that yet, but maybe one of these helps:",
    "Not quite catching that \u2014 try rephrasing, or pick something below:"
  ];
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------------- FUZZY / TOKEN MATCHING ---------------- */

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

  function fuzzyWordMatch(w1, w2) {
    if (w1 === w2) return true;
    if (w1.length < 5 || w2.length < 5) return false;
    if (w1.charAt(0) !== w2.charAt(0)) return false;
    var maxLen = Math.max(w1.length, w2.length);
    var allowed = maxLen <= 8 ? 1 : (maxLen <= 12 ? 2 : 3);
    return levenshtein(w1, w2) <= allowed;
  }

  function tokenize(text) {
    return (text || "").toLowerCase().match(/[a-z0-9']+/g) || [];
  }

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

  function wholeWordBoundaryMatch(fullText, normPhrase) {
    var escaped = normPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var re = new RegExp("\\b" + escaped + "\\b");
    return re.test(fullText);
  }

  function scorePhrase(textTokens, fullText, phrase) {
    var score = 0;
    var normPhrase = norm(phrase);
    if (wholeWordBoundaryMatch(fullText, normPhrase)) score += 2;

    var phraseTokens = meaningfulTokens(tokenize(normPhrase));
    if (phraseTokens.length === 0) return score;

    var hits = 0;
    for (var i = 0; i < phraseTokens.length; i++) {
      for (var j = 0; j < textTokens.length; j++) {
        if (fuzzyWordMatch(phraseTokens[i], textTokens[j])) { hits++; break; }
      }
    }
    var neededHits = phraseTokens.length === 1 ? 1 : Math.floor(phraseTokens.length / 2) + 1;
    if (hits >= neededHits) score += hits;
    return score;
  }

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
    var sorted = GAMES.slice().sort(function (a, b) { return b.name.length - a.name.length; });
    for (var i = 0; i < sorted.length; i++) {
      if (text.indexOf(norm(sorted[i].name)) !== -1) return sorted[i];
    }
    var textNoSpace = text.replace(/\s+/g, "");
    for (i = 0; i < sorted.length; i++) {
      var nameNoSpace = norm(sorted[i].name).replace(/\s+/g, "");
      if (textNoSpace.indexOf(nameNoSpace) !== -1) return sorted[i];
    }
    var textTokens = tokenize(text);
    var best = null, bestScore = 0;
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
    "#mgw-panel #mgw-input{flex:1;border:1px solid #DADEE2;border-radius:999px;padding:10px 14px;font-size:13.5px;outline:none;background:#fff !important;color:#1a1a1a !important;caret-color:#1a1a1a !important;box-sizing:border-box;-webkit-text-fill-color:#1a1a1a !important}" +
    "#mgw-panel #mgw-input::placeholder{color:#8a8f94 !important}" +
    "#mgw-panel #mgw-input:focus{border-color:#1DBF73}" +
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
      // v5.5: every bot bubble - FAQ answers, game rules, category rules,
      // nav answers, greetings, "did you mean" prompts, the welcome
      // message - gets saved to history right here. This is what closes
      // the gap: rule-based answers used to be invisible to memory.
      pushHistory("assistant", stripHtmlForHistory(html));
      return addBotBubbleWithTyping(html);
    }
    var row = el("div", { class: "mgw-row " + role });
    var bubble = el("div", { class: "mgw-bubble " + role }, html);
    row.appendChild(bubble);
    bodyEl.appendChild(row);
    scrollToBottom();
    return bubble;
  }

  var TYPING_DELAY_MS = 1000;
  var CHIP_DELAY_MS = TYPING_DELAY_MS + 450;
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

  // v4/v5: same look as addBotBubbleWithTyping, but doesn't auto-fill after a
  // fixed delay — the caller (askAI / escalateToHuman) fills it in whenever
  // the network call actually finishes.
  function addPendingTypingBubble() {
    var row = el("div", { class: "mgw-row bot" });
    var bubble = el("div", { class: "mgw-bubble bot mgw-typing" }, "<span></span><span></span><span></span>");
    row.appendChild(bubble);
    bodyEl.appendChild(row);
    scrollToBottom();
    return bubble;
  }
  function resolveTypingBubble(bubble, html) {
    bubble.classList.remove("mgw-typing");
    bubble.innerHTML = html;
    scrollToBottom();
  }

  // v4: last-resort AI fallback. Only ever called when every rule-based check
  // has already failed to match. Always degrades to the normal FALLBACK_LINES
  // on any error, timeout, or empty response.
  function askAI(userText) {
    var bubble = addPendingTypingBubble();
    var done = false;
    var timeoutId = setTimeout(function () {
      if (done) return;
      done = true;
      resolveTypingBubble(bubble, pick(FALLBACK_LINES));
      mainMenu();
    }, AI_FALLBACK_TIMEOUT_MS);
 
    fetch(AI_FALLBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText, type: "ai", history: chatHistory })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (done) return;
        done = true;
        clearTimeout(timeoutId);
        var reply = data && data.reply ? String(data.reply).trim() : "";
        if (reply) {
          resolveTypingBubble(bubble, escapeHtml(reply).replace(/\n/g, "<br>"));
          // v5.5: the user's side of this turn is already saved by
          // onUserSubmit when it was typed - only the AI's reply needs
          // adding here (askAI doesn't use addBubble for its own replies).
          // Still only on success - a failed answer shouldn't pollute
          // context for the next call.
          pushHistory("assistant", reply);
        } else {
          resolveTypingBubble(bubble, pick(FALLBACK_LINES));
        }
        mainMenu();
      })
      .catch(function () {
        if (done) return;
        done = true;
        clearTimeout(timeoutId);
        resolveTypingBubble(bubble, pick(FALLBACK_LINES));
        mainMenu();
      });
  }

  // v5: human escalation. Sends the user's message to the SAME backend with
  // type:"escalate" instead of "ai" — worker.js routes that to an email
  // instead of the AI model. Always shows a friendly confirmation regardless
  // of whether the email actually succeeded server-side (the user shouldn't
  // see backend plumbing failures); on a network-level failure (can't even
  // reach the backend, or it's not configured), shows ESCALATE_FAIL_MSG with
  // the direct email address instead, so the user always has a path forward.
  function escalateToHuman(userText) {
    var bubble = addPendingTypingBubble();
    var done = false;
    var timeoutId = setTimeout(function () {
      if (done) return;
      done = true;
      resolveTypingBubble(bubble, ESCALATE_FAIL_MSG);
      mainMenu();
    }, ESCALATE_TIMEOUT_MS);

    fetch(AI_FALLBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText, type: "escalate", page: window.location.href })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (done) return;
        done = true;
        clearTimeout(timeoutId);
        if (data && data.ok) {
          resolveTypingBubble(bubble, ESCALATE_CONFIRM_MSG);
        } else {
          resolveTypingBubble(bubble, ESCALATE_FAIL_MSG);
        }
        mainMenu();
      })
      .catch(function () {
        if (done) return;
        done = true;
        clearTimeout(timeoutId);
        resolveTypingBubble(bubble, ESCALATE_FAIL_MSG);
        mainMenu();
      });
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
    }, CHIP_DELAY_MS);
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
    }, CHIP_DELAY_MS);
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
    if (!isChip) {
      addBubble("user", escapeHtml(raw));
      // v5.5: record EVERY typed message, not just the ones that end up
      // answered by the AI. Combined with the addBubble change below, any
      // typed follow-up now has the full conversation to work with.
      pushHistory("user", raw);
    }

    if (text === "menu" || text === "main menu") { addBubble("bot", "Sure \u2014 what do you need?"); mainMenu(); return; }
 if (text === "none of these games") {
      // v5.5: this branch only fires from a chip click, so it never went
      // through the "record what was typed" step - add it here so history
      // doesn't skip straight from the "did you mean" question to an AI
      // reply with no user turn in between.
      pushHistory("user", raw);
      addBubble("bot", "No worries, let me take another look at that for you.");
      if (AI_FALLBACK_URL) { askAI(raw); return; }
      addBubble("bot", pick(FALLBACK_LINES));
      mainMenu();
      return;
    }
    if (isGreeting(text)) { addBubble("bot", pick(GREETING_REPLIES)); mainMenu(); return; }

    // v5: explicit human-escalation intent is checked early, before AI and
    // before the FAQ "human" entry — these are stronger/more direct phrases
    // than the softer FAQ keywords, and they should always trigger the real
    // escalation action (email) rather than just showing the support email
    // as text. Only fires if a backend URL is actually configured; otherwise
    // falls through to the normal FAQ "human" entry further down, which just
    // shows the email address as text.
    if (AI_FALLBACK_URL && containsAny(text, HUMAN_TRIGGERS)) {
      escalateToHuman(raw);
      return;
    }

if (AI_FALLBACK_URL && hasProblemKeyword(text)) {
      var problemGame = findGameByName(text);
      if (problemGame) {
        askAI(raw + " (regarding the game: " + problemGame.name + ")");
        return;
      }
    }

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

    var faqByKey = FAQS.filter(function (f) { return f.key === text; })[0];
    if (faqByKey) {
      var ans = faqByKey.answer;
      if (faqByKey.links) ans += "<br><br>" + faqByKey.links.map(function (l) { return linkHtml(l.label, l.url); }).join(" &nbsp;|&nbsp; ");
      addBubble("bot", ans);
      addChips([{ label: "Another topic", value: "faq help" }, { label: "Main menu", value: "menu" }]);
      return;
    }

    var navByLabel = NAV.filter(function (n) { return norm(n.label) === text; })[0];
    if (navByLabel) {
      addBubble("bot", navByLabel.answer + "<br>" + linkHtml("Open " + navByLabel.label, navByLabel.url));
      addChips([{ label: "Somewhere else", value: "site navigation" }, { label: "Main menu", value: "menu" }]);
      return;
    }

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
    if (category) {
      // v5.1: before giving a generic category-level answer, check if the
      // text looks like it's trying to name a SPECIFIC game that didn't
      // match cleanly (e.g. "Candy Match Game Rules" for
      // "CANDY MATCH 3 KIT 2025"). If 1-3 games look like plausible
      // matches, offer them as "did you mean" options instead of guessing
      // or giving a generic answer. If nothing close, fall through to AI.
      var textTokensForGuess = meaningfulTokens(tokenize(text));
      var candidates = [];
      if (textTokensForGuess.length >= 2) {
        for (var gi = 0; gi < GAMES.length; gi++) {
          var thisGameTokens = meaningfulTokens(tokenize(GAMES[gi].name));
          var hits = 0;
          for (var ti = 0; ti < textTokensForGuess.length; ti++) {
            for (var gj = 0; gj < thisGameTokens.length; gj++) {
              if (fuzzyWordMatch(textTokensForGuess[ti], thisGameTokens[gj])) { hits++; break; }
            }
          }
          if (hits >= 2) candidates.push({ game: GAMES[gi], hits: hits });
        }
        candidates.sort(function (a, b) { return b.hits - a.hits; });
      }
 
      if (candidates.length > 0) {
        // Found 1-3 plausible specific games - ask the user to confirm
        // instead of guessing or giving a generic category answer.
        var topCandidates = candidates.slice(0, 3);
        addBubble("bot", "Did you mean one of these games?");
        addChips(topCandidates.map(function (c) {
          return { label: c.game.name, value: c.game.name };
        }).concat([{ label: "None of these", value: "none of these games" }]));
        return;
      }
 
      // No specific-game candidates found - this really is a generic
      // category-level question, answer as before.
      if (text.indexOf("rule") !== -1 || text.indexOf("how") !== -1 || text.indexOf("play") !== -1) {
        showCategoryRules(category);
        return;
      }
      showRecommendations(category);
      return;
    }

    var nav = findNav(text);
    if (nav) {
      addBubble("bot", nav.answer + "<br>" + linkHtml("Open " + nav.label, nav.url));
      addChips([{ label: "Somewhere else", value: "site navigation" }, { label: "Main menu", value: "menu" }]);
      return;
    }

    // v5: every rule-based check above (human-escalation, games, categories,
    // FAQ, nav) has failed to match. If AI fallback is configured, try that
    // before giving up — pass the user's ORIGINAL text (not the lowercased/
    // trimmed `text`) so the AI sees natural phrasing and punctuation.
    if (AI_FALLBACK_URL) {
      askAI(raw);
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
    input.style.setProperty("color", "#1a1a1a", "important");
    input.style.setProperty("background-color", "#ffffff", "important");
    input.style.setProperty("-webkit-text-fill-color", "#1a1a1a", "important");
    input.style.setProperty("caret-color", "#1a1a1a", "important");
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
