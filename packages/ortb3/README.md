# @trawl/ortb3

OpenRTB 3.0 入札収集ライブラリ。プラグインベースのアーキテクチャでリクエスト/レスポンスを変換し、複数デマンドへ並列にリクエストを送信する。

## Install

```bash
pnpm add @trawl/ortb3
```

## Quick Start

```typescript
import { createAdSlots, item, banner, auction, byPrice } from "@trawl/ortb3"

const slots = createAdSlots([
  item("imp-1", banner([[300, 250], [728, 90]])),
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

- `items` — `Item[]` OpenRTB 3.0 Item（`item()` ヘルパーで生成）
- `options.clone` — リクエストのクローン関数（デフォルト: `structuredClone`）
- `options.fetcher` — fetch関数（デフォルト: `globalThis.fetch`）

返り値の `AdSlots`:
- `use(plugin)` — グローバルPluginを登録
- `demand(adapter)` — DemandAdapterを登録、`DemandHandle` を返す
- `bid(options?)` — 入札パイプラインを実行、`Promise<BidResult>` を返す

### `item(id, ...placements): Item`

Item を生成する。Placement を可変長引数で deep merge。`banner()` と `native()` を同時に渡しても `display` 内の `displayfmt` と `nativefmt` が共存する。

### `banner(sizes, options?): Placement`

バナー Placement を生成。`sizes` は `[width, height][]`。`options` で `DisplayPlacement` のフィールド（`pos`, `instl` 等）を設定可能。

```typescript
banner([[300, 250], [728, 90]])
banner([[300, 250]], { pos: 1 })
```

### `video(params): Placement`

ビデオ Placement を生成。`params.mimes` は必須。`VideoPlacement` のフィールド（`mindur`, `maxdur`, `w`, `h` 等）を直接渡せる。

```typescript
video({ mimes: ["video/mp4"], maxdur: 30 })
```

### `native(assets): Placement`

ネイティブ Placement を生成。`assets` は `NativeAsset[]`。各アセットに `title`, `img`, `data`, `video` を指定でき、`req` フラグも設定可能。`id` は自動採番。

```typescript
native([
  { req: 1, title: { len: 90 } },
  { req: 1, img: { type: 3 } },
  { data: { type: 1, len: 100 } },
])
```

### `auction(bids, strategy): Map<string, Bid>`

BidResult の bids Map（impIdキー）に対してオークション戦略を適用し、枠ごとの勝者を返す。

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
1. Global onRequest plugins（順次）
2. デマンドごとに並列:
   Clone → Demand onRequest plugins → extensions/impExt → Fetch → Parse
3. Demand onResponse plugins（デマンドごとに並列）
4. Global onResponse plugins（順次）
→ BidResult { bids: Map<impId, Bid[]>, errors }
```

## BidOptions

```typescript
interface BidOptions {
  timeout?: number       // fetch タイムアウト（デフォルト: 1500ms）
  pluginTimeout?: number // プラグイン タイムアウト（デフォルト: 3000ms）
}
```

## Web Plugins

ブラウザ向けプラグイン（consent, sync, topics）は [@trawl/ortb3-web](../ortb3-web) を参照。

## 対応環境

- Node.js >= 18
