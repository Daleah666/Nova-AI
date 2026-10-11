using System;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Nova.VRFury2
{
    /// <summary>Tools > VRFury 2.0: drop an FBX, pick New or Update, press Do Everything.</summary>
    public sealed class DropWindow : EditorWindow
    {
        [SerializeField] GameObject _fbx;
        [SerializeField] bool _updateMode;
        [SerializeField] GameObject _oldAvatar;
        [SerializeField] string _avatarName = "";
        [SerializeField] bool _upload = true;
        [SerializeField] GameObject _sceneAvatar;
        [SerializeField] bool _showSteps;

        readonly AutopilotLog _log = new AutopilotLog();
        Vector2 _scroll;
        bool _running;

        GUIStyle _bigButton, _dropBox, _wrapLabel, _entryButton, _successIcon;
        GUIContent _infoIcon, _warnIcon, _errorIcon;

        [MenuItem("Tools/VRFury 2.0")]
        public static void Open()
        {
            var window = GetWindow<DropWindow>();
            window.titleContent = new GUIContent("VRFury 2.0");
            window.minSize = new Vector2(380f, 520f);
            window.Show();
        }

        void OnEnable() => _log.Changed += Repaint;
        void OnDisable() => _log.Changed -= Repaint;

        void OnInspectorUpdate()
        {
            if (_running || UploadService.IsBusy) Repaint();
        }

        bool Busy => _running || UploadService.IsBusy;

        AutopilotOptions Options() => new AutopilotOptions
        {
            Fbx = _fbx,
            UpdateMode = _updateMode,
            OldAvatar = _oldAvatar,
            AvatarName = _avatarName,
            Upload = _upload,
            SceneAvatar = _sceneAvatar,
        };

        void InitStyles()
        {
            if (_bigButton != null) return;
            _bigButton = new GUIStyle(GUI.skin.button) { fontSize = 15, fontStyle = FontStyle.Bold, fixedHeight = 42f };
            _dropBox = new GUIStyle(EditorStyles.helpBox) { alignment = TextAnchor.MiddleCenter, fontSize = 12, wordWrap = true };
            _wrapLabel = new GUIStyle(EditorStyles.label) { wordWrap = true };
            _entryButton = new GUIStyle(EditorStyles.label) { wordWrap = true, richText = false };
            _successIcon = new GUIStyle(EditorStyles.boldLabel) { normal = { textColor = new Color(0.3f, 0.8f, 0.35f) }, alignment = TextAnchor.MiddleCenter };
            _infoIcon = EditorGUIUtility.IconContent("console.infoicon.sml");
            _warnIcon = EditorGUIUtility.IconContent("console.warnicon.sml");
            _errorIcon = EditorGUIUtility.IconContent("console.erroricon.sml");
        }

        void OnGUI()
        {
            InitStyles();
            EditorGUILayout.Space(4f);
            EditorGUILayout.LabelField("FBX to VRChat Autopilot", EditorStyles.boldLabel);
            EditorGUILayout.LabelField("1. Drop your FBX below.  2. Pick New or Update.  3. Press Do Everything.", _wrapLabel);
            EditorGUILayout.Space(4f);

            using (new EditorGUI.DisabledScope(Busy))
            {
                DrawFbxDrop();
                EditorGUILayout.Space(6f);
                DrawMode();
                EditorGUILayout.Space(6f);
                _upload = EditorGUILayout.ToggleLeft(new GUIContent("Upload to VRChat when done",
                    "After setting up and checking, build and upload through the VRChat SDK. You'll be asked to log in the first time."), _upload);
                EditorGUILayout.Space(4f);

                using (new EditorGUI.DisabledScope(!CanRun()))
                {
                    if (GUILayout.Button(new GUIContent("Do Everything", "Import & rig, set up (or copy from the old avatar), check, and upload if ticked."), _bigButton))
                        Defer(RunEverything);
                }
                if (!CanRun()) EditorGUILayout.LabelField(WhyCantRun(), EditorStyles.centeredGreyMiniLabel);
            }

            DrawProgress();
            DrawSteps();
            DrawResults();
        }

        // ---------- Inputs ----------

        void DrawFbxDrop()
        {
            var rect = GUILayoutUtility.GetRect(0f, 64f, GUILayout.ExpandWidth(true));
            var label = _fbx != null
                ? "FBX: " + _fbx.name + "\n(drop another file to replace it)"
                : "Drag your FBX here\n(from the Project window or from your desktop)";
            GUI.Box(rect, label, _dropBox);
            HandleDrop(rect);

            EditorGUI.BeginChangeCheck();
            var picked = (GameObject)EditorGUILayout.ObjectField(new GUIContent("FBX file", "The .fbx you exported from Blender or another 3D app."), _fbx, typeof(GameObject), false);
            if (EditorGUI.EndChangeCheck()) SetFbx(picked);
            if (_fbx != null && !FbxImportConfigurator.IsModelAsset(_fbx))
                EditorGUILayout.HelpBox("That's not a model file. Pick the .fbx itself, not a prefab or scene object.", MessageType.Warning);
        }

        void HandleDrop(Rect rect)
        {
            var e = Event.current;
            if ((e.type != EventType.DragUpdated && e.type != EventType.DragPerform) || !rect.Contains(e.mousePosition)) return;

            var asset = DragAndDrop.objectReferences.OfType<GameObject>().FirstOrDefault(FbxImportConfigurator.IsModelAsset);
            var external = asset == null ? DragAndDrop.paths.FirstOrDefault(ExternalFileImport.IsExternalFbx) : null;
            if (asset == null && external == null) return;

            DragAndDrop.visualMode = DragAndDropVisualMode.Copy;
            if (e.type == EventType.DragPerform)
            {
                DragAndDrop.AcceptDrag();
                if (asset != null) SetFbx(asset);
                else Defer(() => SetFbx(ExternalFileImport.Import(external, _log)));
            }
            e.Use();
        }

        void SetFbx(GameObject fbx)
        {
            var previousName = _fbx != null ? _fbx.name : null;
            _fbx = fbx;
            if (fbx != null && (string.IsNullOrWhiteSpace(_avatarName) || _avatarName == previousName))
                _avatarName = fbx.name;
            Repaint();
        }

        void DrawMode()
        {
            EditorGUILayout.LabelField("Is this a new avatar, or a new version of one you already set up?", _wrapLabel);
            var mode = GUILayout.Toolbar(_updateMode ? 1 : 0, new[] { "New avatar", "Update an existing avatar" });
            if ((mode == 1) != _updateMode)
            {
                _updateMode = mode == 1;
                if (_updateMode && _oldAvatar == null)
                {
                    var avatars = Autopilot.SceneAvatars();
                    if (avatars.Length == 1) _oldAvatar = avatars[0].gameObject;
                }
            }

            if (_updateMode)
            {
                _oldAvatar = (GameObject)EditorGUILayout.ObjectField(new GUIContent("Old avatar (in scene)",
                    "The avatar you already set up, from the Hierarchy. Its PhysBones, props, materials and avatar ID are copied onto the new FBX. It's kept, turned off, as a backup."),
                    _oldAvatar, typeof(GameObject), true);
                EditorGUILayout.LabelField("Everything you set up on the old avatar is copied onto the new FBX, and uploading updates the same VRChat avatar.",
                    EditorStyles.wordWrappedMiniLabel);
            }
            else
            {
                _avatarName = EditorGUILayout.TextField(new GUIContent("Avatar name", "Name shown in VRChat for the new avatar (you can change it later)."), _avatarName);
                EditorGUILayout.LabelField("Sets up the viewpoint, lip sync, eyes, blink and materials automatically. New avatars upload as Private.",
                    EditorStyles.wordWrappedMiniLabel);
            }
        }

        bool CanRun() => _fbx != null && FbxImportConfigurator.IsModelAsset(_fbx) && (!_updateMode || _oldAvatar != null);

        string WhyCantRun()
        {
            if (_fbx == null) return "Drop an FBX to start.";
            if (!FbxImportConfigurator.IsModelAsset(_fbx)) return "Pick an FBX file.";
            return "Pick the old avatar from your scene.";
        }

        // ---------- Progress ----------

        void DrawProgress()
        {
            if (UploadService.IsBusy)
            {
                EditorGUILayout.Space(6f);
                var rect = GUILayoutUtility.GetRect(0f, 20f, GUILayout.ExpandWidth(true));
                EditorGUI.ProgressBar(rect, UploadService.Progress, string.IsNullOrEmpty(UploadService.Status) ? "Working…" : UploadService.Status);
                if (GUILayout.Button("Cancel upload")) UploadService.Cancel();
            }
            else if (_running)
            {
                EditorGUILayout.Space(6f);
                EditorGUILayout.LabelField("Working…", EditorStyles.centeredGreyMiniLabel);
            }
        }

        // ---------- Step by step ----------

        void DrawSteps()
        {
            EditorGUILayout.Space(6f);
            _showSteps = EditorGUILayout.Foldout(_showSteps, "Step by step (optional)", true);
            if (!_showSteps) return;

            using (new EditorGUI.IndentLevelScope())
            using (new EditorGUI.DisabledScope(Busy))
            {
                _sceneAvatar = (GameObject)EditorGUILayout.ObjectField(new GUIContent("Avatar in scene",
                    "The avatar that Check and Build & Upload work on. Filled in automatically after step 2."), _sceneAvatar, typeof(GameObject), true);

                using (new EditorGUI.DisabledScope(!CanRun()))
                {
                    if (GUILayout.Button(new GUIContent("1. Import & Rig", "Humanoid rig, blendshapes, Read/Write, materials extracted. Only changes import settings.")))
                        Defer(() => Step(() => Autopilot.RunImport(Options(), _log)));
                    if (GUILayout.Button(_updateMode ? "2. Copy setup from old avatar" : "2. Set up avatar"))
                        Defer(() => Step(() =>
                        {
                            Undo.IncrementCurrentGroup();
                            var group = Undo.GetCurrentGroup();
                            var avatar = Autopilot.RunSetup(Options(), _log);
                            Undo.CollapseUndoOperations(group);
                            if (avatar != null)
                            {
                                _sceneAvatar = avatar;
                                if (_updateMode) _oldAvatar = avatar;
                                Selection.activeGameObject = avatar;
                            }
                        }));
                }
                using (new EditorGUI.DisabledScope(_sceneAvatar == null))
                {
                    if (GUILayout.Button(new GUIContent("3. Check", "Looks for problems that would block or spoil the upload, and fixes the safe ones.")))
                        Defer(() => Step(() => PreflightChecks.RunAndReport(_sceneAvatar, _log)));
                    if (GUILayout.Button(new GUIContent("4. Build & Upload", "Uploads the avatar in the scene through the VRChat SDK.")))
                        Defer(RunUpload);
                }
            }
        }

        // ---------- Results ----------

        void DrawResults()
        {
            EditorGUILayout.Space(8f);
            using (new EditorGUILayout.HorizontalScope())
            {
                var counts = _log.ErrorCount > 0 || _log.WarningCount > 0
                    ? "  (" + AvatarPaths.Plural(_log.ErrorCount, "problem") + ", " + AvatarPaths.Plural(_log.WarningCount, "warning") + ")"
                    : "";
                EditorGUILayout.LabelField("Results" + counts, EditorStyles.boldLabel);
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("Copy", EditorStyles.miniButtonLeft, GUILayout.Width(48f)))
                    EditorGUIUtility.systemCopyBuffer = string.Join("\n", _log.Entries.Select(e => "[" + e.Level + "] " + e.Message));
                if (GUILayout.Button("Clear", EditorStyles.miniButtonRight, GUILayout.Width(48f)))
                    _log.Clear();
            }

            _scroll = EditorGUILayout.BeginScrollView(_scroll, EditorStyles.helpBox, GUILayout.ExpandHeight(true));
            if (_log.Entries.Count == 0)
                EditorGUILayout.LabelField("What the tool did (and anything it needs from you) shows up here. Click a line to find the object it's about.",
                    EditorStyles.wordWrappedMiniLabel);

            foreach (var entry in _log.Entries.ToArray())
            {
                if (entry.Level == LogLevel.Step)
                {
                    EditorGUILayout.Space(4f);
                    EditorGUILayout.LabelField(entry.Message, EditorStyles.boldLabel);
                    continue;
                }
                using (new EditorGUILayout.HorizontalScope())
                {
                    if (entry.Level == LogLevel.Success) GUILayout.Label("✓", _successIcon, GUILayout.Width(20f));
                    else GUILayout.Label(Icon(entry.Level), GUILayout.Width(20f), GUILayout.Height(18f));

                    if (GUILayout.Button(entry.Message, _entryButton) && entry.Context != null)
                    {
                        EditorGUIUtility.PingObject(entry.Context);
                        Selection.activeObject = entry.Context;
                    }
                    if (entry.Fix != null && !Busy && GUILayout.Button(entry.FixLabel ?? "Fix", GUILayout.ExpandWidth(false)))
                    {
                        var fix = entry.Fix;
                        var label = entry.FixLabel ?? "Fix";
                        entry.Fix = null;
                        Defer(() => Step(() =>
                        {
                            fix();
                            _log.Success("Done: " + label + ". Run Check again to confirm.");
                        }));
                    }
                }
            }
            EditorGUILayout.EndScrollView();
        }

        GUIContent Icon(LogLevel level) => level == LogLevel.Error ? _errorIcon : level == LogLevel.Warning ? _warnIcon : _infoIcon;

        // ---------- Running ----------

        /// <summary>Runs after this GUI pass, so imports and dialogs don't interrupt the window's layout.</summary>
        void Defer(Action action) => EditorApplication.delayCall += () => action();

        void Step(Action action)
        {
            _running = true;
            try
            {
                action();
            }
            catch (Exception e)
            {
                _log.Error("Something went wrong: " + e.Message + " (details in the Console).");
                Debug.LogException(e);
            }
            finally
            {
                _running = false;
                Repaint();
            }
        }

        async void RunEverything()
        {
            _running = true;
            _log.Clear();
            try
            {
                var avatar = await Autopilot.DoEverything(Options(), _log);
                if (avatar != null) _sceneAvatar = avatar;
                if (_updateMode && avatar != null) _oldAvatar = avatar;
            }
            catch (Exception e)
            {
                _log.Error("Something went wrong: " + e.Message + " (details in the Console).");
                Debug.LogException(e);
            }
            finally
            {
                _running = false;
                Repaint();
            }
        }

        async void RunUpload()
        {
            _running = true;
            try
            {
                await UploadService.BuildAndUpload(_sceneAvatar, _updateMode ? null : _avatarName, _log);
            }
            catch (Exception e)
            {
                _log.Error("Something went wrong: " + e.Message + " (details in the Console).");
                Debug.LogException(e);
            }
            finally
            {
                _running = false;
                Repaint();
            }
        }
    }
}
