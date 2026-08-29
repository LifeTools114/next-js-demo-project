"""포트폴리오 백테스트 엔진.

일 단위 루프: 매일 (1) 보유 종목 청산 조건 점검 → (2) 신규 진입 → (3) 평가액 기록.
체결 가정은 보수적으로: 손절선 아래로 갭하락 출발하면 시가 체결(더 나쁜 가격).
"""

import math
from dataclasses import dataclass, field

import pandas as pd


@dataclass
class Position:
    ticker: str
    corp_name: str
    entry_date: str
    shares: int
    entry_fill: float          # 슬리피지 포함 체결가
    cost: float                # 수수료 포함 총 매수금액
    stop_price: float
    tp_price: float | None
    days_held: int = 0
    last_close: float = field(default=0.0)


def run_backtest(signals: list[dict], prices: dict[str, pd.DataFrame],
                 calendar: list[str], cfg):
    """signals: [{date, ticker, corp_name}], prices: ticker→OHLCV(YYYYMMDD index).

    반환: (trades DataFrame, equity DataFrame)
    """
    # 공시일 → 다음 거래일에 진입하도록 매핑
    entries_by_date: dict[str, list[dict]] = {}
    for sig in signals:
        nxt = next((d for d in calendar if d > sig["date"]), None)
        if nxt:
            entries_by_date.setdefault(nxt, []).append(sig)

    cash = float(cfg.initial_capital)
    positions: dict[str, Position] = {}
    trades: list[dict] = []
    equity_rows: list[dict] = []
    prev_equity = cash

    def close_position(pos: Position, date: str, sell_price: float, reason: str):
        nonlocal cash
        fill = sell_price * (1 - cfg.slippage)
        proceeds = pos.shares * fill * (1 - cfg.commission - cfg.sell_tax)
        cash += proceeds
        trades.append({
            "ticker": pos.ticker, "corp_name": pos.corp_name,
            "entry_date": pos.entry_date, "exit_date": date,
            "entry_price": round(pos.entry_fill, 2), "exit_price": round(fill, 2),
            "shares": pos.shares, "pnl": round(proceeds - pos.cost),
            "return": round(proceeds / pos.cost - 1, 4), "reason": reason,
        })

    for date in calendar:
        # 1) 청산 점검 (오늘 이전에 진입한 포지션만)
        for ticker in list(positions):
            pos = positions[ticker]
            if pos.entry_date >= date:
                continue
            df = prices[ticker]
            if date not in df.index:
                # 거래정지 등으로 오늘 데이터 없음
                if date > df.index[-1]:
                    # 이후 데이터가 아예 없음(상장폐지 근사) → 마지막 종가로 강제 청산
                    close_position(pos, date, pos.last_close, "delisted")
                    del positions[ticker]
                continue
            row = df.loc[date]
            pos.last_close = float(row["close"])
            pos.days_held += 1
            sold = False
            if float(row["open"]) <= pos.stop_price:        # 손절선 아래 갭하락
                close_position(pos, date, float(row["open"]), "stop_gap")
                sold = True
            elif float(row["low"]) <= pos.stop_price:       # 장중 손절
                close_position(pos, date, pos.stop_price, "stop")
                sold = True
            elif pos.tp_price is not None and float(row["open"]) >= pos.tp_price:
                close_position(pos, date, float(row["open"]), "tp_gap")
                sold = True
            elif pos.tp_price is not None and float(row["high"]) >= pos.tp_price:
                close_position(pos, date, pos.tp_price, "tp")
                sold = True
            elif pos.days_held >= cfg.hold_days:            # 보유기간 만료
                close_position(pos, date, float(row["close"]), "time")
                sold = True
            if sold:
                del positions[ticker]

        # 2) 신규 진입
        for sig in entries_by_date.get(date, []):
            ticker = sig["ticker"]
            if ticker in positions or len(positions) >= cfg.max_positions:
                continue
            df = prices.get(ticker)
            if df is None or date not in df.index:
                continue
            # 유동성 필터: 공시일(진입 전일) 거래대금
            idx = df.index.get_loc(date)
            if idx > 0 and float(df.iloc[idx - 1]["value"]) < cfg.min_trading_value:
                continue
            row = df.loc[date]
            open_price = float(row["open"])
            if open_price <= 0:
                continue
            fill = open_price * (1 + cfg.slippage)
            slot = prev_equity / cfg.max_positions
            budget = min(slot, cash)
            shares = math.floor(budget / (fill * (1 + cfg.commission)))
            if shares <= 0:
                continue
            cost = shares * fill * (1 + cfg.commission)
            cash -= cost
            positions[ticker] = Position(
                ticker=ticker, corp_name=sig.get("corp_name", ""),
                entry_date=date, shares=shares, entry_fill=fill, cost=cost,
                stop_price=fill * (1 + cfg.stop_loss),
                tp_price=fill * (1 + cfg.take_profit) if cfg.take_profit else None,
                last_close=float(row["close"]),
            )

        # 3) 일일 평가액
        holdings = 0.0
        for pos in positions.values():
            df = prices[pos.ticker]
            if date in df.index:
                pos.last_close = float(df.loc[date, "close"])
            holdings += pos.shares * pos.last_close
        prev_equity = cash + holdings
        equity_rows.append({"date": date, "equity": round(prev_equity)})

    # 기간 종료 시 잔여 포지션 마지막 종가로 청산
    for pos in list(positions.values()):
        close_position(pos, calendar[-1], pos.last_close, "eop")
    positions.clear()
    if equity_rows:
        equity_rows[-1]["equity"] = round(cash)  # 전량 청산 후 최종 평가액

    return pd.DataFrame(trades), pd.DataFrame(equity_rows).set_index("date")
