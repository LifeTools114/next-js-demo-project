<#
  하노이 직구 — 서버 시작·재시작 (윈도우)

  이 파일 하나면 됩니다:
    1) 필요한 프로그램 확인   2) 최신 코드 받기(git pull)
    3) 패키지·계산 번들 확인  4) 설정(.env.local · 운영자 토큰) 확인
    5) 돌고 있던 서버 정리    6) 서버 시작 + 관리자 화면 자동 열기

  실행 방법 (아무거나 하나)
    · 저장소 폴더의 [start-server.cmd] 더블클릭
    · PowerShell:  .\scripts\start-server.ps1

  참고 — PowerShell 5.1 은 명령을 && 로 잇지 못합니다.
  ("'&&' 토큰은 이 버전에서 올바른 문 구분 기호가 아닙니다" 오류)
  여러 명령을 한 줄에 쓸 때는 && 대신 ; 를 쓰세요.
#>

# 네이티브 명령(git·npm)은 정상 동작 중에도 stderr 로 진행 상황을 씁니다.
# 'Stop' 으로 두면 그것까지 오류로 보고 멈추므로, 종료 코드로 직접 판정합니다.
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$Port = 3000

function Step([int]$n, [string]$msg) {
  Write-Host ''
  Write-Host ("[{0}/6] {1}" -f $n, $msg) -ForegroundColor Cyan
}
function Ok([string]$msg)   { Write-Host ("      OK  " + $msg) -ForegroundColor Green }
function Note([string]$msg) { Write-Host ("      -   " + $msg) -ForegroundColor Gray }
function Warn([string]$msg) { Write-Host ("      !   " + $msg) -ForegroundColor Yellow }
function Die([string]$msg) {
  Write-Host ''
  Write-Host ("[중단] " + $msg) -ForegroundColor Red
  Write-Host ''
  Read-Host '엔터를 누르면 창이 닫힙니다'
  exit 1
}

Write-Host ''
Write-Host '===== 하노이 직구 서버 =====' -ForegroundColor White
Note $root

# ── 1. 필요한 프로그램 ───────────────────────────────────────────────
Step 1 '필요한 프로그램 확인'
foreach ($cmd in 'git', 'node', 'npm') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Die ($cmd + ' 를 찾지 못했습니다. https://nodejs.org 에서 Node.js LTS 를 설치(Git 포함)한 뒤 다시 실행하세요.')
  }
}
Ok ('Node ' + (& node --version) + '  npm ' + (& npm --version))

# ── 2. 최신 코드 ─────────────────────────────────────────────────────
Step 2 '최신 코드 받기 (git pull)'
$branch = (& git rev-parse --abbrev-ref HEAD)
if ($LASTEXITCODE -ne 0) { Die '이 폴더는 git 저장소가 아닙니다. 저장소 폴더에서 실행하세요.' }
$branch = $branch.Trim()

# 인터넷이 잠깐 끊겨도 서버는 떠야 하므로, 몇 번 다시 시도하고 그래도 안 되면
# 지금 있는 코드로 계속합니다 (영업 중단보다 낫습니다).
$pulled = $false
foreach ($wait in 0, 2, 4, 8) {
  if ($wait -gt 0) {
    Warn ('네트워크 오류 — ' + $wait + '초 뒤 다시 시도합니다')
    Start-Sleep -Seconds $wait
  }
  & git pull --ff-only origin $branch
  if ($LASTEXITCODE -eq 0) { $pulled = $true; break }
}
if ($pulled) { Ok ('브랜치 ' + $branch) }
else { Warn '코드를 받지 못했습니다 — 지금 폴더에 있는 코드로 계속합니다.' }

# ── 3. 패키지·계산 번들 ──────────────────────────────────────────────
Step 3 '패키지·계산 번들 확인'
$needInstall = $false
if (-not (Test-Path 'node_modules')) {
  $needInstall = $true
} else {
  # package-lock.json 이 마지막 설치보다 새로우면 새 패키지가 들어온 것입니다.
  $lock  = Get-Item 'package-lock.json' -ErrorAction SilentlyContinue
  $stamp = Get-Item 'node_modules\.package-lock.json' -ErrorAction SilentlyContinue
  if ($lock -and (-not $stamp -or $lock.LastWriteTime -gt $stamp.LastWriteTime)) { $needInstall = $true }
}
if ($needInstall) {
  Note '새 패키지를 설치합니다 (처음이면 몇 분 걸립니다)'
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Die 'npm install 이 실패했습니다. 위 메시지를 그대로 보내주세요.' }
  Ok '패키지 설치 완료'
} else {
  Ok '패키지 최신'
}

if (-not (Test-Path 'extension\vendor\calc.js')) {
  Note '확장 계산 번들을 만듭니다'
  & npm run build:ext
  if ($LASTEXITCODE -ne 0) { Die '확장 번들 생성이 실패했습니다.' }
}
Ok '확장 계산 번들 준비됨'

# ── 4. 설정 (.env.local) ─────────────────────────────────────────────
Step 4 '설정 확인 (.env.local)'
$envPath = Join-Path $root '.env.local'
if (-not (Test-Path $envPath)) {
  Copy-Item '.env.example' $envPath
  Warn '.env.local 이 없어 .env.example 을 복사해 새로 만들었습니다'
}
$envText = [IO.File]::ReadAllText($envPath)
$match = [regex]::Match($envText, '(?m)^\s*ADMIN_TOKEN\s*=\s*(.*)$')
$token = ''
if ($match.Success) { $token = $match.Groups[1].Value.Trim() }

$newToken = $false
if ([string]::IsNullOrWhiteSpace($token)) {
  # 운영자 토큰이 없으면 청구서 업로드·최종 견적서 발행이 막힙니다.
  # 사람이 외울 값이 아니므로 여기서 만들어 넣습니다 (이 PC 안에만 저장).
  $token = -join ((48..57) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
  if ($match.Success) {
    $envText = [regex]::Replace($envText, '(?m)^\s*ADMIN_TOKEN\s*=.*$', ('ADMIN_TOKEN=' + $token))
  } else {
    if ($envText.Length -gt 0 -and -not $envText.EndsWith("`n")) { $envText += "`r`n" }
    $envText += ('ADMIN_TOKEN=' + $token + "`r`n")
  }
  # BOM 없는 UTF-8 — BOM 이 붙으면 첫 줄 설정값이 깨집니다.
  [IO.File]::WriteAllText($envPath, $envText, (New-Object System.Text.UTF8Encoding($false)))
  $newToken = $true
}
Ok '설정 파일 확인'

# ── 5. 돌고 있던 서버 정리 ───────────────────────────────────────────
Step 5 ('실행 중인 서버 정리 (포트 ' + $Port + ')')
$procIds = @()
try {
  $conns = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  $procIds = @($conns | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique)
} catch { }
if ($procIds.Count -eq 0) {
  # 구형 윈도우 폴백 — netstat 의 마지막 칸이 PID 입니다.
  try {
    foreach ($line in (& netstat -ano | Select-String (':' + $Port + '\s') | Select-String 'LISTENING')) {
      $procIds += ($line.ToString().Trim() -split '\s+')[-1]
    }
    $procIds = @($procIds | Sort-Object -Unique)
  } catch { }
}
$killed = 0
foreach ($procId in $procIds) {
  $id = 0
  if (-not [int]::TryParse([string]$procId, [ref]$id)) { continue }
  if ($id -le 4) { continue }  # 0·4 는 시스템 프로세스
  try { Stop-Process -Id $id -Force -ErrorAction Stop; $killed++ } catch { }
}
if ($killed -gt 0) { Ok ('이전 서버 ' + $killed + '개를 정리했습니다') } else { Ok '정리할 서버 없음' }

# ── 6. 시작 ──────────────────────────────────────────────────────────
Step 6 '서버 시작'

if ($newToken) {
  Write-Host ''
  Write-Host '  +--------------------------------------------------------------+' -ForegroundColor Yellow
  Write-Host '  |  운영자 토큰을 새로 만들었습니다 (.env.local 에 저장됨)      |' -ForegroundColor Yellow
  Write-Host '  +--------------------------------------------------------------+' -ForegroundColor Yellow
  Write-Host ('     ' + $token) -ForegroundColor White
  Write-Host '     관리자 화면(/admin) 맨 위 칸에 이 값을 한 번 붙여넣으세요.' -ForegroundColor Yellow
  Write-Host '     (브라우저가 기억하므로 다음부터는 안 물어봅니다)' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '  주소' -ForegroundColor White
Write-Host ('    고객 화면   http://localhost:' + $Port + '/')
Write-Host ('    관리자      http://localhost:' + $Port + '/admin')
Write-Host ('    공지사항    http://localhost:' + $Port + '/notice')

# ── 폰에서 접속할 주소 ────────────────────────────────────────────────
# 같은 와이파이에 있는 폰은 이 PC 의 사설 IP 로 들어올 수 있습니다.
# 공유기마다 대역이 달라(192.168 / 10 / 172.16~31) 직접 찾아 알려줍니다.
# 가상 랜카드(WSL·도커·VirtualBox·VMware)는 걸러야 합니다. 이것들도 사설
# IP 를 갖지만 폰에서는 절대 닿지 않아, 잘못 알려주면 한참 헤매게 됩니다.
$virtual = 'vEthernet|WSL|Hyper-V|VirtualBox|VMware|Loopback|Bluetooth|Npcap'
$lanIp = $null
try {
  $lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object {
      $_.InterfaceAlias -notmatch $virtual -and
      ($_.IPAddress -match '^192\.168\.' -or
       $_.IPAddress -match '^10\.' -or
       $_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[01])\.')
    } |
    # 가정용 공유기에서 가장 흔한 192.168 대역을 먼저 보여줍니다.
    Sort-Object -Property @{ Expression = { if ($_.IPAddress -match '^192\.168\.') { 0 } elseif ($_.IPAddress -match '^10\.') { 1 } else { 2 } } } |
    Select-Object -First 1 -ExpandProperty IPAddress
} catch {
  # 옛 윈도우에는 Get-NetIPAddress 가 없어 ipconfig 로 대신 찾습니다.
  try {
    $lanIp = ipconfig |
      Select-String -Pattern 'IPv4.*:\s*(192\.168\.\S+|10\.\S+|172\.(?:1[6-9]|2[0-9]|3[01])\.\S+)' |
      ForEach-Object { $_.Matches[0].Groups[1].Value } |
      Select-Object -First 1
  } catch { $lanIp = $null }
}

if ($lanIp) {
  Write-Host ''
  Write-Host '  폰에서 보려면 (같은 와이파이여야 합니다)' -ForegroundColor White
  Write-Host ('    폰 브라우저 주소창에   http://' + $lanIp + ':' + $Port + '/') -ForegroundColor Green
  Write-Host '    * 폰이 회사 와이파이나 LTE 면 안 됩니다 - PC 와 같은 와이파이로 바꿔주세요.' -ForegroundColor Gray
  Write-Host '    * 처음 한 번은 윈도우가 "네트워크 허용?" 을 물어볼 수 있습니다 - 허용을 누르세요.' -ForegroundColor Gray
} else {
  Write-Host ''
  Write-Host '  폰 접속용 주소를 찾지 못했습니다 (와이파이가 꺼져 있을 수 있습니다).' -ForegroundColor Gray
}

Write-Host ''
Write-Host '  크롬 확장은 chrome://extensions 에서 새로고침(둥근 화살표) 한 번 눌러주세요.' -ForegroundColor Gray
Write-Host '  서버를 끌 때는 이 창에서 Ctrl+C 입니다.' -ForegroundColor Gray
Write-Host ''

# 서버가 실제로 응답하면 관리자 화면을 띄웁니다 (숨은 창에서 대기).
# 명령을 Base64 로 넘기는 이유: 따옴표가 섞인 명령줄은 윈도우에서 자주
# 깨지는데, -EncodedCommand 는 그 문제가 아예 없습니다.
$opener = @'
for ($i = 0; $i -lt 90; $i++) {
  try {
    Invoke-WebRequest "http://localhost:PORT/api/extension/config" -UseBasicParsing -TimeoutSec 2 | Out-Null
    Start-Process "http://localhost:PORT/admin"
    break
  } catch { Start-Sleep -Seconds 2 }
}
'@ -replace 'PORT', $Port
try {
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($opener))
  Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-EncodedCommand', $encoded | Out-Null
} catch {
  Note '브라우저 자동 열기는 건너뜁니다 — 위 주소를 직접 여세요.'
}

& npm run dev
