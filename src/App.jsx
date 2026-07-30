import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import { RequireUser, RedirectIfAuthed } from './components/RouteGuards';
import Home from './pages/Home';
import { UserProvider } from './context/UserContext';

// Home is the landing route, so it ships in the main bundle — making it wait on
// its own chunk would just add a round trip to the screen everyone sees first.
// Every other page is split out: the app used to download all fifteen of them
// (plus their dependencies) before it could render anything at all.
const Search = lazy(() => import('./pages/Search'));
const Library = lazy(() => import('./pages/Library'));
const Profile = lazy(() => import('./pages/Profile'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Settings = lazy(() => import('./pages/Settings'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));
const MediaDetail = lazy(() => import('./pages/MovieDetail'));
const Person = lazy(() => import('./pages/Person'));

const RouteFallback = () => (
    <div className="container" style={{ paddingTop: '100px', textAlign: 'center' }}>
        <div className="spinner"></div>
    </div>
);

// The routed pages live in their own ErrorBoundary, keyed on the route so it
// auto-recovers on navigation. Floating chrome (the install prompt) gets its
// OWN boundary as a sibling — never nested under the page one — so a fault
// there can't replace the whole page.
function AppShell() {
  const location = useLocation();
  return (
    <div className="app">
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
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
