import { useRef } from 'react'

interface SharedContentEditorProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export function SharedContentEditor({
  label,
  value,
  onChange,
  placeholder,
  rows = 8,
}: SharedContentEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const applyWrap = (before: string, after = before) => {
    const input = textareaRef.current
    if (!input) return

    const start = input.selectionStart
    const end = input.selectionEnd
    const selected = value.slice(start, end)
    const wrapped = `${before}${selected}${after}`
    const next = `${value.slice(0, start)}${wrapped}${value.slice(end)}`
    onChange(next)

    requestAnimationFrame(() => {
      input.focus()
      input.selectionStart = start + before.length
      input.selectionEnd = end + before.length
    })
  }

  const applyLinePrefix = (prefix: string) => {
    const input = textareaRef.current
    if (!input) return

    const start = input.selectionStart
    const end = input.selectionEnd
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const lineEndRaw = value.indexOf('\n', end)
    const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw
    const section = value.slice(lineStart, lineEnd)
    const nextSection = section
      .split('\n')
      .map((line) => `${prefix}${line}`)
      .join('\n')

    const next = `${value.slice(0, lineStart)}${nextSection}${value.slice(lineEnd)}`
    onChange(next)

    requestAnimationFrame(() => {
      input.focus()
      input.selectionStart = lineStart
      input.selectionEnd = lineStart + nextSection.length
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      <div className="rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
        <div className="flex items-center gap-1 border-b border-gray-200 p-1.5 dark:border-gray-700">
          <button
            type="button"
            onClick={() => applyWrap('**')}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => applyWrap('_')}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix('- ')}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="List"
          >
            List
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix('> ')}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Quote"
          >
            Quote
          </button>
          <button
            type="button"
            onClick={() => applyWrap('`')}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Code"
          >
            Code
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-y rounded-b-lg bg-transparent px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none dark:text-gray-100 dark:placeholder-gray-500"
        />
      </div>
    </div>
  )
}
