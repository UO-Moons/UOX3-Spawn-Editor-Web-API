# UOX3 Spawn Editor Web

# 

# A modern web-based spawn region editor for UOX3 servers, built with a React frontend and ASP.NET backend.

# 

# This tool allows shard administrators to visually create, edit, and manage spawn regions directly on a map, replacing manual DFN editing with a fast, intuitive interface.

# 

# Features

# Core Functionality

# Load and parse UOX3 spawn DFN files

# Visual map-based editing of spawn regions

# Create, move, resize, and delete regions

# Support for multiple maps (Felucca, Trammel, Ilshenar)

# World-aware filtering (WORLD=0,1,2)

# Editing

# Edit all region tags:

# NAME

# NPC / NPCLIST

# ITEM / ITEMLIST

# MAXNPCS / MAXITEMS

# MINTIME / MAXTIME

# CALL

# Coordinates (X1, Y1, X2, Y2)

# Maintain correct DFN tag ordering on save

# Prevent invalid or extra tags from being written

# Multi-File Support

# Load multiple spawn folders at once

# Track active spawn files per world

# Create new regions into selected DFN file

# Duplicate regions with auto-incremented IDs

# UI / UX Improvements

# Sidebar with compact region list:

# Format: \[REGIONSPAWN ####] Name

# Toggle visibility per file

# Zoom and pan map smoothly

# Hide labels when zoomed out

# Undo / Redo support

# Faster rendering with filtering

# Web API

# REST API for parsing and saving DFN files

# Designed for integration with external tools

# Swagger support for testing endpoints

# Tech Stack

# Frontend

# React

# TypeScript

# Vite

# Canvas-based map rendering

# Backend

# ASP.NET Core Web API

# DFN parsing and serialization logic

# Project Structure

# SpawnEditorWeb/

# │

# ├── SpawnEditorApi.Server/   # ASP.NET backend

# ├── spawn-editor-client/     # React frontend

# │

# └── README.md

# Getting Started

# Prerequisites

# Node.js (18+ recommended)

# .NET 7 or newer

# UOX3 spawn files

# Backend Setup

# cd SpawnEditorApi.Server

# dotnet run

# 

# Default:

# 

# https://localhost:7207

# Frontend Setup

# cd spawn-editor-client

# npm install

# npm run dev

# 

# Default:

# 

# http://localhost:5173

# Usage

# Start backend and frontend

# Open the web app in browser

# Load spawn files or folders

# Select map (Felucca, Trammel, Ilshenar)

# Edit regions directly on the map:

# Drag to move

# Resize using corners

# Edit tags in sidebar

# Save changes back to DFN

# DFN Compatibility

# 

# This tool is designed specifically for UOX3 spawn regions:

# 

# \[REGIONSPAWN 3950]

# {

# NAME=Sewers

# NPCLIST=BritainSewers

# MAXNPCS=50

# X1=6029

# Y1=1427

# X2=6125

# Y2=1507

# WORLD=0

# MINTIME=10

# MAXTIME=20

# CALL=5

# }

# Preserves correct formatting

# Maintains tag order

# Avoids adding unnecessary fields

# Roadmap

# Full undo/redo history persistence

# Region grouping (towns, dungeons, etc.)

# Advanced filtering (NPC type, spawn type)

# Live sync with running UOX3 server

# Import/export tools

# Authentication for multi-user editing

# Contributing

# 

# Contributions are welcome.

# 

# If you are working with UOX3 or building tools around it, feel free to submit improvements, bug fixes, or feature requests.

# 

# License

# 

# This project follows the same spirit as UOX3:

# Open for community use, modification, and improvement.

# 

# Related Projects

# UOX3 Server Emulator

# UOX3 Atlas Tool (map/region editor)

# Notes

# 

# This tool was built to solve real workflow problems when managing large spawn systems across multiple maps and DFN files.

# 

# It focuses on:

# 

# Accuracy

# Performance

# Usability

