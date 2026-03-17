# @trawl/ortb3-web

Browser plugins for [@trawl/ortb3](../ortb3).

## Install

```bash
pnpm add @trawl/ortb3-web @trawl/ortb3
```

## Quick Start

```typescript
import { createAdSlots, item, banner } from "@trawl/ortb3"
import { consent, sync, topics } from "@trawl/ortb3-web"

const slots = createAdSlots([
  item("imp-1", banner([300, 250])),
])

slots.use(consent(() => window.__tcfapi("getTCData")))
slots.use(topics())

slots.demand({
  name: "dsp-a",
  endpoint: "https://dsp-a.example.com/bid",
}).with(sync("image", () => "https://dsp-a.example.com/sync"))
```

## API

### `consent(getTCData): Plugin`

TCF consent をリクエストに設定するグローバルPlugin。`regs.ext.gdpr` と `user.ext.consent` を付与する。

### `sync(type, buildUrl): DemandPlugin`

Cookie sync ピクセル（`"image"`）または iframe（`"iframe"`）をレスポンス時に発火するデマンドPlugin。

### `topics(): Plugin`

Topics API の結果を `user.ext.browsing_topics` に設定するグローバルPlugin。API が利用不可の場合はスキップする。

## Peer Dependencies

- `@trawl/ortb3` ^0.1.0
