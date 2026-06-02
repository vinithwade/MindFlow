# Code-signing & Notarization (macOS)

The build pipeline is fully configured. With no credentials it produces an
**unsigned** app (fine for your own machine). Add the credentials below and the
**same** `npm run package` will produce a **signed + notarized + stapled** DMG
you can share — it'll open with a normal double-click on any Mac.

## One-time setup

### 1. Apple Developer Program
Enroll at <https://developer.apple.com/programs/> ($99/yr).

### 2. Developer ID Application certificate (installs into your keychain)
Easiest via Xcode:
- Xcode → **Settings → Accounts** → add your Apple ID → **Manage Certificates…**
- Click **+** → **Developer ID Application**.

Verify it's installed:
```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

### 3. App-specific password (for notarization)
- Go to <https://appleid.apple.com> → **Sign-In and Security → App-Specific Passwords**
- Generate one (looks like `abcd-efgh-ijkl-mnop`).

### 4. Team ID
Find your 10-character Team ID at <https://developer.apple.com/account> → **Membership**.

## Build a signed + notarized release

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="XXXXXXXXXX"

npm run package
```

What happens automatically:
1. electron-builder finds your **Developer ID Application** cert and signs the
   app (and the bundled `MacKeyServer` + native modules) with the **hardened
   runtime** and `build/entitlements.mac.plist`.
2. `build/notarize.js` (afterSign hook) submits the app to Apple's notary
   service, waits, then **staples** the ticket.
3. A signed, notarized DMG is written to `dist/`.

## Verify the result
```bash
APP="dist/mac-arm64/MindFlow.app"
codesign --verify --deep --strict --verbose=2 "$APP"
xcrun stapler validate "$APP"
spctl -a -vvv -t install "$APP"   # expect: source=Notarized Developer ID
```

## Notes
- Without the env vars, notarization is skipped (you'll see `[notarize] skipping…`).
- Without the certificate, signing is skipped (build still succeeds, unsigned).
- `npm run package:dir` is the quick unsigned local build (`.app` only, no DMG).
- Keep credentials out of git — pass them as env vars (or a local, git-ignored
  `.env` you `source`), never commit them.
