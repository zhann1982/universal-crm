"use client";

export function ActivityTime({
  value,
}: {
  value: string;
}) {
  const date = new Date(value);

  const formatted =
    Number.isNaN(
      date.getTime(),
    )
      ? value
      : new Intl.DateTimeFormat(
          "ru-RU",
          {
            dateStyle: "medium",
            timeStyle: "short",
          },
        ).format(date);

  return (
    <time
      dateTime={value}
      suppressHydrationWarning
    >
      {formatted}
    </time>
  );
}
