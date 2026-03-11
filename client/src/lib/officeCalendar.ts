import { addDays, format, startOfDay } from 'date-fns';

export const OFFICE_REGION_LABEL = 'Puducherry and Karaikal';

// 2026 government holidays for Puducherry and Karaikal regions.
const OFFICE_GOVERNMENT_HOLIDAYS: Record<number, Record<string, string>> = {
  2026: {
    '2026-01-01': "New Year's Day",
    '2026-01-15': 'Pongal',
    '2026-01-16': 'Thiruvalluvar Day / Mattu Pongal',
    '2026-01-26': 'Republic Day',
    '2026-03-20': 'Ramzan (Id-ul-Fitr)',
    '2026-04-03': 'Good Friday',
    '2026-04-14': "Tamil New Year / Dr. Ambedkar's Birthday",
    '2026-05-01': 'May Day',
    '2026-05-28': 'Bakrid (Id-ul-Alha)',
    '2026-08-15': 'Independence Day',
    '2026-08-26': 'Milad-Un-Nabi',
    '2026-09-14': 'Vinayagar Chathurthi',
    '2026-10-02': 'Gandhi Jayanthi',
    '2026-10-19': 'Saraswathi Pooja / Ayudha Pooja',
    '2026-11-01': 'Puducherry Liberation Day',
    '2026-11-08': 'Deepavali',
    '2026-12-25': 'Christmas',
  },
};

const toDateKey = (value: Date) => format(startOfDay(value), 'yyyy-MM-dd');

export const isWeekendDate = (value: Date) => {
  const day = startOfDay(value).getDay();
  return day === 0 || day === 6;
};

export const getOfficeGovernmentHolidayName = (value: Date) => {
  const normalized = startOfDay(value);
  return OFFICE_GOVERNMENT_HOLIDAYS[normalized.getFullYear()]?.[toDateKey(normalized)] || '';
};

export const isOfficeGovernmentHoliday = (value: Date) =>
  Boolean(getOfficeGovernmentHolidayName(value));

export const isOfficeClosedDate = (value: Date) =>
  isWeekendDate(value) || isOfficeGovernmentHoliday(value);

export const addOfficeOpenDays = (baseDate: Date, days: number) => {
  let candidate = startOfDay(baseDate);
  let remaining = Math.max(0, days);

  while (remaining > 0) {
    candidate = addDays(candidate, 1);
    if (!isOfficeClosedDate(candidate)) {
      remaining -= 1;
    }
  }

  return candidate;
};
