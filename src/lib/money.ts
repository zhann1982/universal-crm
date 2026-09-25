export type MoneyItem = {
  amount:
    | string
    | null;

  currency:
    | string
    | null;
};

export type CurrencyTotal = {
  currency: string;
  amount: number;
};

export function groupMoneyByCurrency(
  items: MoneyItem[],
): CurrencyTotal[] {
  const totals =
    new Map<
      string,
      number
    >();

  for (const item of items) {
    if (
      item.amount === null
    ) {
      continue;
    }

    const amount =
      Number(
        item.amount,
      );

    if (
      !Number.isFinite(
        amount,
      )
    ) {
      continue;
    }

    const currency =
      item.currency
        ?.trim()
        .toUpperCase() ||
      "Без валюты";

    totals.set(
      currency,
      (
        totals.get(
          currency,
        ) ?? 0
      ) + amount,
    );
  }

  return Array.from(
    totals.entries(),
  )
    .map(
      ([
        currency,
        amount,
      ]) => ({
        currency,
        amount,
      }),
    )
    .sort(
      (a, b) =>
        a.currency.localeCompare(
          b.currency,
        ),
    );
}

export function formatNumber(
  value: number,
) {
  return new Intl.NumberFormat(
    "ru-RU",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

export function formatMoney(
  amount: string,
  currency:
    | string
    | null,
) {
  const value =
    Number(amount);

  if (
    !Number.isFinite(
      value,
    )
  ) {
    return currency
      ? `${amount} ${currency}`
      : amount;
  }

  const formatted =
    formatNumber(value);

  return currency
    ? `${formatted} ${currency.toUpperCase()}`
    : formatted;
}