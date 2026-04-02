# UOX3 Spawn Editor Web

A modern web-based spawn region editor for UOX3 servers, built with a React frontend and ASP.NET backend.

This tool allows shard administrators to visually create, edit, and manage spawn regions directly on a map, replacing manual DFN editing with a fast, intuitive interface.

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
- Faster rendering with filtering

### Web API
- REST API for parsing and saving DFN files
- Designed for integration with external tools
- Swagger support for testing endpoints

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Canvas-based map rendering

### Backend
- ASP.NET Core Web API
- DFN parsing and serialization logic

## Project Structure

```text
SpawnEditorWeb/
├── SpawnEditorApi.Server/
├── spawn-editor-client/
└── README.md