import { memo, useState, useEffect, useRef } from 'react';

// This is the clip animation used in dropdowns in LimeDrive

interface DynamicClipProps {
    clipPathId: string;
    animation: boolean;
    numRects: number;
    incrementProportion?: number;
    animationDuration?: number;
}

function DynamicClip({ // Multiple elements can use the same DynamicClip if the timing (not animationDuration) and numRects needs are the same
    numRects,
    incrementProportion = 0.05,
    animationDuration = 200,
    clipPathId,
    animation,
}: DynamicClipProps) { // To get the animation to work, make sure clip-path: url(#clipPathID); is set in desired element's css, and for the reverse/closing animation make sure useDelayedExit hook is used
    if (incrementProportion < 0 || incrementProportion > 1) {
        throw new Error("incrementProportion must be in range of 0 to 1.");
    }
    
    const rectHeight = 1 / numRects;
    const intervalDuration = animationDuration / (1 / incrementProportion);
    const isOdd = (num: number) => num % 2 !== 0;
    
    const [clipPathValues, setClipPathValues] = useState(
        Array.from({ length: numRects }, (_, index) => ({
            width: isOdd(index) ? 1 : 0, // Note that "odd" here is based on the zero-based array, so in the html this would actually apply to what you may consider "even" elements
            x: isOdd(index) ? 1 : 0,
            y: index * rectHeight,
        }))
    );

    const [showClip, setShowClip] = useState(true);
    const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

    useEffect(() => {
        setShowClip(true)
        intervalRef.current = setInterval(() => {
            setClipPathValues((prevValues) =>
                prevValues.map((value, index) => {
                    if (animation) { // Increment width and decrement x while staying within bounds
                        const newWidth = Math.min(value.width + incrementProportion, 1);
                        const newX = Math.max(value.x - incrementProportion, 0);
                        return {
                            width: !isOdd(index) ? newWidth : value.width,
                            x: isOdd(index) ? newX : value.x,
                            y: value.y,
                        };
                    } 
                    else { // (reverse animation) Decrement width and increment x while staying within bounds
                        const newWidth = Math.max(value.width - incrementProportion, 0);
                        const newX = Math.min(value.x + incrementProportion, 1);
                        return {
                            width: !isOdd(index) ? newWidth : value.width,
                            x: isOdd(index) ? newX : value.x,
                            y: value.y,
                        };
                    }
                })
            );
        }, intervalDuration);

        return () => {
            clearInterval(intervalRef.current);
        };
    }, [animation]);
    
    useEffect(() => { // Leave stop condition in separate useeffect, otherwise interval keeps running
        if ((animation && clipPathValues[0].width >= 1) || (!animation && clipPathValues[0].width <= 0)) {
            clearInterval(intervalRef.current);
            if (clipPathValues[0].width >= 1) {
                setShowClip(false)
            }
        }
    }, [clipPathValues]);

    return (
        showClip && // Hide after opening animation is over due to it causing parts of elements to randomly disappear for some reason if not hidden afterwards
            <svg width="0" height="0" style={{position: "absolute", zIndex: 9999}}>
                <defs>
                    <clipPath id={clipPathId} clipPathUnits="objectBoundingBox">
                        {clipPathValues.map((value, index) => (
                            <rect
                                key={index}
                                x={value.x.toFixed(3)}
                                y={value.y.toFixed(5)}
                                width={value.width.toFixed(3)}
                                height={rectHeight.toFixed(5)}
                            />
                        ))}
                    </clipPath>
                </defs>
            </svg>
    );
}

export default memo(DynamicClip);