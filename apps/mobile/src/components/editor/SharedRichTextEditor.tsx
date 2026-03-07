import { normalizeRichTextJson } from '@repo/utils';
import { SharedRichTextNative } from './SharedRichTextNative';
import type { SharedRichTextEditorProps, SharedRichTextImplementation } from './SharedRichText.types';
import { SharedRichTextWebView } from './SharedRichTextWebView';

const DEFAULT_IMPLEMENTATION: SharedRichTextImplementation = 'webview';

export function SharedRichTextEditor({
  valueJson = '',
  valueText = '',
  placeholder,
  readOnly,
  minHeight,
  onChange,
  implementation = DEFAULT_IMPLEMENTATION,
}: SharedRichTextEditorProps) {
  const normalizedJson = normalizeRichTextJson(valueJson);

  if (implementation === 'native') {
    return (
      <SharedRichTextNative
        valueJson={normalizedJson}
        valueText={valueText}
        placeholder={placeholder}
        readOnly={readOnly}
        minHeight={minHeight}
        onChange={onChange}
      />
    );
  }

  return (
    <SharedRichTextWebView
      valueJson={normalizedJson}
      valueText={valueText}
      placeholder={placeholder}
      readOnly={readOnly}
      minHeight={minHeight}
      onChange={onChange}
    />
  );
}
