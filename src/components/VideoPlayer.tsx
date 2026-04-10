import React, { useEffect, useRef } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';

interface VideoPlayerProps {
  options: {
    sources: { src: string; type: string }[];
    autoplay?: boolean;
    controls?: boolean;
    poster?: string;
  };
  onReady?: (player: Artplayer) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ options, onReady }) => {
  const artRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Artplayer | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (!artRef.current) return;

    const source = options.sources[0];
    const isHls = source.src.toLowerCase().includes('.m3u8') || source.type === 'application/x-mpegURL';

    const art = new Artplayer({
      container: artRef.current,
      url: source.src,
      type: isHls ? 'm3u8' : undefined,
      isLive: isHls,
      poster: options.poster || '',
      autoplay: options.autoplay || false,
      autoSize: false,
      autoMini: true,
      loop: false,
      flip: false,
      playbackRate: false,
      aspectRatio: true,
      setting: true,
      pip: true,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: false,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoPlayback: false,
      airplay: true,
      theme: '#22d3ee', // Cyan-400
      moreVideoAttr: {
        crossOrigin: 'anonymous',
      },
      customType: {
        m3u8: function (video: HTMLVideoElement, url: string) {
          // Implement cache-busting by appending a dynamic timestamp to ensure browser doesn't load old cache
          const cacheBustedUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
          
          if (Hls.isSupported()) {
            // Destroy existing HLS instance if any
            if (hlsRef.current) {
              hlsRef.current.destroy();
            }

            const hls = new Hls({
              // Configure hls.js for live streaming to strictly stay on the live edge
              liveSyncDurationCount: 3, // Start playback 3 segments from the live edge
              liveMaxLatencyDurationCount: 10, // If latency exceeds 10 segments, jump back to live edge
              enableWorker: true,
              lowLatencyMode: true,
              manifestLoadingMaxRetry: Infinity, // Keep trying to load manifest
              levelLoadingMaxRetry: Infinity,
              fragLoadingMaxRetry: Infinity,
            });
            
            hlsRef.current = hls;
            hls.loadSource(cacheBustedUrl);
            hls.attachMedia(video);
            
            // Auto-recovery logic for network and media errors
            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log('Fatal network error encountered, attempting to recover...');
                    hls.startLoad();
                    video.play().catch(() => {});
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log('Fatal media error encountered, attempting to recover...');
                    hls.recoverMediaError();
                    video.play().catch(() => {});
                    break;
                  default:
                    console.log('Unrecoverable fatal error, destroying HLS instance');
                    hls.destroy();
                    break;
                }
              }
            });

            // Handle quality levels
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              const levels = hls.levels;
              if (levels && levels.length > 1) {
                const quality = levels.map((level, index) => ({
                  default: index === hls.currentLevel,
                  html: level.height ? `${level.height}P` : 'Auto',
                  value: index,
                }));
                
                // Add Auto option if not present
                quality.unshift({
                  default: hls.currentLevel === -1,
                  html: 'Auto',
                  value: -1,
                });

                art.setting.update({
                  name: 'quality',
                  html: 'Quality',
                  tooltip: 'Auto',
                  width: 150,
                  selector: quality,
                  onSelect: (item: any) => {
                    hls.currentLevel = item.value;
                    return item.html;
                  },
                });
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = cacheBustedUrl;
          }
        },
      },
      settings: [
        {
          html: 'Aspect Ratio',
          width: 200,
          tooltip: 'Default',
          selector: [
            { html: 'Default', value: 'default' },
            { html: '16:9', value: '16:9' },
            { html: '4:3', value: '4:3' },
            { html: 'Fill', value: 'fill' },
          ],
          onSelect: (item: any) => {
            const video = art.video;
            if (item.value === 'fill') {
              video.style.objectFit = 'fill';
              video.style.width = '100%';
              video.style.height = '100%';
            } else if (item.value === 'default') {
              video.style.objectFit = 'contain';
              video.style.width = '';
              video.style.height = '';
              art.aspectRatio = 'default';
            } else {
              video.style.objectFit = 'contain';
              video.style.width = '';
              video.style.height = '';
              art.aspectRatio = item.value;
            }
            return item.html;
          },
        },
      ],
    });

    playerRef.current = art;

    if (onReady) {
      onReady(art);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (playerRef.current) {
        // Stop video and clear source before destroying to ensure audio stops
        if (playerRef.current.video) {
          playerRef.current.video.pause();
          playerRef.current.video.src = '';
          playerRef.current.video.load();
        }
        playerRef.current.destroy(false);
      }
    };
  }, [options]);

  return (
    <div 
      ref={artRef} 
      className="w-full h-full artplayer-app rounded-xl overflow-hidden shadow-2xl"
      style={{ minHeight: '220px' }}
    />
  );
};

export default VideoPlayer;
