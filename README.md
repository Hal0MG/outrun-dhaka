# Outrun Dhaka · আউটরান ঢাকা

An arcade racer through Dhaka, after Horizon Chase Turbo. Pick a race on a top-down map of the city: any district as a three-lap circuit, or THE RUN, a knockout race across the whole city.

## Play

- **Easiest:** open `dist/index.html` in Chrome or Edge. It is a single self-contained file (fonts load from Google Fonts when online; it falls back to system Bengali fonts offline).
- **Dev server:** `npm install`, then `npm run dev` and open http://127.0.0.1:5173

Controls: ↑/W gas · ↓/S brake · ←→ steer · SPACE/B nitro · H horn · R music on/off · V photo mode · ESC/P pause · F fullscreen. Gamepads and phone touch controls work too.

## Driving

Hold gas and steer. Corners push you to the outside, harder the faster you go, so the skill is the line you hold through them. Tap SPACE to burn one nitro charge (you can hold three); nitro in a tight bend throws you wide. Contact with other cars and running onto the verge only cost speed: nothing wrecks you. Grab coins, fuel cans (run dry and you roll to a stop) and nitro pickups on the road.

## Races

- **Circuit:** any of the fifteen districts, three laps, twenty cars, you start last. Each lap is the district's own road (its look, landmarks and time of night) laid end to end, so every lap has the same corners.
- **The Run:** twenty-four cars on one road through every district, dusk to dawn, Dhanmondi to the Padma Bridge (about five minutes). Knockout gates at Shahbag (top 20 go through), Kawran Bazar (16), Gulshan (12), Sadarghat (8), Mirpur (6) and 300 Feet (4); the last four race over the Padma.

Dhanmondi → Shahbag → Manik Mia → Kawran Bazar → Hatirjheel → Gulshan → Old Dhaka → Sadarghat → Motijheel → Mirpur → Airport Road → 300 Feet → CTG Highway → Savar → Padma Bridge

On the road: Dhaka's traffic (rickshaws, CNGs, buses, cars, police and RAB pickups, the odd jam), pedestrians and roadside stalls. They only populate the road: nothing here slows a racer, and whatever you or a rival hits is flung off the road. Traffic thins out when many racers are close together. Tuntuni, your passenger, comments from a speech bubble above the car (overtakes, nitro, bumps, fuel).

Every car drives the same; pick the body you like.

Best finishes are saved per race and shown on the map. Winning any race unlocks the Rickshaw 9000 in the garage.

## Build

- `npm run build` writes the single-file game to `dist/index.html`.
- `npm run artifact` also writes `dist/outrun-dhaka.artifact.html` (same game without the document skeleton, for hosts that supply their own).

Everything (buildings, signboards, rickshaw art, trees, cars, landmarks, music, engine sounds) is generated in code at startup; there are no asset files.

## Code map

- `src/world/` track geometry, districts and circuits (`stages.js`), chunk streaming, props, landmarks, textures, sky, road shader
- `src/game/` driving model (`player.js`), races, rivals and pickups (`race.js`), traffic, pedestrians and stalls (`traffic.js`, `peds.js`, `stalls.js`), instanced car drawing (`fleet.js`), car models, camera, particles, weather
- `src/audio/` synthesised engines and effects, the music sequencer and five tracks
- `src/ui/` HUD, menus, the Dhaka map (`dhakamap.js`), Tuntuni (`dialogue.js`)

## Credits

Car meshes: "Free Low Poly Vehicles Pack" by Rgsdev (CC0), in `src/assets/cars`. They are refitted to real dimensions, recoloured and smooth-shaded at startup.
