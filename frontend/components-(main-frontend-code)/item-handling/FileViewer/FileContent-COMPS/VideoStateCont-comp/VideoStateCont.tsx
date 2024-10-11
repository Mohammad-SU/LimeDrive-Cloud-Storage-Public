import { memo } from 'react'
import "./VideoStateCont.scss"
import { IoMdPlay } from 'react-icons/io';
import { MdOutlineReplay } from 'react-icons/md';
import { motion, AnimatePresence, MotionProps } from 'framer-motion';
import { useInterfaceContext } from '../../../../../contexts/InterfaceContext';

interface VideoStateContProps {
    getAnimationProps: (animateCondition?: boolean, spinnerTransitionCondition?: boolean) => MotionProps
}

function VideoStateCont({ getAnimationProps }: VideoStateContProps) {
    const { showVideoStateCont, vidIconToShow } = useInterfaceContext()

    return (
        <AnimatePresence> {/* Leave this nested AnimatePresence. Also for some reason key warning seems to happen in this nest on only first render of any file. Couldn't fix it */}
            {(vidIconToShow !== "" && vidIconToShow !== "waiting" && showVideoStateCont) ?
                <motion.div 
                    className="VideoStateCont"
                    {...getAnimationProps()} // Don't show here if waiting since the spinner below is used
                    key="videoStateContKey"
                >
                    {vidIconToShow === "play" ?
                        <motion.div {...getAnimationProps()} key="videoStatePlayKey" aria-label="Play">
                            <IoMdPlay className="icon play" />
                        </motion.div>

                    : vidIconToShow === "replay" ?
                        <motion.div {...getAnimationProps()} key="videoStateReplayKey" aria-label="Replay">
                            <MdOutlineReplay className="icon"/>
                        </motion.div>

                    : null // Pause icon not necessary and may be distracting - users likely know it's a common feature to pause videos onclick anyways
                    }
                </motion.div>

                : vidIconToShow === "waiting" ?
                    <motion.span
                        className="spinner-after video-state-spinner"
                        {...getAnimationProps(vidIconToShow === "waiting", true)}
                        key="videoStateSpinnerKey"
                        aria-label="Waiting for frame"
                    />

                : null
            }
        </AnimatePresence>
    )
}

export default memo(VideoStateCont)