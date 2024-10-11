import { memo, useState, useRef } from 'react'
import "./Settings.scss"
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useUserContext } from '../../../contexts/UserContext'
import { useFormLogic } from '../../../hooks/useFormLogic'
import { useToast } from '../../../contexts/ToastContext'
import Modal from '../../Modal-COMPS/Modal'
import { capitalize } from 'lodash';
import { BsEye, BsEyeSlash } from 'react-icons/bs'
import { useFileContext } from '../../../contexts/FileContext'
import Checkbox from '../../Other-COMPS/Checkbox-comp/Checkbox'
import Watermark from '../../Other-COMPS/Watermark'
import { constants } from '../../../data/globalConstants'

function Settings() {
    const { user, setUser, api, setRememberUser } = useUserContext()
    const { setFiles, setFolders, addFiles, addFolders, folders, setAccountStorageUsed } = useFileContext()
    const { showToast } = useToast()
    const navigate = useNavigate()
    const [processing, setProcessing] = useState(false)
    const [showModal, setShowModal] = useState(false) // Don't remove this as it's there for animation reasons with modal onExit.
    const [displayCurrentPassword, setDisplayCurrentPassword] = useState(false)
    const [displayNewPassword, setDisplayNewPassword] = useState(false)
    const [displayConfirmNewPassword, setDisplayConfirmNewPassword] = useState(false)
    const [changeUsernameModal, setChangeUsernameModal] = useState(false)
    const [changeEmailModal, setChangeEmailModal] = useState(false)
    const [changePasswordModal, setChangePasswordModal] = useState(false)
    const [deleteAccountModal, setDeleteAccountModal] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)
    const [isDeleteChecked, setIsDeleteChecked] = useState(false)
    const firstInputRef = useRef<HTMLInputElement | null>(null)
    const { formData, handleInputChange, resetFormData } = useFormLogic({
        newUsername: '',
        newEmail: '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
    }, (event) => {
        setFormError(null)
    })
    const isNewUsernameValid = /^[a-zA-Z0-9_-]+$/.test(formData.newUsername)
    const isNewEmailValid = /^\S+@\S+\.\S+$/.test(formData.newEmail)
    const isCurrentPasswordValid = formData.currentPassword.length >= 8
    const isNewPasswordValid = formData.newPassword.length >= 8
    const isConfirmNewPasswordValid = formData.newPassword === formData.confirmNewPassword
    if (!user) return
    document.title = "Settings – LimeDrive"

    const renderError = (backendErrorMsg: string) => {
        setFormError( // Using startsWith() due to laravel possibly grouping multiple validation errors
            !changePasswordModal && formData.currentPassword.trim() === "" ? 
                'Password must not be empty.'
            : !changePasswordModal && (!isCurrentPasswordValid || backendErrorMsg.startsWith("The current password is incorrect for the current user.")) ? 
                'Invalid password.'

            : changeUsernameModal && formData.newUsername.trim() === "" ? 
                'New username must not be empty.'
            : changeUsernameModal && !isNewUsernameValid ? 
                'Invalid username format.'
            : changeUsernameModal && backendErrorMsg.startsWith("Username is taken.") ? 
                'Username is taken.'
            
            : changeEmailModal && formData.newEmail.trim() === "" ? 
                'New email must not be empty.'
            : changeEmailModal && (!isNewEmailValid || backendErrorMsg.startsWith("Invalid email format.")) ? 
                'Invalid email format.'
            : changeEmailModal && user?.email === formData.newEmail ? 
                'Email is already tied to this account.'
            : changeEmailModal && backendErrorMsg.startsWith("Email is taken.") ? 
                'Email is taken.'

            : changePasswordModal && formData.currentPassword.trim() === "" ? 
                'Current password must not be empty.'
            : changePasswordModal && formData.newPassword.trim() === "" ?  
                'New password must not be empty.'
            : changePasswordModal && formData.confirmNewPassword.trim() === "" ? 
                'Confirm new password must not be empty.'
            : changePasswordModal && (!isCurrentPasswordValid || backendErrorMsg.startsWith("The given password does not match the current password.")) ? 
                'Invalid current password.' // backendErrorMsg for invalid password is different here from the other modal types
            : changePasswordModal && backendErrorMsg.startsWith("The new password field and current password must be different.") ? 
                'Old password and new password must be different.'
            : changePasswordModal && (!isNewPasswordValid || backendErrorMsg.startsWith("Invalid new password format.")) ? 
                'Invalid format for new password.'
            : changePasswordModal && (!isConfirmNewPasswordValid || backendErrorMsg.startsWith("Passwords do not match.")) ? 
                'New password and confirm password do not match.'

            : deleteAccountModal && (!isDeleteChecked || backendErrorMsg.startsWith("The is delete checked field must be accepted.")) ? 
                'The checkbox is not checked.'
            
            : backendErrorMsg ? 
                'Error. Check connection or retry later.'
            : null
        )
    }

    const handleChangeAccountDetail = async (
        InvalidationCondition: boolean, 
        detailType: string,
        newDetailValue: string, 
    ) => {
        if (InvalidationCondition || !isCurrentPasswordValid) return renderError("")
        const isRegisterEmailFromNull = (detailType === "email" && user?.email === null)
        
        try {
            setProcessing(true)
            showToast({message: `Processing new ${detailType}...`, loading: true})
            
            const payload = {
                currentPassword: formData.currentPassword,
                ["new"+capitalize(detailType)]: newDetailValue,
                ...(detailType === "password" ? { confirmNewPassword: formData.confirmNewPassword } : {}),
            };

            const response = await api.post(`/update${capitalize(detailType)}`, payload);
            
            if (detailType === "username") {
                setUser(prevUser => {
                    if (prevUser === null) { // If user logged out before the change finished
                        return null
                    }
                    return {
                        ...prevUser,
                        username: response.data.newUsername
                    }
                })

                showToast({message: `Username changed successfully`, showSuccessIcon: true})
            } 
            else if (detailType === "email") {
                setUser(prevUser => {
                    if (prevUser === null) { // If user logged out before the change finished
                        return null
                    }
                    return {
                        ...prevUser,
                        email: response.data.newEmail,
                        isEmailVerified: false // Since they just changed it
                    }
                })

                showToast({message: `Email ${isRegisterEmailFromNull ? "registered" : "changed"} successfully`, showSuccessIcon: true})
            } 
            else {
                // Don't need to log out current session, the backend will expire other sessions
                showToast({message: "Password changed successfully. All your other sessions have been expired.", showSuccessIcon: true, duration: 8000})
            }
            
            setShowModal(false)
        } 
        catch (error) {
            console.error(error);
            if (axios.isAxiosError(error)) {
                renderError(error?.response?.data.message ?? error?.response?.data)
                
                error.message === 'Network Error' ? // Don't use data.message, but use error.message
                    showToast({message: `Failed to ${isRegisterEmailFromNull ? "register" : "change"} ${detailType}: Please check your connection or try again later.`, showFailIcon: true})
                    : showToast({message: `Failed to ${isRegisterEmailFromNull ? "register" : "change"} ${detailType}.`, showFailIcon: true})
            }
        }
        finally {
            setProcessing(false)
        }
    }

    const handleAccountDeletion = async () => {
        if (!isCurrentPasswordValid || formData.currentPassword.trim() === "" || !isDeleteChecked) return renderError("")
        
        try {
            setProcessing(true)
            showToast({message: `Processing account deletion...`, loading: true})
            await api.delete("/deleteAccount", {
                data: {
                    currentPassword: formData.currentPassword,
                    isDeleteConfirmed: isDeleteChecked
                }
            });
            setFiles([])
            setFolders([])
            setUser(null)
            navigate("/auth")
            setRememberUser(false)

            showToast({message: "Account deleted successfully.", showSuccessIcon: true, duration: 8000})
            setShowModal(false)
        } 
        catch (error) {
            console.error(error);
            if (axios.isAxiosError(error)) {
                renderError(error?.response?.data.message ?? error?.response?.data)
                error.message === 'Network Error' ? // Don't use data.message, but use error.message
                    showToast({message: `Failed to delete account: Please check your connection or try again later.`, showFailIcon: true})
                    : showToast({message: `Failed to delete account.`, showFailIcon: true})
            }
        }
        finally {
            setProcessing(false)
        }
    }

    const handleRestoreSamples = async () => {
        if (folders.find((folder) => !folder.parentFolderId && folder.name === "Samples")) {
            return showToast({message: `Folder named "Samples" already exists in root.`, showFailIcon: true})
        }
        
        showToast({message: `Restoring samples...`, loading: true})

        try {
            const response = await api.get("/restoreSamples");
            
            const {files, folders, accountStorageUsed} = response.data

            addFiles(files)
            addFolders(folders)
            setAccountStorageUsed(accountStorageUsed)
            showToast({message: "Restored samples successfully.", showSuccessIcon: true, duration: 8000})
        } 
        catch (error) {
            console.error(error);
            if (axios.isAxiosError(error)) {
                const errorMsg = error?.response?.data.message

                showToast({message: `Failed to restore samples:
                    ${errorMsg === 'Folder named "Samples" already exists in root.' ?
                        errorMsg
                     : errorMsg === constants.ACCOUNT_STORAGE_CAP_ERR_MSG ?
                        'Storage cap would be exceeded.'
                     : errorMsg === constants.MAX_ITEM_NUM_ERR_MSG ?
                        `Max number of files (${constants.MAX_USER_FILE_NUM}) and/or folders (${constants.MAX_USER_FOLDER_NUM}) would be exceeded`
                     : 
                        "Please check your connection or try again later."
                    }`
                , showFailIcon: true})
            }
        }
    }

    return (
        <div className="Settings">
            <h1 className="main-section-heading">Settings</h1>
            <div className="settings-section">
                <h2>Account Details</h2>
                <div className='setting'>
                    <div className='label-cont'>
                        <p className='label'>Username</p>
                        <p className='info' title={user.username ?? undefined}>{user.username}</p>
                    </div>
                    <button className="text-btn" onClick={()=>{setShowModal(true), setChangeUsernameModal(true)}}>Edit</button>
                </div>
                <div className='setting'>
                    <div className='label-cont'>
                        <p className='label'>Email {!user.isEmailVerified && user.email ? '(Unverified)' : ''}</p>
                        <p className='info' title={user.email ?? undefined}>
                            {user.email ? user.email : "(No email registered)"}
                        </p>
                    </div>
                    <button className="text-btn" onClick={()=>{setShowModal(true), setChangeEmailModal(true)}}>Edit</button>
                </div>
            </div>
            
            <div className="settings-section">
                <h2>Security</h2>
                <div className='setting'>
                    <p className='label'>Password</p>
                    <button className="text-btn" onClick={()=>{setShowModal(true), setChangePasswordModal(true)}}>Change password</button>
                </div>
                {/* <div>
                    <p>Security checkup</p>
                    <button className="text-btn" onClick={()=>showToast({message: "Security checkup not yet featured."})}>Start check-up</button>
                </div> */}
                <div className='setting'>
                    <p className='label'>2-step authentication (2FA)</p>
                    <button className="text-btn" onClick={()=>showToast({message: "2-step authentication not yet featured."})}>Enable</button>
                </div>
            </div>

            <div className="settings-section">
                <h2>Other</h2>
                <div className='setting'>
                    <p className='label'>Restore samples</p>
                    <button className="text-btn" onClick={handleRestoreSamples}>Restore</button>
                </div>
                <div className='setting'>
                    <p className='label'>Delete my LimeDrive account</p>
                    <button className="text-btn" onClick={()=>{setShowModal(true), setDeleteAccountModal(true)}}>Delete</button>
                </div>
            </div>
            <Modal 
                className="user-settings-modal"
                onSubmit={() => {                    
                    changeUsernameModal ? handleChangeAccountDetail(!isNewUsernameValid, "username", formData.newUsername) // Don't use trim() here for any of these so the data stays consistent with user expectations
                    : changeEmailModal ? handleChangeAccountDetail(!isNewEmailValid || user.email === formData.newEmail, "email", formData.newEmail)
                    : changePasswordModal ? handleChangeAccountDetail(!isNewPasswordValid || !isConfirmNewPasswordValid, "password", formData.newPassword)
                    : handleAccountDeletion()
                }}
                render={showModal}
                onCloseClick={() => setShowModal(false)}
                closeBtnTabIndex={!processing ? 0 : -1}
                onVisible={() => firstInputRef.current?.focus()}
                onExit={() => {
                    resetFormData()
                    setFormError(null)
                    setChangeUsernameModal(false)
                    setChangeEmailModal(false)
                    setChangePasswordModal(false)
                    setDeleteAccountModal(false)
                    setDisplayCurrentPassword(false)
                    setDisplayNewPassword(false)
                    setDisplayConfirmNewPassword(false)
                    setIsDeleteChecked(false)
                }}
            >
                <h1 id="modal-title">
                    {changeUsernameModal ? "Change username"
                     : changeEmailModal && user.email === null ? "Register email"
                     : changeEmailModal && user.email ? "Change email"
                     : changePasswordModal ? "Change password"
                     : "Delete account"
                    }
                </h1>
                <div className={`all-inputs-cont ${deleteAccountModal ? 'with-delete-account-confirmation' : ''}`}>
                    <div className="input-cont">
                        <label htmlFor="current-password-input">Enter your current password</label>
                        <input
                            className='password-input'
                            type={displayCurrentPassword ? 'text' : 'password'}
                            id="current-password-input"
                            placeholder="Password"
                            name="currentPassword"
                            value={formData.currentPassword}
                            onChange={(e) => handleInputChange(e)}
                            maxLength={72}
                            ref={firstInputRef}
                            required
                            spellCheck="false"
                            disabled={processing}
                            autoComplete='current-password'
                        />
                        <button type="button" className="btn-icon-wrapper" onClick={() => setDisplayCurrentPassword(current => !current)} aria-label={displayCurrentPassword ? "Hide password" : "Show password"}>
                            {displayCurrentPassword ? 
                                (<BsEyeSlash className="eye-icon btn-icon" />)
                                : (<BsEye className="eye-icon btn-icon" />)
                            }
                        </button>
                    </div>

                    {changeUsernameModal ?
                        <div className="input-cont">
                            <label htmlFor="new-username-input">New username</label>
                            <input
                                type="text"
                                id="new-username-input"
                                placeholder="Can use a-z, A-Z, 0-9, -, _"
                                aria-placeholder="Can contain alphanumeric characters, hyphens, and dashes."
                                name="newUsername"
                                value={formData.newUsername}
                                onChange={(e) => handleInputChange(e)}
                                maxLength={30}
                                required
                                spellCheck="false"
                                disabled={processing}
                            />
                        </div>

                        : changeEmailModal ?
                            <div className="input-cont">
                                <label htmlFor="new-email-input">{user.email === null ? "Email to register" : "New email"}</label>
                                <input
                                    type="text"
                                    id="new-email-input"
                                    name="newEmail"
                                    value={formData.newEmail}
                                    onChange={(e) => handleInputChange(e)}
                                    maxLength={255}
                                    required
                                    spellCheck="false"
                                    disabled={processing}
                                    autoComplete="email"
                                />
                            </div>

                        : changePasswordModal ?
                            <>
                                <div className="input-cont">
                                    <label htmlFor="new-password-input">New password</label>
                                    <input
                                        className='password-input'
                                        type={displayNewPassword ? 'text' : 'password'}
                                        id="new-password-input"
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={(e) => handleInputChange(e)}
                                        maxLength={72}
                                        required
                                        spellCheck="false"
                                        disabled={processing}
                                        placeholder="Minimum 8 characters"
                                        aria-placeholder="Minimum 8 characters"
                                        autoComplete="new-password"
                                    />
                                    <button type="button" className="btn-icon-wrapper" onClick={() => setDisplayNewPassword(current => !current)} aria-label={displayNewPassword ? "Hide password" : "Show password"}>
                                        {displayNewPassword ? 
                                            (<BsEyeSlash className="eye-icon btn-icon" />)
                                            : (<BsEye className="eye-icon btn-icon" />)
                                        }
                                    </button>
                                </div>
                                <div className="input-cont">
                                    <label htmlFor="confirm-new-password-input">Confirm new password</label>
                                    <input
                                        className='password-input'
                                        type={displayConfirmNewPassword ? 'text' : 'password'}
                                        id="confirm-new-password-input"
                                        name="confirmNewPassword"
                                        value={formData.confirmNewPassword}
                                        onChange={(e) => handleInputChange(e)}
                                        maxLength={72}
                                        required
                                        spellCheck="false"
                                        disabled={processing}
                                    />
                                    <button type="button" className="btn-icon-wrapper" onClick={() => setDisplayConfirmNewPassword(current => !current)} aria-label={displayConfirmNewPassword ? "Hide password" : "Show password"}>
                                        {displayConfirmNewPassword ? 
                                            (<BsEyeSlash className="eye-icon btn-icon" />)
                                            : (<BsEye className="eye-icon btn-icon" />)
                                        }
                                    </button>
                                </div>
                            </>

                        : <div className={`delete-account-confirmation-cont ${processing ? 'disabled' : ''}`}>
                            <Checkbox 
                                checked={isDeleteChecked} 
                                onClick={() => {setIsDeleteChecked(current => !current), setFormError(null)}}
                                disabled={processing}
                                ariaLabelledBy={"delete-account-confirmation-label"}
                            />
                            <label id="delete-account-confirmation-label">I want to delete my account.</label>
                        </div>
                    }
                </div>
                <p id="account-settings-modal-error" className="error" aria-atomic="true" role="alert" aria-live="assertive">
                    {formError}
                </p>


                {/* There used to be extra info/warning text but it was removed as it's harder to make responsive and 
                 And may be too much info for users, making the modal look more cramped. */}
                <div className="modal-btn-cont">
                    <button 
                        className='modal-cancel-btn' 
                        type="button" 
                        onClick={() => setShowModal(false)} 
                        disabled={processing}
                    >
                        Cancel
                    </button>
                    <button
                        className="modal-primary-btn" // Don't make this red if deleteAccountModal as it goes too much against the theme and there's already lots of things to protect the user from accidentally deleting their account
                        type="submit"
                        disabled={processing || (formError !== null && formError !== "Error. Check connection or retry later.")}
                    >
                        {!deleteAccountModal ?
                            "Change"
                            : "Delete"
                        }
                    </button>
                </div>
            </Modal>
            <Watermark />
        </div>
    )
}

export default memo(Settings)