import { memo, useEffect, useState, useRef } from 'react';
import LoadingPage from './LoadingBar-COMPS/LoadingPage-comp/LoadingPage';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useUserContext } from '../../contexts/UserContext';
import axios from 'axios';

function VerifyEmail() {
    const location = useLocation()
    const navigate = useNavigate()
    const { api } = useUserContext()
    const [searchParams, setSearchParams] = useSearchParams();
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState("")
    const verifyEmailCalled = useRef(false); // Prevent react strict mode from calling it again

    const verifyEmail = async (userId: number, verifyEmailKey: string) => {
        try {
            verifyEmailCalled.current = true;

            await api.post('/verifyEmail', {
                userId: userId,
                verifyEmailKey: verifyEmailKey
            });

            setMessage("Email verified successfully. You can leave this page.")
            setLoading(false)
        }
        catch (error) {
            console.error(error);
            if (!axios.isAxiosError(error)) return
            const errorMsg = error?.response?.data.message

            if (errorMsg === "Invalid verification link.") {
                setMessage(errorMsg)
                setLoading(false)
            }
            else if (errorMsg === "Email already verified.") {
                setMessage("Email already verified. Redirecting in a few seconds...")
                setTimeout(() => {
                    navigate("/auth")
                }, 3000)
            }
            else {
                setMessage("Error. Please check your connection and refresh the page, or try again later.")
                setLoading(false)
            }
        }
    }

    useEffect(()=> {
        if (verifyEmailCalled.current) return
        document.title = "Verify – LimeDrive"

        const userId = searchParams.get("id")
        const verifyEmailKey = searchParams.get("key")

        if (location.pathname.length > 255 || !userId || !verifyEmailKey) {
            setMessage("Invalid verification link.")
        } else {
            setMessage("Verifying email...")
            setLoading(true)
            verifyEmail(parseInt(userId), verifyEmailKey)
        }
    }, [])

    return (
        <LoadingPage message={message} loading={loading} doNotChangeTitle={true}/>
    );
}

export default memo(VerifyEmail);