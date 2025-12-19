# Quick Start Guide

## First Time Setup

1. **Install frontend dependencies:**
   ```bash
   pnpm install
   ```

2. **Install API dependencies:**
   ```bash
   cd api
   npm install
   cd ..
   ```

3. **Migrate your data (if you have localStorage data):**
   - Follow the instructions in [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

## Running the Application

**Just run one command:**
```bash
pnpm dev
```

This will automatically start:
- ✅ **Frontend** on `http://localhost:5173`
- ✅ **API Server** on `http://localhost:3001`

You'll see output from both servers in the same terminal, color-coded:
- **API** (cyan) - Backend server logs
- **FRONTEND** (magenta) - Frontend dev server logs

## Stopping the Servers

Press `Ctrl+C` once to stop both servers.

## Troubleshooting

### "Cannot connect to API server" error
- Make sure `pnpm dev` is running (it starts both servers)
- Check that the API server shows "🚀 Server running on http://localhost:3001"
- Verify `http://localhost:3001/health` works in your browser

### Port already in use
- If port 3001 is taken, change it in `api/src/server.ts`
- If port 5173 is taken, Vite will automatically use the next available port

