"""보유기간(hold_days)별 성적 비교.

데이터는 한 번만 수집(캐시)하고 엔진만 여러 번 돌려 나란히 비교한다.

사용법:
    export DART_API_KEY=발급받은키
    python3 -m backtest.compare                    # 3, 5, 9, 15일 비교
    python3 -m backtest.compare --hold-days 5 9    # 원하는 값만
"""

import argparse
import copy

import pandas as pd

from .config import Config
from .engine import run_backtest
from .report import max_drawdown, yearly_returns
from .run import load_data, require_api_key


def summarize(trades: pd.DataFrame, equity: pd.DataFrame, cfg) -> dict:
    eq = equity["equity"].astype(float)
    wins = trades[trades["pnl"] > 0] if not trades.empty else trades
    losses = trades[trades["pnl"] <= 0] if not trades.empty else trades
    gross_loss = abs(losses["pnl"].sum()) if not trades.empty else 0
    return {
        "총수익률": eq.iloc[-1] / cfg.initial_capital - 1,
        "MDD": max_drawdown(eq),
        "거래수": len(trades),
        "승률": len(wins) / len(trades) if len(trades) else 0.0,
        "손익비": (wins["pnl"].sum() / gross_loss) if gross_loss > 0 else float("inf"),
        "연도별": yearly_returns(eq).to_dict(),
    }


def main() -> None:
    p = argparse.ArgumentParser(description="보유기간별 백테스트 비교")
    p.add_argument("--hold-days", type=int, nargs="+", default=[3, 5, 9, 15])
    p.add_argument("--start", default=Config.start)
    p.add_argument("--end", default=Config.end)
    a = p.parse_args()

    base = Config()
    base.start, base.end = a.start, a.end
    signals, prices, calendar, benchmark = load_data(base, require_api_key())

    b = benchmark["close"].astype(float)
    bench_ret = b.iloc[-1] / b.iloc[0] - 1

    results = {}
    for hd in a.hold_days:
        cfg = copy.deepcopy(base)
        cfg.hold_days = hd
        print(f"\n>>> 보유 {hd}거래일 백테스트 실행")
        trades, equity = run_backtest(signals, prices, calendar, cfg)
        results[hd] = summarize(trades, equity, cfg)

    print_comparison(results, a.hold_days, base, bench_ret)


def print_comparison(results: dict, hold_days: list[int], base, bench_ret: float) -> None:
    years = sorted({y for r in results.values() for y in r["연도별"]})
    print("\n" + "=" * 70)
    print(f"보유기간별 비교  {base.start} ~ {base.end}   (벤치마크 코스피 {bench_ret:+.2%})")
    print("=" * 70)
    header = f"{'':14}" + "".join(f"{f'{hd}일':>12}" for hd in hold_days)
    print(header)
    print("-" * 70)

    def row(label, fmt, key):
        vals = "".join(f"{fmt.format(results[hd][key]):>12}" for hd in hold_days)
        print(f"{label:12}{vals}")

    row("총수익률", "{:+.2%}", "총수익률")
    print(f"{'초과수익':12}" + "".join(
        f"{results[hd]['총수익률'] - bench_ret:>+12.2%}" for hd in hold_days))
    row("MDD", "{:.2%}", "MDD")
    row("거래수", "{:,}", "거래수")
    row("승률", "{:.1%}", "승률")
    row("손익비", "{:.2f}", "손익비")
    print("-" * 70)
    for y in years:
        vals = "".join(
            f"{results[hd]['연도별'].get(y, 0):>+12.2%}" for hd in hold_days)
        print(f"{y + '년':12}{vals}")
    print("=" * 70)
    print("판단 기준: 총수익률보다 '초과수익'과 2022년(하락장) 성적, MDD를 우선 비교")


if __name__ == "__main__":
    main()
