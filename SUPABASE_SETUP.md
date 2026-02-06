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
3.  Copy and paste the entire content of the `supabase_schema.sql` file located in your project root.
4.  Click **Run**.

This will create the necessary tables (`profiles`, `watchlists`, `history`) and security policies to secure your user data.

## 4. Auth Settings
1.  Go to **Authentication** -> **Providers**.
2.  Ensure **Email** is enabled.
3.  (Optional) Disable "Confirm email" for faster testing in **Authentication** -> **URL Configuration** -> **Site URL** (set to your Vercel URL later).

That's it! Your app will automatically switch from "Local Demo Mode" to "Real Backend Mode" once the keys are detected.
