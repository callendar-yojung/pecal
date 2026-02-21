import { ScrollView, Text, View } from 'react-native';
import { useMobileApp } from '../../src/contexts/MobileAppContext';
import { useThemeMode } from '../../src/contexts/ThemeContext';
import { createStyles } from '../../src/styles/createStyles';

export default function TeamSettingsPage() {
  const { data } = useMobileApp();
  const { colors } = useThemeMode();
  const s = createStyles(colors);

  return (
    <ScrollView style={s.content} contentContainerStyle={s.contentContainer}>
      <View style={s.section}>
        <Text style={s.sectionTitle}>팀 설정</Text>

        <View style={s.panel}>
          <Text style={s.formTitle}>현재 워크스페이스</Text>
          <Text style={s.itemMeta}>이름: {data.selectedWorkspace?.name ?? '-'}</Text>
          <Text style={s.itemMeta}>타입: {data.selectedWorkspace?.type ?? '-'}</Text>
          <Text style={s.itemMeta}>Owner ID: {data.selectedWorkspace?.owner_id ?? '-'}</Text>
        </View>

        <View style={s.panel}>
          <Text style={s.formTitle}>팀 목록</Text>
          {data.teamWorkspaces.map((teamWs) => (
            <View key={teamWs.workspace_id} style={s.listRow}>
              <Text style={s.itemTitle}>{teamWs.teamName}</Text>
              <Text style={s.itemMeta}>Workspace ID: {teamWs.workspace_id}</Text>
            </View>
          ))}
          {!data.teamWorkspaces.length ? <Text style={s.emptyText}>팀이 없습니다.</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}
