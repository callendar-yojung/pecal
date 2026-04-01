const DEFAULT_TZ_OFFSET_MINUTES = Number(
  process.env.REMINDER_DEFAULT_TZ_OFFSET_MINUTES ?? 540,
);

function clampOffset(minutes: number): number {
  if (!Number.isFinite(minutes)) return 540;
  if (Math.abs(minutes) > 24 * 60) return 540;
  return Math.trunc(minutes);
}

export function resolveReminderOffsetMinutes(override?: number | null): number {
  if (override === null || override === undefined) {
    return clampOffset(DEFAULT_TZ_OFFSET_MINUTES);
  }
  return clampOffset(override);
}

export function parseDateTimeToUnix(
  datetime: string | Date,
  timezoneOffsetMinutes?: number | null,
): number | null {
  if (datetime instanceof Date) {
    if (Number.isNaN(datetime.getTime())) return null;
    return Math.floor(datetime.getTime() / 1000);
  }

  const match = datetime.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) return null;
  const [, y, m, d, hh, mm, ss = "00"] = match;
  const utcMs = Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss),
    0,
  );
  const offsetMinutes = resolveReminderOffsetMinutes(timezoneOffsetMinutes);
  return Math.floor((utcMs - offsetMinutes * 60 * 1000) / 1000);
}

export function computeReminderTriggerUnix(opts: {
  startTime: string | Date;
  reminderMinutes: number | null | undefined;
  timezoneOffsetMinutes?: number | null;
}): number | null {
  if (opts.reminderMinutes === null || opts.reminderMinutes === undefined) {
    return null;
  }
  const reminderMinutes = Math.trunc(Number(opts.reminderMinutes));
  if (!Number.isFinite(reminderMinutes) || reminderMinutes < 0) return null;

  const startAtUnix = parseDateTimeToUnix(
    opts.startTime,
    opts.timezoneOffsetMinutes,
  );
  if (startAtUnix === null) return null;
  return startAtUnix - reminderMinutes * 60;
}

