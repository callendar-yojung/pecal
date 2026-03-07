export type SharedRichTextImplementation = 'webview' | 'native';

export type SharedRichTextEditorProps = {
  valueJson?: string;
  valueText?: string;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: number;
  onChange?: (json: string, plainText: string) => void;
  implementation?: SharedRichTextImplementation;
};
