# Random Picker

Spin up one or more random winners from a pasted list. A fair, weighted picker for giveaways, raffles and "who goes first" decisions.

**Live:** [random-picker.itsjust.tools](https://random-picker.itsjust.tools)

## Features

- Paste one entry per line or comma separated; entries are parsed and deduplicated live
- Pick 1..N winners at once, with an optional no-repeat mode that removes chosen entries from the pool
- Per-entry weight syntax `entry x3` or `entry:3` multiplies that entry's probability
- Animated picker reveal with a short shuffle highlight before the winner is shown
- Case-insensitive duplicate detection with a warning chip showing merged duplicates
- Pick history with timestamps, undo of the last pick, and one-click copy of results
- Shareable state: pool, weights and results serialize into the URL for bookmarking
- Keyboard shortcut `Enter` to pick, plus an accessible live-region announcement of the winner
- 100% client-side — no data ever leaves your browser

## Weighted entries

Append a multiplier to any line to make that entry more likely to win:

```
Carol x3
Dave:2
```

Carol is three times as likely as an unweighted entry; Dave twice. Duplicate spellings are merged (first spelling wins) and their weights sum.

## Keyboard shortcuts

| Key     | Action         |
| ------- | -------------- |
| `Enter` | Pick winner(s) |
| `Y`     | Copy results   |

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-random-picker .
docker run -p 3000:3000 itsjust-random-picker
```

## License

MIT
