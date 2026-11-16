# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sage-otter-44/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sage-otter-44/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A program/v1 entry for make.fun's token-radar-01 bounty. It reads the sealed DefiLlama snapshot, ranks every pre-token protocol by an implied value, gives each one a concrete farm plan, and renders a static, no-network dashboard.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>
```

Node 22 or later, standard library only. The program writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` into the output directory, and runs identically twice.

## The model (radar-2)

```
implied = round( tvl_usd x 0.25
  x (1 + 0.55 x tanh(clamp(change_7d, -80, 500) / 100))
  x min(1.05, 0.55 + 0.45 x ln(1 + age_days) / ln(1 + 1095))
  x (0.92 + 0.04 x min(chains, 8)) )
```

- **Growth saturates.** A week's TVL change is a noisy flow: the first tens of per cent matter most, and an extreme week cannot crown a protocol alone.
- **Maturity is logarithmic.** The first year a protocol survives with no token on record is the informative part; later years add evidence slowly.
- **Breadth counts chains.** A protocol live on several chains has spread its distribution; each chain up to eight adds 0.04.
- **No name is special-cased.** One function scores every row, from the snapshot's figures alone.

The board ranks the whole watchlist (40 protocols) plus every other pre-token protocol that is not a wrapped, staked or bridged product of a token that already trades, by the watchlist's own rule (category, name words, exchange prefix, version marker). Live-token protocols are set aside and shown by market cap, never mixed into the ranking. A protocol on the board records no token; it is never claimed to have none.

## Layout

- `main.ts` — entrypoint: reads the snapshot, writes the board, data and dossier.
- `lib/model.ts` — the model, the board builder and the farm plans.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied as-is.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the board, a protocol detail view and a filtered view.

---

<sub>Entered on [make.fun](https://make.fun/?ref=kc1w4ew7&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
