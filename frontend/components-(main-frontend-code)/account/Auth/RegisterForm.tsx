import { useState, memo } from 'react'
import axios from 'axios'
import "./Form.scss"
import { useUserContext } from '../../contexts/UserContext';
import { useNavigate } from "react-router-dom";
import { useFormLogic } from "../../hooks/useFormLogic.ts"
import { BsEye, BsEyeSlash } from 'react-icons/bs'
import Modal from '../Modal-COMPS/Modal.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';

interface RegisterFormProps {
    loading: boolean
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

function RegisterForm({ loading, setLoading }: RegisterFormProps) {          
    const { formData, handleInputChange } = useFormLogic({
        emailReg:'',
        usernameReg: '',
        passwordReg: '',
        passwordReg_confirmation: '',
    })
    const { fetchUserDataViaAuthForm, setRememberUser } = useUserContext();
    const navigate = useNavigate();
    const { showToast, closeCurrentToast } = useToast();
    
    const isEmailValid = /^\S+@\S+\.\S+$/.test(formData.emailReg)
    const isUsernameValid = /^[a-zA-Z0-9_-]+$/.test(formData.usernameReg)
    const isPasswordValid = formData.passwordReg.length >= 8
    const isPasswordMatch = formData.passwordReg === formData.passwordReg_confirmation

    const showError = (backendErrorMsg: string) => {
        const toastMessage =             
            !isEmailValid || backendErrorMsg.startsWith("Invalid email format.") ? 
                'Invalid email format.'
            : !isUsernameValid ? 
                'Invalid username format.'
            : formData.passwordReg.trim() === '' ? 
                'Password must not be empty.'
            : formData.passwordReg_confirmation.trim() === '' ? 
                'Password confirmation must not be empty.'
            : !isPasswordValid ? 
                'Password must have at least 8 characters.'
            : !isPasswordMatch ? 
                'Password and confirmation do not match.' 
            : backendErrorMsg.startsWith("Email is taken.") ? 
                "Email is taken."
            : backendErrorMsg.startsWith("Username is taken.") ? 
                "Username is taken."
            : backendErrorMsg ? 
                'Error. Check connection or try again later.'
            : 'Error. Check connection or try again later.'

        if (toastMessage) showToast({message: toastMessage, showFailIcon: true, duration: 2000})
    }

    const handleSubmit = async (generateUser: boolean = false) => {
        if (loading) return
        if (!generateUser && (!isEmailValid || !isUsernameValid || !isPasswordValid || !isPasswordMatch)) {
            return showError("")
        }

        setLoading(true)

        generateUser ?
            showToast({message: "Generating an account for you...", loading: true})
            : showToast({message: "Processing registration...", loading: true})

        try {
            await (
                generateUser ?
                    fetchUserDataViaAuthForm({generateUser: true})
                    : fetchUserDataViaAuthForm({registerUser: true, formData: formData}) // Also gets csrf token
            )

            setRememberUser(true) // For now this will always be set to true here, in future may add checkbox
            closeCurrentToast()
            navigate("/LimeDrive")
        }
        catch (error) {
            console.error(error)
            if (axios.isAxiosError(error)) {
                showError(error?.response?.data.message)
            }
        } 
        finally {
            setLoading(false)
        }
    }

    const [showPassword, setShowPassword] = useState<boolean>(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false)
    function togglePasswordVisibility() {setShowPassword(!showPassword)}
    function toggleConfirmPasswordVisibility() {setShowConfirmPassword(!showConfirmPassword)}
    
    return (
        <Modal
            className="auth-modal register-modal"
            render={true}
            onSubmit={()=>handleSubmit()}
            showCloseBtn={false}
            showBackdrop={false}
            animateModal={false}
        >
            <h1 id="modal-title">Create account</h1>

            <div className='all-inputs-cont'>
                <div className="input-cont">
                    <label htmlFor="email-register">Email</label>
                    <input
                        id="email-register"
                        name="emailReg"
                        value={formData.emailReg}
                        onChange={(e) => handleInputChange(e)}
                        maxLength={255}
                        autoComplete="email"
                        spellCheck="false"
                        required
                        disabled={loading}
                    />
                </div>

                <div className="input-cont">
                    <label htmlFor="username-register">Username</label>
                    <input
                        id="username-register"
                        name="usernameReg"
                        value={formData.usernameReg}
                        onChange={(e) => handleInputChange(e)}
                        maxLength={30}
                        placeholder="Can use a-z, A-Z, 0-9, -, _"
                        aria-placeholder="Can use alphanumeric characters, hyphens, and dashes"
                        autoComplete="username"
                        spellCheck="false"
                        required
                        disabled={loading}
                    />
                </div>

                <div className="input-cont">
                    <label htmlFor="password-register">Password</label>
                    <input
                        className='password-input'
                        id="password-register"
                        name="passwordReg"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.passwordReg}
                        onChange={(e) => handleInputChange(e)}
                        maxLength={72} // 72 max length due to bcrypt limit
                        placeholder="Minimum 8 characters"
                        aria-placeholder="Must use 8 characters"
                        autoComplete="new-password"
                        spellCheck="false"
                        required
                        disabled={loading}
                    />
                    <button type="button" className="btn-icon-wrapper" onClick={togglePasswordVisibility} aria-label={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? 
                            (<BsEyeSlash className="eye-icon btn-icon" />)
                            : (<BsEye className="eye-icon btn-icon" />)
                        }
                    </button>
                </div>

                <div className="input-cont">
                    <label htmlFor="password-confirmation">Confirm password</label>
                    <input
                        className='password-input'
                        id="password-confirmation"
                        name="passwordReg_confirmation"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.passwordReg_confirmation}
                        onChange={(e) => handleInputChange(e, 72)}
                        maxLength={72}
                        spellCheck="false"
                        required
                        disabled={loading}
                    />
                    <button type="button" className="btn-icon-wrapper" onClick={toggleConfirmPasswordVisibility} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                        {showConfirmPassword ? 
                            (<BsEyeSlash className="eye-icon btn-icon"/>)
                            : (<BsEye className="eye-icon btn-icon"/>)
                        }
                    </button>
                </div>
            </div>

            <div className="modal-btn-cont">
                <button
                    className="modal-primary-btn"
                    type="submit"
                    disabled={loading}
                >
                    Register
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

export default memo(RegisterForm)