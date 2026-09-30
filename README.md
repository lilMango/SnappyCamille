# SnappyCamille

Personal web app hosting multiple sub-projects.

## Structure

```
SnappyCamille/
├── public/                  # Deploy this folder to hosting
│   ├── index.html           # Root redirect
│   ├── bday33/              # Birthday Music World app
│   ├── galaxy/              # Camille Galaxy app
│   └── lanikai/             # Lanikai Galaxy app
├── birthday-music-world/    # Source code (separate git repo)
├── camille-galaxy/          # Source code (separate git repo)
├── lanikai-galaxy/          # Source code (separate git repo)
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
2. Set `"homepage": "/route-name"` in its package.json
3. Build and copy output to `public/route-name/`
4. Add project folder to `.gitignore`
5. Run `./deploy.sh`

## Sub-projects

| Route | Project | Description |
|-------|---------|-------------|
| `/bday33` | birthday-music-world | Interactive pixel-art music room |
| `/galaxy` | camille-galaxy | 3D Getty Villa on a small planet |
| `/lanikai` | lanikai-galaxy | 3D Kualoa Ranch & Lanikai Beach on a small planet |
