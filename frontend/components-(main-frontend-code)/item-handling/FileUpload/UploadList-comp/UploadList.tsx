import { useState, useEffect, useRef, memo } from 'react'
import "./UploadList.scss"
import { QueueFileType, FileType } from '../../../../types'
import { useFileContext } from '../../../../contexts/FileContext'
import ProgressBar from '../../../Other-COMPS/LoadingBar-COMPS/ProgressBar'
import LinkShareAndRevokeModals from '../../../Modal-COMPS/LinkShareAndRevokeModals-comp/LinkShareAndRevokeModals'
import { Link } from 'react-router-dom'
import { BsShare } from 'react-icons/bs'
import { MdOutlineReplay } from 'react-icons/md'
import { IoMdClose } from 'react-icons/io'
import ItemIconsCont from '../../../Other-COMPS/ItemIconsCont-comp/ItemIconsCont'
import mime from 'mime';
import { AiOutlineInfoCircle } from 'react-icons/ai'
import { useInterfaceContext } from '../../../../contexts/InterfaceContext'

interface UploadListProps {
    collapseUploadList: boolean

    currentUploadIndex: number
    currentFileProgress: number | null

    ERROR_LIST: { [key: string]: string }
    fileErrors: Map<any, any>
    nonRetryableErrors: string[]

    onRetryClick: () => void
    onCancelClick: (fileToRemove: QueueFileType) => void

    uploadQueue: QueueFileType[]
    pastQueuedFiles: QueueFileType[]

    showLinkShareModal: boolean
    setShowLinkShareModal: React.Dispatch<React.SetStateAction<boolean>>
}

function UploadList({ 
    collapseUploadList,

    currentUploadIndex,
    currentFileProgress, 

    ERROR_LIST, 
    fileErrors, 
    nonRetryableErrors, 

    onRetryClick,
    onCancelClick,
    
    uploadQueue, 
    pastQueuedFiles, 

    showLinkShareModal, 
    setShowLinkShareModal 
}: UploadListProps) {
    const { files } = useFileContext()
    const { setScrollTargetId } = useInterfaceContext()
    const uploadListRef = useRef<HTMLDivElement>(null)

    const [fileToGetLink, setFileToGetLink] = useState<FileType>()
    const [latestClickedCopyLinkBtnObject, setLatestClickedCopyLinkBtnObject] = useState<HTMLButtonElement | null>(null);
    const [isWideAsViewport, setIsWideAsViewport] = useState(false)
    const [viewportWidth, setViewportWidth] = useState(window.innerWidth)
    const [smoothProgress, setSmoothProgress] = useState(0)
    const [isFinalizing, setIsFinalizing] = useState(false)

    // Check sizing for reponsiveness
    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth
            setViewportWidth(newWidth)
            
            if (uploadListRef.current) {
                const rect = uploadListRef.current.getBoundingClientRect()
                const isTouchingBothSides = rect.left <= 1 && rect.right >= newWidth - 1
                setIsWideAsViewport(isTouchingBothSides)
            }
        }
        
        window.addEventListener('resize', handleResize)
        handleResize() // Call it initially to set the correct state
        
        return () => window.removeEventListener('resize', handleResize)
    }, [collapseUploadList]) // Dep so that closing and reopening doesnt cause issues

    const calculateMaxSteps = () => {
        const maxSteps = 43
        const minSteps = 1
        const decreaseStartWidth = 530
        const pixelsPerStep = 
            viewportWidth <= 426 ?
                9.5
            :   7
    
        if (viewportWidth >= decreaseStartWidth) {
            return maxSteps
        }
    
        const widthDifference = decreaseStartWidth - viewportWidth
        const stepsToReduce = Math.floor(widthDifference / pixelsPerStep)
        
        return Math.max(maxSteps - stepsToReduce, minSteps)
    }

    // Make the progress more smooth, so that it takes some milliseconds to go up instead of seeming possibly instant since currentFileProgress can be
    useEffect(() => {
        let animationFrameId: number
        let lastTimestamp: number
        let localSmoothProgress = smoothProgress
        const SPEED_FACTOR = 150 // Increase this value to speed up the smooth progress
    
        const animate = (timestamp: number) => {
            if (!lastTimestamp) lastTimestamp = timestamp
            const deltaTime = timestamp - lastTimestamp
    
            // If finalizing completes faster than smooth progress somehow, it's not an issue
            if (currentFileProgress !== null && currentFileProgress > 0) {
                localSmoothProgress = Math.min(localSmoothProgress + (deltaTime / 1000) * SPEED_FACTOR, currentFileProgress)
                setSmoothProgress(Number(localSmoothProgress.toFixed(2)))
    
                if (localSmoothProgress >= 100 && !isFinalizing) {
                    setIsFinalizing(true)
                }
            }
    
            lastTimestamp = timestamp
    
            // Leave as is.
            if (currentFileProgress && currentFileProgress <= 100 && !isFinalizing) {
                animationFrameId = requestAnimationFrame(animate)
            }
        }
    
        // Leave as is.
        if (currentFileProgress && currentFileProgress <= 100 && !isFinalizing) {
            animationFrameId = requestAnimationFrame(animate)
        }

        if (currentFileProgress === null || currentFileProgress === 0) {
            localSmoothProgress = 0
            setSmoothProgress(0)
            setIsFinalizing(false)
        }
    
        return () => {
            cancelAnimationFrame(animationFrameId)
        }
    }, [currentFileProgress, isFinalizing])
    
    // Render items differently in queue depending on status/other factors
    const renderFileDetails = (file: QueueFileType, index: number, isInPastQueue: boolean) => { 
        // The actual uploaded file item that should be in the files array in file context, unless it was deleted or something
        const correspondingFile = files.find((appFile) => appFile.id === file.id);
        
        const parentPath = correspondingFile?.appPath ?
            correspondingFile.appPath.substring(0, correspondingFile.appPath.lastIndexOf('/')) 
            : ''

        const parentFolderName = parentPath ? 
            parentPath.substring(parentPath.lastIndexOf('/') + 1) 
            : ''
        
        const error = fileErrors.get(file)
        const errorMsg = Object.values(ERROR_LIST).includes(error) ?
            error // "Error: " is added after
        : error ? 
            "Check connection or try again later."
        : null

        const onCopyLinkClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            if (!correspondingFile) return;
            setShowLinkShareModal(true);
            setFileToGetLink(correspondingFile);
            setLatestClickedCopyLinkBtnObject(event.currentTarget);
        }

        const possibleType = mime.getType(file.fileObj.name.split('.').pop() ?? "") ?? "" // This type is retrieved from the extension as not all queued files may have the MIME accessible, so this would be the most likely MIME

        const isCurrentlyUploading = !isInPastQueue && index === currentUploadIndex
        const isQueued = !isInPastQueue && index > currentUploadIndex
        const isNotRetryable = nonRetryableErrors.includes(errorMsg)
        // This would happen for files that are deleted by the user after being in pastQueuedFiles/successfully uploaded
        const isNotFound = !correspondingFile && (isInPastQueue || (index < currentUploadIndex && !fileErrors.has(file)))

        return (
            <div className={`file ${isNotFound ? 'not-found' : ''}`} key={index}>
                <ItemIconsCont // !isProcessing added so that if a user quickly decides to move the file again, the conflict icon goes away
                    itemType={correspondingFile?.type ?? possibleType}
                    itemName={correspondingFile?.name ?? file.fileObj.name}
                />
                <div className="file-info">
                    <div className="name">{file.fileObj.name}</div>
                    <div className="status">
                        {isCurrentlyUploading ? 
                            <ProgressBar
                                progress={smoothProgress} 
                                maxSteps={calculateMaxSteps()} 
                                ariaLabel="File upload progress"
                                showFinalizing={isFinalizing}
                            />

                            : isQueued ? 
                                "Queued"

                            // Use errorMsg instead of error as error may be undefined
                            : errorMsg && !isWideAsViewport ? 
                                'Error: ' + errorMsg
                            
                            : errorMsg ?
                                <>Error
                                    <span className='tooltip-and-msg-cont'>
                                        <AiOutlineInfoCircle className="error-info-icon"/>
                                        <span className='error-msg-tooltip'>{errorMsg}</span>
                                    </span>
                                </>

                            : isNotFound ? // NOTE: Don't need to worry about this causing problems with retry logic. This should only show up if the file is in pastQueuedFiles (even if there is "Parent folder not found." message)
                                "Deleted or not found."

                            : <>In <span className="link" data-test-id={`uploaded: ${file.fileObj.name}`}>
                                <Link to={(parentPath).replace(/[^\/]+/g, (match) => encodeURIComponent(match))} onClick={() => setScrollTargetId(file.id)}>{parentFolderName}</Link> {/* Based on parent path instead of the queue file's path so that this link updates when the user moves that file*/}
                                </span></>
                        }
                    </div>
                    
                </div>
                {((isCurrentlyUploading || isQueued) && !errorMsg) ?
                    <button
                        onClick={() => onCancelClick(file)}
                        disabled={index === currentUploadIndex && currentFileProgress === 100}
                    >
                        <IoMdClose className="icon cancel"/>
                    </button>

                    : isNotFound || isNotRetryable ? // Leave as null instead of allowing cancel click (isNotRetryable files will become isNotFound) - also for some reason it lead to issue if you cancelled isNotRetryable files if it was the only file in the list
                        null

                    : errorMsg && !isInPastQueue ?
                        <div className="btn-cont">
                            <button onClick={() => onCancelClick(file)}>
                                <IoMdClose className="icon cancel"/>
                            </button>

                            <button className="retry-btn" onClick={onRetryClick}>
                                <MdOutlineReplay className="icon retry"/>
                            </button>
                        </div>

                    : 
                        <button onClick={onCopyLinkClick} aria-haspopup="dialog">
                            <BsShare className="icon share"/>
                        </button>
                }
            </div>
        );
    };
    
    return ( 
        !collapseUploadList &&
            <>
                <div 
                    className={`UploadList ${isWideAsViewport ? 'is-wide-as-viewport' : ''}`}
                    ref={uploadListRef}
                >
                    {uploadQueue.map((file, index) => renderFileDetails(file, index, false))}
                    {pastQueuedFiles.map((file, index) => renderFileDetails(file, index, true))}
                </div>

                <LinkShareAndRevokeModals 
                    showLinkShareModal={showLinkShareModal} 
                    setShowLinkShareModal={setShowLinkShareModal} 
                    itemsToGetLinks={fileToGetLink ? [fileToGetLink] : []} 
                    triggerButtonObject={latestClickedCopyLinkBtnObject} 
                    appearAbove={true}
                />
            </>
    )
}

export default memo(UploadList)