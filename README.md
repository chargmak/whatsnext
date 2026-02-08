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
*   **👤 Demo Mode**: The application is currently configured in a special **Portfolio Demo Mode**. 
    *   No login required.
    *   Generates a unique, random user persona for each visitor.
    *   Uses secure local storage to persist your watchlist during your session.

## 🛠️ Tech Stack

*   **Frontend Framework**: [React](https://react.dev/)
*   **Build Tool**: [Vite](https://vitejs.dev/)
*   **Styling**: Plain CSS with CSS Variables (Custom Design System)
*   **Animations**: [Framer Motion](https://www.framer.com/motion/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **Routing**: [React Router](https://reactrouter.com/)
*   **Data Source**: [TMDB API](https://www.themoviedb.org/) (The Movie Database)
*   **Backend (Optional)**: Supabase (Project includes setup for Supabase auth/db, currently toggled to local demo mode for easy portfolio viewing).

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
    Create a `.env` file in the root directory and add your TMDB API Key:
    ```env
    VITE_TMDB_API_KEY=your_tmdb_api_key_here
    VITE_TMDB_ACCESS_TOKEN=your_tmdb_access_token
    ```

4.  **Run Locally**
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:5173`.

## 🌐 Deployment

This project is configured for easy deployment on **Vercel**.

1.  Push your code to GitHub.
2.  Import the project into Vercel.
3.  Add the Environment Variables (TMDB Key) in the Vercel project settings.
4.  Deploy!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
