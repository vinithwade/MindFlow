// electron-builder afterSign hook: notarize the signed .app with Apple.
// Skips gracefully when credentials aren't set, so local/unsigned builds work.
//
// Required env vars (set these to enable notarization):
//   APPLE_ID                    your Apple Developer account email
//   APPLE_APP_SPECIFIC_PASSWORD an app-specific password from appleid.apple.com
//   APPLE_TEAM_ID               your 10-char Team ID (Apple Developer → Membership)
const { notarize } = require('@electron/notarize')
const { execFileSync } = require('child_process')

exports.default = async function notarizing(context) {
  if (context.electronPlatformName !== 'darwin') return

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log(
      '[notarize] skipping — set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID to enable.'
    )
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`
  console.log(`[notarize] submitting ${appPath} to Apple (this can take a few minutes)…`)

  await notarize({
    appBundleId: 'com.mindflow.app',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID
  })

  // Staple the ticket so the app validates offline (no network check needed).
  console.log('[notarize] stapling ticket…')
  execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' })
  console.log('[notarize] done — app notarized and stapled.')
}
