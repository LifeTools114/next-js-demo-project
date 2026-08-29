"""DART 공시 목록 수집.

DART 오픈API(https://opendart.fss.or.kr) 무료 키 필요.
월 단위로 조회해 JSON으로 캐시하므로 재실행 시 API를 다시 호출하지 않는다.
"""

import json
import time
from pathlib import Path

import requests

LIST_URL = "https://opendart.fss.or.kr/api/list.json"
PAGE_COUNT = 100


def _month_ranges(start: str, end: str) -> list[tuple[str, str]]:
    """YYYYMMDD 구간을 (월초, 월말) 튜플 목록으로 나눈다."""
    ranges = []
    y, m = int(start[:4]), int(start[4:6])
    end_y, end_m = int(end[:4]), int(end[4:6])
    while (y, m) <= (end_y, end_m):
        first = f"{y}{m:02d}01"
        last = f"{y}{m:02d}31"  # 월말은 넉넉히 31로 — 미래·없는 날짜는 API가 잘라준다
        ranges.append((max(first, start), min(last, end)))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return ranges


def _fetch_month(api_key: str, bgn: str, end: str) -> list[dict]:
    """한 달치 거래소공시(pblntf_ty=I) 목록을 전 페이지 수집."""
    items, page = [], 1
    while True:
        resp = requests.get(
            LIST_URL,
            params={
                "crtfc_key": api_key,
                "bgn_de": bgn,
                "end_de": end,
                "pblntf_ty": "I",  # 거래소공시 (공급계약 등)
                "page_no": page,
                "page_count": PAGE_COUNT,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status")
        if status == "013":  # 조회 결과 없음
            break
        if status != "000":
            raise RuntimeError(f"DART API 오류 {status}: {data.get('message')} ({bgn}~{end})")
        items.extend(data.get("list", []))
        if page >= int(data.get("total_page", 1)):
            break
        page += 1
        time.sleep(0.2)  # API 부하 방지
    return items


def fetch_disclosures(api_key: str, start: str, end: str, cache_dir: str) -> list[dict]:
    """기간 내 거래소공시 전체를 수집(캐시 우선)해 리스트로 반환."""
    cache = Path(cache_dir) / "dart"
    cache.mkdir(parents=True, exist_ok=True)
    all_items: list[dict] = []
    for bgn, month_end in _month_ranges(start, end):
        cache_file = cache / f"{bgn[:6]}.json"
        if cache_file.exists():
            all_items.extend(json.loads(cache_file.read_text()))
            continue
        print(f"  DART 공시 수집: {bgn[:6]}")
        items = _fetch_month(api_key, bgn, month_end)
        cache_file.write_text(json.dumps(items, ensure_ascii=False))
        all_items.extend(items)
        time.sleep(0.3)
    return all_items


def filter_signals(items: list[dict], cfg) -> list[dict]:
    """공시 목록에서 매매 시그널을 뽑는다.

    include 키워드를 하나라도 포함하고 exclude 키워드는 하나도 없는
    상장사(주식코드 보유) 공시만. 같은 종목·같은 날짜는 1건으로 합친다.
    """
    seen: set[tuple[str, str]] = set()
    signals = []
    for it in items:
        name = it.get("report_nm", "")
        code = (it.get("stock_code") or "").strip()
        date = it.get("rcept_dt", "")
        if not code or not date:
            continue
        if it.get("corp_cls") not in cfg.markets:
            continue
        if not any(k in name for k in cfg.include_keywords):
            continue
        if any(k in name for k in cfg.exclude_keywords):
            continue
        key = (code, date)
        if key in seen:
            continue
        seen.add(key)
        signals.append(
            {"date": date, "ticker": code, "corp_name": it.get("corp_name", ""), "report_nm": name}
        )
    signals.sort(key=lambda s: s["date"])
    return signals
