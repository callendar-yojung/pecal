import {
  normalizeRichTextJson,
  parseRichTextDoc,
  plainTextToRichTextDoc,
  richTextDocToPlainText,
  RICH_TEXT_FONT_SIZES,
  RICH_TEXT_HEADING_OPTIONS,
  serializeRichTextDoc,
  type RichTextDoc,
  type RichTextNode,
  type RichTextToolbarAction,
} from '@repo/utils';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputSelectionChangeEventData,
  type TextStyle,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeMode } from '../../contexts/ThemeContext';
import type { SharedRichTextEditorProps } from './SharedRichText.types';

type SelectionRange = {
  start: number;
  end: number;
};

const HEADING_PREFIX_MAP: Record<(typeof RICH_TEXT_HEADING_OPTIONS)[number]['value'], string> = {
  paragraph: '',
  h1: '# ',
  h2: '## ',
  h3: '### ',
};

function wrapSelection(text: string, selection: SelectionRange, before: string, after: string) {
  const selected = text.slice(selection.start, selection.end) || 'text';
  const nextText = `${text.slice(0, selection.start)}${before}${selected}${after}${text.slice(selection.end)}`;
  const nextCursor = selection.start + before.length + selected.length + after.length;
  return { text: nextText, selection: { start: nextCursor, end: nextCursor } };
}

function getCurrentLineRange(text: string, selection: SelectionRange) {
  const lineStart = text.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
  const lineEndIndex = text.indexOf('\n', selection.end);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  return { lineStart, lineEnd };
}

function getCurrentLineText(text: string, selection: SelectionRange) {
  const { lineStart, lineEnd } = getCurrentLineRange(text, selection);
  return text.slice(lineStart, lineEnd);
}

function replaceCurrentLine(text: string, selection: SelectionRange, nextLine: string) {
  const { lineStart, lineEnd } = getCurrentLineRange(text, selection);
  const currentLine = text.slice(lineStart, lineEnd);
  const nextText = `${text.slice(0, lineStart)}${nextLine}${text.slice(lineEnd)}`;
  const delta = nextLine.length - currentLine.length;
  return {
    text: nextText,
    selection: {
      start: Math.max(lineStart, selection.start + delta),
      end: Math.max(lineStart, selection.end + delta),
    },
  };
}

function stripBlockPrefix(line: string) {
  return line
    .replace(/^###\s+/, '')
    .replace(/^##\s+/, '')
    .replace(/^#\s+/, '')
    .replace(/^>\s+/, '')
    .replace(/^- \[[ xX]\]\s+/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '');
}

function detectHeading(line: string): (typeof RICH_TEXT_HEADING_OPTIONS)[number]['value'] {
  if (line.startsWith('### ')) return 'h3';
  if (line.startsWith('## ')) return 'h2';
  if (line.startsWith('# ')) return 'h1';
  return 'paragraph';
}

function toggleLinePrefix(text: string, selection: SelectionRange, prefix: string, matcher: RegExp) {
  const currentLine = getCurrentLineText(text, selection);
  const nextLine = matcher.test(currentLine)
    ? currentLine.replace(matcher, '')
    : `${prefix}${stripBlockPrefix(currentLine)}`;
  return replaceCurrentLine(text, selection, nextLine);
}

function getContinuationPrefix(line: string) {
  if (/^- \[[ xX]\]\s+/.test(line)) return '- [ ] ';
  if (/^[-*]\s+/.test(line)) return '- ';
  const ordered = /^(\d+)\.\s+/.exec(line);
  if (ordered) return `${Number(ordered[1]) + 1}. `;
  return '';
}

function renderInline(nodes: RichTextNode[] | undefined, colors: ReturnType<typeof useThemeMode>['colors'], baseStyle: TextStyle, keyPrefix: string) {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;

  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!node) return null;
    if (node.type === 'text') {
      const marks = Array.isArray(node.marks) ? (node.marks as Array<{ type?: string; attrs?: Record<string, unknown> }>) : [];
      const style: TextStyle = { ...baseStyle };
      let underline = false;
      let strike = false;
      for (const mark of marks) {
        if (mark?.type === 'bold') style.fontWeight = '700';
        if (mark?.type === 'italic') style.fontStyle = 'italic';
        if (mark?.type === 'underline') underline = true;
        if (mark?.type === 'strike') strike = true;
        if (mark?.type === 'highlight') style.backgroundColor = resolvedColor('#FEF08A', '#5B4A00', colors.card);
        if (mark?.type === 'code') {
          style.fontFamily = 'Courier';
          style.backgroundColor = resolvedColor('#E5E7EB', '#202637', colors.card);
        }
        if (mark?.type === 'link') {
          style.color = colors.primary;
          style.textDecorationLine = 'underline';
        }
      }
      if (underline && strike) style.textDecorationLine = 'underline line-through';
      else if (underline) style.textDecorationLine = 'underline';
      else if (strike) style.textDecorationLine = 'line-through';
      return <Text key={key} style={style}>{node.text ?? ''}</Text>;
    }

    if (Array.isArray(node.content)) {
      return <Fragment key={key}>{renderInline(node.content, colors, baseStyle, key)}</Fragment>;
    }

    return null;
  });
}

function resolvedColor(light: string, dark: string, fallback: string) {
  return fallback === '#FFFFFF' ? light : dark;
}

function blockTextStyle(type: string, colors: ReturnType<typeof useThemeMode>['colors']): TextStyle {
  if (type === 'heading-1') return { color: colors.text, fontSize: 26, fontWeight: '800', lineHeight: 34 };
  if (type === 'heading-2') return { color: colors.text, fontSize: 22, fontWeight: '800', lineHeight: 30 };
  if (type === 'heading-3') return { color: colors.text, fontSize: 18, fontWeight: '700', lineHeight: 26 };
  if (type === 'quote') return { color: colors.textMuted, fontSize: 15, lineHeight: 24, fontStyle: 'italic' };
  if (type === 'code') return { color: colors.text, fontSize: 13, lineHeight: 20, fontFamily: 'Courier' };
  return { color: colors.text, fontSize: 16, lineHeight: 24 };
}

function RichTextReadOnly({ doc }: { doc: RichTextDoc }) {
  const { colors } = useThemeMode();
  const blocks = Array.isArray(doc.content) ? doc.content : [];

  if (blocks.length === 0) {
    return <Text style={{ color: colors.textMuted, fontSize: 14 }}>내용 없음</Text>;
  }

  return (
    <View style={{ gap: 10 }}>
      {blocks.map((block, index) => {
        const key = `block-${index}`;
        if (!block) return null;

        if (block.type === 'paragraph') {
          return (
            <Text key={key} style={blockTextStyle('paragraph', colors)}>
              {renderInline(block.content, colors, blockTextStyle('paragraph', colors), key)}
            </Text>
          );
        }

        if (block.type === 'heading') {
          const level = Number(block.attrs?.level ?? 1);
          const type = level === 1 ? 'heading-1' : level === 2 ? 'heading-2' : 'heading-3';
          const style = blockTextStyle(type, colors);
          return <Text key={key} style={style}>{renderInline(block.content, colors, style, key)}</Text>;
        }

        if (block.type === 'blockquote') {
          const style = blockTextStyle('quote', colors);
          return (
            <View key={key} style={{ borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: 8 }}>
              <Text style={style}>{renderInline(block.content?.[0]?.content, colors, style, key)}</Text>
            </View>
          );
        }

        if (block.type === 'bulletList' || block.type === 'orderedList' || block.type === 'taskList') {
          const items = Array.isArray(block.content) ? block.content : [];
          return (
            <View key={key} style={{ gap: 8 }}>
              {items.map((item, itemIndex) => {
                const marker = block.type === 'bulletList'
                  ? '•'
                  : block.type === 'orderedList'
                    ? `${itemIndex + 1}.`
                    : item?.attrs?.checked === true
                      ? '☑'
                      : '☐';
                const style = blockTextStyle('paragraph', colors);
                return (
                  <View key={`${key}-${itemIndex}`} style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-start' }}>
                    <Text style={[style, { width: block.type === 'orderedList' ? 18 : 14 }]}>{marker}</Text>
                    <Text style={[style, { flex: 1 }]}>
                      {renderInline(item?.content?.[0]?.content, colors, style, `${key}-${itemIndex}`)}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }

        if (block.type === 'codeBlock') {
          const style = blockTextStyle('code', colors);
          return (
            <View key={key} style={{ borderRadius: 12, padding: 12, backgroundColor: resolvedColor('#F3F4F6', '#111827', colors.card) }}>
              <Text style={style}>{renderInline(block.content, colors, style, key)}</Text>
            </View>
          );
        }

        const style = blockTextStyle('paragraph', colors);
        return <Text key={key} style={style}>{renderInline(block.content, colors, style, key)}</Text>;
      })}
    </View>
  );
}

export function SharedRichTextNative({
  valueJson = '',
  valueText = '',
  placeholder = '내용을 입력하세요.',
  readOnly = false,
  minHeight = 180,
  onChange,
}: SharedRichTextEditorProps) {
  const { colors } = useThemeMode();
  const normalizedJson = normalizeRichTextJson(valueJson);
  const parsedDoc = useMemo(() => parseRichTextDoc(normalizedJson), [normalizedJson]);
  const [doc, setDoc] = useState<RichTextDoc>(parsedDoc);
  const [text, setText] = useState(() => richTextDocToPlainText(parsedDoc, valueText));
  const [selection, setSelection] = useState<SelectionRange>({ start: 0, end: 0 });
  const [fontSize, setFontSize] = useState<(typeof RICH_TEXT_FONT_SIZES)[number]>('16px');
  const [heading, setHeading] = useState<(typeof RICH_TEXT_HEADING_OPTIONS)[number]['value']>('paragraph');
  const historyRef = useRef<string[]>([]);
  const futureRef = useRef<string[]>([]);
  const pendingContinuationRef = useRef<string | null>(null);
  const lastExternalJsonRef = useRef(normalizedJson);

  const editorHeight = useMemo(() => Math.max(minHeight, 260), [minHeight]);
  const headingLabel = useMemo(
    () => RICH_TEXT_HEADING_OPTIONS.find((option) => option.value === heading)?.labelKo ?? '본문',
    [heading],
  );

  const cycleHeading = () => {
    const currentIndex = RICH_TEXT_HEADING_OPTIONS.findIndex((option) => option.value === heading);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % RICH_TEXT_HEADING_OPTIONS.length : 0;
    onHeadingChange(RICH_TEXT_HEADING_OPTIONS[nextIndex].value);
  };

  const cycleFontSize = () => {
    const currentIndex = RICH_TEXT_FONT_SIZES.findIndex((size) => size === fontSize);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % RICH_TEXT_FONT_SIZES.length : 0;
    setFontSize(RICH_TEXT_FONT_SIZES[nextIndex]);
  };

  useEffect(() => {
    if (normalizedJson === lastExternalJsonRef.current) return;
    lastExternalJsonRef.current = normalizedJson;
    setDoc(parsedDoc);
    setText(richTextDocToPlainText(parsedDoc, valueText));
  }, [normalizedJson, parsedDoc, valueText]);

  useEffect(() => {
    setHeading(detectHeading(getCurrentLineText(text, selection)));
  }, [text, selection]);

  const emitDoc = (nextDoc: RichTextDoc, nextText?: string) => {
    const json = serializeRichTextDoc(nextDoc);
    lastExternalJsonRef.current = json;
    onChange?.(json, nextText ?? richTextDocToPlainText(nextDoc, valueText));
  };

  const pushHistory = (current: string) => {
    historyRef.current = [...historyRef.current.slice(-29), current];
    futureRef.current = [];
  };

  const applyText = (nextText: string, nextSelection?: SelectionRange) => {
    pushHistory(text);
    const nextDoc = plainTextToRichTextDoc(nextText);
    setDoc(nextDoc);
    setText(nextText);
    if (nextSelection) setSelection(nextSelection);
    emitDoc(nextDoc, nextText);
  };

  const onToolbarAction = (action: RichTextToolbarAction) => {
    if (readOnly) return;

    if (action === 'undo') {
      const previous = historyRef.current.at(-1);
      if (!previous) return;
      historyRef.current = historyRef.current.slice(0, -1);
      futureRef.current = [text, ...futureRef.current];
      const previousDoc = plainTextToRichTextDoc(previous);
      setDoc(previousDoc);
      setText(previous);
      emitDoc(previousDoc, previous);
      return;
    }

    if (action === 'redo') {
      const next = futureRef.current.at(0);
      if (!next) return;
      futureRef.current = futureRef.current.slice(1);
      historyRef.current = [...historyRef.current, text];
      const nextDoc = plainTextToRichTextDoc(next);
      setDoc(nextDoc);
      setText(next);
      emitDoc(nextDoc, next);
      return;
    }

    if (action === 'bold') return void (() => { const next = wrapSelection(text, selection, '**', '**'); applyText(next.text, next.selection); })();
    if (action === 'italic') return void (() => { const next = wrapSelection(text, selection, '_', '_'); applyText(next.text, next.selection); })();
    if (action === 'underline') return void (() => { const next = wrapSelection(text, selection, '__', '__'); applyText(next.text, next.selection); })();
    if (action === 'strike') return void (() => { const next = wrapSelection(text, selection, '~~', '~~'); applyText(next.text, next.selection); })();
    if (action === 'highlight') return void (() => { const next = wrapSelection(text, selection, '==', '=='); applyText(next.text, next.selection); })();
    if (action === 'code') return void (() => { const next = wrapSelection(text, selection, '`', '`'); applyText(next.text, next.selection); })();
    if (action === 'codeblock') return void (() => { const next = wrapSelection(text, selection, '```\n', '\n```'); applyText(next.text, next.selection); })();
    if (action === 'quote') return void (() => { const next = toggleLinePrefix(text, selection, '> ', /^>\s+/); applyText(next.text, next.selection); })();
    if (action === 'ul') return void (() => { const next = toggleLinePrefix(text, selection, '- ', /^[-*]\s+/); applyText(next.text, next.selection); })();
    if (action === 'ol') return void (() => { const next = toggleLinePrefix(text, selection, '1. ', /^\d+\.\s+/); applyText(next.text, next.selection); })();
    if (action === 'task') return void (() => { const next = toggleLinePrefix(text, selection, '- [ ] ', /^- \[[ xX]\]\s+/); applyText(next.text, next.selection); })();
    if (action === 'link') return void (() => { const next = wrapSelection(text, selection, '[', '](https://)'); applyText(next.text, next.selection); })();
    if (action === 'clear') applyText('');
  };

  const onHeadingChange = (nextHeading: (typeof RICH_TEXT_HEADING_OPTIONS)[number]['value']) => {
    setHeading(nextHeading);
    if (readOnly) return;
    const currentLine = getCurrentLineText(text, selection);
    const nextLine = `${HEADING_PREFIX_MAP[nextHeading]}${stripBlockPrefix(currentLine)}`;
    const next = replaceCurrentLine(text, selection, nextLine);
    applyText(next.text, next.selection);
  };

  const onChangeText = (nextText: string) => {
    const continuation = pendingContinuationRef.current;
    pendingContinuationRef.current = null;

    if (continuation && nextText.length >= text.length) {
      const cursor = selection.start + 1;
      const nextWithContinuation = `${nextText.slice(0, cursor)}${continuation}${nextText.slice(cursor)}`;
      applyText(nextWithContinuation, {
        start: cursor + continuation.length,
        end: cursor + continuation.length,
      });
      return;
    }

    const nextDoc = plainTextToRichTextDoc(nextText);
    setDoc(nextDoc);
    setText(nextText);
    emitDoc(nextDoc, nextText);
  };

  const onSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setSelection(event.nativeEvent.selection);
  };

  const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (event.nativeEvent.key !== 'Enter') return;
    pendingContinuationRef.current = getContinuationPrefix(getCurrentLineText(text, selection));
  };

  if (readOnly) {
    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          backgroundColor: colors.card,
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      >
        <RichTextReadOnly doc={doc} />
      </View>
    );
  }

  const ToolbarButton = ({
    action,
    children,
    danger = false,
  }: {
    action: RichTextToolbarAction;
    children: React.ReactNode;
    danger?: boolean;
  }) => (
    <Pressable
      onPress={() => onToolbarAction(action)}
      style={{
        minWidth: 34,
        height: 34,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.cardSoft,
      }}
    >
      <Text style={{ color: danger ? '#EF4444' : colors.textMuted, fontSize: 12, fontWeight: '700' }}>{children}</Text>
    </Pressable>
  );

  const ToolbarIconButton = ({
    action,
    danger = false,
    icon,
  }: {
    action: RichTextToolbarAction;
    danger?: boolean;
    icon: React.ReactNode;
  }) => (
    <Pressable
      onPress={() => onToolbarAction(action)}
      style={{
        minWidth: 34,
        height: 34,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.cardSoft,
      }}
    >
      {danger ? <View style={{ opacity: 1 }}>{icon}</View> : icon}
    </Pressable>
  );

  const Separator = () => (
    <View style={{ width: 1, height: 26, backgroundColor: colors.border, marginHorizontal: 4 }} />
  );

  return (
    <View
      style={{
        minHeight,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: colors.card,
      }}
    >
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: 10,
          paddingVertical: 8,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <ToolbarIconButton action="undo" icon={<Ionicons name="arrow-undo-outline" size={18} color={colors.textMuted} />} />
          <ToolbarIconButton action="redo" icon={<Ionicons name="arrow-redo-outline" size={18} color={colors.textMuted} />} />
          <Separator />
          <Pressable
            onPress={cycleHeading}
            style={{
              height: 40,
              minWidth: 132,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.card,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{headingLabel}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={cycleFontSize}
            style={{
              height: 40,
              minWidth: 100,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.card,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{fontSize}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <ToolbarButton action="bold">B</ToolbarButton>
          <ToolbarButton action="italic">I</ToolbarButton>
          <ToolbarButton action="underline">U</ToolbarButton>
          <ToolbarButton action="strike">S</ToolbarButton>
          <ToolbarIconButton action="highlight" icon={<MaterialCommunityIcons name="format-color-highlight" size={18} color={colors.textMuted} />} />
          <Pressable
            onPress={() => {}}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderWidth: 2,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.card,
            }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#111827' }} />
          </Pressable>
          <Separator />
          <ToolbarIconButton action="ul" icon={<MaterialCommunityIcons name="format-list-bulleted" size={18} color={colors.textMuted} />} />
          <ToolbarIconButton action="ol" icon={<MaterialCommunityIcons name="format-list-numbered" size={18} color={colors.textMuted} />} />
          <ToolbarIconButton action="task" icon={<MaterialCommunityIcons name="checkbox-marked-outline" size={18} color={colors.textMuted} />} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <ToolbarIconButton action="left" icon={<MaterialCommunityIcons name="format-align-left" size={18} color={colors.textMuted} />} />
          <ToolbarIconButton action="center" icon={<MaterialCommunityIcons name="format-align-center" size={18} color={colors.textMuted} />} />
          <ToolbarIconButton action="right" icon={<MaterialCommunityIcons name="format-align-right" size={18} color={colors.textMuted} />} />
          <Separator />
          <ToolbarIconButton action="quote" icon={<MaterialCommunityIcons name="format-quote-close" size={18} color={colors.textMuted} />} />
          <ToolbarIconButton action="code" icon={<Ionicons name="code-slash-outline" size={18} color={colors.textMuted} />} />
          <ToolbarIconButton action="codeblock" icon={<MaterialCommunityIcons name="image-outline" size={18} color={colors.textMuted} />} />
          <ToolbarIconButton action="link" icon={<Ionicons name="link-outline" size={18} color={colors.textMuted} />} />
          <ToolbarIconButton action="clear" danger icon={<Ionicons name="trash-outline" size={18} color="#EF4444" />} />
        </View>
      </View>

      <TextInput
        multiline
        value={text}
        selection={selection}
        onSelectionChange={onSelectionChange}
        onKeyPress={onKeyPress}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={{
          minHeight: editorHeight,
          paddingHorizontal: 12,
          paddingVertical: 12,
          color: colors.text,
          fontSize: Number.parseInt(fontSize, 10) || 16,
          lineHeight: 24,
          textAlignVertical: 'top',
        }}
      />
    </View>
  );
}
