import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './styles/admin.css';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { ToastProvider } from './components/ui';
import Layout from './components/Layout';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Posts = lazy(() => import('./pages/Posts'));
const PostEditor = lazy(() => import('./pages/PostEditor'));
const PostTrash = lazy(() => import('./pages/PostTrash'));
const Pages = lazy(() => import('./pages/Pages'));
const Categories = lazy(() => import('./pages/Categories'));
const Tags = lazy(() => import('./pages/Tags'));
const Comments = lazy(() => import('./pages/Comments'));
const Media = lazy(() => import('./pages/Media'));
const Links = lazy(() => import('./pages/Links'));
const Settings = lazy(() => import('./pages/Settings'));
const Audit = lazy(() => import('./pages/Audit'));
const Profile = lazy(() => import('./pages/Profile'));
const Members = lazy(() => import('./pages/Members'));
const ChatAdmin = lazy(() => import('./pages/ChatAdmin'));
const GuestbookAdmin = lazy(() => import('./pages/GuestbookAdmin'));
const MusicSettings = lazy(() => import('./pages/MusicSettings'));
const MailSettings = lazy(() => import('./pages/MailSettings'));
const Appearance = lazy(() => import('./pages/Appearance'));
const GuestbookStyle = lazy(() => import('./pages/GuestbookStyle'));
const Backgrounds = lazy(() => import('./pages/Backgrounds'));
const UapiSettings = lazy(() => import('./pages/UapiSettings'));
const EffectsSettings = lazy(() => import('./pages/EffectsSettings'));

function Loading() {
  return <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}><span className="spinner" /></div>;
}

function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'booting') return <Loading />;
  if (status !== 'authed') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function LoginRoute() {
  const { status } = useAuth();
  if (status === 'booting') return <Loading />;
  if (status === 'authed') return <Navigate to="/" replace />;
  return <Login />;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route
              path="/"
              element={(
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              )}
            >
              <Route index element={<Dashboard />} />
              <Route path="posts" element={<Posts />} />
              <Route path="posts/new" element={<PostEditor />} />
              <Route path="posts/trash" element={<PostTrash />} />
              <Route path="posts/:id" element={<PostEditor />} />
              <Route path="pages" element={<Pages />} />
              <Route path="categories" element={<Categories />} />
              <Route path="tags" element={<Tags />} />
              <Route path="comments" element={<Comments />} />
              <Route path="media" element={<Media />} />
              <Route path="links" element={<Links />} />
              <Route path="settings" element={<Settings />} />
              <Route path="audit" element={<Audit />} />
              <Route path="profile" element={<Profile />} />
              <Route path="members" element={<Members />} />
              <Route path="chat" element={<ChatAdmin />} />
              <Route path="guestbook" element={<GuestbookAdmin />} />
              <Route path="music" element={<MusicSettings />} />
              <Route path="mail" element={<MailSettings />} />
              <Route path="appearance" element={<Appearance />} />
              <Route path="guestbook-style" element={<GuestbookStyle />} />
              <Route path="backgrounds" element={<Backgrounds />} />
              <Route path="uapi" element={<UapiSettings />} />
              <Route path="effects" element={<EffectsSettings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/admin">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
