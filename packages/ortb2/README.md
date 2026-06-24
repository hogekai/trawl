# @trawl/ortb2

OpenRTB 2.6 bid collection library. Plugin-based architecture that transforms requests/responses and sends parallel requests to multiple demand sources. Symmetric with [@trawl/ortb3](../ortb3); the difference is the wire model — `imp[]` impressions, top-level `site`/`app`/`user`/`device`/`regs`, and a bare `BidRequest` body (no envelope).

## Install

```bash
pnpm add @trawl/ortb2
```

## Quick Start

```typescript
import { createAdSlots, imp, banner, auction, byPrice } from "@trawl/ortb2"

const slots = createAdSlots([
  imp("slot-1", banner([[300, 250], [728, 90]])),
])

slots.demand({
  name: "dsp-a",
  endpoint: "https://dsp-a.example.com/bid",
})

const result = await slots.bid({ timeout: 1500 })
const winners = auction(result.bids, byPrice())
```

## API

### `createAdSlots(imps, options?): AdSlots`

Entry point. Creates an AdSlots instance from an array of OpenRTB 2.6 Imps (created via the `imp()` helper).

- `options.clone` — Clone function for requests (default: `structuredClone`)
- `options.fetcher` — Fetch function (default: `globalThis.fetch`)
- `options.request` — `Partial<Omit<BidRequest, "id" | "imp">>` template merged into every request (e.g. `at`, `tmax`, `cur`, `site`)

Returns `AdSlots`:
- `use(plugin)` — Register a global Plugin
- `demand(adapter)` — Register a DemandAdapter, returns a `DemandHandle`
- `bid(options?)` — Execute the bid pipeline, returns `Promise<BidResult>` whose `bids` Map is keyed by `impid`

### `imp(id, ...fragments): Imp`

Creates an Imp. Media fragments (`banner()`, `video()`, `audio()`, `native()`) and plain `Partial<Imp>` objects (e.g. `{ bidfloor: 0.5, tagid: "t1" }`) are deep-merged.

### `banner(sizes, options?): Partial<Imp>`

Creates a banner Imp fragment. `sizes` is `[width, height][]`, mapped to `Banner.format`. Use `options` for other `Banner` fields (`pos`, `mimes`, etc.).

### `video(params): Partial<Imp>`

Creates a video Imp fragment. `params.mimes` is required. Other `Video` fields (`minduration`, `maxduration`, `w`, `h`, `protocols`, etc.) can be passed directly.

```typescript
video({ mimes: ["video/mp4"], minduration: 5, maxduration: 30 })
```

### `audio(params): Partial<Imp>`

Creates an audio Imp fragment. `params.mimes` is required. Other `Audio` fields (`minduration`, `maxduration`, etc.) can be passed directly.

### `native(request, ver?): Partial<Imp>`

Creates a native Imp fragment. In OpenRTB 2.x the native markup request is a JSON-encoded string; pass a request object (it is stringified) or a pre-built string. `ver` defaults to `"1.2"`.

```typescript
native({ ver: "1.2", assets: [{ id: 0, title: { len: 90 } }] })
```

### `auction(bids, strategy)` · `byPrice()` · `byDeal()`

Same as @trawl/ortb3. `byDeal()` prefers bids carrying a `dealid`, falling back to highest price.

## Plugin

Two types: global `Plugin` (shared across all demands) and `DemandPlugin` (demand-specific).

```typescript
interface Plugin {
  name: string
  onRequest?: (request: BidRequest, signal: AbortSignal) => BidRequest | Promise<BidRequest>
  onResponse?: (bids: Bid[], errors: readonly DemandError[], signal: AbortSignal) => Bid[] | Promise<Bid[]>
}

interface DemandPlugin {
  name: string
  onRequest?: (request: BidRequest, signal: AbortSignal) => BidRequest | Promise<BidRequest>
  onResponse?: (bids: Bid[], signal: AbortSignal, request: BidRequest) => Bid[] | Promise<Bid[]>
}
```

A demand `onResponse` receives the demand-specific `request` (after its `onRequest` plugins ran).

## DemandAdapter

```typescript
interface DemandAdapter {
  name: string
  endpoint: string | ((req: BidRequest) => string)
  extensions?: () => DemandExtensions
  impExt?: (imp: Readonly<Imp>) => Record<string, unknown> | null
  fetchOptions?: {
    headers?: Record<string, string> | ((req: BidRequest) => Record<string, string>)
    contentType?: string
    transform?: (body: string) => string
  }
}
```

- `extensions()` — Returns values merged into `ext` of `request`/`site`/`user`/`device`/`regs` (top-level in 2.6)
- `impExt(imp)` — Returns per-Imp ext. Return `null` to skip the Imp
- `fetchOptions.transform` — Transforms the JSON string before sending

## Execution Order

```
1. Global onRequest plugins (sequential)
2. Per demand in parallel:
   Clone → Demand onRequest plugins → extensions/impExt → Fetch → Parse
3. Demand onResponse plugins (parallel per demand)
4. Global onResponse plugins (sequential)
→ BidResult { bids: Map<impid, Bid[]>, errors }
```

## Requirements

- Node.js >= 18
