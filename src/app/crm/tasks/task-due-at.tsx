"use client";

export function TaskDueAt({
  value,
}: {
  value: string;
}) {
  const date =
    new Date(value);

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
