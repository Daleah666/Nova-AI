using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEngine;

namespace Nova.VRFury2
{
    /// <summary>
    /// Sets up the FBX's import settings for VRChat: Humanoid rig, blendshapes, readable meshes,
    /// materials extracted to editable .mat files. Only import settings change; the FBX file is never edited.
    /// </summary>
    public static class FbxImportConfigurator
    {
        public sealed class Result
        {
            public bool Ok;
            public string AssetPath;
            public GameObject Model;
            public Avatar Avatar;
        }

        const string LegacyBlendShapeNormalsProperty = "legacyComputeAllNormalsFromSmoothingGroupsWhenMeshHasBlendShapes";

        static PropertyInfo LegacyBlendShapeNormals =>
            typeof(ModelImporter).GetProperty(LegacyBlendShapeNormalsProperty, BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);

        public static bool IsModelAsset(Object asset) =>
            asset != null && AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(asset)) is ModelImporter;

        public static Result Run(GameObject fbx, AutopilotLog log)
        {
            var result = new Result();
            log.Step("Import & Rig");

            var path = AssetDatabase.GetAssetPath(fbx);
            if (!(AssetImporter.GetAtPath(path) is ModelImporter importer))
            {
                log.Error("That file isn't a 3D model (FBX). Drag the .fbx file from the Project window.", fbx);
                return result;
            }
            result.AssetPath = path;

            if (ApplyImportSettings(importer, log))
            {
                importer.SaveAndReimport();
                log.Success("Updated the FBX import settings (Humanoid rig, blendshapes, Read/Write).", fbx);
            }
            else
            {
                log.Info("FBX import settings were already correct.", fbx);
            }

            ExtractMaterials(path, log);
            EnsureHumanoid(path, log);

            result.Model = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            result.Avatar = LoadAvatar(path);
            result.Ok = result.Model != null && result.Avatar != null && result.Avatar.isValid && result.Avatar.isHuman;
            if (result.Ok)
                log.Success("The rig is a valid Humanoid.", result.Avatar);
            return result;
        }

        /// <summary>Returns true if anything changed (caller reimports).</summary>
        public static bool ApplyImportSettings(ModelImporter importer, AutopilotLog log)
        {
            bool changed = false;

            if (importer.animationType != ModelImporterAnimationType.Human)
            {
                importer.animationType = ModelImporterAnimationType.Human;
                importer.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
                changed = true;
            }
            else if (importer.avatarSetup == ModelImporterAvatarSetup.NoAvatar ||
                     (importer.avatarSetup == ModelImporterAvatarSetup.CopyFromOther && importer.sourceAvatar == null))
            {
                importer.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
                changed = true;
            }

            if (!importer.importBlendShapes)
            {
                importer.importBlendShapes = true;
                changed = true;
            }
            if (!importer.isReadable)
            {
                importer.isReadable = true;
                changed = true;
            }
            if (importer.optimizeGameObjects)
            {
                // PhysBones, contacts and add-ons need the bone GameObjects to exist.
                importer.optimizeGameObjects = false;
                changed = true;
            }
            if (importer.importCameras || importer.importLights)
            {
                importer.importCameras = false;
                importer.importLights = false;
                changed = true;
            }
            if (importer.materialImportMode == ModelImporterMaterialImportMode.None)
            {
                importer.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
                changed = true;
            }
            if (NeedsLegacyBlendShapeNormals(importer))
            {
                LegacyBlendShapeNormals.SetValue(importer, true);
                changed = true;
            }
            return changed;
        }

        /// <summary>The VRChat SDK refuses to upload meshes with Calculate blendshape normals unless "Legacy Blendshape Normals" is on.</summary>
        public static bool NeedsLegacyBlendShapeNormals(ModelImporter importer)
        {
            if (importer.importBlendShapeNormals != ModelImporterNormals.Calculate) return false;
            var prop = LegacyBlendShapeNormals;
            return prop != null && !(bool)prop.GetValue(importer);
        }

        public static Avatar LoadAvatar(string path) =>
            AssetDatabase.LoadAllAssetsAtPath(path).OfType<Avatar>().FirstOrDefault();

        static void ExtractMaterials(string path, AutopilotLog log)
        {
            var importer = (ModelImporter)AssetImporter.GetAtPath(path);
            if (importer.materialLocation != ModelImporterMaterialLocation.InPrefab)
            {
                log.Info("Materials already live outside the FBX.");
                return;
            }

            var subAssets = AssetDatabase.LoadAllAssetsAtPath(path);
            var dir = Path.GetDirectoryName(path)?.Replace('\\', '/') ?? "Assets";
            var modelName = Path.GetFileNameWithoutExtension(path);

            if (subAssets.OfType<Texture>().Any())
            {
                var texFolder = EnsureFolder(dir, modelName + " Textures");
                if (importer.ExtractTextures(texFolder))
                {
                    AssetDatabase.Refresh();
                    AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
                    log.Success("Extracted embedded textures to " + texFolder + ".");
                    subAssets = AssetDatabase.LoadAllAssetsAtPath(path);
                    importer = (ModelImporter)AssetImporter.GetAtPath(path);
                }
            }

            var embedded = subAssets.OfType<Material>().Where(m => AssetDatabase.IsSubAsset(m)).ToList();
            if (embedded.Count == 0) return;

            var folder = EnsureFolder(dir, modelName + " Materials");
            int extracted = 0, reused = 0;
            var errors = new List<string>();
            bool remapped = false;

            AssetDatabase.StartAssetEditing();
            try
            {
                foreach (var mat in embedded)
                {
                    var target = folder + "/" + AvatarPaths.SafeFileName(mat.name) + ".mat";
                    var existing = AssetDatabase.LoadAssetAtPath<Material>(target);
                    if (existing != null)
                    {
                        // Re-import of an updated FBX: keep the material the user already edited.
                        importer.AddRemap(new AssetImporter.SourceAssetIdentifier(mat), existing);
                        remapped = true;
                        reused++;
                        continue;
                    }
                    var error = AssetDatabase.ExtractAsset(mat, target);
                    if (string.IsNullOrEmpty(error)) extracted++;
                    else errors.Add(mat.name + ": " + error);
                }
            }
            finally
            {
                AssetDatabase.StopAssetEditing();
            }

            if (remapped) EditorUtility.SetDirty(importer);
            AssetDatabase.WriteImportSettingsIfDirty(path);
            AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);

            if (extracted > 0) log.Success("Extracted " + AvatarPaths.Plural(extracted, "material") + " to " + folder + " so they can be edited.");
            if (reused > 0) log.Info("Reused " + AvatarPaths.Plural(reused, "existing material") + " from " + folder + ".");
            foreach (var e in errors) log.Warning("Couldn't extract material " + e);
        }

        static string EnsureFolder(string parent, string name)
        {
            var path = parent + "/" + name;
            if (!AssetDatabase.IsValidFolder(path)) AssetDatabase.CreateFolder(parent, name);
            return path;
        }

        static void EnsureHumanoid(string path, AutopilotLog log)
        {
            var importer = (ModelImporter)AssetImporter.GetAtPath(path);
            var avatar = LoadAvatar(path);
            bool valid = avatar != null && avatar.isValid && avatar.isHuman;

            if (!valid && importer.avatarSetup == ModelImporterAvatarSetup.CreateFromThisModel)
            {
                var model = AssetDatabase.LoadAssetAtPath<GameObject>(path);
                var mapping = HumanoidBoneMapper.Map(model.transform);
                log.Info("Unity couldn't map the bones by itself. Best matching bone-name preset: " + mapping.PresetName + ".");
                importer.humanDescription = HumanoidBoneMapper.BuildDescription(importer.humanDescription, model.transform, mapping);
                importer.SaveAndReimport();

                avatar = LoadAvatar(path);
                valid = avatar != null && avatar.isValid && avatar.isHuman;
                foreach (var dup in mapping.DuplicateNames)
                    log.Warning("More than one bone is named \"" + dup + "\". Humanoid bones need unique names; rename it in Blender if the rig looks wrong.");
                if (!valid)
                {
                    var missing = mapping.MissingRequired.Count > 0
                        ? string.Join(", ", mapping.MissingRequired.Select(b => ObjectNames.NicifyVariableName(b.ToString())))
                        : "none found by name, but Unity still rejected the rig";
                    log.Error("The rig couldn't be set up as Humanoid. Missing bones: " + missing +
                              ". Open the FBX's Rig tab > Configure... to assign them by hand, then run again.", importer);
                    return;
                }
                log.Success("Mapped the bones using the " + mapping.PresetName + " preset.");
            }
            else if (!valid)
            {
                log.Error("The rig isn't a valid Humanoid. Open the FBX's Rig tab and check the Avatar settings.", importer);
                return;
            }

            RemoveSuspiciousJaw(importer, path, log);
        }

        /// <summary>Unity's auto-mapper often picks a hair or face bone as "Jaw", which makes the mouth or hair twitch in game.</summary>
        static void RemoveSuspiciousJaw(ModelImporter importer, string path, AutopilotLog log)
        {
            if (importer.avatarSetup != ModelImporterAvatarSetup.CreateFromThisModel) return;
            var desc = importer.humanDescription;
            if (desc.human == null) return;
            int jawIndex = System.Array.FindIndex(desc.human, h => h.humanName == "Jaw");
            if (jawIndex < 0) return;

            var boneName = desc.human[jawIndex].boneName ?? "";
            var lower = boneName.ToLowerInvariant();
            if (lower.Contains("jaw") || boneName.Contains("顎") || boneName.Contains("あご")) return;

            desc.human = desc.human.Where((_, i) => i != jawIndex).ToArray();
            importer.humanDescription = desc;
            importer.SaveAndReimport();
            var avatar = LoadAvatar(path);
            if (avatar != null && avatar.isValid)
                log.Info("Removed the Humanoid \"Jaw\" mapping (\"" + boneName + "\" doesn't look like a jaw bone).");
        }
    }
}
