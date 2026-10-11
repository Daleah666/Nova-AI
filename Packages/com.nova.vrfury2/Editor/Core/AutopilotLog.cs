using System;
using System.Collections.Generic;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Nova.VRFury2
{
    public enum LogLevel
    {
        Step,
        Info,
        Success,
        Warning,
        Error,
    }

    public sealed class LogEntry
    {
        public LogLevel Level;
        public string Message;
        public Object Context;
        public string FixLabel;
        public Action Fix;
    }

    /// <summary>
    /// The results list shown in the window. Everything the tool does (or could not do) ends up here,
    /// and is mirrored to the Unity Console.
    /// </summary>
    public sealed class AutopilotLog
    {
        const string Prefix = "[VRFury 2.0] ";

        public readonly List<LogEntry> Entries = new List<LogEntry>();
        public event Action Changed;

        public int ErrorCount { get; private set; }
        public int WarningCount { get; private set; }

        public void Clear()
        {
            Entries.Clear();
            ErrorCount = 0;
            WarningCount = 0;
            Changed?.Invoke();
        }

        public void Step(string message) => Add(LogLevel.Step, message, null);
        public void Info(string message, Object context = null) => Add(LogLevel.Info, message, context);
        public void Success(string message, Object context = null) => Add(LogLevel.Success, message, context);
        public void Warning(string message, Object context = null) => Add(LogLevel.Warning, message, context);
        public void Error(string message, Object context = null) => Add(LogLevel.Error, message, context);

        public LogEntry Add(LogLevel level, string message, Object context, string fixLabel = null, Action fix = null)
        {
            var entry = new LogEntry { Level = level, Message = message, Context = context, FixLabel = fixLabel, Fix = fix };
            Entries.Add(entry);
            switch (level)
            {
                case LogLevel.Error:
                    ErrorCount++;
                    Debug.LogError(Prefix + message, context);
                    break;
                case LogLevel.Warning:
                    WarningCount++;
                    Debug.LogWarning(Prefix + message, context);
                    break;
                default:
                    Debug.Log(Prefix + message, context);
                    break;
            }
            Changed?.Invoke();
            return entry;
        }
    }
}
