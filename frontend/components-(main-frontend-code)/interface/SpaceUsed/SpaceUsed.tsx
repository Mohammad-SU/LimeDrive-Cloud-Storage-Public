import { memo, useMemo } from 'react'
import "./SpaceUsed.scss"
import { useFileContext } from '../../../contexts/FileContext.tsx';

function SpaceUsed() {
    const { accountStorageUsed, accountStorageCap } = useFileContext()

    const formatBytes = (bytes: number, noDecimalPoint: boolean = false) => {
        const kb = 1024
        const mb = kb * 1024
        const gb = mb * 1024
        // In terms of SI values use KiB/MiB etc instead of KB/MB, but in UI refer to as KB/MB (historical meaning) for user friendliness (Windows and DropBox does this)
        if (bytes < mb) {
            return (bytes / kb).toFixed(noDecimalPoint ? 0 : 2) + " KB";
        } else if (bytes < gb) {
            return (bytes / mb).toFixed(noDecimalPoint ? 0 : 2) + " MB";
        } else {
            return (bytes / gb).toFixed(noDecimalPoint ? 0 : 2) + " GB";
        }
    }

    const formattedStorageUsed = useMemo(() => formatBytes(accountStorageUsed, accountStorageUsed === 0), [accountStorageUsed]);
    const formattedStorageLimit = useMemo(() => formatBytes(accountStorageCap, true), [accountStorageCap]);

    return (
        <div className="SpaceUsed">
            <h1>Space Used</h1>
            <div className="bar">
                <div className="bar-fill" style={{ width: `${(accountStorageUsed / accountStorageCap) * 100}%` }}></div>
            </div>
            <p className="label" aria-label={`${formattedStorageUsed} used out of ${formattedStorageLimit}`}>
                {formattedStorageUsed} / {formattedStorageLimit}
            </p>
        </div>
    )
}

export default memo(SpaceUsed)
