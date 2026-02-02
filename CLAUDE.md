# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SnappyCamille is a multi-project web hosting container. Sub-projects are built separately and deployed via FTP. Each sub-project has its own git repository and CLAUDE.md.

## Deployment

```bash
./deploy.sh    # Upload /public folder to FTP server
```

Requires `.env` with FTP credentials (copy from `.env.example`). Uses lftp for mirroring.

## Structure

- `public/` - Deployment folder (uploaded to server root)
- `public/index.html` - Root redirect
- `public/bday33/` - Built output from birthday-music-world
- Sub-project source folders are in `.gitignore` (separate repos)

## Adding Sub-projects

1. Set `"homepage": "/route-name"` in sub-project's package.json
2. Build sub-project and copy output to `public/route-name/`
3. Add source folder to `.gitignore`
4. Deploy with `./deploy.sh`

## Current Sub-projects

| Route | Source | Description |
|-------|--------|-------------|
| `/bday33` | birthday-music-world/ | Interactive pixel-art music room (React, grid-based game with zone-based playlists) |
