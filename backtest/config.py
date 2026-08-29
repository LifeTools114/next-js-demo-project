"""백테스트 설정. 모든 전략 규칙은 여기서 바꾼다."""

from dataclasses import dataclass, field


@dataclass
class Config:
    # 기간 (YYYYMMDD)
    start: str = "20220101"
    end: str = "20251231"

    # 자본 / 포트폴리오
    initial_capital: int = 10_000_000   # 초기 자본 1천만원
    max_positions: int = 5              # 동시 보유 종목 수 (종목당 자본/5)

    # 공시 필터
    include_keywords: list[str] = field(
        default_factory=lambda: ["단일판매", "공급계약"]
    )
    exclude_keywords: list[str] = field(
        default_factory=lambda: ["정정", "해지", "철회"]
    )
    markets: list[str] = field(default_factory=lambda: ["Y", "K"])  # Y=유가, K=코스닥

    # 진입/청산 규칙
    # 공시일 다음 거래일 시가 매수 후:
    hold_days: int = 5                  # 최대 보유 거래일 수 (경과 시 종가 매도)
    stop_loss: float = -0.05            # 매수가 대비 -5% 도달 시 손절
    take_profit: float | None = 0.10    # +10% 도달 시 익절 (None이면 미사용)

    # 유동성 필터: 공시일 거래대금이 이 값 미만이면 매수하지 않음 (원)
    min_trading_value: int = 100_000_000

    # 비용 (실전과 백테스트를 가르는 핵심 — 반드시 켜둘 것)
    commission: float = 0.00015         # 매수/매도 각각 수수료 0.015%
    sell_tax: float = 0.0020            # 매도 시 거래세 0.20%
    slippage: float = 0.003             # 매수/매도 각각 슬리피지 0.3%

    # 벤치마크 지수 코드 (pykrx): 1001=코스피
    benchmark_index: str = "1001"

    # 캐시/출력 경로
    cache_dir: str = "backtest/cache"
    output_dir: str = "backtest/output"
