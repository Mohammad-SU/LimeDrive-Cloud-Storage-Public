import { useRef, useState, memo } from 'react';
import "./CreateFolderModal.scss"
import Modal from '../../Modal-COMPS/Modal.tsx';
import { PiFolderOpenLight } from "react-icons/pi";
import { useFileContext } from '../../../contexts/FileContext.tsx';
import { useUserContext } from '../../../contexts/UserContext.tsx';
import { useFormLogic } from "../../../hooks/useFormLogic.ts";
import { useToast } from '../../../contexts/ToastContext.tsx';
import axios from 'axios';
import { constants } from '../../../data/globalConstants.ts';
import { useInterfaceContext } from '../../../contexts/InterfaceContext.tsx';

interface CreateFolderModalProps {
    showNewFolderModal: boolean
    setShowNewFolderModal: React.Dispatch<React.SetStateAction<boolean>>
}

function CreateFolderModal({ showNewFolderModal, setShowNewFolderModal }: CreateFolderModalProps) {
    const { currentPath, folders, addFolders, doesPathExceedLimit } = useFileContext();
    const { setScrollTargetId } = useInterfaceContext()
    const { api } = useUserContext()
    const { showToast } = useToast();
    const [creationCooldown, setCreationCooldown] = useState<boolean>(false)

    const folderNameInputRef = useRef<HTMLInputElement | null>(null);

    const { formData, handleInputChange } = useFormLogic({
        newFolderName: '',
    });

    const MAX_FOLDER_NUM = constants.MAX_USER_FOLDER_NUM

    const trimmedNewFolderName = formData.newFolderName.trim()

    const isFolderNameValid = 
        trimmedNewFolderName.length === 0 
        || trimmedNewFolderName.length > 255
        || !constants.INVALID_ITEM_NAME_CHARS.split('').some(char => trimmedNewFolderName.includes(char));
    
    const isConflictingName = 
        folders.some((folder) => folder.appPath === currentPath + folder.name && folder.name === trimmedNewFolderName);
    
    const isPathLimitExceededByName = 
        doesPathExceedLimit(currentPath + trimmedNewFolderName) 
        && trimmedNewFolderName !== ""

    const isMaxFolderNumReached = folders.length >= MAX_FOLDER_NUM

    const disabledConditions = trimmedNewFolderName === '' || !isFolderNameValid || isConflictingName || creationCooldown || isPathLimitExceededByName || isMaxFolderNumReached

    const handleCreateFolder = async () => {
        if (disabledConditions) {
            return;
        }

        try {
            showToast({message: "Creating folder...", loading: true});
            setShowNewFolderModal(false);
            setCreationCooldown(true);
            setTimeout(() => {
                setCreationCooldown(false);
            }, 350);

            const newCurrentPath = currentPath;
            const parentFolder = folders.find((folder) => folder.appPath === currentPath.slice(0, -1));

            const response = await api.post('/createFolder', {
                name: trimmedNewFolderName,
                parentFolderId: parentFolder ? parseInt(parentFolder.id.substring(2)) : null // null represents root directory id, aka "LimeDrive/"
            });

            addFolders(response.data[0]);
            showToast({message: "Folder created successfully.", showSuccessIcon: true});
            
            if (newCurrentPath === currentPath) {
                setScrollTargetId(response.data[0].id);
            }
        } catch (error) {
            console.error(error);
            if (axios.isAxiosError(error)) {
                const errorMessage = error?.response?.data.message;

                errorMessage === constants.DUPLICATE_NAME_ERR_MSG ?
                    showToast({message: "Failed to create folder: Folder name already exists in destination.", showFailIcon: true})
                : errorMessage === constants.MAX_ITEM_NUM_ERR_MSG ?
                    showToast({message: `Max number of folders (${MAX_FOLDER_NUM}) reached`, showFailIcon: true})
                : showToast({message: "Failed to create folder: Please check your connection or try again later.", showFailIcon: true})
            }
        }
    };

    return (
        <Modal
            className="CreateFolderModal"
            onSubmit={() => handleCreateFolder()}
            render={showNewFolderModal}
            onCloseClick={() => setShowNewFolderModal(false)}
            closeBtnTabIndex={creationCooldown && trimmedNewFolderName !== '' ? 0 : -1}
            onVisible={() => folderNameInputRef.current?.focus()}
            onExit={() => {
                formData.newFolderName = ''
            }}
        >
            <h1 id="modal-title">
                <PiFolderOpenLight className="modal-icon" /> 
                Create folder
            </h1>
            
            <div className="input-cont">
                <label htmlFor="folder-name-input">Name</label>
                <input
                    type="text"
                    id="folder-name-input"
                    placeholder="Folder name"
                    name="newFolderName"
                    value={formData.newFolderName}
                    onChange={(e) => handleInputChange(e, 255)}
                    maxLength={255}
                    spellCheck="false"
                    ref={folderNameInputRef}
                    required
                    disabled={creationCooldown}
                    aria-label="Input new folder name"
                />
                <p className="error" aria-atomic="true" role="alert" aria-live="assertive"> {/* Don't add backendErrorMessage check here as toast already would tell user */}
                    {!isFolderNameValid && trimmedNewFolderName !== '' ?
                        "Cannot contain: < > \\ / : ? * \" |"
                    : isConflictingName ?
                        "Name conflicts with an existing folder in this path."
                    : isPathLimitExceededByName ?
                        "Name exceeds path character limit."
                    : isMaxFolderNumReached ?
                        `Max number of folders (${MAX_FOLDER_NUM}) reached.`
                    : null
                    }
                </p>
            </div>

            <div className="modal-btn-cont">
                <button className='modal-cancel-btn' type="button" onClick={() => setShowNewFolderModal(false)} disabled={creationCooldown && trimmedNewFolderName !== ''}>
                    Cancel
                </button>
                <button 
                    className='modal-primary-btn'
                    type="submit"
                    disabled={disabledConditions}
                >
                    Create
                </button>
            </div>
        </Modal>
    );
}

export default memo(CreateFolderModal);