# Testing VRFury 2.0

Two kinds of testing:

1. **In Unity, by you.** This is the real test, and it's the checklist below. It takes three runs: a new avatar, an update of that test avatar, and then your real avatar.
2. **Compile check, automated.** This proves the code compiles against Unity 2022.3.22f1 and the VRChat SDK, without opening Unity. See [`tools/compile-check/README.md`](../tools/compile-check/README.md). It can't tell whether the tool *works*. Only the checklist can.

Tick things off as you go. If something doesn't match "Expect", press **Copy** in the window's Results list and save that text together with anything red in Unity's Console. That's everything needed to fix it.

---

## Before you start

- [ ] A VCC avatar project on Unity **2022.3.22f1** with the **VRChat Avatars SDK 3.7 or newer**. Note the SDK version you used: ______
- [ ] Back up the project (copy the folder, or commit it if you use git). Everything in the scene can be undone, but backups are cheap.
- [ ] VRFury 2.0 installed (see the package README), and **Tools > VRFury 2.0** opens a window.
- [ ] Optional: Poiyomi or lilToon installed, if your avatar uses them.

---

## Test 1: A brand-new avatar (uploads a new *private* avatar)

Use any FBX that isn't set up yet. Start with a new empty scene (*File > New Scene*).

| # | Do this | Expect |
|---|---|---|
| 1.1 | Drag the `.fbx` from your **desktop** (File Explorer) into the drop box. | The box shows its name. The file is copied to `Assets/VRFury Avatars/<name>/`, with its textures if they were next to it. |
| 1.2 | Leave **New avatar** selected and type a name like `VRFury Test`. **Untick** "Upload to VRChat when done" for now. Press **Do Everything**. | The avatar appears in the scene and gets selected. The Results list has sections: *Import & Rig*, *Avatar setup*, *Materials & shaders*, *Check*. It ends with **"Ready to upload"**, or with a list of problems that each have a Fix button. |
| 1.3 | Select the FBX in the Project window, then *Inspector > Rig*. | *Animation Type* is **Humanoid**. *Configure…* shows the body in green (no red bones). |
| 1.4 | Select the avatar and look at **VRC Avatar Descriptor**. | The **View** ball is between the eyes, slightly in front (check it in the Scene view). *LipSync* is *Viseme Blend Shape* with the slots filled, or a jaw fallback with a message saying so. *Eye Look* is on, with both eyes set and *Eyelids: Blendshapes* using a blink shape. |
| 1.5 | Look at the materials. | Nothing is pink. Plain "Standard" materials now use Poiyomi, lilToon or *VRChat/Mobile/Toon…*. Materials already on another shader are untouched. |
| 1.6 | Press **Do Everything** again. | No second copy of the avatar is created ("Using the avatar already in the scene from the last run"). |
| 1.7 | Press **Ctrl+Z** once. | The tool's scene changes are undone in one step. Press **Ctrl+Y** to redo them. |
| 1.8 | Click a few lines in the Results list. Press a **Fix** button if one is shown, then *Step by step > 3. Check*. | Clicking a line selects its object. Fixed problems disappear on the next Check. |
| 1.9 | Tick "Upload to VRChat when done" and press **Do Everything**. | The VRChat SDK panel opens. If you're not logged in, the Results list says it's waiting while you log in, then carries on by itself. On SDK 3.10+, a one-time "content rights" dialog may appear. A progress bar with **Cancel upload** shows during the build and upload. It ends with **"Uploaded!"** and an avatar ID (`avtr_…`). |
| 1.10 | Save the scene (*Ctrl+S*). Select the avatar and look at *Pipeline Manager*. | It shows the same `avtr_…` Blueprint ID. |
| 1.11 | In VRChat, go to *Avatars > Uploaded*, put it on, and stand in front of a mirror. | It's **Private** and has the thumbnail taken in Unity. The view is from the eyes. The mouth moves when you talk. It blinks. The eyes look around. Performance rank is what the Check summary said. |

Optional extras, if you have them:

- [ ] A **Mixamo**, **Reallusion CC4**, **MMD** or **VRoid** FBX. Expect *"Mapped the bones using the … preset"* if Unity couldn't map it alone, and correct lip sync on CC4 or MMD faces.
- [ ] Press **Cancel upload** during an upload. Expect *"Upload cancelled."* and the window usable again.

---

## Test 2: Update the test avatar from Test 1 (overwrites only the test avatar)

This tests the most important part, carrying everything over, without risking your real avatar.

**Prepare:** open the scene from Test 1. On the `VRFury Test` avatar, add a few things the way you normally would:

- [ ] a **PhysBone** on some hair or a tail, with a **PhysBone Collider** on a hand that the PhysBone uses;
- [ ] a **prop** (any object or prefab) dragged onto a hand bone;
- [ ] a different **material** on one mesh, a **blendshape** slider set on the body, and one mesh **switched off**;
- [ ] if you use them: an expression menu and parameters, a FX animator, VRCFury or Modular Avatar components;
- [ ] save the scene.

**Change the model:** in Blender (or similar), make a small change, like moving a vertex or adding a shape key. Export it as a **new file name**, for example `Avatar_v2.fbx`.

| # | Do this | Expect |
|---|---|---|
| 2.1 | Drop `Avatar_v2.fbx`, choose **Update an existing avatar**. | *Old avatar (in scene)* is filled with `VRFury Test` (or drag it in from the Hierarchy). |
| 2.2 | Untick upload, press **Do Everything**. | A new avatar is placed exactly where the old one was, with the same name. The old one is renamed **`VRFury Test (backup)`** and switched off. Results show *"Copied N components…"*, *"Kept the avatar's Blueprint ID…"* and *"Ready to upload"*. |
| 2.3 | Select the PhysBone on the **new** avatar and click its collider entry. | The collider is on the **new** avatar's hand, not the backup's. |
| 2.4 | Check the prop, material, blendshape value, hidden mesh, and the descriptor's animators and menus. | All the same as on the old avatar. |
| 2.5 | Read any warnings. | Anything that couldn't be matched is listed by name. Nothing you added is silently missing. |
| 2.6 | Compare *Pipeline Manager* on the new and backup avatars. | Same Blueprint ID. |
| 2.7 | Tick upload, press **Do Everything** (or *Step by step > 4. Build & Upload*). | Results say *"Updating your existing avatar "VRFury Test" (avtr_…)"* and end with **"Uploaded!"**. |
| 2.8 | In VRChat, *Avatars > Uploaded*. | There's still **one** `VRFury Test`, now showing your change. No duplicate was created. PhysBones, props and toggles work. |

Also try the "same file" case:

- [ ] Export again **over the same file** (`Avatar_v2.fbx`). Pick the new avatar as the old avatar, then press **Do Everything**. Expect *"Your old avatar already uses this exact FBX file, so Unity updated it in place. Nothing needs copying."* followed by the checks.

---

## Test 3: Your real avatar

Only after Tests 1 and 2 look right:

- [ ] Open the scene with your real, already-uploaded avatar.
- [ ] Run Update mode with its new FBX, with **upload unticked** first. Compare the new avatar with the backup, as in 2.3–2.6.
- [ ] Upload. The Results list should say it's updating your existing avatar (check the name and ID).
- [ ] Check it in VRChat. When you're happy, delete the `(backup)` object, or keep it until the next update.

---

## Things worth trying if they apply to you

- [ ] **Not logged in:** press Build & Upload when logged out. Expect a prompt to log in in the SDK panel, then the upload carries on.
- [ ] **Someone else's avatar ID:** if a Pipeline Manager has an ID from another account, expect *"belongs to a different VRChat account"* and an **Upload as new avatar** button.
- [ ] **Unsaved scene:** upload from a never-saved scene. Expect a reminder to press Ctrl+S so the ID is kept.
- [ ] **Missing scripts:** a "Missing (Mono Script)" component is reported by Check, with a **Remove missing scripts** button.

---

## For developers

- Compile check: `tools/compile-check/` (fetch inputs once, then run it for each SDK version you care about: 3.7.0 is the minimum, and the latest should also be checked).
- Unity `.meta` files: after adding files to the package, run `python3 tools/make_metas.py Packages/com.nova.vrfury2`. The release workflow runs it with `--check` and fails if one is missing.
- Releasing: bump `version` in `Packages/com.nova.vrfury2/package.json` and add a CHANGELOG entry. Merging to `main` runs **Build Release**, then **Build Repo Listing** updates the VCC listing.
