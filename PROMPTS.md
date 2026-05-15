# Prompts → Features

Chronological log of the kid's requests and what each turn added to the game.

The actual prompts (slightly cleaned for clarity); the code lives at the path on the right.
Snapshots of the playable game are in [versions/](versions/).

---

## v1 · Initial pet + physics

> "Lets make a cool 3d game that appeals to 7 year olds. what kind of resources are there for games built with claude code?"
>
> _(asked for combo of "pet/creature sim" + "silly physics playground")_

- Three.js + cannon-es physics via importmap, static HTML
- Squishy yellow blob with eyes / cheeks / mouth
- Tap-to-toss fruit (4 types) + blocks → blob auto-chases & eats
- Blob changes colour to whatever fruit it just ate
- Pre-built starter towers, deco trees / flowers / clouds

## v2 · Music

> "Can you make some fruit music?" → "yes" (to background loop, hum, xylophone)

- Web Audio synth: every fruit toss is a note on C-major pentatonic
- Eating plays a major arpeggio in the fruit's key
- Background music-box loop (16-step pattern, ~3.3s)
- Soft humming oscillator that follows the blob's speed
- Each block colour is a pentatonic note — towers crashing = melody

## v3 · Evolution + first battle

> "it turns into a Pokemon if you throw some fruits at it. And when it's really strong, you can choose if it can go to a battlefield where you battle against a Pokemon king. So it should evolve like a Pokemon."

- 3 evolution stages: Buddy → Sprout → Beast → Champion
- Eating thresholds: 3 / 8 / 15 fruits
- Visual layers: leaf sprout → horns + flapping wings → crown + glowing aura
- ⚔️ Battle button appears at Champion; turn-based fight against 👑 Pokeking
- HP bars, attack lunges, win / retry flow, victory & defeat fanfares

## v4 · More evolutions, powers, multi-tier squad battles, city arena

> "More evolutions and more battles, and he should be able to poop and other stuff. I want him to have powers, and he can jump and that he can evolve bigger and look different."
>
> "And there is a big battlefield like a city and you battle pokemons, like battling more than just one guy"

- 3 more stages: Mega (4) → Cosmic (5) → Ultimate (6) — added 2nd horns, golden top-spike crown, orbiting stars, 2nd wings, rainbow colour cycle, glowing pink eyes, ever-bigger body
- 6 powers, unlocked per stage: 🦘 Jump · ⚡ Dash · 💩 Poop · ⭐ Stomp · 🌈 Beam · 💖 Hug
- Boss tiers: Pokeking Crew (3 foes) → Mega Crew (4 foes) → Cosmic Crew (4 foes)
- Each foe has individual HP, the "active" foe pulses red, dead foes fade out
- Night-city arena: 30 buildings in a ring, lit yellow windows, distant towers, a moon overhead

## v5 · Real-time arena combat

> "you to make the shady a place... a battlefield where you can run around and attack people."

- Battles became real-time: blob runs freely, tap-to-move with a green pulsing target ring
- Foes have their own AI: 65% chase player / 35% wander, bigger foes are slower
- Contact damage both ways with per-foe cooldowns; mutual bounce-back on impact
- Attack buttons re-purposed as fruit projectiles (Quick / Power / Super shotgun)
- Powers became battle-useful: Stomp = AOE damage; Beam aims at nearest foe; Hug heals +50 HP
- Arena got "shady": near-black sky, dense fog, blue moonlight + 7 warm streetlamp point lights

## v6 · Pokemon cards, keyboard controls, mobile (current)

> "we have cards, and those cards are like things. And if you push a card, you turn into that thing. But on the cards are the Pokemon, and then you can turn into those Pokemons. They are around the city lying around, and you can connect to them. I also want that you can go around the city and attack, um, some characters. And how do you wanna move? Like, what about some stuff? You move with the... arrow keys. Direction keys. spacebar is attack."
>
> "while you're at it, I think you should make it where the game works on a mobile phone"
>
> "and can you keep playable versions of this game so that I can show the progress and the prompts that made it?"

- 6 Pokemon cards (🔥 Flameblob · 💧 Aquablob · ⚡ Sparkblob · 🌿 Leafblob · 🐉 Dragonling · 🌟 Cosmix)
- Cards float and rotate; walk into one → transform 22s (colour + speed + jump boost; Cosmix gets rainbow cycle)
- 6 cards scattered in playground, 5 fresh ones spawn in every battle
- Keyboard: arrows / WASD to move, **SPACE** = attack, works everywhere
- Mobile: bottom-left D-pad, bottom-right big attack button — drives the same input
- Camera follows the player when they drive movement
- `versions/` archive + git repo so every iteration from here on is preserved playably

## v7 · Keyboard fix + spread foes

> "you can't move if you... and you can also not attack. And you can also not move in the city. and the bad guys have to be spread around the city. when you clicked on the arrow keys, it didn't seem like you did it right from last time. So make it better."

- Keyboard listener now runs in capture phase — SPACE no longer re-triggers the last clicked button, arrow keys aren't eaten by focused buttons
- Every button click immediately blurs itself, releasing focus back to the document
- Foes spawn with randomized z (±6 units) and a bit of x jitter — spread across the city instead of lined up at z=0

---

## How to use this log

- Each entry is the prompt that triggered a change + the new behaviour.
- Snapshots live under `versions/vN-headline/` — open the folder, run `python3 -m http.server`, play.
- Git history is the source of truth: `git log --oneline` (from v6 onward).
