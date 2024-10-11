
import { memo, useMemo } from 'react'
import './ItemIconsCont.scss'
import { IconContext } from "react-icons";
import { AiOutlineExclamation } from 'react-icons/ai';
import { PiFolderOpenLight } from "react-icons/pi";
import { BsFileEarmark, BsFileEarmarkZip, BsFileEarmarkText, BsCodeSquare } from 'react-icons/bs';
import { SlPicture } from "react-icons/sl";
import { GoVideo } from "react-icons/go";
import { PiWaveform } from "react-icons/pi";
import { programmingFileTypes } from '../../../data/programmingFileTypes';

interface ItemIconsContProps {
    itemType?: string
    itemName?: string;
    isConflicting?: boolean
    isOwnFolderConflict?: boolean
    isPathTooLongConflict?: boolean
}

function ItemIconsCont({ itemType = "LimeDriveFolderType", itemName, isConflicting = false, isOwnFolderConflict = false, isPathTooLongConflict = false }: ItemIconsContProps) {    
    const isNotCommonType = useMemo(() => {
        return itemType !== "LimeDriveFolderType" &&
            !itemType.startsWith("video/") &&
            !itemType.startsWith("audio/") &&
            !itemType.startsWith("image/") &&
            itemType !== "application/pdf";
    }, [itemType]);

    const isZipType = useMemo(() => {
        return isNotCommonType &&
            ["application/zip", "application/x-zip", "application/x-zip-compressed", "multipart/x-zip"].includes(itemType);
    }, [itemType]);
    
    const isProgrammingType = useMemo(() => {
        return isNotCommonType && !isZipType && programmingFileTypes.includes(itemType);
    }, [itemType]);

    const extension = useMemo(() => {
        if (isNotCommonType && !isZipType && !isProgrammingType && itemName) {
            return itemName.split('.').pop();
        }
    }, [itemType, itemName]); // Don't need extra deps like isProgrammingType since they already have itemType as dep

    return (
        <span className="ItemIconsCont">
            <IconContext.Provider value={{ className: "main-icon" }}>
                {itemType === "LimeDriveFolderType" ?
                    <PiFolderOpenLight className="main-icon folder-icon" />

                : itemType.startsWith("video/") ?
                    <GoVideo className="video-icon" />

                : itemType.startsWith("audio/") ?
                    <PiWaveform className="audio-icon"/>

                : itemType.startsWith("image/") ?
                    <SlPicture className="image-icon" />

                : itemType === "application/pdf" ? // Leave here as this checks type even though extension check is later
                    <>
                        <BsFileEarmark className="clipped-icon file-earmark-icon"/> {/* Don't use acrobat icon due to possible guideline issues */}
                        <span className="file-icon-text">PDF</span>
                    </>

                : isZipType ?
                    <BsFileEarmarkZip className="file-earmark-icon"/> // for RAR types don't use zip icon - it's too much

                : isProgrammingType ? // Leave before text/ as programming types may include text/
                    <BsCodeSquare className="code-icon" />

                : itemType.startsWith("text/") ?
                    <BsFileEarmarkText className="file-earmark-icon"/>

                // Don't do 5 or more length due to space. This is not as accurate to what the file type actually is 
                // since it checks extension rather than type, but is better than just showing an empty file icon
                : extension && extension.length < 5 ? 
                    <>
                        <BsFileEarmark className="clipped-icon file-earmark-icon"/>
                        <span className={`file-icon-text ${extension.length === 4 ? 'four-chars' : ''}`}> {/* For some reason adding number to classname led to issue */}
                            {extension.toUpperCase()}
                        </span>
                    </>

                : <BsFileEarmark className="file-earmark-icon"/>
                }
            </IconContext.Provider>

            {isConflicting &&
                <>
                    <AiOutlineExclamation className="conflict-icon"/>
                    <span className="tooltip">
                        {itemType === "LimeDriveFolderType" && isOwnFolderConflict ? 
                            <>cannot put<br />folder inside itself</>

                        : isPathTooLongConflict ? 
                            <>Cannot move: new path<br />would exceed limit</>

                        : itemType === "LimeDriveFolderType"? 
                            <>Cannot move: conflicting folder<br />name in target folder</>
                            
                        : <>Cannot move: conflicting file<br />name in target folder</>
                        }
                    </span>
                </>
            }
        </span>
    )
}

export default memo(ItemIconsCont)