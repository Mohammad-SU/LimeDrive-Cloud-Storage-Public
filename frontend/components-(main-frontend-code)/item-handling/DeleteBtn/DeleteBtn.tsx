import "./DeleteBtn.scss"
import { memo, useState, useEffect } from 'react'
import { useFileContext } from '../../../../contexts/FileContext'
import Modal from '../../../Modal-COMPS/Modal'
import { useToast } from "../../../../contexts/ToastContext"
import { SlTrash } from 'react-icons/sl'
import { IoWarningSharp } from "react-icons/io5";
import { useUserContext } from "../../../../contexts/UserContext"

function DeleteBtn({ toolbarRendered }: { toolbarRendered: boolean }) {
    const { selectedItems, processingItems, addToProcessingItems, removeFromProcessingItems, removeFromSelectedItems, setFolders, setFiles, setAccountStorageUsed } = useFileContext()
    const { showToast } = useToast()
    const { api } = useUserContext()
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [modalHeadingType, setModalHeadingType] = useState('0 Items') // text type states due to exit animation
    const [modalContentType, setModalContentType] = useState('0 items')

    const handleToolbarDeleteClick = () => {
        if (selectedItems.length === 0) return
        setShowDeleteModal(true)
        setModalHeadingType(
            selectedItems.length === 1 && selectedItems[0].type === undefined ? "Folder"
            : selectedItems.length === 1 ? "File"
            : `${selectedItems.length} Items`
        )
        setModalContentType(
            selectedItems.length === 1 ?
                `"${selectedItems[0].name}"`
            : `${selectedItems.length} items`
        )
    }

    const handleModalDeleteClick = async () => {
        const newSelectedItems = selectedItems.slice();

        if (newSelectedItems.length === 0) {
            return showToast({message: `Cannot delete: no selected items.`, showFailIcon: true});
        } else if (newSelectedItems.some(selectedItem => processingItems.some(processingItem => processingItem.id === selectedItem.id))) {
            return showToast({message: `Cannot delete: one or more selected items are currently being processed.`, showFailIcon: true});
        }

        try {
            addToProcessingItems(newSelectedItems)
            removeFromSelectedItems(newSelectedItems)
            setShowDeleteModal(false);
            const textType = newSelectedItems.length === 1 ? (newSelectedItems[0].type === undefined ? 'folder' : 'file') : `${newSelectedItems.length} items`;
            showToast({message: `Deleting ${textType}...`, loading: true});

            const response = await api.delete('/deleteItems', { // folder ID d_ prefix is dealt with on the backend for this route
                data: {itemIds: newSelectedItems.map(item => item.id)}
            });

            setFiles(existingFiles => {
                return existingFiles.filter(existingFile => {
                    return !response.data.deletedFileIds.some((deletedFileId: number) => deletedFileId === existingFile.id);
                });
            });
            setFolders(existingFolders => {
                return existingFolders.filter(existingFolder => {
                    return !response.data.deletedFolderIds.some((deletedFolderId: number) => "d_" + deletedFolderId === existingFolder.id);
                });
            });

            setAccountStorageUsed(response.data.accountStorageUsed)

            showToast({message: `${textType.charAt(0).toUpperCase() + textType.slice(1)} deleted successfully.`, showSuccessIcon: true})
        } 
        catch (error) {
            console.error(error);
            showToast({message: "Failed to delete: Please check your connection or try again later.", showFailIcon: true})
        }
        finally {
            removeFromProcessingItems(newSelectedItems)
        }
    }

    return (
        <>
            <button 
                className="DeleteBtn" 
                onClick={handleToolbarDeleteClick}
                aria-haspopup="dialog"
            >
                <SlTrash className="tool-icon trash-icon"/>
                <p>Delete</p>
            </button>

            <Modal
                className="delete-modal"
                render={showDeleteModal && toolbarRendered}
                onCloseClick={() => setShowDeleteModal(false)}
                closeBtnTabIndex={selectedItems.length === 0 ? 0 : -1}
                onExit={() => {setModalHeadingType("0 Items"), setModalContentType("0 items")}}
            >
                <h1 id="modal-title">
                    Delete {modalHeadingType}?
                </h1>

                <div className="main-content" id="modal-description">
                    <IoWarningSharp className="warning-icon"/>
                    <p>
                        Are you sure you want to delete <span className='content-type'>{modalContentType}</span> <strong>permanently</strong>?
                    </p>
                    <p>(Recycle bin not yet featured)</p>
                </div>

                <div className="modal-btn-cont">
                    <button className='modal-cancel-btn' onClick={() => setShowDeleteModal(false)}>
                        Cancel
                    </button>
                    <button 
                        className='modal-primary-btn'
                        onClick={handleModalDeleteClick}
                        disabled={selectedItems.length === 0}
                    >
                        Delete
                    </button>
                </div>
            </Modal>
        </>
    )
}

export default memo(DeleteBtn)