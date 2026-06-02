import { useId, useState } from 'react'
import { motion } from 'framer-motion'

/** Segmented control (iOS-style) with a sliding accent indicator. */
export function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}): JSX.Element {
  // Unique per instance so multiple segmented controls don't share the indicator.
  const layoutId = useId()
  return (
    <div className="inline-flex rounded-xl bg-gray-100 p-1">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`relative rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
              active ? 'text-accent' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-black/[0.04]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Masked API-key input with a show/hide toggle. */
export function KeyInput({
  value,
  onChange,
  placeholder
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}): JSX.Element {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 pr-16 text-sm text-gray-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <button
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-gray-400 hover:text-gray-700"
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

/** A simple on/off switch. */
export function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition ${
        checked ? 'bg-accent' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

export function Card({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">{children}</div>
  )
}

export function Field({
  label,
  hint,
  children
}: {
  label: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-800">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}
