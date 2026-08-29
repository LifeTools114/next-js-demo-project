"""백테스트 성과 리포트: 수익률, MDD, 승률, 연/월별 성적, 벤치마크 비교."""

import pandas as pd


def max_drawdown(equity: pd.Series) -> float:
    peak = equity.cummax()
    return float(((equity - peak) / peak).min())


def yearly_returns(equity: pd.Series) -> pd.Series:
    years = equity.index.str[:4]
    last_of_year = equity.groupby(years).last()
    first_val = equity.iloc[0]
    prev = pd.concat([pd.Series([first_val]), last_of_year[:-1]])
    prev.index = last_of_year.index
    return (last_of_year / prev - 1).round(4)


def monthly_returns(equity: pd.Series) -> pd.Series:
    months = equity.index.str[:6]
    last_of_month = equity.groupby(months).last()
    first_val = equity.iloc[0]
    prev = pd.concat([pd.Series([first_val]), last_of_month[:-1]])
    prev.index = last_of_month.index
    return (last_of_month / prev - 1).round(4)


def print_report(trades: pd.DataFrame, equity: pd.DataFrame,
                 benchmark: pd.DataFrame | None, cfg) -> str:
    lines = []
    eq = equity["equity"].astype(float)
    total_ret = eq.iloc[-1] / cfg.initial_capital - 1
    n_days = len(eq)
    cagr = (eq.iloc[-1] / cfg.initial_capital) ** (252 / max(n_days, 1)) - 1
    mdd = max_drawdown(eq)

    lines.append("=" * 62)
    lines.append(f"백테스트 결과  {equity.index[0]} ~ {equity.index[-1]}")
    lines.append("=" * 62)
    lines.append(f"초기 자본        : {cfg.initial_capital:>15,.0f} 원")
    lines.append(f"최종 평가액      : {eq.iloc[-1]:>15,.0f} 원")
    lines.append(f"총수익률         : {total_ret:>14.2%}")
    lines.append(f"연환산 수익률    : {cagr:>14.2%}")
    lines.append(f"최대 낙폭(MDD)   : {mdd:>14.2%}")

    if benchmark is not None and not benchmark.empty:
        b = benchmark["close"].astype(float)
        b_ret = b.iloc[-1] / b.iloc[0] - 1
        lines.append(f"벤치마크(단순보유): {b_ret:>13.2%}  →  초과수익 {total_ret - b_ret:+.2%}")

    if not trades.empty:
        wins = trades[trades["pnl"] > 0]
        losses = trades[trades["pnl"] <= 0]
        gross_win = wins["pnl"].sum()
        gross_loss = abs(losses["pnl"].sum())
        pf = gross_win / gross_loss if gross_loss > 0 else float("inf")
        lines.append("-" * 62)
        lines.append(f"총 거래 횟수     : {len(trades):>8}  (승 {len(wins)} / 패 {len(losses)})")
        lines.append(f"승률             : {len(wins) / len(trades):>14.2%}")
        lines.append(f"평균 수익 거래   : {wins['return'].mean() if len(wins) else 0:>14.2%}")
        lines.append(f"평균 손실 거래   : {losses['return'].mean() if len(losses) else 0:>14.2%}")
        lines.append(f"손익비(PF)       : {pf:>14.2f}")
        lines.append(f"청산 사유별      : {trades['reason'].value_counts().to_dict()}")

    lines.append("-" * 62)
    lines.append("연도별 수익률:")
    for year, r in yearly_returns(eq).items():
        lines.append(f"  {year}: {r:>8.2%}")

    lines.append("-" * 62)
    lines.append("월별 수익률:")
    mrets = monthly_returns(eq)
    for month, r in mrets.items():
        bar = "#" * min(int(abs(r) * 200), 40)
        sign = "+" if r >= 0 else "-"
        lines.append(f"  {month}: {r:>8.2%}  {sign}{bar}")

    lines.append("=" * 62)
    text = "\n".join(lines)
    print(text)
    return text
