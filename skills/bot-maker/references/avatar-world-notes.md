# Avatar and world notes

For a **3D world and avatar maker**. Chat text lies if the body cannot be built. Fill `physical.avatar_notes` and export `characters/<slug>/avatar-notes.md` as a work ticket the maker can follow without reading the whole psyche.

This file is a checklist, not a second character.

## Silhouette (read at 20 paces)

Write one sentence that would still be true as a black cutout: coat flare, hat brim, tail, shoulder-to-hip ratio, a prop that breaks the outline (lantern, case, umbrella).

If two characters in a roster share a silhouette, change **one** large shape (hair mass, outerwear, height).

## Palette

3–6 colors, named **and** hex if you have them.

- Cloth (largest area)
- Hair
- Skin
- Accent (small, repeatable: lining, thread, jewelry)
- Metal / leather / second cloth

Keep accent rare so the eye has a target. Noir: two neutrals + one cold accent. Fantasy: still cap at six.

Chat descriptions must use the same palette words (`oxblood`, `lamp-brass`, not a random “crimson” later).

## Props

Only what must exist in the scene graph:

- Held (lantern, notebook, cigarette case)
- Worn always (spectacles, ring)
- Set dressing that is *theirs* (drafting table, kettle, pigeonholes)

Each prop: scale, attach point (hand_r, hip, world), whether it leaves their person.

Do not list “a mysterious artifact of great power.” That is lore. List “brass lantern, 28cm, left hand or hook on belt.”

## Animation mood

One **idle**, one **walk**, one **talk** adjective cluster:

| Channel | Examples |
| --- | --- |
| Idle | weight on one hip; thumb on a cuff; looks to windows |
| Walk | short steps, coat delay, does not swing the lantern |
| Talk | still-hands vs talking-hands (from trait library); blink rate; look-away |

Micro-expressions from YAML become **face shapekeys**: jaw tick, one-sided smile, ear flush (skin shader), delayed blink.

Gait from YAML is the walk cycle note. Posture is the idle skeleton offset (slouch, parade, perched).

## Environment set dressing

The default set should match `social.environment.home` or the first-message location.

Minimum ticket:

- Time of day and key light (practical lamp vs moon vs neon)
- Weather if climate matters (wet street, condensation)
- 5 objects that belong to them
- 1 object that does **not** belong (story hook)
- Scale of furniture vs `rig.humanoid_scale`
- Audio bed (optional): kettle, rain, clock — matches `physical.sound` and sensory_focus

World-fit paragraph: era (roughly), indoor/outdoor default, whether they look like a guest in the user’s world or a native. If the user’s 3D world is already defined, **fit the character to that world**; do not invent a new city unless asked.

## Rig hints

Assume a humanoid unless species says otherwise.

| Key | What to write |
| --- | --- |
| `humanoid_scale` | Height in meters and a comparison (“1.72m; eye line below a 2m door”). |
| `hair_sim` | none / short-stiff / long-cloth / extra bones. Long hair needs collision with coat collar. |
| `cloth_sim` | Coat, skirt, scarf — which meshes need dynamics; which are skinned only. Heavy wet coats should *look* heavy even if sim is light. |
| `extra_bones` | Tail, ears, lantern chain, glasses. |
| `mesh_notes` | Marks/tattoos as texture not geo unless raised. |
| `physics_mood` | “damped, not bouncy” vs “light fabric.” Matches character (exacting people often have damped cloth). |

Species extras: ears, horns, nonhuman legs — still give a humanoid_scale so they fit chairs.

## Export checklist (copy into avatar-notes.md)

- [ ] Silhouette sentence
- [ ] Palette (3–6) with roles
- [ ] Face / hair / eyes / skin / build / height (from YAML, not rewritten into poetry)
- [ ] Default wardrobe as layered list (under / mid / outer / shoes / wearable prop)
- [ ] Situational outfits the 3D world will actually load
- [ ] Props with attach points
- [ ] Idle / walk / talk mood
- [ ] Micro-expression list
- [ ] Rig: scale, hair, cloth, extras
- [ ] Default environment set + lighting
- [ ] World-fit vs the user’s existing 3D space
- [ ] What **not** to model (matches `never_describe` and boundaries)

## Chat vs mesh

If the user is Avatar-first: lock silhouette, palette, wardrobe, rig **before** deep psychology. Psychology must not demand a second body later (suddenly 2m tall, suddenly a tail). If psychology needs a new mark (a burn, a ring), add it to mesh_notes on purpose and tell the user the avatar ticket changed.
