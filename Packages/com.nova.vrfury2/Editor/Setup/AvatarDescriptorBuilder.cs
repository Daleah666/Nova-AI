using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using VRC.Core;
using VRC.SDK3.Avatars.Components;
using VRC.SDKBase;
using EyeRotations = VRC.SDK3.Avatars.Components.VRCAvatarDescriptor.CustomEyeLookSettings.EyeRotations;
using EyeMovements = VRC.SDK3.Avatars.Components.VRCAvatarDescriptor.CustomEyeLookSettings.EyeMovements;

namespace Nova.VRFury2
{
    /// <summary>
    /// Adds and fills in the VRChat Avatar Descriptor: viewpoint, lip sync (visemes), eye look and blink.
    /// On an avatar that already has a descriptor, only missing or broken parts are filled in.
    /// </summary>
    public static class AvatarDescriptorBuilder
    {
        public const string NoBlendShape = "-none-";
        static readonly Vector3 SdkDefaultViewPosition = new Vector3(0f, 1.6f, 0.2f);

        const float EyeUpDownDegrees = 12f;
        const float EyeLeftRightDegrees = 15f;
        const float JawOpenDegrees = 12f;

        public static VRCAvatarDescriptor Configure(GameObject root, AutopilotLog log)
        {
            var animator = root.GetComponent<Animator>();
            if (animator == null || !animator.isHuman)
            {
                log.Error("The avatar has no Humanoid Animator, so it can't be set up. Fix the rig first (Import & Rig).", root);
                return null;
            }

            var descriptor = root.GetComponent<VRCAvatarDescriptor>();
            bool fillMissingOnly = descriptor != null;
            if (descriptor == null)
            {
                descriptor = Undo.AddComponent<VRCAvatarDescriptor>(root);
                log.Success("Added a VRC Avatar Descriptor.", descriptor);
            }
            if (root.GetComponent<PipelineManager>() == null)
                Undo.AddComponent<PipelineManager>(root);

            Undo.RecordObject(descriptor, "VRFury 2.0 avatar setup");

            if (!fillMissingOnly || ViewPositionLooksUnset(descriptor))
                SetViewPosition(descriptor, animator, log);

            SetupLipSync(descriptor, animator, log, fillMissingOnly);
            SetupEyes(descriptor, animator, log, fillMissingOnly);

            EditorUtility.SetDirty(descriptor);
            PrefabUtility.RecordPrefabInstancePropertyModifications(descriptor);
            return descriptor;
        }

        static bool ViewPositionLooksUnset(VRCAvatarDescriptor d) =>
            d.ViewPosition == Vector3.zero || (d.ViewPosition - SdkDefaultViewPosition).sqrMagnitude < 1e-6f;

        // ---------- Viewpoint ----------

        public static Vector3? ComputeViewPosition(Animator animator)
        {
            var root = animator.transform;
            var left = FindEye(animator, true);
            var right = FindEye(animator, false);
            Vector3 world;
            if (left != null && right != null)
            {
                var mid = (left.position + right.position) * 0.5f;
                var eyeDistance = Vector3.Distance(left.position, right.position);
                world = mid + root.forward * Mathf.Max(eyeDistance * 0.3f, 0.005f);
            }
            else
            {
                var head = animator.GetBoneTransform(HumanBodyBones.Head);
                if (head == null) return null;
                // Rough adult proportions: eyes sit ~8 cm above and in front of the head bone on a 1.42 m-tall head bone.
                var scale = Mathf.Max(0.05f, Vector3.Dot(head.position - root.position, root.up) / 1.42f);
                world = head.position + root.up * (0.08f * scale) + root.forward * (0.08f * scale);
            }
            return Quaternion.Inverse(root.rotation) * (world - root.position);
        }

        static void SetViewPosition(VRCAvatarDescriptor descriptor, Animator animator, AutopilotLog log)
        {
            var view = ComputeViewPosition(animator);
            if (view == null)
            {
                log.Warning("Couldn't find the eyes or head, so the viewpoint was left at the SDK default. Move it in the Avatar Descriptor.", descriptor);
                return;
            }
            descriptor.ViewPosition = view.Value;
            bool fromEyes = FindEye(animator, true) != null && FindEye(animator, false) != null;
            log.Success(fromEyes
                ? "Placed the viewpoint between the eyes."
                : "Placed the viewpoint from the head bone (no eye bones found). Check it in the Avatar Descriptor.", descriptor);
        }

        public static Transform FindEye(Animator animator, bool left)
        {
            var bone = left ? HumanBodyBones.LeftEye : HumanBodyBones.RightEye;
            var eye = animator.GetBoneTransform(bone);
            if (eye != null) return eye;
            return HumanoidBoneMapper.FindByName(animator.GetBoneTransform(HumanBodyBones.Head), bone);
        }

        // ---------- Lip sync ----------

        static List<string> BlendShapeNames(SkinnedMeshRenderer smr)
        {
            var mesh = smr != null ? smr.sharedMesh : null;
            if (mesh == null) return new List<string>();
            return Enumerable.Range(0, mesh.blendShapeCount).Select(mesh.GetBlendShapeName).ToList();
        }

        /// <summary>Viseme names for this mesh (missing = <see cref="NoBlendShape"/>) and how many were matched directly.</summary>
        public static string[] MatchVisemes(SkinnedMeshRenderer smr, out int directMatches)
        {
            var names = BlendShapeNames(smr);
            var result = new string[FaceNames.VisemeIds.Length];
            directMatches = 0;
            for (int i = 0; i < result.Length; i++)
            {
                var idx = FaceNames.Find(names, FaceNames.VisemeCandidates[i]);
                if (idx < 0) continue;
                result[i] = names[idx];
                directMatches++;
            }
            for (int i = 0; i < result.Length; i++)
            {
                var from = FaceNames.ConsonantFallback[i];
                if (result[i] == null && from >= 0 && result[from] != null) result[i] = result[from];
            }
            for (int i = 0; i < result.Length; i++)
                result[i] ??= NoBlendShape;
            return result;
        }

        public static SkinnedMeshRenderer FindFaceMesh(GameObject root)
        {
            SkinnedMeshRenderer best = null;
            int bestScore = 0;
            foreach (var smr in root.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                if (smr.sharedMesh == null || smr.sharedMesh.blendShapeCount == 0) continue;
                MatchVisemes(smr, out var matches);
                var score = matches * 1000 + smr.sharedMesh.blendShapeCount;
                if (score > bestScore)
                {
                    best = smr;
                    bestScore = score;
                }
            }
            return best;
        }

        static void SetupLipSync(VRCAvatarDescriptor d, Animator animator, AutopilotLog log, bool fillMissingOnly)
        {
            var style = d.lipSync;
            if (fillMissingOnly)
            {
                switch (style)
                {
                    case VRC_AvatarDescriptor.LipSyncStyle.VisemeBlendShape when d.VisemeSkinnedMesh != null:
                        RepairVisemes(d, log);
                        return;
                    case VRC_AvatarDescriptor.LipSyncStyle.JawFlapBlendShape when d.VisemeSkinnedMesh != null:
                    case VRC_AvatarDescriptor.LipSyncStyle.JawFlapBone when d.lipSyncJawBone != null:
                    case VRC_AvatarDescriptor.LipSyncStyle.VisemeParameterOnly:
                        log.Info("Lip sync was already set up (" + ObjectNames.NicifyVariableName(style.ToString()) + ").", d);
                        return;
                }
            }

            var face = FindFaceMesh(d.gameObject);
            if (face != null)
            {
                var visemes = MatchVisemes(face, out var direct);
                if (direct >= 3)
                {
                    d.lipSync = VRC_AvatarDescriptor.LipSyncStyle.VisemeBlendShape;
                    d.VisemeSkinnedMesh = face;
                    d.VisemeBlendShapes = visemes;
                    var filled = visemes.Count(v => v != NoBlendShape);
                    log.Success("Lip sync: matched " + filled + " of 15 mouth shapes (visemes) on \"" + face.name + "\".", face);
                    if (filled < 15)
                        log.Info("Empty visemes: " + string.Join(", ", FaceNames.VisemeIds.Where((_, i) => visemes[i] == NoBlendShape)) +
                                 ". That's normal for models without consonant shapes.", d);
                    return;
                }

                var names = BlendShapeNames(face);
                var jawShape = FaceNames.Find(names, FaceNames.JawOpen);
                if (jawShape >= 0)
                {
                    d.lipSync = VRC_AvatarDescriptor.LipSyncStyle.JawFlapBlendShape;
                    d.VisemeSkinnedMesh = face;
                    d.MouthOpenBlendShapeName = names[jawShape];
                    log.Success("Lip sync: no visemes found, so the mouth opens with \"" + names[jawShape] + "\" on \"" + face.name + "\".", face);
                    return;
                }
            }

            var jaw = animator.GetBoneTransform(HumanBodyBones.Jaw) ?? HumanoidBoneMapper.FindByName(animator.GetBoneTransform(HumanBodyBones.Head), HumanBodyBones.Jaw);
            if (jaw != null)
            {
                var root = animator.transform;
                d.lipSync = VRC_AvatarDescriptor.LipSyncStyle.JawFlapBone;
                d.lipSyncJawBone = jaw;
                d.lipSyncJawClosed = jaw.localRotation;
                d.lipSyncJawOpen = jaw.localRotation * Quaternion.AngleAxis(JawOpenDegrees, jaw.InverseTransformDirection(root.right));
                log.Success("Lip sync: no mouth blendshapes found, so the jaw bone \"" + jaw.name + "\" opens the mouth.", jaw);
                return;
            }

            d.lipSync = VRC_AvatarDescriptor.LipSyncStyle.Default;
            log.Warning("No mouth shapes or jaw bone found, so the mouth won't move when you talk. You can still upload.", d);
        }

        static void RepairVisemes(VRCAvatarDescriptor d, AutopilotLog log)
        {
            var names = new HashSet<string>(BlendShapeNames(d.VisemeSkinnedMesh));
            if (d.VisemeBlendShapes == null || d.VisemeBlendShapes.Length != FaceNames.VisemeIds.Length)
            {
                var copy = new string[FaceNames.VisemeIds.Length];
                if (d.VisemeBlendShapes != null)
                    System.Array.Copy(d.VisemeBlendShapes, copy, Mathf.Min(copy.Length, d.VisemeBlendShapes.Length));
                d.VisemeBlendShapes = copy;
            }

            var detected = MatchVisemes(d.VisemeSkinnedMesh, out _);
            var fixedNames = new List<string>();
            var lost = new List<string>();
            for (int i = 0; i < d.VisemeBlendShapes.Length; i++)
            {
                var current = d.VisemeBlendShapes[i];
                if (!string.IsNullOrEmpty(current) && (current == NoBlendShape || names.Contains(current))) continue;
                if (detected[i] != NoBlendShape)
                {
                    d.VisemeBlendShapes[i] = detected[i];
                    fixedNames.Add(FaceNames.VisemeIds[i]);
                }
                else
                {
                    if (!string.IsNullOrEmpty(current)) lost.Add(FaceNames.VisemeIds[i] + " (\"" + current + "\")");
                    d.VisemeBlendShapes[i] = NoBlendShape;
                }
            }

            if (fixedNames.Count > 0) log.Success("Re-matched visemes that no longer existed on the new mesh: " + string.Join(", ", fixedNames) + ".", d);
            if (lost.Count > 0) log.Warning("These visemes point at blendshapes the new FBX doesn't have, so they were cleared: " + string.Join(", ", lost) + ".", d);
            if (fixedNames.Count == 0 && lost.Count == 0) log.Info("Lip sync carried over; all viseme blendshapes exist on the new mesh.", d);
        }

        // ---------- Eyes & blink ----------

        static void SetupEyes(VRCAvatarDescriptor d, Animator animator, AutopilotLog log, bool fillMissingOnly)
        {
            if (fillMissingOnly && !d.enableEyeLook)
            {
                log.Info("Eye Look is turned off on this avatar, so eyes and blink were left alone.", d);
                return;
            }
            var s = d.customEyeLookSettings;
            s.eyeMovement ??= new EyeMovements();
            bool changed = false;

            if (!fillMissingOnly || s.leftEye == null || s.rightEye == null)
            {
                var left = FindEye(animator, true);
                var right = FindEye(animator, false);
                if (left != null && right != null)
                {
                    var root = animator.transform;
                    s.leftEye = left;
                    s.rightEye = right;
                    s.eyesLookingStraight = EyeRotation(left, right, root.right, 0f);
                    s.eyesLookingUp = EyeRotation(left, right, root.right, -EyeUpDownDegrees);
                    s.eyesLookingDown = EyeRotation(left, right, root.right, EyeUpDownDegrees);
                    s.eyesLookingLeft = EyeRotation(left, right, root.up, -EyeLeftRightDegrees);
                    s.eyesLookingRight = EyeRotation(left, right, root.up, EyeLeftRightDegrees);
                    changed = true;
                    log.Success("Eye look: using \"" + left.name + "\" and \"" + right.name + "\" with gentle default angles.", left);
                }
                else
                {
                    log.Warning("No eye bones found, so the eyes won't move on their own. Blink can still work.", d);
                }
            }

            bool blinkValid = s.eyelidType == VRCAvatarDescriptor.EyelidType.Blendshapes && s.eyelidsSkinnedMesh != null &&
                              s.eyelidsBlendshapes != null && s.eyelidsBlendshapes.Length > 0 &&
                              s.eyelidsBlendshapes[0] >= 0 && s.eyelidsSkinnedMesh.sharedMesh != null &&
                              s.eyelidsBlendshapes[0] < s.eyelidsSkinnedMesh.sharedMesh.blendShapeCount;
            bool blinkByBones = s.eyelidType == VRCAvatarDescriptor.EyelidType.Bones;

            if (!fillMissingOnly || (!blinkValid && !blinkByBones))
            {
                var visemeShapes = new HashSet<string>(d.VisemeBlendShapes ?? new string[0]);
                var meshes = new List<SkinnedMeshRenderer>();
                if (d.VisemeSkinnedMesh != null) meshes.Add(d.VisemeSkinnedMesh);
                meshes.AddRange(d.GetComponentsInChildren<SkinnedMeshRenderer>(true).Where(m => m != d.VisemeSkinnedMesh));

                bool found = false;
                foreach (var smr in meshes)
                {
                    var names = BlendShapeNames(smr);
                    var idx = FaceNames.Find(names, FaceNames.Blink, n => FaceNames.IsOneSided(n) || visemeShapes.Contains(n));
                    if (idx < 0) continue;
                    s.eyelidType = VRCAvatarDescriptor.EyelidType.Blendshapes;
                    s.eyelidsSkinnedMesh = smr;
                    s.eyelidsBlendshapes = new[] { idx, -1, -1 };
                    found = true;
                    changed = true;
                    log.Success("Blink: using \"" + names[idx] + "\" on \"" + smr.name + "\".", smr);
                    break;
                }
                if (!found)
                {
                    if (fillMissingOnly && s.eyelidType == VRCAvatarDescriptor.EyelidType.Blendshapes)
                    {
                        s.eyelidType = VRCAvatarDescriptor.EyelidType.None;
                        changed = true;
                    }
                    log.Warning("No blink blendshape found, so the avatar won't blink. Add a \"Blink\" shape in Blender if you want blinking.", d);
                }
            }

            if (changed)
            {
                d.customEyeLookSettings = s;
                d.enableEyeLook = s.leftEye != null || s.eyelidType != VRCAvatarDescriptor.EyelidType.None;
            }
        }

        static EyeRotations EyeRotation(Transform left, Transform right, Vector3 worldAxis, float degrees)
        {
            var l = left.localRotation * Quaternion.AngleAxis(degrees, left.InverseTransformDirection(worldAxis));
            var r = right.localRotation * Quaternion.AngleAxis(degrees, right.InverseTransformDirection(worldAxis));
            return new EyeRotations { linked = Quaternion.Angle(l, r) < 0.01f, left = l, right = r };
        }
    }
}
