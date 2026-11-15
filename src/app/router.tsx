import { createBrowserRouter } from 'react-router-dom';
import { CheckpointPage, TestOutPage } from '../pages/CheckpointPage';
import { LessonPage } from '../pages/LessonPage';
import { ProblemsPage } from '../pages/ProblemsPage';
import { ReviewPage } from '../pages/ReviewPage';
import { Bookmarks } from '../pages/Bookmarks';
import { Dashboard } from '../pages/Dashboard';
import { DiagnosticPage } from '../pages/DiagnosticPage';
import { NodePage } from '../pages/NodePage';
import { NotFound } from '../pages/NotFound';
import { SearchPage } from '../pages/SearchPage';
import { Settings } from '../pages/Settings';
import { Soon } from '../pages/Soon';
import { TrackPage } from '../pages/TrackPage';
import { guardLearn, guardTestOut } from './guards';
import { Layout } from './Layout';

export const routes = [
  {
    element: <Layout />,
    errorElement: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/track/:track', element: <TrackPage /> },
      { path: '/node/:nodeId', element: <NodePage /> },
      { path: '/learn/:nodeId', loader: guardLearn, element: <LessonPage />, errorElement: <NotFound /> },
      { path: '/learn/:nodeId/problems', loader: guardLearn, element: <ProblemsPage />, errorElement: <NotFound /> },
      { path: '/learn/:nodeId/checkpoint', loader: guardLearn, element: <CheckpointPage />, errorElement: <NotFound /> },
      { path: '/node/:nodeId/test-out', loader: guardTestOut, element: <TestOutPage />, errorElement: <NotFound /> },
      { path: '/diagnostic/:track', element: <DiagnosticPage /> },
      { path: '/review', element: <ReviewPage /> },
      { path: '/lab', element: <Soon what="Lab" /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/bookmarks', element: <Bookmarks /> },
      { path: '/settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];
export const makeRouter = () => createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' });
