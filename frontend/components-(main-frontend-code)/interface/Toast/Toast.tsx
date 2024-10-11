import { useEffect, memo } from 'react';
import './Toast.scss';
import { ToastOptions } from '../../../contexts/ToastContext';
import { AiOutlineCheck, AiOutlineExclamation } from 'react-icons/ai';

interface ToastProps extends ToastOptions {
    onClose: () => void;
}

function Toast({
    message,
    duration = 4500,
    loading,
    showRetry,
    showUndo,
    showSuccessIcon,
    showFailIcon,
    onClose,
}: ToastProps) {    
    
    useEffect(() => {
        if (message && !loading) {
            const timeoutId = setTimeout(() => {
                onClose()
            }, showFailIcon ? duration * 1.7 : duration);
            
            return () => clearTimeout(timeoutId);
        }
    }, [message, loading]);

    return (
        <div className="Toast" role="alert" aria-live={showFailIcon ? "assertive" : "polite"}>
            {loading ? 
                    <span className="spinner-before toast-spinner"></span>
                    : showFailIcon ?
                    <AiOutlineExclamation className="toast-icon fail"/>
                : showSuccessIcon ?
                    <AiOutlineCheck className="toast-icon" />
                : null
            }

            {message}

            {loading ?
                <span className="spinner-after toast-spinner" aria-hidden="true"></span>
                :
                <div className="btn-wrapper">
                    {showRetry ?
                            <button className="text-btn">Retry</button>
                        : showUndo ?
                            <button className="undo-btn text-btn">Undo</button>
                        : null
                    }
                    <button 
                        className={`close-btn text-btn ${!showRetry && !showUndo ? 'decrease-gap' : ''}`}
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            }
        </div>
    );
}

export default memo(Toast)