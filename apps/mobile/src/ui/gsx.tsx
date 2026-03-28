import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type TextProps, type ViewProps } from 'react-native';

function cx(...values: Array<string | undefined | null | false>) {
  return values.filter(Boolean).join(' ');
}

type CardProps = ViewProps & {
  className?: string;
};

export function GsxCard({ className, ...props }: CardProps) {
  return (
    <View
      className={cx(
        'rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

type ButtonProps = PressableProps & {
  className?: string;
  textClassName?: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
};

export function GsxButton({
  className,
  textClassName,
  label,
  variant = 'secondary',
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  const variantStyle =
    variant === 'primary'
      ? styles.buttonPrimary
      : variant === 'danger'
        ? styles.buttonDanger
        : styles.buttonSecondary;
  const variantTextStyle =
    variant === 'primary'
      ? styles.buttonTextPrimary
      : variant === 'danger'
        ? styles.buttonTextDanger
        : styles.buttonTextSecondary;

  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      className={className}
      style={({ pressed }) => [
        styles.buttonBase,
        variantStyle,
        isDisabled ? styles.buttonDisabled : null,
        { transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }], opacity: pressed && !isDisabled ? 0.92 : 1 },
      ]}
      disabled={isDisabled}
      {...props}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? '#DC2626' : '#334155'}
            style={styles.buttonSpinner}
          />
        ) : null}
        <Text className={textClassName} style={[styles.buttonTextBase, variantTextStyle]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

type ChipProps = PressableProps & {
  className?: string;
  textClassName?: string;
  label: string;
  active?: boolean;
};

export function GsxChip({ className, textClassName, label, active, ...props }: ChipProps) {
  return (
    <Pressable
      className={className}
      style={({ pressed }) => [
        styles.chipBase,
        active ? styles.chipActive : styles.chipInactive,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
      {...props}
    >
      <Text className={textClassName} style={[styles.chipTextBase, active ? styles.chipTextActive : styles.chipTextInactive]}>
        {label}
      </Text>
    </Pressable>
  );
}

type HeadingProps = TextProps & { className?: string };

export function GsxHeading({ className, ...props }: HeadingProps) {
  return <Text className={cx('text-slate-900 font-extrabold tracking-tight', className)} {...props} />;
}

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  buttonPrimary: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  buttonSecondary: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  buttonDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  buttonTextBase: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: '#334155',
  },
  buttonTextDanger: {
    color: '#DC2626',
  },
  buttonDisabled: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonSpinner: {
    marginRight: 2,
  },
  chipBase: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  chipInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  chipTextBase: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#1D4ED8',
  },
  chipTextInactive: {
    color: '#475569',
  },
});
