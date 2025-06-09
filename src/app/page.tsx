'use client'; // Required for useEffect and useState

import { useState, useEffect, useRef, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window'; // Import react-window
import { Play, Pause, Volume2, VolumeX, SkipForward, Rewind, Undo2, Redo2 } from 'lucide-react'; // Import icons for play/pause and volume, and skip/rewind
import { Button } from "@/components/ui/button"; // Assuming you have Button component
// import Aurora from '@/components/Aurora'; // Import the Aurora component - COMMENTED OUT
import WaveSurfer from 'wavesurfer.js'; // Import WaveSurfer

// Define an interface for the demo data structure
interface Demo {
  fileName: string;
  relativePath: string;
  timestamp: string; // ISO string format
}

// --- Control Flag ---
const ENABLE_DOWNLOADS = false; // Set to true to re-enable downloads

// Helper function to format the timestamp (optional, but nice)
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.ceil(diffTime / (1000 * 60));

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays <= 7) {
     return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
     // Simple date format for older entries
     return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

// Basic function to clean up the filename for display
function cleanFileName(fileName: string): string {
    // Remove .mp3 extension
    let cleaned = fileName.replace(/\.mp3$/i, '');
    // Replace underscores/hyphens with spaces (optional)
    cleaned = cleaned.replace(/[_-]/g, ' ');
    // Add more cleaning rules if needed (e.g., for mood tags later)
    return cleaned;
}

// Helper to format time in seconds to MM:SS
const formatTime = (time: number) => {
    if (isNaN(time)) return '00:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// --- React Window Row Component ---
const Row = ({ index, style, data }: { index: number; style: React.CSSProperties; data: { demos: Demo[]; handlePlayClick: (index: number) => void; currentPlayingIndex: number | null; isPlaying: boolean; enableDownloads: boolean } }) => {
    const { demos, handlePlayClick, currentPlayingIndex, isPlaying, enableDownloads } = data;
    const demo = demos[index];
    const isActive = index === currentPlayingIndex;

    return (
        <div style={style}>
            <div
                className={`p-4 pb-4 border rounded-lg shadow-sm h-full flex flex-col ${isActive ? 'border-yellow-400 bg-gray-800' : 'border-gray-700 bg-gray-900 hover:bg-gray-800'} opacity-75 transition-colors duration-200 cursor-pointer`}
                onClick={() => handlePlayClick(index)}
            >
                {/* Top section: Title and Timestamp */}
                <div>
                    <h2 className="text-xl font-mono font-semibold mb-2 truncate" title={cleanFileName(demo.fileName)}>
                        {cleanFileName(demo.fileName)}
                    </h2>
                     {/* Reduced margin-bottom */}
                    <p className="text-sm text-gray-400 mb-2">
                        exported {formatTimestamp(demo.timestamp)}
                    </p>
                 </div>

                 {/* Controls section: Removed mt-2 */}
                <div className="flex items-center gap-3">
                    {/* Play/Pause Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click from firing
                          handlePlayClick(index);
                        }}
                        className="text-white hover:bg-gray-700 p-1.5"
                    >
                        {isActive && isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                         {/* Added span for styling */}
                        <span className="lowercase font-mono">
                             {isActive && isPlaying ? 'Pause' : 'Play'}
                        </span>
                    </Button>

                    {/* Conditionally render the Download Link based on the flag */}
                    {enableDownloads && (
                         <a
                            href={demo.relativePath}
                            download={demo.fileName}
                            className="text-blue-400 hover:underline font-mono text-sm p-1.5"
                         >
                            download mp3
                         </a>
                    )}
                </div>
            </div>
        </div>
    );
};
// --- End React Window Row Component ---

// Define the colors outside the component for stable reference
// Updated colors to match theme: Navy Blue, Gray, Yellow
// const auroraColorStops = ["#FBBF24", "#FFFFFF", "#FBBF24"]; // COMMENTED OUT

export default function HomePage() {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null); // Ref for the SINGLE audio player
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the list container
  const [listHeight, setListHeight] = useState(600); // Default height, will update
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number | null>(null); // Track index instead of element
  const [isPlaying, setIsPlaying] = useState<boolean>(false); // Track playing state
  // New state for player UI
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  // Ref for throttling time updates
  const timeUpdateThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null); // Ref for WaveSurfer container
  const wavesurferInstanceRef = useRef<WaveSurfer | null>(null); // Ref for WaveSurfer instance
  // Mobile Detection State
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [isFadingWaveform, setIsFadingWaveform] = useState<boolean>(false); // State for fade effect
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref to manage fade timeout
  const [isTrackLoading, setIsTrackLoading] = useState<boolean>(false); // <-- Add loading state

  // Update list height based on container size
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        // We subtract the header and the new player bar height (approx 96px)
        const calculatedHeight = window.innerHeight - (containerRef.current.offsetTop || 0) - 96;
        setListHeight(Math.max(200, calculatedHeight)); // Ensure minimum height
      }
    };
    // Adjust height calculation
    const timeoutId = setTimeout(updateHeight, 100); // Recalculate after layout settles
    window.addEventListener('resize', updateHeight); // Update on resize
    return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', updateHeight); // Cleanup listener
    }
  }, [isLoading]); // Recalculate if loading state changes (layout might shift)

  useEffect(() => {
    // Fetch the demo data from the JSON file generated by the sync script
    fetch('/demos.json')
      .then(response => response.ok ? response.json() : Promise.reject(response))
      .then((data: Demo[]) => {
        setDemos(data);
        setIsLoading(false);
      })
      .catch(async err => {
        const statusText = await err.statusText || 'Fetch Error';
        const status = err.status || 'N/A';
        console.error("Error fetching or parsing demos.json:", statusText);
        if (status === 404) {
             setError("Demo list not found. Please add audio files to the `public/audio/demos` folder.");
        } else {
            setError(`An error occurred fetching demo data: ${statusText} (Status: ${status})`);
        }
        setIsLoading(false);
      });
  }, []);

  // --- Mobile Detection Effect ---
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 640px)").matches); // Tailwind 'sm' breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // --- Play Click Handler (Explicitly clear src before new load) ---
  const handlePlayClick = useCallback((index: number) => {
    if (isTrackLoading) {
      console.log("Ignoring click, track is already loading.");
      return;
    }

    const currentAudio = audioRef.current;
    if (!currentAudio || index < 0 || index >= demos.length) return;

    const demoToPlay = demos[index];

    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    if (currentPlayingIndex === index) {
       // Toggle play/pause
       setIsFadingWaveform(false);
       setIsTrackLoading(false);
       if (isPlaying) currentAudio.pause();
       else currentAudio.play().catch(e => console.error("Error resuming play:", e));
    } else {
      // --- Load and Play New Track ---
      console.log(`Loading track: ${demoToPlay.relativePath}`);
      setIsTrackLoading(true);
      setCurrentPlayingIndex(index);
      setCurrentTime(0);
      setDuration(0);

      // --- Explicitly clear old source ---
      console.log("Clearing previous audio src attribute...");
      currentAudio.removeAttribute('src');
      currentAudio.load();
      // --- End explicit clear ---

      // Now set the new source and proceed
      currentAudio.src = demoToPlay.relativePath;
      currentAudio.load();
      currentAudio.play().then(() => {
           console.log("Immediate play() successful (or resolved).");
           setIsPlaying(true);
      }).catch(e => {
           if (e.name !== 'AbortError') {
               console.error("Error on immediate play():", e);
           } else {
               console.log("Immediate play() AbortError caught (likely okay).");
           }
      });

      // If WaveSurfer exists (desktop), START FADE OUT, then load after delay
      if (wavesurferInstanceRef.current && isMobile === false) {
         console.log("[WaveSurfer] Starting fade out...");
         setIsFadingWaveform(true);

         fadeTimeoutRef.current = setTimeout(() => {
             if (wavesurferInstanceRef.current && audioRef.current) {
                 try {
                     wavesurferInstanceRef.current.load(audioRef.current.src);
                 } catch (error) {
                      console.error("Error calling wavesurfer.load inside timeout:", error);
                      setIsFadingWaveform(false);
                 }
             }
         }, 300); // 300ms fade duration
      } else if (isMobile === false) {
        // If wavesurfer doesn't exist yet but we are on desktop, load it.
        if (waveformRef.current) {
          console.log("[WaveSurfer] Initializing for the first time.");
          const ws = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: '#6b7280', // gray-500
            progressColor: '#fbbf24', // yellow-400
            height: 60,
            barWidth: 3,
            barRadius: 3,
            url: currentAudio.src,
          });
          wavesurferInstanceRef.current = ws;

          ws.on('ready', () => {
            console.log("[WaveSurfer] Ready.");
            setIsFadingWaveform(false);
          });

          ws.on('finish', () => {
            handleSkipNext();
          });

          ws.on('seeking', (time) => {
            if(audioRef.current) audioRef.current.currentTime = time;
          });
        }
      }
    }
  }, [currentPlayingIndex, isPlaying, demos, isTrackLoading, isMobile]);

  const handleSkipNext = useCallback(() => {
    if (currentPlayingIndex !== null) {
      const nextIndex = (currentPlayingIndex + 1) % demos.length;
      handlePlayClick(nextIndex);
    }
  }, [currentPlayingIndex, demos.length, handlePlayClick]);

  // --- Audio Event Listeners Effect ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleAudioPlay = () => setIsPlaying(true);
    const handleAudioPause = () => setIsPlaying(false);
    const handleAudioEnded = () => {
      setIsPlaying(false);
      handleSkipNext();
    };
    const handleLoadedMetadata = () => {
        if(audioRef.current) setDuration(audioRef.current.duration);
    };

    const handleTimeUpdate = () => {
      if (timeUpdateThrottleRef.current) return; // Exit if a timeout is already scheduled

      timeUpdateThrottleRef.current = setTimeout(() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
          timeUpdateThrottleRef.current = null; // Clear the ref after execution
      }, 100); // Throttle to 10fps
    };

    const handleVolumeChange = () => {
      if (audioRef.current) {
        setVolume(audioRef.current.volume);
        setIsMuted(audioRef.current.muted);
      }
    };

    const handleCanPlay = () => {
      console.log("Track can play. Setting isTrackLoading to false.");
      setIsTrackLoading(false);
    };

    const handleError = () => {
      if (audioRef.current) {
        console.error("Audio Error:", audioRef.current.error);
      }
      setIsTrackLoading(false);
      setError("An error occurred trying to play the audio.");
    };

    // Preload next track
    const preloadNextTrack = () => {
      if (currentPlayingIndex !== null && currentPlayingIndex < demos.length - 1) {
        const nextDemo = demos[currentPlayingIndex + 1];
        const existingLink = document.querySelector(`link[href="${nextDemo.relativePath}"]`);
        if (existingLink) return;

        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = nextDemo.relativePath;
        link.as = 'audio';
        document.head.appendChild(link);
        console.log(`Preloading next track: ${nextDemo.relativePath}`);
        // Clean up the preload link tag after some time to avoid cluttering the head
        setTimeout(() => {
            if(document.body.contains(link)) {
                document.head.removeChild(link)
            }
        }, 30000); // 30 seconds
      }
    };


    audio.addEventListener('play', handleAudioPlay);
    audio.addEventListener('pause', handleAudioPause);
    audio.addEventListener('ended', handleAudioEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('volumechange', handleVolumeChange);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('playing', preloadNextTrack);


    return () => {
      audio.removeEventListener('play', handleAudioPlay);
      audio.removeEventListener('pause', handleAudioPause);
      audio.removeEventListener('ended', handleAudioEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('volumechange', handleVolumeChange);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('playing', preloadNextTrack);
      if (timeUpdateThrottleRef.current) {
          clearTimeout(timeUpdateThrottleRef.current);
      }
    };
  }, [currentPlayingIndex, demos, handleSkipNext]);

  // --- WaveSurfer Cleanup ---
  useEffect(() => {
    const wsInstance = wavesurferInstanceRef.current;
    return () => {
      if (wsInstance) {
        wsInstance.destroy();
        wavesurferInstanceRef.current = null;
      }
    };
  }, []);

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(event.target.value);
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
    if (wavesurferInstanceRef.current) wavesurferInstanceRef.current.seekTo(time / (audioRef.current?.duration || 1));
  };

  const handleVolume = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number(event.target.value);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      audioRef.current.muted = newVolume === 0;
    }
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const currentlyMuted = audioRef.current.muted;
    if (currentlyMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
      // Optional: Restore previous volume or set a default
      if (volume === 0) {
        setVolume(1);
        if(audioRef.current) audioRef.current.volume = 1;
      }
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const togglePlayPause = () => {
    if (currentPlayingIndex === null && demos.length > 0) {
        handlePlayClick(0); // Start with the first track if nothing is selected
    } else {
        if (isPlaying) {
          audioRef.current?.pause();
        } else {
          audioRef.current?.play().catch(e => console.error("Error in togglePlayPause:", e));
        }
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleSeekBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const handleSeekForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 30);
    }
  };

  if (error) return <div className="flex items-center justify-center h-screen bg-red-900 text-white p-8"><p>{error}</p></div>;
  if (isLoading) return <div className="flex items-center justify-center h-screen bg-gray-950 text-white"><p>Loading Demos...</p></div>;

  const currentTrack = currentPlayingIndex !== null ? demos[currentPlayingIndex] : null;

  return (
    <main className="bg-gray-950 text-white font-sans flex flex-col h-screen overflow-hidden">
      {/* <Aurora colors={auroraColorStops} /> COMMENTED OUT */}

      {/* Header */}
      <header className="p-4 md:p-6 border-b border-gray-800 z-10 shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tighter">Song Demos</h1>
        <p className="text-gray-400 mt-1">Latest {demos.length} ideas, sorted by recent.</p>
      </header>

      {/* Main Content: List ONLY */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 md:p-6">
          <List
              height={listHeight}
              itemCount={demos.length}
              itemSize={130} // Adjust based on your row content
              width="100%"
              itemData={{
                  demos,
                  handlePlayClick,
                  currentPlayingIndex,
                  isPlaying,
                  enableDownloads: ENABLE_DOWNLOADS
              }}
          >
              {Row}
          </List>
      </div>

      {/* Player UI (Bottom Bar) */}
      <aside className="w-full border-t border-gray-800 p-4 flex items-center gap-x-6 bg-gray-950 z-10 shrink-0">
          {/* Main Controls */}
          <div className="flex items-center justify-center gap-2">
            <Button onClick={handleSeekBackward} variant="ghost" size="icon" className="text-white hover:bg-gray-700" disabled={!currentTrack}><Undo2 className="h-5 w-5"/></Button>
            <Button onClick={handleRestart} variant="ghost" size="icon" className="text-white hover:bg-gray-700" disabled={!currentTrack}><Rewind className="h-5 w-5"/></Button>
            <Button onClick={togglePlayPause} variant="ghost" size="icon" className="h-14 w-14 bg-yellow-400 text-black rounded-full hover:bg-yellow-300" disabled={isTrackLoading}>
              {isPlaying ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
            </Button>
            <Button onClick={handleSkipNext} variant="ghost" size="icon" className="text-white hover:bg-gray-700" disabled={!currentTrack}><SkipForward className="h-5 w-5"/></Button>
            <Button onClick={handleSeekForward} variant="ghost" size="icon" className="text-white hover:bg-gray-700" disabled={!currentTrack}><Redo2 className="h-5 w-5"/></Button>
          </div>

          {/* Waveform / Seek Bar and Time */}
          <div className="flex-1 flex items-center gap-4">
            <span className="text-xs font-mono text-gray-400">{formatTime(currentTime)}</span>
            <div className={`w-full transition-opacity duration-300 ${isFadingWaveform ? 'opacity-0' : 'opacity-100'}`}>
              {isMobile === false ? (
                <div ref={waveformRef} className="w-full"></div>
              ) : (
                <input
                  type="range"
                  min="0"
                  max={duration}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-lg"
                  disabled={!currentTrack}
                />
              )}
            </div>
            <span className="text-xs font-mono text-gray-400">{formatTime(duration)}</span>
          </div>

          {/* Volume and Track Info */}
          <div className="flex items-center gap-x-6">
              {/* Volume Control */}
              <div className="flex items-center gap-2 w-32">
                <Button onClick={toggleMute} variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  {isMuted || volume === 0 ? <VolumeX /> : <Volume2 />}
                </Button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolume}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Track Info */}
              <div className="w-48 text-right">
                <h2 className="text-sm font-bold truncate" title={currentTrack ? cleanFileName(currentTrack.fileName) : 'No track selected'}>{currentTrack ? cleanFileName(currentTrack.fileName) : 'Select a track'}</h2>
                <p className="text-xs text-gray-400">{currentTrack ? `Exported ${formatTimestamp(currentTrack.timestamp)}` : '...'}</p>
              </div>
          </div>
      </aside>

      <audio ref={audioRef} crossOrigin="anonymous"></audio>
    </main>
  );
}
