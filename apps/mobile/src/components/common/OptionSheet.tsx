import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useThemeMode } from '../../contexts/ThemeContext';
import { createStyles } from '../../styles/createStyles';

type Option<T extends string | number> = {
  key: T;
  label: string;
  description?: string;
};

type Props<T extends string | number> = {
  title: string;
  open: boolean;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onClose: () => void;
  onSelect: (value: T) => void;
};

export function OptionSheet<T extends string | number>({
  title,
  open,
  value,
  options,
  onClose,
  onSelect,
}: Props<T>) {
  const { colors } = useThemeMode();
  const s = createStyles(colors);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.24)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: 28,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
            <Pressable onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 8 }}>
            {options.map((option) => {
              const active = option.key === value;
              return (
                <Pressable
                  key={String(option.key)}
                  onPress={() => {
                    onSelect(option.key);
                    onClose();
                  }}
                  style={[
                    s.panel,
                    {
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? `${colors.primary}12` : colors.card,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ flex: 1, gap: option.description ? 4 : 0 }}>
                      <Text style={{ color: active ? colors.primary : colors.text, fontSize: 15, fontWeight: '700' }}>
                        {option.label}
                      </Text>
                      {option.description ? (
                        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '500' }}>
                          {option.description}
                        </Text>
                      ) : null}
                    </View>
                    {active ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
