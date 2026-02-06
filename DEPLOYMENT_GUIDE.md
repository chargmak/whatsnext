# Deployment Guide

Your code is pushed to GitHub! Follow these final steps to make your app live.

## 1. Deploy to Vercel
1.  Go to [vercel.com/new](https://vercel.com/new).
2.  Under **Import Git Repository**, find `chargmak/whatsnext` and click **Import**.
3.  **Configure Project**:
    - **Framework Preset**: Vite (should be auto-detected).
    - **Root Directory**: `./` (default).
4.  **Environment Variables** (Crucial Step):
    Expand the "Environment Variables" section and add the following keys. Copy the values from your local `.env` file (or see below):

    | Key | Value |
    |-----|-------|
    | `VITE_TMDB_API_KEY` | `7430fb2936fe01713e636ff97be73de7` |
    | `VITE_SUPABASE_URL` | `https://vtftqdsltwernbjvewqm.supabase.co` |
    | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZnRxZHNsdHdlcm5ianZld3FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzk5NzUsImV4cCI6MjA4NTk1NTk3NX0.6tHgM77GACtzvOdbRakkMO63Am_e2owrUaQTSCeWNXc` |

5.  Click **Deploy**.

## 2. Verify Your App
Once deployed, click the URL provided by Vercel.
- Try **Registering** a new account.
- Try **Adding a Movie** to your watchlist.
- **Refresh the page**: The data should persist!

## 3. Install as App (PWA)
- Open the Vercel URL on your Android phone (Chrome).
- Tap the **"Add to Home Screen"** or **"Install App"** prompt.
- Enjoy your native-like Movie Tracker! 🎬
