using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Nova.VRFury2
{
    /// <summary>
    /// Copies an FBX dragged in from outside Unity (e.g. the desktop) into the project, along with the
    /// textures next to it. Never overwrites: an existing file gets a numbered name instead.
    /// </summary>
    public static class ExternalFileImport
    {
        public const string RootFolder = "Assets/VRFury Avatars";
        static readonly string[] TextureExtensions = { ".png", ".jpg", ".jpeg", ".tga", ".psd", ".tif", ".tiff", ".bmp", ".exr" };

        public static bool IsExternalFbx(string path) =>
            !string.IsNullOrEmpty(path) && path.EndsWith(".fbx", StringComparison.OrdinalIgnoreCase) && File.Exists(path) && !IsInsideProject(path);

        static bool IsInsideProject(string path)
        {
            var full = Path.GetFullPath(path).Replace('\\', '/');
            var assets = Path.GetFullPath(Application.dataPath).Replace('\\', '/');
            return full.StartsWith(assets + "/", StringComparison.OrdinalIgnoreCase);
        }

        public static GameObject Import(string externalPath, AutopilotLog log)
        {
            var name = AvatarPaths.SafeFileName(Path.GetFileNameWithoutExtension(externalPath));
            var folder = RootFolder + "/" + name;
            EnsureFolder(folder);

            var destination = AssetDatabase.GenerateUniqueAssetPath(folder + "/" + name + ".fbx");
            File.Copy(externalPath, destination);

            var sourceDir = Path.GetDirectoryName(externalPath) ?? "";
            var textureDirs = new[] { sourceDir, Path.Combine(sourceDir, "textures"), Path.Combine(sourceDir, "Textures"), Path.Combine(sourceDir, "tex") }
                .Where(Directory.Exists).Distinct(StringComparer.OrdinalIgnoreCase);
            int copied = 0;
            foreach (var dir in textureDirs)
            foreach (var file in Directory.GetFiles(dir).Where(f => TextureExtensions.Contains(Path.GetExtension(f).ToLowerInvariant())))
            {
                var target = folder + "/" + Path.GetFileName(file);
                if (File.Exists(target)) continue;
                File.Copy(file, target);
                copied++;
            }

            AssetDatabase.Refresh();
            log.Success("Copied \"" + Path.GetFileName(externalPath) + "\" into the project as " + destination +
                        (copied > 0 ? " (plus " + AvatarPaths.Plural(copied, "texture") + ")." : "."));
            return AssetDatabase.LoadAssetAtPath<GameObject>(destination);
        }

        static void EnsureFolder(string assetFolder)
        {
            var parts = assetFolder.Split('/');
            var current = parts[0];
            for (int i = 1; i < parts.Length; i++)
            {
                var next = current + "/" + parts[i];
                if (!AssetDatabase.IsValidFolder(next)) AssetDatabase.CreateFolder(current, parts[i]);
                current = next;
            }
        }
    }
}
