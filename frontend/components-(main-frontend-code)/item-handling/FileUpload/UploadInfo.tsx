import { useState, useRef, useEffect, memo } from 'react'
import "../../../global.scss"
import "./UploadInfo.scss"
import axios, { CancelTokenSource } from 'axios';
import { useUserContext } from '../../../contexts/UserContext.tsx'
import { useFileContext } from '../../../contexts/FileContext.tsx';
import useDelayedExit from '../../../hooks/useDelayedExit.ts';
import { FileType, QueueFileType } from '../../../types';
import UploadHeader from './UploadHeader-comp/UploadHeader.tsx';
import DynamicClip from '../../Other-COMPS/DynamicClip.tsx';
import UploadList from './UploadList-comp/UploadList.tsx';
import { constants } from '../../../data/globalConstants.ts';
import mime from 'mime';
import { parseBlob } from 'music-metadata';

function UploadInfo({ fileInputRef }: { fileInputRef: React.RefObject<HTMLInputElement> }) {
    const [showUploadInfo, setShowUploadInfo] = useState(true)
    const [uploadListFilesNum, setUploadListFilesNum] = useState<number>(0) // Number of files in the list in total, including both current and successful uploads

    const { isVisible: isUploadInfoVisible } = useDelayedExit({
        shouldRender: uploadListFilesNum > 0 && showUploadInfo,
        delayMs: 200,
    });

    const { currentPath, files, folders, addFiles, setAccountStorageUsed, accountStorageUsed, accountStorageCap, doesPathExceedLimit } = useFileContext()
    
    const [fileErrors, setFileErrors] = useState(new Map());
    const [currentlyUploadingFile, setCurrentlyUploadingFile] = useState<QueueFileType | null>(null);
    const [pastQueuedFiles, setPastQueuedFiles] = useState<QueueFileType[]>([]); // Files in the list that have been successfully uploaded and will not be sent again
    const [uploadQueue, setUploadQueue] = useState<QueueFileType[]>([]); // Files in the list to be sent to backend
    const [currentUploadIndex, setCurrentUploadIndex] = useState<number>(-1); // Current file to be uploaded in uploadQueue (negative means no files in uploadQueue)
    const [successfulUploadNum, setSuccessfulUploadNum] = useState<number>(0);
    const [currentFileProgress, setCurrentFileProgress] = useState<number | null>(0);
    const cancelTokenSource = useRef<CancelTokenSource | null>(null);

    const MAX_FILE_NUM = constants.MAX_USER_FILE_NUM

    const ERROR_LIST = { // Reduce chance of bugs due to mismatching strings. All fit in the UI without overflow
        parentFolderNotFound: "Parent folder not found.",
        duplicateNameConflict: "Duplicate file name in target.",
        pathExceedsLimit: "Name exceeds path character limit.",
        sizeExceedsSpaceLeft: "File size exceeds space left.",
        maxFileNumReached: `Max number of files (${MAX_FILE_NUM}) reached.`, // This fits in the UI (MAX_FILE_NUM is replaced with a small value)
    }

    const nonRetryableErrors = [ERROR_LIST.parentFolderNotFound, ERROR_LIST.pathExceedsLimit]

    const getNonRetryableFailedFiles = () => {
        const nonRetryableFailedFiles: QueueFileType[] = [];

        fileErrors.forEach((error, file) => {
            if (nonRetryableErrors.includes(error)) {
                fileErrors.delete(file);
                nonRetryableFailedFiles.push(file);
            }
        });
        
        return nonRetryableFailedFiles
    }

    const addSelectedFilesToQueue = (event: React.ChangeEvent<HTMLInputElement> | CustomEvent) => {
        let selectedFiles: FileList | null = null

        if (event instanceof CustomEvent) { // If the files were dropped on MainPage
            selectedFiles = fileInputRef.current?.files || null
        } else {
            selectedFiles = event.target.files
        }

        if (!selectedFiles) return

        const successfulFiles = uploadQueue.filter (
            (file, index) => !fileErrors.has(file) && index < currentUploadIndex
        )

        const nonRetryableFailedFiles = getNonRetryableFailedFiles()

        const newCurrentPath = currentPath
        let newFiles: QueueFileType[]

        if (fileInputRef?.current?.webkitdirectory === false || true) { // For file selection dialog (remove "true" condition after folder uploading is implemented)
            // Includes app's files and some queue files (which includes failed files (except parentFolderDeletedFiles) so user can press retry without worrying about conflicts, and includes files awaiting upload, but does NOT include successfull files that have not yet been added to pastQueuedFiles)
            const samePathFiles = [
                ...files.filter((file) => file.appPath === newCurrentPath + file.name),
                ...uploadQueue.filter((queuefile) => // Incase a file is uploading/queued to the same path but hasnt been fully uploaded yet so that it will still be included in the conflict check to add the suffix
                        !successfulFiles.includes(queuefile) && // Excluded here since uploaded files are already included
                        !nonRetryableFailedFiles.includes(queuefile) && 
                        queuefile.appPath === newCurrentPath + queuefile.fileObj.name
                    ),
            ];

            // Handle duplicates
            newFiles = Array.from(selectedFiles).map((selectedFile) => { 
                // "SimilarName" instead of "SameName" since they may have a suffix such as (1), (2) etc. at the end
                const filesWithSimilarName = samePathFiles.filter((file: QueueFileType | FileType) => { 
                    let checkedName: string;
                    // Check if it's a queue file or an app/uploaded file being checked, then get the name from fileObj depending on that
                    'fileObj' in file ? 
                        checkedName = (file as QueueFileType).fileObj.name
                        : checkedName = (file as FileType).name;

                    // Remove last occurence of existing suffix such as (1), (2), etc. so that it can be incremented up 
                    // if a new duplicate is found, while also leaving/being unaffected by the file extension so that a 
                    // file with same base name but different extension is considered DIFFERENT and NOT a duplicate name as 
                    // intended. Also considers files that don't have extensions. Extensions themselves are not expected to 
                    // have suffixes and backend would throw error for conflicting duplicates in that case.
                    const checkedNameNoLastSuffix = checkedName.replace(/\(\d+\)(?=\.[^.]*$)/, '') 
                    
                    // 2 conditions to deal with cases of duplicates where a non-suffix file is uploaded OR a suffix file is 
                    // uploaded (so the result may appear as an extra suffix e.g. myImage(4)(1).png - this is INTENDED as users
                    // may want to keep their own suffix maybe as a personal code or something. So this handles duplicates while
                    // also preserving a user's own suffix - Windows does this too.)
                    return (checkedName === selectedFile.name) || (checkedNameNoLastSuffix === selectedFile.name) 
                });

                let fileName = selectedFile.name; // Note: if the user intentionally put a (1), (2), etc. suffix before uploading then their suffix will still be preserved
                const dotIndex = fileName.lastIndexOf('.');
                const baseName = dotIndex !== -1 ? fileName.slice(0, dotIndex) : fileName;
                const extension = dotIndex !== -1 ? fileName.slice(dotIndex) : '';
    
                fileName = filesWithSimilarName.length > 0 ? `${baseName}(${filesWithSimilarName.length})${extension}` : fileName;
                const renamedFileObj = new File([selectedFile], fileName, { type: selectedFile.type });
        
                return {
                    fileObj: renamedFileObj,
                    id: null,
                    appPath: newCurrentPath + fileName,
                };
            });
        }
        else { // For folder selection dialog (incomplete and possibly outdated, update the code here if adding this feature)
            // const deepestPath = Array.from(selectedFiles).reduce((deepest, selectedFile) => { // Get deepest webkitRelativePath from selectedFiles based on number of slashes
            //     const slashesCount = (selectedFile.webkitRelativePath.match(/\//g) || []).length;
            //     return slashesCount > deepest.slashesCount ? { path: selectedFile.webkitRelativePath, slashesCount } : deepest;
            // }, { path: '', slashesCount: -1 }).path;

            // const deepestPathFolderNames = deepestPath.split('/').slice(0, -1); // slice removes the last element (file name)

            // /* things to do when adding this feature   
            //     - abort uploading files inside folder if folder fails creation (add them to file error map)
            //     - add selectedfiles to newFiles with correct app_paths, all at once
            //     - add previous folder names in same path to create path for a deeper folder
            //     - show toast for folder successfully uploaded when all files and folders inside top level folder have been uploaded (with or without errors)?
            // */

            // const handleCreateFolder = async () => {
            //     try {
            //         const parentFolder = folders.find((folder) => folder.appPath === currentPath.slice(0, -1));
            //         const appPath = currentPath + formData.newFolderName.trim()
            //         const parentFolderId = parentFolder ? parentFolder.id : null; // null here represents root directory, aka "LimeDrive"
            //         setShowNewFolderModal(false);
            //         const response = await api.post('/createFolder', {
            //             name: formData.newFolderName.trim(),
            //             appPath: appPath,
            //             parentFolderId: parentFolderId
            //         });
        
            //         addFolders(response.data)
            //         showToast({message: "Folder created successfully.", showSuccessIcon: true})
            //         formData.newFolderName = ''
            //         
            //          add jump to folder after creation?
            //     } 
            //     catch (error) {
            //         console.error(error);
            //         if (axios.isAxiosError(error)) {
            //             setBackendErrorMsg(error?.response?.data.message)
            //             showToast({message: "Error creating folder. Please check your connection or try again later.", showFailIcon: true})
            //         }
            //     }
            // }
        }

        const remainingFiles = uploadQueue.filter ( // Includes currently uploading file, queued files, and failed files that did not have their parent folder deleted
            (file) => !successfulFiles.includes(file) && !nonRetryableFailedFiles.includes(file)
        )

        const updatedUploadQueue = [
            ...remainingFiles,
            ...newFiles,
        ]

        const newFileErrors = new Map(); // Reset file error map
        setFileErrors(newFileErrors);
        setPastQueuedFiles((prevFiles: QueueFileType[]) => [...successfulFiles, ...nonRetryableFailedFiles, ...prevFiles]);
        setUploadQueue(updatedUploadQueue);
        setUploadListFilesNum((prevValue) => prevValue + newFiles.length - nonRetryableFailedFiles.length);
        setCurrentUploadIndex(0);
    }

    const { api } = useUserContext()
    
    // Uploads file to the server
    const uploadFile = async (fileToUpload: QueueFileType) => {
        try {
            const fileObj = fileToUpload.fileObj

            const validateFile = () => {
                if (doesPathExceedLimit(fileToUpload.appPath)) { // The appPath includes the file name at the end
                    throw new Error(ERROR_LIST.pathExceedsLimit)
                } 
                else if (fileObj.size + accountStorageUsed > accountStorageCap) {
                    throw new Error(ERROR_LIST.sizeExceedsSpaceLeft)
                } 
                else if (files.length >= MAX_FILE_NUM) {
                    throw new Error(ERROR_LIST.maxFileNumReached)
                }
            }
            validateFile()

            const source = axios.CancelToken.source();
            cancelTokenSource.current = source;

            // Simpler and possibly more performant than scanning fileObj for type (rare edge cases may lead to inaccuracies such as if user intentionally put incorrect extension but, that wouldn't affect the file download as that would be handled by bucket)
            const fileType = fileObj.type ? fileObj.type : (mime.getType(fileObj.name.split('.').pop() ?? "") ?? "application/octet-stream")

            const getMetadataResponseData = async () => {
                const parentFolder = folders.find((folder) => folder.appPath === fileToUpload.appPath.substring(0, fileToUpload.appPath.lastIndexOf('/')));

                const getMediaDuration = async () => {
                    if (!fileType.startsWith("video/") && !fileType.startsWith("audio/")) {
                        return null
                    }

                    try {                    
                        const metadata = await parseBlob(fileObj);
                        return metadata.format.duration
                    } catch (error) {
                        return null
                    }
                }

                const metadataResponse = await api.post('/uploadFileMetadata', {
                    name: fileObj.name,
                    size: fileObj.size,
                    type: fileType,
                    mediaDuration: await getMediaDuration(), // May be null, even on media files if their format is not supported for extracting duration
                    // Null represents root directory (LimeDrive) here.
                    parentFolderId: parentFolder ? parseInt(parentFolder.id.replace('d_', '')) : null,
                    // Don't append appPath here as that is constructed on the server based on parentFolderId
                }, {cancelToken: source.token});

                return metadataResponse.data;
            }
            const MetadataResponseData = await getMetadataResponseData()
            const uploadUrl = MetadataResponseData.uploadUrl
            const fileId = MetadataResponseData.id

            const uploadFileToBucket = async () => {
                await axios.put(uploadUrl, fileObj, {
                    headers: {
                        // This is for setting mime in the bucket, incorrect type isn't enforced if it 
                        // doesn't match server setting but this isn't a security issue since this 
                        // wouldn't affect other users beyond sharing, and would only mismatch rarely
                        'Content-Type': fileType 
                    },
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total !== undefined) {
                            const percentCompleted = Math.round(
                                (progressEvent.loaded * 100) / progressEvent.total
                            );
                            setCurrentFileProgress(percentCompleted);
                        } else {
                            setCurrentFileProgress(0);
                        }
                    },
                    cancelToken: source.token,
                });
            }
            await uploadFileToBucket()

            const getFileAfterConfirmedUpload = async () => {
                const confirmedUploadResponse = await api.post('/confirmFileUploadToBucket', {
                    fileId: fileId
                });

                return confirmedUploadResponse.data[0]
            }
            const fileReference = await getFileAfterConfirmedUpload()

            const updateQueue = () => {
                const uploadedFile = { fileObj: fileObj, id: fileReference.id, appPath: fileReference.appPath };
                
                // Update the corresponing file's data in uploadQueue to the now-uploaded file's data (mainly for updating the id)
                setUploadQueue((uploadQueue) => 
                    uploadQueue.map((uploadQueueFile) =>
                        uploadQueueFile.appPath === fileToUpload.appPath ? uploadedFile : uploadQueueFile // use appPath for matching instead of id as id can be null for unuploaded queue files
                    )
                );
            }
            updateQueue()
            
            addFiles(fileReference)
            setAccountStorageUsed(current => current + fileReference.size)

            setSuccessfulUploadNum(current => current + 1)
            setCurrentUploadIndex((prevIndex) => prevIndex + 1); // Don't put in finally
        } 
        catch (error) {
            console.error(error)
            if (axios.isCancel(error)) return
            
            const getInitialErrorMsg = () => {
                let initialErrorMsg = 
                    axios.isAxiosError(error) ? // If it's a backend exception
                        error?.response?.data.message ?? error.message
                    : error instanceof Error ? // If it's a frontend exception
                        error.message
                    : error

                return initialErrorMsg
            }
            let errorMsg = getInitialErrorMsg()
            
            // If backend errorMsg is one of the errorMsgs in global constants, then it is changed to match this component's version
            const getNormalizedErrorMsg = () => {
                if (errorMsg === constants.DUPLICATE_NAME_ERR_MSG) {
                    return ERROR_LIST.duplicateNameConflict
                } 
                else if (errorMsg === constants.MAX_ITEM_NUM_ERR_MSG) {
                    return ERROR_LIST.maxFileNumReached
                }
                else if (errorMsg === constants.ACCOUNT_STORAGE_CAP_ERR_MSG) { // In case the frontend storage limit didn't update in time (e.g. if a user uploaded a file from another device which changed the usage)
                    return ERROR_LIST.sizeExceedsSpaceLeft
                } 
                else {
                    return errorMsg
                }
            }
            errorMsg = getNormalizedErrorMsg()

            setFileErrors((prevErrors) => new Map(prevErrors).set(fileToUpload, errorMsg));
            setCurrentUploadIndex((prevIndex) => prevIndex + 1); // Don't put in finally and don't increment if cancel error
        }
        finally {
            setCurrentFileProgress(0);
            setCurrentlyUploadingFile(null);
            cancelTokenSource.current = null;
        }
    }

    // Call uploadFile depending on queue
    useEffect(() => { 
        if (currentUploadIndex >= 0 && currentUploadIndex < uploadQueue.length) {
            const fileToUpload = uploadQueue[currentUploadIndex];
            if (fileToUpload !== currentlyUploadingFile) {
                setCurrentlyUploadingFile(fileToUpload);
                setShowUploadInfo(true)
                uploadFile(fileToUpload);
            }
        }
        else if (currentUploadIndex === uploadQueue.length) { // arrays start at 0 index, so if index equals array length it means it is complete
            setCurrentlyUploadingFile(null)
        }
    }, [currentUploadIndex, uploadQueue]);

    // Causes all retryable failed files to be added back to queue
    const onRetryClick = () => { 
        const successfulFiles = uploadQueue.filter (
            (file, index) => !fileErrors.has(file) && index < currentUploadIndex
        )
        const nonRetryableFailedFiles = getNonRetryableFailedFiles()
        
        const filesToRetry: QueueFileType[] = uploadQueue.filter((file) => fileErrors.has(file) && !nonRetryableFailedFiles.includes(file));

        const otherAwaitingFiles = uploadQueue.filter (
            (file, index) => index > currentUploadIndex && !successfulFiles.includes(file) && !filesToRetry.includes(file) && !nonRetryableFailedFiles.includes(file)
        )

        const newFileErrors = new Map()
        setFileErrors(newFileErrors);

        const updatedUploadQueue: QueueFileType[] = [
            ...(currentlyUploadingFile ? [currentlyUploadingFile] : []),
            ...filesToRetry,
            ...otherAwaitingFiles,
        ]

        setUploadQueue(updatedUploadQueue);
        setCurrentUploadIndex(0);
        setPastQueuedFiles((prevFiles: QueueFileType[]) => [...successfulFiles, ...nonRetryableFailedFiles, ...prevFiles]);
    }
    
    // Just removes the file from queue
    const onCancelClick = (fileToRemove: QueueFileType) => {
        if (fileToRemove === currentlyUploadingFile && currentFileProgress === 100) {
            return
        } 
        else if (fileToRemove === currentlyUploadingFile) {
            cancelTokenSource?.current?.cancel('Upload cancelled by user');
        }
        else if (fileToRemove !== currentlyUploadingFile) {
            // If the file to cancel is before the currently uploading file (such as failed files),
            // decrease the currentUploadIndex by 1 so it matches a currently uploading file
            const indexToRemove = uploadQueue.findIndex(file => file === fileToRemove);
            if (indexToRemove < currentUploadIndex) {
                setCurrentUploadIndex(prevIndex => prevIndex - 1);
            }
        }

        if (uploadListFilesNum - 1 === 0) {
            setShowUploadInfo(false) // Unrenders the elements, still keeps the component state itself saved
        }

        const updatedUploadQueue = uploadQueue.filter((file) => file !== fileToRemove);
        setUploadQueue(updatedUploadQueue);
        setUploadListFilesNum((prevValue) => prevValue - 1);

        setFileErrors((prevErrors) => {
            const newErrors = new Map(prevErrors);
            newErrors.delete(fileToRemove);
            return newErrors;
        });
    }

    // Unrenders entire component apart from file input, but is disabled/prevented during a current upload to prevent issues (but user can still collapse it)
    const onCloseClick = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        event.stopPropagation()
        if (currentlyUploadingFile) return
        setShowUploadInfo(false)
    }

    const [collapseUploadList, setCollapseUploadList] = useState(false)
    const [showLinkShareModal, setShowLinkShareModal] = useState(false) // Leave state for this here for increase-z-index className

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={addSelectedFilesToQueue}
                onClick={(event) => ((event.target as HTMLInputElement).value = '')} // So that if user selects the exact same files as the last time, onChange still runs
                multiple
            />

            {isUploadInfoVisible &&
                <div className={`UploadInfo ${showLinkShareModal ? "increase-z-index" : ""}`}>
                    <UploadHeader 
                        collapseUploadList={collapseUploadList}
                        setCollapseUploadList={setCollapseUploadList}

                        successfulUploadNum={successfulUploadNum} 
                        uploadListFilesNum={uploadListFilesNum}

                        currentlyUploadingFile={currentlyUploadingFile}
                        onCloseClick={onCloseClick}
                        fileErrors={fileErrors}
                    />
                    
                    
                    <UploadList 
                        collapseUploadList={collapseUploadList}

                        currentUploadIndex={currentUploadIndex}
                        currentFileProgress={currentFileProgress}
                    
                        ERROR_LIST={ERROR_LIST}
                        fileErrors={fileErrors}
                        nonRetryableErrors={nonRetryableErrors}
                    
                        onRetryClick={onRetryClick}
                        onCancelClick={onCancelClick}
                        
                        uploadQueue={uploadQueue}
                        pastQueuedFiles={pastQueuedFiles}
                    
                        showLinkShareModal={showLinkShareModal}
                        setShowLinkShareModal={setShowLinkShareModal}
                    />
                    

                    <DynamicClip
                        clipPathId={"uploadInfoClip"}
                        animation={showUploadInfo}
                        numRects={6} // Leave as fixed number as it may look weird otherwise
                    />
                </div>
            }
        </>
    )
}

export default memo(UploadInfo)