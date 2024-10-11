import { useUserContext } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { ItemTypes } from '../types';
import streamSaver from 'streamsaver';
import axios from 'axios';

export const useDownload = () => {
    const { api } = useUserContext();
    const { showToast } = useToast();
    // Don't put selectedItems here, only pass items in as param for download functions as they can also be used for items other than selectedItems

    const handleDownloadItems = async (
        itemsToDownload: ItemTypes[],
    ) => {
        if (itemsToDownload.length === 0) return

        const newItemsToDownload = itemsToDownload.slice() // Shallow copy to not accidentally modify the original array
        
        showToast({message: "Starting download...", loading: true})

        try {
            const response = await api.post("/getItemDownload", {
                itemIds: newItemsToDownload.map(item => item.id),
            });

            // Streamed from worker instead of doing the zip download all at once, which led to CORS errors for larger files occasionally,
            // and was also worse for UX as it took longer for the browser to show the download started
            const worker = new Worker('/download-worker.js');

            worker.postMessage({ 
                foldersToZip: response.data.foldersToZip, 
                filesToZip: response.data.filesToZip 
            });

            // Leave streamSaver stuff here instead of in worker, as it's meant to run on main thread
            const fileStream = streamSaver.createWriteStream(response.data.zipName)
            const writer = fileStream.getWriter()

            let isFirstChunk = true;

            worker.onmessage = async (event) => {
                if (event.data.error) {
                    console.error(event.data.error)
                    await writer.abort()
                    return showToast({message: "Download failed.", showFailIcon: true})
                }

                if (event.data.chunk) {
                    try {
                        await writer.write(event.data.chunk)

                        if (isFirstChunk) {
                            showToast({message: "Download started.", showSuccessIcon: true})
                            isFirstChunk = false;
                        }
                    }
                    catch (error) { // This is for if user cancels download via native browser controls (event.data.error didn't cause abort in that case for some reason)
                        await writer.abort()
                    }
                }

                if (event.data.done) {
                    await writer.close()
                }
            }
        }
        catch (error) {
            handleDownloadError(error)
        }
    };

    const handleDownloadSingleFile = async (
        fileId: number, 
        fileAccessToken?: string,
    ) => {
        let endpoint

        fileAccessToken ?
            endpoint = "/getLinkShareFileDownload"
            : endpoint = "/getItemDownload"
        
        showToast({message: `Starting download...`, loading: true})

        try {
            const response = await api.post(endpoint, {
                itemIds: [fileId],
                ...(fileAccessToken ? {fileAccessToken} : {}),
            });
            
            window.location.href = response.data.downloadUrl;
            showToast({message: "Download started.", showSuccessIcon: true})
        }
        catch (error) {
            handleDownloadError(error)
        }
    };

    const handleDownloadError = (error: unknown) => {
        console.error(error);
        let errorMsg = ""

        if (axios.isAxiosError(error)) { // Toast is outside as errorMsg may not be axios error
            errorMsg = error.response?.data.message
        }

        showToast({message: `Failed to download:
            ${axios.isAxiosError(error) && error.response?.status === 429 ?
                "Rate limit reached. Please wait a few seconds before trying again." // Rate limit toast can flicker if multiple requests hit the throttle before the limit ends. In future, can try to get rate limit time left from backend
             : errorMsg === "File not found." ?
                "File not found."
             : errorMsg === "Invalid file access token." ?
                "Invalid link for file."
             : 
                "Please check your connection or try again later."
            }`
        , showFailIcon: true})
    }

    return {
        handleDownloadItems,
        handleDownloadSingleFile
    };
}