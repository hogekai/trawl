# @trawl/ortb3-trawl

OpenRTB 3.0 入札収集ライブラリ。プラグインベースのアーキテクチャでリクエスト/レスポンスを変換し、複数デマンドへ並列にリクエストを送信する。

## Install

```bash
pnpm add @trawl/ortb3-trawl
```

## Quick Start

```typescript
import { createAdSlots, imp, banner, auction, byPrice } from "@trawl/ortb3-trawl"

const slots = createAdSlots([
  imp("imp-1", banner([300, 250], [728, 90])),
])

slots.demand({
  name: "dsp-a",
  endpoint: "https://dsp-a.example.com/bid",
})

const result = await slots.bid({ timeout: 1500 })
const winners = auction(result.bids, byPrice())
```

## API

### `createAdSlots(items, options?): AdSlots`

エントリポイント。Item配列からAdSlotsインスタンスを生成する。

- `items` — `Item[]` OpenRTB 3.0 Item（`imp()` ヘルパーで生成）
- `options.clone` — リクエストのクローン関数（デフォルト: `structuredClone`）
- `options.fetcher` — fetch関数（デフォルト: `globalThis.fetch`）

返り値の `AdSlots`:
- `use(plugin)` — グローバルPluginを登録
- `demand(adapter)` — DemandAdapterを登録、`DemandHandle` を返す
- `bid(options?)` — 入札パイプラインを実行、`Promise<BidResult>` を返す

### `imp(id, ...placements): Item`

Item を生成する。Placement を可変長引数でマージ。

### `banner(...sizes): Placement`

バナー Placement を生成。`sizes` は `[width, height]` のタプル配列。

### `video(params): Placement`

ビデオ Placement を生成。`params.mimes` は必須。

### `native(params): Placement`

ネイティブ Placement を生成。`params.title`（最大文字数）、`params.image`（画像タイプ）。

### `auction(bids, strategy): Map<string, Bid>`

BidResult の bids Map に対してオークション戦略を適用し、デマンドごとの勝者を返す。

### `byPrice(): AuctionStrategy`

最高価格の Bid を選択する戦略。

### `byDeal(): AuctionStrategy`

Deal付き Bid を優先し、同条件なら最高価格を選択する戦略。

## Plugin

グローバルPlugin（全デマンド共通）と DemandPlugin（デマンド固有）の2種類。

```typescript
interface Plugin {
  name: string
  onRequest?: (request: Request, signal: AbortSignal) => Request | Promise<Request>
  onResponse?: (bids: Bid[], signal: AbortSignal) => Bid[] | Promise<Bid[]>
}
```

```typescript
// グローバル
slots.use({ name: "my-plugin", onRequest(req, signal) { return req } })

// デマンド固有
slots.demand(adapter).with({ name: "dsp-plugin", onResponse(bids, signal) { return bids } })
```

## DemandAdapter

```typescript
interface DemandAdapter {
  name: string
  endpoint: string | ((req: Request) => string)
  extensions?: () => DemandExtensions
  impExt?: (item: Readonly<Item>) => Record<string, unknown> | null
  fetchOptions?: {
    headers?: Record<string, string> | ((req: Request) => Record<string, string>)
    contentType?: string
    transform?: (body: string) => string
  }
}
```

- `extensions()` — request/site/user/device/regs の ext にマージされる値を返す
- `impExt(item)` — Item ごとの ext を返す。`null` で Item をスキップ
- `fetchOptions.transform` — JSON文字列を変換してから送信

## 実行順序

```
Phase 1: Global onRequest plugins（順次）
Phase 2: デマンドごとに並列
  → Clone → Demand onRequest plugins → Build → Fetch → Parse
Phase 3: Demand onResponse plugins（デマンドごとに並列）
Phase 4: Global onResponse plugins（順次）
Phase 5: Map再構築 → BidResult
```

## BidOptions

```typescript
interface BidOptions {
  timeout?: number       // fetch タイムアウト（デフォルト: 1500ms）
  pluginTimeout?: number // プラグイン タイムアウト（デフォルト: 3000ms）
}
```

## Web Plugins

ブラウザ向けプラグインは `@trawl/ortb3-trawl/web` からインポート。

```typescript
import { consent, sync, topics } from "@trawl/ortb3-trawl/web"
```

- `consent(getTCData)` — TCF consent をリクエストに設定（グローバルPlugin）
- `sync(type, buildUrl)` — Cookie sync ピクセル/iframe を発火（DemandPlugin）
- `topics()` — Topics API の結果をリクエストに設定（グローバルPlugin）

## 対応環境

- Node.js >= 18
- ブラウザ（web プラグイン使用時）
