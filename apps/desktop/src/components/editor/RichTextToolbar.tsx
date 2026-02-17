import type { MouseEvent, ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  SquareCode,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Undo,
  Redo,
  Trash2,
  ChevronDown,
} from 'lucide-react'

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px']

interface RichTextToolbarProps {
  editor: Editor | null
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  children: ReactNode
  label?: string
}

function ToolbarButton({ onClick, isActive = false, children, label }: ToolbarButtonProps) {
  const preventBlur = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
  }

  return (
    <button
      type="button"
      onMouseDown={preventBlur}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-all ${
        isActive
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100'
      }`}
      title={label}
    >
      {children}
    </button>
  )
}

function Separator() {
  return <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />
}

function normalizeLink(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export default function RichTextToolbar({ editor }: RichTextToolbarProps) {
  if (!editor) return null

  const currentFontSize =
    (editor.getAttributes('textStyle')?.fontSize as string | undefined) || '16px'

  return (
    <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
      <div className="flex flex-nowrap items-center gap-1 overflow-x-auto p-1.5">
        <div className="flex items-center">
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} label="Undo">
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} label="Redo">
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <Separator />

        <div className="flex items-center gap-2 px-1">
          <div className="relative flex items-center">
            <select
              value={
                editor.isActive('heading', { level: 1 })
                  ? 'h1'
                  : editor.isActive('heading', { level: 2 })
                    ? 'h2'
                    : editor.isActive('heading', { level: 3 })
                      ? 'h3'
                      : 'paragraph'
              }
              onChange={(e) => {
                const val = e.target.value
                if (val === 'paragraph') {
                  editor.chain().focus().setParagraph().run()
                  return
                }
                const level = Number(val.replace('h', '')) as 1 | 2 | 3
                editor.chain().focus().toggleHeading({ level }).run()
              }}
              className="h-8 w-24 appearance-none rounded-md border border-gray-300 bg-white pl-2 pr-8 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="paragraph">본문</option>
              <option value="h1">제목 1</option>
              <option value="h2">제목 2</option>
              <option value="h3">제목 3</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-gray-400" />
          </div>

          <div className="relative flex items-center">
            <select
              value={currentFontSize}
              onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
              className="h-8 w-20 appearance-none rounded-md border border-gray-300 bg-white pl-2 pr-8 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-gray-400" />
          </div>
        </div>

        <Separator />

        <div className="flex items-center">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            label="Bold"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            label="Italic"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            label="Underline"
          >
            <Underline className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            label="Strike"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive('highlight')}
            label="Highlight"
          >
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>

          <div className="ml-1 flex items-center" title="Text Color">
            <input
              type="color"
              value={editor.getAttributes('textStyle')?.color || '#111827'}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              className="h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-gray-300 p-0 dark:border-gray-600"
            />
          </div>
        </div>

        <Separator />

        <div className="flex items-center">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            label="Bullet List"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            label="Ordered List"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            isActive={editor.isActive('taskList')}
            label="Task List"
          >
            <CheckSquare className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <Separator />

        <div className="flex items-center">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            label="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            label="Align Center"
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
            label="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <Separator />

        <div className="flex items-center">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            label="Blockquote"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            label="Inline Code"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive('codeBlock')}
            label="Code Block"
          >
            <SquareCode className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <Separator />

        <div className="flex items-center">
          <ToolbarButton
            onClick={() => {
              const previousUrl = editor.getAttributes('link').href as string | undefined
              const url = window.prompt('URL', previousUrl || '')
              if (url === null) return
              if (url === '') {
                editor.chain().focus().unsetLink().run()
                return
              }
              editor.chain().focus().setLink({ href: normalizeLink(url) }).run()
            }}
            isActive={editor.isActive('link')}
            label="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            label="Clear Formatting"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </ToolbarButton>
        </div>
      </div>
    </div>
  )
}
