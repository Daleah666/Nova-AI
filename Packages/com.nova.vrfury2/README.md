# VRFury 2.0 – FBX to VRChat Autopilot

Drop in an FBX, press **Do Everything**, and get a VRChat avatar that's set up, checked and uploaded.

It works inside Unity, through the VRChat Creator Companion (VCC). It does the boring setup for you:

- **Rig**: switches the FBX to a Humanoid rig, keeps blendshapes, and fixes the import settings VRChat needs. If Unity can't work out the bones by itself, it tries name presets for Blender/Cats, Mixamo, Reallusion CC4, MMD and VRoid.
- **Avatar setup**: adds the VRChat Avatar Descriptor, puts the viewpoint between the eyes, matches the 15 lip-sync visemes, and sets up eye look and blinking.
- **Materials**: swaps plain Unity "Standard" materials for a toon shader. It uses Poiyomi or lilToon if you have one installed, and VRChat's built-in mobile toon shader if not. Textures are matched by name.
- **Update mode**: got a new version of an avatar you already set up? It copies everything from the old one onto the new FBX: PhysBones, colliders, contacts, constraints, VRCFury, Modular Avatar, props and accessories, material choices, blendshape values, descriptor settings, and the **avatar ID**, so the upload replaces the same VRChat avatar.
- **Checks**: looks for anything that would block or spoil the upload, and fixes the safe things for you.
- **Upload**: builds and uploads through the VRChat SDK in one click, with a thumbnail taken automatically.

Your FBX file is never changed. Only Unity's import settings for it are.

---

## Install

You need a Unity project made with the **VRChat Creator Companion** (an avatar project, Unity 2022.3, VRChat Avatars SDK 3.7 or newer).

**Option A: through VCC (recommended)**

1. Open the listing page <https://daleah666.github.io/Nova-AI/> and click **Add to VCC**.
   (Or in VCC go to *Settings > Packages > Add Repository* and paste `https://daleah666.github.io/Nova-AI/index.json`.)
2. In VCC, open your project with **Manage Project**, find **VRFury 2.0 - FBX to VRChat Autopilot** and click the **+** button.

**Option B: copy the folder**

Copy the `com.nova.vrfury2` folder into your project's `Packages` folder (next to `com.vrchat.avatars`). Unity picks it up when you switch back to it.

When it's installed you'll see **Tools > VRFury 2.0** in Unity's top menu.

---

## Use it

Open **Tools > VRFury 2.0**.

### A brand-new avatar

1. Drag your `.fbx` into the box at the top. It can come from your desktop or from Unity's Project window. Files from your desktop are copied into `Assets/VRFury Avatars/<name>/`, along with any textures sitting next to them.
2. Leave **New avatar** selected and type the name you want it to have in VRChat.
3. Leave **Upload to VRChat when done** ticked if you want it uploaded straight away.
4. Press **Do Everything**.

The avatar appears in your scene and the **Results** list tells you what was done. If you're uploading, the VRChat SDK panel opens and asks you to log in the first time. New avatars are uploaded as **Private**.

### A new version of an avatar you already set up

1. Open the scene that has your old, already set-up avatar in it.
2. Drag the new `.fbx` into the box.
3. Pick **Update an existing avatar**, then drag the old avatar from the **Hierarchy** into **Old avatar (in scene)**. If it's the only avatar in the scene, it's filled in for you.
4. Press **Do Everything**.

The new version is placed exactly where the old one was, and everything is copied across. The old avatar is renamed `… (backup)` and switched off, not deleted. Once you've checked the new one in game, you can delete the backup yourself.

If you exported straight over the old FBX file (same file name, same folder), Unity has already updated your avatar in place. The tool sees that, skips the copying, and just re-checks the setup.

### The results list

- A green tick means done, a speech bubble is information, a yellow triangle is a warning worth reading, and a red sign is a problem that must be fixed before uploading.
- Click a line to select the object it's about.
- Some lines have a **Fix** button. Press it, then run **Check** again.
- **Copy** puts the whole list on your clipboard, which is handy when asking for help.

### Step by step (optional)

Open **Step by step** to run one part at a time:

| Button | What it does |
| --- | --- |
| 1. Import & Rig | Changes the FBX's import settings only: Humanoid rig, blendshapes, Read/Write, materials and textures pulled out into folders next to the FBX. |
| 2. Set up avatar / Copy setup from old avatar | Puts the avatar in the scene and does the avatar setup and materials (New), or copies the old avatar's setup (Update). |
| 3. Check | Looks for problems and fixes the safe ones. |
| 4. Build & Upload | Uploads the avatar shown in **Avatar in scene**. |

Everything the tool does in the scene can be undone with **Ctrl+Z**. Do Everything counts as one undo step.

---

## What Update mode copies, and what it doesn't

Copied:

- Every component you added to the old avatar, on the matching bone or object: PhysBones, colliders, contacts, constraints, VRCFury, Modular Avatar, audio, particles, and so on. Links between them (a PhysBone's colliders, a constraint's target, and so on) are pointed at the new avatar's objects.
- Props and accessories you parented to bones or to the avatar, including their own components.
- Material choices per mesh, blendshape values, which meshes are on or off, and renderer settings.
- Small changes you made to bones (position, rotation, scale).
- The Avatar Descriptor (animators, expression menu and parameters, lip sync, eye look). The viewpoint and eye rotations are adjusted if the new model's eyes moved.
- The avatar ID (blueprint ID), so uploading **updates** your existing VRChat avatar instead of making a new one.

Matching is done by the object's path in the hierarchy (for example `Armature/Hips/Spine/Chest/Head`). If a bone was renamed, it falls back to the Humanoid bone, then to a unique name match.

Not copied, and always listed in the results so nothing disappears silently:

- Components on bones or objects that don't exist in the new FBX.
- Links that pointed at something that no longer exists. These are cleared and listed. If there are a lot of them, the full list is in Unity's Console window.
- Broken "missing script" components.

---

## Uploading

- The first time, the VRChat SDK panel asks you to log in. Log in there and the tool carries on.
- On newer SDKs, the first upload also asks you to confirm you have the rights to upload the content. That's a one-time VRChat dialog.
- The avatar ID is saved on the avatar in your scene. If the scene was never saved, the tool reminds you to press **Ctrl+S**, so the next upload updates the same avatar.
- Builds are for PC (Windows). Quest/Android isn't supported yet.

---

## Troubleshooting

**"Some bones couldn't be matched" / the rig is red.**
Your skeleton uses names the tool doesn't know. Select the FBX in the Project window and go to *Inspector > Rig > Configure…*. Drag the missing bones (the results list names them) into place, press *Apply*, then press **Do Everything** again.

**The mouth doesn't move / the wrong mouth shapes are used.**
Select the avatar, find *VRC Avatar Descriptor > LipSync*, and pick the shapes by hand. The tool keeps what you pick when you run it again.

**Blinking is wrong or missing.**
The same goes for *VRC Avatar Descriptor > Eye Look > Eyelids*.

**Materials are pink or look flat.**
Pink means a shader is missing. Install the shader the avatar was made for (often Poiyomi or lilToon) and run **Do Everything** again. The built-in VRChat toon shader is only a basic fallback.

**"This avatar's ID belongs to a different VRChat account" / "doesn't exist on VRChat any more".**
The avatar ID belongs to another account, or the avatar was deleted. The results line has an **Upload as new avatar** button that clears the ID so a new avatar is made instead.

**"Your account can't upload avatars yet."**
New VRChat accounts need to spend a little time in VRChat before they can upload. This is a VRChat rule.

**"Another tool blocked the build" or "The VRChat SDK found problems".**
The SDK, or another tool like VRCFury or Modular Avatar, stopped the build. Each reason is listed. Many have a fix in the SDK panel's *Builder* tab.

**Something else went wrong.**
Press **Copy** in the results list and include that text, plus anything red in Unity's *Console* window, when asking for help.

---

## Good to know

- Only "Standard"-style materials are changed. Materials already using another shader (Poiyomi, lilToon, and so on) are left alone.
- The thumbnail for new avatars is saved to `Library/VRFury2/thumbnail.png` in your project.
- Developer notes and the manual test checklist are in [`docs/testing.md`](https://github.com/Daleah666/Nova-AI/blob/main/docs/testing.md).
