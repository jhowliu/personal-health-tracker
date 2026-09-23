# 每日減脂計畫

把量身形、三餐和運動串成「今日流程」的 iPhone／Android App。規格書見 `spec.pdf`,畫面設計見 `wireframe.pdf`。

目前完成第一階段(P1):帳號、個人資料與每日目標、身形追蹤、訓練課表與排程、今日流程、推播骨架。
餐點內容(P2)與拍照辨識(P3)留下接口,尚未實作。

## 架構

後端分四層,依賴只往內指:

```
api/          FastAPI 路由與 DTO — 只做 HTTP ↔ use case 的轉換
application/  use case 與 ports — 規則的編排,只認 Protocol 不認 SQLite
domain/       純 Python:公式、狀態機、趨勢計算,不 import 任何框架
adapters/     SQLite、argon2/JWT、Google/Apple、Expo 推播 — 實作 ports
```

規則集中在 `domain/`,三個檔案是這個專案真正的核心:

| 檔案 | 負責 |
| --- | --- |
| [`nutrition.py`](backend/app/domain/nutrition.py) | Mifflin-St Jeor、活動係數、減脂幅度、三大營養素、`carb_scale` |
| [`daily_flow.py`](backend/app/domain/daily_flow.py) | 今日流程的步驟順序與目前位置(不存 DB,由當天事實推算) |
| [`body_trend.py`](backend/app/domain/body_trend.py) | 7 天移動平均、本週與上週的差 |

它們是純函式,不碰 DB 也不碰 HTTP,所以測試直接呼叫就好。

前端 `mobile/src/` 同樣分層:`app/` 只有路由,規則與狀態在 `api/`、`auth/`、`components/`。

## 跑起來

後端:

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
```

```bash
cd backend && DB_PATH=./dev.sqlite .venv/bin/python -m scripts.migrate
```

```bash
cd backend && DB_PATH=./dev.sqlite JWT_SECRET=$(openssl rand -hex 32) .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8010
```

API 文件在 http://localhost:8010/docs。`--host 0.0.0.0` 是給實體手機連的,只在模擬器上跑可以省略。

App:

```bash
cd mobile && npm install
```

```bash
cd mobile && EXPO_PUBLIC_API_URL=http://localhost:8010 npm run ios
```

`npm run web` 可以在瀏覽器快速看畫面(token 退回 localStorage,僅供開發)。

## 在實體手機上跑

手機上的 `localhost` 是手機自己,所以要換成 Mac 的區網 IP(`ipconfig getifaddr en0`),
手機與電腦要在同一個 Wi-Fi:

```bash
cd mobile && EXPO_PUBLIC_API_URL=http://<你的區網IP>:8010 npx expo start
```

用 Expo Go 掃 QR code 即可,已裝的原生模組都內建在裡面。
兩件事 Expo Go 做不到,要 development build(`npx expo install expo-dev-client` + `eas build --profile development`):

- 推播 — Expo Go 自 SDK 53 起不支援 remote push,而且要先 `eas init` 寫入 `extra.eas.projectId`,
  否則 `registerPushToken()` 會安靜略過
- Google／Apple 登入 — 需要原生模組與三組 Client ID

## 測試

```bash
cd backend && .venv/bin/python -m pytest
```

```bash
cd mobile && npm run typecheck && npm run lint
```

## 改了 API 之後

後端改完路由要重新產生前端型別,否則兩邊會對不上:

```bash
cd backend && .venv/bin/python -m scripts.export_openapi && cd ../mobile && npm run api:types
```

## 部署

`docker compose up` 起 api 與 minio 兩個容器,各掛持久 volume。
SQLite 只能有一個寫入者,所以 Uvicorn 固定單 worker,APScheduler 跟 API 同程序。
備份用 `ops/litestream.yml`,目的地必須在主機以外。
