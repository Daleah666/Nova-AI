using System.IO;
using UnityEngine;
using VRC.SDK3.Avatars.Components;

namespace Nova.VRFury2
{
    /// <summary>Takes a head-and-shoulders picture of the avatar for its VRChat thumbnail (4:3, like the SDK's).</summary>
    public static class ThumbnailCapture
    {
        const int Width = 1200;
        const int Height = 900;

        public static string ThumbnailPath => Path.GetFullPath(Path.Combine("Library", "VRFury2", "thumbnail.png"));

        public static string Capture(GameObject avatarRoot)
        {
            var root = avatarRoot.transform;
            var descriptor = avatarRoot.GetComponent<VRCAvatarDescriptor>();
            var eyeLocal = descriptor != null ? descriptor.ViewPosition : new Vector3(0f, 1.5f, 0.1f);
            var eye = root.position + root.rotation * eyeLocal;
            var eyeHeight = Mathf.Max(0.3f, Vector3.Dot(eye - root.position, root.up));

            var target = eye - root.up * (eyeHeight * 0.08f);
            var distance = eyeHeight * 0.6f;

            var cameraObject = new GameObject("VRFury2 Thumbnail Camera") { hideFlags = HideFlags.HideAndDontSave };
            var previousActive = RenderTexture.active;
            RenderTexture rt = null;
            Texture2D image = null;
            try
            {
                var cam = cameraObject.AddComponent<Camera>();
                cam.enabled = false;
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = new Color(0.16f, 0.17f, 0.21f, 1f);
                cam.fieldOfView = 30f;
                cam.nearClipPlane = 0.01f;
                cam.farClipPlane = 100f;
                cam.transform.position = target + root.forward * distance;
                cam.transform.LookAt(target, root.up);

                rt = RenderTexture.GetTemporary(Width, Height, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB, 4);
                cam.targetTexture = rt;
                cam.aspect = (float)Width / Height;
                cam.Render();

                RenderTexture.active = rt;
                image = new Texture2D(Width, Height, TextureFormat.RGB24, false);
                image.ReadPixels(new Rect(0, 0, Width, Height), 0, 0);
                image.Apply();

                var path = ThumbnailPath;
                Directory.CreateDirectory(Path.GetDirectoryName(path) ?? ".");
                File.WriteAllBytes(path, image.EncodeToPNG());
                cam.targetTexture = null;
                return path;
            }
            finally
            {
                RenderTexture.active = previousActive;
                if (rt != null) RenderTexture.ReleaseTemporary(rt);
                if (image != null) Object.DestroyImmediate(image);
                Object.DestroyImmediate(cameraObject);
            }
        }
    }
}
