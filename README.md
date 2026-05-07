## Quick Start with GitHub Codespaces

1. Open this repo in Codespaces (Code button → Codespaces → Create codespace)
2. Wait for the postCreateCommand to finish
3. In the terminal run:
   ```bash
   # Backend
   PORT=8080 pnpm --filter @workspace/api-server run dev
   ```
   ```bash
   # Frontend (new terminal)
   PORT=5173 BASE_PATH=/ pnpm --filter @workspace/hivemind run dev
   ```
4. Open the app at the forwarded port 5173

See `.devcontainer/devcontainer.json` for configuration.