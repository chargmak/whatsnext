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

// The routed pages AND the floating chrome (CineBot, install prompt) all live
// inside one ErrorBoundary. CineBot in particular used to render as a sibling
// *outside* the boundary, so any error while it rendered a reply took the whole
// React tree down to a blank/black screen with no recovery. Keeping the nav
// outside gives the user a way to navigate off a crashed screen, which resets
// the boundary (keyed on the route).
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
        <CineBot />
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
