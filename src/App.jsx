import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import { RequireUser, RedirectIfAuthed } from './components/RouteGuards';
import { useUser } from './context/UserContext';
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
import { UserProvider } from './context/UserContext';

// The Library is the app's default landing: anyone with a session (a signed-in
// account or a local guest) drops straight into their list. Fully signed-out
// visitors still get the public discovery Home as the entry point.
function IndexRoute() {
  const { status } = useUser();
  if (status === 'loading') {
    return (
      <div className="container flex-center" style={{ height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }
  return <Navigate to={status === 'signedOut' ? '/home' : '/library'} replace />;
}

// The routed pages live in their own ErrorBoundary, keyed on the route so it
// auto-recovers on navigation. Floating chrome (the install prompt) gets its
// OWN boundary as a sibling — never nested under the page one — so a fault
// there can't replace the whole page.
function AppShell() {
  const location = useLocation();
  return (
    <div className="app">
      <ErrorBoundary resetKey={location.pathname}>
        <Routes>
          <Route path="/" element={<IndexRoute />} />
          <Route path="/home" element={<Home />} />
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
        <AppShell />
      </Router>
    </UserProvider>
  );
}

export default App;
