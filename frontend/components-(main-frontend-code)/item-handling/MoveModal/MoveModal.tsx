import "./MoveModal.scss"
import React, { memo, useState, useEffect } from 'react'
import { useFileContext } from '../../../../contexts/FileContext'
import Modal from '../../../Modal-COMPS/Modal'
import { useToast } from "../../../../contexts/ToastContext"
import { FolderType } from "../../../../types"
import Breadcrumb from "../../../Other-COMPS/Breadcrumb-comp/Breadcrumb"
import { useUserContext } from "../../../../contexts/UserContext"
import { PiFolderOpenLight } from "react-icons/pi"
import useToggleOnKey from "../../../../hooks/useToggleOnKey"

interface MoveModalProps {
    toolbarRendered: boolean
    showMoveModal: boolean // Include as prop so animation works properly
    setShowMoveModal: React.Dispatch<React.SetStateAction<boolean>>
}

function MoveBtn({ toolbarRendered, showMoveModal, setShowMoveModal }: MoveModalProps) {
    const { folders, currentPath, selectedItems, filterItemsByPath, handleMoveItems } = useFileContext()
    const { showToast } = useToast()
    const { api } = useUserContext()
    const [moveListPath, setMoveListPath] = useState(currentPath)
    const [moveListFolders, setMoveListFolders] = useState<FolderType[]>([]);
    const [targetFolder, setTargetFolder] = useState<FolderType | undefined>(undefined)
    const [modalTitle, setModalTitle] = useState("")
    const disabled = (!targetFolder && moveListPath !== "LimeDrive/") || selectedItems.some(selectedItem => selectedItem.appPath === moveListPath + selectedItem.name) || selectedItems.length === 0

    const hasSubfolders = (folderPath: string) => {
        return folders.some((folder) => {
            return folder.appPath.startsWith(folderPath + '/');
        });
    };

    useEffect(() => {
        if (hasSubfolders(currentPath.slice(0, -1))) {
            setMoveListPath(currentPath);
        } else { // If current folder doesnt have subfolders, then setMoveListPath to parent path to prevent empty list that wouldn't benefit the user. DO NOT do this if there is even one empty subfolder however.
            const currentFolder = folders.find((folder) => folder.appPath === currentPath.slice(0, -1))
            if (!currentFolder) return
            const lastIndex = currentPath.lastIndexOf(currentFolder.name);
            const newPath = currentPath.slice(0, lastIndex) + currentPath.slice(lastIndex).replace(currentFolder.name + '/', '');
            setMoveListPath(newPath);
        }
    }, [currentPath, showMoveModal]); // include showMoveModal in deps so it resets move modal - otherwise, since this value is a prop it wouldn't reset when Modal element is unrendered due to it

    useEffect(() => {
        let newTargetFolder = { ...targetFolder } as FolderType | undefined;
        if (moveListPath.slice(0, -1) !== newTargetFolder?.appPath) { // For resetting targetFolder when modal is closed and then reopened and making sure there's no subfolder issues
            newTargetFolder = folders.find((folder) => folder.appPath === moveListPath.slice(0, -1));
            setTargetFolder(newTargetFolder);
        }
        if (!newTargetFolder || hasSubfolders(newTargetFolder.appPath)) { // Render subfolders
            setMoveListFolders(
                filterItemsByPath(folders, moveListPath).sort((a, b) => a.name.localeCompare(b.name)) as FolderType[] // Sort A-Z
            ) 
        }
    }, [folders, moveListPath]);

    useEffect(() => {
        if(selectedItems.length === 0) return // To prevent title changing during closing. If length changes to more than 0 after move click, this should still be fine as the modal should be open at that point since it should only happen if a move conlfict was detected
        setModalTitle(`Move ${selectedItems.length} ${selectedItems.length > 1 ? 'items' : 'item'} to...`)
    }, [selectedItems]);

    const handleFolderClick = (folder: FolderType) => {
        const prevTarget = targetFolder
        if (prevTarget && !hasSubfolders(prevTarget.appPath)) { // If prevTarget didn't have subfolders then the end of the breadcrumb should be REPLACED with the new target's name for correct rendering of folders under that path, and to prevent unnecessary stacking in the breadcrumb
            const lastOccurrenceIndex = moveListPath.lastIndexOf(prevTarget.name);
            setMoveListPath(moveListPath.slice(0, lastOccurrenceIndex) + folder.name + "/");
        } else { // Otherwise ADD target folder's name to the end of the breadcrumb
            setMoveListPath(moveListPath + folder.name + "/")
        }

        if (!selectedItems.some(selectedItem => selectedItem.id === folder.id)) { // If the user clicks on a folder that is NOT part of the folders that they selected for moving
            setTargetFolder(folder)
        }
    }

    const handleModalMoveClick = () => {
        if (disabled) {
            return // In case user removes disabled attribute from modal move btn (backend checks are still included)
        } // The below condition only includes selectedItems.length === 1 and checks only [0] so that non-conflicting items are still sent in response if more than one selected for moving. There is still a frontend check for multiple selected items mixed with a same-folder conflict in handleMoveItems.
        else if (selectedItems.length === 1 && moveListPath.startsWith(selectedItems[0].appPath)) {
            return showToast({message: `Cannot move folder inside itself.`, showFailIcon: true});
        }

        const movingToRoot = moveListPath === "LimeDrive/"
        if (movingToRoot) {
            const rootTargetFolder = {
                id: null,
                name: 'LimeDrive',
                appPath: 'LimeDrive',
                created_at: new Date(),
            }
            handleMoveItems(selectedItems, rootTargetFolder as FolderType & { id: null }, api)
        } else {
            handleMoveItems(selectedItems, targetFolder!, api)
        }

        setShowMoveModal(false)
    }

    return (
        <Modal 
            className="MoveModal"
            render={showMoveModal && toolbarRendered} // toolbarRendered condition so if items unselected it will also use the animation
            onCloseClick={() => setShowMoveModal(false)}
        >
            <h1 id="modal-title">{modalTitle}</h1>
            <Breadcrumb path={moveListPath} setPath={setMoveListPath} btnType={true}/>
            <div className="move-list">
                {moveListFolders.map((folder, index) => (
                    <div // Don't wrap in button - not necessary just to avoid accidental text selection
                        className={`folder
                            ${selectedItems.some(selectedItem => selectedItem.id === folder.id) ? 'selected-for-moving' : ''}
                            ${folder.id === targetFolder?.id ? 'move-selected' : ''}
                        `}
                        key={index} 
                        onClick={() => handleFolderClick(folder)}
                        onKeyDown={useToggleOnKey(() => handleFolderClick(folder))}
                        role="listitem"
                    >
                        <PiFolderOpenLight className="folder-icon" />
                        <span 
                            className="text-cont" 
                            tabIndex={0}
                        >
                            {folder.name}
                        </span>
                        {hasSubfolders(folder.appPath) && 
                            <span className="subfolders-indicator">&gt;</span>
                        }
                    </div>
                ))}
            </div>

            <div className="modal-btn-cont">
                <button className='modal-cancel-btn' onClick={() => setShowMoveModal(false)}>
                    Cancel
                </button>
                <button 
                    className='modal-primary-btn'
                    onClick={handleModalMoveClick}
                    disabled={disabled}
                >
                    Move
                </button>
            </div>
        </Modal>
    )
}

export default memo(MoveBtn)