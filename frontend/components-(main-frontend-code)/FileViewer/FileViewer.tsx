import { memo, useState, useEffect, useRef } from 'react';
import { DateTime } from 'luxon';
import "./FileViewer.scss"
import axios, { AxiosResponse } from 'axios';
import { useFileContext } from '../../../contexts/FileContext';
import { useUserContext } from '../../../contexts/UserContext';
import { motion, AnimatePresence, MotionProps } from 'framer-motion';
import DynamicClip from '../../Other-COMPS/DynamicClip';
import Backdrop from '../../Other-COMPS/Backdrop-comp/Backdrop';
import useDelayedExit from '../../../hooks/useDelayedExit';
import FocusTrap from 'focus-trap-react';
import FileContent from './FileContent-COMPS/FileContent';
import { useToast } from '../../../contexts/ToastContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { isFileTypeSupported } from '../../../data/supportedFileTypes';
import Watermark from '../../Other-COMPS/Watermark';
import VideoControls from './VideoControls-comp/VideoControls';
import FileViewerHeader from './FileViewerHeader-comp/FileViewerHeader';
import FileLoadingInfo from './FileLoadingInfo-comp/FileLoadingInfo';
import { useDownload } from '../../../hooks/useDownload';
import { useInterfaceContext } from '../../../contexts/InterfaceContext';

function FileViewer() {
    const location = useLocation();
    const navigate = useNavigate();
    const { fileToView, setFileToView } = useFileContext();
    const { api, setRefreshUserContext } = useUserContext();
    const { viewportWidth, vidIconToShow } = useInterfaceContext();
    const { showToast, setToastContainer } = useToast();
    const { handleDownloadSingleFile } = useDownload();

    const fileViewerRef = useRef<HTMLDivElement | null>(null);
    const fileViewerHeaderRef = useRef<HTMLDivElement | null>(null);
    const fileContentRef = useRef<HTMLElement | null>(null);
    const [isLinkShareView, setIsLinkShareView] = useState(false);
    const renderViewer = fileToView !== null || isLinkShareView;
    const [fileContentUrl, setFileContentUrl] = useState("");
    const [notSupported, setNotSupported] = useState(false);
    const [isEmptyFile, setIsEmptyFile] = useState(false);
    const [contentLoaded, setContentLoaded] = useState(false); // For when the content itself has loaded and is visible to the user, instead of just the file url/text content being retrieved but not yet loaded into FileContent
    const [urlExpired, setUrlExpired] = useState(false);
    const [backendErrorMsg, setBackendErrorMsg] = useState("");
    const [isSrcError, setIsSrcError] = useState(false);
    const [loading, setLoading] = useState(true); // Leave true at first to prevent unnecessary flashing fail message in link-share view
    const [validFileAccessToken, setValidFileAccessToken] = useState<string | null>(null);
    const [urlExpirationTimeout, setUrlExpirationTimeout] = useState<NodeJS.Timeout | undefined>(undefined);
    const [controller, setController] = useState(new AbortController()); // Use state to use new abort controller each time
    const renderVideoControls = contentLoaded && fileToView !== null && fileToView.type.startsWith("video/");
    const [isFullscreen, setIsFullscreen] = useState(false); // Only counts for fullscreen video, not fullscreen in general
    let fullWidthTimeout: NodeJS.Timeout
    const [hasFullWidthWindowedContent, setHasFullWidthWindowedContent] = useState(false)
        
    const contentFailConditions = isEmptyFile || notSupported || urlExpired || isSrcError || (!fileContentUrl && fileToView && !loading) || backendErrorMsg;
    const linkShareFailConditions = isLinkShareView && ((!fileContentUrl && fileToView && !loading && !notSupported) || backendErrorMsg);
    const retrievableButNotViewable = fileToView && (notSupported || isEmptyFile || urlExpired || isSrcError);
    const showLoadingInfo = (loading || contentFailConditions || (!fileToView && isLinkShareView)) // Here since the wrapper has class conditionally applied

    const VIEWPORT_WIDTH_1024_BREAK = viewportWidth <= 1024
    // Is specific so that text wrapping is more exact for more even spacing on left and right
    const LIST_MAX_WIDTH = 909

    // Don't set loading to false here. Tried to find a more maintainable way to reset viewer state
    // Such as by unrendering in parent (e.g. MainPage) when fileToView = false, but ran into issues
    const resetViewer = () => {
        setToastContainer(document.body)
        clearTimeout(urlExpirationTimeout)
        setFileContentUrl("")
        setNotSupported(false);
        setIsEmptyFile(false)
        setBackendErrorMsg("");
        setContentLoaded(false)
        setUrlExpired(false)
        setShowContentSpinner(false)
        setValidFileAccessToken(null)
        setIsSrcError(false)
        setIsFullscreen(false)
        setUrlExpirationTimeout(undefined)
    }

    const { isVisible: isUserFileViewerVisible }  = useDelayedExit({
        shouldRender: fileToView !== null && !isLinkShareView, // No exit animation if link-share view and the link-share version of the file viewer has a different render condition
        onExitCallback: () => {
            resetViewer()
        }
    })
    const { isVisible: isVideoControlsVisible }  = useDelayedExit({
        shouldRender: renderVideoControls
    })

    useEffect(() => {
        location.pathname.startsWith("/link-share/") ?
            setIsLinkShareView(true)
            : setIsLinkShareView(false)
    }, [location.pathname])

    const handleFileContentResponse = (fileAfterResponse: {[key: string]: any}, response: AxiosResponse) => {
        const fileType: string = fileAfterResponse.type
        
        if (!isFileTypeSupported(fileType)) {
            setNotSupported(true);
            return;
        }
        else if (fileAfterResponse.size === 0) {
            setIsEmptyFile(true)
            return
        }

        setFileContentUrl(response.data.fileUrl)

        if (fileType.startsWith("video/") || fileType.startsWith("audio/")) { // User may notice problems when viewing a video or audio types after its url is expired so urlExpired state is used to inform the user. Only for video as other supported file types don't seem to have issues after url expiration (including PDF buttons working fine still)
            const expirationTime = DateTime.fromISO(response.data.expirationTime, { zone: 'utc' });
            const currentTime = DateTime.utc();
            const timeRemaining = expirationTime.diff(currentTime).milliseconds; // Since both times are UTC don't need to worry about user's timezone

            const expirationTimeout = setTimeout(() => {
                 // In case the content was closed so previous timeouts don't cause issues
                if (urlExpirationTimeout === expirationTimeout) {
                    setUrlExpired(true) // Don't need to revoke object url as well since presigned urls are used for these file types
                }
            }, timeRemaining);

            setUrlExpirationTimeout(expirationTimeout);
        }

        // Could use server-generated sprite sheets for video thumbnails and then put the frontend code for that here
    }

    const setupLinkShareFileViewer = async () => { // For unauthenticated users accessing file via linkshare
        try { // Leave in try so early return makes loading set to false because it is set to true initially
            const pathnameParts = location.pathname.split("/");
            const fileAccessToken = pathnameParts[pathnameParts.length - 1]; // remove "/link-share/" from location.pathname to get fileAccessToken
            // if (fileAccessToken.length > 255 || !/.*-.*-.*$/.test(fileAccessToken)) { // If more than 255 chars or doesn't have at least 2 hyphens
            //     return console.log("Token is invalid") // Tried to add frontend check for invalid file access token but couldn't get it to work, so relying on backendErrorMsg instead. Leave commented out so I remember. I tried to use state for this frontend check but it didn't work. Don't try to implement this frontend check again.
            // }

            setLoading(true)

            const response = await api.post('/getLinkShareFileViewingUrl', 
                {fileAccessToken: fileAccessToken}, 
                {signal: controller.signal}
            );
            setValidFileAccessToken(fileAccessToken) // If successful response then it would mean that this token was valid

            const responsePartialFile = response.data.partialFile
            
            setFileToView(responsePartialFile)

            handleFileContentResponse(responsePartialFile, response)
        }
        catch (error) {
            console.error(error);
            if (axios.isAxiosError(error)) {
                setBackendErrorMsg(error?.response?.data.message)
            }
        }
        finally {
            setLoading(false)
        }
    }

    const setupUserFileViewer = async () => { // For authenitcated/logged in users
        try { // Leave in try so early return makes loading set to false because it is set to true initially
            if (!fileToView) return // Leave this to prevent TS problems

            const newFileToView = { ...fileToView } // Copy in case it changes before the function is finished

            if (!isFileTypeSupported(newFileToView.type)) {
                setNotSupported(true);
                return;
            }
            else if (newFileToView.size === 0) {
                setIsEmptyFile(true)
                return
            }

            setLoading(true)

            const response = await api.get('/getFileViewingUrl', { // Cloudflare hotlink protection may prevent file from being viewable on localhost so do not enable it (not needed anyway as rules are already set up based on ip/referer)
                params: {id: newFileToView.id},
                signal: controller.signal,
            });

            handleFileContentResponse(newFileToView, response)
        }
        catch (error) {
            console.error(error);
            if (axios.isAxiosError(error)) {
                setBackendErrorMsg(error?.response?.data.message)
            }
        }
        finally {
            setLoading(false)
        }
    };

     // Setup for api
    useEffect(() => {
        const toastTimeout = setTimeout(() => { // Run after FileViewer is rendered
            setToastContainer(document.querySelector(".FileViewer") as HTMLElement | null); // Changes container to allow focus trap to include this
        }, 1);

        if (isLinkShareView) {
            document.title = "Share – LimeDrive"
        }

        if (!fileToView && isLinkShareView) {
            setupLinkShareFileViewer()
        } else if (fileToView && !isLinkShareView) { // Leave second condition as fileToView may be set after setupLinkShareFileViewer - If fileToView is initially set without the link-share api call, then that means the user is viewing it from their account rather than through link-share view
            setupUserFileViewer()
        }

        setController(new AbortController())

        return () => { // Leave abort controller code as is, timeout is here to match the animation (not needed for link-share view)
            if (!isLinkShareView) {
                setTimeout(() => {
                    controller.abort()
                }, 200)
            } else {
                controller.abort()
            }

            clearTimeout(toastTimeout);
        }
    }, [fileToView, isLinkShareView])

    // Set escape event and blur and popstate
    useEffect(() => { 
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isFullscreen) {
                event.stopPropagation()
                handleCloseViewer()
            }
        }

        const handlePopState = (event: PopStateEvent) => {
            handleCloseViewer();
        };

        window.addEventListener('keydown', handleEscapeKey);
        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('keydown', handleEscapeKey);
            window.removeEventListener('popstate', handlePopState);
        }
    }, [renderViewer]) // Leave dep

    // Set outside click close event
    useEffect(() => { 
        // If FileViewer (including its header wuen not breakpoint) had BOTH mouseup and mousedown on them DIRECTLY (but not their children) 
        // and is not link-share view, then it should close viewer (for some reason isLinkShareView state reflected 
        // inaccurately, so using window.location instead, possibly explained in https://legacy.reactjs.org/docs/hooks-faq.html#why-am-i-seeing-stale-props-or-state-inside-my-function)
        // Don't disable this for video controls loaded as the scrubber touch precision issue has been dealt with
        const handleClickOutsideClose = (event: MouseEvent) => {
            const isOutside = (
                !location.pathname.startsWith("/link-share/") &&
                (event.target === fileViewerRef.current ||
                (event.target === fileViewerHeaderRef.current && !VIEWPORT_WIDTH_1024_BREAK))
            );
            // The reason for these checks is for UX - to prevent dragged singular mouse up or mouse down that orignated inside children to cause the viewer to close when not intended (e.g. to prevent close if the user was using the video control scurbber and then moved their mouse up but still intended to scrub)
            if (event.type === 'mousedown') { // Store whether the initial click was outside
                fileViewerRef.current?.setAttribute('data-click-outside', isOutside ? 'true' : 'false');
            } 
            else if (event.type === 'mouseup') { // Check if both mousedown and mouseup occurred outside
                const isInitialClickOutside = fileViewerRef.current?.getAttribute('data-click-outside') === 'true';
                
                if (isOutside && isInitialClickOutside) {
                    handleCloseViewer();
                }
        
                fileViewerRef.current?.removeAttribute('data-click-outside'); // Reset the attribute
            }
        };
        window.addEventListener('mousedown', handleClickOutsideClose);
        window.addEventListener('mouseup', handleClickOutsideClose);
        return () => {
            window.removeEventListener('mousedown', handleClickOutsideClose);
            window.removeEventListener('mouseup', handleClickOutsideClose);
        }
    }, [renderViewer, viewportWidth]) // Leave deps

    const handleCloseViewer = () => {
        setFileToView(null)
        if (isLinkShareView) {
            resetViewer() // Do it straight away if link-share view as exit animation wouldn't complete
            setIsLinkShareView(false)
            setRefreshUserContext(true) // for some reason If setupLinkShareFileViewer was aborted then using navigate didn't run the UserContext useEffect again despite location dep, but this refresh state fixed the issue
            navigate("/LimeDrive")
        }
    }

    const [showContentSpinner, setShowContentSpinner] = useState(false)
    useEffect(() => {
        let spinnerTimeout: NodeJS.Timeout | undefined;

        if (loading || contentFailConditions || contentLoaded) return

        spinnerTimeout = setTimeout(() => { // For smaller images, enable spinner after timeout if content is still not loaded so user doesn't think the content is broken or not attempting to load
            if (!contentLoaded) {
                setShowContentSpinner(true);
            }
        }, 200);

        return () => {
            clearTimeout(spinnerTimeout)
            setShowContentSpinner(false)
        }
    }, [loading])

    useEffect(() => {
        // Use state with timeout for this since it wasn't updating correctly otherwise if video comes out of fullscreen
        if (fullWidthTimeout) clearTimeout(fullWidthTimeout)

        fullWidthTimeout = setTimeout(() => {
            // fileContentRef not used for viewport comparison with list (aka the text-preview) since that ref is used with a different div for printing
            if (!isFullscreen && (
                Math.abs(viewportWidth - (fileContentRef.current?.getBoundingClientRect().width || 0)) < 1 || 
                (viewportWidth <= LIST_MAX_WIDTH) && (fileContentRef.current?.className === 'text-preview-print' || fileToView?.type.startsWith('text/')) && !showLoadingInfo
            )) {
                setHasFullWidthWindowedContent(true)
            } else {
                setHasFullWidthWindowedContent(false)
            }
        }, 50)

        return () => {
            clearTimeout(fullWidthTimeout)
        }
    }, [isFullscreen, viewportWidth, showLoadingInfo, fileToView]) // LIST_MAX_WIDTH not needed as dep as viewportWidth is there

    const styles = window.getComputedStyle(document.documentElement);
    const primaryColor = styles.getPropertyValue('--primary');
    const getAnimationProps = (animateCondition: boolean = true, spinnerTransitionCondition: boolean = false): MotionProps => {
        return {
            initial: { opacity: 0 },
            animate: { opacity: animateCondition ? 1 : 0 },
            exit: { opacity: 0 },
            transition: { duration: spinnerTransitionCondition ? 0.1 : 0.2 }
        };
    }

    const handleDownloadClick = () => {
        let fileAccessToken: string | null = null // If link-share view, get token quickly from location instead of validFileAccessToken state so that user doesn't need to wait if they want to downlaod straight away (validated in backend)
        let fileAccessTokenIdPart: string | null = null // Allow string since folder link-share may be added
        if (isLinkShareView) { // Checks here can prevent unnecessary backend processing and give quicker feeback to user
            const pathnameParts = location.pathname.split("/");
            fileAccessToken = pathnameParts[pathnameParts.length - 1];
            if (fileAccessToken.length > 255 || !/.*-.*-.*$/.test(fileAccessToken)) { // If more than 255 chars or doesn't have at least 2 hyphens then return toast since it's an invalid token
                return showToast({message: "Cannot get download if invalid link.", showFailIcon: true})
            }
            
            const tokenParts = fileAccessToken.split('-');
            fileAccessTokenIdPart = tokenParts[tokenParts.length - 2]; // 2nd to last part, do not parseInt in case folder link-share is added (reliable since share key being the last part wouldn't have a hyphen in it, and a backend check is there anyways)  
        }

        fileToView && !isLinkShareView ?
            handleDownloadSingleFile(fileToView.id)
        : isLinkShareView && (!linkShareFailConditions || retrievableButNotViewable) && fileAccessToken && fileAccessTokenIdPart ? 
            handleDownloadSingleFile(parseInt(fileAccessTokenIdPart), fileAccessToken)
        : linkShareFailConditions ?
            showToast({message: "Cannot get download if invalid link.", showFailIcon: true})
        : showToast({message: "Cannot get download.", showFailIcon: true})
    }

    return (
            <>
                {(isUserFileViewerVisible || isLinkShareView) &&
                    <FocusTrap focusTrapOptions={{ initialFocus: false }}>
                        <div 
                            className={`FileViewer 
                                ${isFullscreen ? "fullscreen" : ""} 
                                ${hasFullWidthWindowedContent ? 'has-full-width-windowed-content' : ''}
                            `} 
                            ref={fileViewerRef}
                        >
                            <FileViewerHeader // The exit animation of this may seem delayed if the file content is heavy
                                fileToView={fileToView}
                                contentLoaded={contentLoaded}
                                loading={loading}
                                validFileAccessToken={validFileAccessToken}
                                isLinkShareView={isLinkShareView}
                                contentFailConditions={contentFailConditions}
                                linkShareFailConditions={linkShareFailConditions}
                                retrievableButNotViewable={retrievableButNotViewable} 
                                fileViewerHeaderRef={fileViewerHeaderRef}
                                fileContentRef={fileContentRef}
                                renderViewer={renderViewer}
                                handleCloseViewer={handleCloseViewer}
                                handleDownloadClick={handleDownloadClick}
                                getAnimationProps={getAnimationProps}
                                VIEWPORT_WIDTH_1024_BREAK={VIEWPORT_WIDTH_1024_BREAK}
                            />

                            <AnimatePresence> {/* DynamicClip not used for content viewer - clip animation is slow when file content is loaded */}
                                {renderViewer &&
                                    <motion.div
                                        className={`file-content-wrapper
                                            ${showLoadingInfo ? 'loading-info-showing' : ''}
                                        `}
                                        initial={{  boxShadow: `0 0 0 0 ${primaryColor}`, opacity: 0 }}
                                        animate={{ boxShadow: `0rem 0rem 1rem .15rem ${primaryColor}`, opacity: 1 }} // Make edges of content clearer (not using border so less confusion of it being part of an image/video)
                                        // Leave 0rem otherwise it doesn't work for some reason
                                        exit={{ boxShadow: `0 0 0rem 0rem ${primaryColor}`, opacity: 0 }} // For some reason changing it to "none" doesn't animate and changing initial boxShadow to 0 looks weird, and didnt work when giving it to child containers. Transition for this didn't work in scss either
                                        transition={{ duration: 0.2 }}
                                        key="fileContentWrapperKey"
                                    >
                                        {showLoadingInfo ? // Don't put loading in contentFailConditions
                                            <FileLoadingInfo 
                                                loading={loading}
                                                retrievableButNotViewable={retrievableButNotViewable}
                                                notSupported={notSupported}
                                                urlExpired={urlExpired}
                                                isLinkShareView={isLinkShareView}
                                                isEmptyFile={isEmptyFile}
                                                backendErrorMsg={backendErrorMsg}
                                                getAnimationProps={getAnimationProps}
                                                handleDownloadClick={handleDownloadClick}
                                            />
                                        : fileToView ? // Leave separate so that loading may feel less slow to user
                                            <>                             
                                                <motion.span // Used beteween "loading" and "!contentLoaded".
                                                    className="spinner-after FileContent-spinner"
                                                    {...getAnimationProps(
                                                        // PDFs are delayed longer on purpose for setting contentLoaded to true (see comment in FileContent for why)
                                                        !contentLoaded && (showContentSpinner || fileToView.type === "application/pdf") 
                                                        ,
                                                        contentLoaded && vidIconToShow === "waiting" // This is not animateCondition, this is condition for spinner transition duration
                                                    )}
                                                    key="fileContentSpinnerKey"
                                                    aria-label="Finalizing loading"
                                                />                   
                                                <FileContent
                                                    innerRef={fileContentRef}
                                                    fileContentUrl={fileContentUrl}
                                                    setIsSrcError={setIsSrcError}
                                                    fileType={fileToView.type}
                                                    fileName={fileToView.name}
                                                    contentLoaded={contentLoaded}
                                                    setContentLoaded={setContentLoaded}
                                                    LIST_MAX_WIDTH={LIST_MAX_WIDTH}
                                                    getAnimationProps={getAnimationProps}
                                                />
                                            </>
                                        : <p>Error.</p>
                                        }
                                    </motion.div>
                                }
                            </AnimatePresence>

                            {(isVideoControlsVisible && !urlExpired && !isSrcError) && // Separate rendeer condition since controls appear later
                                <VideoControls 
                                    innerRef={fileContentRef as React.RefObject<HTMLVideoElement>}
                                    isFullscreen={isFullscreen}
                                    setIsFullscreen={setIsFullscreen}
                                />
                            }
                            <DynamicClip 
                                animation={renderVideoControls} 
                                numRects={1} 
                                clipPathId='VideoControlsClip'
                            />

                            { /* Don't add watermark here as it may be accidentally clicked by users */}
                        </div>
                    </FocusTrap>
                }

                <Backdrop // Don't need backdrop if link-share view
                    render={fileToView !== null && !isLinkShareView} 
                    className='file-viewer-backdrop'
                />
                
                <Backdrop 
                    render={isFullscreen} 
                    className="fullscreen-backdrop" 
                    animate={false}
                />
            </>
    )
}

export default memo(FileViewer);