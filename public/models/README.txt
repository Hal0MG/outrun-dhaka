Optional landmark models. Name each file after the landmark type and the game uses it in place of the generated building:
  sangsad.glb  ahsanManzil.glb  shaheedMinar.glb  baitulMukarram.glb  curzonHall.glb  novoTheatre.glb
  smritiSoudho.glb  airport.glb  kamalapur.glb  stadium.glb  ... (any key from LANDMARK_NAMES in src/world/stages.js)
Authoring: glTF binary (.glb), units in metres, origin at the centre of the base on the ground,
front facing -Z (the direction of travel). Draco/meshopt compression is not wired in yet; keep each under ~1 MB.
