# UOX3 Spawn Editor Web

A modern web-based spawn region editor for UOX3 servers, built with a React frontend and ASP.NET backend.

This tool allows shard administrators to visually create, edit, and manage spawn regions directly on a map, replacing manual DFN editing with a fast, intuitive interface.

---

## Features

### Core Functionality
- Load and parse UOX3 spawn DFN files
- Visual map-based editing of spawn regions
- Create, move, resize, and delete regions
- Support for multiple maps (Felucca, Trammel, Ilshenar)
- World-aware filtering (WORLD=0,1,2)

### Editing
- Edit all region tags:
  - NAME
  - NPC / NPCLIST
  - ITEM / ITEMLIST
  - MAXNPCS / MAXITEMS
  - MINTIME / MAXTIME
  - MAXTIME
  - CALL
  - Coordinates (X1, Y1, X2, Y2)
- Maintain correct DFN tag ordering on save
- Prevent invalid or extra tags from being written

### Multi-File Support
- Load multiple spawn folders at once
- Track active spawn files per world
- Create new regions into selected DFN file
- Duplicate regions with auto-incremented IDs

### UI / UX Improvements
- Sidebar with compact region list
- Toggle visibility per file
- Zoom and pan map smoothly
- Hide labels when zoomed out
- Undo / Redo support
- Faster rendering with filtering

### Web API
- REST API for parsing and saving DFN files
- Swagger support for testing endpoints
- Designed for integration with external tools

---

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Canvas-based map rendering

### Backend
- ASP.NET Core Web API
- DFN parsing and serialization logic

---

## Project Structure

```text
SpawnEditorWeb/
├── SpawnEditorApi.Server/
├── spawn-editor-client/
└── README.md
Configuration

Before running the backend, you must configure the required paths in appsettings.json.

These settings tell the API where to find your UOX3 data and spawn files.

Example appsettings.json
{
  "SpawnEditor": {
    "UoDataPath": "C:\\Program Files (x86)\\Electronic Arts\\Ultima Online Classic",
    "SpawnFilesPath": "C:\\UOX3\\data\\dfndata\\regions\\spawn",
    "MapFilesPath": "C:\\UOX3\\data\\maps"
  }
}
Settings Explained
UoDataPath
Path to your Ultima Online client installation.
Used for loading map data (map.mul, radarcol.mul, etc).
SpawnFilesPath
Path to your UOX3 spawn DFN files (REGIONSPAWN files).
MapFilesPath
Optional path if you separate map assets from client install.
Notes
Windows paths must use double backslashes (\\) in JSON
All paths must exist or the API will fail to load data
Ensure the server has read/write access to these folders
Getting Started
Backend
cd SpawnEditorApi.Server
dotnet run

Default:

https://localhost:7207
Frontend
cd spawn-editor-client
npm install
npm run dev

Default:

http://localhost:5173
Usage
Start backend and frontend
Open the web app in browser
Load spawn files or folders
Select map (Felucca, Trammel, Ilshenar)
Edit regions directly on the map:
Drag to move
Resize using corners
Edit tags in sidebar
Save changes back to DFN files
Common Errors
Map not loading / blank screen
Check UoDataPath is correct
Ensure map.mul and radarcol.mul exist
Verify the client folder is valid
Spawn files not showing
Verify SpawnFilesPath is correct
Ensure files contain [REGIONSPAWN] entries
Confirm files are not empty or malformed
Changes not saving
Check folder permissions (read/write)
Make sure files are not read-only
Ensure backend has access to the directory
Frontend cannot connect to API
Confirm backend is running
Verify correct port (default: 7207)
Check HTTPS certificate warnings
Paths not working

Ensure proper JSON escaping:

C:\\Path\\To\\Folder
Avoid incorrect or missing directories
Roadmap
Persistent undo/redo history
Region grouping (towns, dungeons, etc.)
Advanced filtering (NPC type, spawn type)
Live sync with running UOX3 server
Import/export tools
Multi-user editing support
Contributing

Contributions are welcome.

If you are working with UOX3 or building tools around it, feel free to submit improvements, bug fixes, or feature requests.

Related Projects
UOX3 Server Emulator
UOX3 Atlas Tool (map/region editor)
Notes

This tool was built to solve real workflow problems when managing large spawn systems across multiple maps and DFN files.

Focus areas:

Accuracy
Performance
Usability