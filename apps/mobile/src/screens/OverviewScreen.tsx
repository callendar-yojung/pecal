import { Text, View } from 'react-native';
import { useThemeMode } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';
import { createStyles } from '../styles/createStyles';

type Props = {
  taskCount: number;
  memoCount: number;
  fileCount: number;
  unreadCount: number;
};

export function OverviewScreen({ taskCount, memoCount, fileCount, unreadCount }: Props) {
  const { colors } = useThemeMode();
  const { t } = useI18n();
  const s = createStyles(colors);

  const cards = [
    { label: t('overviewCardTasks'), value: taskCount, icon: '●', color: '#5B6CF6' },
    { label: t('overviewCardMemos'), value: memoCount, icon: '◆', color: '#10B981' },
    { label: t('overviewCardFiles'), value: fileCount, icon: '■', color: '#F97316' },
    { label: t('overviewCardUnread'), value: unreadCount, icon: '●', color: '#EF4444' },
  ];

  return (
    <View style={s.section}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
          {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
        </Text>
        <Text style={[s.sectionTitle, { fontSize: 24 }]}>{t('commonOverview')}</Text>
      </View>

      <View style={[s.grid, { justifyContent: 'space-between' }]}>
        {cards.map((card) => (
          <View
            key={card.label}
            style={{
              width: '48%',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 8,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${card.color}22`,
              }}
            >
              <Text style={{ color: card.color, fontWeight: '800', fontSize: 14 }}>{card.icon}</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.8 }}>{card.value}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>{card.label}</Text>
          </View>
        ))}
      </View>

      <View style={[s.panel, { borderRadius: 18, gap: 10 }]}> 
        <Text style={[s.formTitle, { fontSize: 16 }]}>{t('commonTodaySummary')}</Text>
        <View style={[s.listRow, { borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#5B6CF6' }]}>
          <Text style={s.itemTitle}>{t('overviewSummaryTasks')}</Text>
          <Text style={s.itemMeta}>{t('overviewSummaryTasksDesc', { count: taskCount })}</Text>
        </View>
        <View style={[s.listRow, { borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#10B981' }]}>
          <Text style={s.itemTitle}>{t('overviewSummaryMemos')}</Text>
          <Text style={s.itemMeta}>{t('overviewSummaryMemosDesc', { count: memoCount })}</Text>
        </View>
      </View>
    </View>
  );
}
