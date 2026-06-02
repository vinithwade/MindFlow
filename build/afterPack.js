// electron-builder afterPack hook: ensure the bundled MacKeyServer (the global
// key listener used for the Fn shortcut) is executable in the packaged app.
const { chmodSync } = require('fs')
const { join } = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appName = context.packager.appInfo.productFilename
  const bin = join(
    context.appOutDir,
    `${appName}.app`,
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
}
