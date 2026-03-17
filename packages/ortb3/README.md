# @trawl/ortb3

OpenRTB 3.0 bid collection library. Plugin-based architecture that transforms requests/responses and sends parallel requests to multiple demand sources.

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

Entry point. Creates an AdSlots instance from an array of Items.

- `items` — `Item[]` OpenRTB 3.0 Items (created via the `item()` helper)
- `options.clone` — Clone function for requests (default: `structuredClone`)
- `options.fetcher` — Fetch function (default: `globalThis.fetch`)

Returns `AdSlots`:
- `use(plugin)` — Register a global Plugin
- `demand(adapter)` — Register a DemandAdapter, returns a `DemandHandle`
- `bid(options?)` — Execute the bid pipeline, returns `Promise<BidResult>`

### `item(id, ...placements): Item`

Creates an Item. Placements are deep-merged from variadic arguments. Passing both `banner()` and `native()` results in `displayfmt` and `nativefmt` coexisting within `display`.

### `banner(sizes, options?): Placement`

Creates a banner Placement. `sizes` is `[width, height][]`. Use `options` to set `DisplayPlacement` fields (`pos`, `instl`, etc.).

```typescript
banner([[300, 250], [728, 90]])
banner([[300, 250]], { pos: 1 })
```

### `video(params): Placement`

Creates a video Placement. `params.mimes` is required. `VideoPlacement` fields (`mindur`, `maxdur`, `w`, `h`, etc.) can be passed directly.

```typescript
video({ mimes: ["video/mp4"], maxdur: 30 })
```

### `native(assets): Placement`

Creates a native Placement. `assets` is `NativeAsset[]`. Each asset can specify `title`, `img`, `data`, `video`, and the `req` flag. `id` is auto-assigned.

```typescript
native([
  { req: 1, title: { len: 90 } },
  { req: 1, img: { type: 3 } },
  { data: { type: 1, len: 100 } },
])
```

### `auction(bids, strategy): Map<string, Bid>`

Applies an auction strategy to the BidResult's bids Map (keyed by impId) and returns a winner per slot.

### `byPrice(): AuctionStrategy`

Strategy that selects the highest-priced Bid.

### `byDeal(): AuctionStrategy`

Strategy that prioritizes Bids with a Deal, falling back to highest price when equal.

## Plugin

Two types: global Plugins (shared across all demands) and DemandPlugins (demand-specific).

```typescript
interface Plugin {
  name: string
  onRequest?: (request: Request, signal: AbortSignal) => Request | Promise<Request>
  onResponse?: (bids: Bid[], signal: AbortSignal) => Bid[] | Promise<Bid[]>
}
```

```typescript
// Global
slots.use({ name: "my-plugin", onRequest(req, signal) { return req } })

// Demand-specific
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

- `extensions()` — Returns values to be merged into request/site/user/device/regs ext
- `impExt(item)` — Returns per-Item ext. Return `null` to skip the Item
- `fetchOptions.transform` — Transforms the JSON string before sending

## Execution Order

```
1. Global onRequest plugins (sequential)
2. Per demand in parallel:
   Clone → Demand onRequest plugins → extensions/impExt → Fetch → Parse
3. Demand onResponse plugins (parallel per demand)
4. Global onResponse plugins (sequential)
→ BidResult { bids: Map<impId, Bid[]>, errors }
```

## BidOptions

```typescript
interface BidOptions {
  timeout?: number       // Fetch timeout (default: 1500ms)
  pluginTimeout?: number // Plugin timeout (default: 3000ms)
}
```

## Web Plugins

Browser plugins (consent, sync, topics) are available in [@trawl/ortb3-web](../ortb3-web).

## Requirements

- Node.js >= 18
