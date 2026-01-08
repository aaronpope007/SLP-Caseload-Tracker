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

## First Time Using the App?

**Try it out with test data first!**

After starting the app, you can quickly explore all features with sample data:

1. Open the app in your browser (usually `http://localhost:5173`)
2. Click the **Settings** icon (⚙️) in the navigation bar
3. Scroll down to the **"Test Data"** section
4. Click **"Create Test Data"** to generate:
   - A sample school (Test Elementary School)
   - 6 teachers (one per grade K-5)
   - 18 students (3 per grade)

This lets you explore all features before adding your real data. You can delete the test data anytime from Settings when you're ready!

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

