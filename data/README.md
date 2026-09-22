# Local data (gitignored)

Runtime files in this folder are not committed:

- `accounts.json` — X accounts you add or remove in the UI
- `strategic-signals.json` — merged signal register (seed + auto-detection)

Optional editorial overlays:

```bash
cp infrastructure-overlays.example.json infrastructure-overlays.json
```

Edit `infrastructure-overlays.json` when you need human-reviewed chokepoint/pipeline corrections that should outlive the news cycle. See `shared/status-overlays.ts`.
