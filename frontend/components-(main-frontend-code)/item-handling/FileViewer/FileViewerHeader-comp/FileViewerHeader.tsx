import { memo, useState, useRef, useEffect } from 'react'
import "./FileViewerHeader.scss"
import { AiOutlineClose, AiOutlineComment, AiOutlinePrinter, AiOutlineDownload } from 'react-icons/ai';
import { BsThreeDotsVertical, BsShare, BsChevronDown, BsBoxArrowUpRight } from 'react-icons/bs';
import DynamicClip from '../../../Other-COMPS/DynamicClip';
import LinkShareAndRevokeModals from '../../../Modal-COMPS/LinkShareAndRevokeModals-comp/LinkShareAndRevokeModals';
import { useToast } from '../../../../contexts/ToastContext';
import { useInterfaceContext } from '../../../../contexts/InterfaceContext';
import { FileType, PartialFileType } from '../../../../types';
import { useReactToPrint } from 'react-to-print';
import { isFileTypeSupported } from '../../../../data/supportedFileTypes';
import useUnfocusPopup from '../../../../hooks/useUnfocusPopup';
import useDelayedExit from '../../../../hooks/useDelayedExit';
import useToggleOnKey from '../../../../hooks/useToggleOnKey';
import { AnimatePresence, motion, MotionProps } from 'framer-motion';

interface FileViewerHeaderProps {
    fileToView: FileType | PartialFileType | null
    contentLoaded: boolean
    loading: boolean
    validFileAccessToken: string | null
    isLinkShareView: boolean

    contentFailConditions: string | boolean
    linkShareFailConditions: string | boolean
    retrievableButNotViewable: boolean | null

    fileViewerHeaderRef: React.RefObject<HTMLDivElement>
    fileContentRef: React.RefObject<HTMLElement | null>

    renderViewer: boolean
    handleCloseViewer: () => void
    handleDownloadClick: () => void

    getAnimationProps: (animateCondition?: boolean, spinnerTransitionCondition?: boolean) => MotionProps
    VIEWPORT_WIDTH_1024_BREAK: boolean
}

function FileViewerHeader({ fileToView, contentLoaded, loading, validFileAccessToken, isLinkShareView, contentFailConditions, linkShareFailConditions, retrievableButNotViewable, fileViewerHeaderRef, fileContentRef, renderViewer, handleCloseViewer, handleDownloadClick, getAnimationProps, VIEWPORT_WIDTH_1024_BREAK }: FileViewerHeaderProps) {
    const { showToast } = useToast()

    const [fileToViewName, setFileViewToViewName] = useState('')
    const [showMoreDropdown, setShowMoreDropdown] = useState(false)
    const [showLinkShareModal, setShowLinkShareModal] = useState(false)

    const MAX_PRINTABLE_SIZE_MB = 2 * 1024 * 1024;

    const moreDropdownRef = useRef<HTMLDivElement>(null)
    const shareBtnRef = useRef<HTMLButtonElement>(null)

    const { isVisible: isMoreDropdownVisible } = useDelayedExit({
        shouldRender: showMoreDropdown,
    });
    useUnfocusPopup(moreDropdownRef, () => {
        setShowMoreDropdown(false);
    });

    useEffect(() => {
        if (!fileToView) return
        // This is here for exit animation so that the name doesn't dissappear instantly
        setFileViewToViewName(fileToView?.name ?? '')
    }, [fileToView])

    const loadPrint = useReactToPrint({ // Error in console may occur from react dev tools (Attempting to use a disconnected port object)
        content: () => fileContentRef.current,
    });

    const handlePrintClick = () => {
        (!fileToView || (fileToView && !contentLoaded)) && !contentFailConditions ? // Print requires element to actually be rendered to the page
            showToast({message: "Please wait for file before printing.", showFailIcon: true})
        : linkShareFailConditions ? // Print requires element to actually be rendered to the page so it must also be viewable, not just retrievable
            showToast({message: "Cannot print if file is not viewable or invalid link.", showFailIcon: true})
        : fileToView && !isFileTypeSupported(fileToView.type) ?
            showToast({message: "Printing not yet supported by LimeDrive for this file type.", showFailIcon: true})
        : fileToView && fileToView.type === "application/pdf" ?
            showToast({message: "Please use the print button in the PDF viewer instead.", showFailIcon: true})
        : contentFailConditions ? // Print requires element to actually be rendered to the page so it must also be viewable, not just retrievable
            showToast({message: "Cannot print if file is not loaded.", showFailIcon: true})
        // Large text files that aren't html may make UI unresponsive, even if they would work eventually.
        // Users should use better-suited programs for handling such printing
        : fileToView?.type.startsWith("text/") && fileToView?.type !== "text/html" && fileToView.size > MAX_PRINTABLE_SIZE_MB ?
            showToast({message: `Cannot print ${fileToView?.type} files that are larger than ${MAX_PRINTABLE_SIZE_MB / (1024 * 1024)} MB.`, showFailIcon: true})
        : loadPrint()
    }

    const handleShareClick = () => {
        fileToView || (isLinkShareView && !linkShareFailConditions && !loading) ?
            setShowLinkShareModal(true)
         : loading && isLinkShareView ?
            showToast({message: "Please wait for file before getting shareable link.", showFailIcon: true})
         : linkShareFailConditions ? // It may be unknown if the location pathname has the correct token if the file has not loaded for reasons other than notSupported
            showToast({message: "Cannot get shareable link if invalid link.", showFailIcon: true})
         : showToast({message: "Cannot get shareable link.", showFailIcon: true})
    }

    const MoreToolsButtons = ({ isDropdown = false }: { isDropdown?: boolean }) => {
        const btnIconWrapperClass = isDropdown ? '' : 'btn-icon-wrapper'
        const btnIconClass = isDropdown ? '' : 'btn-icon'
    
        return (
            <>
                {isDropdown &&
                    <button className="open-with-btn" onClick={() => showToast({message: "Opening/connecting with 3rd party apps not yet featured."})}>
                        <BsBoxArrowUpRight className='open-with-icon tool-icon'/>
                        Open with
                    </button>
                }
                <button 
                    className={`comment-btn ${btnIconWrapperClass}`} 
                    onClick={() => showToast({message: "Commenting from viewer not yet featured."})} 
                    aria-label="Comment"
                >
                    <AiOutlineComment className={`comment-icon tool-icon ${btnIconClass}`}/>
                    {isDropdown && 'Comment'}
                </button>
                <button 
                    className={`print-btn ${btnIconWrapperClass}`} 
                    onClick={handlePrintClick} 
                    aria-label="Print"
                >
                    <AiOutlinePrinter className={`printer-icon tool-icon ${btnIconClass}`}/>
                    {isDropdown && 'Print'}
                </button>
                <button 
                    className={`download-btn ${btnIconWrapperClass}`} 
                    onClick={handleDownloadClick} 
                    aria-label="Download"
                >
                    <AiOutlineDownload className={`download-icon tool-icon ${btnIconClass}`}/>
                    {isDropdown && 'Download'}
                </button>
            </>
        )
    }

    const renderViewerHeader = () => (
        <motion.div 
            className="FileViewerHeader" 
            ref={fileViewerHeaderRef} 
            role="banner"
            {...(VIEWPORT_WIDTH_1024_BREAK ? getAnimationProps() : {})}
            key='fileViewerHeaderKey'
        >
            <div className="file-name-cont">
                <button className="btn-icon-wrapper close-btn" onClick={handleCloseViewer} aria-label="Close file viewer">
                    <AiOutlineClose className="btn-icon" />
                </button>
                <h1 title={fileToView ? fileToViewName : undefined}>
                    {isLinkShareView && !fileToView && !contentFailConditions ? 
                        "Loading..." 
                    : linkShareFailConditions && !retrievableButNotViewable ?
                        "Error"
                    : fileToViewName
                    }
                </h1>
                <DynamicClip clipPathId='fileViewerNameContClip' animation={renderViewer} numRects={1} />
            </div>

            <button className="open-with-btn-wide-screen" onClick={() => showToast({message: "Opening/connecting with 3rd party apps not yet featured."})}>
                Open with
                <BsChevronDown className='chevron'/>
            </button>
            <DynamicClip clipPathId='fileViewerNormalBtnClip' animation={renderViewer} numRects={4} />

            {/* For link-share view, if the buttons require fileToView, then leave the requirement instead of getting the file id from the location.pathname as it may be invalid/permissions revoked */}
            <div className="file-viewer-toolbar" role="toolbar">
                {MoreToolsButtons({isDropdown: false})}
                <button className={`share-btn ${VIEWPORT_WIDTH_1024_BREAK ? 'btn-icon-wrapper' : ''}`} onClick={handleShareClick} ref={shareBtnRef}>
                    <BsShare className={`share-icon ${VIEWPORT_WIDTH_1024_BREAK ? 'btn-icon' : ''}`}/>
                    <span className='share-txt'>Share</span>
                </button>
                <div className='more-cont'>
                    <button 
                    className="btn-icon-wrapper more-btn" 
                        onMouseDown={() => setShowMoreDropdown(current => !current)}
                        onKeyDown={useToggleOnKey(() => setShowMoreDropdown(current => !current))}
                        aria-label="More viewer tools"
                    >
                        <BsThreeDotsVertical className="btn-icon vertical-dots-icon"/>
                    </button>
                    {isMoreDropdownVisible && 
                        <div className='more-tools-dropdown' ref={moreDropdownRef}>
                            {MoreToolsButtons({isDropdown: true})}
                        </div>
                    }
                    <DynamicClip clipPathId="FileViewerMoreToolsDropdownClip" animation={showMoreDropdown} numRects={6}/>
                </div>
            </div>
        </motion.div>
    )


    return (
        <>
            {VIEWPORT_WIDTH_1024_BREAK ? // Because the file viewer header looks more prominent at this breakpoint, so has fade out but shouldn't interfere with DynamicClip before the breakpoint
                <AnimatePresence>
                    {renderViewer &&
                        renderViewerHeader()
                    }
                </AnimatePresence>
                : 
                <> {/* Leave fragment */}
                    {renderViewerHeader()}
                </>
            }

            {/* Leave modal here so that it is stacked properly above the rest of the viewer. Also, for link-share view this may show an incorrect value if the link is valid but then becomes invalid between the time the file is loaded and the user clicks share, but this scenario is not too likely so it may not be worth sending a backend request */}
            <LinkShareAndRevokeModals 
                showLinkShareModal={showLinkShareModal} 
                setShowLinkShareModal={setShowLinkShareModal} 
                itemsToGetLinks={fileToView ? [fileToView] : []} 
                instantLink={validFileAccessToken} 
                hideRevoke={isLinkShareView ? true : false} 
                triggerButtonObject={shareBtnRef.current} 
            />
        </>
    )
}

export default memo(FileViewerHeader)