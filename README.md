# Outrun Dhaka · আউটরান ঢাকা

An arcade racer through Dhaka. THE RUN: twenty-four drivers race from Dhanmondi to the edge of the city in one night, and you start last. Reach the target position by the end of every stage, then win the final one.

## Play

- **Easiest:** open `dist/index.html` in Chrome or Edge. It is a single self-contained file (fonts load from Google Fonts when online; it falls back to system Bengali fonts offline).
- **Dev server:** `npm install`, then `npm run dev` and open http://127.0.0.1:5173

Controls: ↑/W gas · ↓/S brake · ←→ steer · SPACE/B nitro · SHIFT/Z rocket (helicopter fight) · H horn · R music on/off · V photo mode · ESC/P pause · F fullscreen. Gamepads and phone touch controls work too.

## Circuit (Horizon Chase-style)

CIRCUIT on the main menu: 20 cars, 3 laps of a Dhanmondi street circuit, you start last. Hold gas, steer against the corners (they push you wide, harder the faster you go), tap SPACE to fire one of up to three nitro charges. Contact and grass only cost speed; nothing wrecks you. Grab coins, fuel cans (run dry and you coast to a stop) and nitro pickups on the road. No traffic, police, pedestrians, bosses or story in this mode. Code: `src/game/circuit.js` (race, rivals, pickups) and `src/game/hctplayer.js` (driving model).

## What's on the road

- Wide lanes, local traffic (Axio/Premio/Allion, Noah, Hiace, Prado, taxis), pedestrians, street stalls you can flatten, and e-rickshaw "teslas" that cut you off.
- Enemies: police pickups, RAB SUVs and rare street racers (Supra, Skyline, Celica, Chaser, Miata). Wreck them for takedown bonuses.
- Traffic jams: a long queue ending in a police checkpoint. Divided roads have a low crossable median: switch to the oncoming side whenever you like.
- Set pieces: Metro Dash (Kawran Bazar) and Mall Crawl (Hatirjheel). Future Park is scenery beside 300 Feet.
- Bosses: a helicopter over the rioting crowd at Ganabhaban (your passenger fires rockets) and the drunk night buses (Motijheel).
- Rivals: 23 named drivers (Raja in the black Skyline is the champion). Wreck one and they drop way back. Fail a stage target and you can retry that stage.
- Sound: a modelled engine (firing pulses through an exhaust model, with a virtual gearbox and overrun crackle) running in an AudioWorklet; music mixed with sidechain ducking and a glue compressor.

## The route

One road through all fifteen districts, dusk to dawn:

Dhanmondi → Shahbag → Manik Mia → Kawran Bazar → Hatirjheel → Gulshan → Old Dhaka → Sadarghat → Motijheel → Mirpur → Airport Road → 300 Feet → CTG Highway → Savar → Padma Bridge (finish)

Each district has a target position; the target tightens from P19 to P1. FREE DRIVE has no rivals and no clock.

## Build

- `npm run build` writes the single-file game to `dist/index.html`.
- `npm run artifact` also writes `dist/outrun-dhaka.artifact.html` (same game without the document skeleton, for hosts that supply their own).

Everything (buildings, signboards, rickshaw art, trees, cars, landmarks, music, engine sounds) is generated in code at startup; there are no asset files.

## Code map

- `src/world/` track geometry, stages, chunk streaming, props, landmarks, textures, sky, road shader
- `src/game/` player physics, traffic AI, cars, camera, particles, weather, race logic
- `src/audio/` synthesised engines and effects, the music sequencer and five tracks
- `src/ui/` HUD, menus, Tuntuni's dialogue

## Credits

Car meshes: "Free Low Poly Vehicles Pack" by Rgsdev (CC0), in `src/assets/cars`. They are refitted to real dimensions, recoloured and smooth-shaded at startup.
