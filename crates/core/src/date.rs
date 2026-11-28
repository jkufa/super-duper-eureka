use std::fmt;

use jiff::Span;
use jiff::civil::Date;

const FIRST_YEAR: i16 = 1;

/// A day in the proleptic Gregorian calendar with no time or timezone, in years 0001 to 9999.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct CalendarDate(Date);

impl CalendarDate {
    /// `None` when the day is not in the month or the year is outside 0001 to 9999.
    pub fn new(year: i16, month: i8, day: i8) -> Option<Self> {
        Date::new(year, month, day).ok().and_then(Self::in_range)
    }

    /// Accepts exactly `YYYY-MM-DD`: ten ASCII characters, zero padded.
    pub fn parse(text: &str) -> Option<Self> {
        if !has_file_shape(text) {
            return None;
        }
        text.parse().ok().and_then(Self::in_range)
    }

    pub fn year(self) -> i16 {
        self.0.year()
    }

    /// 1 to 12.
    pub fn month(self) -> i8 {
        self.0.month()
    }

    pub fn day(self) -> i8 {
        self.0.day()
    }

    pub fn days_in_month(self) -> i8 {
        self.0.days_in_month()
    }

    pub fn days_in_year(self) -> i16 {
        self.0.days_in_year()
    }

    /// The day is clamped to the last day of the resulting month.
    /// `None` when the result falls outside years 0001 to 9999.
    pub fn checked_add_months(self, months: i32) -> Option<Self> {
        let span = Span::new().try_months(months).ok()?;
        self.0.checked_add(span).ok().and_then(Self::in_range)
    }

    /// The same year and month on `day`, or on the month's last day when it has no such day.
    /// A `day` below 1 means the 1st.
    pub fn with_day_clamped(self, day: i8) -> Self {
        self.0
            .with()
            .day(day.max(1))
            .build()
            .map_or_else(|_| Self(self.0.last_of_month()), Self)
    }

    fn in_range(date: Date) -> Option<Self> {
        (date.year() >= FIRST_YEAR).then_some(Self(date))
    }
}

fn has_file_shape(text: &str) -> bool {
    text.len() == 10
        && text.bytes().enumerate().all(|(index, byte)| match index {
            4 | 7 => byte == b'-',
            _ => byte.is_ascii_digit(),
        })
}

impl fmt::Display for CalendarDate {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{:04}-{:02}-{:02}",
            self.year(),
            self.month(),
            self.day()
        )
    }
}

#[cfg(test)]
mod tests {
    use super::CalendarDate;

    fn date(text: &str) -> CalendarDate {
        CalendarDate::parse(text).unwrap()
    }

    #[test]
    fn counts_days_in_leap_and_century_years() {
        for (year, days) in [
            (1900, 365),
            (2000, 366),
            (2024, 366),
            (2026, 365),
            (2100, 365),
        ] {
            assert_eq!(CalendarDate::new(year, 6, 1).unwrap().days_in_year(), days);
        }
    }

    #[test]
    fn counts_days_in_each_month() {
        let days: Vec<i8> = (1..=12)
            .map(|month| CalendarDate::new(2026, month, 1).unwrap().days_in_month())
            .collect();

        assert_eq!(days, [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
        for (year, days) in [(1900, 28), (2000, 29), (2024, 29), (2100, 28)] {
            assert_eq!(CalendarDate::new(year, 2, 1).unwrap().days_in_month(), days);
        }
    }

    #[test]
    fn compares_by_year_then_month_then_day() {
        let day = date("2026-05-15");

        assert_eq!(day, date("2026-05-15"));
        assert!(day < date("2027-01-01"));
        assert!(day > date("2026-04-30"));
        assert!(day < date("2026-05-16"));
    }

    #[test]
    fn adds_months_clamping_the_day_to_the_month() {
        for (from, months, expected) in [
            ("2026-11-15", 3, "2027-02-15"),
            ("2026-12-31", 1, "2027-01-31"),
            ("2026-01-15", -1, "2025-12-15"),
            ("2026-01-29", 1, "2026-02-28"),
            ("2026-01-30", 1, "2026-02-28"),
            ("2026-01-31", 1, "2026-02-28"),
            ("2024-01-29", 1, "2024-02-29"),
            ("2024-01-30", 1, "2024-02-29"),
            ("2024-01-31", 1, "2024-02-29"),
            ("2026-03-30", -1, "2026-02-28"),
            ("2026-03-31", 1, "2026-04-30"),
            ("2026-03-31", -1, "2026-02-28"),
            ("2024-02-29", 12, "2025-02-28"),
            ("2026-01-31", -13, "2024-12-31"),
            ("2026-01-01", 120, "2036-01-01"),
            ("2026-08-31", 1200, "2126-08-31"),
        ] {
            assert_eq!(
                date(from).checked_add_months(months).unwrap().to_string(),
                expected,
                "{from} plus {months} months"
            );
        }
    }

    #[test]
    fn moves_to_another_day_of_the_same_month_clamping_to_its_end() {
        for (from, day, expected) in [
            ("2026-04-15", 1, "2026-04-01"),
            ("2026-04-15", 30, "2026-04-30"),
            ("2026-04-15", 31, "2026-04-30"),
            ("2026-01-01", 31, "2026-01-31"),
            ("2026-02-10", 29, "2026-02-28"),
            ("2026-02-10", 31, "2026-02-28"),
            ("2024-02-10", 29, "2024-02-29"),
            ("2024-02-10", 31, "2024-02-29"),
            ("2026-03-09", 9, "2026-03-09"),
            ("2026-03-09", 0, "2026-03-01"),
            ("9999-12-01", 31, "9999-12-31"),
            ("0001-01-31", 1, "0001-01-01"),
        ] {
            assert_eq!(
                date(from).with_day_clamped(day).to_string(),
                expected,
                "{from} on day {day}"
            );
        }
    }

    #[test]
    fn fails_to_add_months_past_years_0001_to_9999() {
        for (from, months) in [
            ("9999-12-31", 1),
            ("0001-01-01", -1),
            ("2026-01-01", 12 * 8000),
            ("2026-01-01", i32::MAX),
            ("2026-01-01", i32::MIN),
        ] {
            assert_eq!(
                date(from).checked_add_months(months),
                None,
                "{from} plus {months}"
            );
        }
    }

    #[test]
    fn reaches_both_ends_of_the_year_range() {
        assert_eq!(
            date("9999-11-30").checked_add_months(1),
            Some(date("9999-12-30"))
        );
        assert_eq!(
            date("0001-02-28").checked_add_months(-1),
            Some(date("0001-01-28"))
        );
    }

    #[test]
    fn builds_only_dates_in_years_0001_to_9999() {
        assert_eq!(CalendarDate::new(1, 1, 1), Some(date("0001-01-01")));
        assert_eq!(CalendarDate::new(9999, 12, 31), Some(date("9999-12-31")));
        assert_eq!(CalendarDate::new(0, 1, 1), None);
        assert_eq!(CalendarDate::new(10_000, 1, 1), None);
        assert_eq!(CalendarDate::new(2026, 2, 29), None);
    }

    #[test]
    fn parses_and_prints_the_file_form_unchanged() {
        for text in [
            "2026-01-01",
            "2024-02-29",
            "0001-01-01",
            "9999-12-31",
            "2026-12-31",
        ] {
            assert_eq!(date(text).to_string(), text);
        }
    }

    #[test]
    fn parses_into_year_month_and_day() {
        let parsed = date("2026-03-09");

        assert_eq!((parsed.year(), parsed.month(), parsed.day()), (2026, 3, 9));
    }

    #[test]
    fn rejects_text_outside_the_file_grammar() {
        for text in [
            "2026-02-30",
            "2025-02-29",
            "2026-04-31",
            "2026-13-01",
            "2026-00-10",
            "2026-01-00",
            "2026-1-01",
            "26-01-01",
            "2026-01-01T00:00:00.000Z",
            " 2026-01-01",
            "2026/01/01",
            "0000-01-01",
            "0000-12-31",
            "2026-01-01\n",
            "2026-01-01 ",
            "\t2026-01-01",
            "2026-01-01T00:00",
            "2026-01-01Z",
            "＋2026-01-01",
            "२०२६-01-01",
            "+002026-01-01",
            "-0001-01-01",
            "",
        ] {
            assert_eq!(CalendarDate::parse(text), None, "{text:?}");
        }
    }
}
