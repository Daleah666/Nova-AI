using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using VRC.Core;
using VRC.SDK3.Avatars.Components;
using VRC.SDKBase;
using VRC.SDKBase.Validation.Performance;
using VRC.SDKBase.Validation.Performance.Stats;
using Object = UnityEngine.Object;

namespace Nova.VRFury2
{
    /// <summary>Checks that catch the usual reasons an upload fails or looks wrong, with fixes where they're safe.</summary>
    public static class PreflightChecks
    {
        public sealed class Issue
        {
            public LogLevel Level;
            public string Message;
            public Object Context;
            public string FixLabel;
            public Action Fix;
            /// <summary>Safe to apply without asking (only touches settings, never deletes anything).</summary>
            public bool AutoFix;
        }

        /// <summary>Runs every check, applies the safe fixes, re-checks and logs what's left. Returns true when nothing blocks the upload.</summary>
        public static bool RunAndReport(GameObject root, AutopilotLog log, bool applySafeFixes = true)
        {
            log.Step("Check");
            var issues = Run(root);

            if (applySafeFixes)
            {
                var safe = issues.Where(i => i.AutoFix && i.Fix != null).ToList();
                foreach (var issue in safe)
                {
                    try
                    {
                        issue.Fix();
                        log.Success("Fixed: " + issue.Message, issue.Context);
                    }
                    catch (Exception e)
                    {
                        log.Warning("Tried to fix \"" + issue.Message + "\" but it failed: " + e.Message, issue.Context);
                    }
                }
                if (safe.Count > 0) issues = Run(root);
            }

            foreach (var issue in issues)
                log.Add(issue.Level, issue.Message, issue.Context, issue.FixLabel, issue.Fix);

            var errors = issues.Count(i => i.Level == LogLevel.Error);
            if (errors == 0)
                log.Success("Ready to upload" + (issues.Any(i => i.Level == LogLevel.Warning) ? " (read the warnings above)." : "."), root);
            else
                log.Error(AvatarPaths.Plural(errors, "problem") + " must be fixed before uploading.", root);
            return errors == 0;
        }

        public static List<Issue> Run(GameObject root)
        {
            var issues = new List<Issue>();
            void Add(LogLevel level, string message, Object context, string fixLabel = null, Action fix = null, bool auto = false) =>
                issues.Add(new Issue { Level = level, Message = message, Context = context, FixLabel = fixLabel, Fix = fix, AutoFix = auto });

            if (root == null)
            {
                Add(LogLevel.Error, "No avatar selected.", null);
                return issues;
            }

            if (!root.activeInHierarchy)
            {
                bool parentsActive = root.transform.parent == null || root.transform.parent.gameObject.activeInHierarchy;
                Add(LogLevel.Error, "The avatar is turned off in the scene.", root, parentsActive ? "Turn on" : null,
                    parentsActive ? () => { Undo.RecordObject(root, "Turn on avatar"); root.SetActive(true); } : (Action)null, parentsActive);
            }

            var descriptor = root.GetComponent<VRCAvatarDescriptor>();
            if (descriptor == null)
            {
                Add(LogLevel.Error, "There's no VRC Avatar Descriptor on the avatar.", root, "Add & set up",
                    () => AvatarDescriptorBuilder.Configure(root, new AutopilotLog()), true);
            }
            if (root.GetComponent<PipelineManager>() == null)
                Add(LogLevel.Error, "There's no Pipeline Manager on the avatar (it stores the avatar's ID).", root, "Add",
                    () => Undo.AddComponent<PipelineManager>(root), true);

            var nested = root.GetComponentsInChildren<VRC_AvatarDescriptor>(true).Where(d => d.gameObject != root).ToList();
            foreach (var d in nested)
                Add(LogLevel.Error, "\"" + d.name + "\" inside the avatar has its own Avatar Descriptor. Remove that component.", d);

            CheckAnimator(root, Add);
            if (descriptor != null) CheckDescriptor(root, descriptor, Add);
            CheckMissingScripts(root, Add);
            CheckMeshImports(root, Add);
            CheckMaterials(root, Add);
            CheckSize(root, Add);
            CheckDuplicateIds(root, Add);
            CheckPerformance(root, Add);

            if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.StandaloneWindows64)
                Add(LogLevel.Warning, "Unity is set to build for " + EditorUserBuildSettings.activeBuildTarget +
                                      ". This tool uploads the PC (Windows) version; Quest/Android isn't supported yet.", null,
                    "Switch to PC", () => EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Standalone, BuildTarget.StandaloneWindows64));

            return issues;
        }

        delegate void AddIssue(LogLevel level, string message, Object context, string fixLabel = null, Action fix = null, bool auto = false);

        static void CheckAnimator(GameObject root, AddIssue add)
        {
            var animator = root.GetComponent<Animator>();
            if (animator == null)
            {
                add(LogLevel.Error, "The avatar has no Animator. Add the FBX to the scene again (drag it from the Project window).", root);
                return;
            }
            if (animator.avatar == null || !animator.avatar.isValid || !animator.isHuman)
            {
                add(LogLevel.Error, "The rig isn't a valid Humanoid, so VRChat can't animate it. Run Import & Rig and read its messages.", root);
                return;
            }

            var lFoot = animator.GetBoneTransform(HumanBodyBones.LeftFoot);
            var rFoot = animator.GetBoneTransform(HumanBodyBones.RightFoot);
            if (lFoot == null || rFoot == null)
                add(LogLevel.Error, "The Humanoid rig has no feet assigned.", root);
            else if (lFoot.position.y - root.transform.position.y < 0f)
                add(LogLevel.Warning, "The feet are below the avatar's origin (the floor). Check the FBX's position in Blender.", lFoot.gameObject);
            if (animator.GetBoneTransform(HumanBodyBones.LeftUpperArm) == null || animator.GetBoneTransform(HumanBodyBones.RightUpperArm) == null)
                add(LogLevel.Error, "The Humanoid rig has no upper arms assigned.", root);
        }

        static void CheckDescriptor(GameObject root, VRCAvatarDescriptor d, AddIssue add)
        {
            var animator = root.GetComponent<Animator>();
            if (animator != null && animator.isHuman)
            {
                var expected = AvatarDescriptorBuilder.ComputeViewPosition(animator);
                if (expected.HasValue)
                {
                    var height = Mathf.Max(0.1f, AvatarHeight(root));
                    var distance = Vector3.Distance(d.ViewPosition, expected.Value);
                    bool unset = d.ViewPosition == Vector3.zero || (d.ViewPosition - new Vector3(0f, 1.6f, 0.2f)).sqrMagnitude < 1e-6f;
                    void Recompute()
                    {
                        Undo.RecordObject(d, "Recompute viewpoint");
                        d.ViewPosition = expected.Value;
                        EditorUtility.SetDirty(d);
                    }
                    if (unset && distance > 0.05f)
                        add(LogLevel.Warning, "The viewpoint is still at the SDK default, not at the eyes.", d, "Move to eyes", Recompute, true);
                    else if (distance > Mathf.Max(0.1f, height * 0.15f))
                        add(LogLevel.Warning, "The viewpoint is " + (distance * 100f).ToString("0") + " cm away from the eyes. That's fine if you placed it on purpose.",
                            d, "Move to eyes", Recompute);
                }
            }

            if (d.lipSync == VRC_AvatarDescriptor.LipSyncStyle.VisemeBlendShape && d.VisemeSkinnedMesh == null)
                add(LogLevel.Error, "Lip sync uses visemes but no face mesh is set.", d, "Set up lip sync again", () =>
                {
                    Undo.RecordObject(d, "Lip sync");
                    d.lipSync = VRC_AvatarDescriptor.LipSyncStyle.Default;
                    AvatarDescriptorBuilder.Configure(root, new AutopilotLog());
                }, true);
            if (d.lipSync == VRC_AvatarDescriptor.LipSyncStyle.JawFlapBone && d.lipSyncJawBone == null)
                add(LogLevel.Warning, "Lip sync uses a jaw bone but none is set, so the mouth won't move.", d);

            var eyes = d.customEyeLookSettings;
            if (d.enableEyeLook && (eyes.leftEye == null || eyes.rightEye == null) && eyes.eyelidType == VRCAvatarDescriptor.EyelidType.None)
                add(LogLevel.Warning, "Eye Look is on but no eye bones are set.", d);
            if (eyes.eyelidType == VRCAvatarDescriptor.EyelidType.Blendshapes &&
                (eyes.eyelidsSkinnedMesh == null || eyes.eyelidsBlendshapes == null || eyes.eyelidsBlendshapes.Length == 0 || eyes.eyelidsBlendshapes[0] < 0))
                add(LogLevel.Warning, "Blink is set to use a blendshape but none is picked.", d);
        }

        static void CheckMissingScripts(GameObject root, AddIssue add)
        {
            var broken = root.GetComponentsInChildren<Transform>(true)
                .Where(t => GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(t.gameObject) > 0)
                .Select(t => t.gameObject).ToList();
            if (broken.Count == 0) return;
            add(LogLevel.Error,
                AvatarPaths.Plural(broken.Count, "object") + " have missing scripts (e.g. \"" + broken[0].name +
                "\"). Usually a tool/package isn't installed in this project. Install it, or remove the broken components.",
                broken[0], "Remove missing scripts", () =>
                {
                    foreach (var go in broken)
                    {
                        Undo.RegisterCompleteObjectUndo(go, "Remove missing scripts");
                        GameObjectUtility.RemoveMonoBehavioursWithMissingScript(go);
                    }
                });
        }

        static void CheckMeshImports(GameObject root, AddIssue add)
        {
            var paths = new HashSet<string>();
            foreach (var smr in root.GetComponentsInChildren<SkinnedMeshRenderer>(true))
                if (smr.sharedMesh != null) paths.Add(AssetDatabase.GetAssetPath(smr.sharedMesh));
            foreach (var mf in root.GetComponentsInChildren<MeshFilter>(true))
                if (mf.sharedMesh != null) paths.Add(AssetDatabase.GetAssetPath(mf.sharedMesh));

            foreach (var path in paths)
            {
                if (string.IsNullOrEmpty(path) || !(AssetImporter.GetAtPath(path) is ModelImporter importer)) continue;
                var model = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                if (!importer.isReadable)
                    add(LogLevel.Error, "\"" + System.IO.Path.GetFileName(path) + "\" needs Read/Write turned on in its import settings.", model, "Turn on",
                        () =>
                        {
                            importer.isReadable = true;
                            importer.SaveAndReimport();
                        }, true);
                if (FbxImportConfigurator.NeedsLegacyBlendShapeNormals(importer))
                    add(LogLevel.Error, "\"" + System.IO.Path.GetFileName(path) + "\" needs Legacy Blendshape Normals (otherwise the upload is much bigger).", model,
                        "Turn on", () =>
                        {
                            FbxImportConfigurator.ApplyImportSettings(importer, new AutopilotLog());
                            importer.SaveAndReimport();
                        }, true);
            }
        }

        static void CheckMaterials(GameObject root, AddIssue add)
        {
            foreach (var r in root.GetComponentsInChildren<Renderer>(true))
            {
                var empty = r.sharedMaterials.Count(m => m == null);
                if (empty > 0)
                    add(LogLevel.Warning, "\"" + r.name + "\" has " + AvatarPaths.Plural(empty, "empty material slot") + " (shows pink or invisible).", r);
            }
        }

        static float AvatarHeight(GameObject root)
        {
            var renderers = root.GetComponentsInChildren<Renderer>(true);
            if (renderers.Length == 0) return 0f;
            var bounds = renderers[0].bounds;
            foreach (var r in renderers) bounds.Encapsulate(r.bounds);
            return bounds.max.y - root.transform.position.y;
        }

        static void CheckSize(GameObject root, AddIssue add)
        {
            var height = AvatarHeight(root);
            if (height <= 0f) return;
            if (height < 0.2f)
                add(LogLevel.Warning, "The avatar is only " + (height * 100f).ToString("0") + " cm tall. If that's not on purpose, check the FBX scale (Blender: Apply Scale, export with scale 1.0).", root);
            else if (height > 5f)
                add(LogLevel.Warning, "The avatar is " + height.ToString("0.0") + " m tall. If that's not on purpose, check the FBX scale (often a 100x export problem).", root);
        }

        static void CheckDuplicateIds(GameObject root, AddIssue add)
        {
            var pm = root.GetComponent<PipelineManager>();
            if (pm == null || string.IsNullOrEmpty(pm.blueprintId)) return;
            var others = Object.FindObjectsOfType<PipelineManager>()
                .Where(p => p != pm && p.blueprintId == pm.blueprintId && p.gameObject.activeInHierarchy).ToList();
            if (others.Count > 0)
                add(LogLevel.Warning, "\"" + others[0].name + "\" in the scene uses the same avatar ID. Turn it off so you don't upload the wrong one.", others[0]);
        }

        static void CheckPerformance(GameObject root, AddIssue add)
        {
            try
            {
                var stats = new AvatarPerformanceStats(false);
                AvatarPerformance.CalculatePerformanceStats(root.name, root, stats, false);
                var overall = stats.GetPerformanceRatingForCategory(AvatarPerformanceCategory.Overall);

                var bad = new List<string>();
                foreach (AvatarPerformanceCategory category in Enum.GetValues(typeof(AvatarPerformanceCategory)))
                {
                    if (category == AvatarPerformanceCategory.None || category == AvatarPerformanceCategory.Overall ||
                        category == AvatarPerformanceCategory.DownloadSize || category == AvatarPerformanceCategory.UncompressedSize ||
                        category == AvatarPerformanceCategory.AvatarPerformanceCategoryCount) continue;
                    var rating = stats.GetPerformanceRatingForCategory(category);
                    if (rating == PerformanceRating.Poor || rating == PerformanceRating.VeryPoor)
                        bad.Add(AvatarPerformanceStats.GetPerformanceCategoryDisplayName(category) + " (" +
                                AvatarPerformanceStats.GetPerformanceRatingDisplayName(rating) + ")");
                }

                var message = "PC performance rank: " + AvatarPerformanceStats.GetPerformanceRatingDisplayName(overall) +
                              (bad.Count > 0 ? ". Heaviest parts: " + string.Join(", ", bad) + "." : ".");
                var level = overall == PerformanceRating.VeryPoor ? LogLevel.Warning : LogLevel.Info;
                if (overall == PerformanceRating.VeryPoor)
                    message += " Very Poor avatars still upload, but many people will see a fallback instead.";
                add(level, message, root);
            }
            catch (Exception e)
            {
                add(LogLevel.Info, "Couldn't calculate the performance rank here (" + e.GetType().Name + "). The SDK panel will show it.", root);
            }
        }
    }
}
