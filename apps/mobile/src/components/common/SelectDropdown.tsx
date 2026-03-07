import { Pressable, Text, View } from 'react-native';
import { useThemeMode } from '../../contexts/ThemeContext';
import { createStyles } from '../../styles/createStyles';

type Option<T extends string | number> = {
  key: T;
  label: string;
};

type Props<T extends string | number> = {
  value: T;
  options: ReadonlyArray<Option<T>>;
  open: boolean;
  onToggle: () => void;
  onSelect: (value: T) => void;
  style?: 'input' | 'pill';
  numberOfLines?: number;
};

export function SelectDropdown<T extends string | number>({
  value,
  options,
  open,
  onToggle,
  onSelect,
  style = 'input',
  numberOfLines = 1,
}: Props<T>) {
  const { colors } = useThemeMode();
  const s = createStyles(colors);
  const selectedLabel = options.find((option) => option.key === value)?.label ?? '';
  const isPill = style === 'pill';

  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={
          isPill
            ? {
                backgroundColor: `${colors.primary}22`,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                alignSelf: 'flex-start',
              }
            : [
                s.input,
                {
                  minHeight: 38,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                },
              ]
        }
      >
        <Text
          style={{
            color: isPill ? colors.primary : colors.text,
            fontSize: isPill ? 11 : 14,
            fontWeight: '700',
            flexShrink: 1,
          }}
          numberOfLines={numberOfLines}
        >
          {selectedLabel}
        </Text>
        <Text style={{ color: isPill ? colors.primary : colors.textMuted, fontSize: 10 }}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? (
        <View
          style={[
            s.panel,
            {
              marginTop: 6,
              padding: 6,
              borderRadius: 14,
              gap: 4,
            },
          ]}
        >
          {options.map((option) => {
            const active = option.key === value;
            return (
              <Pressable
                key={String(option.key)}
                onPress={() => onSelect(option.key)}
                style={[
                  s.workspacePill,
                  {
                    marginRight: 0,
                    minHeight: 34,
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    justifyContent: 'center',
                  },
                  active ? s.workspacePillActive : null,
                ]}
              >
                <Text style={[s.workspacePillText, active ? s.workspacePillTextActive : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
