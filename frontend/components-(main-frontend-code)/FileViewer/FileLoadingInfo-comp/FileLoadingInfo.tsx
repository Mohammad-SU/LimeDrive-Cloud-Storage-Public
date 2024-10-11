import { memo } from 'react'
import "./FileLoadingInfo.scss"
import { motion, MotionProps } from 'framer-motion'
import LoadingBar from '../../../Other-COMPS/LoadingBar-COMPS/LoadingBar'
import { AiOutlineDownload } from 'react-icons/ai'

interface FileLoadingInfoProps {
    loading: boolean
    retrievableButNotViewable: boolean | null
    notSupported: boolean
    urlExpired: boolean
    isLinkShareView: boolean
    isEmptyFile: boolean
    backendErrorMsg: string

    getAnimationProps: (animateCondition?: boolean, spinnerTransitionCondition?: boolean) => MotionProps
    handleDownloadClick: () => void
}

function FileLoadingInfo({ loading, retrievableButNotViewable, notSupported, urlExpired, isLinkShareView, isEmptyFile, backendErrorMsg, getAnimationProps, handleDownloadClick }: FileLoadingInfoProps) {
    return (
        <motion.div 
            className="FileLoadingInfo"
            {...getAnimationProps()} // Exit animation doesn't seem to work when loading condition changes to render the FileContent
            key="FileLoadingInfoKey"
        >
            {loading ?
                <>
                    <h1>Loading File...</h1>
                    <LoadingBar />
                </>
                : 
                <>
                    <h1 className="error-text" aria-atomic="true" role="alert" aria-live="assertive">
                        {notSupported ?
                            `Preview not supported for this file type.`
                        : urlExpired ? 
                            `Source expired. ${isLinkShareView ? "Refresh the page" : "Reopen the file"} to view again.`
                        : isEmptyFile ?
                            `Cannot preview empty files.`
                        : backendErrorMsg === "Invalid file access token." ? 
                            "Invalid link for file."
                        :
                            `Failed to load file. Check your connection ${isLinkShareView ? "and refresh the page" : ""} or try again later.`
                        }
                    </h1>
                    {retrievableButNotViewable && !urlExpired && // Don't show this button if urlExpired
                        <button className="large-download-btn" onClick={handleDownloadClick}>
                            Click to download
                            <AiOutlineDownload className="btn-icon download-icon"/>
                        </button>
                    }
                </>
            }
        </motion.div>
    )
}

export default memo(FileLoadingInfo)