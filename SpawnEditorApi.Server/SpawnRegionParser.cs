using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;

namespace UOX3SpawnEditor
{
    public static class SpawnRegionParser
    {
        public static List<SpawnRegion> LoadSpawnRegions(string filePath, int worldFilter = -1, Action<int, int, string> progressCallback = null)
        {
            var spawnRegions = new List<SpawnRegion>();

            if (!string.IsNullOrWhiteSpace(filePath))
                progressCallback?.Invoke(1, 1, Path.GetFileName(filePath));

            ParseSpawnFileIntoList(filePath, spawnRegions, worldFilter);
            return spawnRegions;
        }

        public static List<SpawnRegion> LoadSpawnRegionsFromFolder(string folderPath, int worldFilter = -1, bool recursive = false, Action<int, int, string> progressCallback = null)
        {
            var spawnRegions = new List<SpawnRegion>();

            if (!Directory.Exists(folderPath))
                return spawnRegions;

            SearchOption searchOption = recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;
            string[] files = Directory.GetFiles(folderPath, "*.dfn", searchOption)
                .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
                .ToArray();

            int totalFiles = files.Length;

            for (int fileIndex = 0; fileIndex < totalFiles; fileIndex++)
            {
                string filePath = files[fileIndex];
                progressCallback?.Invoke(fileIndex + 1, totalFiles, Path.GetFileName(filePath));
                ParseSpawnFileIntoList(filePath, spawnRegions, worldFilter);
            }

            return spawnRegions;
        }

        public static void SaveSpawnRegions(string filePath, List<SpawnRegion> spawnRegions)
        {
            foreach (SpawnRegion spawnRegion in spawnRegions)
                spawnRegion.SyncTypedFieldsToTags();

            using (StreamWriter writer = new StreamWriter(filePath))
            {
                foreach (SpawnRegion spawnRegion in spawnRegions.OrderBy(region => region.RegionNum))
                    WriteSpawnRegionBlock(writer, spawnRegion);
            }
        }

        public static void SaveSpawnRegionsToSourceFiles(List<SpawnRegion> spawnRegions)
        {
            var groups = spawnRegions
                .GroupBy(region => region.SourceFilePath, StringComparer.OrdinalIgnoreCase)
                .Where(group => !string.IsNullOrWhiteSpace(group.Key));

            foreach (var group in groups)
            {
                List<SpawnRegion> fileRegions = group
                    .OrderBy(region => region.RegionNum)
                    .ToList();

                SaveSpawnRegions(group.Key, fileRegions);
            }
        }

        private static void ParseSpawnFileIntoList(string filePath, List<SpawnRegion> spawnRegions, int worldFilter)
        {
            if (!File.Exists(filePath))
                return;

            string[] lines = File.ReadAllLines(filePath);

            SpawnRegion currentRegion = null;
            int x1 = 0;
            int y1 = 0;
            int x2 = 0;
            int y2 = 0;

            foreach (string rawLine in lines)
            {
                string line = rawLine.Trim();

                if (string.IsNullOrWhiteSpace(line))
                    continue;

                if (line.StartsWith("//") || line.StartsWith(";"))
                    continue;

                if (line.StartsWith("[REGIONSPAWN ", StringComparison.OrdinalIgnoreCase))
                {
                    if (currentRegion != null)
                    {
                        currentRegion.SyncTagsToTypedFields();

                        if (worldFilter < 0 || currentRegion.World == worldFilter)
                            spawnRegions.Add(currentRegion);
                    }

                    currentRegion = new SpawnRegion();
                    currentRegion.SourceFilePath = filePath;

                    int startIndex = line.IndexOf(' ');
                    int endIndex = line.IndexOf(']');

                    if (startIndex >= 0 && endIndex > startIndex)
                    {
                        string regionNumberText = line.Substring(startIndex + 1, endIndex - startIndex - 1).Trim();
                        int parsedRegionNum;
                        if (int.TryParse(regionNumberText, out parsedRegionNum))
                            currentRegion.RegionNum = parsedRegionNum;
                    }

                    continue;
                }

                if (currentRegion == null)
                    continue;

                if (line == "{" || line == "}")
                    continue;

                int equalsIndex = line.IndexOf('=');
                if (equalsIndex <= 0)
                    continue;

                string key = line.Substring(0, equalsIndex).Trim().ToUpperInvariant();
                string value = line.Substring(equalsIndex + 1).Trim();

                currentRegion.Tags[key] = value;

                switch (key)
                {
                    case "NAME":
                        currentRegion.Name = value;
                        break;

                    case "WORLD":
                        int parsedWorld;
                        if (int.TryParse(value, out parsedWorld))
                            currentRegion.World = parsedWorld;
                        break;

                    case "INSTANCEID":
                        int parsedInstanceID;
                        if (int.TryParse(value, out parsedInstanceID))
                            currentRegion.InstanceID = parsedInstanceID;
                        break;

                    case "NPC":
                        currentRegion.Npc = value;
                        break;

                    case "NPCLIST":
                        currentRegion.NpcList = value;
                        break;

                    case "ITEM":
                        currentRegion.Item = value;
                        break;

                    case "ITEMLIST":
                        currentRegion.ItemList = value;
                        break;

                    case "MAXNPCS":
                        int parsedMaxNpcs;
                        if (int.TryParse(value, out parsedMaxNpcs))
                            currentRegion.MaxNpcs = parsedMaxNpcs;
                        break;

                    case "MAXITEMS":
                        int parsedMaxItems;
                        if (int.TryParse(value, out parsedMaxItems))
                            currentRegion.MaxItems = parsedMaxItems;
                        break;

                    case "MINTIME":
                        int parsedMinTime;
                        if (int.TryParse(value, out parsedMinTime))
                            currentRegion.MinTime = parsedMinTime;
                        break;

                    case "MAXTIME":
                        int parsedMaxTime;
                        if (int.TryParse(value, out parsedMaxTime))
                            currentRegion.MaxTime = parsedMaxTime;
                        break;

                    case "CALL":
                        int parsedCall;
                        if (int.TryParse(value, out parsedCall))
                            currentRegion.Call = parsedCall;
                        break;

                    case "DEFZ":
                        int parsedDefZ;
                        if (int.TryParse(value, out parsedDefZ))
                            currentRegion.DefZ = parsedDefZ;
                        break;

                    case "PREFZ":
                        int parsedPrefZ;
                        if (int.TryParse(value, out parsedPrefZ))
                            currentRegion.PrefZ = parsedPrefZ;
                        break;

                    case "X1":
                        int.TryParse(value, out x1);
                        break;

                    case "Y1":
                        int.TryParse(value, out y1);
                        break;

                    case "X2":
                        int.TryParse(value, out x2);
                        break;

                    case "Y2":
                        int.TryParse(value, out y2);
                        currentRegion.Bounds.Add(Rectangle.FromLTRB(
                            Math.Min(x1, x2),
                            Math.Min(y1, y2),
                            Math.Max(x1, x2),
                            Math.Max(y1, y2)
                        ));
                        break;
                }
            }

            if (currentRegion != null)
            {
                currentRegion.SyncTagsToTypedFields();

                if (worldFilter < 0 || currentRegion.World == worldFilter)
                    spawnRegions.Add(currentRegion);
            }
        }

        private static void WriteSpawnRegionBlock(StreamWriter writer, SpawnRegion spawnRegion)
        {
            spawnRegion.SyncTypedFieldsToTags();

            writer.WriteLine("[REGIONSPAWN " + spawnRegion.RegionNum + "]");
            writer.WriteLine("{");

            WriteTagIfPresent(writer, spawnRegion.Tags, "NAME");
            WriteTagIfPresent(writer, spawnRegion.Tags, "WORLD");
            WriteTagIfPresent(writer, spawnRegion.Tags, "INSTANCEID");
            WriteTagIfPresent(writer, spawnRegion.Tags, "NPC");
            WriteTagIfPresent(writer, spawnRegion.Tags, "NPCLIST");
            WriteTagIfPresent(writer, spawnRegion.Tags, "ITEM");
            WriteTagIfPresent(writer, spawnRegion.Tags, "ITEMLIST");
            WriteTagIfPresent(writer, spawnRegion.Tags, "MAXNPCS");
            WriteTagIfPresent(writer, spawnRegion.Tags, "MAXITEMS");
            WriteTagIfPresent(writer, spawnRegion.Tags, "MINTIME");
            WriteTagIfPresent(writer, spawnRegion.Tags, "MAXTIME");
            WriteTagIfPresent(writer, spawnRegion.Tags, "CALL");
            WriteTagIfPresent(writer, spawnRegion.Tags, "DEFZ");
            WriteTagIfPresent(writer, spawnRegion.Tags, "PREFZ");

            foreach (KeyValuePair<string, string> tag in spawnRegion.Tags.OrderBy(entry => entry.Key))
            {
                string key = tag.Key.ToUpperInvariant();

                if (key.StartsWith("__", StringComparison.Ordinal))
                {
                    continue;
                }

                if (key == "NAME" ||
                    key == "WORLD" ||
                    key == "INSTANCEID" ||
                    key == "NPC" ||
                    key == "NPCLIST" ||
                    key == "ITEM" ||
                    key == "ITEMLIST" ||
                    key == "MAXNPCS" ||
                    key == "MAXITEMS" ||
                    key == "MINTIME" ||
                    key == "MAXTIME" ||
                    key == "CALL" ||
                    key == "DEFZ" ||
                    key == "PREFZ" ||
                    key == "X1" ||
                    key == "Y1" ||
                    key == "X2" ||
                    key == "Y2")
                {
                    continue;
                }

                writer.WriteLine(key + "=" + tag.Value);
            }

            foreach (Rectangle rect in spawnRegion.Bounds)
            {
                writer.WriteLine("X1=" + rect.Left);
                writer.WriteLine("Y1=" + rect.Top);
                writer.WriteLine("X2=" + rect.Right);
                writer.WriteLine("Y2=" + rect.Bottom);
            }

            writer.WriteLine("}");
            writer.WriteLine();
        }

        private static void WriteTagIfPresent(StreamWriter writer, Dictionary<string, string> tags, string key)
        {
            string value;
            if (tags.TryGetValue(key, out value) && !string.IsNullOrWhiteSpace(value))
                writer.WriteLine(key + "=" + value);
        }
    }
}