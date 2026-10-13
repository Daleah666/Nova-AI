using System;
using System.Threading.Tasks;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using VRC.SDK3.Avatars.Components;

namespace Nova.VRFury2
{
    public sealed class AutopilotOptions
    {
        public GameObject Fbx;
        public bool UpdateMode;
        /// <summary>Update mode: the avatar already set up in the scene.</summary>
        public GameObject OldAvatar;
        /// <summary>New mode: name for the scene object and the new VRChat avatar.</summary>
        public string AvatarName;
        public bool Upload;
        /// <summary>The avatar a previous run put in the scene, reused when running again on the same FBX.</summary>
        public GameObject SceneAvatar;
    }

    /// <summary>Runs the steps in order. Each step can also be run on its own from the window.</summary>
    public static class Autopilot
    {
        public static bool Validate(AutopilotOptions o, AutopilotLog log)
        {
            if (o.Fbx == null)
            {
                log.Error("Drop your FBX file into the window first.");
                return false;
            }
            if (!FbxImportConfigurator.IsModelAsset(o.Fbx))
            {
                log.Error("\"" + o.Fbx.name + "\" isn't an FBX/model file from the Project window.", o.Fbx);
                return false;
            }
            if (o.UpdateMode)
            {
                if (o.OldAvatar == null)
                {
                    log.Error("Update mode: pick your old avatar from the scene (Hierarchy window).");
                    return false;
                }
                if (EditorUtility.IsPersistent(o.OldAvatar))
                {
                    log.Error("Update mode: drag the old avatar from the Hierarchy (your scene), not from the Project window.", o.OldAvatar);
                    return false;
                }
            }
            return true;
        }

        public static FbxImportConfigurator.Result RunImport(AutopilotOptions o, AutopilotLog log) =>
            Validate(o, log) ? FbxImportConfigurator.Run(o.Fbx, log) : null;

        /// <summary>Import, put the avatar in the scene, then set it up (New) or copy the old setup onto it (Update).</summary>
        public static GameObject RunSetup(AutopilotOptions o, AutopilotLog log)
        {
            var import = RunImport(o, log);
            if (import == null || !import.Ok)
            {
                if (import != null) log.Error("Stopped: fix the rig first (see the messages above).");
                return null;
            }

            GameObject avatar;
            if (o.UpdateMode)
            {
                if (AvatarPaths.GetSourceModelPath(o.OldAvatar) == import.AssetPath)
                {
                    log.Step("Copy setup from old avatar");
                    log.Info("Your old avatar already uses this exact FBX file, so Unity updated it in place. Nothing needs copying.", o.OldAvatar);
                    avatar = o.OldAvatar;
                }
                else
                {
                    avatar = Instantiate(import.Model, o.OldAvatar.scene, null);
                    if (!SetupMigrator.Migrate(o.OldAvatar, avatar, log))
                        return null;
                }
                log.Step("Check avatar setup");
                AvatarDescriptorBuilder.Configure(avatar, log);
            }
            else
            {
                avatar = ReusableSceneAvatar(o, import.AssetPath);
                if (avatar != null)
                    log.Info("Using the avatar already in the scene from the last run.", avatar);
                else
                {
                    avatar = Instantiate(import.Model, SceneManager.GetActiveScene(), string.IsNullOrWhiteSpace(o.AvatarName) ? null : o.AvatarName.Trim());
                    log.Success("Added the avatar to the scene.", avatar);
                }
                log.Step("Avatar setup");
                AvatarDescriptorBuilder.Configure(avatar, log);
            }

            MaterialSetup.Run(avatar, import.AssetPath, log);
            EditorSceneManager.MarkSceneDirty(avatar.scene);
            o.SceneAvatar = avatar;
            return avatar;
        }

        public static async Task<GameObject> DoEverything(AutopilotOptions o, AutopilotLog log)
        {
            Undo.IncrementCurrentGroup();
            var group = Undo.GetCurrentGroup();
            Undo.SetCurrentGroupName("VRFury 2.0: Do Everything");

            GameObject avatar;
            bool ready;
            try
            {
                avatar = RunSetup(o, log);
                if (avatar == null) return null;
                ready = PreflightChecks.RunAndReport(avatar, log);
            }
            finally
            {
                Undo.CollapseUndoOperations(group);
            }

            Selection.activeGameObject = avatar;
            if (SceneView.lastActiveSceneView != null) SceneView.lastActiveSceneView.FrameSelected();

            if (!o.Upload)
            {
                log.Info(ready ? "All set. Press \"Build & Upload\" when you're ready." : "Fix the problems above, then press \"Build & Upload\".", avatar);
                return avatar;
            }
            if (!ready)
            {
                log.Warning("Didn't upload because of the problems above. Fix them (try the Fix buttons), then press \"Build & Upload\".", avatar);
                return avatar;
            }
            await UploadService.BuildAndUpload(avatar, o.UpdateMode ? null : o.AvatarName, log);
            return avatar;
        }

        static GameObject ReusableSceneAvatar(AutopilotOptions o, string assetPath)
        {
            var a = o.SceneAvatar;
            if (a == null || EditorUtility.IsPersistent(a) || !a.scene.IsValid()) return null;
            return AvatarPaths.GetSourceModelPath(a) == assetPath ? a : null;
        }

        static GameObject Instantiate(GameObject model, Scene scene, string name)
        {
            var instance = (GameObject)PrefabUtility.InstantiatePrefab(model, scene);
            Undo.RegisterCreatedObjectUndo(instance, "VRFury 2.0 add avatar");
            if (!string.IsNullOrEmpty(name)) instance.name = name;
            return instance;
        }

        /// <summary>Avatars with a descriptor in the open scenes, for pre-filling the "old avatar" slot.</summary>
        public static VRCAvatarDescriptor[] SceneAvatars() =>
            Array.FindAll(UnityEngine.Object.FindObjectsOfType<VRCAvatarDescriptor>(), d => d.gameObject.activeInHierarchy);
    }
}
