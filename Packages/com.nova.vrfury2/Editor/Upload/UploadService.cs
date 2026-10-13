using System;
using System.Collections.Generic;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using VRC.Core;
using VRC.SDK3A.Editor;
using VRC.SDKBase.Editor;
using VRC.SDKBase.Editor.Api;

namespace Nova.VRFury2
{
    /// <summary>
    /// One-click Build &amp; Upload through the VRChat SDK's public builder API
    /// (<see cref="VRCSdkControlPanel.TryGetBuilder{T}"/> + <see cref="IVRCSdkAvatarBuilderApi.BuildAndUpload"/>).
    /// </summary>
    public static class UploadService
    {
        const string ControlPanelMenu = "VRChat SDK/Show Control Panel";
        static readonly TimeSpan PanelTimeout = TimeSpan.FromSeconds(15);
        static readonly TimeSpan LoginTimeout = TimeSpan.FromMinutes(5);

        static CancellationTokenSource _cancel;

        public static bool IsBusy { get; private set; }

        /// <summary>Latest progress text/fraction. Written from SDK callbacks, read by the window.</summary>
        public static string Status { get; private set; } = "";
        public static float Progress { get; private set; }

        public static void Cancel() => _cancel?.Cancel();

        public static async Task<bool> BuildAndUpload(GameObject avatarRoot, string newAvatarName, AutopilotLog log)
        {
            log.Step("Build & Upload");
            if (IsBusy)
            {
                log.Warning("An upload is already running.");
                return false;
            }
            if (avatarRoot == null)
            {
                log.Error("Pick the avatar in your scene first.");
                return false;
            }
            var pm = avatarRoot.GetComponent<PipelineManager>();
            if (pm == null)
            {
                log.Error("The avatar has no Pipeline Manager. Run \"Check\" and use its fix.", avatarRoot);
                return false;
            }

            IsBusy = true;
            _cancel = new CancellationTokenSource();
            var token = _cancel.Token;
            IVRCSdkAvatarBuilderApi builder = null;
            bool uploadSucceeded = false;
            string uploadedId = null;
            string sdkError = null;

            void OnBuildProgress(object sender, string status) => SetStatus("Building: " + status, 0.15f);
            void OnBuildSuccess(object sender, string path) => SetStatus("Build finished. Starting upload…", 0.5f);
            void OnBuildError(object sender, string error) => sdkError = error;
            void OnUploadProgress(object sender, (string status, float percentage) p) => SetStatus("Uploading: " + p.status, 0.5f + 0.5f * Mathf.Clamp01(p.percentage));
            void OnUploadSuccess(object sender, string id)
            {
                uploadSucceeded = true;
                uploadedId = id;
            }
            void OnUploadError(object sender, string error) => sdkError = error;

            try
            {
                SetStatus("Opening the VRChat SDK panel…", 0f);
                if (VRCSdkControlPanel.window == null) EditorApplication.ExecuteMenuItem(ControlPanelMenu);
                if (!await WaitUntil(() => VRCSdkControlPanel.window != null, PanelTimeout, token))
                {
                    log.Error("Couldn't open the VRChat SDK panel. Open it from the menu VRChat SDK > Show Control Panel, then try again.");
                    return false;
                }

                if (!APIUser.IsLoggedIn)
                {
                    log.Info("Log in to VRChat in the SDK panel (the window that just opened). Waiting for you…");
                    SetStatus("Waiting for you to log in to the VRChat SDK panel…", 0f);
                    if (!await WaitUntil(() => APIUser.IsLoggedIn, LoginTimeout, token))
                    {
                        log.Error("Not logged in to VRChat. Log in from the SDK panel, then press Build & Upload again.");
                        return false;
                    }
                }
                if (!APIUser.CurrentUser.canPublishAvatars)
                {
                    log.Error("Your VRChat account can't upload avatars yet. New accounts need to play a little until they reach the \"New User\" rank.");
                    return false;
                }

                if (!VRCSdkControlPanel.TryGetBuilder(out builder) || builder == null)
                {
                    log.Error("The VRChat SDK's avatar builder isn't available. Make sure the VRChat Avatars SDK is installed (via VCC) and the SDK panel shows no errors.");
                    return false;
                }

                SetStatus("Getting avatar info…", 0.05f);
                VRCAvatar avatar;
                string thumbnailPath = null;
                if (!string.IsNullOrWhiteSpace(pm.blueprintId))
                {
                    try
                    {
                        avatar = await VRCApi.GetAvatar(pm.blueprintId, true, token);
                    }
                    catch (ApiErrorException e) when (e.StatusCode == HttpStatusCode.NotFound)
                    {
                        log.Add(LogLevel.Error, "This avatar's ID (" + pm.blueprintId + ") doesn't exist on VRChat any more. You can upload it as a brand-new avatar instead.",
                            pm, "Upload as new avatar", () => DetachBlueprint(pm));
                        return false;
                    }
                    if (APIUser.CurrentUser == null || avatar.AuthorId != APIUser.CurrentUser.id)
                    {
                        log.Add(LogLevel.Error, "This avatar's ID belongs to a different VRChat account. Log in with the account that made it, or upload it as a new avatar.",
                            pm, "Upload as new avatar", () => DetachBlueprint(pm));
                        return false;
                    }
                    log.Info("Updating your existing avatar \"" + avatar.Name + "\" (" + pm.blueprintId + ").", pm);
                }
                else
                {
                    var name = string.IsNullOrWhiteSpace(newAvatarName) ? avatarRoot.name : newAvatarName.Trim();
                    avatar = new VRCAvatar
                    {
                        Name = name,
                        Description = "",
                        Tags = new List<string>(),
                        ReleaseStatus = "private",
                    };
                    thumbnailPath = ThumbnailCapture.Capture(avatarRoot);
                    log.Info("Creating a new private avatar called \"" + name + "\" with a thumbnail taken from the scene.", avatarRoot);
                }

                builder.OnSdkBuildProgress += OnBuildProgress;
                builder.OnSdkBuildSuccess += OnBuildSuccess;
                builder.OnSdkBuildError += OnBuildError;
                builder.OnSdkUploadProgress += OnUploadProgress;
                builder.OnSdkUploadSuccess += OnUploadSuccess;
                builder.OnSdkUploadError += OnUploadError;

                SetStatus("Building…", 0.1f);
                await builder.BuildAndUpload(avatarRoot, avatar, thumbnailPath, token);

                if (!uploadSucceeded)
                {
                    log.Warning("The SDK finished without confirming the upload" + (sdkError != null ? ": " + sdkError : ".") +
                                " Check the VRChat SDK panel and the Console.");
                    return false;
                }

                log.Success("Uploaded! Your avatar is on VRChat (" + (uploadedId ?? pm.blueprintId) + "). Find it in the game under Avatars > Uploaded.", avatarRoot);
                SaveBlueprintId(avatarRoot, log);
                return true;
            }
            catch (ValidationException e)
            {
                log.Error("The VRChat SDK found problems with the avatar:", avatarRoot);
                foreach (var error in e.Errors) log.Error(error, avatarRoot);
                if (e.Errors.Count == 0) log.Error(e.Message, avatarRoot);
                return false;
            }
            catch (BuildBlockedException e)
            {
                log.Error("Another tool blocked the build: " + e.Message + " Check the Console for its message.", avatarRoot);
                return false;
            }
            catch (OwnershipException e)
            {
                log.Add(LogLevel.Error, "This avatar's ID belongs to a different VRChat account (" + e.Message + ").", pm, "Upload as new avatar", () => DetachBlueprint(pm));
                return false;
            }
            catch (BuilderException e)
            {
                log.Error("The build failed: " + e.Message + " The Console has the details.", avatarRoot);
                return false;
            }
            catch (UploadException e)
            {
                log.Error("The upload failed: " + e.Message, avatarRoot);
                return false;
            }
            catch (OperationCanceledException)
            {
                log.Warning("Upload cancelled.", avatarRoot);
                return false;
            }
            catch (Exception e)
            {
                log.Error("Upload stopped with an unexpected error: " + e.Message + " (details in the Console).", avatarRoot);
                Debug.LogException(e);
                return false;
            }
            finally
            {
                if (builder != null)
                {
                    builder.OnSdkBuildProgress -= OnBuildProgress;
                    builder.OnSdkBuildSuccess -= OnBuildSuccess;
                    builder.OnSdkBuildError -= OnBuildError;
                    builder.OnSdkUploadProgress -= OnUploadProgress;
                    builder.OnSdkUploadSuccess -= OnUploadSuccess;
                    builder.OnSdkUploadError -= OnUploadError;
                }
                _cancel.Dispose();
                _cancel = null;
                IsBusy = false;
                SetStatus("", 0f);
            }
        }

        static void SetStatus(string status, float progress)
        {
            Status = status;
            Progress = progress;
        }

        static async Task<bool> WaitUntil(Func<bool> condition, TimeSpan timeout, CancellationToken token)
        {
            var deadline = DateTime.UtcNow + timeout;
            while (!condition())
            {
                if (DateTime.UtcNow > deadline) return false;
                await Task.Delay(250, token);
            }
            return true;
        }

        static void DetachBlueprint(PipelineManager pm)
        {
            if (pm == null) return;
            if (!EditorUtility.DisplayDialog("Upload as a new avatar?",
                    "This clears the avatar's ID so the next upload creates a new avatar on VRChat. Your existing avatar on VRChat is not changed or deleted.",
                    "Clear ID", "Cancel")) return;
            Undo.RecordObject(pm, "Clear avatar ID");
            pm.blueprintId = "";
            EditorUtility.SetDirty(pm);
            PrefabUtility.RecordPrefabInstancePropertyModifications(pm);
        }

        /// <summary>The SDK writes the new avatar ID into the scene; saving keeps it so the next upload updates the same avatar.</summary>
        static void SaveBlueprintId(GameObject avatarRoot, AutopilotLog log)
        {
            var pm = avatarRoot.GetComponent<PipelineManager>();
            if (pm != null)
            {
                EditorUtility.SetDirty(pm);
                PrefabUtility.RecordPrefabInstancePropertyModifications(pm);
            }
            var scene = avatarRoot.scene;
            EditorSceneManager.MarkSceneDirty(scene);
            if (!string.IsNullOrEmpty(scene.path) && EditorSceneManager.SaveScene(scene))
                log.Info("Saved the scene so the avatar's ID is remembered for next time.");
            else
                log.Warning("Save your scene (Ctrl+S) so the avatar's ID is remembered and the next upload updates this avatar.", avatarRoot);
        }
    }
}
