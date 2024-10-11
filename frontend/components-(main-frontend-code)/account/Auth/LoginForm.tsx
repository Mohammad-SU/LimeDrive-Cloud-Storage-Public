import { useState, memo } from 'react'
import axios from 'axios';
import "./Form.scss"
import { useUserContext } from '../../contexts/UserContext';
import { useToast } from '../../contexts/ToastContext.tsx';
import { useNavigate } from "react-router-dom";
import { useFormLogic } from "../../hooks/useFormLogic.ts";
import { BsEye, BsEyeSlash } from 'react-icons/bs';
import Modal from '../Modal-COMPS/Modal.tsx';
interface LoginFormProps {
    loading: boolean
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

function LoginForm({ loading, setLoading }: LoginFormProps) {
    const { showToast, closeCurrentToast } = useToast()
    const { formData, handleInputChange } = useFormLogic({
        usernameOrEmailLog: '',
        passwordLog: '',
    })

    const { fetchUserDataViaAuthForm, setRememberUser } = useUserContext();
    const navigate = useNavigate();
    let backendErrorMsg: string | null = null
    const isPasswordValid = formData.passwordLog.length >= 8

    const handleSubmit = async (generateUser: boolean = false) => {
        if (loading) return
        if (!generateUser && (!isPasswordValid || formData.usernameOrEmailLog.trim() === '')) {
            showToast({message: "Invalid login details.", showFailIcon: true, duration: 2000})
            return
        }

        setLoading(true)

        generateUser ?
            showToast({message: "Generating an account for you...", loading: true})
            : showToast({message: "Processing login details...", loading: true})

        try {
            await (
                generateUser ?
                    fetchUserDataViaAuthForm({generateUser: true})
                    : fetchUserDataViaAuthForm({loginUser: true, formData: formData}) // Also gets csrf token
            )

            setRememberUser(true) // For now this will always be set to true here, in future may add checkbox
            closeCurrentToast()
            navigate("/LimeDrive")
        } 
        catch (error) {
            console.error(error)
            if (axios.isAxiosError(error)) {
                backendErrorMsg = error?.response?.data.message

                if (backendErrorMsg === "Invalid login details.") {
                    showToast({message: backendErrorMsg, showFailIcon: true})
                } else {
                    showToast({message: "Error. Please check your connection, or try again later.", showFailIcon: true})
                }
            }
        }
        finally {
            setLoading(false)
        }
    }

    const [showPassword, setShowPassword] = useState<boolean>(false)
    const togglePasswordVisibility = () => setShowPassword(!showPassword)

    return (
        <Modal
            className="auth-modal"
            render={true}
            onSubmit={()=>handleSubmit()}
            showCloseBtn={false}
            showBackdrop={false}
            animateModal={false}
        >
            <h1 id="modal-title">Login<span>&nbsp;to LimeDrive</span></h1>

            <div className='all-inputs-cont'>
                <div className="input-cont">
                    <label htmlFor="username-or-email-login">Username or email</label>
                    <input
                        className="form__usernameOrEmailLog"
                        id="username-or-email-login"
                        name="usernameOrEmailLog"
                        value={formData.usernameOrEmailLog}
                        onChange={(e) => handleInputChange(e)}
                        maxLength={255}
                        autoComplete="username email"
                        spellCheck="false"
                        required
                        disabled={loading}
                        data-testid="usernameOrEmailInput"
                    />
                </div>

                <div className="input-cont">
                    <label className="password-login-label" htmlFor="password-login">Password</label>
                    <input
                        className="password-input"
                        id="password-login"
                        name="passwordLog"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.passwordLog}
                        onChange={(e) => handleInputChange(e)}
                        maxLength={72}
                        autoComplete="current-password"
                        spellCheck="false"
                        required
                        disabled={loading}
                        data-testid="passwordInput"
                    />
                    <button type="button" className="btn-icon-wrapper" onClick={togglePasswordVisibility} aria-label={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? 
                            (<BsEyeSlash className="eye-icon btn-icon" />)
                            : (<BsEye className="eye-icon btn-icon" />)
                        }
                    </button>
                </div>
            </div>

            <div className="modal-btn-cont">
                <button
                    className="modal-primary-btn"
                    type="submit"
                    disabled={loading}
                    data-testid="loginButton"
                >
                    Login
                </button>

                <div className='btn-divider-cont'>
                    <div className="btn-divider" />
                    <p>OR</p>
                    <div className="btn-divider"/>
                </div>

                <button
                    className="modal-other-btn skip-btn"
                    type="button"
                    disabled={loading}
                    onClick={()=>handleSubmit(true)}
                >
                    Skip for now
                </button>
            </div>
        </Modal>
    )
}

export default memo(LoginForm)