import React, { useEffect, useRef } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';

interface VideoPlayerProps {
  options: {
    sources: { src: string; type: string }[];
    autoplay?: boolean;
    controls?: boolean;
    poster?: string;
    is_embed?: boolean;
  };
  onReady?: (player: Artplayer) => void;
  onClose?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ options, onReady, onClose }) => {
  const artRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Artplayer | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<any>(null);
  const lastClickTimeRef = useRef<number>(0);

  const getProxiedUrl = (url: string) => {
    if (!url) return '';
    // If it's already a proxied URL or an embed URL, don't proxy it again
    if (url.includes('sjstore-4ksj-store-proxy.hf.space') || url.includes('/embed/')) return url;
    return `https://sjstore-4ksj-store-proxy.hf.space/play?url=${encodeURIComponent(url)}`;
  };

  const source = options.sources[0];
  const originalUrl = source?.src || '';
  const sourceUrl = getProxiedUrl(originalUrl);
  const isEmbed = options.is_embed || false;

  const isEmbeddable = (url: string) => {
    if (isEmbed) return true;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('blogger.com') || 
           lowerUrl.includes('youtube.com/embed') || 
           lowerUrl.includes('dailymotion.com/embed') ||
           lowerUrl.includes('vimeo.com/video') ||
           lowerUrl.includes('/embed/');
  };

  useEffect(() => {
    if (!artRef.current || !sourceUrl || isEmbeddable(originalUrl)) return;

    const isHls = originalUrl.toLowerCase().includes('.m3u8') || source.type === 'application/x-mpegURL';
    const isTs = originalUrl.toLowerCase().includes('.ts') || source.type === 'video/mp2t';
    const isMkv = originalUrl.toLowerCase().includes('.mkv');

    const art = new Artplayer({
      container: artRef.current,
      url: sourceUrl,
      type: isHls ? 'm3u8' : 
            (originalUrl.toLowerCase().includes('.mp4') ? 'mp4' : 
            (originalUrl.toLowerCase().includes('.webm') ? 'webm' : 
            (isMkv ? 'mkv' : (isTs ? 'ts' : undefined)))),
      isLive: isHls || isTs,
      poster: options.poster || '',
      autoplay: options.autoplay || false,
      autoSize: false,
      autoMini: false,
      loop: false,
      flip: false,
      playbackRate: true, 
      aspectRatio: false,
      setting: true,
      pip: true,
      fullscreen: true,
      fullscreenWeb: false,
      subtitleOffset: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoOrientation: true,
      airplay: true,
      lock: true,
      fastForward: false,
      theme: '#00D1FF', 
      moreVideoAttr: {
        crossOrigin: 'anonymous',
        playsInline: true,
      },
      subtitle: {
        url: '',
        type: 'vtt',
        style: {
          color: '#00D1FF',
          fontSize: '20px',
        },
        encoding: 'utf-8',
      },
      controls: [
        {
          name: 'back',
          position: 'left',
          html: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
          tooltip: 'Back',
          click: function() {
            if (onClose) onClose();
          },
        },
      ],
      settings: [
        {
          html: 'Aspect Ratio',
          width: 150,
          tooltip: 'Default',
          selector: [
            { html: 'Default', value: 'default' },
            { html: 'Stretch (16:9)', value: '16:9' },
            { html: 'Full Screen', value: 'fill' },
          ],
          onSelect: (item: any) => {
            if (item.value === 'fill') {
              art.video.style.objectFit = 'fill';
            } else {
              art.video.style.objectFit = 'contain';
              art.aspectRatio = item.value;
            }
            return item.html;
          },
        },
        {
          html: 'Volume Boost',
          width: 200,
          tooltip: 'Normal',
          selector: [
            { html: 'Normal (100%)', value: 1 },
            { html: 'Turbo (150%)', value: 1.5 },
            { html: 'Extreme (200%)', value: 2 },
            { html: 'Max Boost (300%)', value: 3 },
          ],
          onSelect: (item: any) => {
            const video = art.video;
            // Web Audio API for Volume Boost
            try {
              // @ts-ignore
              if (!art.gainNode) {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                const audioCtx = new AudioContext();
                const source = audioCtx.createMediaElementSource(video);
                const gainNode = audioCtx.createGain();
                source.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                // @ts-ignore
                art.gainNode = gainNode;
                // @ts-ignore
                art.audioCtx = audioCtx;
              }
              // @ts-ignore
              art.gainNode.gain.value = item.value;
              art.notice.show = `Volume Boost: ${Math.round(item.value * 100)}%`;
            } catch (e) {
              console.error('Volume boost error:', e);
              art.notice.show = 'Volume boost not supported in this browser';
            }
            return item.html;
          },
        }
      ],
      layers: [
        {
          name: 'back-button',
          html: '<div style="padding: 10px; background: rgba(0,0,0,0.5); border-radius: 50%; width: 40px; height: 40px; display: flex; items-center; justify-content: center; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1); cursor: pointer;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D1FF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></div>',
          style: {
            position: 'absolute',
            top: '20px',
            left: '20px',
            display: 'none',
            zIndex: '20',
          },
          click: function() {
            if (onClose) onClose();
          },
        },
      ],
      customType: {
        ts: function (video: HTMLVideoElement, url: string, art: Artplayer) {
          if (mpegts.isSupported()) {
            if (mpegtsRef.current) {
              mpegtsRef.current.unload();
              mpegtsRef.current.detachMediaElement();
              mpegtsRef.current.destroy();
            }

            const player = mpegts.createPlayer({
              type: 'mse', // Use MSE for .ts streams
              isLive: true,
              url: url,
            }, {
              enableWorker: true,
              stashInitialSize: 128,
              lazyLoadMaxDuration: 3 * 60,
              seekType: 'range',
            });

            mpegtsRef.current = player;
            player.attachMediaElement(video);
            player.load();
            
            player.on(mpegts.Events.ERROR, (type, detail, data) => {
              console.error('MPEGTS Error:', type, detail, data);
              art.notice.show = 'Live Stream Error. Reconnecting...';
            });

            const playPromise = player.play() as any;
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {
                art.notice.show = 'Click to Play Live';
              });
            }
          } else {
            video.src = url;
          }
        },
        m3u8: function (video: HTMLVideoElement, url: string) {
          if (Hls.isSupported()) {
            if (hlsRef.current) hlsRef.current.destroy();

            const hls = new Hls({
              liveSyncDurationCount: 3,
              liveMaxLatencyDurationCount: 10,
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 90,
            });
            
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              const quality = hls.levels.map((level, index) => ({
                default: index === hls.currentLevel,
                html: level.height ? `${level.height}P` : 'Auto',
                value: index,
              }));
              
              quality.unshift({ default: true, html: 'Auto', value: -1 });

              art.setting.update({
                name: 'quality',
                html: 'Quality',
                width: 150,
                selector: quality,
                onSelect: (item: any) => {
                  hls.currentLevel = item.value;
                  return item.html;
                },
              });

              // Audio Tracks
              if (hls.audioTracks && hls.audioTracks.length > 1) {
                const audios = hls.audioTracks.map((track, index) => ({
                  default: index === hls.audioTrack,
                  html: track.name || track.lang || `Track ${index + 1}`,
                  value: index,
                }));

                art.setting.update({
                  name: 'audio',
                  html: 'Audio Select',
                  width: 150,
                  selector: audios,
                  onSelect: (item: any) => {
                    hls.audioTrack = item.value;
                    return item.html;
                  },
                });
              }
            });

            // Subtitle Tracks
            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
              if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
                const subs = hls.subtitleTracks.map((track, index) => ({
                  html: track.name || track.lang || `Track ${index + 1}`,
                  value: index,
                }));
                subs.unshift({ html: 'Off', value: -1 });

                art.setting.update({
                  name: 'subtitle-select',
                  html: 'Subtitles',
                  width: 150,
                  selector: subs,
                  onSelect: (item: any) => {
                    hls.subtitleTrack = item.value;
                    art.notice.show = `Subtitle: ${item.html}`;
                    return item.html;
                  },
                });
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
          }
        },
      },
    });

    // Toggle back button layer visibility with controls
    art.on('control', (state: boolean) => {
      const layer = art.layers['back-button'];
      if (layer) {
        layer.style.display = state ? 'block' : 'none';
      }
    });

    // Handle Double Tap for Seeking
    art.on('video:click', (event: MouseEvent) => {
      const now = Date.now();
      const delay = now - lastClickTimeRef.current;
      
      if (delay < 300) {
        const rect = art.template.$video.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const halfWidth = rect.width / 2;

        if (x > halfWidth) {
          art.seek = art.currentTime + 10;
          art.notice.show = 'Seek Forward +10s';
        } else {
          art.seek = art.currentTime - 10;
          art.notice.show = 'Seek Backward -10s';
        }
        
        // Reset last click time to avoid triple tap seeking twice
        lastClickTimeRef.current = 0;
      } else {
        lastClickTimeRef.current = now;
      }
    });

    playerRef.current = art;
    if (onReady) onReady(art);

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      if (mpegtsRef.current) {
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
        mpegtsRef.current = null;
      }
      if (playerRef.current) {
        // Cleanup AudioContext for Volume Boost
        try {
          // @ts-ignore
          if (playerRef.current.audioCtx) {
            // @ts-ignore
            playerRef.current.audioCtx.close();
          }
        } catch (e) {
          console.error('AudioContext cleanup error:', e);
        }
        playerRef.current.destroy();
      }
    };
  }, [sourceUrl]);

  return (
    <div className="w-full h-full relative bg-black overflow-hidden" style={{ minHeight: '100%' }}>
      {isEmbeddable(originalUrl) ? (
        <iframe
          src={originalUrl}
          className="absolute inset-0 w-full h-full border-0 m-0 p-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      ) : (
        <div ref={artRef} className="w-full h-full artplayer-app" />
      )}
    </div>
  );
};

export default VideoPlayer;
