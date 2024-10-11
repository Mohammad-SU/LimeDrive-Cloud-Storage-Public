import { KeyboardEvent } from 'react';

const useToggleOnKey = (handler: (event: KeyboardEvent) => void) => {
    return (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            handler(event);
        }
    };
};

export default useToggleOnKey;