import { memo, useState, useEffect, useRef } from 'react'
import "./LinkShareAndRevokeModals.scss"
import axios from 'axios'
import { useUserContext } from '../../../contexts/UserContext'
import { useToast } from '../../../contexts/ToastContext'
import Modal from '../Modal'
import LoadingBar from '../../Other-COMPS/LoadingBar-COMPS/LoadingBar'
import { ItemTypes, PartialFileType } from '../../../types'
import { useInterfaceContext } from '../../../contexts/InterfaceContext'

interface LinkShareAndRevokeModalsProps {
    showLinkShareModal: boolean;
    setShowLinkShareModal: React.Dispatch<React.SetStateAction<boolean>>
    itemsToGetLinks: (ItemTypes | PartialFileType)[]
    triggerButtonObject: HTMLButtonElement | null; // Using object instead of ref since I didn't figure out a way to dynamically set ref in some places without causing issues
    appearAbove?: boolean; // As in y coord, not z coord
    instantLink?: string | null;
    hideRevoke?: boolean;
}

function LinkShareAndRevokeModals({ 
    showLinkShareModal, 
    setShowLinkShareModal, 
    itemsToGetLinks, 
    triggerButtonObject, 
    appearAbove = false,
    instantLink = null,
    hideRevoke = false,
}: LinkShareAndRevokeModalsProps) {
    const { api } = useUserContext()
    const { showToast } = useToast()
    const { viewportWidth } = useInterfaceContext()
    const [loading, setLoading] = useState(false)
    const [controller, setController] = useState(new AbortController());
    const [backendErrorMsg, setBackendErrorMsg] = useState("")
    const [linkShares, setLinkShares] = useState("")
    const [showRevokeModal, setShowRevokeModal] = useState(false)
    const [revokeProcessing, setRevokeProcessing] = useState(false)
    const [failedCopy, setFailedCopy] = useState(false)
    const [linkShareIds, setLinkShareIds] = useState<(string | number)[]>([]) // Leave string type (may implement folder shareable links in future)
    const [firstItemName, setFirstItemName] = useState("") // Prevent error in case user changes item selection during exit animtation
    const inputRef = useRef<HTMLInputElement>(null);
    const linkShareModalRef = useRef<HTMLDivElement>(null)
    const [preventShowAgain, setPreventShowAgain] = useState(false); // Prevent problem if user opens same linkShareModal again before its exit animation ends

    const constructLink = (token: string) => { // Not hardcoded hostname for better testing in local environment
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'; // https is used in local
        const protocol = 'https://'; // localhost for limedrive development uses https, change this in the future if this changes
        return `${protocol}${window.location.hostname}${isLocal ? `:${window.location.port}` : ''}/link-share/${token}`
    }

    const handleGetLinks = async () => {
        if (itemsToGetLinks.some(item => typeof item.type === 'undefined')) return // If contains folder then return (leave for now, might implement folder link-sharing in future)
        setLoading(true)
        const fileIds = itemsToGetLinks.map(item => item.id);
        setLinkShareIds(fileIds)
        setFirstItemName(itemsToGetLinks[0].name)

        try {
            const response = await api.get('/getFileAccessTokens', {
                params: {fileIds: fileIds},
                signal: controller.signal,
            });

            const newLinkShares = response.data.fileAccessTokens.map((fileAccessToken: string) => (
                constructLink(fileAccessToken)
            )).join(', ');
            setLinkShares(newLinkShares);

            await navigator.clipboard.writeText(newLinkShares);
        }
        catch (error) {
            console.error(error);
            if (axios.isAxiosError(error) && error.name !== 'CanceledError') {
                setBackendErrorMsg(error?.response?.data.message)
            } else if (error && (error as any).name === 'NotAllowedError' || (error as any).name === 'ClipboardEvent') {
                setFailedCopy(true)
            }
        }
        finally {
            setLoading(false)
        }
    }

    const handleInsantLink = async () => { // For getting link from url directly (i.e. when copy link is used in file viewer in link-share view after file is retrieved)
        if (!instantLink) return
        setLinkShareIds([itemsToGetLinks[0].id])
        setFirstItemName(itemsToGetLinks[0].name)

        try {
            const newLinkShare = constructLink(instantLink)
            setLinkShares(newLinkShare);
            await navigator.clipboard.writeText(newLinkShare);
        }
        catch (error) {
            console.error(error);
            if (error && (error as any).name === 'NotAllowedError' || (error as any).name === 'ClipboardEvent') {
                setFailedCopy(true)
            }
        }
    }

    const handleRevokeLinkShares = async () => {
        if (hideRevoke) return
        setShowRevokeModal(false)
        setRevokeProcessing(true)
        showToast({message: `Revoking ${linkShareIds.length} shareable ${linkShareIds.length > 1 ? "links" : "link"}...`, loading: true})

        try {
            await api.delete('/deleteFileShareKeys', {
                data: {fileIds: linkShareIds}
            });
            showToast({message: `${linkShareIds.length} shareable ${linkShareIds.length > 1 ? "links" : "link"} revoked successfully.`, showSuccessIcon: true})
            setShowLinkShareModal(false)
        }
        catch (error) {
            console.error(error);
            if (axios.isAxiosError(error)) {
                showToast({message: `Failed to revoke shareable ${linkShareIds.length > 1 ? "links" : "link"}: Please check your connection or try again later.`, showFailIcon: true})
            }
        }
        finally {
            setRevokeProcessing(false)
        }
    }

    useEffect(() => {
        if (linkShares !== "") {
            setTimeout(() => { // Wait for proper rendering
                inputRef.current?.select()
            }, 20);
        }
    }, [linkShares])

    // Setup
    useEffect(() => {
        if (!showLinkShareModal || preventShowAgain) {
            return setShowLinkShareModal(false)
        }

        instantLink ?
            handleInsantLink()
            : handleGetLinks()

        const abortController = new AbortController();
        setController(abortController); 
        
        return () => {
            setTimeout(() => {
                controller.abort(); // Used here instead of in onExitCallback because for some reason aborting didnt work there, timeout is here to match the exit animation
            }, 200);
        }
    }, [showLinkShareModal]);

    // Set position
    useEffect(() => {
        const timeout = setTimeout(() => { // Set share links modal position near the button that opened it (timeout is there to wait for ref to be set properly, other methods didn't fix this need)
            const modalNode = linkShareModalRef.current;
            if (!modalNode || !triggerButtonObject) return

            const rect = triggerButtonObject.getBoundingClientRect()
            const modalWidth = modalNode.offsetWidth
            const right = window.innerWidth - rect.right
    
            // Check if the modal would go off-screen to the left
            if (rect.right - modalWidth < 0) {
                // Center the modal horizontally
                modalNode.style.left = '50%'
                modalNode.style.right = 'auto'
                modalNode.style.transform = 'translateX(-50%)'
            } else {
                // Position relative to the trigger button
                modalNode.style.right = `${right}px`
                modalNode.style.left = 'auto'
                modalNode.style.transform = 'none'
            }

            if (appearAbove) { // As in y coord, not z coord
                const bottom = window.innerHeight - rect.top + 10;
                modalNode.style.bottom = `${bottom}px`;
            } else {
                const top = rect.bottom + 10;
                modalNode.style.top = `${top}px`;
            }
        }, 20)
        
        return () => {
            clearTimeout(timeout)
        }
    }, [showLinkShareModal, viewportWidth]);

    const truncateString = (str: string): string => { // Didn't use CSS for this as I don't want the "copied" message to be truncated
        const maxLength = viewportWidth > 390 ? 55 : 40
        
        if (str.length <= maxLength) {
            return str;
        } else {
            return str.slice(0, maxLength) + '...';
        }
    }

    return (
        <>
            <Modal
                className="link-share-modal" // Don't use conditional class with template literals because for some reason that messed with positioning
                render={showLinkShareModal}
                onCloseClick={() => {setShowLinkShareModal(false), setPreventShowAgain(true)}}
                onExit={() => {
                    setLinkShares("")
                    setLinkShareIds([])
                    setFailedCopy(false)
                    setLoading(false)
                    setBackendErrorMsg("")
                    setPreventShowAgain(false)
                }}
                animateBackdrop={false}
                backdropClassname='link-share-modal-backdrop'
                innerRef={linkShareModalRef}
            >
                {loading ?
                    <>
                        <p className="loading-text" id="modal-description">
                            Getting shareable {linkShareIds.length > 1 ? "links" : "link"}...
                        </p>
                        <LoadingBar />
                    </>
                 : backendErrorMsg !== "" ?
                    <p className='error-text' id="modal-description">
                        Error. Please check your connection<br/>or try again later.
                    </p>
                 :
                    <>
                        <p className="success-text" id="modal-description"> {/* 2 nbsp so that a long non-spaced item name doesn't start at 2nd line (CSS solutions didn't fix it) */}
                            {linkShareIds.length > 1 ? "Links" : "Link"}&nbsp;for&nbsp;
                            <strong>
                                {linkShareIds.length === 1 ? 
                                    truncateString(firstItemName)
                                    : linkShareIds.length+" items"
                                }
                            </strong> 
                            {!failedCopy ? " copied" : " (please copy manually)"}.
                        </p>
                        <div className="input-and-btn-cont">
                            <input
                                readOnly
                                spellCheck="false"
                                aria-readonly 
                                value={linkShares}
                                ref={inputRef}
                            />
                            {!hideRevoke &&
                                <button
                                    className='modal-primary-btn'
                                    onClick={() => setShowRevokeModal(true)}
                                >
                                    Revoke
                                </button>
                            }
                        </div>
                    </>
                }
            </Modal>

            <Modal
                className="revoke-link-share-modal"
                render={showRevokeModal}
                onCloseClick={() => setShowRevokeModal(false)}
                backdropClassname='revoke-link-share-backdrop'
            >
                <h1 id="modal-title">Revoke shareable {linkShareIds.length > 1 ? "links" : "link"}?</h1>
                <p id="modal-description">
                    {linkShareIds.length > 1 ?
                        `Are you sure you want to revoke all access to ${linkShareIds.length} files through their shareable links? Your private access will remain and you can generate new shareable links later.`
                     :
                        "Are you sure you want to revoke all access to this file through its shareable link? Your private access will remain and you can generate a new shareable link later."
                    }
                    <br /><br />
                    NOTE: Each file can only have one shareable link at a time. Further requests get this same link 
                    unless it is revoked - then a different link will be retrieved instead.
                </p>
                
                <div className="modal-btn-cont">
                    <button className='modal-cancel-btn' onClick={() => setShowRevokeModal(false)}>
                        Cancel
                    </button>
                    <button 
                        className='modal-primary-btn'
                        onClick={handleRevokeLinkShares}
                        disabled={revokeProcessing}
                    >
                        Revoke
                    </button>
                </div>
            </Modal>
        </>
    )
}

export default memo(LinkShareAndRevokeModals)