using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;
using VRC.Core;
using VRC.SDK3.Avatars.Components;
using Object = UnityEngine.Object;
using EyeRotations = VRC.SDK3.Avatars.Components.VRCAvatarDescriptor.CustomEyeLookSettings.EyeRotations;

namespace Nova.VRFury2
{
    /// <summary>
    /// Update mode: copies everything you set up on the old avatar onto a fresh copy of the new FBX.
    /// Components are matched by bone path (then Humanoid bone, then unique name), object references are
    /// pointed at the new hierarchy, and the old avatar is kept, disabled, as a backup.
    /// </summary>
    public sealed class SetupMigrator
    {
        readonly GameObject _oldRoot;
        readonly GameObject _newRoot;
        readonly AutopilotLog _log;
        readonly string _oldModelPath;

        readonly Dictionary<Transform, Transform> _transforms = new Dictionary<Transform, Transform>();
        readonly Dictionary<Component, Component> _components = new Dictionary<Component, Component>();
        readonly HashSet<Transform> _fromModel = new HashSet<Transform>();
        readonly List<Component> _toRemap = new List<Component>();
        readonly List<string> _lostReferences = new List<string>();

        int _copiedComponents, _copiedAddOns, _renderers, _boneTweaks;

        static readonly HashSet<string> SkippedProperties = new HashSet<string>
        {
            "m_GameObject", "m_Script", "m_PrefabInstance", "m_PrefabAsset", "m_CorrespondingSourceObject",
            "m_PrefabParentObject", "m_PrefabInternal", "m_Father", "m_Children",
        };

        SetupMigrator(GameObject oldRoot, GameObject newRoot, AutopilotLog log)
        {
            _oldRoot = oldRoot;
            _newRoot = newRoot;
            _log = log;
            _oldModelPath = AvatarPaths.GetSourceModelPath(oldRoot);
        }

        public static bool Migrate(GameObject oldRoot, GameObject newRoot, AutopilotLog log)
        {
            log.Step("Copy setup from old avatar");
            if (oldRoot == null || newRoot == null) return false;
            if (oldRoot.GetComponent<VRCAvatarDescriptor>() == null)
                log.Warning("The old avatar has no Avatar Descriptor. Copying its components anyway.", oldRoot);

            var previousSelection = Selection.objects;
            try
            {
                new SetupMigrator(oldRoot, newRoot, log).Run();
                return true;
            }
            catch (Exception e)
            {
                log.Error("Copying from the old avatar stopped with an error: " + e.Message + " (details in the Console). Use Edit > Undo to go back.", oldRoot);
                Debug.LogException(e);
                return false;
            }
            finally
            {
                Selection.objects = previousSelection;
            }
        }

        void Run()
        {
            PlaceNewRoot();
            BuildTransformMap();
            CopyAddOns();
            CopyComponents();
            CopyRenderers();
            CopyBoneTweaks();
            RemapReferences();
            FixDescriptor();
            RetireOldAvatar();
            Report();
        }

        // ---------- Matching ----------

        bool IsFromOldModel(Transform t)
        {
            if (_oldModelPath == null) return false;
            var source = PrefabUtility.GetCorrespondingObjectFromOriginalSource(t);
            return source != null && AssetDatabase.GetAssetPath(source) == _oldModelPath;
        }

        bool IsModelComponent(Component c, Transform newTarget)
        {
            if (c is Transform) return true;
            if (_oldModelPath != null)
            {
                var source = PrefabUtility.GetCorrespondingObjectFromOriginalSource(c);
                return source != null && AssetDatabase.GetAssetPath(source) == _oldModelPath;
            }
            // Unpacked old avatar: treat FBX-style components as the model's own when the new FBX has the same kind.
            bool fbxKind = c is Animator || c is SkinnedMeshRenderer || c is MeshRenderer || c is MeshFilter;
            return fbxKind && newTarget != null && newTarget.GetComponent(c.GetType()) != null;
        }

        void PlaceNewRoot()
        {
            var oldT = _oldRoot.transform;
            var newT = _newRoot.transform;
            if (newT.parent != oldT.parent) Undo.SetTransformParent(newT, oldT.parent, false, "VRFury 2.0 place avatar");
            Undo.RecordObject(newT, "VRFury 2.0 place avatar");
            newT.SetSiblingIndex(oldT.GetSiblingIndex() + 1);
            newT.localPosition = oldT.localPosition;
            newT.localRotation = oldT.localRotation;
            newT.localScale = oldT.localScale;
            Undo.RecordObject(_newRoot, "VRFury 2.0 place avatar");
            _newRoot.name = _oldRoot.name;
            _newRoot.tag = _oldRoot.tag;
            _newRoot.layer = _oldRoot.layer;
        }

        void BuildTransformMap()
        {
            var oldRootT = _oldRoot.transform;
            var newRootT = _newRoot.transform;
            _transforms[oldRootT] = newRootT;

            var newByPath = AvatarPaths.BuildPathMap(newRootT);
            var newByName = newRootT.GetComponentsInChildren<Transform>(true).GroupBy(t => t.name).Where(g => g.Count() == 1)
                .ToDictionary(g => g.Key, g => g.First());
            var oldNameCounts = oldRootT.GetComponentsInChildren<Transform>(true).GroupBy(t => t.name).ToDictionary(g => g.Key, g => g.Count());

            var oldAnimator = _oldRoot.GetComponent<Animator>();
            var newAnimator = _newRoot.GetComponent<Animator>();
            var oldBones = new Dictionary<Transform, HumanBodyBones>();
            if (oldAnimator != null && oldAnimator.isHuman && newAnimator != null && newAnimator.isHuman)
                for (int i = 0; i < (int)HumanBodyBones.LastBone; i++)
                {
                    var b = oldAnimator.GetBoneTransform((HumanBodyBones)i);
                    if (b != null && !oldBones.ContainsKey(b)) oldBones.Add(b, (HumanBodyBones)i);
                }

            var used = new HashSet<Transform> { newRootT };
            foreach (var t in oldRootT.GetComponentsInChildren<Transform>(true))
            {
                if (t == oldRootT) continue;
                bool fromModel = _oldModelPath != null ? IsFromOldModel(t) : true;
                if (!fromModel) continue;

                Transform match = null;
                if (newByPath.TryGetValue(AvatarPaths.GetPath(oldRootT, t), out var byPath)) match = byPath;
                else if (oldBones.TryGetValue(t, out var bone)) match = newAnimator.GetBoneTransform(bone);
                else if (oldNameCounts.TryGetValue(t.name, out var c) && c == 1 && newByName.TryGetValue(t.name, out var byName)) match = byName;

                if (match != null && used.Add(match))
                {
                    _transforms[t] = match;
                    _fromModel.Add(t);
                }
                else if (_oldModelPath != null)
                {
                    _fromModel.Add(t);
                }
            }
        }

        // ---------- Add-ons (props, prefabs, extra objects) ----------

        void CopyAddOns()
        {
            var oldRootT = _oldRoot.transform;
            var addOnRoots = oldRootT.GetComponentsInChildren<Transform>(true)
                .Where(t => t != oldRootT && !_fromModel.Contains(t) && (t.parent == oldRootT || _fromModel.Contains(t.parent)))
                .ToList();

            foreach (var original in addOnRoots)
            {
                var parent = original.parent;
                bool exactParent = _transforms.ContainsKey(parent);
                var newParent = NearestMapped(parent);

                var copy = Duplicate(original.gameObject);
                Undo.SetTransformParent(copy.transform, newParent, false, "VRFury 2.0 copy add-on");
                Undo.RecordObject(copy.transform, "VRFury 2.0 copy add-on");
                if (exactParent)
                {
                    copy.transform.localPosition = original.localPosition;
                    copy.transform.localRotation = original.localRotation;
                    copy.transform.localScale = original.localScale;
                }
                else
                {
                    copy.transform.SetPositionAndRotation(original.position, original.rotation);
                    _log.Warning("\"" + original.name + "\" was attached to \"" + parent.name + "\", which isn't in the new FBX. It was attached to \"" +
                                 newParent.name + "\" instead; check its position.", copy);
                }
                copy.name = original.name;
                copy.SetActive(original.gameObject.activeSelf);
                if (_oldModelPath == null && HasModelMesh(original))
                    _log.Warning("Copied \"" + original.name + "\" from the old avatar because the new FBX has nothing with that name. " +
                                 "If it's a part of the old FBX you renamed or removed, delete the copy.", copy);

                var oldTs = original.GetComponentsInChildren<Transform>(true);
                var newTs = copy.GetComponentsInChildren<Transform>(true);
                if (oldTs.Length != newTs.Length)
                {
                    _log.Warning("\"" + original.name + "\" didn't copy cleanly; check it on the new avatar.", copy);
                    continue;
                }
                for (int i = 0; i < oldTs.Length; i++)
                {
                    _transforms[oldTs[i]] = newTs[i];
                    var oldCs = oldTs[i].GetComponents<Component>();
                    var newCs = newTs[i].GetComponents<Component>();
                    for (int j = 0; j < Mathf.Min(oldCs.Length, newCs.Length); j++)
                    {
                        if (oldCs[j] == null || newCs[j] == null || oldCs[j].GetType() != newCs[j].GetType()) continue;
                        _components[oldCs[j]] = newCs[j];
                        if (!(newCs[j] is Transform)) _toRemap.Add(newCs[j]);
                    }
                    var missing = GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(oldTs[i].gameObject);
                    if (missing > 0)
                        _log.Warning("\"" + AvatarPaths.GetPath(oldRootT, oldTs[i]) + "\" has " + AvatarPaths.Plural(missing, "missing script") +
                                     ". Reinstall the tool/package it came from.", newTs[i]);
                }
                _copiedAddOns++;
            }
        }

        static bool HasModelMesh(Transform t)
        {
            foreach (var smr in t.GetComponentsInChildren<SkinnedMeshRenderer>(true))
                if (smr.sharedMesh != null && AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(smr.sharedMesh)) is ModelImporter)
                    return true;
            foreach (var mf in t.GetComponentsInChildren<MeshFilter>(true))
                if (mf.sharedMesh != null && AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(mf.sharedMesh)) is ModelImporter)
                    return true;
            return false;
        }

        Transform NearestMapped(Transform oldT)
        {
            for (var cur = oldT; cur != null; cur = cur.parent)
                if (_transforms.TryGetValue(cur, out var mapped)) return mapped;
            return _newRoot.transform;
        }

        static GameObject Duplicate(GameObject original)
        {
            try
            {
                Selection.objects = new Object[] { original };
                Unsupported.DuplicateGameObjectsUsingPasteboard();
                var duplicate = Selection.activeGameObject;
                if (duplicate != null && duplicate != original && duplicate.transform.parent == original.transform.parent)
                    return duplicate;
            }
            catch (Exception e)
            {
                Debug.LogWarning("[VRFury 2.0] Duplicate via pasteboard failed, using Instantiate: " + e.Message);
            }

            // Fallback keeps the objects but not their prefab link.
            var copy = Object.Instantiate(original, original.transform.parent);
            Undo.RegisterCreatedObjectUndo(copy, "VRFury 2.0 copy add-on");
            return copy;
        }

        // ---------- Components on FBX objects ----------

        void CopyComponents()
        {
            var oldRootT = _oldRoot.transform;
            foreach (var t in oldRootT.GetComponentsInChildren<Transform>(true))
            {
                if (!_fromModel.Contains(t)) continue;
                _transforms.TryGetValue(t, out var target);
                var comps = t.GetComponents<Component>();

                var userComps = comps.Where(c => c != null && !IsModelComponent(c, target)).ToList();
                var missing = comps.Count(c => c == null);
                var path = t == oldRootT ? "(avatar root)" : AvatarPaths.GetPath(oldRootT, t);

                if (missing > 0)
                    _log.Warning("\"" + path + "\" has " + AvatarPaths.Plural(missing, "missing script") +
                                 " on the old avatar. Those can't be copied; reinstall the tool/package they came from.", t);
                if (userComps.Count == 0) continue;

                if (target == null)
                {
                    _log.Warning("\"" + path + "\" isn't in the new FBX, so its " +
                                 string.Join(", ", userComps.Select(c => ObjectNames.NicifyVariableName(c.GetType().Name))) +
                                 " couldn't be copied.", t);
                    continue;
                }

                foreach (var comp in userComps)
                {
                    var type = comp.GetType();
                    var index = IndexOfType(comp);
                    var dest = NthOfType(target.gameObject, type, index);
                    if (dest == null)
                    {
                        try
                        {
                            dest = Undo.AddComponent(target.gameObject, type);
                        }
                        catch (Exception e)
                        {
                            Debug.LogException(e);
                        }
                    }
                    if (dest == null)
                    {
                        _log.Warning("Couldn't add " + ObjectNames.NicifyVariableName(type.Name) + " to \"" + target.name + "\".", target);
                        continue;
                    }

                    Undo.RecordObject(dest, "VRFury 2.0 copy component");
                    EditorUtility.CopySerialized(comp, dest);
                    PrefabUtility.RecordPrefabInstancePropertyModifications(dest);
                    _components[comp] = dest;
                    _toRemap.Add(dest);
                    _copiedComponents++;
                }
            }
        }

        static int IndexOfType(Component c) =>
            Array.IndexOf(c.GetComponents(c.GetType()).Where(x => x.GetType() == c.GetType()).ToArray(), c);

        static Component NthOfType(GameObject go, Type type, int n)
        {
            if (n < 0) return null;
            var list = go.GetComponents(type).Where(x => x.GetType() == type).ToArray();
            return n < list.Length ? list[n] : null;
        }

        // ---------- Renderers: materials, blendshapes, visibility ----------

        void CopyRenderers()
        {
            foreach (var pair in _transforms.ToList())
            {
                var oldT = pair.Key;
                var newT = pair.Value;
                if (!_fromModel.Contains(oldT) && oldT != _oldRoot.transform) continue;

                if (oldT != _oldRoot.transform && newT.gameObject.activeSelf != oldT.gameObject.activeSelf)
                {
                    Undo.RecordObject(newT.gameObject, "VRFury 2.0 copy visibility");
                    newT.gameObject.SetActive(oldT.gameObject.activeSelf);
                }
                if (oldT != _oldRoot.transform && (newT.gameObject.tag != oldT.gameObject.tag || newT.gameObject.layer != oldT.gameObject.layer))
                {
                    Undo.RecordObject(newT.gameObject, "VRFury 2.0 copy tag");
                    newT.gameObject.tag = oldT.gameObject.tag;
                    newT.gameObject.layer = oldT.gameObject.layer;
                }

                var oldR = oldT.GetComponent<Renderer>();
                var newR = newT.GetComponent<Renderer>();
                if (oldR == null || newR == null || oldR.GetType() != newR.GetType()) continue;
                _components[oldR] = newR;

                Undo.RecordObject(newR, "VRFury 2.0 copy renderer");
                CopyMaterials(oldR, newR);
                newR.enabled = oldR.enabled;
                newR.shadowCastingMode = oldR.shadowCastingMode;
                newR.receiveShadows = oldR.receiveShadows;
                newR.lightProbeUsage = oldR.lightProbeUsage;
                newR.reflectionProbeUsage = oldR.reflectionProbeUsage;
                newR.allowOcclusionWhenDynamic = oldR.allowOcclusionWhenDynamic;
                if (oldR.probeAnchor != null) newR.probeAnchor = MapTransform(oldR.probeAnchor) ?? newR.probeAnchor;

                if (oldR is SkinnedMeshRenderer oldS && newR is SkinnedMeshRenderer newS)
                {
                    newS.updateWhenOffscreen = oldS.updateWhenOffscreen;
                    newS.quality = oldS.quality;
                    newS.skinnedMotionVectors = oldS.skinnedMotionVectors;
                    CopyBlendShapes(oldS, newS);
                    var sourceS = PrefabUtility.GetCorrespondingObjectFromOriginalSource(oldS);
                    if (sourceS != null && !BoundsEqual(sourceS.localBounds, oldS.localBounds))
                        newS.localBounds = oldS.localBounds;
                }
                PrefabUtility.RecordPrefabInstancePropertyModifications(newR);
                _renderers++;
            }
        }

        void CopyMaterials(Renderer oldR, Renderer newR)
        {
            var oldMats = oldR.sharedMaterials;
            var newMats = newR.sharedMaterials;
            var source = PrefabUtility.GetCorrespondingObjectFromOriginalSource(oldR);
            var oldSlotNames = (source != null ? source.sharedMaterials : oldMats).Select(m => m != null ? m.name : null).ToArray();

            bool changed = false;
            var unmatched = new List<string>();
            for (int j = 0; j < newMats.Length; j++)
            {
                var slotName = newMats[j] != null ? newMats[j].name : null;
                int i = slotName != null ? Array.IndexOf(oldSlotNames, slotName) : -1;
                if (i < 0 && oldMats.Length == newMats.Length) i = j;
                if (i >= 0 && i < oldMats.Length && oldMats[i] != null)
                {
                    if (newMats[j] != oldMats[i])
                    {
                        newMats[j] = oldMats[i];
                        changed = true;
                    }
                }
                else
                {
                    unmatched.Add(slotName ?? ("slot " + (j + 1)));
                }
            }
            if (changed) newR.sharedMaterials = newMats;
            if (unmatched.Count > 0)
                _log.Info("\"" + newR.name + "\": new material slot(s) " + string.Join(", ", unmatched) + " kept the FBX's material.", newR);
        }

        static void CopyBlendShapes(SkinnedMeshRenderer oldS, SkinnedMeshRenderer newS)
        {
            var oldMesh = oldS.sharedMesh;
            var newMesh = newS.sharedMesh;
            if (oldMesh == null || newMesh == null) return;
            for (int i = 0; i < oldMesh.blendShapeCount; i++)
            {
                var weight = oldS.GetBlendShapeWeight(i);
                var j = newMesh.GetBlendShapeIndex(oldMesh.GetBlendShapeName(i));
                if (j >= 0 && !Mathf.Approximately(newS.GetBlendShapeWeight(j), weight))
                    newS.SetBlendShapeWeight(j, weight);
            }
        }

        static bool BoundsEqual(Bounds a, Bounds b) =>
            (a.center - b.center).sqrMagnitude < 1e-8f && (a.extents - b.extents).sqrMagnitude < 1e-8f;

        // ---------- Bone adjustments ----------

        void CopyBoneTweaks()
        {
            if (_oldModelPath == null) return;
            foreach (var pair in _transforms)
            {
                var oldT = pair.Key;
                var newT = pair.Value;
                if (oldT == _oldRoot.transform || !_fromModel.Contains(oldT)) continue;
                var source = PrefabUtility.GetCorrespondingObjectFromOriginalSource(oldT);
                if (source == null) continue;

                var dp = oldT.localPosition - source.localPosition;
                var dr = Quaternion.Inverse(source.localRotation) * oldT.localRotation;
                var ds = new Vector3(SafeDiv(oldT.localScale.x, source.localScale.x), SafeDiv(oldT.localScale.y, source.localScale.y),
                    SafeDiv(oldT.localScale.z, source.localScale.z));

                bool moved = dp.sqrMagnitude > 1e-10f;
                bool rotated = Quaternion.Angle(Quaternion.identity, dr) > 0.01f;
                bool scaled = (ds - Vector3.one).sqrMagnitude > 1e-8f;
                if (!moved && !rotated && !scaled) continue;

                Undo.RecordObject(newT, "VRFury 2.0 copy bone adjustment");
                if (moved) newT.localPosition += dp;
                if (rotated) newT.localRotation *= dr;
                if (scaled) newT.localScale = Vector3.Scale(newT.localScale, ds);
                PrefabUtility.RecordPrefabInstancePropertyModifications(newT);
                _boneTweaks++;
            }
        }

        static float SafeDiv(float a, float b) => Mathf.Abs(b) < 1e-6f ? 1f : a / b;

        // ---------- Reference remapping ----------

        Transform MapTransform(Transform t) => t != null && _transforms.TryGetValue(t, out var m) ? m : null;

        bool TryMap(Object obj, out Object mapped)
        {
            mapped = null;
            switch (obj)
            {
                case GameObject go:
                    var t = MapTransform(go.transform);
                    if (t != null) mapped = t.gameObject;
                    break;
                case Transform tr:
                    mapped = MapTransform(tr);
                    break;
                case Component c:
                    if (_components.TryGetValue(c, out var mc)) mapped = mc;
                    else
                    {
                        var target = MapTransform(c.transform);
                        if (target != null) mapped = NthOfType(target.gameObject, c.GetType(), IndexOfType(c));
                    }
                    break;
            }
            return mapped != null;
        }

        bool IsInOldAvatar(Object obj)
        {
            Transform t = obj is GameObject go ? go.transform : obj is Component c ? c.transform : null;
            return t != null && AvatarPaths.IsInHierarchy(_oldRoot.transform, t);
        }

        void RemapReferences()
        {
            foreach (var comp in _toRemap)
            {
                if (comp == null) continue;
                var so = new SerializedObject(comp);
                var it = so.GetIterator();
                bool enterChildren = true;
                while (it.Next(enterChildren))
                {
                    enterChildren = ShouldEnter(it);
                    if (it.propertyType != SerializedPropertyType.ObjectReference || SkippedProperties.Contains(it.name)) continue;
                    var value = it.objectReferenceValue;
                    if (value == null || !IsInOldAvatar(value)) continue;

                    if (TryMap(value, out var mapped))
                    {
                        it.objectReferenceValue = mapped;
                    }
                    else
                    {
                        it.objectReferenceValue = null;
                        _lostReferences.Add(ObjectNames.NicifyVariableName(comp.GetType().Name) + " on \"" + comp.name + "\" → " +
                                            it.displayName + " (was \"" + value.name + "\")");
                    }
                }
                so.ApplyModifiedProperties();
            }
        }

        static bool ShouldEnter(SerializedProperty p)
        {
            if (p.propertyType == SerializedPropertyType.String) return false;
            if (!p.isArray || p.arraySize == 0) return true;
            switch (p.GetArrayElementAtIndex(0).propertyType)
            {
                case SerializedPropertyType.Integer:
                case SerializedPropertyType.Float:
                case SerializedPropertyType.Boolean:
                case SerializedPropertyType.Character:
                case SerializedPropertyType.String:
                case SerializedPropertyType.Enum:
                case SerializedPropertyType.Vector2:
                case SerializedPropertyType.Vector3:
                case SerializedPropertyType.Vector4:
                case SerializedPropertyType.Quaternion:
                case SerializedPropertyType.Color:
                    return false;
                default:
                    return true;
            }
        }

        // ---------- Avatar Descriptor fix-ups ----------

        void FixDescriptor()
        {
            var oldD = _oldRoot.GetComponent<VRCAvatarDescriptor>();
            var newD = _newRoot.GetComponent<VRCAvatarDescriptor>();
            if (oldD == null || newD == null) return;
            Undo.RecordObject(newD, "VRFury 2.0 fix descriptor");

            var oldAnimator = _oldRoot.GetComponent<Animator>();
            var newAnimator = _newRoot.GetComponent<Animator>();
            if (oldAnimator != null && newAnimator != null && oldAnimator.isHuman && newAnimator.isHuman)
            {
                var oldEyes = EyeMidpoint(oldAnimator);
                var newEyes = EyeMidpoint(newAnimator);
                if (oldEyes.HasValue && newEyes.HasValue)
                {
                    var delta = newEyes.Value - oldEyes.Value;
                    if (delta.magnitude > 0.005f)
                    {
                        newD.ViewPosition = oldD.ViewPosition + delta;
                        _log.Info("The eyes moved " + (delta.magnitude * 100f).ToString("0.0") + " cm in the new FBX, so the viewpoint moved with them.", newD);
                    }
                }
            }

            var oldS = oldD.customEyeLookSettings;
            var s = newD.customEyeLookSettings;
            s.eyesLookingStraight = RebaseEyes(oldS.eyesLookingStraight, oldS.leftEye, oldS.rightEye, s.leftEye, s.rightEye);
            s.eyesLookingUp = RebaseEyes(oldS.eyesLookingUp, oldS.leftEye, oldS.rightEye, s.leftEye, s.rightEye);
            s.eyesLookingDown = RebaseEyes(oldS.eyesLookingDown, oldS.leftEye, oldS.rightEye, s.leftEye, s.rightEye);
            s.eyesLookingLeft = RebaseEyes(oldS.eyesLookingLeft, oldS.leftEye, oldS.rightEye, s.leftEye, s.rightEye);
            s.eyesLookingRight = RebaseEyes(oldS.eyesLookingRight, oldS.leftEye, oldS.rightEye, s.leftEye, s.rightEye);

            if (s.eyelidType == VRCAvatarDescriptor.EyelidType.Blendshapes && oldS.eyelidsSkinnedMesh != null && s.eyelidsSkinnedMesh != null &&
                oldS.eyelidsBlendshapes != null)
            {
                var oldMesh = oldS.eyelidsSkinnedMesh.sharedMesh;
                var newMesh = s.eyelidsSkinnedMesh.sharedMesh;
                var remapped = new int[oldS.eyelidsBlendshapes.Length];
                for (int i = 0; i < remapped.Length; i++)
                {
                    var idx = oldS.eyelidsBlendshapes[i];
                    remapped[i] = -1;
                    if (oldMesh == null || newMesh == null || idx < 0 || idx >= oldMesh.blendShapeCount) continue;
                    var name = oldMesh.GetBlendShapeName(idx);
                    remapped[i] = newMesh.GetBlendShapeIndex(name);
                    if (remapped[i] < 0)
                        _log.Warning("Eyelid blendshape \"" + name + "\" isn't on the new mesh.", newD);
                }
                s.eyelidsBlendshapes = remapped;
            }
            newD.customEyeLookSettings = s;

            if (oldD.lipSyncJawBone != null && newD.lipSyncJawBone != null)
            {
                newD.lipSyncJawClosed = Rebase(oldD.lipSyncJawClosed, oldD.lipSyncJawBone, newD.lipSyncJawBone);
                newD.lipSyncJawOpen = Rebase(oldD.lipSyncJawOpen, oldD.lipSyncJawBone, newD.lipSyncJawBone);
            }

            EditorUtility.SetDirty(newD);
            PrefabUtility.RecordPrefabInstancePropertyModifications(newD);

            var pm = _newRoot.GetComponent<PipelineManager>();
            if (pm != null && !string.IsNullOrEmpty(pm.blueprintId))
                _log.Success("Kept the avatar's Blueprint ID (" + pm.blueprintId + "), so uploading updates your existing avatar instead of making a new one.", pm);
            else
                _log.Info("The old avatar had no Blueprint ID yet, so the first upload will create a new avatar.");
        }

        static Vector3? EyeMidpoint(Animator animator)
        {
            var root = animator.transform;
            var l = AvatarDescriptorBuilder.FindEye(animator, true);
            var r = AvatarDescriptorBuilder.FindEye(animator, false);
            Vector3 world;
            if (l != null && r != null) world = (l.position + r.position) * 0.5f;
            else
            {
                var head = animator.GetBoneTransform(HumanBodyBones.Head);
                if (head == null) return null;
                world = head.position;
            }
            return Quaternion.Inverse(root.rotation) * (world - root.position);
        }

        EyeRotations RebaseEyes(EyeRotations value, Transform oldL, Transform oldR, Transform newL, Transform newR)
        {
            if (value == null) return null;
            var l = oldL != null && newL != null ? Rebase(value.left, oldL, newL) : value.left;
            var r = oldR != null && newR != null ? Rebase(value.right, oldR, newR) : value.right;
            return new EyeRotations { linked = value.linked && Quaternion.Angle(l, r) < 0.01f, left = l, right = r };
        }

        /// <summary>
        /// Moves a stored local rotation from the old bone to the new one, keeping the same turn relative to the
        /// avatar (so "look up" still looks up even if the new FBX's bone axes differ).
        /// </summary>
        Quaternion Rebase(Quaternion value, Transform oldBone, Transform newBone)
        {
            var pOld = Quaternion.Inverse(_oldRoot.transform.rotation) * (oldBone.parent != null ? oldBone.parent.rotation : _oldRoot.transform.rotation);
            var pNew = Quaternion.Inverse(_newRoot.transform.rotation) * (newBone.parent != null ? newBone.parent.rotation : _newRoot.transform.rotation);
            var turn = pOld * value * Quaternion.Inverse(oldBone.localRotation) * Quaternion.Inverse(pOld);
            return Quaternion.Inverse(pNew) * turn * pNew * newBone.localRotation;
        }

        // ---------- Finish ----------

        void RetireOldAvatar()
        {
            Undo.RecordObject(_oldRoot, "VRFury 2.0 keep backup");
            _oldRoot.name = _oldRoot.name + " (backup)";
            _oldRoot.SetActive(false);
        }

        void Report()
        {
            _log.Success("Copied " + AvatarPaths.Plural(_copiedComponents, "component") + " onto the new FBX (PhysBones, contacts, add-on tools, etc.).", _newRoot);
            if (_copiedAddOns > 0) _log.Success("Copied " + AvatarPaths.Plural(_copiedAddOns, "add-on object") + " (props, prefabs, extra objects).", _newRoot);
            if (_renderers > 0) _log.Success("Carried over materials, blendshape values and visibility on " + AvatarPaths.Plural(_renderers, "mesh") + ".", _newRoot);
            if (_boneTweaks > 0) _log.Info("Carried over " + AvatarPaths.Plural(_boneTweaks, "bone adjustment") + " you made on the old avatar.", _newRoot);

            const int maxListed = 25;
            foreach (var lost in _lostReferences.Take(maxListed))
                _log.Warning("Reference not found on the new avatar, so it was cleared: " + lost, _newRoot);
            if (_lostReferences.Count > maxListed)
                _log.Warning("…and " + (_lostReferences.Count - maxListed) + " more cleared references (see the Console).", _newRoot);
            foreach (var lost in _lostReferences.Skip(maxListed))
                Debug.LogWarning("[VRFury 2.0] Cleared reference: " + lost);

            _log.Info("The old avatar is kept, turned off, as \"" + _oldRoot.name + "\" in case you need anything from it.", _oldRoot);
        }
    }
}
