# Auto-updates

The app checks for updates in the background (10s after launch, then every 6h),
downloads them, and prompts the user to restart when ready — powered by
`electron-updater` (see `src/main/updater.ts`).

## How it works
- At build time, electron-builder bakes the feed location into
  `app-update.yml` (inside the app) and publishes `latest-mac.yml` +
  the `.dmg`/`.zip` to your release host.
- The running app reads `latest-mac.yml` from that host; if a newer `version`
  exists, it downloads it and offers "Restart now".

## ⚠️ Two requirements
1. **Set your release host.** Edit `package.json` → `build.publish`:
   replace `YOUR_GITHUB_USERNAME` and `repo` with your actual GitHub repo.
2. **macOS updates require a signed + notarized app** (Squirrel.Mac validates
   the signature). Set up signing first — see `SIGNING.md`. Unsigned builds run
   fine but won't self-update.

## Releasing an update (GitHub Releases)
1. Create the GitHub repo named in `build.publish`.
2. Create a GitHub **personal access token** (classic, `repo` scope) →
   `export GH_TOKEN=...`.
3. Set signing/notarization env vars (see `SIGNING.md`).
4. **Bump the version** in `package.json` (e.g. `0.1.0` → `0.1.1`).
5. Publish:
   ```bash
   export GH_TOKEN=...                       # GitHub token
   export APPLE_ID=... APPLE_APP_SPECIFIC_PASSWORD=... APPLE_TEAM_ID=...
   npm run release
   ```
   This builds (dmg + zip), signs, notarizes, and uploads the artifacts +
   `latest-mac.yml` to a GitHub Release for that version.

Installed apps (version 0.1.0) will then detect 0.1.1, download, and update.

## Self-hosted alternative (no GitHub)
Swap `build.publish` for a generic host:
```json
"publish": [{ "provider": "generic", "url": "https://downloads.example.com/voice-reply/" }]
```
Then upload the `.dmg`, `.zip`, and `latest-mac.yml` from `dist/` to that URL on
each release (any static host / S3 / CDN works).

## Notes
- Auto-update only runs in a packaged build, never in `npm run dev`.
- `npm run package` builds a local DMG (no publish). `npm run release` builds
  dmg + zip and publishes the update feed.
- Differential downloads use the generated `.blockmap` files automatically.
