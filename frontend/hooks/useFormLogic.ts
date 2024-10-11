import { useState, ChangeEvent, useMemo } from 'react';

export function useFormLogic<T>(initialState: T, callback?: (event: ChangeEvent<HTMLInputElement>) => void) {
    const [formData, setFormData] = useState<T>(initialState);

    const handleInputChange = (
        event: ChangeEvent<HTMLInputElement>,
        maxLength?: number
    ) => {
        const { name, value } = event.target;
        const trimmedValue = maxLength ? value.slice(0, maxLength) : value; // Enforce max length more, in case user manually tampers with the attribute

        setFormData((prevData: T) => ({
            ...prevData,
            [name]: trimmedValue,
        }));

        if (callback) {
            callback(event);
        }
    }

    const resetFormData = () => {
        setFormData(initialState);
    }

    const memoizedFormData = useMemo(() => formData, [formData]);

    return { formData: memoizedFormData, handleInputChange, resetFormData };
}