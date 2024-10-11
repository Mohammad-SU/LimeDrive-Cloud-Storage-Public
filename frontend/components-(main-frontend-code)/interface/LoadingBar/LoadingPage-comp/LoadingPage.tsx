import "./LoadingPage.scss"
import LoadingBar from "../LoadingBar";
import Watermark from "../../Watermark";

interface LoadingPageProps {
    message: string
    loading: boolean
    doNotChangeTitle?: boolean
}

function LoadingPage({message, loading, doNotChangeTitle = false}: LoadingPageProps) {
    if (!doNotChangeTitle) {
        document.title = "LimeDrive"
    }

    return (
        <div className="LoadingPage">
            <div className={`wrapper ${!loading ? "not-loading" : ''}`}>
                <p>{message}</p>
                <LoadingBar loading={loading} /> {/* Doesn't render if loading is false */}
                <p className='warning'>
                    Accounts may be automatically deleted for space. Don't upload important files.
                </p>
            </div>
            <Watermark />
        </div>
    )
}

export default LoadingPage;