using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;

namespace UOX3SpawnEditor
{
    public static class UOMapBitmapLoader
    {
        private const int MapBlockSize = 196;
        private const int UopMapChunkSize = 0xC4000;
        private const int StaticIndexEntrySize = 12;
        private const int StaticTileEntrySize = 7;

        private static readonly Dictionary<int, Size> worldMapDimensions = new Dictionary<int, Size>
        {
            { 0, new Size(7168, 4096) },
            { 1, new Size(7168, 4096) },
            { 2, new Size(2304, 1600) },
            { 3, new Size(2560, 2048) },
            { 4, new Size(1448, 1448) },
            { 5, new Size(1280, 4096) }
        };

        public enum StaticRenderFilter
        {
            ShowAll,
            HideTrees
        }

        public static StaticRenderFilter CurrentStaticRenderFilter = StaticRenderFilter.ShowAll;

        public static void SetStaticRenderFilter(StaticRenderFilter staticRenderFilter)
        {
            CurrentStaticRenderFilter = staticRenderFilter;
        }

        public static Dictionary<int, Bitmap> LoadMapsFromFolder(string clientFolderPath, int maxDimension)
        {
            Dictionary<int, Bitmap> loadedMaps = new Dictionary<int, Bitmap>();

            if (string.IsNullOrWhiteSpace(clientFolderPath) || !Directory.Exists(clientFolderPath))
                return loadedMaps;

            string radarColorPath = Path.Combine(clientFolderPath, "radarcol.mul");
            if (!File.Exists(radarColorPath))
                return loadedMaps;

            foreach (KeyValuePair<int, Size> entry in worldMapDimensions)
            {
                string mapPath = FindMapFilePath(clientFolderPath, entry.Key);
                if (string.IsNullOrWhiteSpace(mapPath))
                    continue;

                Bitmap mapBitmap = LoadMapBitmap(mapPath, radarColorPath, clientFolderPath, entry.Key, maxDimension);
                if (mapBitmap != null)
                    loadedMaps[entry.Key] = mapBitmap;
            }

            return loadedMaps;
        }

        public static string FindMapFilePath(string clientFolderPath, int worldNumber)
        {
            if (string.IsNullOrWhiteSpace(clientFolderPath) || !Directory.Exists(clientFolderPath))
                return string.Empty;

            string uopPath = Path.Combine(clientFolderPath, "map" + worldNumber + "LegacyMUL.uop");
            if (File.Exists(uopPath))
                return uopPath;

            string mulPath = Path.Combine(clientFolderPath, "map" + worldNumber + ".mul");
            if (File.Exists(mulPath))
                return mulPath;

            return string.Empty;
        }

        public static bool IsSupportedMapDataFile(string filePath)
        {
            if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
                return false;

            string extension = Path.GetExtension(filePath);
            if (!string.Equals(extension, ".mul", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(extension, ".uop", StringComparison.OrdinalIgnoreCase))
                return false;

            string fileName = Path.GetFileName(filePath);
            if (string.IsNullOrWhiteSpace(fileName))
                return false;

            return fileName.StartsWith("map", StringComparison.OrdinalIgnoreCase);
        }

        public static Bitmap LoadMapBitmap(string mapPath, string radarColorPath, int worldNumber, int maxDimension)
        {
            string clientFolderPath = Path.GetDirectoryName(mapPath);
            return LoadMapBitmap(mapPath, radarColorPath, clientFolderPath, worldNumber, maxDimension);
        }

        public static Bitmap LoadMapBitmap(string mapPath, string radarColorPath, string clientFolderPath, int worldNumber, int maxDimension)
        {
            if (string.IsNullOrWhiteSpace(mapPath) || !File.Exists(mapPath))
                return null;

            if (string.IsNullOrWhiteSpace(radarColorPath) || !File.Exists(radarColorPath))
                return null;

            Size worldSize;
            if (!worldMapDimensions.TryGetValue(worldNumber, out worldSize))
                return null;

            Color[] radarColors = LoadRadarColors(radarColorPath);

            using (MapDataReader mapReader = MapDataReader.Create(mapPath, worldNumber))
            using (StaticDataReader staticReader = StaticDataReader.Create(clientFolderPath, worldNumber, worldSize))
            {
                if (mapReader == null)
                    return null;

                return RenderMapBitmap(mapReader, staticReader, worldSize, radarColors, maxDimension);
            }
        }

        private static Bitmap RenderMapBitmap(MapDataReader mapReader, StaticDataReader staticReader, Size worldSize, Color[] radarColors, int maxDimension)
        {
            Size renderSize = CalculateRenderSize(worldSize, maxDimension);

            Bitmap bitmap = new Bitmap(renderSize.Width, renderSize.Height, PixelFormat.Format32bppArgb);
            Rectangle bounds = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
            BitmapData bitmapData = bitmap.LockBits(bounds, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);

            try
            {
                int stride = bitmapData.Stride;
                byte[] pixelBuffer = new byte[stride * bitmap.Height];
                int blocksPerColumn = worldSize.Height / 8;

                for (int renderY = 0; renderY < renderSize.Height; renderY++)
                {
                    int mapY = (int)((long)renderY * worldSize.Height / renderSize.Height);
                    int rowOffset = renderY * stride;

                    for (int renderX = 0; renderX < renderSize.Width; renderX++)
                    {
                        int mapX = (int)((long)renderX * worldSize.Width / renderSize.Width);
                        ushort landTileID = ReadLandTileIDAt(mapReader, blocksPerColumn, mapX, mapY);

                        Color tileColor = landTileID < radarColors.Length
                            ? radarColors[landTileID]
                            : Color.Black;

                        int pixelOffset = rowOffset + (renderX * 4);
                        pixelBuffer[pixelOffset] = tileColor.B;
                        pixelBuffer[pixelOffset + 1] = tileColor.G;
                        pixelBuffer[pixelOffset + 2] = tileColor.R;
                        pixelBuffer[pixelOffset + 3] = 255;
                    }
                }

                if (staticReader != null && staticReader.IsAvailable)
                    RenderStaticsOverlay(staticReader, worldSize, renderSize, pixelBuffer, stride, radarColors);

                Marshal.Copy(pixelBuffer, 0, bitmapData.Scan0, pixelBuffer.Length);
            }
            finally
            {
                bitmap.UnlockBits(bitmapData);
            }

            return bitmap;
        }

        private static void RenderStaticsOverlay(StaticDataReader staticReader, Size worldSize, Size renderSize, byte[] pixelBuffer, int stride, Color[] radarColors)
        {
            int blockWidth = worldSize.Width / 8;
            int blockHeight = worldSize.Height / 8;

            Dictionary<int, StaticPixelEntry> staticPixelMap = new Dictionary<int, StaticPixelEntry>();

            for (int blockX = 0; blockX < blockWidth; blockX++)
            {
                for (int blockY = 0; blockY < blockHeight; blockY++)
                {
                    StaticTileEntry[] staticTiles = staticReader.GetStaticBlock(blockX, blockY);
                    if (staticTiles == null || staticTiles.Length == 0)
                        continue;

                    CollectStaticBlockPixels(staticPixelMap, worldSize, renderSize, stride, blockX, blockY, staticTiles);
                }
            }

            foreach (KeyValuePair<int, StaticPixelEntry> entry in staticPixelMap)
            {
                int pixelOffset = entry.Key;
                StaticPixelEntry staticPixelEntry = entry.Value;

                int radarIndex = 0x4000 + staticPixelEntry.ItemID;
                if (radarIndex < 0 || radarIndex >= radarColors.Length)
                    continue;

                Color staticColor = radarColors[radarIndex];

                if (IsNearlyBlack(staticColor))
                    continue;

                pixelBuffer[pixelOffset] = staticColor.B;
                pixelBuffer[pixelOffset + 1] = staticColor.G;
                pixelBuffer[pixelOffset + 2] = staticColor.R;
                pixelBuffer[pixelOffset + 3] = 255;
            }
        }

        private static void CollectStaticBlockPixels(Dictionary<int, StaticPixelEntry> staticPixelMap, Size worldSize, Size renderSize, int stride, int blockX, int blockY, StaticTileEntry[] staticTiles)
        {
            for (int index = 0; index < staticTiles.Length; index++)
            {
                StaticTileEntry staticTile = staticTiles[index];

                if (ShouldSkipStatic(staticTile))
                    continue;

                int worldX = (blockX * 8) + staticTile.X;
                int worldY = (blockY * 8) + staticTile.Y;

                if (worldX < 0 || worldY < 0 || worldX >= worldSize.Width || worldY >= worldSize.Height)
                    continue;

                int renderX = (int)((long)worldX * renderSize.Width / worldSize.Width);
                int renderY = (int)((long)worldY * renderSize.Height / worldSize.Height);

                if (renderX < 0 || renderY < 0 || renderX >= renderSize.Width || renderY >= renderSize.Height)
                    continue;

                int pixelOffset = (renderY * stride) + (renderX * 4);

                StaticPixelEntry newEntry = new StaticPixelEntry();
                newEntry.ItemID = staticTile.ItemID;
                newEntry.Z = staticTile.Z;

                StaticPixelEntry existingEntry;
                if (staticPixelMap.TryGetValue(pixelOffset, out existingEntry))
                {
                    if (PreferStatic(newEntry, existingEntry))
                        staticPixelMap[pixelOffset] = newEntry;
                }
                else
                {
                    staticPixelMap[pixelOffset] = newEntry;
                }
            }
        }

        private static bool ShouldSkipStatic(StaticTileEntry staticTile)
        {
            if (staticTile.ItemID == 0)
                return true;

            if (staticTile.Z < -40)
                return true;

            if (CurrentStaticRenderFilter == StaticRenderFilter.HideTrees && IsTreeStatic(staticTile.ItemID))
                return true;

            return false;
        }

        private static bool IsTreeStatic(ushort itemID)
        {
            if (itemID >= 0x0CCA && itemID <= 0x0CD0)
                return true;

            if (itemID >= 0x0CD3 && itemID <= 0x0CD8)
                return true;

            if (itemID >= 0x0CDA && itemID <= 0x0CE0)
                return true;

            if (itemID >= 0x0CE3 && itemID <= 0x0CE8)
                return true;

            if (itemID >= 0x0D01 && itemID <= 0x0D06)
                return true;

            if (itemID >= 0x0D09 && itemID <= 0x0D0E)
                return true;

            if (itemID >= 0x0D11 && itemID <= 0x0D16)
                return true;

            if (itemID >= 0x0D29 && itemID <= 0x0D2F)
                return true;

            if (itemID >= 0x0D45 && itemID <= 0x0D4F)
                return true;

            if (itemID >= 0x0D94 && itemID <= 0x0D9D)
                return true;

            if (itemID >= 0x0DA4 && itemID <= 0x0DAA)
                return true;

            if (itemID >= 0x0CC9 && itemID <= 0x0CCE)
                return true;

            return false;
        }

        private static bool PreferStatic(StaticPixelEntry newEntry, StaticPixelEntry existingEntry)
        {
            if (newEntry.Z != existingEntry.Z)
                return newEntry.Z > existingEntry.Z;

            return newEntry.ItemID > existingEntry.ItemID;
        }

        private static bool IsNearlyBlack(Color color)
        {
            return color.R < 12 && color.G < 12 && color.B < 12;
        }

        private static ushort ReadLandTileIDAt(MapDataReader mapReader, int blocksPerColumn, int mapX, int mapY)
        {
            int blockX = mapX / 8;
            int blockY = mapY / 8;
            int cellX = mapX % 8;
            int cellY = mapY % 8;

            long blockIndex = (blockX * blocksPerColumn) + blockY;
            long blockOffset = blockIndex * MapBlockSize;

            byte[] blockBuffer = mapReader.GetBytes(blockOffset, MapBlockSize);
            if (blockBuffer == null || blockBuffer.Length < MapBlockSize)
                return 0;

            int cellIndex = (cellY * 8) + cellX;
            int cellOffset = 4 + (cellIndex * 3);

            if (cellOffset + 1 >= blockBuffer.Length)
                return 0;

            return BitConverter.ToUInt16(blockBuffer, cellOffset);
        }

        private static Size CalculateRenderSize(Size worldSize, int maxDimension)
        {
            if (maxDimension <= 0)
                return worldSize;

            if (worldSize.Width <= maxDimension && worldSize.Height <= maxDimension)
                return worldSize;

            float scale = Math.Min((float)maxDimension / worldSize.Width, (float)maxDimension / worldSize.Height);
            int width = Math.Max(1, (int)Math.Round(worldSize.Width * scale));
            int height = Math.Max(1, (int)Math.Round(worldSize.Height * scale));

            return new Size(width, height);
        }

        private static Color[] LoadRadarColors(string radarColorPath)
        {
            Color[] colors = new Color[65536];

            using (BinaryReader reader = new BinaryReader(File.Open(radarColorPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)))
            {
                for (int index = 0; index < colors.Length && reader.BaseStream.Position <= reader.BaseStream.Length - 2; index++)
                {
                    ushort colorValue = reader.ReadUInt16();
                    colors[index] = ConvertRadarColor(colorValue);
                }
            }

            return colors;
        }

        private static Color ConvertRadarColor(ushort colorValue)
        {
            int red = ((colorValue >> 10) & 0x1F) * 255 / 31;
            int green = ((colorValue >> 5) & 0x1F) * 255 / 31;
            int blue = (colorValue & 0x1F) * 255 / 31;
            return Color.FromArgb(red, green, blue);
        }

        private abstract class MapDataReader : IDisposable
        {
            public abstract byte[] GetBytes(long offset, int count);
            public abstract void Dispose();

            public static MapDataReader Create(string mapPath, int worldNumber)
            {
                string extension = Path.GetExtension(mapPath);

                if (string.Equals(extension, ".uop", StringComparison.OrdinalIgnoreCase))
                    return new UopMapDataReader(mapPath, worldNumber);

                return new MulMapDataReader(mapPath);
            }
        }

        private sealed class MulMapDataReader : MapDataReader
        {
            private readonly FileStream mapStream;
            private long lastBlockOffset = -1;
            private readonly byte[] blockBuffer = new byte[MapBlockSize];

            public MulMapDataReader(string mapPath)
            {
                mapStream = File.Open(mapPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            }

            public override byte[] GetBytes(long offset, int count)
            {
                if (count != MapBlockSize)
                    throw new InvalidOperationException("MulMapDataReader only supports whole map blocks.");

                if (offset != lastBlockOffset)
                {
                    mapStream.Seek(offset, SeekOrigin.Begin);

                    int totalRead = 0;
                    while (totalRead < MapBlockSize)
                    {
                        int read = mapStream.Read(blockBuffer, totalRead, MapBlockSize - totalRead);
                        if (read <= 0)
                            break;

                        totalRead += read;
                    }

                    if (totalRead < MapBlockSize)
                        Array.Clear(blockBuffer, totalRead, MapBlockSize - totalRead);

                    lastBlockOffset = offset;
                }

                return blockBuffer;
            }

            public override void Dispose()
            {
                mapStream.Dispose();
            }
        }

        private sealed class UopMapDataReader : MapDataReader
        {
            private readonly FileStream uopStream;
            private readonly UopLogicalChunk[] logicalChunks;
            private readonly Dictionary<int, byte[]> decompressedChunkCache = new Dictionary<int, byte[]>();
            private readonly byte[] blockBuffer = new byte[MapBlockSize];

            public UopMapDataReader(string uopPath, int worldNumber)
            {
                uopStream = File.Open(uopPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                logicalChunks = BuildLogicalChunkTable(uopStream, uopPath, worldNumber);
            }

            public override byte[] GetBytes(long offset, int count)
            {
                if (count != MapBlockSize)
                    throw new InvalidOperationException("UopMapDataReader only supports whole map blocks.");

                Array.Clear(blockBuffer, 0, blockBuffer.Length);

                int bytesCopied = 0;
                long logicalOffset = offset;

                while (bytesCopied < count)
                {
                    int chunkIndex = (int)(logicalOffset / UopMapChunkSize);
                    int chunkOffset = (int)(logicalOffset % UopMapChunkSize);

                    if (chunkIndex < 0 || chunkIndex >= logicalChunks.Length)
                        break;

                    byte[] chunkData = GetChunkData(chunkIndex);
                    if (chunkData == null || chunkOffset >= chunkData.Length)
                        break;

                    int available = Math.Min(count - bytesCopied, chunkData.Length - chunkOffset);
                    Buffer.BlockCopy(chunkData, chunkOffset, blockBuffer, bytesCopied, available);

                    bytesCopied += available;
                    logicalOffset += available;
                }

                return blockBuffer;
            }

            private byte[] GetChunkData(int chunkIndex)
            {
                byte[] chunkData;
                if (decompressedChunkCache.TryGetValue(chunkIndex, out chunkData))
                    return chunkData;

                UopLogicalChunk chunk = logicalChunks[chunkIndex];
                if (!chunk.IsValid)
                    return null;

                uopStream.Seek(chunk.DataOffset, SeekOrigin.Begin);

                byte[] rawData = new byte[chunk.StoredLength];
                int totalRead = 0;

                while (totalRead < rawData.Length)
                {
                    int read = uopStream.Read(rawData, totalRead, rawData.Length - totalRead);
                    if (read <= 0)
                        break;

                    totalRead += read;
                }

                if (totalRead < rawData.Length)
                    Array.Resize(ref rawData, totalRead);

                if (chunk.IsCompressed)
                    chunkData = DecompressZlib(rawData, chunk.ExpectedLength);
                else
                    chunkData = rawData;

                decompressedChunkCache[chunkIndex] = chunkData;
                return chunkData;
            }

            private static UopLogicalChunk[] BuildLogicalChunkTable(FileStream stream, string uopPath, int worldNumber)
            {
                int expectedChunkCount = GetExpectedChunkCount(worldNumber);
                UopLogicalChunk[] chunks = new UopLogicalChunk[expectedChunkCount];

                string uopPattern = Path.GetFileNameWithoutExtension(uopPath).ToLowerInvariant();
                Dictionary<ulong, int> hashLookup = new Dictionary<ulong, int>(expectedChunkCount);

                for (int chunkIndex = 0; chunkIndex < expectedChunkCount; chunkIndex++)
                {
                    string entryName = "build/" + uopPattern + "/" + chunkIndex.ToString("D8") + ".dat";
                    ulong entryHash = HashFileName(entryName);

                    if (!hashLookup.ContainsKey(entryHash))
                        hashLookup.Add(entryHash, chunkIndex);
                }

                using (BinaryReader reader = new BinaryReader(stream, System.Text.Encoding.Default, true))
                {
                    reader.BaseStream.Seek(0, SeekOrigin.Begin);

                    int magic = reader.ReadInt32();
                    if (magic != 0x50594D)
                        throw new InvalidDataException("Bad UOP file.");

                    reader.ReadUInt32();
                    reader.ReadUInt32();
                    long nextBlock = reader.ReadInt64();
                    reader.ReadUInt32();
                    reader.ReadInt32();

                    while (nextBlock != 0)
                    {
                        reader.BaseStream.Seek(nextBlock, SeekOrigin.Begin);

                        int filesCount = reader.ReadInt32();
                        nextBlock = reader.ReadInt64();

                        for (int fileIndex = 0; fileIndex < filesCount; fileIndex++)
                        {
                            long dataOffset = reader.ReadInt64();
                            int headerLength = reader.ReadInt32();
                            int compressedLength = reader.ReadInt32();
                            int decompressedLength = reader.ReadInt32();
                            ulong entryHash = reader.ReadUInt64();
                            reader.ReadUInt32();
                            short compressionFlag = reader.ReadInt16();

                            if (dataOffset == 0)
                                continue;

                            int chunkIndex;
                            if (!hashLookup.TryGetValue(entryHash, out chunkIndex))
                                continue;

                            UopLogicalChunk chunk = new UopLogicalChunk();
                            chunk.DataOffset = dataOffset + headerLength;
                            chunk.StoredLength = compressedLength;
                            chunk.ExpectedLength = decompressedLength;
                            chunk.IsCompressed = (compressionFlag == 1);
                            chunk.IsValid = true;

                            chunks[chunkIndex] = chunk;
                        }
                    }
                }

                return chunks;
            }

            private static int GetExpectedChunkCount(int worldNumber)
            {
                Size worldSize;
                if (!worldMapDimensions.TryGetValue(worldNumber, out worldSize))
                    return 0;

                long blockWidth = worldSize.Width / 8;
                long blockHeight = worldSize.Height / 8;
                long totalBlocks = blockWidth * blockHeight;
                long totalBytes = totalBlocks * MapBlockSize;

                return (int)((totalBytes + UopMapChunkSize - 1) / UopMapChunkSize);
            }

            private static byte[] DecompressZlib(byte[] compressedData, int expectedLength)
            {
                using (MemoryStream inputStream = new MemoryStream(compressedData))
                using (ZLibStream zlibStream = new ZLibStream(inputStream, CompressionMode.Decompress, false))
                using (MemoryStream outputStream = new MemoryStream(expectedLength > 0 ? expectedLength : compressedData.Length * 2))
                {
                    zlibStream.CopyTo(outputStream);
                    return outputStream.ToArray();
                }
            }

            public override void Dispose()
            {
                foreach (KeyValuePair<int, byte[]> entry in decompressedChunkCache)
                {
                    byte[] value = entry.Value;
                    if (value != null)
                        Array.Clear(value, 0, value.Length);
                }

                decompressedChunkCache.Clear();
                uopStream.Dispose();
            }
        }

        private abstract class StaticDataReader : IDisposable
        {
            public abstract bool IsAvailable { get; }
            public abstract StaticTileEntry[] GetStaticBlock(int blockX, int blockY);
            public abstract void Dispose();

            public static StaticDataReader Create(string clientFolderPath, int worldNumber, Size worldSize)
            {
                if (string.IsNullOrWhiteSpace(clientFolderPath) || !Directory.Exists(clientFolderPath))
                    return new NullStaticDataReader();

                string staticIndexPath = Path.Combine(clientFolderPath, "staidx" + worldNumber + ".mul");
                string staticDataPath = Path.Combine(clientFolderPath, "statics" + worldNumber + ".mul");

                if (!File.Exists(staticIndexPath) || !File.Exists(staticDataPath))
                    return new NullStaticDataReader();

                return new MulStaticDataReader(staticIndexPath, staticDataPath, worldSize);
            }
        }

        private sealed class NullStaticDataReader : StaticDataReader
        {
            public override bool IsAvailable
            {
                get { return false; }
            }

            public override StaticTileEntry[] GetStaticBlock(int blockX, int blockY)
            {
                return null;
            }

            public override void Dispose()
            {
            }
        }

        private sealed class MulStaticDataReader : StaticDataReader
        {
            private readonly FileStream staticIndexStream;
            private readonly FileStream staticDataStream;
            private readonly StaticBlockEntry[] staticBlockEntries;
            private readonly Dictionary<int, StaticTileEntry[]> blockCache = new Dictionary<int, StaticTileEntry[]>();
            private readonly int blockWidth;
            private readonly int blockHeight;

            public MulStaticDataReader(string staticIndexPath, string staticDataPath, Size worldSize)
            {
                blockWidth = worldSize.Width / 8;
                blockHeight = worldSize.Height / 8;

                staticIndexStream = File.Open(staticIndexPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                staticDataStream = File.Open(staticDataPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);

                int expectedEntryCount = blockWidth * blockHeight;
                staticBlockEntries = new StaticBlockEntry[expectedEntryCount];

                using (BinaryReader reader = new BinaryReader(staticIndexStream, System.Text.Encoding.Default, true))
                {
                    for (int index = 0; index < expectedEntryCount; index++)
                    {
                        if (reader.BaseStream.Position + StaticIndexEntrySize > reader.BaseStream.Length)
                        {
                            staticBlockEntries[index].Lookup = -1;
                            staticBlockEntries[index].Length = -1;
                            staticBlockEntries[index].Extra = -1;
                            continue;
                        }

                        staticBlockEntries[index].Lookup = reader.ReadInt32();
                        staticBlockEntries[index].Length = reader.ReadInt32();
                        staticBlockEntries[index].Extra = reader.ReadInt32();
                    }
                }
            }

            public override bool IsAvailable
            {
                get { return true; }
            }

            public override StaticTileEntry[] GetStaticBlock(int blockX, int blockY)
            {
                if (blockX < 0 || blockY < 0 || blockX >= blockWidth || blockY >= blockHeight)
                    return null;

                int blockIndex = (blockX * blockHeight) + blockY;

                StaticTileEntry[] cachedTiles;
                if (blockCache.TryGetValue(blockIndex, out cachedTiles))
                    return cachedTiles;

                StaticBlockEntry blockEntry = staticBlockEntries[blockIndex];
                if (blockEntry.Lookup < 0 || blockEntry.Length <= 0)
                {
                    blockCache[blockIndex] = null;
                    return null;
                }

                if (blockEntry.Length % StaticTileEntrySize != 0)
                {
                    blockCache[blockIndex] = null;
                    return null;
                }

                int tileCount = blockEntry.Length / StaticTileEntrySize;
                if (tileCount <= 0)
                {
                    blockCache[blockIndex] = null;
                    return null;
                }

                StaticTileEntry[] tiles = new StaticTileEntry[tileCount];
                staticDataStream.Seek(blockEntry.Lookup, SeekOrigin.Begin);

                byte[] buffer = new byte[blockEntry.Length];
                int totalRead = 0;

                while (totalRead < buffer.Length)
                {
                    int read = staticDataStream.Read(buffer, totalRead, buffer.Length - totalRead);
                    if (read <= 0)
                        break;

                    totalRead += read;
                }

                if (totalRead < buffer.Length)
                {
                    blockCache[blockIndex] = null;
                    return null;
                }

                using (MemoryStream memoryStream = new MemoryStream(buffer))
                using (BinaryReader reader = new BinaryReader(memoryStream))
                {
                    for (int tileIndex = 0; tileIndex < tileCount; tileIndex++)
                    {
                        tiles[tileIndex].ItemID = reader.ReadUInt16();
                        tiles[tileIndex].X = reader.ReadByte();
                        tiles[tileIndex].Y = reader.ReadByte();
                        tiles[tileIndex].Z = reader.ReadSByte();
                        tiles[tileIndex].Hue = reader.ReadInt16();
                    }
                }

                blockCache[blockIndex] = tiles;
                return tiles;
            }

            public override void Dispose()
            {
                blockCache.Clear();
                staticIndexStream.Dispose();
                staticDataStream.Dispose();
            }
        }

        private struct StaticBlockEntry
        {
            public int Lookup;
            public int Length;
            public int Extra;
        }

        private struct StaticTileEntry
        {
            public ushort ItemID;
            public byte X;
            public byte Y;
            public sbyte Z;
            public short Hue;
        }

        private struct StaticPixelEntry
        {
            public ushort ItemID;
            public sbyte Z;
        }

        private struct UopLogicalChunk
        {
            public long DataOffset;
            public int StoredLength;
            public int ExpectedLength;
            public bool IsCompressed;
            public bool IsValid;
        }

        private static ulong HashFileName(string value)
        {
            uint eax = 0;
            uint ecx = 0;
            uint edx = 0;
            uint ebx = 0;
            uint esi = 0;
            uint edi = 0;

            ebx = edi = esi = (uint)value.Length + 0xDEADBEEF;
            int index = 0;

            for (index = 0; index + 12 < value.Length; index += 12)
            {
                edi = (uint)((value[index + 7] << 24) | (value[index + 6] << 16) | (value[index + 5] << 8) | value[index + 4]) + edi;
                esi = (uint)((value[index + 11] << 24) | (value[index + 10] << 16) | (value[index + 9] << 8) | value[index + 8]) + esi;
                edx = (uint)((value[index + 3] << 24) | (value[index + 2] << 16) | (value[index + 1] << 8) | value[index]) - esi;

                edx = (edx + ebx) ^ (esi >> 28) ^ (esi << 4);
                esi += edi;
                edi = (edi - edx) ^ (edx >> 26) ^ (edx << 6);
                edx += esi;
                esi = (esi - edi) ^ (edi >> 24) ^ (edi << 8);
                edi += edx;
                ebx = (edx - esi) ^ (esi >> 16) ^ (esi << 16);
                esi += edi;
                edi = (edi - ebx) ^ (ebx >> 13) ^ (ebx << 19);
                ebx += esi;
                esi = (esi - edi) ^ (edi >> 28) ^ (edi << 4);
                edi += ebx;
            }

            if (value.Length - index > 0)
            {
                switch (value.Length - index)
                {
                    case 12:
                        esi += (uint)value[index + 11] << 24;
                        goto case 11;
                    case 11:
                        esi += (uint)value[index + 10] << 16;
                        goto case 10;
                    case 10:
                        esi += (uint)value[index + 9] << 8;
                        goto case 9;
                    case 9:
                        esi += (uint)value[index + 8];
                        goto case 8;
                    case 8:
                        edi += (uint)value[index + 7] << 24;
                        goto case 7;
                    case 7:
                        edi += (uint)value[index + 6] << 16;
                        goto case 6;
                    case 6:
                        edi += (uint)value[index + 5] << 8;
                        goto case 5;
                    case 5:
                        edi += (uint)value[index + 4];
                        goto case 4;
                    case 4:
                        ebx += (uint)value[index + 3] << 24;
                        goto case 3;
                    case 3:
                        ebx += (uint)value[index + 2] << 16;
                        goto case 2;
                    case 2:
                        ebx += (uint)value[index + 1] << 8;
                        goto case 1;
                    case 1:
                        ebx += (uint)value[index];
                        break;
                }

                esi = (esi ^ edi) - ((edi >> 18) ^ (edi << 14));
                ecx = (esi ^ ebx) - ((esi >> 21) ^ (esi << 11));
                edi = (edi ^ ecx) - ((ecx >> 7) ^ (ecx << 25));
                esi = (esi ^ edi) - ((edi >> 16) ^ (edi << 16));
                edx = (esi ^ ecx) - ((esi >> 28) ^ (esi << 4));
                edi = (edi ^ edx) - ((edx >> 18) ^ (edx << 14));
                eax = (esi ^ edi) - ((edi >> 8) ^ (edi << 24));

                return ((ulong)edi << 32) | eax;
            }

            return ((ulong)esi << 32) | eax;
        }
    }
}