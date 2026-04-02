using System.Collections.Generic;
using System.Drawing;

namespace UOX3SpawnEditor
{
    public class SpawnRegion
    {
        public int RegionNum { get; set; }
        public string Name { get; set; } = "Unnamed Spawn";
        public bool Visible { get; set; } = true;
        public int World { get; set; } = 0;
        public int InstanceID { get; set; } = 0;
        public string SourceFilePath { get; set; } = string.Empty;

        public string Npc { get; set; } = string.Empty;
        public string NpcList { get; set; } = string.Empty;
        public string Item { get; set; } = string.Empty;
        public string ItemList { get; set; } = string.Empty;

        public int MaxNpcs { get; set; } = 0;
        public int MaxItems { get; set; } = 0;
        public int MinTime { get; set; } = 0;
        public int MaxTime { get; set; } = 0;
        public int Call { get; set; } = 0;
        public int DefZ { get; set; } = 0;
        public int PrefZ { get; set; } = 0;

        public List<Rectangle> Bounds { get; set; } = new List<Rectangle>();
        public Dictionary<string, string> Tags { get; set; } = new Dictionary<string, string>();

        public SpawnRegion Clone()
        {
            return new SpawnRegion
            {
                RegionNum = RegionNum,
                Name = Name,
                Visible = Visible,
                World = World,
                InstanceID = InstanceID,
                SourceFilePath = SourceFilePath,
                Npc = Npc,
                NpcList = NpcList,
                Item = Item,
                ItemList = ItemList,
                MaxNpcs = MaxNpcs,
                MaxItems = MaxItems,
                MinTime = MinTime,
                MaxTime = MaxTime,
                Call = Call,
                DefZ = DefZ,
                PrefZ = PrefZ,
                Bounds = new List<Rectangle>(Bounds),
                Tags = new Dictionary<string, string>(Tags)
            };
        }

        public string GetSpawnSource()
        {
            if (!string.IsNullOrWhiteSpace(Npc))
                return "NPC=" + Npc;

            if (!string.IsNullOrWhiteSpace(NpcList))
                return "NPCLIST=" + NpcList;

            if (!string.IsNullOrWhiteSpace(Item))
                return "ITEM=" + Item;

            if (!string.IsNullOrWhiteSpace(ItemList))
                return "ITEMLIST=" + ItemList;

            return "(No Spawn Source)";
        }

        public string GetShortSourceFileName()
        {
            if (string.IsNullOrWhiteSpace(SourceFilePath))
                return string.Empty;

            return System.IO.Path.GetFileName(SourceFilePath);
        }

        public string GetGroupName()
        {
            if (!string.IsNullOrWhiteSpace(Npc))
                return "NPC Spawns";

            if (!string.IsNullOrWhiteSpace(NpcList))
                return "NPC List Spawns";

            if (!string.IsNullOrWhiteSpace(Item))
                return "Item Spawns";

            if (!string.IsNullOrWhiteSpace(ItemList))
                return "Item List Spawns";

            return "Missing Source";
        }

        public void SyncTypedFieldsToTags()
        {
            SetOrRemoveTag("NAME", Name);
            SetOrRemoveTag("WORLD", World.ToString());

            if (InstanceID > 0)
                SetOrRemoveTag("INSTANCEID", InstanceID.ToString());
            else
                RemoveTag("INSTANCEID");

            SetOrRemoveTag("NPC", Npc);
            SetOrRemoveTag("NPCLIST", NpcList);
            SetOrRemoveTag("ITEM", Item);
            SetOrRemoveTag("ITEMLIST", ItemList);

            if (MaxNpcs > 0)
                SetOrRemoveTag("MAXNPCS", MaxNpcs.ToString());
            else
                RemoveTag("MAXNPCS");

            if (MaxItems > 0)
                SetOrRemoveTag("MAXITEMS", MaxItems.ToString());
            else
                RemoveTag("MAXITEMS");

            if (MinTime > 0)
                SetOrRemoveTag("MINTIME", MinTime.ToString());
            else
                RemoveTag("MINTIME");

            if (MaxTime > 0)
                SetOrRemoveTag("MAXTIME", MaxTime.ToString());
            else
                RemoveTag("MAXTIME");

            if (Call > 0)
                SetOrRemoveTag("CALL", Call.ToString());
            else
                RemoveTag("CALL");

            if (DefZ != 0)
                SetOrRemoveTag("DEFZ", DefZ.ToString());
            else
                RemoveTag("DEFZ");

            if (PrefZ != 0)
                SetOrRemoveTag("PREFZ", PrefZ.ToString());
            else
                RemoveTag("PREFZ");
        }

        public void SyncTagsToTypedFields()
        {
            string value;

            if (Tags.TryGetValue("NAME", out value))
                Name = value;

            if (Tags.TryGetValue("WORLD", out value))
            {
                int parsedWorld;
                if (int.TryParse(value, out parsedWorld))
                    World = parsedWorld;
            }

            if (Tags.TryGetValue("INSTANCEID", out value))
            {
                int parsedInstanceID;
                if (int.TryParse(value, out parsedInstanceID))
                    InstanceID = parsedInstanceID;
            }

            if (Tags.TryGetValue("NPC", out value))
                Npc = value;

            if (Tags.TryGetValue("NPCLIST", out value))
                NpcList = value;

            if (Tags.TryGetValue("ITEM", out value))
                Item = value;

            if (Tags.TryGetValue("ITEMLIST", out value))
                ItemList = value;

            if (Tags.TryGetValue("MAXNPCS", out value))
            {
                int parsedMaxNpcs;
                if (int.TryParse(value, out parsedMaxNpcs))
                    MaxNpcs = parsedMaxNpcs;
            }

            if (Tags.TryGetValue("MAXITEMS", out value))
            {
                int parsedMaxItems;
                if (int.TryParse(value, out parsedMaxItems))
                    MaxItems = parsedMaxItems;
            }

            if (Tags.TryGetValue("MINTIME", out value))
            {
                int parsedMinTime;
                if (int.TryParse(value, out parsedMinTime))
                    MinTime = parsedMinTime;
            }

            if (Tags.TryGetValue("MAXTIME", out value))
            {
                int parsedMaxTime;
                if (int.TryParse(value, out parsedMaxTime))
                    MaxTime = parsedMaxTime;
            }

            if (Tags.TryGetValue("CALL", out value))
            {
                int parsedCall;
                if (int.TryParse(value, out parsedCall))
                    Call = parsedCall;
            }

            if (Tags.TryGetValue("DEFZ", out value))
            {
                int parsedDefZ;
                if (int.TryParse(value, out parsedDefZ))
                    DefZ = parsedDefZ;
            }

            if (Tags.TryGetValue("PREFZ", out value))
            {
                int parsedPrefZ;
                if (int.TryParse(value, out parsedPrefZ))
                    PrefZ = parsedPrefZ;
            }
        }

        private void SetOrRemoveTag(string key, string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                RemoveTag(key);
            else
                Tags[key] = value;
        }

        private void RemoveTag(string key)
        {
            if (Tags.ContainsKey(key))
                Tags.Remove(key);
        }

        public override string ToString()
        {
            return "[" + RegionNum + "] " + Name + " - " + GetSpawnSource();
        }
    }
}