"""주가 데이터 수집 (pykrx). 종목별 CSV 캐시."""

import time
from pathlib import Path

import pandas as pd

COLUMNS = ["open", "high", "low", "close", "volume", "value"]


def _cache_path(cache_dir: str, name: str) -> Path:
    p = Path(cache_dir) / "prices"
    p.mkdir(parents=True, exist_ok=True)
    return p / f"{name}.csv"


def _normalize(df: pd.DataFrame) -> pd.DataFrame:
    """pykrx 한글 컬럼을 영문으로 통일하고 날짜를 YYYYMMDD 문자열 인덱스로."""
    df = df.rename(
        columns={
            "시가": "open", "고가": "high", "저가": "low",
            "종가": "close", "거래량": "volume", "거래대금": "value",
        }
    )
    for col in COLUMNS:
        if col not in df.columns:
            df[col] = 0
    df = df[COLUMNS].copy()
    df.index = pd.to_datetime(df.index).strftime("%Y%m%d")
    df.index.name = "date"
    return df


def get_ohlcv(ticker: str, start: str, end: str, cache_dir: str) -> pd.DataFrame | None:
    """종목 일봉 OHLCV. 캐시 우선. 데이터가 없으면(상장폐지 등) None."""
    cache = _cache_path(cache_dir, ticker)
    if cache.exists():
        df = pd.read_csv(cache, dtype={"date": str}).set_index("date")
        return df if not df.empty else None

    from pykrx import stock  # 지연 임포트: 엔진 테스트 시 pykrx 불필요

    try:
        df = stock.get_market_ohlcv(start, end, ticker)
        time.sleep(0.3)  # KRX 부하 방지
    except Exception as e:
        print(f"  주가 조회 실패 {ticker}: {e}")
        return None
    if df is None or df.empty:
        pd.DataFrame().to_csv(cache)  # 빈 캐시로 재조회 방지
        return None
    df = _normalize(df)
    df.to_csv(cache)
    return df


def get_benchmark(index_code: str, start: str, end: str, cache_dir: str) -> pd.DataFrame:
    """벤치마크 지수(코스피 등) 일봉."""
    cache = _cache_path(cache_dir, f"index_{index_code}")
    if cache.exists():
        return pd.read_csv(cache, dtype={"date": str}).set_index("date")

    from pykrx import stock

    df = stock.get_index_ohlcv(start, end, index_code)
    df = _normalize(df)
    df.to_csv(cache)
    return df
