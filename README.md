# What's Next? - Your Personal Entertainment Companion

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

**What's Next?** is a modern, beautiful, and intuitive application designed to help you track your favorite movies and TV shows. Never miss a release again with personalized calendars, watchlist management, and detailed information about upcoming entertainment.

This application is built as a **Progressive Web App (PWA)**, offering a native-app-like experience directly in your browser or installed on your device.

## 🚀 Features

*   **🎬 Comprehensive Tracking**: Search and add movies and TV shows to your personal watchlist.
*   **📅 Release Calendar**: A personalized calendar view that shows you exactly when new episodes or movies are premiering. Includes a grouped view for easy daily planning.
*   **📱 PWA Support**: Installable on mobile and desktop devices with offline capabilities and a responsive, touch-friendly interface.
*   **✨ Modern UI/UX**: Built with a "Glassmorphism" design aesthetic, featuring smooth animations (powered by Framer Motion), dark mode by default, and intuitive navigation.
*   **👤 Real Accounts**: Sign up with email/password (Supabase Auth). Your watchlist, history, episode progress, and reminders sync across devices. Includes password reset, change password, and account deletion.
*   **🎭 Guest Mode**: Prefer not to sign up? Use "Continue as guest" — your data is stored on the device, and when you later create an account you'll be offered a one-click import into it.
*   **🔔 Release Reminders + Push Notifications**: Tap "Notify Me" on an upcoming movie to track the countdown from the Notifications page, and opt into Web Push to get alerted the day a title is released — even when the app is closed. Powered by a scheduled Supabase edge function; see [NOTIFICATIONS_SETUP.md](./NOTIFICATIONS_SETUP.md).
*   **🎯 Completionist Tracking**: Tap any cast member to open their page and see your **filmography completion %** (with per-title check-off), and track your progress through **movie franchises** with an in-order checklist.
*   **🤖 CineBot**: A built-in assistant that understands moods and time limits ("something funny under 90 min"), pulls picks from your watchlist ("what should I watch next?"), and looks up titles. Optionally upgradeable to a Claude-powered, library-aware backend (see `supabase/functions/cinebot`).

## 🛠️ Tech Stack

*   **Frontend Framework**: [React](https://react.dev/)
*   **Build Tool**: [Vite](https://vitejs.dev/)
*   **Styling**: Plain CSS with CSS Variables (Custom Design System)
*   **Animations**: [Framer Motion](https://www.framer.com/motion/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Routing**: [React Router](https://reactrouter.com/)
*   **Data Source**: [TMDB API](https://www.themoviedb.org/) (The Movie Database)
*   **Backend**: [Supabase](https://supabase.com/) — email/password auth, Postgres with row-level security for watchlists, history, episode progress, and reminders. The app also runs backend-less (guest mode only) if Supabase env vars are absent.

## 📸 Screenshots

*(Add screenshots of your Dashboard, Calendar, and Search pages here)*

## 📦 Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/chargmak/whatsnext.git
    cd whatsnext
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Copy `.env.example` to `.env` and fill in your keys:
    ```env
    VITE_TMDB_API_KEY=your_tmdb_api_key_here
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
    See `SUPABASE_SETUP.md` for backend setup. Without the Supabase keys the app still runs in guest-only mode.

4.  **Run Locally**
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:5173`.

## 🌐 Deployment

This project is configured for easy deployment on **Vercel**.

1.  Push your code to GitHub.
2.  Import the project into Vercel.
3.  Add the Environment Variables (`VITE_TMDB_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel project settings.
4.  Deploy!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
