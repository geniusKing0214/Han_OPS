#!/usr/bin/env python3
"""유저용 가이드북: 목업 스크린샷 → HTML → PDF (대형 레이아웃)"""

from __future__ import annotations

import shutil
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
GUIDE_DIR = ROOT / "docs" / "user-guide"
MOCKUPS = GUIDE_DIR / "mockups"
SHOTS = GUIDE_DIR / "screenshots"
HTML_OUT = GUIDE_DIR / "user-guidebook.html"
PDF_OUT = GUIDE_DIR / "USER_GUIDEBOOK.pdf"
DESKTOP_PDF = Path.home() / "Desktop" / "Han-ops" / "USER_GUIDEBOOK.pdf"

STEPS = [
    {
        "file": "00-url.html",
        "shot": "00-url.png",
        "title": "STEP 1 · HAN OPS 접속",
        "do": "Safari 또는 Chrome을 열고 주소창에 아래 주소를 입력합니다.",
        "detail": "https://geniusking0214.github.io/Han_OPS/",
        "note": "주소 끝에 /Han_OPS/ 가 반드시 포함되어야 합니다. 없으면 404 오류가 납니다.",
    },
    {
        "file": "00-safari-install.html",
        "shot": "00-safari.png",
        "title": "STEP 2 · Safari — 홈 화면 바로가기 (iPhone)",
        "do": "Safari 하단 공유(⬆️) 버튼 → «홈 화면에 추가» → «추가»를 누릅니다.",
        "detail": "홈 화면에 HAN OPS 아이콘이 생깁니다. 이후 아이콘으로 실행하세요.",
        "note": "iPhone에서 푸시 알림을 받으려면 반드시 홈 화면 추가 후 앱처럼 실행해야 합니다.",
        "wide": True,
    },
    {
        "file": "00-chrome-install.html",
        "shot": "00-chrome.png",
        "title": "STEP 3 · Chrome — 홈 화면 바로가기 (Android)",
        "do": "Chrome 주소창 옆 ⋮ (더보기) → «홈 화면에 추가» → «추가»를 누릅니다.",
        "detail": "«앱 설치» 메뉴가 보이면 그것을 선택해도 됩니다.",
        "note": "홈 화면 아이콘으로 실행하면 앱처럼 전체 화면으로 열립니다.",
        "wide": True,
    },
    {
        "file": "01-login.html",
        "shot": "01-login.png",
        "title": "STEP 4 · 로그인 / 회원가입",
        "do": "«Google로 계속하기» 버튼을 눌러 로그인합니다.",
        "detail": "처음 로그인하면 자동으로 가입됩니다.",
        "note": "별도 회원가입 버튼은 없습니다. Google 계정 하나로 로그인·가입이 동시에 됩니다.",
    },
    {
        "file": "02-pending.html",
        "shot": "02-pending.png",
        "title": "STEP 5 · 가입 승인 대기",
        "do": "관리자가 팀을 배정하고 승인할 때까지 기다립니다.",
        "detail": "이 화면이 보이면 아직 일정 신청이 불가합니다.",
        "note": "승인되면 다시 접속했을 때 홈(대시보드) 화면으로 들어갑니다.",
    },
    {
        "file": "03-dashboard.html",
        "shot": "03-dashboard.png",
        "title": "STEP 6 · 승인 후 홈(대시보드)",
        "do": "하단 «홈» 탭에서 오늘 일정과 신청 현황을 확인합니다.",
        "detail": "오늘 근무, 대기 중 신청 수가 큰 숫자 카드로 표시됩니다.",
        "note": "매일 가장 먼저 확인하는 화면입니다.",
    },
    {
        "file": "04-schedule.html",
        "shot": "04-schedule.png",
        "title": "STEP 7 · 일정에서 날짜·슬롯 선택",
        "do": "하단 «일정» 탭 → 달력에서 날짜 선택 → 원하는 시간의 «신청» 버튼을 누릅니다.",
        "detail": "● 표시가 있는 날짜에 일정이 있습니다.",
        "note": "정원이 남은 슬롯만 신청할 수 있습니다. (예: 정원 3/5 → 2자리 남음)",
    },
    {
        "file": "05-apply.html",
        "shot": "05-apply.png",
        "title": "STEP 8 · 슬롯 신청서 작성",
        "do": "메모(선택)를 입력하고 «신청하기»를 누릅니다.",
        "detail": "일정·장소·시간·정원 정보를 다시 한번 확인하세요.",
        "note": "모바일에서는 화면 아래에서 시트가 올라옵니다.",
    },
    {
        "file": "06-applied.html",
        "shot": "06-applied.png",
        "title": "STEP 9 · 신청 완료 (대기 중)",
        "do": "하단 «신청» 탭(Applications)에서 «대기 중» 상태를 확인합니다.",
        "detail": "신청이 접수되면 관리자 승인을 기다립니다.",
        "note": "대기 중에는 «신청 취소»가 가능합니다.",
    },
    {
        "file": "07-approved.html",
        "shot": "07-approved.png",
        "title": "STEP 10 · 관리자 승인 후",
        "do": "🔔 알림을 확인하고, 신청 탭에서 «승인 완료» 상태를 확인합니다.",
        "detail": "승인되면 당일 근무 일정으로 확정됩니다.",
        "note": "Settings에서 푸시 알림을 켜 두면 승인·거절 시 바로 알림을 받습니다.",
    },
    {
        "file": "08-schedule-check.html",
        "shot": "08-schedule-check.png",
        "title": "STEP 11 · 스케줄 확인",
        "do": "«일정» 탭 달력 또는 «홈» 탭에서 내 승인 일정을 확인합니다.",
        "detail": "근무 당일 해당 장소·시간에 출석합니다.",
        "note": "근무 후 관리자가 완료 처리하면 포인트 +10P가 반영됩니다.",
    },
]


def screenshot_mockups() -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            viewport={"width": 460, "height": 960},
            device_scale_factor=2.5,
        )
        for step in STEPS:
            html_path = MOCKUPS / step["file"]
            out_path = SHOTS / step["shot"]
            page.goto(html_path.as_uri(), wait_until="networkidle")
            page.wait_for_timeout(400)
            page.locator("#screen").screenshot(path=str(out_path))
            print(f"  screenshot: {out_path.name}")
        browser.close()


def build_html() -> str:
    steps_html = []
    for i, step in enumerate(STEPS):
        detail = step.get("detail", "")
        detail_html = (
            f'<div class="detail-box"><p>{detail}</p></div>' if detail else ""
        )
        img_class = "shot-img wide" if step.get("wide") else "shot-img"
        steps_html.append(f"""
    <section class="step-page">
      <div class="step-header">
        <span class="step-num">{i + 1}</span>
        <h2>{step["title"]}</h2>
      </div>
      <div class="shot-wrap">
        <img class="{img_class}" src="screenshots/{step["shot"]}" alt="{step["title"]}" />
      </div>
      <div class="step-text">
        <div class="do-box">
          <div class="label">✋ 이때 할 일</div>
          <p class="main-text">{step["do"]}</p>
          {detail_html}
        </div>
        <div class="note-box">
          <div class="label">💡 참고</div>
          <p>{step["note"]}</p>
        </div>
      </div>
    </section>""")

    flow_items = [
        "접속", "바로가기", "로그인", "승인대기", "홈",
        "일정선택", "신청", "대기", "승인", "확인",
    ]
    flow_html = ""
    for j, item in enumerate(flow_items):
        if j > 0:
            flow_html += '<span class="arr">→</span>'
        flow_html += f'<span>{item}</span>'

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @page {{ size: A4; margin: 12mm 10mm; }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: "Noto Sans KR", "Malgun Gothic", sans-serif;
      font-size: 13pt; color: #111; background: #fff; line-height: 1.65;
    }}
    .cover {{
      text-align: center; padding: 24mm 8mm 16mm;
      border-bottom: 5px solid #c8a96b; margin-bottom: 8mm;
      page-break-after: always;
    }}
    .cover h1 {{ font-size: 40pt; font-weight: 800; letter-spacing: -0.02em; }}
    .cover h1 span {{ color: #c8a96b; }}
    .cover .sub {{ font-size: 20pt; color: #1e40af; font-weight: 700; margin: 10px 0; }}
    .cover .desc {{ font-size: 14pt; color: #475569; line-height: 1.7; }}
    .cover .url {{
      display: inline-block; margin-top: 14px; padding: 10px 20px;
      background: #f1f5f9; border-radius: 10px; font-size: 13pt;
      font-weight: 600; color: #1e40af;
    }}
    .flow-overview {{
      display: flex; flex-wrap: wrap; justify-content: center; align-items: center;
      gap: 8px; margin-bottom: 6mm; padding: 16px;
      background: #f8fafc; border-radius: 12px; font-size: 11pt; font-weight: 600;
      page-break-after: always;
    }}
    .flow-overview span:not(.arr) {{
      background: #fff; border: 2px solid #e2e8f0; padding: 8px 14px; border-radius: 24px;
    }}
    .flow-overview .arr {{ color: #94a3b8; font-size: 14pt; border: none; background: none; }}
    .step-page {{
      page-break-before: always; page-break-inside: avoid;
      margin-bottom: 8mm;
    }}
    .step-header {{
      display: flex; align-items: center; gap: 14px; margin-bottom: 14px;
    }}
    .step-num {{
      width: 44px; height: 44px; background: #1e40af; color: #fff;
      border-radius: 10px; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 18pt; flex-shrink: 0;
    }}
    .step-header h2 {{ font-size: 18pt; color: #1e40af; font-weight: 800; line-height: 1.3; }}
    .shot-wrap {{
      text-align: center; background: #f1f5f9; border-radius: 16px;
      padding: 14px; border: 2px solid #e2e8f0; margin-bottom: 14px;
    }}
    .shot-img {{
      width: auto; max-width: 280px; max-height: 420px;
      border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.15);
    }}
    .shot-img.wide {{ max-width: 300px; max-height: 460px; }}
    .do-box {{
      background: #eff6ff; border-left: 5px solid #2563eb;
      padding: 16px 18px; border-radius: 0 12px 12px 0; margin-bottom: 12px;
    }}
    .detail-box {{
      margin-top: 10px; padding: 12px 14px; background: #fff;
      border-radius: 8px; border: 1px dashed #93c5fd;
      font-size: 13pt; font-weight: 600; color: #1d4ed8;
    }}
    .note-box {{
      background: #fffbeb; border-left: 5px solid #f59e0b;
      padding: 16px 18px; border-radius: 0 12px 12px 0;
    }}
    .label {{ font-size: 11pt; font-weight: 800; color: #64748b; margin-bottom: 8px; }}
    .main-text {{ font-size: 15pt; font-weight: 700; color: #111; line-height: 1.55; }}
    .do-box p, .note-box p {{ font-size: 13pt; line-height: 1.65; }}
    .install-summary {{
      page-break-before: always; padding: 16px;
      background: #0d0f14; color: #fff; border-radius: 14px; margin-top: 8mm;
    }}
    .install-summary h3 {{ font-size: 16pt; color: #c8a96b; margin-bottom: 12px; }}
    .install-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }}
    .install-card {{
      background: #161a22; border-radius: 12px; padding: 14px; font-size: 12pt; line-height: 1.7;
    }}
    .install-card strong {{ color: #c8a96b; font-size: 13pt; }}
  </style>
</head>
<body>
  <div class="cover">
    <h1>HAN <span>OPS</span></h1>
    <p class="sub">사용자 가이드북</p>
    <p class="desc">접속 · 바로가기 추가 · 로그인 · 일정 신청 · 승인 · 스케줄 확인</p>
    <div class="url">https://geniusking0214.github.io/Han_OPS/</div>
  </div>

  <div class="flow-overview">
    {flow_html}
  </div>

  {"".join(steps_html)}

  <div class="install-summary">
    <h3>📲 바로가기 추가 요약</h3>
    <div class="install-grid">
      <div class="install-card">
        <strong>iPhone (Safari)</strong><br/>
        ① 주소 접속<br/>
        ② 하단 공유(⬆️) 탭<br/>
        ③ «홈 화면에 추가»<br/>
        ④ «추가» → 홈 화면 아이콘 실행
      </div>
      <div class="install-card">
        <strong>Android (Chrome)</strong><br/>
        ① 주소 접속<br/>
        ② ⋮ 더보기 탭<br/>
        ③ «홈 화면에 추가»<br/>
        ④ «추가» → 홈 화면 아이콘 실행
      </div>
    </div>
  </div>
</body>
</html>"""


def build_pdf(html_path: Path, pdf_path: Path) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(html_path.as_uri(), wait_until="networkidle")
        page.wait_for_timeout(800)
        page.pdf(
            path=str(pdf_path),
            format="A4",
            print_background=True,
            margin={"top": "10mm", "right": "8mm", "bottom": "12mm", "left": "8mm"},
        )
        browser.close()


def main() -> None:
    print("1/3 목업 스크린샷 생성...")
    screenshot_mockups()

    print("2/3 가이드북 HTML 생성...")
    HTML_OUT.write_text(build_html(), encoding="utf-8")

    print("3/3 PDF 생성...")
    build_pdf(HTML_OUT, PDF_OUT)

    DESKTOP_PDF.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(PDF_OUT, DESKTOP_PDF)

    print(f"\n완료!")
    print(f"  PDF: {PDF_OUT}")
    print(f"  복사: {DESKTOP_PDF}")


if __name__ == "__main__":
    main()
