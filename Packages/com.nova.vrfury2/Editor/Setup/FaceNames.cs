using System.Collections.Generic;
using System.Linq;

namespace Nova.VRFury2
{
    /// <summary>
    /// Blendshape name tables for visemes, blink and mouth-open. Indices follow
    /// VRC_AvatarDescriptor.Viseme: sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, ih, oh, ou.
    /// </summary>
    public static class FaceNames
    {
        public static readonly string[] VisemeIds = { "sil", "PP", "FF", "TH", "DD", "kk", "CH", "SS", "nn", "RR", "aa", "E", "ih", "oh", "ou" };

        public const int Sil = 0, PP = 1, FF = 2, TH = 3, DD = 4, KK = 5, CH = 6, SS = 7, NN = 8, RR = 9, AA = 10, E = 11, IH = 12, OH = 13, OU = 14;

        /// <summary>Per-viseme names, most specific first. Compared after <see cref="AvatarPaths.Normalize"/>.</summary>
        public static readonly string[][] VisemeCandidates = BuildVisemeCandidates();

        /// <summary>Where a missing consonant viseme borrows its shape from (MMD and VRoid only ship vowels). -1 = leave empty.</summary>
        public static readonly int[] ConsonantFallback =
        {
            -1, // sil
            -1, // PP
            IH, // FF
            E,  // TH
            IH, // DD
            AA, // kk
            IH, // CH
            IH, // SS
            E,  // nn
            OH, // RR
            -1, -1, -1, -1, -1,
        };

        public static readonly string[] Blink =
        {
            "vrc.blink", "blink", "blink_both", "eyes_blink", "eye_blink", "eyeblink", "eyes_closed", "eye_close", "eyes_close",
            "Eye_Blink", "Fcl_EYE_Close", "まばたき", "瞬き", "目閉じ", "Blink_All",
        };

        /// <summary>Single-eye blink shapes ("Blink_L", "blink.r") are never used as the main blink.</summary>
        static readonly string[] OneSidedSuffixes = { "_l", "_r", ".l", ".r", " l", " r" };

        public static readonly string[] JawOpen =
        {
            "jawOpen", "jaw_open", "mouth_open", "mouthopen", "open_mouth", "Mouth_Open", "MTH_A", "Fcl_MTH_A", "V_Open", "vrc.v_aa", "あ",
        };

        static string[][] BuildVisemeCandidates()
        {
            var table = new string[15][];
            for (int i = 0; i < 15; i++)
            {
                var id = VisemeIds[i].ToLowerInvariant();
                table[i] = new[] { "vrc.v_" + id, "v_" + id, "viseme_" + id, "vrc_v_" + id, "visemes_" + id, "mouth_" + id };
            }

            void Add(int viseme, params string[] names) => table[viseme] = table[viseme].Concat(names).ToArray();

            // Reallusion CC4 lip shapes.
            Add(PP, "V_Explosive");
            Add(FF, "V_Dental_Lip");
            Add(TH, "V_Tongue_Out");
            Add(DD, "V_Tongue_Raise", "V_Tongue_up");
            Add(KK, "V_Lip_Open");
            Add(CH, "V_Affricate");
            Add(SS, "V_Tight");
            Add(NN, "V_Tongue_up", "V_Tongue_Raise");
            Add(RR, "V_Tongue_Curl_U");
            Add(AA, "V_Open");
            Add(E, "V_Wide");
            Add(IH, "V_Wide");
            Add(OH, "V_Tight_O");
            Add(OU, "V_Tight_O");

            // MMD vowels (Japanese) and VRoid.
            Add(AA, "あ", "Fcl_MTH_A", "MTH_A", "A");
            Add(IH, "い", "Fcl_MTH_I", "MTH_I", "I");
            Add(OU, "う", "Fcl_MTH_U", "MTH_U", "U");
            Add(E, "え", "Fcl_MTH_E", "MTH_E");
            Add(OH, "お", "Fcl_MTH_O", "MTH_O", "O");
            return table;
        }

        /// <summary>Index of the first blendshape that matches any candidate (exact, then suffix for longer names).</summary>
        public static int Find(IList<string> blendShapeNames, IEnumerable<string> candidates, System.Func<string, bool> reject = null)
        {
            var normalized = blendShapeNames.Select(AvatarPaths.Normalize).ToList();
            var keys = candidates.Select(AvatarPaths.Normalize).Where(k => k.Length > 0).ToList();

            foreach (var key in keys)
                for (int i = 0; i < normalized.Count; i++)
                    if (normalized[i] == key && (reject == null || !reject(blendShapeNames[i])))
                        return i;

            foreach (var key in keys)
            {
                if (key.Length < 4) continue;
                for (int i = 0; i < normalized.Count; i++)
                    if (normalized[i].EndsWith(key, System.StringComparison.Ordinal) && (reject == null || !reject(blendShapeNames[i])))
                        return i;
            }
            return -1;
        }

        public static bool IsOneSided(string blendShapeName)
        {
            var lower = blendShapeName.ToLowerInvariant();
            if (lower.Contains("left") || lower.Contains("right") || lower.Contains("wink") || blendShapeName.Contains("ウィンク"))
                return true;
            return OneSidedSuffixes.Any(s => lower.EndsWith(s, System.StringComparison.Ordinal));
        }
    }
}
