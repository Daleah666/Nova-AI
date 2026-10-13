using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Nova.VRFury2
{
    /// <summary>
    /// Bone-name presets used when Unity's own Humanoid auto-mapping fails.
    /// Every preset is tried; the one that finds the most bones wins.
    /// </summary>
    public static class HumanoidBoneMapper
    {
        public sealed class MappingResult
        {
            public string PresetName;
            public readonly Dictionary<HumanBodyBones, Transform> Bones = new Dictionary<HumanBodyBones, Transform>();
            public readonly List<HumanBodyBones> MissingRequired = new List<HumanBodyBones>();
            public readonly List<string> DuplicateNames = new List<string>();
            public bool IsComplete => MissingRequired.Count == 0;
        }

        sealed class Preset
        {
            public string Name;
            public readonly Dictionary<HumanBodyBones, string[]> Candidates = new Dictionary<HumanBodyBones, string[]>();
        }

        /// <summary>Parents are always resolved before their children.</summary>
        static readonly HumanBodyBones[] ResolveOrder =
        {
            HumanBodyBones.Hips, HumanBodyBones.Spine, HumanBodyBones.Chest, HumanBodyBones.UpperChest,
            HumanBodyBones.Neck, HumanBodyBones.Head, HumanBodyBones.Jaw, HumanBodyBones.LeftEye, HumanBodyBones.RightEye,
            HumanBodyBones.LeftShoulder, HumanBodyBones.LeftUpperArm, HumanBodyBones.LeftLowerArm, HumanBodyBones.LeftHand,
            HumanBodyBones.RightShoulder, HumanBodyBones.RightUpperArm, HumanBodyBones.RightLowerArm, HumanBodyBones.RightHand,
            HumanBodyBones.LeftUpperLeg, HumanBodyBones.LeftLowerLeg, HumanBodyBones.LeftFoot, HumanBodyBones.LeftToes,
            HumanBodyBones.RightUpperLeg, HumanBodyBones.RightLowerLeg, HumanBodyBones.RightFoot, HumanBodyBones.RightToes,
            HumanBodyBones.LeftThumbProximal, HumanBodyBones.LeftThumbIntermediate, HumanBodyBones.LeftThumbDistal,
            HumanBodyBones.LeftIndexProximal, HumanBodyBones.LeftIndexIntermediate, HumanBodyBones.LeftIndexDistal,
            HumanBodyBones.LeftMiddleProximal, HumanBodyBones.LeftMiddleIntermediate, HumanBodyBones.LeftMiddleDistal,
            HumanBodyBones.LeftRingProximal, HumanBodyBones.LeftRingIntermediate, HumanBodyBones.LeftRingDistal,
            HumanBodyBones.LeftLittleProximal, HumanBodyBones.LeftLittleIntermediate, HumanBodyBones.LeftLittleDistal,
            HumanBodyBones.RightThumbProximal, HumanBodyBones.RightThumbIntermediate, HumanBodyBones.RightThumbDistal,
            HumanBodyBones.RightIndexProximal, HumanBodyBones.RightIndexIntermediate, HumanBodyBones.RightIndexDistal,
            HumanBodyBones.RightMiddleProximal, HumanBodyBones.RightMiddleIntermediate, HumanBodyBones.RightMiddleDistal,
            HumanBodyBones.RightRingProximal, HumanBodyBones.RightRingIntermediate, HumanBodyBones.RightRingDistal,
            HumanBodyBones.RightLittleProximal, HumanBodyBones.RightLittleIntermediate, HumanBodyBones.RightLittleDistal,
        };

        static readonly Regex NamespacePrefix = new Regex(@"^(.*[:|])|^mixamorig\d*_", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        static List<Preset> _presets;
        static List<Preset> Presets => _presets ??= new List<Preset> { BlenderCats(), Mixamo(), Cc4(), Mmd(), VRoid() };

        /// <summary>Normalized bone name with FBX namespaces ("mixamorig:", "Armature|") removed.</summary>
        public static string Key(string boneName) => AvatarPaths.Normalize(NamespacePrefix.Replace(boneName ?? "", ""));

        public static IEnumerable<string> PresetNames => Presets.Select(p => p.Name);

        /// <summary>Maps the model hierarchy with the best-scoring preset.</summary>
        public static MappingResult Map(Transform modelRoot)
        {
            var byKey = new Dictionary<string, List<Transform>>();
            foreach (var t in modelRoot.GetComponentsInChildren<Transform>(true))
            {
                if (t == modelRoot) continue;
                var key = Key(t.name);
                if (!byKey.TryGetValue(key, out var list)) byKey[key] = list = new List<Transform>();
                list.Add(t);
            }

            MappingResult best = null;
            int bestScore = -1;
            foreach (var preset in Presets)
            {
                var result = Resolve(preset, byKey);
                var required = result.Bones.Keys.Count(b => HumanTrait.RequiredBone((int)b));
                var score = required * 1000 + result.Bones.Count;
                if (score > bestScore)
                {
                    best = result;
                    bestScore = score;
                }
            }

            var nameCounts = modelRoot.GetComponentsInChildren<Transform>(true).GroupBy(t => t.name).ToDictionary(g => g.Key, g => g.Count());
            foreach (var pair in best.Bones)
                if (nameCounts[pair.Value.name] > 1 && !best.DuplicateNames.Contains(pair.Value.name))
                    best.DuplicateNames.Add(pair.Value.name);

            return best;
        }

        /// <summary>First transform under <paramref name="searchRoot"/> whose name matches any preset's names for <paramref name="bone"/>.</summary>
        public static Transform FindByName(Transform searchRoot, HumanBodyBones bone)
        {
            if (searchRoot == null) return null;
            var all = searchRoot.GetComponentsInChildren<Transform>(true);
            foreach (var preset in Presets)
            {
                if (!preset.Candidates.TryGetValue(bone, out var keys)) continue;
                foreach (var key in keys)
                {
                    var hit = all.FirstOrDefault(t => t != searchRoot && Key(t.name) == key);
                    if (hit != null) return hit;
                }
            }
            return null;
        }

        static MappingResult Resolve(Preset preset, Dictionary<string, List<Transform>> byKey)
        {
            var result = new MappingResult { PresetName = preset.Name };
            var used = new HashSet<Transform>();

            List<Transform> Find(HumanBodyBones bone)
            {
                var found = new List<Transform>();
                if (!preset.Candidates.TryGetValue(bone, out var keys)) return found;
                foreach (var key in keys)
                    if (byKey.TryGetValue(key, out var list))
                        found.AddRange(list.Where(t => !used.Contains(t)));
                return found;
            }

            // Hips must contain the spine and both legs (MMD has several "hips-like" bones above the legs).
            var hipsCandidates = Find(HumanBodyBones.Hips);
            var mustContain = new[] { HumanBodyBones.Spine, HumanBodyBones.LeftUpperLeg, HumanBodyBones.RightUpperLeg }
                .Select(Find).Where(l => l.Count > 0).ToList();
            var hips = hipsCandidates.FirstOrDefault(h => mustContain.All(l => l.Any(t => t != h && IsAncestor(h, t))))
                       ?? hipsCandidates.FirstOrDefault();
            if (hips != null)
            {
                result.Bones[HumanBodyBones.Hips] = hips;
                used.Add(hips);
            }

            foreach (var bone in ResolveOrder)
            {
                if (bone == HumanBodyBones.Hips) continue;
                var parent = NearestMappedParent(bone, result.Bones);
                var pick = Find(bone).FirstOrDefault(t => parent == null || IsAncestor(parent, t));
                if (pick == null) continue;
                result.Bones[bone] = pick;
                used.Add(pick);
            }

            for (int i = 0; i < HumanTrait.BoneCount; i++)
                if (HumanTrait.RequiredBone(i) && !result.Bones.ContainsKey((HumanBodyBones)i))
                    result.MissingRequired.Add((HumanBodyBones)i);
            return result;
        }

        static Transform NearestMappedParent(HumanBodyBones bone, Dictionary<HumanBodyBones, Transform> mapped)
        {
            int guard = 0;
            for (int p = HumanTrait.GetParentBone((int)bone); p >= 0 && guard++ < 64; p = HumanTrait.GetParentBone(p))
                if (mapped.TryGetValue((HumanBodyBones)p, out var t)) return t;
            return null;
        }

        static bool IsAncestor(Transform ancestor, Transform t)
        {
            for (var cur = t.parent; cur != null; cur = cur.parent)
                if (cur == ancestor) return true;
            return false;
        }

        /// <summary>
        /// Builds a HumanDescription from a mapping. Keeps the importer's twist/stretch settings and
        /// rebuilds the skeleton (rest pose) from the model as imported.
        /// </summary>
        public static HumanDescription BuildDescription(HumanDescription current, Transform modelRoot, MappingResult mapping)
        {
            var desc = current;
            var humanNames = HumanTrait.BoneName;
            var nameByBone = new Dictionary<HumanBodyBones, string>();
            foreach (HumanBodyBones bone in Enum.GetValues(typeof(HumanBodyBones)))
            {
                if (bone == HumanBodyBones.LastBone) continue;
                var key = AvatarPaths.Normalize(bone.ToString());
                var match = humanNames.FirstOrDefault(n => AvatarPaths.Normalize(n) == key);
                if (match != null) nameByBone[bone] = match;
            }

            desc.human = mapping.Bones
                .Where(p => nameByBone.ContainsKey(p.Key))
                .Select(p => new HumanBone
                {
                    boneName = p.Value.name,
                    humanName = nameByBone[p.Key],
                    limit = new HumanLimit { useDefaultValues = true },
                })
                .ToArray();

            desc.skeleton = modelRoot.GetComponentsInChildren<Transform>(true)
                .Select(t => new SkeletonBone
                {
                    name = t.name,
                    position = t.localPosition,
                    rotation = t.localRotation,
                    scale = t.localScale,
                })
                .ToArray();

            if (desc.upperArmTwist <= 0f && desc.lowerArmTwist <= 0f && desc.upperLegTwist <= 0f && desc.lowerLegTwist <= 0f)
            {
                desc.upperArmTwist = 0.5f;
                desc.lowerArmTwist = 0.5f;
                desc.upperLegTwist = 0.5f;
                desc.lowerLegTwist = 0.5f;
                desc.armStretch = 0.05f;
                desc.legStretch = 0.05f;
                desc.feetSpacing = 0f;
            }
            return desc;
        }

        /// <summary>Reads a HumanDescription back as bone → transform name.</summary>
        public static Dictionary<HumanBodyBones, string> ReadMapping(HumanDescription desc)
        {
            var map = new Dictionary<HumanBodyBones, string>();
            if (desc.human == null) return map;
            foreach (var hb in desc.human)
            {
                var key = AvatarPaths.Normalize(hb.humanName);
                foreach (HumanBodyBones bone in Enum.GetValues(typeof(HumanBodyBones)))
                {
                    if (bone == HumanBodyBones.LastBone || AvatarPaths.Normalize(bone.ToString()) != key) continue;
                    map[bone] = hb.boneName;
                    break;
                }
            }
            return map;
        }

        // ---------- Presets ----------

        static readonly string[] Fingers = { "Thumb", "Index", "Middle", "Ring", "Little" };
        static readonly string[] Segments = { "Proximal", "Intermediate", "Distal" };

        static HumanBodyBones Finger(bool left, int finger, int segment) =>
            (HumanBodyBones)Enum.Parse(typeof(HumanBodyBones), (left ? "Left" : "Right") + Fingers[finger] + Segments[segment]);

        static HumanBodyBones Sided(bool left, string bone) =>
            (HumanBodyBones)Enum.Parse(typeof(HumanBodyBones), (left ? "Left" : "Right") + bone);

        /// <summary>"arm" → leftarm, armleft, larm, arml (names are compared normalized).</summary>
        static string[] SideVariants(bool left, params string[] bases)
        {
            var longSide = left ? "left" : "right";
            var shortSide = left ? "l" : "r";
            return bases.SelectMany(b => new[] { longSide + b, b + longSide, shortSide + b, b + shortSide })
                .Select(AvatarPaths.Normalize).Distinct().ToArray();
        }

        static string[] Keys(params string[] names) => names.Select(AvatarPaths.Normalize).Distinct().ToArray();

        static Preset BlenderCats()
        {
            var p = new Preset { Name = "Blender / Cats" };
            var c = p.Candidates;
            c[HumanBodyBones.Hips] = Keys("Hips", "Hip", "Pelvis");
            c[HumanBodyBones.Spine] = Keys("Spine");
            c[HumanBodyBones.Chest] = Keys("Chest", "Spine.001", "Spine1");
            c[HumanBodyBones.UpperChest] = Keys("Upper Chest", "UpperChest", "Spine.002", "Spine2");
            c[HumanBodyBones.Neck] = Keys("Neck");
            c[HumanBodyBones.Head] = Keys("Head");
            c[HumanBodyBones.Jaw] = Keys("Jaw");
            foreach (var left in new[] { true, false })
            {
                c[Sided(left, "Eye")] = SideVariants(left, "eye");
                c[Sided(left, "Shoulder")] = SideVariants(left, "shoulder", "clavicle");
                c[Sided(left, "UpperArm")] = SideVariants(left, "arm", "upperarm", "upper_arm");
                c[Sided(left, "LowerArm")] = SideVariants(left, "elbow", "forearm", "lowerarm", "lower_arm");
                c[Sided(left, "Hand")] = SideVariants(left, "wrist", "hand");
                c[Sided(left, "UpperLeg")] = SideVariants(left, "leg", "thigh", "upperleg", "upper_leg");
                c[Sided(left, "LowerLeg")] = SideVariants(left, "knee", "shin", "lowerleg", "lower_leg", "calf");
                c[Sided(left, "Foot")] = SideVariants(left, "ankle", "foot");
                c[Sided(left, "Toes")] = SideVariants(left, "toe", "toes", "toebase");

                c[Finger(left, 0, 0)] = SideVariants(left, "thumb0", "thumb.01", "thumb1", "thumbproximal");
                c[Finger(left, 0, 1)] = SideVariants(left, "thumb1", "thumb.02", "thumb2", "thumbintermediate");
                c[Finger(left, 0, 2)] = SideVariants(left, "thumb2", "thumb.03", "thumb3", "thumbdistal");
                var names = new[] { "index", "middle", "ring", "little" };
                var rigify = new[] { "f_index", "f_middle", "f_ring", "f_pinky" };
                var alt = new[] { "index", "middle", "ring", "pinky" };
                for (int f = 0; f < 4; f++)
                for (int s = 0; s < 3; s++)
                {
                    var n = (s + 1).ToString();
                    c[Finger(left, f + 1, s)] = SideVariants(left,
                        names[f] + "finger" + n, rigify[f] + ".0" + n, alt[f] + n, alt[f] + "finger" + n,
                        names[f] + Segments[s].ToLowerInvariant());
                }
            }
            return p;
        }

        static Preset Mixamo()
        {
            var p = new Preset { Name = "Mixamo" };
            var c = p.Candidates;
            c[HumanBodyBones.Hips] = Keys("Hips");
            c[HumanBodyBones.Spine] = Keys("Spine");
            c[HumanBodyBones.Chest] = Keys("Spine1");
            c[HumanBodyBones.UpperChest] = Keys("Spine2");
            c[HumanBodyBones.Neck] = Keys("Neck");
            c[HumanBodyBones.Head] = Keys("Head");
            foreach (var left in new[] { true, false })
            {
                var s = left ? "Left" : "Right";
                c[Sided(left, "Eye")] = Keys(s + "Eye");
                c[Sided(left, "Shoulder")] = Keys(s + "Shoulder");
                c[Sided(left, "UpperArm")] = Keys(s + "Arm");
                c[Sided(left, "LowerArm")] = Keys(s + "ForeArm");
                c[Sided(left, "Hand")] = Keys(s + "Hand");
                c[Sided(left, "UpperLeg")] = Keys(s + "UpLeg");
                c[Sided(left, "LowerLeg")] = Keys(s + "Leg");
                c[Sided(left, "Foot")] = Keys(s + "Foot");
                c[Sided(left, "Toes")] = Keys(s + "ToeBase");
                var names = new[] { "Thumb", "Index", "Middle", "Ring", "Pinky" };
                for (int f = 0; f < 5; f++)
                for (int seg = 0; seg < 3; seg++)
                    c[Finger(left, f, seg)] = Keys(s + "Hand" + names[f] + (seg + 1));
            }
            return p;
        }

        static Preset Cc4()
        {
            var p = new Preset { Name = "Reallusion CC4" };
            var c = p.Candidates;
            c[HumanBodyBones.Hips] = Keys("CC_Base_Hip");
            c[HumanBodyBones.Spine] = Keys("CC_Base_Waist");
            c[HumanBodyBones.Chest] = Keys("CC_Base_Spine01");
            c[HumanBodyBones.UpperChest] = Keys("CC_Base_Spine02");
            c[HumanBodyBones.Neck] = Keys("CC_Base_NeckTwist01");
            c[HumanBodyBones.Head] = Keys("CC_Base_Head");
            c[HumanBodyBones.Jaw] = Keys("CC_Base_JawRoot");
            foreach (var left in new[] { true, false })
            {
                var s = "CC_Base_" + (left ? "L_" : "R_");
                c[Sided(left, "Eye")] = Keys(s + "Eye");
                c[Sided(left, "Shoulder")] = Keys(s + "Clavicle");
                c[Sided(left, "UpperArm")] = Keys(s + "Upperarm");
                c[Sided(left, "LowerArm")] = Keys(s + "Forearm");
                c[Sided(left, "Hand")] = Keys(s + "Hand");
                c[Sided(left, "UpperLeg")] = Keys(s + "Thigh");
                c[Sided(left, "LowerLeg")] = Keys(s + "Calf");
                c[Sided(left, "Foot")] = Keys(s + "Foot");
                c[Sided(left, "Toes")] = Keys(s + "ToeBase");
                var names = new[] { "Thumb", "Index", "Mid", "Ring", "Pinky" };
                for (int f = 0; f < 5; f++)
                for (int seg = 0; seg < 3; seg++)
                    c[Finger(left, f, seg)] = Keys(s + names[f] + (seg + 1));
            }
            return p;
        }

        static Preset Mmd()
        {
            var p = new Preset { Name = "MMD" };
            var c = p.Candidates;
            c[HumanBodyBones.Hips] = Keys("腰", "グルーブ", "センター", "下半身", "Hips");
            c[HumanBodyBones.Spine] = Keys("上半身");
            c[HumanBodyBones.Chest] = Keys("上半身2");
            c[HumanBodyBones.UpperChest] = Keys("上半身3");
            c[HumanBodyBones.Neck] = Keys("首");
            c[HumanBodyBones.Head] = Keys("頭");
            foreach (var left in new[] { true, false })
            {
                var s = left ? "左" : "右";
                c[Sided(left, "Eye")] = Keys(s + "目");
                c[Sided(left, "Shoulder")] = Keys(s + "肩");
                c[Sided(left, "UpperArm")] = Keys(s + "腕");
                c[Sided(left, "LowerArm")] = Keys(s + "ひじ", s + "肘");
                c[Sided(left, "Hand")] = Keys(s + "手首");
                c[Sided(left, "UpperLeg")] = Keys(s + "足", s + "脚", s + "足D");
                c[Sided(left, "LowerLeg")] = Keys(s + "ひざ", s + "膝", s + "ひざD");
                c[Sided(left, "Foot")] = Keys(s + "足首", s + "足首D");
                c[Sided(left, "Toes")] = Keys(s + "足先EX", s + "つま先");
                // Thumbs are 親指０/１/２ on newer models and 親指１/２ on older ones.
                c[Finger(left, 0, 0)] = Keys(s + "親指0", s + "親指1");
                c[Finger(left, 0, 1)] = Keys(s + "親指1", s + "親指2");
                c[Finger(left, 0, 2)] = Keys(s + "親指2");
                var names = new[] { new[] { "人指", "人差指" }, new[] { "中指" }, new[] { "薬指" }, new[] { "小指" } };
                for (int f = 0; f < 4; f++)
                for (int seg = 0; seg < 3; seg++)
                    c[Finger(left, f + 1, seg)] = Keys(names[f].Select(n => s + n + (seg + 1)).ToArray());
            }
            return p;
        }

        static Preset VRoid()
        {
            var p = new Preset { Name = "VRoid" };
            var c = p.Candidates;
            c[HumanBodyBones.Hips] = Keys("J_Bip_C_Hips");
            c[HumanBodyBones.Spine] = Keys("J_Bip_C_Spine");
            c[HumanBodyBones.Chest] = Keys("J_Bip_C_Chest");
            c[HumanBodyBones.UpperChest] = Keys("J_Bip_C_UpperChest");
            c[HumanBodyBones.Neck] = Keys("J_Bip_C_Neck");
            c[HumanBodyBones.Head] = Keys("J_Bip_C_Head");
            foreach (var left in new[] { true, false })
            {
                var s = "J_Bip_" + (left ? "L_" : "R_");
                c[Sided(left, "Eye")] = Keys("J_Adj_" + (left ? "L_" : "R_") + "FaceEye");
                c[Sided(left, "Shoulder")] = Keys(s + "Shoulder");
                c[Sided(left, "UpperArm")] = Keys(s + "UpperArm");
                c[Sided(left, "LowerArm")] = Keys(s + "LowerArm");
                c[Sided(left, "Hand")] = Keys(s + "Hand");
                c[Sided(left, "UpperLeg")] = Keys(s + "UpperLeg");
                c[Sided(left, "LowerLeg")] = Keys(s + "LowerLeg");
                c[Sided(left, "Foot")] = Keys(s + "Foot");
                c[Sided(left, "Toes")] = Keys(s + "ToeBase");
                var names = new[] { "Thumb", "Index", "Middle", "Ring", "Little" };
                for (int f = 0; f < 5; f++)
                for (int seg = 0; seg < 3; seg++)
                    c[Finger(left, f, seg)] = Keys(s + names[f] + (seg + 1));
            }
            return p;
        }
    }
}
