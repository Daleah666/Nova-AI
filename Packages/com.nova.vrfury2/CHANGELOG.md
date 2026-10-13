# Changelog

## 0.1.0

First version.

- **Tools > VRFury 2.0** window: drop an FBX, pick New or Update, then press **Do Everything**. Optional step-by-step buttons and a results list with Fix buttons.
- FBX import: Humanoid rig, blendshapes, Read/Write, blendshape normals, and materials and textures extracted. Bone-name presets for Blender/Cats, Mixamo, Reallusion CC4, MMD and VRoid when Unity's auto-mapping fails.
- New avatar setup: VRC Avatar Descriptor and Pipeline Manager, viewpoint from the eye bones, 15 visemes (or jaw-flap fallback), eye look and blink.
- Materials: Standard materials converted to Poiyomi, lilToon or VRChat Mobile Toon, with textures matched by name.
- Update mode: copies components, props, renderer and material settings, bone tweaks, descriptor and avatar ID from the old avatar, and points every reference at the new hierarchy. The old avatar is kept as a disabled backup.
- Preflight checks with safe auto-fixes and a performance-rank summary.
- One-click Build & Upload through the VRChat SDK builder API, with an automatic thumbnail for new avatars and ownership checks for updates.
