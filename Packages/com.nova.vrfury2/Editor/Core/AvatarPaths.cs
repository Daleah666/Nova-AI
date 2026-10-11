using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace Nova.VRFury2
{
    /// <summary>Hierarchy and naming helpers shared by every step.</summary>
    public static class AvatarPaths
    {
        /// <summary>Path of <paramref name="t"/> relative to <paramref name="root"/>, e.g. "Armature/Hips/Spine". The root itself is "".</summary>
        public static string GetPath(Transform root, Transform t)
        {
            if (t == root) return "";
            var parts = new List<string>();
            for (var cur = t; cur != null && cur != root; cur = cur.parent)
                parts.Add(cur.name);
            parts.Reverse();
            return string.Join("/", parts);
        }

        public static Dictionary<string, Transform> BuildPathMap(Transform root)
        {
            var map = new Dictionary<string, Transform>();
            foreach (var t in root.GetComponentsInChildren<Transform>(true))
            {
                var path = GetPath(root, t);
                if (!map.ContainsKey(path)) map.Add(path, t);
            }
            return map;
        }

        public static bool IsInHierarchy(Transform root, Transform t)
        {
            for (var cur = t; cur != null; cur = cur.parent)
                if (cur == root) return true;
            return false;
        }

        /// <summary>
        /// Lowercase, full-width characters folded to ASCII (MMD names use full-width digits),
        /// and separators removed, so "Upper_Arm.L", "upperarm l" and "UpperArm_L" compare equal.
        /// </summary>
        public static string Normalize(string name)
        {
            if (string.IsNullOrEmpty(name)) return "";
            var folded = name.Normalize(NormalizationForm.FormKC).ToLowerInvariant();
            var sb = new StringBuilder(folded.Length);
            foreach (var c in folded)
            {
                if (c == ' ' || c == '_' || c == '.' || c == '-' || c == ':' || c == '|') continue;
                sb.Append(c);
            }
            return sb.ToString();
        }

        /// <summary>
        /// Model asset (FBX) this scene object ultimately comes from, or null. Follows prefab variants
        /// ("MyAvatar.prefab" based on "MyAvatar.fbx") down to the FBX.
        /// </summary>
        public static GameObject GetSourceModel(GameObject sceneObject)
        {
            var path = GetSourceModelPath(sceneObject);
            return path == null ? null : AssetDatabase.LoadAssetAtPath<GameObject>(path);
        }

        public static string GetSourceModelPath(GameObject sceneObject)
        {
            if (sceneObject == null || !PrefabUtility.IsPartOfPrefabInstance(sceneObject)) return null;
            var source = PrefabUtility.GetCorrespondingObjectFromOriginalSource(sceneObject);
            var path = source != null ? AssetDatabase.GetAssetPath(source) : null;
            if (string.IsNullOrEmpty(path) || !(AssetImporter.GetAtPath(path) is ModelImporter)) return null;
            return path;
        }

        public static string SafeFileName(string name)
        {
            var invalid = System.IO.Path.GetInvalidFileNameChars();
            var sb = new StringBuilder();
            foreach (var c in name) sb.Append(System.Array.IndexOf(invalid, c) >= 0 ? '_' : c);
            var result = sb.ToString().Trim();
            return string.IsNullOrEmpty(result) ? "Avatar" : result;
        }

        public static string Plural(int count, string word) =>
            count.ToString(CultureInfo.InvariantCulture) + " " + word + (count == 1 ? "" : "s");
    }
}
