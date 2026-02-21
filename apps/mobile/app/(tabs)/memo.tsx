import { Redirect } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';
import { MemoScreen } from '../../src/screens/MemoScreen';

export default function MemoTab() {
  const { auth, data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);

  if (!auth.session) return <Redirect href="/(auth)/login" />;

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      {data.error || auth.error ? <Text style={s.errorText}>{data.error || auth.error}</Text> : null}
      {!data.selectedWorkspace ? <Text style={s.emptyText}>워크스페이스를 선택하세요.</Text> : null}
      {data.selectedWorkspace ? (
        <MemoScreen
          memoTitle={data.memoTitle}
          memoText={data.memoText}
          memoContentJson={data.memoContentJson}
          selectedMemoId={data.selectedMemoId}
          memoConflict={data.memoConflict}
          memoSearch={data.memoSearch}
          memoFolderFilter={data.memoFolderFilter}
          memoSort={data.memoSort}
          memoFavoriteOnly={data.memoFavoriteOnly}
          memoIsSaving={data.memoIsSaving}
          memos={data.decoratedMemos}
          onMemoTitleChange={data.setMemoTitle}
          onMemoTextChange={data.setMemoText}
          onMemoEditorChange={data.onMemoEditorChange}
          onMemoSearchChange={data.setMemoSearch}
          onMemoFolderFilterChange={data.setMemoFolderFilter}
          onMemoSortChange={data.setMemoSort}
          onMemoFavoriteOnlyToggle={() => data.setMemoFavoriteOnly(!data.memoFavoriteOnly)}
          onSelectMemoForEdit={data.selectMemoForEdit}
          onClearMemoEditor={data.clearMemoEditor}
          onUpdateMemo={data.updateMemo}
          onToggleMemoPinned={data.toggleMemoPinned}
          onSetMemoFolder={data.setMemoFolder}
          onSetMemoTags={data.setMemoTags}
          onToggleMemoFavorite={data.toggleMemoFavorite}
          onDeleteMemo={data.deleteMemo}
        />
      ) : null}
    </ScrollView>
  );
}
