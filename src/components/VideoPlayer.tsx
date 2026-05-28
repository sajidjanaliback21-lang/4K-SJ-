import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Cpu, Globe, Sliders, X, SkipForward } from 'lucide-react';

interface VideoPlayerProps {
  options: {
    sources: { src: string; type: string }[];
    autoplay?: boolean;
    controls?: boolean;
    poster?: string;
    is_embed?: boolean;
    skipProxy?: boolean;
    isLive?: boolean;
  };
  onReady?: (player: Artplayer) => void;
  onClose?: () => void;
  playingEpisode?: any;
  nextEpisode?: any;
  onPlayNext?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ options, onReady, onClose, playingEpisode, nextEpisode, onPlayNext }) => {
  const artRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Artplayer | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<any>(null);
  const lastClickTimeRef = useRef<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('LOADING VIDEO...');
  const [showEqPanel, setShowEqPanel] = useState(false);
  const [bassGain, setBassGain] = useState(0);
  const [midGain, setMidGain] = useState(0);
  const [trebleGain, setTrebleGain] = useState(0);
  const [eqPortalTarget, setEqPortalTarget] = useState<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const getAudioGraph = (artPlayer: Artplayer) => {
    // @ts-ignore
    if (artPlayer.audioCtx) {
      return {
        // @ts-ignore
        audioCtx: artPlayer.audioCtx,
        // @ts-ignore
        gainNode: artPlayer.gainNode,
        // @ts-ignore
        eqFilters: artPlayer.eqFilters
      };
    }

    const video = artPlayer.video;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioCtx();
    const sNode = audioCtx.createMediaElementSource(video);

    const f1 = audioCtx.createBiquadFilter();
    f1.type = 'lowshelf';
    f1.frequency.value = 150; // Bass
    f1.gain.value = 0;

    const f2 = audioCtx.createBiquadFilter();
    f2.type = 'peaking';
    f2.frequency.value = 1000; // Mids
    f2.Q.value = 1;
    f2.gain.value = 0;

    const f3 = audioCtx.createBiquadFilter();
    f3.type = 'highshelf';
    f3.frequency.value = 6000; // Treble
    f3.gain.value = 0;

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 1;

    sNode.connect(f1);
    f1.connect(f2);
    f2.connect(f3);
    f3.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Store references
    // @ts-ignore
    artPlayer.audioCtx = audioCtx;
    // @ts-ignore
    artPlayer.gainNode = gainNode;
    // @ts-ignore
    artPlayer.eqFilters = { bass: f1, mid: f2, treble: f3 };

    return { audioCtx, gainNode, eqFilters: { bass: f1, mid: f2, treble: f3 } };
  };

  const openEqPanel = () => {
    if (playerRef.current) {
      try {
        const graph = getAudioGraph(playerRef.current);
        if (graph && graph.eqFilters) {
          setBassGain(graph.eqFilters.bass.gain.value);
          setMidGain(graph.eqFilters.mid.gain.value);
          setTrebleGain(graph.eqFilters.treble.gain.value);
        }
      } catch (e) {
        console.error('Failed to initialize AudioContext for EQ:', e);
      }
    }
    setShowEqPanel(true);
  };

  const handleEqChange = (type: 'bass' | 'mid' | 'treble', val: number) => {
    if (type === 'bass') setBassGain(val);
    if (type === 'mid') setMidGain(val);
    if (type === 'treble') setTrebleGain(val);

    if (playerRef.current) {
      try {
        const graph = getAudioGraph(playerRef.current);
        if (graph && graph.eqFilters) {
          const filter = graph.eqFilters[type];
          if (filter) {
            filter.gain.value = val;
          }
        }
      } catch (e) {
        console.error('EQ write error:', e);
      }
    }
  };

  const applyPreset = (presetName: string) => {
    let b = 0, m = 0, t = 0;
    if (presetName === 'flat') {
      b = 0; m = 0; t = 0;
    } else if (presetName === 'bass') {
      b = 8; m = 0; t = 2;
    } else if (presetName === 'vocal') {
      b = -4; m = 6; t = 2;
    } else if (presetName === 'cinema') {
      b = 5; m = -2; t = 4;
    } else if (presetName === 'loudness') {
      b = 4; m = 3; t = 4;
    }

    setBassGain(b);
    setMidGain(m);
    setTrebleGain(t);

    if (playerRef.current) {
      try {
        const graph = getAudioGraph(playerRef.current);
        if (graph && graph.eqFilters) {
          graph.eqFilters.bass.gain.value = b;
          graph.eqFilters.mid.gain.value = m;
          graph.eqFilters.treble.gain.value = t;
        }
      } catch (e) {
        console.error('EQ apply preset error:', e);
      }
    }
  };

  const getProxiedUrl = (url: string) => {
    if (!url) return '';
    const types = ['/movie/', '/series/', '/live/'];
    for (const t of types) {
      if (url.includes(t)) {
        const index = url.indexOf(t);
        return `https://hdsj.store${url.substring(index)}`;
      }
    }
    return url;
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
    const isLive = options.isLive !== undefined ? options.isLive : (isHls || isTs);

    const art = new Artplayer({
      container: artRef.current,
      url: sourceUrl,
      type: isHls ? 'm3u8' : 
            (originalUrl.toLowerCase().includes('.mp4') ? 'mp4' : 
            (originalUrl.toLowerCase().includes('.webm') ? 'webm' : 
            (isMkv ? 'mkv' : (isTs ? 'ts' : undefined)))),
      isLive: isLive,
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
      fullscreenWeb: true, // Enable web fullscreen
      subtitleOffset: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoOrientation: true,
      airplay: true,
      lock: true,
      autoPlayback: true,
      fastForward: false,
      gesture: false, // Disable default gestures (swipe to seek, volume, brightness)
      hotkey: false, // Disable default hotkeys to prevent conflict
      click: false, // Disable default play/pause on main screen clicks
      theme: '#00D1FF', 
      moreVideoAttr: {
        crossOrigin: 'anonymous',
        playsInline: true,
        'webkit-playsinline': true,
        'x5-video-player-type': 'h5',
        'x5-video-orientation': 'landscape|portrait',
        controlsList: 'nodownload nofullscreen noremoteplayback',
        disablePictureInPicture: true,
      } as any,
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
            { html: 'Fit Screen (Cover)', value: 'cover' },
            { html: 'Full Screen', value: 'fill' },
          ],
          onSelect: (item: any) => {
            if (item.value === 'fill') {
              art.video.style.objectFit = 'fill';
            } else if (item.value === 'cover') {
              art.video.style.objectFit = 'cover';
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
            try {
              const graph = getAudioGraph(art);
              if (graph && graph.gainNode) {
                graph.gainNode.gain.value = item.value;
                art.notice.show = `Volume Boost: ${Math.round(item.value * 100)}%`;
              }
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
        {
          name: 'react-portal-layer',
          html: '<div class="react-portal-layer-container" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;"></div>',
          style: {
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '99',
          }
        }
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
              isLive: isLive,
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
    } as any);

    // Handle Loading State
    art.on('ready', () => {
      setLoadingText('CONNECTING...');
    });

    art.on('video:loadedmetadata', () => {
      setLoadingText('SECURED');
      setTimeout(() => setIsLoading(false), 800);
    });

    // Fallback if metadata takes too long but playback starts
    art.on('video:play', () => {
      if (isLoading) {
        setTimeout(() => setIsLoading(false), 500);
      }
    });

    // Toggle back button layer visibility with controls
    art.on('control', (state: boolean) => {
      const layer = art.layers['back-button'];
      if (layer) {
        layer.style.display = state ? 'block' : 'none';
      }
    });

    // Prevent context menu to avoid "Download video" option aggressively
    const preventContext = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    
    art.template.$video.addEventListener('contextmenu', preventContext, true);
    art.template.$container.addEventListener('contextmenu', preventContext, true);
    art.on('view:contextmenu', (e: MouseEvent) => e.preventDefault());

    // Add Seek Indicators Layers with enhanced animations
    art.layers.add({
      name: 'seek-left',
      html: `
        <div class="seek-indicator left-indicator" style="display: none; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); width: 110px; height: 110px; border-radius: 50%; color: white; backdrop-filter: blur(12px); border: 2px solid rgba(0, 209, 255, 0.4); box-shadow: 0 0 30px rgba(0, 209, 255, 0.2);">
          <style>
            @keyframes seekLeftAnim {
              0% { transform: translateX(5px); opacity: 0.3; }
              50% { transform: translateX(-5px); opacity: 1; }
              100% { transform: translateX(5px); opacity: 0.3; }
            }
            .left-indicator .seek-icon-anim svg { animation: seekLeftAnim 0.6s infinite; }
          </style>
          <div class="seek-icon-anim" style="display: flex; filter: drop-shadow(0 0 8px rgba(0, 209, 255, 0.5));">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
          </div>
          <span style="font-size: 16px; font-weight: 900; margin-top: 6px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 1px; color: #00D1FF;">10s</span>
        </div>
      `,
      style: {
        position: 'absolute',
        top: '50%',
        left: '25%',
        transform: 'translate(-50%, -50%)',
        zIndex: '40',
        pointerEvents: 'none',
        display: 'none',
        transition: 'all 0.3s ease',
      },
    });

    art.layers.add({
      name: 'seek-right',
      html: `
        <div class="seek-indicator right-indicator" style="display: none; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); width: 110px; height: 110px; border-radius: 50%; color: white; backdrop-filter: blur(12px); border: 2px solid rgba(0, 209, 255, 0.4); box-shadow: 0 0 30px rgba(0, 209, 255, 0.2);">
          <style>
            @keyframes seekRightAnim {
              0% { transform: translateX(-5px); opacity: 0.3; }
              50% { transform: translateX(5px); opacity: 1; }
              100% { transform: translateX(-5px); opacity: 0.3; }
            }
            .right-indicator .seek-icon-anim svg { animation: seekRightAnim 0.6s infinite; }
          </style>
          <div class="seek-icon-anim" style="display: flex; filter: drop-shadow(0 0 8px rgba(0, 209, 255, 0.5));">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
          </div>
          <span style="font-size: 16px; font-weight: 900; margin-top: 6px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 1px; color: #00D1FF;">10s</span>
        </div>
      `,
      style: {
        position: 'absolute',
        top: '50%',
        right: '25%',
        transform: 'translate(50%, -50%)',
        zIndex: '40',
        pointerEvents: 'none',
        display: 'none',
        transition: 'all 0.3s ease',
      },
    });

    const showSeekIndicator = (side: 'left' | 'right') => {
      const layer = art.layers[`seek-${side}`];
      if (layer) {
        layer.style.display = 'block';
        const inner = layer.querySelector(`.seek-indicator.${side}-indicator`) as HTMLElement;
        if (inner) {
          inner.style.display = 'flex';
          inner.animate([
            { opacity: 0, transform: 'scale(0.5)' },
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(1.5)' }
          ], { duration: 600, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
        }

        setTimeout(() => {
          layer.style.display = 'none';
        }, 600);
      }
    };

    // Custom 2x Speed Indicator Layer
    art.layers.add({
      name: 'speed-indicator',
      html: `
        <div class="speed-indicator-container" style="display: none; align-items: center; gap: 10px; background: rgba(0,0,0,0.6); padding: 10px 20px; border-radius: 40px; backdrop-filter: blur(12px); border: 1px solid rgba(0, 209, 255, 0.3); color: #00D1FF; font-weight: 800; font-family: 'Space Grotesk', sans-serif; pointer-events: none; box-shadow: 0 0 20px rgba(0, 209, 255, 0.2); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
          <div class="speed-icon-wrapper" style="display: flex;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px rgba(0, 209, 255, 0.6));">
              <polyline points="13 17 18 12 13 7"></polyline>
              <polyline points="6 17 11 12 6 7"></polyline>
            </svg>
          </div>
          <span style="font-size: 16px; letter-spacing: 0.1em; text-shadow: 0 0 10px rgba(0, 209, 255, 0.4);">2X SPEED</span>
        </div>
      `,
      style: {
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '30',
        pointerEvents: 'none',
        display: 'none',
        transition: 'opacity 0.2s ease',
      },
    });

    let longPressTimer: any = null;
    let isFastForwarding = false;

    const startFastForward = () => {
      if (isLive) return;
      isFastForwarding = true;
      art.playbackRate = 2;
      art.controls.show = false; // Hide controls during fast forward
      const indicator = art.layers['speed-indicator'];
      if (indicator) {
        indicator.style.display = 'block';
        const container = indicator.querySelector('.speed-indicator-container') as HTMLElement;
        if (container) container.style.display = 'flex';
      }
      art.notice.show = '2X Speed Active';
      
      // Haptic feedback if available
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    };

    const stopFastForward = () => {
      if (!isFastForwarding) return;
      isFastForwarding = false;
      art.playbackRate = 1;
      art.controls.show = true; // Show controls again
      const indicator = art.layers['speed-indicator'];
      if (indicator) {
        indicator.style.display = 'none';
        const container = indicator.querySelector('.speed-indicator-container') as HTMLElement;
        if (container) container.style.display = 'none';
      }
      art.notice.show = 'Normal Speed';
    };

    // Use native listeners for long press reliability and gesture blocking
    const video = art.template.$video;
    const container = art.template.$container;
    const mask = art.template.$mask;
    
    // Prevent swipe-to-seek on the video surface
    let startX = 0;
    let startY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      onStart(e);
    };

    const handleTouchMove = (e: TouchEvent) => {
      // If we are not interacting with controls, check if it's a horizontal movement
      const target = e.target as HTMLElement;
      if (!target.closest('.art-controls') && 
          !target.closest('.art-control') && 
          !target.closest('.art-settings') &&
          !target.closest('.art-layers')) {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = Math.abs(currentX - startX);
        const deltaY = Math.abs(currentY - startY);
        
        // Block horizontal movement to stop any residual swipe seek gestures
        if (deltaX > 3) {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const onStart = (e: Event) => {
      if (isLive) return;
      
      // Ignore long press if touching ANYTHING related to controls or overlays
      const target = e.target as HTMLElement;
      if (target.closest('.art-controls') || 
          target.closest('.art-control') || 
          target.closest('.art-settings') ||
          target.closest('.art-layers') ||
          target.closest('.art-mask')) { // Mask clicks can also trigger UI, so ignore long press on it if it's active
        return;
      }
      
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(startFastForward, 400);
    };

    const onEnd = () => {
      clearTimeout(longPressTimer);
      stopFastForward();
    };

    const handleSeekClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // ONLY handle if clicking the video service/mask, not controls
      if (target.closest('.art-controls') || 
          target.closest('.art-control') || 
          target.closest('.art-settings')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const now = Date.now();
      const delay = now - lastClickTimeRef.current;
      
      if (delay > 0 && delay < 350) {
        if (isLive) return;

        const rect = art.template.$video.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const width = rect.width;

        if (x < width * 0.45) {
          art.seek = Math.max(0, art.currentTime - 10);
          showSeekIndicator('left');
          if (window.navigator?.vibrate) window.navigator.vibrate(40);
        } else if (x > width * 0.55) {
          art.seek = Math.min(art.duration, art.currentTime + 10);
          showSeekIndicator('right');
          if (window.navigator?.vibrate) window.navigator.vibrate(40);
        }
        
        lastClickTimeRef.current = 0;
      } else {
        lastClickTimeRef.current = now;
        // Toggle controls visibility on single click
        art.controls.show = !art.controls.show;
      }
    };

    // Apply listeners to both video and mask for maximum coverage
    const elementsToBind = [video, mask, container].filter(Boolean);
    
    elementsToBind.forEach(el => {
      el.addEventListener('touchstart', handleTouchStart as any, { passive: false });
      el.addEventListener('touchend', onEnd as any);
      el.addEventListener('touchcancel', onEnd as any);
      el.addEventListener('touchmove', handleTouchMove as any, { passive: false });
      
      if (el === video || el === mask) {
        el.addEventListener('mousedown', ((e: MouseEvent) => {
          if (e.button === 0) onStart(e);
        }) as any);
        el.addEventListener('mouseup', onEnd as any);
        el.addEventListener('mouseleave', onEnd as any);
        
        // Use native click for both double tap detection AND killing play/pause toggle
        el.addEventListener('click', handleSeekClick as any, true);
      }
    });

    playerRef.current = art;
    
    // Find our custom react portal layer container to safely anchor custom overlays and avoid clipping
    const portalLayer = art.template.$container.querySelector('.react-portal-layer-container') as HTMLDivElement;
    if (portalLayer) {
      setEqPortalTarget(portalLayer);
    } else {
      setEqPortalTarget(art.template.$container);
    }

    // Track state transitions to show overlays in full viewport or absolute layer correctly
    art.on('fullscreen', (state) => {
      setIsFullscreen(state);
    });
    art.on('fullscreenWeb', (state) => {
      setIsFullscreen(state);
    });
    art.on('control', (visible) => {
      setControlsVisible(visible);
    });

    art.on('video:ended', () => {
      if (onPlayNext) {
        art.notice.show = "Playing next episode...";
        setTimeout(() => {
          onPlayNext();
        }, 1500);
      }
    });

    if (onReady) onReady(art);

    return () => {
      setEqPortalTarget(null);
      if (hlsRef.current) hlsRef.current.destroy();
      if (mpegtsRef.current) {
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
        mpegtsRef.current = null;
      }
      if (playerRef.current) {
        art.template.$video.removeEventListener('contextmenu', preventContext, true);
        art.template.$container.removeEventListener('contextmenu', preventContext, true);
        
        const elements = [video, mask, container].filter(Boolean);
        elements.forEach(el => {
          el.removeEventListener('touchstart', handleTouchStart as any);
          el.removeEventListener('touchend', onEnd as any);
          el.removeEventListener('touchcancel', onEnd as any);
          el.removeEventListener('touchmove', handleTouchMove as any);
          el.removeEventListener('click', handleSeekClick as any, true);
        });

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
      <AnimatePresence>
        {isLoading && !isEmbeddable(originalUrl) && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="absolute inset-0 z-[100] bg-[#080808] flex flex-col items-center justify-center p-4 text-center select-none"
          >
            {/* Minimal Ambient Glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[350px] max-h-[350px] bg-[#00D1FF]/5 blur-[80px] rounded-full" />
            </div>

            <div className="relative flex flex-col items-center gap-8 md:gap-10 w-full max-w-[300px]">
              {/* Premium Branding - Polished typography */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className="flex items-center gap-3 text-[#00D1FF] mb-1">
                  <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 drop-shadow-[0_0_15px_rgba(0,209,255,0.5)]" />
                  <span className="text-2xl md:text-3xl font-black tracking-[0.3em] font-sans uppercase italic">
                    4K•SJ
                  </span>
                </div>
                
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.8 }}
                  transition={{ delay: 0.3 }}
                  className="text-[#00D1FF]/70 text-[9px] md:text-[10px] font-medium tracking-[0.6em] uppercase ml-2"
                >
                  PREMIUM EXPERIENCE
                </motion.div>

                <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-[#00D1FF]/30 to-transparent mt-3" />
              </motion.div>

              {/* Horizontal Sequence Animation */}
              <div className="flex items-center gap-1.5 h-6">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: [8, 24, 8],
                      opacity: [0.2, 1, 0.2],
                    }}
                    transition={{ 
                      duration: 1, 
                      repeat: Infinity, 
                      delay: i * 0.15,
                      ease: "easeInOut"
                    }}
                    className="w-[3px] bg-[#00D1FF] rounded-full shadow-[0_0_8px_rgba(0,209,255,0.3)]"
                  />
                ))}
              </div>

              {/* Status Section */}
              <div className="flex flex-col items-center gap-3">
                <motion.span
                  key={loadingText}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white font-bold tracking-[0.25em] uppercase text-[11px] md:text-xs"
                >
                  {loadingText}
                </motion.span>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  transition={{ delay: 0.5 }}
                  className="text-white text-[9px] tracking-[0.1em] uppercase font-light"
                >
                  PLEASE WAIT 5 TO 10 SECONDS
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Floating EQ Toggle Button inside our custom portal layer inside Artplayer */}
      {eqPortalTarget && createPortal(
        <AnimatePresence>
          {controlsVisible && !isLoading && !isEmbeddable(originalUrl) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-[20px] right-[20px] z-[99] pointer-events-auto"
            >
              <button 
                type="button"
                onClick={openEqPanel}
                className="p-2.5 bg-black/55 hover:bg-[#00D1FF]/20 text-white hover:text-[#00D1FF] rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 transition-all cursor-pointer shadow-lg shadow-black/30"
                title="Open Custom Equalizer"
              >
                <Sliders className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        eqPortalTarget
      )}

      {/* Floating Episode Number Pill above bottom controls - only shown during controls visible & when web series is playing */}
      {eqPortalTarget && playingEpisode && createPortal(
        <AnimatePresence>
          {controlsVisible && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute bottom-[65px] md:bottom-[75px] left-[15px] md:left-[24px] z-[99] pointer-events-none"
            >
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-black/85 backdrop-blur-md rounded-full border border-white/10 shadow-[0_4px_25px_rgba(0,0,0,0.65)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] animate-pulse shadow-[0_0_8px_#00D1FF]" />
                <span className="text-[8px] md:text-[10px] text-white/50 font-black uppercase tracking-[0.2em] font-sans">
                  You are watching
                </span>
                <span className="text-[9px] md:text-[11px] font-black uppercase tracking-wider text-[#00D1FF] drop-shadow-[0_0_6px_rgba(0,209,255,0.55)]">
                  Episode {playingEpisode.episode_num}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        eqPortalTarget
      )}

      {/* Floating Next Episode Action Button - only shown during controls visible & when next episode is available */}
      {eqPortalTarget && nextEpisode && onPlayNext && createPortal(
        <AnimatePresence>
          {controlsVisible && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute bottom-[65px] md:bottom-[75px] right-[15px] md:right-[24px] z-[99] pointer-events-auto"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayNext();
                }}
                className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-[#00D1FF] to-[#00bdf1] hover:from-[#00e1ff] hover:to-[#00D1FF] text-black font-black tracking-widest text-[9px] md:text-[11px] uppercase rounded-xl md:rounded-2xl border border-cyan-400/40 shadow-[0_0_20px_rgba(0,209,255,0.4)] cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 flex-row"
                title={`Play Next Episode (${nextEpisode.episode ? nextEpisode.episode.episode_num : nextEpisode.episode_num})`}
              >
                <span>Play Next: Ep {nextEpisode.episode ? nextEpisode.episode.episode_num : nextEpisode.episode_num}</span>
                <SkipForward className="w-3.5 h-3.5 md:w-4 md:h-4 fill-black text-black" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        eqPortalTarget
      )}

      {/* Equalizer Panel Portal: Renders to document.body on normal screen (avoids overflow:hidden clipping) and eqPortalTarget in fullscreen */}
      {showEqPanel && (isFullscreen ? eqPortalTarget : (typeof document !== 'undefined' ? document.body : null)) && createPortal(
        <AnimatePresence>
          {showEqPanel && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`${isFullscreen ? 'absolute' : 'fixed'} inset-0 ${isFullscreen ? 'z-[199]' : 'z-[99999]'} bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none pointer-events-auto`}
              onClick={() => setShowEqPanel(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="w-full max-w-[340px] md:max-w-sm max-h-[95vh] sm:max-h-[85vh] bg-[#0c0c0e]/95 border border-[#00D1FF]/30 rounded-2xl p-4 sm:p-5 shadow-[0_0_50px_rgba(0,209,255,0.25)] flex flex-col gap-3 relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Glow background */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1.5 bg-[#00D1FF]/40 blur-xl rounded-full pointer-events-none" />
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2 text-[#00D1FF]">
                    <Sliders className="w-4 h-4 drop-shadow-[0_0_8px_rgba(0,209,255,0.55)]" />
                    <span className="font-extrabold tracking-[0.2em] text-[10px] sm:text-xs uppercase font-sans">
                      CUSTOM EQUALIZER
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowEqPanel(false)}
                    className="text-white/60 hover:text-white bg-white/5 hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable Container (critical for short viewports/mobile landscapes so elements are 100% visible) */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-4 touch-pan-y max-h-[60vh] sm:max-h-none scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent">
                  {/* Slider Slates */}
                  <div className="flex flex-col gap-3.5 py-1">
                    {/* Bass Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold tracking-wider">
                        <span className="text-white/60 uppercase text-[10px] sm:text-[11px]">Bass (150Hz)</span>
                        <span className={bassGain > 0 ? "text-[#00D1FF]" : bassGain < 0 ? "text-rose-500" : "text-white/40"}>
                          {bassGain > 0 ? `+${bassGain}` : bassGain} dB
                        </span>
                      </div>
                      <div className="relative flex items-center h-5">
                        <input 
                          type="range"
                          min="-12"
                          max="12"
                          step="1"
                          value={bassGain}
                          onChange={(e) => handleEqChange('bass', Number(e.target.value))}
                          className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#00D1FF] duration-150 focus:outline-none touch-none"
                        />
                      </div>
                    </div>

                    {/* Mids Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold tracking-wider">
                        <span className="text-white/60 uppercase text-[10px] sm:text-[11px]">Mids (1kHz)</span>
                        <span className={midGain > 0 ? "text-[#00D1FF]" : midGain < 0 ? "text-rose-500" : "text-white/40"}>
                          {midGain > 0 ? `+${midGain}` : midGain} dB
                        </span>
                      </div>
                      <div className="relative flex items-center h-5">
                        <input 
                          type="range"
                          min="-12"
                          max="12"
                          step="1"
                          value={midGain}
                          onChange={(e) => handleEqChange('mid', Number(e.target.value))}
                          className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#00D1FF] duration-150 focus:outline-none touch-none"
                        />
                      </div>
                    </div>

                    {/* Treble Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold tracking-wider">
                        <span className="text-white/60 uppercase text-[10px] sm:text-[11px]">Treble (6kHz)</span>
                        <span className={trebleGain > 0 ? "text-[#00D1FF]" : trebleGain < 0 ? "text-rose-500" : "text-white/40"}>
                          {trebleGain > 0 ? `+${trebleGain}` : trebleGain} dB
                        </span>
                      </div>
                      <div className="relative flex items-center h-5">
                        <input 
                          type="range"
                          min="-12"
                          max="12"
                          step="1"
                          value={trebleGain}
                          onChange={(e) => handleEqChange('treble', Number(e.target.value))}
                          className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#00D1FF] duration-150 focus:outline-none touch-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Presets Grid */}
                  <div className="space-y-2 pt-3 border-t border-white/5">
                    <span className="text-[9px] text-white/30 tracking-wider uppercase font-bold block">
                      Presets Quick-Access
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button 
                        type="button"
                        onClick={() => applyPreset('flat')}
                        className={`px-2 py-1.5 sm:py-2 rounded-xl border text-[9px] sm:text-[10px] font-extrabold transition-all uppercase tracking-wider cursor-pointer ${
                          bassGain === 0 && midGain === 0 && trebleGain === 0
                            ? "bg-[#00D1FF]/10 text-[#00D1FF] border-[#00D1FF]/40 shadow-[0_0_8px_rgba(0,209,255,0.1)]"
                            : "bg-white/5 text-white/60 border-transparent hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        Flat
                      </button>
                      <button 
                        type="button"
                        onClick={() => applyPreset('bass')}
                        className={`px-2 py-1.5 sm:py-2 rounded-xl border text-[9px] sm:text-[10px] font-extrabold transition-all uppercase tracking-wider cursor-pointer ${
                          bassGain === 8 && midGain === 0 && trebleGain === 2
                            ? "bg-[#00D1FF]/10 text-[#00D1FF] border-[#00D1FF]/40 shadow-[0_0_8px_rgba(0,209,255,0.1)]"
                            : "bg-white/5 text-white/60 border-transparent hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        Bass
                      </button>
                      <button 
                        type="button"
                        onClick={() => applyPreset('vocal')}
                        className={`px-2 py-1.5 sm:py-2 rounded-xl border text-[9px] sm:text-[10px] font-extrabold transition-all uppercase tracking-wider cursor-pointer ${
                          bassGain === -4 && midGain === 6 && trebleGain === 2
                            ? "bg-[#00D1FF]/10 text-[#00D1FF] border-[#00D1FF]/40 shadow-[0_0_8px_rgba(0,209,255,0.1)]"
                            : "bg-white/5 text-white/60 border-transparent hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        Vocal
                      </button>
                      <button 
                        type="button"
                        onClick={() => applyPreset('cinema')}
                        className={`px-2 py-1.5 sm:py-2 rounded-xl border text-[9px] sm:text-[10px] font-extrabold transition-all uppercase tracking-wider cursor-pointer ${
                          bassGain === 5 && midGain === -2 && trebleGain === 4
                            ? "bg-[#00D1FF]/10 text-[#00D1FF] border-[#00D1FF]/40 shadow-[0_0_8px_rgba(0,209,255,0.1)]"
                            : "bg-white/5 text-white/60 border-transparent hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        Cinema
                      </button>
                      <button 
                        type="button"
                        onClick={() => applyPreset('loudness')}
                        className={`px-2 py-1.5 sm:py-2 rounded-xl border text-[9px] sm:text-[10px] font-extrabold transition-all uppercase tracking-wider cursor-pointer ${
                          bassGain === 4 && midGain === 3 && trebleGain === 4
                            ? "bg-[#00D1FF]/10 text-[#00D1FF] border-[#00D1FF]/40 shadow-[0_0_8px_rgba(0,209,255,0.15)]"
                            : "bg-white/5 text-white/60 border-transparent hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        Loud
                      </button>
                    </div>
                  </div>
                </div>

                {/* Exit/Close trigger */}
                <button 
                  type="button"
                  onClick={() => setShowEqPanel(false)}
                  className="w-full mt-2 bg-[#00D1FF] hover:bg-[#00e1ff] text-black font-black tracking-widest text-[10px] sm:text-[11px] uppercase py-2.5 sm:py-3 rounded-xl transition-all shadow-lg shadow-[#00D1FF]/20 cursor-pointer"
                >
                  Done
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        isFullscreen ? eqPortalTarget! : document.body
      )}
    </div>
  );
};

export default VideoPlayer;
