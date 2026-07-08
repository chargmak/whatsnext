# Supabase Setup Guide

To make your app fully operational with a real backend, follow these steps:

## 1. Create a Project
1.  Go to [supabase.com](https://supabase.com) and create a free account.
2.  Create a **New Project**.
3.  Give it a name (e.g., "MovieTracker") and a secure database password.
4.  Wait for the project to initialize.

## 2. Get Credentials
1.  Go to **Project Settings** (gear icon) -> **API**.
2.  Copy the **Project URL**.
3.  Copy the **`anon` public key**.
4.  Paste these into your local `.env` file (I created this file for you, just fill in the blanks).
    ```env
    VITE_SUPABASE_URL=your_project_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```
5.  **Important:** You also need to add these as "Environment Variables" when you deploy to Vercel.

## 3. Run Database SQL
1.  Go to the **SQL Editor** tab in the left sidebar.
2.  Click **New Query**.
3.  Run the entire content of `supabase_schema.sql` (base tables), then run each file in `supabase/migrations/` **in order** (cascade deletes, profile columns, payload columns, `watched_episodes`, `reminders`, and the `delete_user` RPC).

This creates the tables (`profiles`, `watchlists`, `history`, `watched_episodes`, `reminders`), row-level-security policies, the signup trigger that fills in the profile, and the self-serve account-deletion function.

## 4. Auth Settings
1.  Go to **Authentication** -> **Providers**.
2.  Ensure **Email** is enabled.
3.  (Optional) Disable "Confirm email" so new users can log in immediately without a confirmation link. The app handles both modes.
4.  Under **Authentication** -> **URL Configuration**, set the Site URL to your deployed URL so password-reset links point at `/reset-password` on the right domain.

That's it! With `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set, the app uses real accounts; without them it runs in guest-only mode.
