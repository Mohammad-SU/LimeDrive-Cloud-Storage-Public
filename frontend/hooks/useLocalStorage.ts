import { useState, useEffect } from "react"

function getSavedValue<T>(key: string, defaultValue: T | (() => T)): T {
    const savedValue = localStorage.getItem(key);

    if (savedValue !== null) {
        try {
            return JSON.parse(savedValue);
        } catch {
            // If parsing fails, return the default value
            return defaultValue instanceof Function ? defaultValue() : defaultValue;
        }
    }

    return defaultValue instanceof Function ? defaultValue() : defaultValue;
}

export default function useLocalStorage<T>(key: string, defaultValue: T | (() => T)) {
    const [value, setValue] = useState<T>(() => {
        return getSavedValue(key, defaultValue)
    })

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value))
    }, [value])

    return [value, setValue] as const;
}