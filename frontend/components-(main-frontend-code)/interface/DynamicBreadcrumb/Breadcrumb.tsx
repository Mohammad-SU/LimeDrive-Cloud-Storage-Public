import { memo, useState, useEffect, useRef } from 'react';
import "./Breadcrumb.scss"
import { debounce } from 'lodash'
import useUnfocusPopup from '../../../hooks/useUnfocusPopup';
import useDelayedExit from '../../../hooks/useDelayedExit';
import DynamicClip from '../../Other-COMPS/DynamicClip';
import { BsThreeDots } from 'react-icons/bs';
import { Link } from 'react-router-dom';

interface BreadcrumbProps {
    path: string;
    setPath: React.Dispatch<React.SetStateAction<string>>;
    btnType?: boolean;
}

function Breadcrumb({ path, setPath, btnType }: BreadcrumbProps) {
    const pathSegments = path.split('/').filter(segment => segment.trim() !== '');
    const [showDropdown, setShowDropdown] = useState(false);
    const [visibleSegments, setVisibleSegments] = useState<string[]>([]);
    const [hiddenSegments, setHiddenSegments] = useState<string[]>([]);
    const breadcrumbRef = useRef<HTMLElement | null>(null);
    const dropdownRef = useRef<HTMLButtonElement | null>(null);
    const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);
    const btnSegmentRef = useRef<(HTMLDivElement | null)>(null);
    const lastSegmentMainRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
    const lastDividerRef = useRef<HTMLSpanElement | null>(null);
    const [isOverflowControlReady, setIsOverflowControlReady] = useState(false);
    const [refresh, setRefresh] = useState(false);

    useUnfocusPopup(dropdownRef, () => {
        setShowDropdown(false);
    });
    const { isVisible: isDropdownVisible } = useDelayedExit({
        shouldRender: showDropdown
    })

    const overflowControl = () => { // If breadcrumb is long then it may flash when updating, but this is hard to fix so leave as is
        setIsOverflowControlReady(false);
        setVisibleSegments(pathSegments) // Leave this just in case
        setShowDropdown(false)

        // Delayed to make sure segmentWidths are accurately updated. Don't use requestAnimationFrame
        setTimeout(() => { 
            // For keeping the would-be total width of all text segments including the '/' dividers, regardless if the segments are hidden or visible
            // Keep in mind that resizing viewport upwards may not immediately uncollapse 
            // breadcrumb even if it was originally uncollpased.
            // As in, it may need to be higher than uncollpased width to uncollapse.
            // This is likely due to btnSegmentRef (harcoding its approx width fixed the issue), but don't hardcode the btnSegment width in calculations as it can be different
            let totalWidth = 0; 

            // Max width the actual text segments can be, including the '/' dividers.
            const maxWidth = breadcrumbRef.current!.getBoundingClientRect().width 
                - (btnSegmentRef?.current?.getBoundingClientRect()?.width || 0)
                - 20 // Buffer, may be inaccurate without this

            const segmentWidths = segmentRefs.current!.map(ref => {
                    if (ref) {
                        const rect = ref.getBoundingClientRect();
                        return rect.width;
                    }
                    return 0;
                })
                .filter(width => width !== 0);

            if (lastSegmentMainRef.current && lastDividerRef.current) {
                segmentWidths.push(lastSegmentMainRef.current.getBoundingClientRect().width + lastDividerRef.current.getBoundingClientRect().width);
            }

            for (let i = 0; i < segmentWidths.length; i++) {
                totalWidth += segmentWidths[i];
            }
            if (totalWidth > maxWidth) {
                let sum = 0;
                let visible = [];
                let hidden = [];
                for (let i = segmentWidths.length - 1; i >= 0; i--) {
                    sum += segmentWidths[i];
                    if (sum > maxWidth) {
                        hidden.unshift(pathSegments[i]);
                    } 
                    else {
                        visible.unshift(pathSegments[i]);
                    }
                }
                if (visible.length === 0) { // If no visible then get last hidden (so that at least 1 segment is always visible, even if text-overflow with elipses)
                    visible.push(hidden.pop() || '');
                }
                setVisibleSegments(visible);
                setHiddenSegments(hidden);
            }
            else {
                setVisibleSegments(pathSegments);
                setHiddenSegments([]);
            }

            setIsOverflowControlReady(true)
        }, 1);
    };

    useEffect(() => {
        overflowControl();
    }, [path, btnSegmentRef, refresh]);

    useEffect(() => { // useLayoutEffect didn't fix some issues, so I opted for forcing refresh with timeout
        const debouncedResize = debounce(() => {
            setRefresh(current => !current) // Calling overflowControl() here instead may cause path prop to be inaccurate
        }, 100)

        const resizeObserver = new ResizeObserver(debouncedResize)

        if (breadcrumbRef.current) {
            resizeObserver.observe(breadcrumbRef.current);
        }

        setTimeout(() => { // For some reason needed to force the other useeffect to run again after initial page load otherwise breadcrumb didn't look correct if overflowing initially
            setRefresh(!refresh)
        }, 1);

        return () => {
            debouncedResize.cancel()
            setTimeout(() => { // For some reason it caused issues to not cleanup with timeout
                resizeObserver.disconnect();
            }, 1)
        };
    }, []);

    return (
        <nav className={`Breadcrumb ${isOverflowControlReady ? '' : 'transparent'}`} ref={breadcrumbRef}>
            {hiddenSegments.length > 0 && 
                <>
                    <div className='btn-segment' ref={btnSegmentRef}>
                        <button 
                            className="btn-icon-wrapper" 
                            onMouseDown={() => setShowDropdown(current => !current)}
                        >
                            <BsThreeDots className="dots-icon btn-icon"/>
                        </button>
                        <span className="divider">/</span>
                    </div>
                    {isDropdownVisible &&
                        <nav className="dropdown" ref={dropdownRef}>
                            {hiddenSegments.map((segment, index) => {
                                const linkToPath = `/${pathSegments.slice(0, index + 1).join('/')}`;

                                const commonAttributes = {
                                    onClick: (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
                                        const isAnchor = (event.target as HTMLElement).tagName === 'A';
                                        if (path !== linkToPath && (!isAnchor || (!event.shiftKey && !event.ctrlKey))) { // Ignore key press conditions if not anchor type
                                            setPath(linkToPath.substring(1) + "/");
                                        }
                                    },
                                    tabIndex: 0,
                                };
                                
                                if (btnType) {
                                    return (
                                        <button className="item" key={index} {...commonAttributes}>
                                            {segment}
                                        </button>
                                    );
                                } 
                                else {
                                    return (
                                        <Link className="dropdown-btn-link" to={(linkToPath).replace(/[^\/]+/g, (match) => encodeURIComponent(match))} key={index} tabIndex={0}>
                                            <button className="item" {...commonAttributes} tabIndex={-1}>
                                                    {segment}
                                            </button>
                                        </Link>
                                    );
                                }
                            })}
                            <DynamicClip
                                clipPathId={"breadcrumbDropdownClip"}
                                animation={showDropdown}
                                numRects={Math.min(hiddenSegments.length + 1, 7)}
                            />
                        </nav>
                    }
                </>
            }

            {!isOverflowControlReady && <span className="zero-width-space">​</span> /* Prevent large layout shift before ready and also not copyable */}

            {visibleSegments.map((segment, index) => {
                const isLastNonRootSegment = index === pathSegments.length - 1 && pathSegments.length > 1;
                const linkToPath = `/${pathSegments.slice(0, hiddenSegments.length + index + 1).join('/')}`;
                const commonAttributes = {
                    onClick: (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
                        const isAnchor = (event.target as HTMLElement).tagName === 'A';
                        if (path !== linkToPath && (!isAnchor || (!event.shiftKey && !event.ctrlKey))) { // Ignore key press conditions if not anchor type
                            setPath(linkToPath.substring(1) + "/");
                        }
                    },
                    tabIndex: 0, // Still allow tabbing if isLastNonRootSegment
                    title: isLastNonRootSegment ? segment : undefined
                };

                return (
                    <div 
                        className="item" 
                        key={index} 
                        ref={isLastNonRootSegment ? null : el => segmentRefs.current[index] = el}
                    >
                        {index === 0 ? null : <span className="divider" ref={isLastNonRootSegment ? lastDividerRef : null}>/</span>}

                        {btnType ?
                            <button 
                                className="text-btn-no-underline" 
                                {...commonAttributes} 
                                ref={isLastNonRootSegment ? (lastSegmentMainRef as React.RefObject<HTMLButtonElement>) : null}
                            >
                                {segment} {/* Do not use decodeURIComponent in the inner text (not needed - and user may manually create folders that may seem encoded when they are not)*/}
                            </button>
                            :
                            <Link 
                                to={(linkToPath).replace(/[^\/]+/g, (match) => encodeURIComponent(match))} 
                                {...commonAttributes}
                                ref={isLastNonRootSegment ? (lastSegmentMainRef as React.RefObject<HTMLAnchorElement>) : null}
                            >
                                {segment}
                            </Link>
                        }
                    </div>
                )
            })}
        </nav>
    );
}

export default memo(Breadcrumb);