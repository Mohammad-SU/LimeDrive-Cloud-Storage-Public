import { useEffect } from 'react';

function useUnfocusPopup(ref: React.RefObject<HTMLElement>, callback: () => void) {
    function handleMousedownOutside(event: MouseEvent) {
        if (ref.current && !ref.current.contains(event.target as HTMLElement)) {
            callback();
        }
    }

    function handleEscapeKey(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            callback();
        }
    }

    useEffect(() => {
        window.addEventListener('mousedown', handleMousedownOutside);
        window.addEventListener('keydown', handleEscapeKey);

        return () => {
            window.removeEventListener('mousedown', handleMousedownOutside);
            window.removeEventListener('keydown', handleEscapeKey);
        };
    }, []);
}

export default useUnfocusPopup;