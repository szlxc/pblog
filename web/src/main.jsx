import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles/base.css';
import './styles/components.css';
import './styles/community.css';
import './styles/guestbook.css';
import './styles/modern.css';
import './styles/skin.css';
import './styles/view-transition.css';
import { Provider as SiteProvider } from './context/SiteContext';
import { MemberProvider } from './context/MemberContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import RouteLoading from './components/RouteLoading';

const Home = lazy(() => import('./pages/Home'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const Archive = lazy(() => import('./pages/Archive'));
const Tags = lazy(() => import('./pages/Tags'));
const PageView = lazy(() => import('./pages/PageView'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Chat = lazy(() => import('./pages/Chat'));
const Guestbook = lazy(() => import('./pages/Guestbook'));
const MemberAuth = lazy(() => import('./pages/MemberAuth'));
const Profile = lazy(() => import('./pages/Profile'));

function Fallback() {
  return (
    <div className="page-loading">
      <div className="page-loading__spinner" />
      <p className="page-loading__text">加载中…</p>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
      <MemberProvider>
        <SiteProvider>
          <RouteLoading />
          <Layout>
            <Suspense fallback={<Fallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/post/:slug" element={<PostDetail />} />
                <Route path="/archive" element={<Archive />} />
                <Route path="/tags" element={<Tags />} />
                <Route path="/p/:slug" element={<PageView />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/guestbook" element={<Guestbook />} />
                <Route path="/login" element={<MemberAuth mode="login" />} />
                <Route path="/register" element={<MemberAuth mode="register" />} />
                <Route path="/verify" element={<MemberAuth mode="verify" />} />
                <Route path="/forgot" element={<MemberAuth mode="forgot" />} />
                <Route path="/reset" element={<MemberAuth mode="reset" />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>
        </SiteProvider>
      </MemberProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
