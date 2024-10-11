import { memo, useState, useEffect } from "react"
import "./LoadingBar.scss"

interface ProgressBarProps {
    progress: null | number
    maxSteps?: number;
    showFinalizing?: boolean
    ariaLabel?: string;
}

function ProgressBar({ progress, maxSteps = 20, showFinalizing, ariaLabel }: ProgressBarProps) {
    const [filled, setFilled] = useState("")
    const [empty, setEmpty] = useState("-".repeat(maxSteps)) // set initially

    useEffect(() => {
        if (progress !== null) {
            const filledSteps = Math.round((progress / 100) * maxSteps)
            const emptySteps = maxSteps - filledSteps
        
            setFilled("#".repeat(filledSteps))
            setEmpty("-".repeat(emptySteps))
        }
    }, [progress, maxSteps]) // Max steps may change if viewport is resized so included in deps

    return (
        progress !== null &&
            <span className="LoadingBar">
                <span className="spinner-before loading-bar-spinner-before" aria-hidden="true"></span>
                {showFinalizing ? 
                    <span className="finalizing-text" role="status" aria-live="polite">
                        Finalizing...
                    </span> 
                    : 
                    <span 
                        className="progress-bar"    
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={ariaLabel}
                    >
                        {`[${filled}${empty}]`}
                    </span>
                }
                <span className="spinner-after loading-bar-spinner-after" aria-hidden="true"></span>
            </span>
    )
}

export default memo(ProgressBar)