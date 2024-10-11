import { memo } from 'react'
import "./UploadHeader.scss"
import { IoMdClose } from 'react-icons/io'
import { IoChevronDownSharp, IoChevronUpSharp } from 'react-icons/io5'
import { QueueFileType } from '../../../../types'

interface UploadHeaderProps {
    collapseUploadList: boolean
    setCollapseUploadList: React.Dispatch<React.SetStateAction<boolean>>

    successfulUploadNum: number
    uploadListFilesNum: number

    currentlyUploadingFile: QueueFileType|null
    onCloseClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
    fileErrors: Map<any, any>
}

function UploadHeader({ collapseUploadList, setCollapseUploadList, successfulUploadNum, uploadListFilesNum, fileErrors, currentlyUploadingFile, onCloseClick }: UploadHeaderProps) {
    return (
        <div className="UploadHeader" onClick={() => setCollapseUploadList(prevState => !prevState)}>
            <p>
                {successfulUploadNum < uploadListFilesNum && currentlyUploadingFile ?
                    `${successfulUploadNum} of ${uploadListFilesNum} ${uploadListFilesNum > 1 ? 'uploads' : 'upload'} complete`
                    : `${successfulUploadNum} ${successfulUploadNum > 1 || successfulUploadNum === 0 ? 'uploads' : 'upload'} complete ${fileErrors.size > 0 ? `(${fileErrors.size} failed)` : ''}`
                }
                
                {currentlyUploadingFile && collapseUploadList &&
                    <span className="spinner-after"></span>
                }
            </p>

            <div className="icons-cont">
                <button className="btn-icon-wrapper">
                    {!collapseUploadList ?
                        <IoChevronDownSharp className="btn-icon" />
                        : <IoChevronUpSharp className="btn-icon" />
                    }
                </button>
                {!currentlyUploadingFile && 
                    <button className="btn-icon-wrapper" onClick={onCloseClick}>
                        <IoMdClose className="btn-icon" />
                    </button>
                }
            </div>
        </div>
    )
}

export default memo(UploadHeader)