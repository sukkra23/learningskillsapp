import { createBrowserRouter } from 'react-router-dom';
import { CheckpointPage, TestOutPage } from '../pages/CheckpointPage';
import { LabPage } from '../pages/LabPage';
import { LessonPage } from '../pages/LessonPage';
import { ProblemsPage } from '../pages/ProblemsPage';
import { ReviewPage } from '../pages/ReviewPage';
import { Bookmarks } from '../pages/Bookmarks';
import { Dashboard } from '../pages/Dashboard';
import { DiagnosticPage } from '../pages/DiagnosticPage';
import { NodePage } from '../pages/NodePage';
import { NotFound, RouteError } from '../pages/NotFound';
import { SearchPage } from '../pages/SearchPage';
import { Settings } from '../pages/Settings';
import { TrackPage } from '../pages/TrackPage';
import { guardLearn, guardTestOut } from './guards';
import { Layout } from './Layout';

export const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard />, errorElement: <RouteError /> },
      { path: '/track/:track', element: <TrackPage /> },
      { path: '/node/:nodeId', element: <NodePage /> },
      { path: '/learn/:nodeId', loader: guardLearn, element: <LessonPage />, errorElement: <RouteError /> },
      { path: '/learn/:nodeId/problems', loader: guardLearn, element: <ProblemsPage />, errorElement: <RouteError /> },
      { path: '/learn/:nodeId/checkpoint', loader: guardLearn, element: <CheckpointPage />, errorElement: <RouteError /> },
      { path: '/node/:nodeId/test-out', loader: guardTestOut, element: <TestOutPage />, errorElement: <RouteError /> },
      { path: '/diagnostic/:track', element: <DiagnosticPage /> },
      { path: '/review', element: <ReviewPage /> },
      { path: '/lab', element: <LabPage /> },
      { path: '/lab/:widget', element: <LabPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/bookmarks', element: <Bookmarks /> },
      { path: '/settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];
export const makeRouter = () => createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' });
