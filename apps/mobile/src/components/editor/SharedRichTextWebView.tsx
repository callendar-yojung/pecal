import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useThemeMode } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { getApiBaseUrl } from '../../lib/api';

type Props = {
  valueJson?: string;
  valueText?: string;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: number;
  onChange?: (json: string, plainText: string) => void;
};

type EditorMessage =
  | { type: 'ready' }
  | { type: 'update'; payload: { json: string; text: string } }
  | { type: 'height'; payload: { height: number } }
  | { type: 'error'; payload: { message: string } };

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(input: { placeholder: string; dark: boolean; readOnly: boolean }) {
  const { placeholder, dark, readOnly } = input;
  const bg = dark ? '#101216' : '#FFFFFF';
  const text = dark ? '#E5E7EB' : '#111827';
  const border = dark ? '#2F3541' : '#E5E7EB';
  const muted = dark ? '#8B95A7' : '#6B7280';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: ${bg}; color: ${text}; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; }
      .wrap { min-height: 100%; }
      .editor-wrap { border: 1px solid ${border}; border-radius: 12px; overflow: hidden; background: ${bg}; }
      .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 6px; border-bottom: 1px solid ${border}; background: ${dark ? '#151A24' : '#F8FAFC'}; }
      .btn { border: 1px solid transparent; color: ${muted}; background: transparent; border-radius: 8px; padding: 5px 8px; font-size: 11px; min-width: 28px; }
      .btn.warn { color: #EF4444; }
      .sep { width: 1px; height: 20px; margin: 0 2px; background: ${border}; }
      .select, .color { border: 1px solid ${border}; border-radius: 8px; background: ${bg}; color: ${text}; font-size: 11px; padding: 4px 6px; height: 28px; }
      .select { min-width: 78px; }
      .color { width: 30px; padding: 2px; }
      .editor { min-height: 260px; padding: 12px; line-height: 1.56; outline: none; color: ${text}; font-size: 14px; white-space: pre-wrap; }
      .editor:empty:before { content: attr(data-placeholder); color: ${muted}; }
      pre { background: ${dark ? '#0B1220' : '#F8FAFC'}; border: 1px solid ${border}; border-radius: 8px; padding: 10px; white-space: pre-wrap; }
      blockquote { border-left: 3px solid ${dark ? '#3B455A' : '#CBD5E1'}; margin: 0; padding-left: 10px; color: ${muted}; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="editor-wrap">
        ${
          readOnly
            ? ''
            : '<div class="toolbar"><button class="btn" data-action="undo">↶</button><button class="btn" data-action="redo">↷</button><div class="sep"></div><select id="headingSelect" class="select"><option value="p">본문</option><option value="h1">제목 1</option><option value="h2">제목 2</option><option value="h3">제목 3</option></select><select id="fontSizeSelect" class="select"><option>12px</option><option>14px</option><option selected>16px</option><option>18px</option><option>20px</option><option>24px</option><option>28px</option><option>32px</option><option>40px</option></select><input id="textColor" class="color" type="color" value="#111827" /><div class="sep"></div><button class="btn" data-action="bold">B</button><button class="btn" data-action="italic">I</button><button class="btn" data-action="underline">U</button><button class="btn" data-action="strike">S</button><button class="btn" data-action="highlight">HL</button><div class="sep"></div><button class="btn" data-action="ul">•</button><button class="btn" data-action="ol">1.</button><button class="btn" data-action="task">☑</button><div class="sep"></div><button class="btn" data-action="left">L</button><button class="btn" data-action="center">C</button><button class="btn" data-action="right">R</button><div class="sep"></div><button class="btn" data-action="quote">❝</button><button class="btn" data-action="code">`</button><button class="btn" data-action="codeblock">{ }</button><button class="btn" data-action="link">🔗</button><button class="btn warn" data-action="clear">⌫</button></div>'
        }
        <div id="editor" class="editor" contenteditable="${readOnly ? 'false' : 'true'}" data-placeholder="${escapeHtml(placeholder)}"></div>
      </div>
    </div>
    <script>
      const bridge = window.ReactNativeWebView;
      const editor = document.getElementById('editor');
      let applyingExternal = false;
      let savedRange = null;

      function inlineText(nodes) {
        if (!Array.isArray(nodes)) return '';
        return nodes
          .map((n) => {
            if (!n) return '';
            if (n.type === 'text') return n.text || '';
            return inlineText(n.content || []);
          })
          .join('');
      }

      function blockToLine(block, idx) {
        if (!block || typeof block !== 'object') return '';
        if (block.type === 'paragraph') return inlineText(block.content || []);
        if (block.type === 'heading') {
          const level = Number(block?.attrs?.level ?? 1);
          const prefix = level === 1 ? '# ' : level === 2 ? '## ' : '### ';
          return prefix + inlineText(block.content || []);
        }
        if (block.type === 'blockquote') return '> ' + inlineText(block?.content?.[0]?.content || []);
        if (block.type === 'bulletList') {
          const items = Array.isArray(block.content) ? block.content : [];
          return items.map((item) => '- ' + inlineText(item?.content?.[0]?.content || [])).join('\\n');
        }
        if (block.type === 'orderedList') {
          const items = Array.isArray(block.content) ? block.content : [];
          return items.map((item, i) => String(i + 1) + '. ' + inlineText(item?.content?.[0]?.content || [])).join('\\n');
        }
        if (block.type === 'taskList') {
          const items = Array.isArray(block.content) ? block.content : [];
          return items.map((item) => '- [ ] ' + inlineText(item?.content?.[0]?.content || [])).join('\\n');
        }
        if (block.type === 'codeBlock') {
          const code = inlineText(block.content || []);
          const fence = String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96);
          return fence + '\\n' + code + '\\n' + fence;
        }
        return inlineText(block.content || []);
      }

      function fromDoc(raw, fallbackText) {
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          const blocks = Array.isArray(parsed?.content) ? parsed.content : [];
          const text = blocks.map((b, i) => blockToLine(b, i)).join('\\n').trim();
          return text || (fallbackText || '');
        } catch {
          return fallbackText || '';
        }
      }

      function toDoc(text) {
        const lines = (text || '').split('\\n');
        const content = [];
        let i = 0;

        const paragraph = (value) => ({
          type: 'paragraph',
          content: value ? [{ type: 'text', text: value }] : [],
        });

        while (i < lines.length) {
          const line = lines[i] || '';
          if (!line.trim()) {
            content.push({ type: 'paragraph' });
            i += 1;
            continue;
          }

          if (line.startsWith('### ')) {
            content.push({
              type: 'heading',
              attrs: { level: 3 },
              content: [{ type: 'text', text: line.slice(4) }],
            });
            i += 1;
            continue;
          }
          if (line.startsWith('## ')) {
            content.push({
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: line.slice(3) }],
            });
            i += 1;
            continue;
          }
          if (line.startsWith('# ')) {
            content.push({
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: line.slice(2) }],
            });
            i += 1;
            continue;
          }

          if (line.startsWith('> ')) {
            content.push({ type: 'blockquote', content: [paragraph(line.slice(2))] });
            i += 1;
            continue;
          }

          if (/^- \\[\\s?\\] /.test(line)) {
            const items = [];
            while (i < lines.length && /^- \\[\\s?\\] /.test(lines[i] || '')) {
              items.push({
                type: 'taskItem',
                attrs: { checked: false },
                content: [paragraph((lines[i] || '').replace(/^- \\[\\s?\\] /, ''))],
              });
              i += 1;
            }
            content.push({ type: 'taskList', content: items });
            continue;
          }

          if (/^[-*] /.test(line)) {
            const items = [];
            while (i < lines.length && /^[-*] /.test(lines[i] || '')) {
              items.push({
                type: 'listItem',
                content: [paragraph((lines[i] || '').replace(/^[-*] /, ''))],
              });
              i += 1;
            }
            content.push({ type: 'bulletList', content: items });
            continue;
          }

          if (/^\\d+\\. /.test(line)) {
            const items = [];
            while (i < lines.length && /^\\d+\\. /.test(lines[i] || '')) {
              items.push({
                type: 'listItem',
                content: [paragraph((lines[i] || '').replace(/^\\d+\\. /, ''))],
              });
              i += 1;
            }
            content.push({ type: 'orderedList', content: items });
            continue;
          }

          content.push(paragraph(line));
          i += 1;
        }

        return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
      }

      function getCaretIndex() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return 0;
        const range = sel.getRangeAt(0).cloneRange();
        const pre = range.cloneRange();
        pre.selectNodeContents(editor);
        pre.setEnd(range.endContainer, range.endOffset);
        return pre.toString().length;
      }

      function setCaretIndex(index) {
        const target = Math.max(0, index);
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
        let current = walker.nextNode();
        let remaining = target;

        while (current) {
          const len = (current.textContent || '').length;
          if (remaining <= len) {
            const range = document.createRange();
            range.setStart(current, remaining);
            range.collapse(true);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(range);
            }
            return;
          }
          remaining -= len;
          current = walker.nextNode();
        }

        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }

      function emit() {
        if (!bridge || applyingExternal) return;
        const text = editor.innerText || '';
        bridge.postMessage(JSON.stringify({
          type: 'update',
          payload: {
            json: JSON.stringify(toDoc(text)),
            text,
          },
        }));
      }

      function emitHeight() {
        if (!bridge) return;
        const toolbar = document.querySelector('.toolbar');
        const h = Math.max(220, Number(editor.scrollHeight || 0) + Number(toolbar?.scrollHeight || 0) + 24);
        bridge.postMessage(JSON.stringify({ type: 'height', payload: { height: h } }));
      }

      function saveSelection() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        savedRange = sel.getRangeAt(0).cloneRange();
      }

      function restoreSelection() {
        if (!savedRange) return;
        const sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }

      function setContentFromJson(json, textFallback) {
        applyingExternal = true;
        editor.innerText = fromDoc(json, textFallback);
        setTimeout(() => {
          applyingExternal = false;
          emitHeight();
        }, 0);
      }

      function wrap(before, after) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const selected = range.toString() || 'text';
        document.execCommand('insertText', false, before + selected + after);
      }

      function onToolbarPress(handler) {
        return (e) => {
          e.preventDefault();
          restoreSelection();
          editor.focus();
          handler();
          saveSelection();
          emit();
          emitHeight();
        };
      }

      document.querySelectorAll('.btn[data-action]').forEach((el) => {
        const action = el.getAttribute('data-action');
        el.addEventListener('mousedown', onToolbarPress(() => {
          if (action === 'undo') document.execCommand('undo');
          else if (action === 'redo') document.execCommand('redo');
          else if (action === 'bold') document.execCommand('bold');
          else if (action === 'italic') document.execCommand('italic');
          else if (action === 'underline') document.execCommand('underline');
          else if (action === 'strike') document.execCommand('strikeThrough');
          else if (action === 'highlight') document.execCommand('hiliteColor', false, '#FDE68A');
          else if (action === 'ul') document.execCommand('insertUnorderedList');
          else if (action === 'ol') document.execCommand('insertOrderedList');
          else if (action === 'task') document.execCommand('insertText', false, '- [ ] ');
          else if (action === 'left') document.execCommand('justifyLeft');
          else if (action === 'center') document.execCommand('justifyCenter');
          else if (action === 'right') document.execCommand('justifyRight');
          else if (action === 'quote') document.execCommand('formatBlock', false, 'blockquote');
          else if (action === 'code') {
            const tick = String.fromCharCode(96);
            wrap(tick, tick);
          }
          else if (action === 'codeblock') {
            const text = window.getSelection()?.toString() || 'code';
            const fence = String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96);
            document.execCommand('insertText', false, fence + '\\n' + text + '\\n' + fence);
          }
          else if (action === 'link') {
            const url = prompt('URL', 'https://');
            if (url) document.execCommand('createLink', false, url);
          }
          else if (action === 'clear') {
            document.execCommand('removeFormat');
            document.execCommand('unlink');
          }
        }));
      });

      const headingSelect = document.getElementById('headingSelect');
      if (headingSelect) {
        headingSelect.addEventListener('mousedown', (e) => e.preventDefault());
        headingSelect.addEventListener('change', (e) => {
          restoreSelection();
          editor.focus();
          const value = e.target.value;
          document.execCommand('formatBlock', false, value === 'p' ? 'p' : value);
          saveSelection();
          emit();
          emitHeight();
        });
      }

      const fontSizeSelect = document.getElementById('fontSizeSelect');
      if (fontSizeSelect) {
        fontSizeSelect.addEventListener('mousedown', (e) => e.preventDefault());
        fontSizeSelect.addEventListener('change', (e) => {
          restoreSelection();
          editor.focus();
          document.execCommand('fontSize', false, '7');
          const fonts = editor.querySelectorAll('font[size="7"]');
          fonts.forEach((f) => {
            f.removeAttribute('size');
            f.style.fontSize = e.target.value;
          });
          saveSelection();
          emit();
          emitHeight();
        });
      }

      const colorInput = document.getElementById('textColor');
      if (colorInput) {
        colorInput.addEventListener('mousedown', (e) => e.preventDefault());
        colorInput.addEventListener('change', (e) => {
          restoreSelection();
          editor.focus();
          document.execCommand('foreColor', false, e.target.value);
          saveSelection();
          emit();
        });
      }

      editor.addEventListener('keyup', saveSelection);
      editor.addEventListener('mouseup', saveSelection);
      editor.addEventListener('keydown', (event) => {
        const isEnter = event.key === 'Enter' || event.keyCode === 13;
        if (!isEnter) return;

        const text = (editor.innerText || '').replace(/\\r/g, '');
        const caret = getCaretIndex();
        const lineStart = text.lastIndexOf('\\n', Math.max(0, caret - 1)) + 1;
        const lineEndIndex = text.indexOf('\\n', caret);
        const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
        const line = text.slice(lineStart, lineEnd);

        if (/^- \\[\\s?\\] /.test(line)) {
          event.preventDefault();
          const next = text.slice(0, caret) + '\\n- [ ] ' + text.slice(caret);
          editor.innerText = next;
          setCaretIndex(caret + 7);
          emit();
          emitHeight();
          return;
        }

        if (/^[-*] /.test(line)) {
          event.preventDefault();
          const marker = line.startsWith('* ') ? '* ' : '- ';
          const next = text.slice(0, caret) + '\\n' + marker + text.slice(caret);
          editor.innerText = next;
          setCaretIndex(caret + marker.length + 1);
          emit();
          emitHeight();
          return;
        }

        const ordered = /^(\\d+)\\. /.exec(line);
        if (ordered) {
          event.preventDefault();
          const nextNum = Number(ordered[1]) + 1;
          const marker = nextNum + '. ';
          const next = text.slice(0, caret) + '\\n' + marker + text.slice(caret);
          editor.innerText = next;
          setCaretIndex(caret + marker.length + 1);
          emit();
          emitHeight();
          return;
        }
      });

      editor.addEventListener('input', () => {
        emit();
        emitHeight();
      });

      window.__setContentFromReact = (json, text) => {
        setContentFromJson(json, text || '');
      };

      setTimeout(() => {
        emitHeight();
        if (bridge) bridge.postMessage(JSON.stringify({ type: 'ready' }));
      }, 0);
    </script>
  </body>
</html>`;
}

export function SharedRichTextWebView({
  valueJson = '',
  valueText = '',
  placeholder = '내용을 입력하세요.',
  readOnly = false,
  minHeight = 180,
  onChange,
}: Props) {
  const { mode } = useThemeMode();
  const webTheme = mode === 'black' ? 'dark' : 'light';
  const { locale } = useI18n();
  const ref = useRef<WebView>(null);
  const readyRef = useRef(false);
  const lastSentFromEditorRef = useRef('');
  const lastSentTextRef = useRef('');
  const [webHeight, setWebHeight] = useState(minHeight);
  const [remoteUriIndex, setRemoteUriIndex] = useState(0);
  const [fallbackLocalEditor, setFallbackLocalEditor] = useState(false);

  const html = useMemo(
    () => buildHtml({ placeholder, dark: mode === 'black', readOnly }),
    [placeholder, mode, readOnly]
  );
  const remoteEditorUris = useMemo(() => {
    const base = getApiBaseUrl().replace(/\/+$/, '');
    return [
      `${base}/${locale}/mobile/editor?mobile_theme=${webTheme}`,
      `${base}/mobile/editor?mobile_theme=${webTheme}`,
    ];
  }, [locale, webTheme]);
  const remoteEditorUri = remoteEditorUris[Math.min(remoteUriIndex, remoteEditorUris.length - 1)];
  const handleRemoteFailure = useCallback(() => {
    if (fallbackLocalEditor) return;
    readyRef.current = false;
    setRemoteUriIndex((prev) => {
      const next = prev + 1;
      if (next < remoteEditorUris.length) {
        return next;
      }
      setFallbackLocalEditor(true);
      return prev;
    });
  }, [fallbackLocalEditor, remoteEditorUris.length]);

  const postSetContent = useCallback((json: string, text: string) => {
    if (!fallbackLocalEditor) {
      ref.current?.postMessage(
        JSON.stringify({
          channel: 'pecal-editor',
          type: 'set-content',
          payload: {
            json,
            text,
            readOnly,
            placeholder,
            theme: webTheme,
          },
        })
      );
      return;
    }
    ref.current?.injectJavaScript(
      `window.__setContentFromReact && window.__setContentFromReact(${JSON.stringify(json)}, ${JSON.stringify(text)}); true;`
    );
  }, [fallbackLocalEditor, placeholder, readOnly, webTheme]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (valueJson === lastSentFromEditorRef.current && valueText === lastSentTextRef.current) return;
    postSetContent(valueJson || '{}', valueText || '');
  }, [valueJson, valueText, postSetContent]);

  return (
    <View style={{ minHeight, borderRadius: 12, overflow: 'hidden' }}>
      {!fallbackLocalEditor ? (
        <Text style={{ fontSize: 11, color: mode === 'black' ? '#8D98AF' : '#7C8599', paddingBottom: 6 }}>
          웹 에디터 동기화 모드
        </Text>
      ) : null}
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={fallbackLocalEditor ? { html } : { uri: remoteEditorUri }}
        scrollEnabled
        style={{ height: Math.max(minHeight, webHeight) }}
        javaScriptEnabled
        automaticallyAdjustContentInsets={false}
        nestedScrollEnabled
        onError={handleRemoteFailure}
        onHttpError={handleRemoteFailure}
        onMessage={(event) => {
          try {
            const raw = JSON.parse(event.nativeEvent.data) as
              | EditorMessage
              | {
                  channel?: string;
                  type?: string;
                  payload?: { json?: string; text?: string; height?: number; message?: string };
                };
            const message = (raw as { channel?: string }).channel === 'pecal-editor'
              ? ({
                  type: (raw as { type?: string }).type === 'set-content'
                    ? 'ready'
                    : (raw as { type?: string }).type,
                  payload: (raw as { payload?: { json?: string; text?: string; height?: number; message?: string } }).payload,
                } as EditorMessage)
              : (raw as EditorMessage);
            if (message.type === 'ready') {
              readyRef.current = true;
              postSetContent(valueJson || '{}', valueText || '');
              return;
            }
            if (message.type === 'update') {
              lastSentFromEditorRef.current = message.payload.json;
              lastSentTextRef.current = message.payload.text;
              onChange?.(message.payload.json, message.payload.text);
              return;
            }
            if (message.type === 'height') {
              const next = Math.max(minHeight, Math.min(1400, Number(message.payload.height) || minHeight));
              setWebHeight(next);
              return;
            }
            if (message.type === 'error') {
              return;
            }
          } catch {
            // ignore malformed bridge payload
          }
        }}
      />
    </View>
  );
}
