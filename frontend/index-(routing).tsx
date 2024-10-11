import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./global.scss"
import { UserProvider } from "./contexts/UserContext"
import { FileProvider } from './contexts/FileContext';
import { ToastProvider } from './contexts/ToastContext';
import { InterfaceProvider } from './contexts/InterfaceContext';
import AuthPage from "./components/Pages-COMPS/AuthPage-folder/AuthPage"
import MainPage from "./components/Pages-COMPS/MainPage-folder/MainPage"
import AllFiles from './components/MainSections-COMPS/AllFiles-COMPS/AllFiles';
import Settings from './components/MainSections-COMPS/Settings-comp/Settings';
import FileViewer from './components/MainSections-COMPS/FileViewer-COMPS/FileViewer';
import LoadingPage from './components/Other-COMPS/LoadingBar-COMPS/LoadingPage-comp/LoadingPage';
import VerifyEmail from './components/Other-COMPS/VerifyEmail';

const router = createBrowserRouter([
    {
        path: "*",
        element: <Navigate to="/auth" replace={true} />,
    },
    {
        path: "/auth",
        element: <AuthPage />,
    },
    {
        path: "/", // MainPage is returned from inside component if user is not authenticated
        element: <MainPage />,
        children: [
            {
                path: "/LimeDrive/*",
                element: <AllFiles />,
            },
            
            {
                path: "/Settings",
                element: <Settings />,
            },
            {
                path: "/Settings/*",
                element: <Navigate to="/Settings" replace={true} />,
            },
        ],
        errorElement: <LoadingPage message="Error. Something went wrong, please refresh the page." loading={false}/>,
    },
    {
        path: "/link-share/*",
        element: <FileViewer />,
    },
    {
        path: "/link-share", // If user is in link-share path but the path has no access token, then go to auth ("*" Navigate at the top didn't do this for some reason)
        element: <Navigate to="/auth" replace={true} />,
    },
    {
        path: "/verify-email", // Leave this. Don't need to match params
        element: <VerifyEmail />,
    },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <InterfaceProvider>
            <ToastProvider>
                <FileProvider>
                    <UserProvider>
                        <RouterProvider router={router} />
                    </UserProvider>
                </FileProvider>
            </ToastProvider>
        </InterfaceProvider>
    </React.StrictMode>,
)