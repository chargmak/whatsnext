import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import { RequireUser, RedirectIfAuthed } from './components/RouteGuards';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import Profile from './pages/Profile';
import Calendar from './pages/Calendar';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import EditProfile from './pages/EditProfile';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';
import MediaDetail from './pages/MovieDetail';
import Person from './pages/Person';
import CineBot from './components/CineBot';
import { UserProvider } from './context/UserContext';
import { CineBotProvider } from './context/CineBotContext';

// A compact recover affordance for the CineBot boundary: if the assistant's
// subtree ever throws, we swap the whole floating widget for this small pill
// instead of blanking the page. Tapping it calls the boundary's reset() so the
// assistant remounts fresh (clearing whatever message state tripped it) — no
// full page reload needed.
function CineBotCrashFallback(reset) {
  return (
    <button
      onClick={reset}
      aria-label="Reopen CineBot"
      style={{
        position: 'fixed',
        bottom: '96px',
        right: '20px',
        padding: '10px 16px',
        borderRadius: '999px',
        background: 'var(--accent-gradient)',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 8px 24px rgba(220, 38, 38, 0.45)',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
        zIndex: 900,
      }}
    >
      Reopen CineBot
    </button>
  );
}

// The routed pages live in their own ErrorBoundary, keyed on the route so it
// auto-recovers on navigation. The floating chrome (CineBot, install prompt)
// each get their OWN boundary as siblings — never nested under the page one.
// CineBot used to render *outside* any boundary (a fault blanked the whole
// React tree to a black screen), then briefly *inside* the page boundary (a
// fault replaced the entire page with the generic error screen). Isolating it
// means an assistant fault can only ever take down the assistant: the page and
// nav stay fully usable, and the user gets a one-tap "Reopen CineBot" to retry.
function AppShell() {
  const location = useLocation();
  return (
    <div className="app">
      <ErrorBoundary resetKey={location.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/library" element={<RequireUser><Library /></RequireUser>} />
          <Route path="/calendar" element={<RequireUser><Calendar /></RequireUser>} />
          <Route path="/profile" element={<RequireUser><Profile /></RequireUser>} />
          <Route path="/profile/edit" element={<RequireUser><EditProfile /></RequireUser>} />
          <Route path="/notifications" element={<RequireUser><Notifications /></RequireUser>} />
          <Route path="/settings" element={<RequireUser><Settings /></RequireUser>} />
          <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
          <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/movie/:id" element={<MediaDetail type="movie" />} />
          <Route path="/tv/:id" element={<MediaDetail type="tv" />} />
          <Route path="/person/:id" element={<Person />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
      <ErrorBoundary resetKey={location.pathname} fallback={CineBotCrashFallback}>
        <CineBot />
      </ErrorBoundary>
      <ErrorBoundary resetKey={location.pathname} fallback={null}>
        <InstallPrompt />
      </ErrorBoundary>
      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <UserProvider>
      <Router>
        <CineBotProvider>
          <AppShell />
        </CineBotProvider>
      </Router>
    </UserProvider>
  );
}

export default App;
