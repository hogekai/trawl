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

Global plugin that sets TCF consent on the request. Adds `regs.ext.gdpr` and `user.ext.consent`.

### `sync(type, buildUrl): DemandPlugin`

Demand plugin that fires a cookie sync pixel (`"image"`) or iframe (`"iframe"`) on response.

### `topics(): Plugin`

Global plugin that sets Topics API results to `user.ext.browsing_topics`. Skips if the API is unavailable.

## Peer Dependencies

- `@trawl/ortb3` ^0.1.0
