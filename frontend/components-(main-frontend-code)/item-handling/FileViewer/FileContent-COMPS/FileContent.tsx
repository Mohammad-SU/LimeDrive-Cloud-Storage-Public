import { memo, useEffect, useState, useRef, useCallback } from 'react'
import "./FileContent.scss"
import { useInterfaceContext } from '../../../../contexts/InterfaceContext';
import { VariableSizeList  as List } from 'react-window';
import VideoStateCont from './VideoStateCont-comp/VideoStateCont';
import { MotionProps } from 'framer-motion';

interface FileContentProps {
    fileContentUrl: string
    fileType: string
    fileName: string
    contentLoaded: boolean
    setContentLoaded: React.Dispatch<React.SetStateAction<boolean>>
    setIsSrcError: React.Dispatch<React.SetStateAction<boolean>>
    innerRef: React.RefObject<HTMLElement> // Leave as innerRef, used for printing element
    getAnimationProps: (animateCondition?: boolean, spinnerTransitionCondition?: boolean) => MotionProps
    LIST_MAX_WIDTH: number
}

function FileContent({ fileContentUrl, setIsSrcError, fileType, fileName, contentLoaded, setContentLoaded, innerRef, getAnimationProps, LIST_MAX_WIDTH }: FileContentProps) {
    const { viewportWidth } = useInterfaceContext()
    
    const [textContent, setTextContent] = useState<string[]>([]);
    const [listWidth, setListWidth] = useState(Math.min(LIST_MAX_WIDTH, viewportWidth));
    const workerRef = useRef<Worker>();
    const listRef = useRef<List>(null);
    const rowHeights = useRef<{[index: number]: number}>({});

    const handleSrcError = () => setIsSrcError(true)
    
    // setContentLoaded or start fetching text content
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        // setContentLoaded for these types, but for video and images don't straight away
        if (fileType === "application/pdf") {
            timeoutId = setTimeout(() => { // Timeout because for some reason pdf iframe may otherwise flash white at first which is annoying
                setContentLoaded(true);
            }, 1000);
        }
        else if (fileType.startsWith("audio/") || fileType === "text/html") {
            setContentLoaded(true);
        }

        // Fetch text content if the file type starts with "text/" but not html since that is handled differently
        if (fileType.startsWith("text/") && fileType !== "text/html") {
            setTextContent([]); // Clear previous content
            fetchTextContent();
        }

        return () => {
            clearTimeout(timeoutId);
            workerRef.current?.terminate();
        };
    }, [])

    const fetchTextContent = () => {
        workerRef.current = new Worker('/text-worker.js');

        workerRef.current.onmessage = (event) => {
            const { type, chunk, error } = event.data;

            if (type === 'chunk') {
                setTextContent(prev => [...prev, ...chunk.split('\n')]);
            } 
            else if (type === 'error') {
                console.error('Error fetching text content:', error);
                setIsSrcError(true);
            }
        };

        workerRef.current.postMessage({ url: fileContentUrl });
    };

    const getRowHeight = (index: number) => {
        return rowHeights.current[index] || 20;
    }

    const setRowHeight = useCallback((index: number, size: number) => {
        if (rowHeights.current[index] !== size) {
            rowHeights.current[index] = size;
            listRef.current?.resetAfterIndex(index);
        }
    }, []);

    const Row = memo(({ index, style }: { index: number, style: React.CSSProperties }) => {
        const rowRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            if (rowRef.current) {
                setRowHeight(index, rowRef.current.clientHeight);
            }
        }, [index, setRowHeight]);

        const isFirst = index === 0;
        const isLast = index === textContent.length - 1;

        const padding = viewportWidth > 530 ?
            '0 1.3rem' // Remember .text-preview already has scrollbar gutter, so it looks like the sides have more space already
            : '0 .5rem'
        
        const paddingTopAndBottom = viewportWidth > 530 ?
            '2rem'
            : '1.5rem'

        return (
            <div 
                ref={rowRef} 
                style={{ // Leave these styles inline
                    ...style, 
                    height: 'auto', 
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    padding: padding, 
                    boxSizing: 'border-box',
                    overflowX: 'hidden',
                    paddingTop: `${isFirst && paddingTopAndBottom}`,
                    paddingBottom: `${isLast && paddingTopAndBottom}`,
                }}
            >
                {textContent[index]}
            </div>
        );
    });

    useEffect(() => {
        setListWidth(Math.min(LIST_MAX_WIDTH, viewportWidth));
    }, [viewportWidth]);

    return ( // React package for this didn't seem to suit my needs, so I'm using my own implementation
        fileType.startsWith("video/") ?
            <>
                <video // Don't need a package for this
                    className={`video-preview ${contentLoaded ? '' : 'not-loaded'}`} 
                    onLoadedData={() => setContentLoaded(true)}
                    ref={innerRef as React.RefObject<HTMLVideoElement>}
                    tabIndex={0}
                    key="videoPreviewKey"
                >
                    <source 
                        src={fileContentUrl}
                        type={fileType} 
                        onError={handleSrcError} // Leave onError in source element here
                    />
                </video>
                <VideoStateCont // Putting this inside video made it not show up for some reason
                    getAnimationProps={getAnimationProps}
                />
            </>

        : fileType.startsWith("image/") ?
            <img 
                src={fileContentUrl} 
                className="img-preview"
                onLoad={() => setContentLoaded(true)}
                ref={innerRef as React.RefObject<HTMLImageElement>}
                onError={handleSrcError}
                loading="lazy"
            />

        : fileType === "application/pdf" || fileType === "text/html" ? // .htm files stil fall under text/html MIME so should be fine
            <iframe
                className="iframe-preview"
                // PDF title may be inaccurate in iframe. Was not able to fix this issue. In future use react-pdf-viewer https://react-pdf-viewer.dev/ for better controls/customisation
                // Match text preview width. Leave inline.
                width={listWidth}
                title={fileName}
                src={fileContentUrl}
                sandbox={fileType === "text/html" ? "allow-popups-to-escape-sandbox allow-popups" : undefined} // Scripts are blocked
                ref={innerRef as React.RefObject<HTMLIFrameElement>}
                tabIndex={0}
                onError={handleSrcError}
                loading="lazy"
            />

        : fileType.startsWith("audio/") ?
            <audio 
                src={fileContentUrl} 
                controls 
                className="audio-preview" 
                onLoad={() => setContentLoaded(true)}
                ref={innerRef as React.RefObject<HTMLAudioElement>}
                tabIndex={0}
                onError={handleSrcError}
            />

        : fileType.startsWith("text/") ?
            <>
                <List // For very large text, it may overlap temporarily if user scrolls down very quickly, this seems to only be temporary (and may be hard to fix)
                    className="text-preview"
                    // Leave large height - if not large enough then text preview won't be (text preview has its own height in scss)
                    // May also improve text selection issue where unrendered items get deselected, but mainly for one direction
                    // Don't use overscan count as it can cause lag
                    height={10000}
                    itemCount={textContent.length}
                    itemSize={getRowHeight}
                    // Leave width style inline
                    width={listWidth}
                    ref={listRef}
                    onItemsRendered={() => setContentLoaded(true)}
                >
                    {Row}
                </List>

            {/* 
                Originally display: none, but for print dialogue (@media print in global.scss) it is displayed.
                Very large text content is slower to appear which may temporarily freeze the UI, but it is unlikely 
                someone would print a multi-mb text file Using LimeDrive, so it's not a big issue, and as of writing 
                it is prevented if too big for UX reasons.
            */}
                <div ref={innerRef as React.RefObject<HTMLDivElement>} className='text-preview-print'>
                    {textContent.map((line, index) => (
                        <div key={index} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {line}
                        </div>
                    ))}
                </div>
            </>

        : <p>Error.</p>
    )
}

export default memo(FileContent)