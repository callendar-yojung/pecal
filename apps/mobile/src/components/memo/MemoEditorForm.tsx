import { Pressable, Text, TextInput, View } from 'react-native';
import { useThemeMode } from '../../contexts/ThemeContext';
import { createStyles } from '../../styles/createStyles';
import { SharedRichTextEditor } from '../editor/SharedRichTextEditor';

type Props = {
  title: string;
  contentJson: string;
  contentText: string;
  saving: boolean;
  conflict: boolean;
  onTitleChange: (value: string) => void;
  onContentChange: (json: string, plainText: string) => void;
  onBackToList: () => void;
  onDelete?: () => void;
  onForceOverwrite?: () => void;
};

export function MemoEditorForm({
  title,
  contentJson,
  contentText,
  saving,
  conflict,
  onTitleChange,
  onContentChange,
  onBackToList,
  onDelete,
  onForceOverwrite,
}: Props) {
  const { colors, resolvedMode } = useThemeMode();
  const s = createStyles(colors);
  const borderColor = resolvedMode === 'black' ? '#2D3443' : '#D9E0EF';
  const cardColor = resolvedMode === 'black' ? '#141923' : '#FFFFFF';
  const softColor = resolvedMode === 'black' ? '#A3AEC2' : '#667085';
  const titleColor = resolvedMode === 'black' ? '#F3F6FF' : '#111827';

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor,
        borderRadius: 18,
        padding: 14,
        backgroundColor: cardColor,
        gap: 12,
      }}
    >
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ color: titleColor, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 }}>메모</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={onBackToList}
              style={{
                borderWidth: 1,
                borderColor,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: cardColor,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>목록</Text>
            </Pressable>
            {onDelete ? (
              <Pressable
                onPress={onDelete}
                style={{
                  borderWidth: 1,
                  borderColor: '#FCA5A5',
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  backgroundColor: resolvedMode === 'black' ? '#2A1414' : '#FFF5F5',
                }}
              >
                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>삭제</Text>
              </Pressable>
            ) : null}
            <Text style={{ color: softColor, fontSize: 12, fontWeight: '600' }}>{saving ? '저장 중...' : '자동 저장'}</Text>
          </View>
        </View>
      </View>

      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder="제목"
        style={[
          s.input,
          {
            borderRadius: 12,
            fontSize: 16,
            fontWeight: '700',
            backgroundColor: resolvedMode === 'black' ? '#0F141D' : '#FFFFFF',
          },
        ]}
        placeholderTextColor={colors.textMuted}
      />

      <SharedRichTextEditor
        valueJson={contentJson}
        valueText={contentText}
        placeholder="메모 내용을 입력하세요."
        minHeight={470}
        implementation="webview"
        onChange={onContentChange}
      />

      {conflict ? (
        <View style={[s.notificationRow, { borderColor: '#F59E0B' }]}>
          <Text style={[s.itemMeta, { color: '#B45309' }]}>충돌 감지됨: 다른 기기 변경본이 있습니다.</Text>
        </View>
      ) : null}

      {onForceOverwrite ? (
        <View style={s.row}>
          {onForceOverwrite ? (
            <Pressable style={s.secondaryButtonHalf} onPress={onForceOverwrite}>
              <Text style={s.secondaryButtonText}>덮어쓰기</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
