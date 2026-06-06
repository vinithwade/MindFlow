// electron-builder afterPack hook:
// 1. Ensure the bundled MacKeyServer (the global key listener used for the Fn
//    shortcut) is executable in the packaged app.
// 2. When no Apple signing identity is configured, re-sign the app AD-HOC.
//    electron-builder skips signing entirely in that case, which leaves
//    Electron's original linker signature mismatched with our repacked
//    contents — quarantined downloads then fail with "MindFlow is damaged"
//    (no "Open Anyway" escape hatch). A consistent ad-hoc signature instead
//    yields the standard unverified-developer dialog, which users CAN bypass
//    via System Settings → Privacy & Security → Open Anyway.
const { chmodSync } = require('fs')
const { join } = require('path')
const { execFileSync } = require('child_process')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = context.packager.appInfo.productFilename
  const appPath = join(context.appOutDir, `${appName}.app`)
  const bin = join(
    appPath,
    'Contents',
    'Resources',
    'app.asar.unpacked',
    'node_modules',
    'node-global-key-listener',
    'bin',
    'MacKeyServer'
  )
  try {
    chmodSync(bin, 0o755)
    console.log('[afterPack] chmod +x MacKeyServer')
  } catch (e) {
    console.log('[afterPack] could not chmod MacKeyServer:', e.message)
  }

  // Real signing configured? Then electron-builder handles it — don't touch.
  const hasIdentity = process.env.CSC_LINK || process.env.CSC_NAME
  if (hasIdentity) return
  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
      stdio: 'pipe'
    })
    execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'pipe' })
    console.log('[afterPack] ad-hoc signed (no Developer ID configured)')
  } catch (e) {
    console.log('[afterPack] ad-hoc signing failed:', e.message)
  }
}
