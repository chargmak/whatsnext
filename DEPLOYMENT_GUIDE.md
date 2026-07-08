# Deployment Guide

Your code is pushed to GitHub! Follow these final steps to make your app live.

## 1. Deploy to Vercel
1.  Go to [vercel.com/new](https://vercel.com/new).
2.  Under **Import Git Repository**, find `chargmak/whatsnext` and click **Import**.
3.  **Configure Project**:
    - **Framework Preset**: Vite (should be auto-detected).
    - **Root Directory**: `./` (default).
4.  **Environment Variables** (Crucial Step):
    Expand the "Environment Variables" section and add the following keys. Copy the values from your local `.env` file (see `.env.example` for the expected format):

    | Key | Value |
    |-----|-------|
    | `VITE_TMDB_API_KEY` | `<your TMDB API key>` |
    | `VITE_SUPABASE_URL` | `<your Supabase project URL>` |
    | `VITE_SUPABASE_ANON_KEY` | `<your Supabase anon key>` |

    > ⚠️ **Never commit real keys to the repository.** A TMDB API key was previously committed in this file and remains in git history — rotate it at [themoviedb.org → Settings → API](https://www.themoviedb.org/settings/api). The Supabase anon key is public by design (RLS protects the data), but keep it in env vars anyway.

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
