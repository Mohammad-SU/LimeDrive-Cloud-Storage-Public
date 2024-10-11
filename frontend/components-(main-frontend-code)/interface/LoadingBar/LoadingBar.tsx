import { useState, useEffect, memo } from "react"
import "./LoadingBar.scss"

interface LoadingBarProps {
    loading?: boolean
    ariaLabel?: string;
}

function LoadingBar({ loading = true, ariaLabel }: LoadingBarProps) {
    return (
        loading &&
            <span className="LoadingBar" aria-label={ariaLabel} role="status">
                <span className="spinner-before loading-bar-spinner-before" aria-hidden="true"></span>
                <span className="loading-bar" aria-hidden="true"></span>
                <span className="spinner-after loading-bar-spinner-after" aria-hidden="true"></span>
            </span>
    )
}

export default memo(LoadingBar)