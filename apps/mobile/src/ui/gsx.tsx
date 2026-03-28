import { Pressable, Text, View, type PressableProps, type TextProps, type ViewProps } from 'react-native';

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
};

export function GsxButton({
  className,
  textClassName,
  label,
  variant = 'secondary',
  ...props
}: ButtonProps) {
  const base =
    variant === 'primary'
      ? 'bg-blue-600 border-blue-600'
      : variant === 'danger'
        ? 'bg-red-50 border-red-300'
        : 'bg-slate-50 border-slate-300';
  const textBase =
    variant === 'primary'
      ? 'text-white'
      : variant === 'danger'
        ? 'text-red-600'
        : 'text-slate-700';

  return (
    <Pressable
      className={cx(
        'rounded-2xl border px-3 py-2.5 items-center justify-center shadow-sm',
        base,
        className,
      )}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.9 : 1 }]}
      {...props}
    >
      <Text className={cx('text-sm font-extrabold tracking-tight', textBase, textClassName)}>{label}</Text>
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
      className={cx(
        'rounded-full border px-3 py-2',
        active ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-slate-50 border-slate-300',
        className,
      )}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      {...props}
    >
      <Text className={cx('text-xs font-bold', active ? 'text-blue-700' : 'text-slate-600', textClassName)}>
        {label}
      </Text>
    </Pressable>
  );
}

type HeadingProps = TextProps & { className?: string };

export function GsxHeading({ className, ...props }: HeadingProps) {
  return <Text className={cx('text-slate-900 font-extrabold tracking-tight', className)} {...props} />;
}
