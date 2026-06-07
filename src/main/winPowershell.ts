import { spawn, execFile, ChildProcessWithoutNullStreams } from 'child_process'
import { log } from './log'

/**
 * Persistent PowerShell host for the Windows automation primitives.
 *
 * Why persistent: a cold `powershell.exe` spawn costs ~200-500ms, which is fine
 * for context capture (it runs in parallel with recording) but too slow for the
 * paste path (activate → Ctrl+V → Enter) that fires right after the user clicks
 * Send. A single warm host, pre-loaded with the assemblies we need, answers in
 * ~5-20ms per command.
 *
 * Protocol: commands are written one statement per line to stdin (PowerShell
 * `-Command -` executes each complete statement as it's read — the same trick
 * node-powershell uses). Each command is wrapped in try/catch and followed by a
 * unique DONE sentinel so we know where its output ends. Commands run strictly
 * one at a time (FIFO queue). If the host dies or a command times out, the
 * process is killed and respawned on the next call.
 */

/** Inline C# for the Win32 calls UIA/SendKeys can't cover (single line — sent over stdin). */
const WIN32_TYPE =
  'using System; using System.Text; using System.Runtime.InteropServices; public class MFWin32 { ' +
  '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); ' +
  '[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count); ' +
  '[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid); ' +
  '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); ' +
  '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); ' +
  '[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd); }'

/** Statements run once per host: UTF-8 output, assemblies, Win32 type (JIT warm-up). */
const INIT_COMMANDS = [
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  'Add-Type -AssemblyName System.Windows.Forms',
  'Add-Type -AssemblyName UIAutomationClient',
  'Add-Type -AssemblyName UIAutomationTypes',
  `Add-Type -Language CSharp -TypeDefinition '${WIN32_TYPE}'`
]

const ERR_PREFIX = 'MFERR:'
const DEFAULT_TIMEOUT_MS = 4000 // mirrors the mac osascript timeout
const INIT_TIMEOUT_MS = 15000 // Add-Type compiles C# — allow a slow first start

let proc: ChildProcessWithoutNullStreams | null = null
let stdoutBuf = ''
let seq = 0
/** Serialize commands: each call chains on the previous one's completion. */
let queue: Promise<unknown> = Promise.resolve()

interface Pending {
  sentinel: string
  resolve: (out: string) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}
let pending: Pending | null = null

/**
 * Distinguishes "the host itself is broken" (timed out / died / unwritable)
 * from an ordinary PowerShell command error. Host failures trigger the
 * one-shot fallback; command errors propagate to the caller.
 */
class HostError extends Error {}

function killHost(): void {
  if (proc) {
    try {
      proc.kill()
    } catch {
      /* already dead */
    }
    proc = null
  }
  stdoutBuf = ''
  if (pending) {
    clearTimeout(pending.timer)
    pending.reject(new HostError('PowerShell host terminated.'))
    pending = null
  }
}

function ensureHost(): ChildProcessWithoutNullStreams {
  if (proc && proc.exitCode === null && !proc.killed) return proc

  const p = spawn(
    'powershell.exe',
    ['-NoLogo', '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
    { stdio: 'pipe', windowsHide: true }
  )
  p.stdout.setEncoding('utf8')
  p.stderr.setEncoding('utf8')
  p.stdout.on('data', (chunk: string) => {
    stdoutBuf += chunk
    if (!pending) return
    const idx = stdoutBuf.indexOf(pending.sentinel)
    if (idx === -1) return
    const out = stdoutBuf.slice(0, idx)
    stdoutBuf = stdoutBuf.slice(idx + pending.sentinel.length)
    const { resolve, reject, timer } = pending
    clearTimeout(timer)
    pending = null
    const trimmed = out.replace(/\r/g, '').trim()
    if (trimmed.startsWith(ERR_PREFIX)) reject(new Error(trimmed.slice(ERR_PREFIX.length).trim()))
    else resolve(trimmed)
  })
  p.stderr.on('data', (chunk: string) => log.warn('[ps] stderr:', chunk.trim()))
  p.on('exit', (code) => {
    log.warn(`[ps] host exited (code ${code}) — will respawn on next use`)
    if (proc === p) killHost() // watchdog: clear state so the next call respawns
  })
  p.on('error', (err) => {
    log.warn('[ps] host error:', err.message)
    if (proc === p) killHost()
  })

  proc = p
  stdoutBuf = ''
  // Warm up: encoding, assemblies, Win32 type. Failures surface on first real call.
  for (const cmd of INIT_COMMANDS) {
    void enqueue(cmd, INIT_TIMEOUT_MS).catch((e) => log.warn('[ps] init:', (e as Error).message))
  }
  return p
}

/** Internal: send one statement and await its output (must already own the queue slot). */
function send(p: ChildProcessWithoutNullStreams, command: string, timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const sentinel = `#MFDONE:${++seq}#`
    pending = {
      sentinel,
      resolve,
      reject,
      timer: setTimeout(() => {
        log.warn('[ps] command timed out — killing host')
        killHost() // also rejects this pending promise
      }, timeoutMs)
    }
    // try/catch keeps the host alive on errors; the sentinel always prints.
    const wrapped = `try { ${command} } catch { Write-Output ("${ERR_PREFIX}" + $_.Exception.Message) }; Write-Output "${sentinel}"`
    p.stdin.write(wrapped + '\n', (err) => {
      if (err && pending) {
        clearTimeout(pending.timer)
        pending = null
        reject(new HostError(err.message))
      }
    })
  })
}

function enqueue(command: string, timeoutMs: number): Promise<string> {
  const run = queue.then(
    () => send(ensureHost(), command, timeoutMs),
    () => send(ensureHost(), command, timeoutMs) // prior failure must not poison the queue
  )
  queue = run.catch(() => undefined)
  return run
}

/* ------------------------- One-shot fallback path -------------------------- */

// If the warm host's stdin protocol misbehaves on some machine (every command
// would time out), degrade permanently to one-shot powershell.exe processes:
// slower (~0.5-1.5s, Add-Type recompiles each run) but always correct.
let hostBroken = false
const ONE_SHOT_PRELUDE = INIT_COMMANDS.join('; ')

function runOneShot(command: string, timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const script = `${ONE_SHOT_PRELUDE}; try { ${command} } catch { Write-Output ("${ERR_PREFIX}" + $_.Exception.Message) }`
    execFile(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      // Generous extra headroom: Add-Type compiles C# on every invocation.
      { timeout: timeoutMs + 10000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err)
        const out = stdout.replace(/\r/g, '').trim()
        if (out.startsWith(ERR_PREFIX)) reject(new Error(out.slice(ERR_PREFIX.length).trim()))
        else resolve(out)
      }
    )
  })
}

/**
 * Run a single-line PowerShell statement and return its stdout (trimmed).
 * Statements must be one line — join with `;`. Uses the warm host; if the host
 * proves broken (timeout/death), falls back to one-shot processes from then on.
 * Throws on PowerShell command errors.
 */
export async function runPs(
  command: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string> {
  if (process.platform !== 'win32') {
    throw new Error('PowerShell host is Windows-only.')
  }
  if (!hostBroken) {
    try {
      return await enqueue(command, timeoutMs)
    } catch (err) {
      if (!(err instanceof HostError)) throw err // real command error — propagate
      log.warn('[ps] warm host unusable — switching to one-shot mode:', err.message)
      hostBroken = true
      killHost()
    }
  }
  return runOneShot(command, timeoutMs)
}

/** Spawn + warm the host ahead of time (e.g. at app start) so first use is fast. */
export function warmPsHost(): void {
  if (process.platform !== 'win32') return
  try {
    ensureHost()
  } catch (e) {
    log.warn('[ps] warm-up failed:', (e as Error).message)
  }
}

/** Tear the host down (app quit). */
export function disposePsHost(): void {
  killHost()
}
