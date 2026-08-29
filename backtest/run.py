"""공시 기반 전략 백테스트 실행.

사용법:
    export DART_API_KEY=발급받은키          # https://opendart.fss.or.kr 무료 발급
    python3 -m backtest.run                 # 2022-01-01 ~ 2025-12-31 기본 실행
    python3 -m backtest.run --start 20230101 --end 20241231 --hold-days 3

결과는 콘솔 리포트 + backtest/output/ 아래 trades.csv, equity.csv, report.txt.
"""

import argparse
import os
import sys
from pathlib import Path

from .config import Config
from .dart_client import fetch_disclosures, filter_signals
from .engine import run_backtest
from .price_client import get_benchmark, get_ohlcv
from .report import print_report


def parse_args() -> Config:
    cfg = Config()
    p = argparse.ArgumentParser(description="공시 기반 전략 백테스트")
    p.add_argument("--start", default=cfg.start)
    p.add_argument("--end", default=cfg.end)
    p.add_argument("--capital", type=int, default=cfg.initial_capital)
    p.add_argument("--max-positions", type=int, default=cfg.max_positions)
    p.add_argument("--hold-days", type=int, default=cfg.hold_days)
    p.add_argument("--stop-loss", type=float, default=cfg.stop_loss)
    p.add_argument("--take-profit", type=float, default=cfg.take_profit)
    a = p.parse_args()
    cfg.start, cfg.end = a.start, a.end
    cfg.initial_capital = a.capital
    cfg.max_positions = a.max_positions
    cfg.hold_days = a.hold_days
    cfg.stop_loss = a.stop_loss
    cfg.take_profit = a.take_profit
    return cfg


def main() -> None:
    cfg = parse_args()
    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        sys.exit(
            "DART_API_KEY 환경변수가 필요합니다.\n"
            "https://opendart.fss.or.kr 에서 무료 발급 후:\n"
            "  export DART_API_KEY=발급받은키"
        )

    print(f"[1/4] DART 공시 수집 ({cfg.start} ~ {cfg.end})")
    items = fetch_disclosures(api_key, cfg.start, cfg.end, cfg.cache_dir)
    signals = filter_signals(items, cfg)
    print(f"  공시 {len(items):,}건 중 시그널 {len(signals):,}건 "
          f"(키워드: {cfg.include_keywords}, 제외: {cfg.exclude_keywords})")
    if not signals:
        sys.exit("시그널이 없습니다. 키워드/기간을 확인하세요.")

    print("[2/4] 주가 데이터 수집 (최초 실행 시 오래 걸립니다. 캐시됨)")
    benchmark = get_benchmark(cfg.benchmark_index, cfg.start, cfg.end, cfg.cache_dir)
    calendar = list(benchmark.index)
    prices = {}
    tickers = sorted({s["ticker"] for s in signals})
    for i, t in enumerate(tickers, 1):
        if i % 50 == 0:
            print(f"  {i}/{len(tickers)} 종목")
        df = get_ohlcv(t, cfg.start, cfg.end, cfg.cache_dir)
        if df is not None:
            prices[t] = df
    missing = len(tickers) - len(prices)
    if missing:
        print(f"  주의: {missing}개 종목은 주가 데이터 없음(상장폐지 등) → 제외됨. "
              f"생존 편향으로 결과가 실제보다 좋게 나올 수 있음")
    signals = [s for s in signals if s["ticker"] in prices]

    tp_desc = f"{cfg.take_profit:.0%}" if cfg.take_profit else "없음"
    print(f"[3/4] 백테스트 실행 (자본 {cfg.initial_capital:,}원, "
          f"보유 {cfg.hold_days}일, 손절 {cfg.stop_loss:.0%}, 익절 {tp_desc})")
    trades, equity = run_backtest(signals, prices, calendar, cfg)

    print("[4/4] 리포트")
    text = print_report(trades, equity, benchmark, cfg)

    out = Path(cfg.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    trades.to_csv(out / "trades.csv", index=False, encoding="utf-8-sig")
    equity.to_csv(out / "equity.csv", encoding="utf-8-sig")
    (out / "report.txt").write_text(text, encoding="utf-8")
    print(f"\n저장: {out}/trades.csv, equity.csv, report.txt")


if __name__ == "__main__":
    main()
