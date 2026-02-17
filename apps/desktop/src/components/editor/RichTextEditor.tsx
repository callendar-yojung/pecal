import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Extension } from '@tiptap/core'
import { createLowlight } from 'lowlight'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import markdown from 'highlight.js/lib/languages/markdown'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import RichTextToolbar from './RichTextToolbar'
import { FontSize } from './FontSize'
import { isTauriApp } from '../../utils/tauri'

const lowlight = createLowlight()

let languagesRegistered = false
function registerLanguages() {
  if (languagesRegistered) return
  lowlight.register('javascript', javascript)
  lowlight.register('js', javascript)
  lowlight.register('typescript', typescript)
  lowlight.register('ts', typescript)
  lowlight.register('python', python)
  lowlight.register('py', python)
  lowlight.register('go', go)
  lowlight.register('golang', go)
  lowlight.register('java', java)
  lowlight.register('json', json)
  lowlight.register('bash', bash)
  lowlight.register('sh', bash)
  lowlight.register('css', css)
  lowlight.register('html', xml)
  lowlight.register('xml', xml)
  lowlight.register('markdown', markdown)
  lowlight.register('md', markdown)
  lowlight.register('sql', sql)
  lowlight.register('yaml', yaml)
  lowlight.register('yml', yaml)
  languagesRegistered = true
}

registerLanguages()

const CodeBlockTab = Extension.create({
  name: 'codeBlockTab',
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!this.editor.isActive('codeBlock')) return false
        this.editor.commands.insertContent('    ')
        return true
      },
      'Shift-Tab': () => {
        if (!this.editor.isActive('codeBlock')) return false
        const { state } = this.editor
        const { from, to } = state.selection
        if (from !== to || from < 4) return false
        const textBefore = state.doc.textBetween(from - 4, from, '\0', '\0')
        if (textBefore !== '    ') return false
        this.editor.commands.deleteRange({ from: from - 4, to: from })
        return true
      },
    }
  },
})

export interface RichTextEditorProps {
  initialContent?: Record<string, unknown>
  onChange?: (content: Record<string, unknown>) => void
  contentKey?: string | number
  readOnly?: boolean
  showToolbar?: boolean
}

const defaultContent = { type: 'doc', content: [{ type: 'paragraph' }] } as Record<string, unknown>

export default function RichTextEditor({
  initialContent,
  onChange,
  contentKey,
  readOnly = false,
  showToolbar = true,
}: RichTextEditorProps) {
  const openExternalLink = async (href: string) => {
    if (isTauriApp()) {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(href)
      return
    }
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      CodeBlockTab,
      Underline,
      TextStyle,
      Color,
      FontSize,
      Highlight,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: initialContent ?? defaultContent,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class:
          'min-h-[300px] w-full bg-transparent px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none',
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement | null
        const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
        if (!anchor) return false

        if (!readOnly && !event.metaKey && !event.ctrlKey) {
          return false
        }

        event.preventDefault()
        const rawHref = anchor.getAttribute('href') || ''
        if (!rawHref) return true
        const href = /^(https?:|mailto:|tel:)/i.test(rawHref) ? rawHref : `https://${rawHref}`
        void openExternalLink(href)
        return true
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange?.(instance.getJSON() as Record<string, unknown>)
    },
  })

  useEffect(() => {
    if (!editor || !initialContent) return
    editor.commands.setContent(initialContent, false)
  }, [editor, contentKey])

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {showToolbar && !readOnly && <RichTextToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}
