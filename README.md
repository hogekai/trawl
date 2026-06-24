# trawl

OpenRTB bid collection libraries.

## Packages

| Package | Description |
|---------|-------------|
| [@trawl/core](./packages/core) | Version-agnostic bid-collection pipeline (plugins, fan-out, auction) |
| [@trawl/ortb3](./packages/ortb3) | OpenRTB 3.0 / AdCOM bid collection |
| [@trawl/ortb2](./packages/ortb2) | OpenRTB 2.6 bid collection |
| [@trawl/ortb3-web](./packages/ortb3-web) | Browser plugins for @trawl/ortb3 |

`@trawl/ortb3` and `@trawl/ortb2` are thin OpenRTB-version "profiles" over the shared `@trawl/core` pipeline; they expose a symmetric API (`createAdSlots`, `banner`/`video`/`audio`/`native`, `auction`/`byPrice`/`byDeal`).

## Development

```bash
pnpm install
pnpm test
pnpm build
pnpm typecheck
pnpm lint
```
