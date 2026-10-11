using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Nova.VRFury2
{
    /// <summary>
    /// Switches plain Unity "Standard" materials to the best avatar shader that's installed and fills in
    /// textures by name. Materials that already use another shader are left alone.
    /// </summary>
    public static class MaterialSetup
    {
        enum Family { Poiyomi, LilToon, ToonStandard, ToonLit }

        sealed class Target
        {
            public Family Family;
            public Shader Shader;
            public Shader Cutout;
            public Shader Transparent;
            public string DisplayName;
        }

        static readonly string[] PoiyomiShaders =
        {
            ".poiyomi/Poiyomi Toon", ".poiyomi/Poiyomi 9.0/Poiyomi Toon", ".poiyomi/Poiyomi 8.1/Poiyomi Toon",
            ".poiyomi/Poiyomi 8.0/Poiyomi Toon", ".poiyomi/Poiyomi Pro",
        };

        static readonly string[] AlbedoTokens = { "albedo", "basecolor", "basecolour", "diffuse", "color", "colour", "col", "main", "base", "tex", "d" };
        static readonly string[] NormalTokens = { "normal", "normalmap", "nrm", "nor", "norm", "n", "bump" };
        static readonly string[] EmissionTokens = { "emission", "emissive", "emit", "glow", "e" };
        static readonly string[] OtherTokens = { "mask", "rough", "roughness", "metal", "metallic", "metalness", "spec", "specular", "ao", "occlusion", "height", "disp", "displacement", "matcap", "opacity", "alpha", "orm", "smoothness", "gloss", "outline", "shadow" };

        public static bool IsStandardLike(Shader shader)
        {
            if (shader == null) return true;
            var n = shader.name;
            return n == "Standard" || n == "Standard (Specular setup)" || n == "Autodesk Interactive" ||
                   n.StartsWith("Legacy Shaders/") || n == "Hidden/InternalErrorShader";
        }

        static Target FindTarget()
        {
            foreach (var name in PoiyomiShaders)
            {
                var s = Shader.Find(name);
                if (s != null) return new Target { Family = Family.Poiyomi, Shader = s, DisplayName = "Poiyomi Toon" };
            }
            var lil = Shader.Find("lilToon");
            if (lil != null)
                return new Target
                {
                    Family = Family.LilToon, Shader = lil, DisplayName = "lilToon",
                    Cutout = Shader.Find("Hidden/lilToonCutout"), Transparent = Shader.Find("Hidden/lilToonTransparent"),
                };
            var toonStandard = Shader.Find("VRChat/Mobile/Toon Standard");
            if (toonStandard != null) return new Target { Family = Family.ToonStandard, Shader = toonStandard, DisplayName = "VRChat Toon Standard" };
            var toonLit = Shader.Find("VRChat/Mobile/Toon Lit");
            if (toonLit != null) return new Target { Family = Family.ToonLit, Shader = toonLit, DisplayName = "VRChat Toon Lit" };
            return null;
        }

        public static void Run(GameObject root, string modelAssetPath, AutopilotLog log)
        {
            log.Step("Materials & shaders");
            var target = FindTarget();
            if (target == null)
            {
                log.Warning("No avatar shader found (Poiyomi, lilToon or the VRChat SDK's Toon shaders). Materials were left as they are.");
                return;
            }

            var renderers = root.GetComponentsInChildren<Renderer>(true);
            var materials = new List<Material>();
            foreach (var r in renderers)
            {
                var shared = r.sharedMaterials;
                for (int i = 0; i < shared.Length; i++)
                {
                    if (shared[i] == null)
                        log.Warning("\"" + r.name + "\" has an empty material slot (#" + (i + 1) + "). It will show up pink or invisible in game.", r);
                    else if (!materials.Contains(shared[i]))
                        materials.Add(shared[i]);
                }
            }

            var textures = FindTextures(modelAssetPath);
            int converted = 0, kept = 0;
            var notEditable = new List<string>();

            foreach (var mat in materials)
            {
                if (!IsStandardLike(mat.shader))
                {
                    kept++;
                    continue;
                }
                var path = AssetDatabase.GetAssetPath(mat);
                if (string.IsNullOrEmpty(path) || !path.EndsWith(".mat", System.StringComparison.OrdinalIgnoreCase))
                {
                    notEditable.Add(mat.name);
                    continue;
                }
                Convert(mat, target, textures, log);
                converted++;
            }

            if (converted > 0)
                log.Success("Switched " + AvatarPaths.Plural(converted, "material") + " to " + target.DisplayName + ".");
            if (kept > 0)
                log.Info("Kept " + AvatarPaths.Plural(kept, "material") + " that already use a custom shader.");
            if (notEditable.Count > 0)
                log.Warning("These materials are still inside the FBX and can't be edited: " + string.Join(", ", notEditable) +
                            ". Run Import & Rig again, or use the FBX's Materials tab > Extract Materials.");
            if (target.Family == Family.ToonLit || target.Family == Family.ToonStandard)
                log.Info("Tip: install Poiyomi Toon or lilToon (both free) and run again for nicer-looking materials.");
            AssetDatabase.SaveAssets();
        }

        static void Convert(Material mat, Target target, List<Texture2D> textures, AutopilotLog log)
        {
            var mainTex = GetTex(mat, "_MainTex");
            var color = mat.HasProperty("_Color") ? mat.GetColor("_Color") : Color.white;
            var bump = GetTex(mat, "_BumpMap");
            var emissionMap = GetTex(mat, "_EmissionMap");
            var emissionColor = mat.HasProperty("_EmissionColor") ? mat.GetColor("_EmissionColor") : Color.black;
            bool emissionOn = mat.IsKeywordEnabled("_EMISSION") && (emissionMap != null || emissionColor.maxColorComponent > 0.001f);
            int mode = mat.HasProperty("_Mode") ? Mathf.RoundToInt(mat.GetFloat("_Mode")) : 0;
            float cutoff = mat.HasProperty("_Cutoff") ? mat.GetFloat("_Cutoff") : 0.5f;

            if (mainTex == null) mainTex = MatchTexture(mat.name, textures, AlbedoTokens, true);
            if (bump == null) bump = MatchTexture(mat.name, textures, NormalTokens, false);
            if (emissionMap == null && !emissionOn)
            {
                emissionMap = MatchTexture(mat.name, textures, EmissionTokens, false);
                if (emissionMap != null)
                {
                    emissionOn = true;
                    emissionColor = Color.white;
                }
            }
            if (bump != null) EnsureNormalMapImport(bump);

            Undo.RecordObject(mat, "VRFury 2.0 materials");
            var shader = target.Shader;
            if (target.Family == Family.LilToon)
            {
                if (mode == 1 && target.Cutout != null) shader = target.Cutout;
                else if (mode >= 2 && target.Transparent != null) shader = target.Transparent;
            }
            mat.shader = shader;

            SetTex(mat, "_MainTex", mainTex);
            SetColor(mat, "_Color", color);

            if (target.Family != Family.ToonLit)
            {
                SetTex(mat, "_BumpMap", bump);
                if (bump != null)
                {
                    SetFloat(mat, "_UseBumpMap", 1f);
                    if (target.Family == Family.ToonStandard) mat.EnableKeyword("USE_NORMAL_MAPS");
                }
                if (emissionOn)
                {
                    SetTex(mat, "_EmissionMap", emissionMap);
                    SetColor(mat, "_EmissionColor", emissionColor);
                    SetFloat(mat, "_EnableEmission", 1f);
                    SetFloat(mat, "_UseEmission", 1f);
                }
                SetFloat(mat, "_Cutoff", cutoff);
            }

            if (mode == 1 && target.Family == Family.Poiyomi)
            {
                SetFloat(mat, "_Mode", 1f);
                mat.renderQueue = 2450;
            }
            if (mode >= 1 && (target.Family != Family.LilToon || (mode == 1 ? target.Cutout : target.Transparent) == null))
                log.Warning("\"" + mat.name + "\" used see-through settings in the FBX. Open it and check its rendering/transparency mode looks right.", mat);

            EditorUtility.SetDirty(mat);
        }

        static Texture GetTex(Material m, string prop) => m.HasProperty(prop) ? m.GetTexture(prop) : null;

        static void SetTex(Material m, string prop, Texture t)
        {
            if (t != null && m.HasProperty(prop)) m.SetTexture(prop, t);
        }

        static void SetColor(Material m, string prop, Color c)
        {
            if (m.HasProperty(prop)) m.SetColor(prop, c);
        }

        static void SetFloat(Material m, string prop, float v)
        {
            if (m.HasProperty(prop)) m.SetFloat(prop, v);
        }

        static void EnsureNormalMapImport(Texture tex)
        {
            var importer = AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(tex)) as TextureImporter;
            if (importer == null || importer.textureType == TextureImporterType.NormalMap) return;
            importer.textureType = TextureImporterType.NormalMap;
            importer.SaveAndReimport();
        }

        static List<Texture2D> FindTextures(string modelAssetPath)
        {
            var list = new List<Texture2D>();
            if (string.IsNullOrEmpty(modelAssetPath)) return list;
            var folder = Path.GetDirectoryName(modelAssetPath)?.Replace('\\', '/');
            if (string.IsNullOrEmpty(folder) || !AssetDatabase.IsValidFolder(folder)) return list;
            foreach (var guid in AssetDatabase.FindAssets("t:Texture2D", new[] { folder }))
            {
                var tex = AssetDatabase.LoadAssetAtPath<Texture2D>(AssetDatabase.GUIDToAssetPath(guid));
                if (tex != null) list.Add(tex);
            }
            return list;
        }

        static string[] Tokens(string name) =>
            System.Text.RegularExpressions.Regex.Split(name.ToLowerInvariant(), @"[^a-z0-9]+|(?<=[a-z])(?=[0-9])")
                .Where(t => t.Length > 0).ToArray();

        /// <summary>Texture whose name contains the material name and a role word ("Body_Normal" for material "Body").</summary>
        static Texture2D MatchTexture(string materialName, List<Texture2D> textures, string[] roleTokens, bool allowNoRoleToken)
        {
            var matKey = AvatarPaths.Normalize(materialName);
            if (matKey.Length < 2) return null;

            Texture2D best = null;
            int bestScore = 0;
            foreach (var tex in textures)
            {
                var texKey = AvatarPaths.Normalize(tex.name);
                if (!texKey.Contains(matKey)) continue;
                var tokens = Tokens(tex.name.Replace(materialName, " "));
                bool hasRole = tokens.Any(roleTokens.Contains);
                bool otherRole = tokens.Any(t => OtherTokens.Contains(t)) ||
                                 (roleTokens != NormalTokens && tokens.Any(NormalTokens.Contains)) ||
                                 (roleTokens != EmissionTokens && tokens.Any(EmissionTokens.Contains) && !hasRole);
                if (otherRole) continue;
                int score = hasRole ? 2 : allowNoRoleToken ? 1 : 0;
                if (score == 0) continue;
                if (texKey == matKey) score += 1;
                if (score > bestScore)
                {
                    best = tex;
                    bestScore = score;
                }
            }
            return best;
        }
    }
}
