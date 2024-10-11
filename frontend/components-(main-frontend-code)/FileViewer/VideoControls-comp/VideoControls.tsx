import { memo, useState, useEffect, useRef } from "react";
import './VideoControls.scss'
import { IoMdPlay, IoMdPause, IoMdSettings } from "react-icons/io";
import { IoSettingsOutline, IoVolumeHighOutline, IoVolumeMuteOutline } from "react-icons/io5";
import { MdOutlineReplay, MdFullscreen, MdFullscreenExit } from "react-icons/md";
import { AiOutlineCheck } from "react-icons/ai";
import { PiArrowArcRightLight, PiClosedCaptioningLight } from "react-icons/pi";
import { Scrubber } from 'react-scrubber';
import 'react-scrubber/lib/scrubber.css'
import { useToast } from "../../../../contexts/ToastContext";
import DynamicClip from "../../../Other-COMPS/DynamicClip";
import useDelayedExit from "../../../../hooks/useDelayedExit";
import useUnfocusPopup from "../../../../hooks/useUnfocusPopup";
import useToggleOnKey from "../../../../hooks/useToggleOnKey";
import { useInterfaceContext } from "../../../../contexts/InterfaceContext";
import useLocalStorage from "../../../../hooks/useLocalStorage";

interface VideoControlsProps {
    innerRef: React.RefObject<HTMLVideoElement>;
    isFullscreen: boolean
    setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>
}

function VideoControls({ innerRef, isFullscreen, setIsFullscreen }: VideoControlsProps) {
    const video = innerRef?.current
    if (!video) return
    const { showToast } = useToast()
    const { setShowVideoStateCont, setVidIconToShow, viewportWidth } = useInterfaceContext()
    const [isPaused, setIsPaused] = useState(video.paused); // Possibly make it more accurate instead of just setting the state to false initially, also using state to update btn icons as ref doesn't
    const [isMuted, setIsMuted] = useLocalStorage('video_muted', video.muted);
    const [isEnded, setIsEnded] = useState(video.ended);
    const [timeVal, setTimeVal] = useState(0);
    const [bufferVal, setBufferVal] = useState(0);
    const [isWaiting, setIsWaiting] = useState(false)
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [isMouseMoveScrubbing, setIsMouseMoveScrubbing] = useState(false);
    const [isVolSliding, setIsVolSliding] = useState(false);
    const [volumeSliderVal, setVolumeSliderVal] = useLocalStorage('volume_slider_val', video.volume);
    const [volSlideKeyTimeout, setVolSlideKeyTimeout] = useState<NodeJS.Timeout>();
    const [showFullscreenControls, setShowFullscreenControls] = useState(true);
    const [quality, setQuality] = useState(0);
    const [showSpeedDropdown, setShowSpeedDropdown] = useState(false)
    const [speed, setSpeed] = useState(video.playbackRate);
    const [showMoreControlsDropdown, setShowMoreControlsDropdown] = useState(false)
    const speedDropdownRef = useRef<HTMLDivElement | null>(null)
    const moreControlsDropdownRef = useRef<HTMLDivElement | null>(null)

    const { isVisible: isSpeedDropdownVisible } = useDelayedExit({
        shouldRender: showSpeedDropdown,
    });
    useUnfocusPopup(speedDropdownRef, () => {
        setShowSpeedDropdown(false);
    });

    const { isVisible: isMoreControlsDropdownVisible } = useDelayedExit({
        shouldRender: showMoreControlsDropdown,
    });
    useUnfocusPopup(moreControlsDropdownRef, () => {
        setShowMoreControlsDropdown(false);
    });

    // Add listeners for some basic video events
    useEffect(() => {
        let width = video.videoWidth; // Not used with loadedmetadata event since not needed - video controls only show up after loadedmetadata anyways
        let height = video.videoHeight;
        height > width ? // If the aspect ratio indicates a vertical video then make quality be considered width instead of height
            setQuality(width)
            : setQuality(height)

        const handleEnded = () => setIsEnded(true)

        const handleTimeUpdate = () => { // Don't need to check if isScrubbing here
            setTimeVal(video.currentTime);
        }

        const handleBufferProgress = () => { // More buffered ranges may be created when the user skips parts of the video, but the number of ranges would decrease until they reach 1 as they would combine instead of overlapping.
            for (let i = 0; i < video.buffered.length; i++) { // Update buffer value to reflect the end of the buffered range containing the current time position
                if (video.currentTime >= video.buffered.start(i) && video.currentTime <= video.buffered.end(i)) {
                    setBufferVal(video.buffered.end(i));
                    break; // Exit loop once the buffered range is found
                }
            }
        }

        const handleWaitingTrue = () => setIsWaiting(true)
        const handleWaitingFalse = () => setIsWaiting(false)

        const handleFullscreenStateChange = () => { // Escape key for exiting full screen doesn't trigger escape key event, but does trigger fullscreenchange event
            const isFullscreenNow = !!document.fullscreenElement; // Check if the document is in fullscreen mode
            setIsFullscreen(isFullscreenNow);
        }

        const handleVideoHover = () => setShowVideoStateCont(true);
        const handleMouseLeave = () => setShowVideoStateCont(false);

        if (viewportWidth <= 786) {
            // Set initially here as play button is hidden in the control bar at this breakpoint, so user will know it's paused first
            setShowVideoStateCont(true);
        }

        // Set initially to respect local storage value
        video.muted = isMuted
        video.volume = volumeSliderVal

        video.addEventListener("ended", handleEnded); // Tried using video.ended dep instead of event listener method but useEffect didn't seem to fire when the video ended
        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("progress", handleBufferProgress); // Progress event is fired when loading data/buffering
        video.addEventListener('waiting', handleWaitingTrue);
        video.addEventListener('seeking', handleWaitingTrue);
        video.addEventListener('canplay', handleWaitingFalse);
        video.addEventListener('seeked', handleWaitingFalse);
        video.addEventListener("mousemove", handleVideoHover); // Mousemove instead of mouseenter/over since mouseenter/over is not fired if the cursor is already above the video as soon as it loads, but mousemove causes the event to be fired as soon as the cursor moves slightly inside it after it loads. Also for fullscreen reasons to show video state icons after they are hidden.
        video.addEventListener("mouseleave", handleMouseLeave);
        window.addEventListener('fullscreenchange', handleFullscreenStateChange);
        return () => {
            video.removeEventListener("ended", handleEnded);
            video.removeEventListener("timeupdate", handleTimeUpdate);
            video.removeEventListener("progress", handleBufferProgress);
            video.removeEventListener('waiting', handleWaitingTrue);
            video.removeEventListener('seeking', handleWaitingTrue);
            video.removeEventListener('canplay', handleWaitingFalse);
            video.removeEventListener('seeked', handleWaitingFalse);
            video.removeEventListener("mousemove", handleVideoHover);
            video.removeEventListener("mouseleave", handleMouseLeave);
            window.removeEventListener('fullscreenchange', handleFullscreenStateChange);
        };
    }, []); // Don't need any deps for these event listeners

    // Add listeners for fullscreen constrols
    useEffect(() => {
        const handleMouseMove = () => {
            handleFullscreenControlsToggle()
            if (isScrubbing) {
                setIsMouseMoveScrubbing(true); // For pausing video when mouse moving during scrubbing
            }
        };

        let showControlsTimer: NodeJS.Timeout;
        const handleFullscreenControlsToggle = () => {
            if (!document.fullscreenElement) return // Don't add isPaused condition - users may want to see paused video frame in fullscreen unobstructed      
            setShowFullscreenControls(true);
            clearTimeout(showControlsTimer); // Clear the existing timer and start a new one
            showControlsTimer = setTimeout(() => {
                if (isScrubbing) return // In case mouse is not moving during scrubbing
                setShowFullscreenControls(false);
            }, 3E3);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mousedown", handleFullscreenControlsToggle);
        window.addEventListener("mouseup", handleFullscreenControlsToggle);
        window.addEventListener('keydown', handleFullscreenControlsToggle);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mousedown", handleFullscreenControlsToggle);
            window.removeEventListener("mouseup", handleFullscreenControlsToggle);
            window.removeEventListener('keydown', handleFullscreenControlsToggle);
            clearTimeout(showControlsTimer);
        };
    }, [isScrubbing]); // Dep here so that latest isScrubbing state is captured in event listener (similar for other useEffects that have event listeners and deps)

    // Add listeners for play/pause/replay
    useEffect(() => {
        const handlePlayToggleClick = () => {
            handlePlayPauseReplay()
        };
        const handlePlayTogglePress = (event: KeyboardEvent) => {
            // Check tagname to prevent conflict with accessability control on button
            if (event.key === 'k' || (event.key === ' ' && document.activeElement?.tagName !== 'BUTTON')) {
                handlePlayPauseReplay()
            }
        };
        video.addEventListener('click', handlePlayToggleClick);
        window.addEventListener('keydown', handlePlayTogglePress);
        return () => {
            video.removeEventListener('click', handlePlayToggleClick);
            window.removeEventListener('keydown', handlePlayTogglePress);
        };
    }, [isPaused, isEnded]);

    // Add listeners for time changing (forwards/back few seconds) controls
    useEffect(() => {
        const handleTimeChangeKey = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft' || event.key === 'j') {
                handleTimeChangeClick(false)
            } else if (event.key === 'ArrowRight' || event.key === 'l') {
                handleTimeChangeClick(true)
            }
        };
        window.addEventListener('keydown', handleTimeChangeKey);
        return () => {
            window.removeEventListener('keydown', handleTimeChangeKey);
        };
    }, [isEnded]);

    // Add more listeners for fullscreen controls
    useEffect(() => {
        const handleFullscreenKey = (event: KeyboardEvent) => {
            if (event.key === 'F11') {
                event.preventDefault()
                handleFullscreenToggle()
            }
        };
        window.addEventListener('keydown', handleFullscreenKey);
        video.addEventListener("dblclick", handleFullscreenToggle); // It still works even when backdrop is clicked for smaller videos (which is a good thing)
        return () => {
            window.removeEventListener('keydown', handleFullscreenKey);
            video.removeEventListener("dblclick", handleFullscreenToggle);
        }
    }, [isFullscreen]);

    // Hide cursor if fullscreen and no video controls
    useEffect(() => {
        if (isFullscreen && !showFullscreenControls) {
            video.style.cursor = 'none';
            setShowVideoStateCont(false)
        }
        return () => {
            video.style.cursor = 'pointer';
        };
    }, [showFullscreenControls, isFullscreen]);

    // For correct display of icons in VideoStateCont.tsx
    useEffect(() => {
        let waitingIconTimeout: NodeJS.Timeout;
        
        if (isWaiting) {
            waitingIconTimeout = setTimeout(() => { // Leave timeout in here instead of putting it in the event listener handler for isWaiting
                setVidIconToShow("waiting")
            }, 300); // For UX don't show it straight away
        } 
        else if (isEnded) {
            setVidIconToShow("replay")
        } 
        else if (isPaused) {
            setVidIconToShow("play")
        }
        else {
            setVidIconToShow("")
        }

        return () => {
            clearTimeout(waitingIconTimeout)
        }
    }, [isPaused, isEnded, isWaiting]); // isMouseMoveScrubbing doesn't seem to cause much of a performance issue

    // Add listeners for volume changing controls
    useEffect(() => {
        const handleVolumeChangeKey = (event: KeyboardEvent) => {
            const change =
                event.key === 'ArrowUp' ? 0.1 
                : event.key === 'ArrowDown' ? -0.1 
                : 0;
            let newVal = volumeSliderVal + change

            if (newVal < 0) {
                newVal = 0
            } else if (newVal > 1) {
                newVal = 1
            }
            
            if (!change || newVal === volumeSliderVal) return

            clearTimeout(volSlideKeyTimeout)
            handleVolumeChange(newVal);
            const newTimeout = setTimeout(() => setIsVolSliding(false), 1000);
            setVolSlideKeyTimeout(newTimeout);
        };
        window.addEventListener('keydown', handleVolumeChangeKey);
        return () => {
            window.removeEventListener('keydown', handleVolumeChangeKey);
        }
    }, [volumeSliderVal, isMuted]);

    const formatTime = (time: number): string => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${String(minutes).padStart(1, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    // If scrub thumbnail preview is implemented, could make it so time changes only happen on scrub end for UX
    const handleScrubVideo = (value: number) => { 
        setIsScrubbing(true)
        video.currentTime = value;
        setTimeVal(value)
        video.pause()
    }

    const handleScrubEnd = () => {
        setIsScrubbing(false)
        setIsMouseMoveScrubbing(false)
        // isPaused is opposite state to video actually paused if was originally playing
        // before scrubbing, so that the video can start playing again if it originally was.
        // That's why !isPaused is a condition to start playing
        if (isEnded || !isPaused) { 
            video.play()
            setIsEnded(false)
        }
    }

    const handlePlayPauseReplay = () => {
        if (isPaused || isEnded) {
            video.play()
            setIsPaused(false) // Don't update this state via video.ended useEffect, otherwise UI updates may appear slower
            if (isEnded) setIsEnded(false) // Don't need to change progress here as timeupdate event listener should handle that
        }
        else {
            video.pause()
            setIsPaused(true)
        }
    };

    const handleTimeChangeClick = (isForward: boolean) => {
        const newTime = isForward ? 
            video.currentTime + 5
            : video.currentTime - 5

        video.currentTime = newTime
        setTimeVal(newTime)

        if (!isForward && isEnded) {
            setIsEnded(false)
            setIsPaused(false)
            video.play()
        }
    };

    const toggleMute = () => {
        if (isMuted) {
            video.muted = false
            setIsMuted(false)
        } else {
            video.muted = true
            setIsMuted(true)
        }
    };

    const handleVolumeChange = (value: number) => {
        setIsVolSliding(true)
        if (isMuted) toggleMute()
        video.volume = value
        setVolumeSliderVal(value)
    };

    const handleSpeedChange = (speedParam: number) => {
        setSpeed(speedParam);
        video.playbackRate = speedParam;
    };

    const handleFullscreenToggle = async () => {
        const toggleFullScreen = isFullscreen ? 
            document.exitFullscreen()
            : document.documentElement.requestFullscreen();

        try {
            toggleFullScreen
            setIsFullscreen(!isFullscreen);
        } catch (error) {
            showToast({message: "Failed to go fullscreen.", showFailIcon: true})
        }
    }

    const muteBtn = () => (
        <button 
            onClick={toggleMute} 
            className="btn-icon-wrapper mute-btn"
            aria-label={isMuted ? "Unmute" : "Mute"}
        >
            {isMuted ? // Don't add volumeSliderVal === 0 condition in case user gets confused why clicking button doesn't change the icon in that case
                <IoVolumeMuteOutline className="btn-icon"/>
                : <IoVolumeHighOutline className="btn-icon"/>
            }
        </button>
    )

    const mainRightControls = ({ isDropdown = false }: { isDropdown?: boolean }) => {
        const speedText = Number.isInteger(speed) ? `${speed}.0x` : `${speed}x`

        return (
            <>
                <button 
                    onMouseDown={()=>setShowSpeedDropdown(current => !current)}
                    onKeyDown={useToggleOnKey(() => setShowSpeedDropdown(current => !current))}
                    className="btn-icon-wrapper speed-dropdown-toggle"
                    aria-label={"Change video speed"}
                >
                    {isDropdown ?
                        <>
                            <p>Speed</p>
                            <p>{speedText}</p>
                        </>
                        :
                        speedText
                    }
                </button>
                {isSpeedDropdownVisible && 
                    <div className="speed-dropdown" ref={speedDropdownRef}>
                        <p className="dropdown-title">Speed</p>
                        {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(mapSpeed => (
                            <button 
                                key={mapSpeed} 
                                onClick={() => handleSpeedChange(mapSpeed)} 
                                className={`${speed === mapSpeed ? 'active' : ''}`}
                            >
                                {speed === mapSpeed && <AiOutlineCheck className="active-speed-icon"/>}
                                <p>{Number.isInteger(mapSpeed) ? `${mapSpeed}.0` : `${mapSpeed}`}x</p>
                            </button>
                        ))}
                    </div>
                }
                <DynamicClip clipPathId="speedDropdownClip" numRects={12} animation={showSpeedDropdown}/>

                <button
                    onClick={()=>showToast({message: "Video quality control not yet featured"})} 
                    className="btn-icon-wrapper quality-btn"
                    aria-label={"Change quality"}
                >
                    {isDropdown ?
                        <>
                            <p>Quality</p>
                            <p>{quality}p</p>
                        </>
                        :
                        `${quality}p`
                    }

                </button>
                <button
                    onClick={()=>showToast({message: "Closed captions not yet featured"})} 
                    className="btn-icon-wrapper captions-btn"
                    aria-label={"Enable closed captions"}
                >
                    {isDropdown ?
                        <>
                            <p>Subtitles/CC</p>
                            <p>Off</p>
                        </>
                        :
                        <PiClosedCaptioningLight className="btn-icon"/>
                    }
                </button>
            </>
        )
    }

    return (
        <div 
            className={`VideoControls 
                ${isFullscreen && showFullscreenControls ? 'fullscreen' 
                 : isFullscreen && !showFullscreenControls ? 'fullscreen-hide-controls'
                 : ''}
            `}
        >
            <Scrubber
                className={`time-scrubber ${isScrubbing ? 'hover' : ''}`}
                min={0} // Don't need aria-valuemin if 0
                max={video.duration}
                value={timeVal}
                bufferPosition={bufferVal}
                onScrubStart={handleScrubVideo}
                onScrubChange={handleScrubVideo}
                onScrubEnd={handleScrubEnd}
                // onMouseMove={handleScrubberVideoPreview}
                // onMouseLeave={() => setIsScrubMouseMoving(false)}
                tooltip={{ 
                    enabledOnHover: true,
                    formatString: (value: number) => formatTime(value),
                }}
                aria-valuemax={formatTime(video.duration)}
                aria-valuenow={formatTime(timeVal)}
                aria-label={"Time scrubber"} // Don't include buffer aria label since it might be too much info due to multiple ranges
            />

            <div className="left-controls-cont">
                <button 
                    onClick={handlePlayPauseReplay} 
                    className="play-pause-replay btn-icon-wrapper"
                    aria-label={
                        isEnded ? 'Replay' 
                        : isPaused || isMouseMoveScrubbing ? 'Play'
                        : "Pause"
                    }
                >
                    {isEnded ?
                        <MdOutlineReplay className="btn-icon"/>
                    : isPaused || isMouseMoveScrubbing ? // Use state instead of ref values directly for quicker update, also isMouseMoveScrubbing is there to show user it's paused during scrubbing mouse movements instead of changing isPaused state so that a single-click scrub doesn't show that it's paused
                        <IoMdPlay className="btn-icon play-icon"/>
                    :  
                        <IoMdPause className="btn-icon pause-icon"/> 
                    }
                </button>

                <button 
                    onClick={()=>handleTimeChangeClick(false)}
                    className="btn-icon-wrapper time-change-btn"
                    aria-label={"Go backward 5 seconds"}
                >
                    <PiArrowArcRightLight className="btn-icon mirrored"/>
                    <p className="backward-time-change-num">5</p>
                </button>
                <button 
                    onClick={()=>handleTimeChangeClick(true)} 
                    className="btn-icon-wrapper time-change-btn"
                    aria-label={"Go forward 5 seconds"}
                >
                    <PiArrowArcRightLight className="btn-icon"/>
                    <p className="forward-time-change-num">5</p>
                </button>

                <div className="volume-cont">
                    {muteBtn()}
                    <Scrubber // Used scrubber here since range input element is more of a pain to style
                        className={`volume-slider ${isVolSliding ? 'hover' : ''}`}
                        min={0}
                        max={1}
                        value={volumeSliderVal}
                        aria-valuemax={1}
                        aria-valuenow={volumeSliderVal}
                        aria-label={"Volume slider"}
                        onScrubStart={handleVolumeChange}
                        onScrubChange={handleVolumeChange}
                        onScrubEnd={() => setIsVolSliding(false)}
                    />
                </div>
            </div>

            <div className="time-display">
                <span aria-label="Current video time">{formatTime(video.currentTime)}</span>
                <span aria-hidden="true">/</span>
                <span aria-label="Total duration">{formatTime(video.duration)}</span>
            </div>

            <div className="right-controls-cont">
                {mainRightControls({isDropdown: false})}
                {muteBtn()}

                <button 
                    className='btn-icon-wrapper more-controls-btn' 
                    aria-label='More controls'  
                    onMouseDown={()=>setShowMoreControlsDropdown(!showMoreControlsDropdown)}
                    onKeyDown={useToggleOnKey(() => setShowMoreControlsDropdown(current => !current))}
                >
                    <IoSettingsOutline className='btn-icon'/> {/* Leave as filled icon to make it prominent */}
                </button>
                {isMoreControlsDropdownVisible &&
                    <div 
                        className='more-controls-dropdown' 
                        ref={moreControlsDropdownRef}
                    >
                        {mainRightControls({isDropdown: true})}
                    </div>
                }
                <DynamicClip clipPathId="VideoControlsMoreControlsDropdownClip" animation={showMoreControlsDropdown} numRects={6} />
                
                <button
                    onClick={handleFullscreenToggle} 
                    className="btn-icon-wrapper"
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                    {isFullscreen ?
                        <MdFullscreenExit className="btn-icon"/>
                        : <MdFullscreen className="btn-icon"/>
                    }
                </button>
            </div>
        </div>
    );
}

export default memo(VideoControls);