"""엔진 검증: 합성 데이터로 손절/익절/기간만료/비용 계산이 맞는지 확인.

실행: python3 -m backtest.test_engine
"""

import pandas as pd

from .config import Config
from .engine import run_backtest


def make_df(dates, rows):
    df = pd.DataFrame(rows, columns=["open", "high", "low", "close"], index=dates)
    df["volume"] = 100_000
    df["value"] = 1_000_000_000  # 유동성 필터 통과
    df.index.name = "date"
    return df


CAL = [f"202201{d:02d}" for d in range(3, 15)]  # 12 거래일


def base_cfg():
    cfg = Config()
    cfg.initial_capital = 10_000_000
    cfg.max_positions = 5
    cfg.hold_days = 5
    cfg.stop_loss = -0.05
    cfg.take_profit = 0.10
    cfg.slippage = 0.0
    cfg.commission = 0.0
    cfg.sell_tax = 0.0
    return cfg


def test_stop_loss():
    # 10000원 진입 → 둘째 날 저가가 손절선(9500) 아래 → 9500 체결
    rows = [[10000, 10100, 9900, 10000]] * 2 + [[9900, 9950, 9300, 9400]] + \
           [[9400, 9500, 9300, 9400]] * 9
    prices = {"000001": make_df(CAL, rows)}
    signals = [{"date": "20220103", "ticker": "000001", "corp_name": "T"}]
    trades, _ = run_backtest(signals, prices, CAL, base_cfg())
    t = trades.iloc[0]
    assert t["reason"] == "stop", t
    assert t["exit_price"] == 9500.0, t
    assert t["entry_price"] == 10000.0, t
    print("PASS 손절 체결")


def test_stop_gap_down():
    # 손절선 아래로 갭하락 시가 출발 → 시가(9000) 체결 (보수적 가정)
    rows = [[10000, 10100, 9900, 10000]] * 2 + [[9000, 9100, 8900, 9000]] + \
           [[9000, 9100, 8900, 9000]] * 9
    prices = {"000001": make_df(CAL, rows)}
    signals = [{"date": "20220103", "ticker": "000001", "corp_name": "T"}]
    trades, _ = run_backtest(signals, prices, CAL, base_cfg())
    t = trades.iloc[0]
    assert t["reason"] == "stop_gap" and t["exit_price"] == 9000.0, t
    print("PASS 갭하락 손절")


def test_take_profit():
    rows = [[10000, 10100, 9900, 10000]] * 2 + [[10500, 11200, 10400, 11100]] + \
           [[11100, 11200, 11000, 11100]] * 9
    prices = {"000001": make_df(CAL, rows)}
    signals = [{"date": "20220103", "ticker": "000001", "corp_name": "T"}]
    trades, _ = run_backtest(signals, prices, CAL, base_cfg())
    t = trades.iloc[0]
    assert t["reason"] == "tp" and t["exit_price"] == 11000.0, t  # 10000*1.10
    print("PASS 익절 체결")


def test_time_exit():
    rows = [[10000, 10100, 9900, 10000]] * 12
    prices = {"000001": make_df(CAL, rows)}
    signals = [{"date": "20220103", "ticker": "000001", "corp_name": "T"}]
    trades, _ = run_backtest(signals, prices, CAL, base_cfg())
    t = trades.iloc[0]
    # 20220104 진입 → 5거래일 경과일(합성 캘린더상 20220109) 종가 청산
    assert t["reason"] == "time" and t["exit_date"] == "20220109", t
    print("PASS 보유기간 만료 청산")


def test_costs():
    # 비용 포함: 가격 변동 없어도 슬리피지+수수료+세금만큼 손실이어야 함
    cfg = base_cfg()
    cfg.slippage = 0.003
    cfg.commission = 0.00015
    cfg.sell_tax = 0.002
    rows = [[10000, 10000, 10000, 10000]] * 12
    prices = {"000001": make_df(CAL, rows)}
    signals = [{"date": "20220103", "ticker": "000001", "corp_name": "T"}]
    trades, equity = run_backtest(signals, prices, CAL, cfg)
    t = trades.iloc[0]
    assert t["pnl"] < 0, t  # 왕복 비용 ≈ -0.82%
    assert -0.010 < t["return"] < -0.006, t
    assert equity["equity"].iloc[-1] < cfg.initial_capital
    print(f"PASS 비용 반영 (왕복 비용 {t['return']:.2%})")


def test_max_positions():
    cfg = base_cfg()
    cfg.max_positions = 2
    rows = [[10000, 10100, 9900, 10000]] * 12
    prices = {f"00000{i}": make_df(CAL, rows) for i in range(1, 5)}
    signals = [{"date": "20220103", "ticker": t, "corp_name": t} for t in prices]
    trades, _ = run_backtest(signals, prices, CAL, cfg)
    same_day_entries = trades[trades["entry_date"] == "20220104"]
    assert len(same_day_entries) == 2, trades  # 4개 시그널 중 2개만 진입
    print("PASS 동시 보유 수 제한")


if __name__ == "__main__":
    test_stop_loss()
    test_stop_gap_down()
    test_take_profit()
    test_time_exit()
    test_costs()
    test_max_positions()
    print("\n모든 엔진 테스트 통과")
