/**
 * One month of days: a complete day gets a paw-print stamp, any other stays plain. A small
 * dumbbell in the corner says the workout was done.
 *
 * Loads its own month from /progress/calendar and steps between months with the arrows. Tapping
 * a day is optional; without `onSelect` the days are read-only.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { api, type Schema } from '@/api/client';
import { ChevronIcon, DumbbellIcon, PawIcon } from '@/components/icons';
import { Text } from '@/components/text';
import { color } from '@/theme/tokens';

type Month = Schema<'CalendarMonthOut'>;
type Day = Month['days'][number];

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/** "2026-10" moved by whole months. */
function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number);
  const moved = new Date(year, number - 1 + by, 1);
  return `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`;
}

export function MonthCalendar({
  onSelect,
  selectable,
  refreshKey,
}: {
  /** A tapped day, as "2026-10-09". */
  onSelect?: (date: string) => void;
  /** Which days may be tapped; every past or present day when left out. */
  selectable?: (date: string) => boolean;
  /** Change it to load the shown month again, after something was logged. */
  refreshKey?: unknown;
}) {
  // The month asked for; null is this month, which the server knows from the user's time zone.
  const [wanted, setWanted] = useState<string | null>(null);
  const [data, setData] = useState<Month | null>(null);

  useEffect(() => {
    let live = true;
    api
      .get<'/progress/calendar'>(wanted ? `/progress/calendar?month=${wanted}` : '/progress/calendar')
      .then((fresh) => {
        if (live) setData(fresh);
      })
      // The calendar is a summary; the rest of the screen still works without it.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [wanted, refreshKey]);

  if (!data) {
    return (
      <View className="h-[280px] items-center justify-center">
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  const [year, number] = data.month.split('-').map(Number);
  const thisMonth = data.today.slice(0, 7);
  // Monday first, like the week schedule: blanks before the 1st.
  const lead = (new Date(year, number - 1, 1).getDay() + 6) % 7;
  const cells: (Day | null)[] = [...Array<null>(lead).fill(null), ...data.days];
  while (cells.length % 7) cells.push(null);
  const complete = data.days.filter((day) => day.mark === 'complete').length;
  const trained = data.days.filter((day) => day.workout === 'done').length;

  const go = (by: number) => setWanted(shiftMonth(data.month, by));

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="上個月"
          onPress={() => go(-1)}
          className="h-11 w-11 items-center justify-center"
        >
          <ChevronIcon direction="left" size={18} tint={color.ink} />
        </Pressable>
        <Text className="text-[17px] text-ink">
          {year} 年 {number} 月
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="下個月"
          disabled={data.month >= thisMonth}
          onPress={() => go(1)}
          className="h-11 w-11 items-center justify-center"
        >
          <ChevronIcon direction="right" size={18} tint={data.month >= thisMonth ? color.disabled : color.ink} />
        </Pressable>
      </View>

      <View className="flex-row">
        {WEEKDAYS.map((weekday) => (
          <Text key={weekday} className="flex-1 text-center text-xs text-muted">
            {weekday}
          </Text>
        ))}
      </View>

      <View className="gap-1">
        {Array.from({ length: cells.length / 7 }, (_, week) => (
          <View key={week} className="flex-row gap-1">
            {cells.slice(week * 7, week * 7 + 7).map((day, index) =>
              day ? (
                <DayCell
                  key={day.date}
                  day={day}
                  today={day.date === data.today}
                  future={day.date > data.today}
                  onPress={
                    onSelect && day.date <= data.today && (selectable?.(day.date) ?? true)
                      ? () => onSelect(day.date)
                      : undefined
                  }
                />
              ) : (
                <View key={`blank-${week}-${index}`} className="flex-1" />
              ),
            )}
          </View>
        ))}
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <PawIcon size={13} tint={color.primary} />
            <Text className="text-xs text-muted">完成</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <DumbbellIcon size={12} tint={color.good} />
            <Text className="text-xs text-muted">訓練</Text>
          </View>
        </View>
        <Text className="text-xs text-muted">
          完成 {complete} 天 · 訓練 {trained} 次
        </Text>
      </View>
    </View>
  );
}

function DayCell({
  day,
  today,
  future,
  onPress,
}: {
  day: Day;
  today: boolean;
  future: boolean;
  onPress?: () => void;
}) {
  const complete = day.mark === 'complete';
  const date = Number(day.date.slice(8));
  const state = complete ? '完成' : '未完成';

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${date} 日，${future ? '還沒到' : state}${day.workout === 'done' ? '，有訓練' : ''}`}
      disabled={!onPress}
      onPress={onPress}
      className={`relative h-12 flex-1 items-center justify-center rounded-control ${
        today ? 'border-[1.5px] border-primary' : ''
      } ${onPress ? 'active:opacity-70' : ''}`}
    >
      {complete ? (
        // A stamped day: the date goes small above its paw print.
        <>
          <Text className="text-[10px] leading-3 text-muted">{date}</Text>
          <PawIcon size={17} tint={color.primary} />
        </>
      ) : (
        <Text className={`text-sm ${future ? 'text-disabled' : 'text-ink'}`}>{date}</Text>
      )}
      {day.workout === 'done' ? (
        // A corner badge, so it never crowds the stamp or the date.
        <View className="absolute right-0.5 top-0.5">
          <DumbbellIcon size={11} tint={color.good} />
        </View>
      ) : null}
    </Pressable>
  );
}
