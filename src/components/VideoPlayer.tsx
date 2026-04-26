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
        },
        {
          name: 'audio',
          html: 'Audio Tracks',
          width: 250,
          tooltip: 'Default',
          selector: [
            { html: 'Default Audio', value: 0, default: true }
          ],
        },
        {
          name: 'subtitle-select',
          html: 'Subtitle Tracks',
          width: 250,
          tooltip: 'Off',
          selector: [
            { html: 'Off', value: -1, default: true }
          ],
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
              type: 'mse',
              isLive: true,
              url: url,
            }, {
              enableWorker: true,
              stashInitialSize: 128,
              lazyLoadMaxDuration: 3 * 60,
              seekType: 'range',
            });

            const mPlayer = player as any;
            mpegtsRef.current = mPlayer;
            mPlayer.attachMediaElement(video);
            mPlayer.load();
            
            mPlayer.on(mpegts.Events.ERROR, (type: any, detail: any, data: any) => {
              console.error('MPEGTS Error:', type, detail, data);
              art.notice.show = 'Live Stream Error. Reconnecting...';
            });

            const playPromise = mPlayer.play() as any;
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {
                art.notice.show = 'Click to Play Live';
              });
            }

            mPlayer.on(mpegts.Events.METADATA_ARRIVED, () => {
              const audioTracks = mPlayer.getAudioTrackList ? mPlayer.getAudioTrackList() : [];
              if (audioTracks.length > 0) {
                const audios = audioTracks.map((track: any, index: number) => ({
                  html: track.name || track.language || `Track ${index + 1}`,
                  value: track.id,
                }));
                
                art.setting.update({
                  name: 'audio',
                  html: 'Audio Selection',
                  tooltip: audios.length > 1 ? 'Multiple Tracks' : 'Default',
                  width: 250,
                  selector: audios,
                  onSelect: (item: any) => {
                    mPlayer.setAudioTrack(item.value);
                    return item.html;
                  },
                });
              }
            });
          } else {
            video.src = url;
          }
        },
        m3u8: function (video: HTMLVideoElement, url: string) {
          if (Hls.isSupported()) {
            if (hlsRef.current) hlsRef.current.destroy();

            const hls = new Hls({
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

              art.setting.add({
                name: 'quality',
                html: 'Quality',
                width: 150,
                selector: quality,
                onSelect: (item: any) => {
                  hls.currentLevel = item.value;
                  return item.html;
                },
              });

              // Initial Audio Tracks
              if (hls.audioTracks && hls.audioTracks.length > 0) {
                const audios = hls.audioTracks.map((track, index) => ({
                  html: track.name || track.lang || `Track ${index + 1}`,
                  value: index,
                  default: index === hls.audioTrack
                }));

                art.setting.update({
                  name: 'audio',
                  html: 'Dual Audio Select',
                  tooltip: audios.length > 1 ? 'Multiple' : 'Default',
                  width: 250,
                  selector: audios,
                  onSelect: (item: any) => {
                    hls.audioTrack = item.value;
                    art.notice.show = `Audio: ${item.html}`;
                    return item.html;
                  },
                });
              }
            });

            // Monitor Audio Track Switches
            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
              if (hls.audioTracks && hls.audioTracks.length > 0) {
                 const audios = hls.audioTracks.map((track, index) => ({
                  html: track.name || track.lang || `Track ${index + 1}`,
                  value: index,
                }));
                art.setting.update({
                  name: 'audio',
                  selector: audios,
                });
              }
            });

            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
              if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
                const subs = hls.subtitleTracks.map((track, index) => ({
                  html: track.name || track.lang || `Track ${index + 1}`,
                  value: index,
                }));
                subs.unshift({ html: 'Off', value: -1 });

                art.setting.update({
                  name: 'subtitle-select',
                  html: 'Select Subtitles',
                  tooltip: subs.length > 1 ? 'Available' : 'Off',
                  width: 250,
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

    // Native Tracks Handler (for MP4/MKV directly in browser)
    const video = art.video;
    const handleNativeTracks = () => {
      // @ts-ignore - Handle Native AudioTracks (Safari/IE mainly)
      const audioTracks = video.audioTracks;
      if (audioTracks && audioTracks.length > 0) {
        const audios = [];
        for (let i = 0; i < audioTracks.length; i++) {
          audios.push({
            html: audioTracks[i].label || audioTracks[i].language || `Audio Track ${i + 1}`,
            value: i,
            default: audioTracks[i].enabled
          });
        }
        art.setting.update({
          name: 'audio',
          selector: audios,
          onSelect: (item: any) => {
            for (let i = 0; i < audioTracks.length; i++) {
              audioTracks[i].enabled = (i === item.value);
            }
            art.notice.show = `Audio: ${item.html}`;
            return item.html;
          }
        });
      }

      // Handle Native TextTracks
      const textTracks = video.textTracks;
      if (textTracks && textTracks.length > 0) {
        const subs = [{ html: 'Off', value: -1 }];
        for (let i = 0; i < textTracks.length; i++) {
          if (textTracks[i].kind === 'subtitles' || textTracks[i].kind === 'captions') {
            subs.push({
              html: textTracks[i].label || textTracks[i].language || `Subtitle ${i + 1}`,
              value: i,
            });
          }
        }
        if (subs.length > 1) {
          art.setting.update({
            name: 'subtitle-select',
            selector: subs,
            onSelect: (item: any) => {
              for (let i = 0; i < textTracks.length; i++) {
                if (i === item.value) {
                  textTracks[i].mode = 'showing';
                } else {
                  textTracks[i].mode = 'hidden';
                }
              }
              art.notice.show = `Subtitle: ${item.html}`;
              return item.html;
            }
          });
        }
      }
    };

    video.addEventListener('loadedmetadata', handleNativeTracks);

    // Custom Layers for Indicators
    const addIndicator = (type: 'forward' | 'backward') => {
      const layer = art.layers.add({
        name: `indicator-${type}`,
        html: type === 'forward' 
          ? '<div style="display:flex;flex-direction:column;align-items:center;color:#00D1FF;"><svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M13 19l-1.41-1.41L15.17 14H4v-2h11.17l-3.58-3.59L13 7l6 6-6 6z"/><path d="M13 13V7l9 6-9 6v-6z"/></svg><span>+10s</span></div>'
          : '<div style="display:flex;flex-direction:column;align-items:center;color:#00D1FF;"><svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" style="transform:rotate(180deg)"><path d="M13 19l-1.41-1.41L15.17 14H4v-2h11.17l-3.58-3.59L13 7l6 6-6 6z"/><path d="M13 13V7l9 6-9 6v-6z"/></svg><span>-10s</span></div>',
        style: {
          position: 'absolute',
          top: '50%',
          left: type === 'forward' ? '70%' : '30%',
          transform: 'translate(-50%, -50%)',
          display: 'none',
          pointerEvents: 'none',
          zIndex: '100',
          background: 'rgba(0,0,0,0.4)',
          padding: '20px',
          borderRadius: '50%',
          backdropFilter: 'blur(10px)',
        },
      });

      setTimeout(() => {
        layer.style.display = 'flex';
        layer.style.opacity = '1';
        setTimeout(() => {
          layer.style.opacity = '0';
          setTimeout(() => {
            art.layers.remove(`indicator-${type}`);
          }, 300);
        }, 500);
      }, 0);
    };

    // Long Press for 2x Speed logic with Context Menu prevention
    let longPressTimer: any = null;
    let isLongPressing = false;

    // Prevent default context menu (Download prompt)
    video.addEventListener('contextmenu', (e) => e.preventDefault());

    const showSpeedIndicator = (active: boolean) => {
      let speedLayer = art.layers['speed-indicator'];
      if (!speedLayer) {
        speedLayer = art.layers.add({
          name: 'speed-indicator',
          html: '<div style="display:flex;align-items:center;gap:8px;background:rgba(0,209,255,0.2);padding:10px 20px;border-radius:30px;border:1px solid rgba(0,209,255,0.4);backdrop-filter:blur(10px);color:#00D1FF;font-weight:900;letter-spacing:2px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M13 19l-1.41-1.41L15.17 14H4v-2h11.17l-3.58-3.59L13 7l6 6-6 6z"/><path d="M13 13V7l9 6-9 6v-6z"/></svg>2X SPEED</div>',
          style: {
            position: 'absolute',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'none',
            zIndex: '100',
            pointerEvents: 'none',
          },
        });
      }
      speedLayer.style.display = active ? 'flex' : 'none';
    };

    const startLongPress = (e: Event) => {
      // Don't trigger if it's a right click or if UI elements are clicked
      if (e instanceof MouseEvent && e.button !== 0) return;
      
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        isLongPressing = true;
        art.playbackRate = 2;
        showSpeedIndicator(true);
        art.notice.show = 'Action: 2X Fast-Forward';
      }, 1000); // Trigger after 1 second for better UX
    };

    const endLongPress = () => {
      clearTimeout(longPressTimer);
      if (isLongPressing) {
        art.playbackRate = 1;
        showSpeedIndicator(false);
        art.notice.show = 'Back to Normal Speed';
        isLongPressing = false;
      }
    };

    art.on('video:mousedown', startLongPress);
    art.on('video:mouseup', endLongPress);
    art.on('video:mouseleave', endLongPress);
    art.on('video:touchstart', startLongPress);
    art.on('video:touchend', endLongPress);

    // Disable default sliding/seeking behavior on screen
    art.on('video:mousemove', (e: MouseEvent) => {
      // This helps prevent default drag behaviors in some browsers
      if (e.buttons === 1) e.preventDefault();
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
      if (isLongPressing) return;

      const now = Date.now();
      const delay = now - lastClickTimeRef.current;
      
      if (delay < 300) {
        const rect = art.template.$video.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const halfWidth = rect.width / 2;

        if (x > halfWidth) {
          art.seek = art.currentTime + 10;
          addIndicator('forward');
        } else {
          art.seek = art.currentTime - 10;
          addIndicator('backward');
        }
        
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
