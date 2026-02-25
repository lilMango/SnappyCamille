# SnappyCamille

Personal web app hosting multiple sub-projects.

## Structure

```
SnappyCamille/
├── public/                  # Deploy this folder to hosting
│   ├── index.html           # Root redirect
│   └── bday33/              # Birthday Music World app
├── birthday-music-world/    # Source code (separate git repo)
├── deploy.sh                # FTP deploy script
└── .env                     # FTP credentials (not committed)
```

## Deploy

### Setup (first time)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your FTP credentials:
   ```
   FTP_HOST=ftp.yourdomain.com
   FTP_USER=your_username
   FTP_PASS=your_password
   ```

### Deploy to production

```bash
./deploy.sh
```

This uploads everything in `public/` to your server root.

## Adding a new sub-project

1. Create project folder in SnappyCamille root
2. Set `base: '/route-name'` in the sub-project's `vite.config.js`
3. Run `bun install && bun run build` — output goes to `dist/`
4. Copy `dist/` to `public/route-name/`
5. Add project folder to `.gitignore`
6. Run `./deploy.sh`

## Sub-projects

| Route | Project | Description |
|-------|---------|-------------|
| `/bday33` | birthday-music-world | Interactive pixel-art music room |
| `/cnm-world` | cnm-world | 2D pixel-art world engine |
