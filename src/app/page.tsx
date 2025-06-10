'use client'; // Required for useEffect and useState

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipForward, Rewind, Undo2, Redo2, Download } from 'lucide-react'; // Import icons for play/pause and volume, and skip/rewind
import { Button } from "@/components/ui/button"; // Assuming you have Button component
import Image from 'next/image'; // Import Next.js Image component
// import Aurora from '@/components/Aurora'; // Import the Aurora component - COMMENTED OUT
import WaveSurfer from 'wavesurfer.js'; // Import WaveSurfer

// Define an interface for the demo data structure
interface Demo {
  fileName: string;
  relativePath: string;
  timestamp: string; // ISO string format
  title: string;
  bpm: number;
  key: string;
  genre: string;
  artwork: string;
}

// --- Control Flag ---
const ENABLE_DOWNLOADS = true; // Set to true to re-enable downloads

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
                className={`p-4 border rounded-lg shadow-sm h-full flex gap-4 ${isActive ? 'border-yellow-400 bg-gray-800' : 'border-gray-700 bg-gray-900 hover:bg-gray-800'} opacity-75 transition-colors duration-200 cursor-pointer`}
                onClick={() => handlePlayClick(index)}
            >
                {/* Left: Artwork */}
                <div className="flex-shrink-0">
                    <Image 
                        src={demo.artwork} 
                        alt={`${demo.title} artwork`}
                        width={80}
                        height={80}
                        className="w-20 h-20 rounded-lg object-cover bg-gray-700"
                        onError={(e) => {
                            e.currentTarget.src = '/artwork/placeholder.svg';
                        }}
                    />
                </div>

                {/* Middle: Track Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col h-full justify-between">
                        {/* Top: Title and Controls */}
                        <div>
                            <h2 className="text-lg font-mono font-semibold mb-1 truncate" title={demo.title}>
                                {demo.title}
                            </h2>
                            
                            {/* Controls moved here */}
                            <div className="flex items-center gap-3 mb-3">
                                {/* Play/Pause Button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent row click from firing
                                      handlePlayClick(index);
                                    }}
                                    className="text-white hover:bg-gray-700 -ml-2 px-2"
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
                                        onClick={(e) => e.stopPropagation()} // Prevent row click from firing
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-400 hover:bg-gray-700 hover:text-blue-300 rounded-md transition-colors duration-200 font-mono text-sm"
                                     >
                                        <Download className="h-4 w-4" />
                                        <span className="lowercase">download</span>
                                     </a>
                                )}
                            </div>
                        </div>

                        {/* Bottom: Metadata */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                            <span className="bg-gray-700 px-2 py-1 rounded">{demo.genre}</span>
                            <span>{demo.bpm} BPM</span>
                            <span>{demo.key}</span>
                            <span>{formatTimestamp(demo.timestamp)}</span>
                        </div>
                    </div>
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

  // --- Skip Next Handler ---
  const handleSkipNext = useCallback(() => {
    if (currentPlayingIndex !== null) {
      const nextIndex = (currentPlayingIndex + 1) % demos.length;
      // Instead of calling handlePlayClick directly, we'll handle the logic here
      if (demos.length > 0) {
        const currentAudio = audioRef.current;
        if (!currentAudio) return;

        const demoToPlay = demos[nextIndex];
        setCurrentPlayingIndex(nextIndex);
        setCurrentTime(0);
        setDuration(0);
        setIsTrackLoading(true);

        currentAudio.removeAttribute('src');
        currentAudio.load();
        currentAudio.src = demoToPlay.relativePath;
        currentAudio.load();
        currentAudio.play().then(() => {
          setIsPlaying(true);
        }).catch(e => {
          if (e.name !== 'AbortError') {
            console.error("Error on skip next play():", e);
          }
        });

        // Handle WaveSurfer for desktop
        if (wavesurferInstanceRef.current && isMobile === false) {
          setIsFadingWaveform(true);
          setTimeout(() => {
            if (wavesurferInstanceRef.current && audioRef.current) {
              try {
                wavesurferInstanceRef.current.load(audioRef.current.src);
              } catch (error) {
                console.error("Error calling wavesurfer.load on skip:", error);
                setIsFadingWaveform(false);
              }
            }
          }, 300);
        }
      }
    }
  }, [currentPlayingIndex, demos, isMobile]);

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
            media: currentAudio, // Connect directly to audio element
            waveColor: '#6B7280',    // gray-500
            progressColor: '#FBBF24', // yellow-400
            height: 60,
            barWidth: 3,
            barGap: 2,
            cursorWidth: 0,           // Hide default cursor/playhead
            interact: true,           // Allow seeking by clicking waveform
            autoCenter: true,
            normalize: true,          // Normalize waveform heights
          });
          wavesurferInstanceRef.current = ws;

          ws.on('ready', (durationValue) => {
            console.log("[WaveSurfer] Ready.", durationValue);
            setDuration(durationValue);
            setIsFadingWaveform(false);
            setIsTrackLoading(false);
          });

          ws.on('audioprocess', (currentTimeValue) => setCurrentTime(currentTimeValue));
          ws.on('seeking', (currentTimeValue) => setCurrentTime(currentTimeValue));
          
          ws.on('error', (error) => {
            console.error('[WaveSurfer] Error:', error);
            setIsFadingWaveform(false);
            setIsTrackLoading(false);
          });

          ws.on('finish', () => {
            handleSkipNext();
          });

          // Load the current track if there is one
          if (currentAudio.src) {
            console.log("[WS] Loading initial media:", currentAudio.src);
            ws.load(currentAudio.src).catch(e => {
              console.error("WS initial load error:", e);
              setIsFadingWaveform(false);
              setIsTrackLoading(false);
            });
          }
        }
      }
    }
  }, [currentPlayingIndex, isPlaying, demos, isTrackLoading, isMobile, handleSkipNext]);

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

  // --- WaveSurfer Initialization/Load Effect (Desktop Only) ---
  useEffect(() => {
    if (typeof window === 'undefined' || isMobile === null) return;
    const currentAudio = audioRef.current;
    const currentWaveformContainer = waveformRef.current;
    
    if (isMobile) {
      if (wavesurferInstanceRef.current) {
        wavesurferInstanceRef.current.destroy();
        wavesurferInstanceRef.current = null;
      }
      return;
    }

    if (!currentAudio || !currentWaveformContainer) return;

    if (!wavesurferInstanceRef.current) {
      console.log("[WaveSurfer Effect] Initializing NEW instance for Desktop...");
      const ws = WaveSurfer.create({
        container: currentWaveformContainer,
        media: currentAudio,
        waveColor: '#6B7280',    // gray-500
        progressColor: '#FBBF24', // yellow-400
        height: 60,             // Adjust height as needed
        barWidth: 3,
        barGap: 2,
        cursorWidth: 0,           // Hide default cursor/playhead
        interact: true,           // Allow seeking by clicking waveform
        autoCenter: true,
        normalize: true,          // Normalize waveform heights
      });

      ws.on('ready', (durationValue) => {
        console.log("[WaveSurfer] Ready.", durationValue);
        setDuration(durationValue);
        setIsFadingWaveform(false);
        setIsTrackLoading(false);
      });

      ws.on('audioprocess', (currentTimeValue) => setCurrentTime(currentTimeValue));
      ws.on('seeking', (currentTimeValue) => setCurrentTime(currentTimeValue));
      ws.on('error', (error) => {
        console.error('[WaveSurfer] Error:', error);
        setIsFadingWaveform(false);
        setIsTrackLoading(false);
      });
      ws.on('finish', () => {
        if (currentPlayingIndex !== null && demos.length > 1) {
          handleSkipNext();
        }
      });

      wavesurferInstanceRef.current = ws;

      if (currentAudio.src && currentPlayingIndex !== null) {
        console.log("[WS Effect] Loading initial media:", currentAudio.src);
        setIsFadingWaveform(false);
        ws.load(currentAudio.src).catch(e => {
          console.error("WS initial load error:", e);
        });
      } else {
        setIsFadingWaveform(false);
      }
    }

    return () => {
      if (isMobile === false) {
        console.log("[WaveSurfer Effect] Cleanup running (Desktop). Instance will persist unless unmounting.");
      }
    };

  }, [isMobile, currentPlayingIndex, demos, handleSkipNext]);

  // --- WaveSurfer Cleanup on Unmount ---
  useEffect(() => {
    const wsRef = wavesurferInstanceRef;
    return () => {
      console.log("Component unmounting, destroying WaveSurfer if it exists.");
      if (wsRef.current) {
        wsRef.current.destroy();
        wsRef.current = null;
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
      <header className="p-4 md:p-6 border-b border-gray-800 z-10 shrink-0 text-center">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tighter mb-2">the friendZone</h1>
        <a 
          href="https://open.spotify.com/artist/0INl3zPQiVcg6dCPRQL8TY?si=4TtVg3_YTdWyFDEVvbY4qg"
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-400 hover:text-green-300 font-mono text-sm transition-colors duration-200 inline-flex items-center gap-1"
        >
          {/* <span>listen on spotify</span> */}
          {/* <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg> */}
        </a>
      </header>

      {/* Main Content: Tracklist */}
      <div className="flex-1 p-4 md:p-6">
          <div className="space-y-4">
            {demos.map((demo, index) => (
              <Row
                key={demo.fileName}
                index={index}
                style={{}} // No style needed for non-virtualized
                data={{
                  demos,
                  handlePlayClick,
                  currentPlayingIndex,
                  isPlaying,
                  enableDownloads: ENABLE_DOWNLOADS
                }}
              />
            ))}
          </div>
      </div>

      {/* Spotify Embed Section */}
      <div className="border-t border-gray-800 p-4 md:p-6 bg-gray-950">
        <div className="max-w-4xl">
          <h2 className="text-lg font-mono font-semibold mb-4">we on spotify too </h2>
          <div className="flex gap-4 flex-col md:flex-row">
            <div className="flex-1 rounded-lg overflow-hidden">
              <iframe 
                style={{borderRadius: '12px'}} 
                src="https://open.spotify.com/embed/artist/0INl3zPQiVcg6dCPRQL8TY?utm_source=generator&theme=0&view=coverart" 
                width="100%" 
                height="152" 
                frameBorder="0" 
                allowFullScreen={true}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                loading="lazy"
                title="dj.friend on Spotify"
              />
            </div>
            <div className="flex-1 rounded-lg overflow-hidden">
              <iframe 
                style={{borderRadius: '12px'}} 
                src="https://open.spotify.com/embed/artist/6i4BGOrenw20gneqPx0hWq?utm_source=generator&theme=0" 
                width="100%" 
                height="152" 
                frameBorder="0" 
                allowFullScreen={true}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                loading="lazy"
                title="Second artist on Spotify"
              />
            </div>
          </div>
        </div>
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
                <h2 className="text-sm font-bold truncate" title={currentTrack ? currentTrack.title : 'No track selected'}>{currentTrack ? currentTrack.title : 'Select a track'}</h2>
                <p className="text-xs text-gray-400">{currentTrack ? `${currentTrack.bpm} BPM • ${currentTrack.key}` : '...'}</p>
              </div>
          </div>
      </aside>

      <audio ref={audioRef} crossOrigin="anonymous"></audio>
    </main>
  );
}
