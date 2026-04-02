using System.Drawing;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using UOX3SpawnEditor;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("SpawnEditorFrontend", policy =>
    {
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowAnyOrigin();
    });
});

builder.Services.Configure<MapRenderOptions>(
    builder.Configuration.GetSection("MapRendering")
);
builder.Services.Configure<SpawnDataOptions>(
    builder.Configuration.GetSection("SpawnData")
);

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors("SpawnEditorFrontend");

app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api/maps"))
    {
        context.Response.OnStarting(() =>
        {
            context.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
            context.Response.Headers["Pragma"] = "no-cache";
            context.Response.Headers["Expires"] = "0";
            return Task.CompletedTask;
        });
    }

    await next();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapGet("/api/spawn/health", () =>
{
    return Results.Ok(new
    {
        ok = true,
        service = "UOX3 Spawn Editor Phase 3 API",
        timestampUtc = DateTime.UtcNow
    });
});

app.MapGet("/api/spawn/bootstrap", ([FromServices] IOptions<SpawnDataOptions> spawnDataOptionsAccessor) =>
{
    SpawnDataOptions spawnDataOptions = spawnDataOptionsAccessor.Value;
    string spawnDataFolderPath = spawnDataOptions.SpawnDataFolderPath ?? string.Empty;

    if (string.IsNullOrWhiteSpace(spawnDataFolderPath) || !Directory.Exists(spawnDataFolderPath))
    {
        return Results.BadRequest(new
        {
            error = "SpawnData:SpawnDataFolderPath is missing or invalid."
        });
    }

    List<string> sourceFiles = GetRelativeSpawnSourceFiles(
        spawnDataFolderPath,
        spawnDataOptions.Recursive
    );

    var response = new BootstrapResponse
    {
        Maps = GetMapWorldDefinitions(),
        SourceFiles = sourceFiles
    };

    return Results.Ok(response);
});

app.MapGet("/api/spawn/files", ([FromServices] IOptions<SpawnDataOptions> spawnDataOptionsAccessor) =>
{
    SpawnDataOptions spawnDataOptions = spawnDataOptionsAccessor.Value;
    string spawnDataFolderPath = spawnDataOptions.SpawnDataFolderPath ?? string.Empty;

    if (string.IsNullOrWhiteSpace(spawnDataFolderPath) || !Directory.Exists(spawnDataFolderPath))
    {
        return Results.BadRequest(new
        {
            error = "SpawnData:SpawnDataFolderPath is missing or invalid."
        });
    }

    return Results.Ok(new
    {
        sourceFiles = GetRelativeSpawnSourceFiles(
            spawnDataFolderPath,
            spawnDataOptions.Recursive
        )
    });
});

app.MapGet("/api/spawn/regions", (
    [FromQuery] int? world,
    [FromQuery] string? sourceFilePath,
    [FromServices] IOptions<SpawnDataOptions> spawnDataOptionsAccessor) =>
{
    SpawnDataOptions spawnDataOptions = spawnDataOptionsAccessor.Value;
    string spawnDataFolderPath = spawnDataOptions.SpawnDataFolderPath ?? string.Empty;

    if (string.IsNullOrWhiteSpace(spawnDataFolderPath) || !Directory.Exists(spawnDataFolderPath))
    {
        return Results.BadRequest(new
        {
            error = "SpawnData:SpawnDataFolderPath is missing or invalid."
        });
    }

    List<SpawnRegion> parsedRegions;

    if (!string.IsNullOrWhiteSpace(sourceFilePath))
    {
        string fullSourceFilePath = ResolveSpawnSourceFilePath(spawnDataFolderPath, sourceFilePath);
        parsedRegions = SpawnRegionParser.LoadSpawnRegions(fullSourceFilePath, world ?? -1);
    }
    else
    {
        parsedRegions = SpawnRegionParser.LoadSpawnRegionsFromFolder(
            spawnDataFolderPath,
            worldFilter: world ?? -1,
            recursive: spawnDataOptions.Recursive
        );
    }

    var response = new RegionsResponse
    {
        Regions = parsedRegions
            .OrderBy(region => region.SourceFilePath, StringComparer.OrdinalIgnoreCase)
            .ThenBy(region => region.RegionNum)
            .Select(region => MapToApiRegion(region, spawnDataFolderPath))
            .ToList()
    };

    return Results.Ok(response);
});

app.MapPost("/api/spawn/save", ([FromBody] SaveRequest request, [FromServices] IOptions<SpawnDataOptions> spawnDataOptionsAccessor) =>
{
    if (request == null || request.Regions == null || request.Regions.Count == 0)
        return Results.BadRequest(new { error = "No regions were provided." });

    if (request.SourceFilePaths == null || request.SourceFilePaths.Count == 0)
        return Results.BadRequest(new { error = "No source files were provided." });

    SpawnDataOptions spawnDataOptions = spawnDataOptionsAccessor.Value;
    string spawnDataFolderPath = spawnDataOptions.SpawnDataFolderPath ?? string.Empty;

    if (string.IsNullOrWhiteSpace(spawnDataFolderPath) || !Directory.Exists(spawnDataFolderPath))
    {
        return Results.BadRequest(new
        {
            error = "SpawnData:SpawnDataFolderPath is missing or invalid."
        });
    }

    HashSet<string> requestedSourceFilePaths = new HashSet<string>(
        request.SourceFilePaths
            .Where(filePath => !string.IsNullOrWhiteSpace(filePath))
            .Select(filePath => ResolveSpawnSourceFilePath(spawnDataFolderPath, filePath)),
        StringComparer.OrdinalIgnoreCase
    );

    var regions = request.Regions
        .Select(region => MapFromApiRegion(region, spawnDataFolderPath))
        .Where(region => requestedSourceFilePaths.Contains(region.SourceFilePath))
        .ToList();

    foreach (IGrouping<string, SpawnRegion> fileGroup in regions.GroupBy(region => region.SourceFilePath, StringComparer.OrdinalIgnoreCase))
    {
        ValidateSpawnRegionsForSave(fileGroup.Key, fileGroup.ToList());
    }

    var generatedFiles = new List<GeneratedFileResponse>();

    foreach (IGrouping<string, SpawnRegion> fileGroup in regions
        .Where(region => !string.IsNullOrWhiteSpace(region.SourceFilePath))
        .GroupBy(region => region.SourceFilePath, StringComparer.OrdinalIgnoreCase))
    {
        string fileName = Path.GetFileName(fileGroup.Key);
        List<SpawnRegion> fileRegions = fileGroup.OrderBy(region => region.RegionNum).ToList();

        Directory.CreateDirectory(Path.GetDirectoryName(fileGroup.Key)!);
        SpawnRegionParser.SaveSpawnRegions(fileGroup.Key, fileRegions);

        generatedFiles.Add(new GeneratedFileResponse
        {
            FileName = fileName,
            Content = File.ReadAllText(fileGroup.Key)
        });
    }

    return Results.Ok(new SaveResponse
    {
        Files = generatedFiles.OrderBy(file => file.FileName, StringComparer.OrdinalIgnoreCase).ToList()
    });
});

app.MapGet("/api/maps", () =>
{
    return Results.Ok(GetMapWorldDefinitions());
});

app.MapGet("/api/maps/status", ([FromServices] IOptions<MapRenderOptions> mapRenderOptionsAccessor) =>
{
    MapRenderOptions mapRenderOptions = mapRenderOptionsAccessor.Value;

    if (string.IsNullOrWhiteSpace(mapRenderOptions.ClientFolderPath) || !Directory.Exists(mapRenderOptions.ClientFolderPath))
    {
        return Results.Ok(new
        {
            configured = false,
            clientFolderPath = mapRenderOptions.ClientFolderPath,
            message = "MapRendering:ClientFolderPath is missing or invalid."
        });
    }

    string radarColorPath = Path.Combine(mapRenderOptions.ClientFolderPath, "radarcol.mul");

    return Results.Ok(new
    {
        configured = File.Exists(radarColorPath),
        clientFolderPath = mapRenderOptions.ClientFolderPath,
        radarColorFound = File.Exists(radarColorPath),
        maxDimension = mapRenderOptions.MaxDimension,
        hideTrees = mapRenderOptions.HideTrees
    });
});

app.MapGet("/api/maps/{worldId:int}.png", ([FromRoute] int worldId, [FromServices] IOptions<MapRenderOptions> mapRenderOptionsAccessor) =>
{
    MapRenderOptions mapRenderOptions = mapRenderOptionsAccessor.Value;

    if (string.IsNullOrWhiteSpace(mapRenderOptions.ClientFolderPath) || !Directory.Exists(mapRenderOptions.ClientFolderPath))
    {
        return Results.BadRequest(new
        {
            error = "MapRendering:ClientFolderPath is missing or invalid."
        });
    }

    string radarColorPath = Path.Combine(mapRenderOptions.ClientFolderPath, "radarcol.mul");
    if (!File.Exists(radarColorPath))
    {
        return Results.BadRequest(new
        {
            error = "Could not find radarcol.mul in the configured client folder."
        });
    }

    string mapPath = UOMapBitmapLoader.FindMapFilePath(mapRenderOptions.ClientFolderPath, worldId);
    if (string.IsNullOrWhiteSpace(mapPath) || !File.Exists(mapPath))
    {
        return Results.NotFound(new
        {
            error = "Could not find map data for that world.",
            worldId = worldId
        });
    }

    if (mapRenderOptions.HideTrees)
        UOMapBitmapLoader.SetStaticRenderFilter(UOMapBitmapLoader.StaticRenderFilter.HideTrees);
    else
        UOMapBitmapLoader.SetStaticRenderFilter(UOMapBitmapLoader.StaticRenderFilter.ShowAll);

    using Bitmap mapBitmap = UOMapBitmapLoader.LoadMapBitmap(
        mapPath,
        radarColorPath,
        mapRenderOptions.ClientFolderPath,
        worldId,
        mapRenderOptions.MaxDimension
    );

    if (mapBitmap == null)
    {
        return Results.Problem(
            title: "Map render failed",
            detail: "UOMapBitmapLoader returned null.",
            statusCode: 500
        );
    }

    int rawWorldWidth = worldId switch
    {
        0 => 7168,
        1 => 7168,
        2 => 2304,
        3 => 2560,
        4 => 1448,
        5 => 1280,
        _ => mapBitmap.Width
    };

    int playableWorldWidth = worldId switch
    {
        0 => 6144,
        1 => 6144,
        2 => 2304,
        3 => 2560,
        4 => 1448,
        5 => 1280,
        _ => rawWorldWidth
    };

    int croppedWidth = mapBitmap.Width;

    if (playableWorldWidth < rawWorldWidth)
    {
        croppedWidth = (int)Math.Round(mapBitmap.Width * (playableWorldWidth / (double)rawWorldWidth));
        croppedWidth = Math.Max(1, Math.Min(croppedWidth, mapBitmap.Width));
    }

    using Bitmap finalBitmap = croppedWidth == mapBitmap.Width
        ? new Bitmap(mapBitmap)
        : CropBitmapLeft(mapBitmap, croppedWidth);

    using MemoryStream memoryStream = new MemoryStream();
    finalBitmap.Save(memoryStream, System.Drawing.Imaging.ImageFormat.Png);
    memoryStream.Position = 0;

    return Results.File(
        memoryStream.ToArray(),
        "image/png",
        fileDownloadName: null,
        lastModified: null,
        entityTag: null,
        enableRangeProcessing: false
    );
});

app.Run();

static ApiSpawnRegion MapToApiRegion(SpawnRegion spawnRegion, string spawnDataFolderPath)
{
    Rectangle firstBounds = spawnRegion.Bounds.Count > 0
        ? spawnRegion.Bounds[0]
        : Rectangle.Empty;

    return new ApiSpawnRegion
    {
        Id = CreateRegionId(spawnRegion),
        RegionNum = spawnRegion.RegionNum,
        SectionHeader = "REGIONSPAWN " + spawnRegion.RegionNum,
        Name = spawnRegion.Name,
        World = spawnRegion.World,
        InstanceID = spawnRegion.InstanceID,
        FileName = spawnRegion.GetShortSourceFileName(),
        SourceFilePath = Path.GetRelativePath(spawnDataFolderPath, spawnRegion.SourceFilePath ?? string.Empty),
        Bounds = new ApiBounds
        {
            X1 = firstBounds.Left,
            Y1 = firstBounds.Top,
            X2 = firstBounds.Right,
            Y2 = firstBounds.Bottom
        },
        Tags = new Dictionary<string, string>(spawnRegion.Tags, StringComparer.OrdinalIgnoreCase)
    };
}

static SpawnRegion MapFromApiRegion(ApiSpawnRegion apiRegion, string spawnDataFolderPath)
{
    var spawnRegion = new SpawnRegion
    {
        RegionNum = apiRegion.RegionNum,
        Name = apiRegion.Name ?? "Unnamed Spawn",
        World = apiRegion.World,
        InstanceID = apiRegion.InstanceID,
        SourceFilePath = ResolveSpawnSourceFilePath(spawnDataFolderPath, apiRegion.SourceFilePath ?? apiRegion.FileName ?? string.Empty),
        Tags = new Dictionary<string, string>(apiRegion.Tags ?? new Dictionary<string, string>(), StringComparer.OrdinalIgnoreCase)
    };

    spawnRegion.Bounds.Clear();
    spawnRegion.Bounds.Add(Rectangle.FromLTRB(
        Math.Min(apiRegion.Bounds.X1, apiRegion.Bounds.X2),
        Math.Min(apiRegion.Bounds.Y1, apiRegion.Bounds.Y2),
        Math.Max(apiRegion.Bounds.X1, apiRegion.Bounds.X2),
        Math.Max(apiRegion.Bounds.Y1, apiRegion.Bounds.Y2)
    ));

    spawnRegion.Tags["NAME"] = spawnRegion.Name;
    spawnRegion.Tags["WORLD"] = spawnRegion.World.ToString();
    spawnRegion.Tags["X1"] = spawnRegion.Bounds[0].Left.ToString();
    spawnRegion.Tags["Y1"] = spawnRegion.Bounds[0].Top.ToString();
    spawnRegion.Tags["X2"] = spawnRegion.Bounds[0].Right.ToString();
    spawnRegion.Tags["Y2"] = spawnRegion.Bounds[0].Bottom.ToString();

    if (spawnRegion.InstanceID > 0)
        spawnRegion.Tags["INSTANCEID"] = spawnRegion.InstanceID.ToString();
    else if (spawnRegion.Tags.ContainsKey("INSTANCEID"))
        spawnRegion.Tags.Remove("INSTANCEID");

    spawnRegion.SyncTagsToTypedFields();
    spawnRegion.SyncTypedFieldsToTags();

    return spawnRegion;
}

static string CreateRegionId(SpawnRegion spawnRegion)
{
    return spawnRegion.GetShortSourceFileName() + ":" + spawnRegion.RegionNum;
}

static string ResolveSpawnSourceFilePath(string spawnDataFolderPath, string relativeOrFileName)
{
    string safeRelativePath = (relativeOrFileName ?? string.Empty)
        .Replace('\\', Path.DirectorySeparatorChar)
        .Replace('/', Path.DirectorySeparatorChar)
        .TrimStart(Path.DirectorySeparatorChar);

    string fullPath = Path.GetFullPath(Path.Combine(spawnDataFolderPath, safeRelativePath));
    string fullSpawnDataFolderPath = Path.GetFullPath(spawnDataFolderPath);

    if (!fullPath.StartsWith(fullSpawnDataFolderPath, StringComparison.OrdinalIgnoreCase))
        throw new InvalidOperationException("Invalid source file path.");

    return fullPath;
}

static List<string> GetRelativeSpawnSourceFiles(string spawnDataFolderPath, bool recursive)
{
    SearchOption searchOption = recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;

    return Directory.GetFiles(spawnDataFolderPath, "*.dfn", searchOption)
        .Select(filePath => Path.GetRelativePath(spawnDataFolderPath, filePath))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(filePath => filePath, StringComparer.OrdinalIgnoreCase)
        .ToList();
}

static List<MapWorldDefinition> GetMapWorldDefinitions()
{
    return new List<MapWorldDefinition>
    {
        new MapWorldDefinition { Id = 0, Name = "Felucca", Width = 6144, Height = 4096, ImageUrl = "/api/maps/0.png" },
        new MapWorldDefinition { Id = 1, Name = "Trammel", Width = 6144, Height = 4096, ImageUrl = "/api/maps/1.png" },
        new MapWorldDefinition { Id = 2, Name = "Ilshenar", Width = 2304, Height = 1600, ImageUrl = "/api/maps/2.png" },
        new MapWorldDefinition { Id = 3, Name = "Malas", Width = 2560, Height = 2048, ImageUrl = "/api/maps/3.png" },
        new MapWorldDefinition { Id = 4, Name = "Tokuno", Width = 1448, Height = 1448, ImageUrl = "/api/maps/4.png" },
        new MapWorldDefinition { Id = 5, Name = "Ter Mur", Width = 1280, Height = 4096, ImageUrl = "/api/maps/5.png" }
    };
}

static void ValidateSpawnRegionsForSave(string sourceFilePath, List<SpawnRegion> spawnRegions)
{
    HashSet<int> regionNumbers = new HashSet<int>();

    foreach (SpawnRegion spawnRegion in spawnRegions)
    {
        if (!regionNumbers.Add(spawnRegion.RegionNum))
            throw new InvalidOperationException("Duplicate region number " + spawnRegion.RegionNum + " in " + Path.GetFileName(sourceFilePath) + ".");

        int spawnSourceCount = 0;

        if (!string.IsNullOrWhiteSpace(spawnRegion.Npc))
            spawnSourceCount++;

        if (!string.IsNullOrWhiteSpace(spawnRegion.NpcList))
            spawnSourceCount++;

        if (!string.IsNullOrWhiteSpace(spawnRegion.Item))
            spawnSourceCount++;

        if (!string.IsNullOrWhiteSpace(spawnRegion.ItemList))
            spawnSourceCount++;

        if (spawnSourceCount != 1)
            throw new InvalidOperationException("Region " + spawnRegion.RegionNum + " in " + Path.GetFileName(sourceFilePath) + " must have exactly one of NPC, NPCLIST, ITEM, or ITEMLIST.");

        if (spawnRegion.Bounds.Count == 0)
            throw new InvalidOperationException("Region " + spawnRegion.RegionNum + " in " + Path.GetFileName(sourceFilePath) + " is missing bounds.");
    }
}

static Bitmap CropBitmapLeft(Bitmap sourceBitmap, int targetWidth)
{
    Bitmap croppedBitmap = new Bitmap(targetWidth, sourceBitmap.Height);

    using (Graphics graphics = Graphics.FromImage(croppedBitmap))
    {
        graphics.DrawImage(
            sourceBitmap,
            new Rectangle(0, 0, targetWidth, sourceBitmap.Height),
            new Rectangle(0, 0, targetWidth, sourceBitmap.Height),
            GraphicsUnit.Pixel
        );
    }

    return croppedBitmap;
}

public sealed class BootstrapResponse
{
    public List<MapWorldDefinition> Maps { get; set; } = new List<MapWorldDefinition>();
    public List<string> SourceFiles { get; set; } = new List<string>();
}

public sealed class RegionsResponse
{
    public List<ApiSpawnRegion> Regions { get; set; } = new List<ApiSpawnRegion>();
}

public sealed class SaveRequest
{
    public List<string> SourceFilePaths { get; set; } = new List<string>();
    public List<ApiSpawnRegion> Regions { get; set; } = new List<ApiSpawnRegion>();
}

public sealed class SaveResponse
{
    public List<GeneratedFileResponse> Files { get; set; } = new List<GeneratedFileResponse>();
}

public sealed class GeneratedFileResponse
{
    public string FileName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}

public sealed class ApiSpawnRegion
{
    public string Id { get; set; } = string.Empty;
    public int RegionNum { get; set; }
    public string SectionHeader { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int World { get; set; }
    public int InstanceID { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string SourceFilePath { get; set; } = string.Empty;
    public ApiBounds Bounds { get; set; } = new ApiBounds();
    public Dictionary<string, string> Tags { get; set; } = new Dictionary<string, string>();
}

public sealed class MapWorldDefinition
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Width { get; set; }
    public int Height { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
}

public sealed class ApiBounds
{
    public int X1 { get; set; }
    public int Y1 { get; set; }
    public int X2 { get; set; }
    public int Y2 { get; set; }
}