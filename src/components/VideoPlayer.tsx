import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Cpu, Globe, Sliders, X, SkipForward, List, Tv, Download, Gauge, RotateCcw, Pencil, Check, Zap } from 'lucide-react';

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
  episodesMap?: Record<string, any[]>;
  onSelectEpisode?: (episode: any, seasonNum: string) => void;
  onDownloadEpisode?: (episode: any) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  options, 
  onReady, 
  onClose, 
  playingEpisode, 
  nextEpisode, 
  onPlayNext,
  episodesMap,
  onSelectEpisode,
  onDownloadEpisode
}) => {
  const artRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Artplayer | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<any>(null);
  const lastClickTimeRef = useRef<number>(0);
  const userSelectedSpeedRef = useRef<number>(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('LOADING VIDEO...');
  const [showEqPanel, setShowEqPanel] = useState(false);
  const [showEpisodesPanel, setShowEpisodesPanel] = useState(false);
  const [showSpeedPanel, setShowSpeedPanel] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(1.0);
  const [isEditingSpeed, setIsEditingSpeed] = useState(false);
  const [manualSpeedInput, setManualSpeedInput] = useState('1.00');
  const [panelSeason, setPanelSeason] = useState<string>('');
  const [bassGain, setBassGain] = useState(0);
  const [midGain, setMidGain] = useState(0);
  const [trebleGain, setTrebleGain] = useState(0);
  const [volumeBoost, setVolumeBoost] = useState(1.0);

  const handleVolumeBoostChange = (val: number) => {
    const rounded = Number(val.toFixed(2));
    setVolumeBoost(rounded);
    if (playerRef.current) {
      try {
        const graph = getAudioGraph(playerRef.current);
        if (graph && graph.gainNode) {
          graph.gainNode.gain.value = rounded;
          playerRef.current.notice.show = `Volume Boost: ${Math.round(rounded * 100)}%`;
        }
      } catch (e) {
        console.error('Volume boost write error:', e);
      }
    }
  };
  const [eqPortalTarget, setEqPortalTarget] = useState<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const areControlsShown = controlsVisible && !showEqPanel && !showSpeedPanel && !showEpisodesPanel && isFullscreen;

  const updatePlaybackSpeed = (speed: number) => {
    const clamped = Math.max(0.25, Math.min(4.0, Number(speed)));
    const formatted = Number(clamped.toFixed(2));
    setCurrentSpeed(formatted);
    userSelectedSpeedRef.current = formatted;
    setManualSpeedInput(clamped.toFixed(2));
    if (playerRef.current) {
      playerRef.current.playbackRate = formatted;
      playerRef.current.notice.show = `Speed: ${clamped.toFixed(2)}x`;
    }
  };

  const openEpisodesPanel = () => {
    if (episodesMap) {
      const currentSeason = playingEpisode?.season || Object.keys(episodesMap).sort((a, b) => Number(a) - Number(b))[0] || '';
      setPanelSeason(currentSeason);
    }
    setShowEpisodesPanel(true);
  };

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
        if (graph) {
          if (graph.eqFilters) {
            setBassGain(graph.eqFilters.bass.gain.value);
            setMidGain(graph.eqFilters.mid.gain.value);
            setTrebleGain(graph.eqFilters.treble.gain.value);
          }
          if (graph.gainNode) {
            setVolumeBoost(graph.gainNode.gain.value);
          }
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

  const isLiveStream = React.useMemo(() => {
    const isHls = originalUrl.toLowerCase().includes('.m3u8') || source?.type === 'application/x-mpegURL';
    const isTs = originalUrl.toLowerCase().includes('.ts') || source?.type === 'video/mp2t';
    return !!(options.isLive || isHls || isTs || originalUrl?.includes('/live/'));
  }, [originalUrl, options.isLive, source]);

  const isEmbeddable = (url: string) => {
    if (isEmbed) return true;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('blogger.com') || 
           lowerUrl.includes('youtube.com/embed') || 
           lowerUrl.includes('dailymotion.com/embed') ||
           lowerUrl.includes('vimeo.com/video') ||
           lowerUrl.includes('/embed/');
  };

  const onCloseRef = useRef(onClose);
  const onReadyRef = useRef(onReady);
  const onPlayNextRef = useRef(onPlayNext);
  const optionsRef = useRef(options);

  useEffect(() => {
    onCloseRef.current = onClose;
    onReadyRef.current = onReady;
    onPlayNextRef.current = onPlayNext;
    optionsRef.current = options;
  });

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
      playbackRate: false, 
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
        disablePictureInPicture: false,
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
          html: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
          tooltip: 'Close Player',
          click: function() {
            if (art.fullscreen) {
              art.fullscreen = false;
            }
            if (art.fullscreenWeb) {
              art.fullscreenWeb = false;
            }
            if (document.fullscreenElement) {
              try {
                document.exitFullscreen().catch(() => {});
              } catch (_) {}
            }
            if (onCloseRef.current) onCloseRef.current();
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
        }
      ],
      layers: [
        {
          name: 'back-button',
          html: '<div style="padding: 10px; background: rgba(0,0,0,0.5); border-radius: 50%; width: 40px; height: 40px; display: flex; items-center; justify-content: center; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1); cursor: pointer;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00D1FF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div>',
          style: {
            position: 'absolute',
            top: '20px',
            left: '20px',
            display: 'none',
            zIndex: '20',
          },
          click: function() {
            if (art.fullscreen) {
              art.fullscreen = false;
            }
            if (art.fullscreenWeb) {
              art.fullscreenWeb = false;
            }
            if (document.fullscreenElement) {
              try {
                document.exitFullscreen().catch(() => {});
              } catch (_) {}
            }
            if (onCloseRef.current) onCloseRef.current();
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
      const originalSpeed = userSelectedSpeedRef.current;
      art.playbackRate = originalSpeed;
      art.controls.show = true; // Show controls again
      const indicator = art.layers['speed-indicator'];
      if (indicator) {
        indicator.style.display = 'none';
        const container = indicator.querySelector('.speed-indicator-container') as HTMLElement;
        if (container) container.style.display = 'none';
      }
      art.notice.show = originalSpeed === 1.0 ? 'Normal Speed' : `Speed: ${originalSpeed.toFixed(2)}x`;
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
      if (!state) {
        setShowEqPanel(false);
        setShowSpeedPanel(false);
        setShowEpisodesPanel(false);
      }
    });
    art.on('fullscreenWeb', (state) => {
      setIsFullscreen(state);
      if (!state) {
        setShowEqPanel(false);
        setShowSpeedPanel(false);
        setShowEpisodesPanel(false);
      }
    });
    art.on('control', (visible) => {
      setControlsVisible(visible);
    });

    art.on('video:ratechange', () => {
      setCurrentSpeed(art.playbackRate);
    });

    art.on('video:ended', () => {
      if (onPlayNextRef.current) {
        art.notice.show = "Playing next episode...";
        setTimeout(() => {
          onPlayNextRef.current?.();
        }, 1500);
      }
    });

    if (onReadyRef.current) onReadyRef.current(art);

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
  }, []);

  // Listen for subsequent URL changes to switch player source dynamically
  // and preserve fullscreen state perfectly!
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (playerRef.current && sourceUrl && !isEmbeddable(originalUrl)) {
      setIsLoading(true);
      setLoadingText('LOADING VIDEO...');
      
      const newLowerUrl = sourceUrl.toLowerCase();
      const newIsHls = newLowerUrl.includes('.m3u8') || (source?.type === 'application/x-mpegURL');
      const newIsTs = newLowerUrl.includes('.ts') || (source?.type === 'video/mp2t');
      const newIsMkv = newLowerUrl.includes('.mkv');
      
      const newType = newIsHls ? 'm3u8' : 
                      (newLowerUrl.includes('.mp4') ? 'mp4' : 
                      (newLowerUrl.includes('.webm') ? 'webm' : 
                      (newIsMkv ? 'mkv' : (newIsTs ? 'ts' : undefined))));
      
      playerRef.current.switchUrl(sourceUrl, newType).then(() => {
        console.log("Artplayer successfully switched source url:", sourceUrl);
      }).catch(err => {
        console.error("switchUrl error:", err);
      });
    }
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
        <div 
          ref={artRef} 
          className={`w-full h-full artplayer-app ${
            (showEqPanel || showSpeedPanel || showEpisodesPanel) ? 'hide-player-controls' : ''
          }`} 
        />
      )}

      {/* Floating EQ Toggle Button inside our custom portal layer inside Artplayer */}
      {eqPortalTarget && createPortal(
        <AnimatePresence>
          {areControlsShown && !isLoading && !isEmbeddable(originalUrl) && (
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

      {/* Floating Play Speed Button inside our custom portal layer inside Artplayer */}
      {eqPortalTarget && !isLiveStream && createPortal(
        <AnimatePresence>
          {areControlsShown && !isLoading && !isEmbeddable(originalUrl) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-[75px] right-[20px] z-[99] pointer-events-auto"
            >
              <button 
                type="button"
                onClick={() => {
                  setManualSpeedInput(currentSpeed.toFixed(2));
                  setIsEditingSpeed(false);
                  setShowSpeedPanel(true);
                }}
                className="flex items-center justify-center bg-black/65 hover:bg-[#00D1FF]/20 text-white hover:text-[#00D1FF] rounded-full backdrop-blur-md border border-white/10 hover:border-[#00D1FF]/40 transition-all duration-300 cursor-pointer shadow-lg shadow-black/40 gap-1.5 w-[85px] h-10 hover:scale-105 active:scale-95 px-2.5"
                title="Play Speed"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] text-[#00D1FF] drop-shadow-[0_0_5px_rgba(0,209,255,0.7)] flex-shrink-0 animate-pulse">
                  <path d="M4 15a8 8 0 1 1 1.05 4.5" />
                  <path d="M12 15h.01" strokeWidth="4" />
                  <path d="M12 15l2.5-4.5" stroke="currentColor" strokeWidth="2.5" />
                </svg>
                <span className="text-[11px] font-bold tracking-tight font-mono select-none text-white/90">
                  {currentSpeed.toFixed(2)}x
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        eqPortalTarget
      )}
      {/* Floating Episodes Button inside our custom portal layer exactly below EQ button */}
      {eqPortalTarget && episodesMap && onSelectEpisode && createPortal(
        <AnimatePresence>
          {areControlsShown && !isLoading && !isEmbeddable(originalUrl) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-[130px] right-[20px] z-[99] pointer-events-auto"
            >
              <button 
                type="button"
                onClick={openEpisodesPanel}
                className="w-10 h-10 bg-black/65 hover:bg-[#00D1FF]/20 text-white hover:text-[#00D1FF] rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 transition-all cursor-pointer shadow-lg shadow-black/30"
                title="Browse Episodes"
              >
                <List className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        eqPortalTarget
      )}

      {/* Floating Episode Number Pill above bottom controls - only shown during controls visible & when web series is playing */}
      {eqPortalTarget && playingEpisode && createPortal(
        <AnimatePresence>
          {areControlsShown && !isLoading && (
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
          {areControlsShown && !isLoading && (
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
              className={`${isFullscreen ? 'absolute' : 'fixed'} inset-0 ${isFullscreen ? 'z-[199]' : 'z-[99999]'} bg-black/10 flex items-center justify-center landscape:justify-end md:justify-end p-3 sm:p-4 landscape:pr-8 md:pr-16 select-none pointer-events-auto`}
              onClick={() => setShowEqPanel(false)}
            >
              <div className="flex flex-row items-stretch gap-3" onClick={(e) => e.stopPropagation()}>
                {/* Column 1: Vertical Volume Boost Control */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, x: isFullscreen ? -30 : -10 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  exit={{ scale: 0.95, opacity: 0, x: isFullscreen ? -30 : -10 }}
                  transition={{ type: "spring", damping: 25, stiffness: 350 }}
                  className="w-[72px] sm:w-[80px] bg-[#0c0c0e]/95 backdrop-blur-2xl border border-amber-500/35 rounded-2xl p-3 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col items-center gap-2.5 relative overflow-hidden select-none"
                >
                  {/* Glow effect */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-amber-500/40 blur-lg rounded-full pointer-events-none" />

                  {/* Header info */}
                  <div className="flex flex-col items-center text-center shrink-0">
                    <Zap className="w-4 h-4 text-amber-400 animate-pulse drop-shadow-[0_0_6px_rgba(245,158,11,0.6)] mb-0.5" />
                    <span className="text-[7.5px] text-white/50 tracking-wider uppercase font-extrabold font-sans">
                      BOOST
                    </span>
                    <span className="text-xs font-mono font-black text-amber-400 mt-0.5">
                      {Math.round(volumeBoost * 100)}%
                    </span>
                  </div>

                  {/* High Quality Interactivity Area */}
                  <div 
                    className="flex-1 w-full flex flex-col items-center justify-between relative cursor-ns-resize group select-none py-1.5"
                    onPointerDown={(e) => {
                      const el = e.currentTarget;
                      el.setPointerCapture(e.pointerId);
                      
                      const handleDrag = (ev: PointerEvent) => {
                        const rect = el.getBoundingClientRect();
                        const val01 = Math.max(0, Math.min(1, (rect.bottom - ev.clientY) / rect.height));
                        handleVolumeBoostChange(1.0 + val01 * 3.0);
                      };
                      
                      const handleRelease = (ev: PointerEvent) => {
                        try {
                          el.releasePointerCapture(ev.pointerId);
                        } catch(err) {}
                        el.removeEventListener('pointermove', handleDrag);
                        el.removeEventListener('pointerup', handleRelease);
                        el.removeEventListener('pointercancel', handleRelease);
                      };
                      
                      el.addEventListener('pointermove', handleDrag);
                      el.addEventListener('pointerup', handleRelease);
                      el.addEventListener('pointercancel', handleRelease);
                      
                      const rect = el.getBoundingClientRect();
                      const val01 = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
                      handleVolumeBoostChange(1.0 + val01 * 3.0);
                    }}
                  >
                    {/* Tick markers */}
                    <div className="absolute inset-y-1.5 left-1 sm:left-2 flex flex-col justify-between text-[6.5px] font-mono text-white/25 pointer-events-none h-full select-none">
                      <span>400</span>
                      <span>325</span>
                      <span>250</span>
                      <span>175</span>
                      <span>100</span>
                    </div>

                    {/* Visual slider track */}
                    <div className="w-2.5 h-full bg-white/5 border border-white/10 rounded-full relative overflow-hidden flex items-end ml-4 sm:ml-5 shadow-inner">
                      {/* Active level fill */}
                      <div 
                        className="w-full bg-gradient-to-t from-amber-600 via-amber-400 to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)] transition-all duration-75 origin-bottom" 
                        style={{ height: `${((volumeBoost - 1) / 3) * 100}%` }}
                      />
                      
                      {/* Draggable pointer head visual overlay */}
                      <div 
                        className="absolute left-0 right-0 h-1.5 bg-white border-y border-amber-500 shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-all duration-75 cursor-ns-resize"
                        style={{ bottom: `calc(${((volumeBoost - 1) / 3) * 100}% - 3px)` }}
                      />
                    </div>
                  </div>

                  {/* Power status phrase */}
                  <div className="text-center shrink-0">
                    <span className="text-[7.5px] text-white/50 font-mono tracking-tighter uppercase block font-black">
                      {volumeBoost > 3.0 ? 'ULTRA BOOST' : volumeBoost > 2.0 ? 'EXTREME' : volumeBoost > 1.05 ? 'TURBO' : 'NORMAL'}
                    </span>
                  </div>
                </motion.div>

                {/* Column 2: The Main Custom Equalizer Box */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, x: isFullscreen ? 50 : 20 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  exit={{ scale: 0.95, opacity: 0, x: isFullscreen ? 50 : 20 }}
                  transition={{ type: "spring", damping: 25, stiffness: 350 }}
                  className="w-full max-w-[310px] bg-[#0c0c0e]/95 backdrop-blur-2xl border border-cyan-500/35 rounded-2xl p-4 shadow-[0_0_50px_rgba(0,209,255,0.35)] flex flex-col gap-3 relative overflow-hidden"
                >
                  {/* Glow background */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1.5 bg-[#00D1FF]/40 blur-xl rounded-full pointer-events-none" />
                  
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 shrink-0">
                    <div className="flex items-center gap-2 text-[#00D1FF]">
                      <Sliders className="w-4 h-4 drop-shadow-[0_0_8px_rgba(0,209,255,0.55)]" />
                      <span className="font-extrabold tracking-[0.2em] text-[10px] uppercase font-sans">
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

                  {/* Scrollable Container */}
                  <div className="flex-1 overflow-y-auto pr-0.5 space-y-3.5 child-no-shrink touch-pan-y scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent">
                    {/* Slider Slates */}
                    <div className="flex flex-col gap-2.5 py-0.5">
                      {/* Bass Slider (Row Layout) */}
                      <div className="flex items-center justify-between gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                        <div className="flex flex-col min-w-[70px]">
                          <span className="text-white/80 font-bold uppercase text-[9px] tracking-wider">Bass</span>
                          <span className="text-[8px] text-white/30 font-semibold uppercase font-sans">150Hz</span>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <input 
                            type="range"
                            min="-12"
                            max="12"
                            step="1"
                            value={bassGain}
                            onChange={(e) => handleEqChange('bass', Number(e.target.value))}
                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#00D1FF] duration-150 focus:outline-none touch-none"
                          />
                          <span className={`text-[10px] font-mono font-bold min-w-[36px] text-right ${bassGain > 0 ? "text-[#00D1FF]" : bassGain < 0 ? "text-rose-500" : "text-white/40"}`}>
                            {bassGain > 0 ? `+${bassGain}` : bassGain}dB
                          </span>
                        </div>
                      </div>

                      {/* Mids Slider (Row Layout) */}
                      <div className="flex items-center justify-between gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                        <div className="flex flex-col min-w-[70px]">
                          <span className="text-white/80 font-bold uppercase text-[9px] tracking-wider">Mids</span>
                          <span className="text-[8px] text-white/30 font-semibold uppercase font-sans">1kHz</span>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <input 
                            type="range"
                            min="-12"
                            max="12"
                            step="1"
                            value={midGain}
                            onChange={(e) => handleEqChange('mid', Number(e.target.value))}
                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#00D1FF] duration-150 focus:outline-none touch-none"
                          />
                          <span className={`text-[10px] font-mono font-bold min-w-[36px] text-right ${midGain > 0 ? "text-[#00D1FF]" : midGain < 0 ? "text-rose-500" : "text-white/40"}`}>
                            {midGain > 0 ? `+${midGain}` : midGain}dB
                          </span>
                        </div>
                      </div>

                      {/* Treble Slider (Row Layout) */}
                      <div className="flex items-center justify-between gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
                        <div className="flex flex-col min-w-[70px]">
                          <span className="text-white/80 font-bold uppercase text-[9px] tracking-wider">Treble</span>
                          <span className="text-[8px] text-white/30 font-semibold uppercase font-sans">6kHz</span>
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <input 
                            type="range"
                            min="-12"
                            max="12"
                            step="1"
                            value={trebleGain}
                            onChange={(e) => handleEqChange('treble', Number(e.target.value))}
                            className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#00D1FF] duration-150 focus:outline-none touch-none"
                          />
                          <span className={`text-[10px] font-mono font-bold min-w-[36px] text-right ${trebleGain > 0 ? "text-[#00D1FF]" : trebleGain < 0 ? "text-rose-500" : "text-white/40"}`}>
                            {trebleGain > 0 ? `+${trebleGain}` : trebleGain}dB
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Presets Grid */}
                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                      <span className="text-[9px] text-white/30 tracking-wider uppercase font-black block">
                        Presets Quick-Access
                      </span>
                      <div className="grid grid-cols-5 gap-1">
                        <button 
                          type="button"
                          onClick={() => applyPreset('flat')}
                          className={`py-1.5 rounded-lg border text-[8px] font-black transition-all uppercase tracking-widest cursor-pointer ${
                            bassGain === 0 && midGain === 0 && trebleGain === 0
                              ? "bg-[#00D1FF]/15 text-[#00D1FF] border-[#00D1FF]/40 shadow-[0_0_8px_rgba(0,209,255,0.1)]"
                              : "bg-white/5 text-white/60 border-transparent hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          Flat
                        </button>
                        <button 
                          type="button"
                          onClick={() => applyPreset('bass')}
                          className={`py-1.5 rounded-lg border text-[8px] font-black transition-all uppercase tracking-widest cursor-pointer ${
                            bassGain === 8 && midGain === 0 && trebleGain === 2
                              ? "bg-[#00D1FF]/15 text-[#00D1FF] border-[#00D1FF]/40 shadow-[0_0_8px_rgba(0,209,255,0.1)]"
                              : "bg-white/5 text-white/60 border-transparent hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          Bass
                        </button>
                        <button 
                          type="button"
                          onClick={() => applyPreset('vocal')}
                          className={`py-1.5 rounded-lg border text-[8px] font-black transition-all uppercase tracking-widest cursor-pointer ${
                            bassGain === -4 && midGain === 6 && trebleGain === 2
                              ? "bg-[#00D1FF]/15 text-[#00D1FF] border-[#00D1FF]/40 shadow-[0_0_8px_rgba(0,209,255,0.1)]"
                              : "bg-white/5 text-white/60 border-transparent hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          Vocal
                        </button>
                        <button 
                          type="button"
                          onClick={() => applyPreset('cinema')}
                          className={`py-1.5 rounded-lg border text-[8px] font-black transition-all uppercase tracking-widest cursor-pointer ${
                            bassGain === 5 && midGain === -2 && trebleGain === 4
                              ? "bg-[#00D1FF]/15 text-[#00D1FF] border-[#00D1FF]/40 shadow-[0_0_8px_rgba(0,209,255,0.1)]"
                              : "bg-white/5 text-white/60 border-transparent hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          Cine
                        </button>
                        <button 
                          type="button"
                          onClick={() => applyPreset('loudness')}
                          className={`py-1.5 rounded-lg border text-[8px] font-black transition-all uppercase tracking-widest cursor-pointer ${
                            bassGain === 4 && midGain === 3 && trebleGain === 4
                              ? "bg-[#00D1FF]/15 text-[#00D1FF] border-[#00D1FF]/40 shadow-[0_0_8px_rgba(0,209,255,0.15)]"
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
                    className="w-full bg-[#00D1FF] hover:bg-[#00e1ff] text-black font-black tracking-widest text-[10px] uppercase py-2.5 rounded-xl transition-all shadow-lg shadow-[#00D1FF]/20 cursor-pointer shrink-0"
                  >
                    Done
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        isFullscreen ? eqPortalTarget! : document.body
      )}

      {/* Custom Speed Panel Portal: Renders to document.body on normal screen and eqPortalTarget in fullscreen */}
      {showSpeedPanel && (isFullscreen ? eqPortalTarget : (typeof document !== 'undefined' ? document.body : null)) && createPortal(
        <AnimatePresence>
          {showSpeedPanel && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`${isFullscreen ? 'absolute' : 'fixed'} inset-0 ${isFullscreen ? 'z-[199]' : 'z-[99999]'} bg-black/10 flex items-center justify-center landscape:justify-end md:justify-end p-3 sm:p-4 landscape:pr-8 md:pr-16 select-none pointer-events-auto`}
              onClick={() => setShowSpeedPanel(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, x: isFullscreen ? 50 : 20 }}
                animate={{ scale: 1, opacity: 1, x: 0 }}
                exit={{ scale: 0.95, opacity: 0, x: isFullscreen ? 50 : 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="w-full max-w-[310px] bg-[#0c0c0e]/95 backdrop-blur-2xl border border-cyan-500/35 rounded-2xl p-4 shadow-[0_0_50px_rgba(0,209,255,0.35)] flex flex-col gap-3 relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Visual Ambient Speed Glow Arc in the background */}
                <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-64 h-32 bg-cyan-500/10 blur-[50px] rounded-full pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-2 shrink-0">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-cyan-400">
                      <path d="M4 15a8 8 0 1 1 1.05 4.5" />
                      <path d="M12 15h.01" strokeWidth="4" />
                      <path d="M12 15l2.5-4.5" stroke="currentColor" strokeWidth="2.5" />
                    </svg>
                    <span className="font-extrabold tracking-[0.2em] text-[10px] uppercase font-sans">
                      PLAYBACK CONTROL
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowSpeedPanel(false)}
                    className="text-white/60 hover:text-white bg-white/5 hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Main stack containing speed control options */}
                <div className="flex-1 space-y-3.5 flex flex-col justify-start overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent">
                  
                  {/* Compact Speed Display Indicator Area */}
                  <div className="bg-[#060913]/65 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center min-h-[90px] relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/5 to-transparent pointer-events-none" />
                    {isEditingSpeed ? (
                      <div className="flex items-center gap-1.5 bg-black/8 w-full max-w-[190px] justify-between p-1 px-2 border border-cyan-500/35 rounded-lg shadow-[0_0_15px_rgba(0,209,255,0.15)]">
                        <input
                          type="text"
                          value={manualSpeedInput}
                          onChange={(e) => setManualSpeedInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = parseFloat(manualSpeedInput);
                              if (!isNaN(val)) updatePlaybackSpeed(val);
                              setIsEditingSpeed(false);
                            }
                          }}
                          className="bg-transparent text-[#00D1FF] text-center text-base outline-none font-black font-mono w-20 tracking-tight"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = parseFloat(manualSpeedInput);
                            if (!isNaN(val)) updatePlaybackSpeed(val);
                            setIsEditingSpeed(false);
                          }}
                          className="p-1 px-2.5 bg-[#00D1FF] hover:bg-cyan-400 text-black font-extrabold rounded-md transition-all cursor-pointer text-[9px] uppercase font-black"
                        >
                          SET
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setManualSpeedInput(currentSpeed.toFixed(2));
                          setIsEditingSpeed(true);
                        }}
                        className="flex flex-col items-center justify-center group cursor-pointer w-full"
                        title="Click to enter manual speed"
                      >
                        <span className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-cyan-400 drop-shadow-[0_0_12px_rgba(0,209,255,0.35)] font-mono leading-none">
                          {currentSpeed.toFixed(2)}x
                        </span>
                        
                        <div className="mt-2.5 px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 hover:border-cyan-400/60 rounded-full flex items-center justify-center gap-1.5 transition-all duration-300">
                          <Pencil className="w-3 h-3 text-cyan-400" />
                          <span className="text-[8px] text-[#00D1FF] font-black uppercase tracking-widest font-sans leading-none">
                            Type Custom Speed
                          </span>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Tactile Micro Adjuster Row */}
                  <div className="grid grid-cols-3 gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => updatePlaybackSpeed(currentSpeed - 0.05)}
                      className="py-1.5 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 text-white/80 hover:text-red-400 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95"
                      title="Slow down 0.05x"
                    >
                      <span className="text-sm font-bold font-sans leading-none">&minus;</span>
                      <span className="text-[7.5px] uppercase tracking-wider text-white/30 font-black block mt-0.5 leading-none font-sans">0.05x Slow</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => updatePlaybackSpeed(1.0)}
                      className="py-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 text-white/50 hover:text-cyan-400 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 gap-0.5"
                      title="Reset to 1.00x"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="text-[7.5px] uppercase tracking-wider text-white/30 font-black block leading-none font-sans">Normal</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => updatePlaybackSpeed(currentSpeed + 0.05)}
                      className="py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 text-white/80 hover:text-emerald-400 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95"
                      title="Speed up 0.05x"
                    >
                      <span className="text-sm font-bold font-sans leading-none">&#x002B;</span>
                      <span className="text-[7.5px] uppercase tracking-wider text-white/30 font-black block mt-0.5 leading-none font-sans">0.05x Fast</span>
                    </button>
                  </div>

                  {/* Speed Presets Grid */}
                  <div className="space-y-1.5 shrink-0">
                    <span className="text-[9px] text-white/30 font-black uppercase tracking-wider block leading-none">
                      Speed Presets
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 3.0].map((presetVal) => {
                        const isSelected = currentSpeed === presetVal;
                        return (
                          <button
                            key={presetVal}
                            type="button"
                            onClick={() => updatePlaybackSpeed(presetVal)}
                            className={`py-1.5 rounded-lg text-[9px] font-black font-mono tracking-tight transition-all duration-300 cursor-pointer text-center border active:scale-95 ${
                              isSelected
                                ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 text-black border-cyan-400 shadow-[0_0_8px_rgba(0,209,255,0.2)]'
                                : 'bg-white/[0.03] hover:bg-white/[0.08] text-white/70 hover:text-white border-white/5 hover:border-white/10'
                            }`}
                            title={`Set speed to ${presetVal.toFixed(2)}x`}
                          >
                            {presetVal === 1.0 ? '1.0x' : `${presetVal}x`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fine-Tuning Slider */}
                  <div className="flex flex-col gap-1 bg-black/40 border border-white/5 rounded-xl p-2 shrink-0">
                    <div className="flex justify-between items-center text-[7.5px] text-white/30 uppercase tracking-widest font-black font-sans px-0.5">
                      <span>0.25x</span>
                      <span className="text-cyan-400 font-mono tracking-wider">Slide to Fine-Tune</span>
                      <span>4.00x</span>
                    </div>
                    <div className="relative flex items-center h-5 px-1 pb-0.5">
                      <div className="absolute left-1 right-1 h-0.5 bg-white/10 rounded-full pointer-events-none w-full">
                        <div 
                          className="absolute left-0 h-full bg-gradient-to-r from-cyan-500 to-[#00D1FF] rounded-full"
                          style={{ width: `${Math.max(0, Math.min(100, ((currentSpeed - 0.25) / 3.75) * 100))}%` }}
                        />
                      </div>
                      <input 
                        type="range"
                        min="0.25"
                        max="4.0"
                        step="0.05"
                        value={currentSpeed}
                        onChange={(e) => updatePlaybackSpeed(Number(e.target.value))}
                        className="w-full h-5 bg-transparent appearance-none cursor-pointer accent-[#00D1FF] outline-none relative z-20 touch-none"
                      />
                    </div>
                  </div>

                </div>

                {/* Confirm Done trigger */}
                <button 
                  type="button"
                  onClick={() => setShowSpeedPanel(false)}
                  className="w-full bg-[#00D1FF] hover:bg-[#00e1ff] text-black font-black tracking-widest text-[10px] uppercase py-2.5 rounded-xl transition-all shadow-lg shadow-[#00D1FF]/20 cursor-pointer shrink-0"
                >
                  Done
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        isFullscreen ? eqPortalTarget! : document.body
      )}

      {/* Episodes Sliding Panel Drawer Portal: always render inside eqPortalTarget so it's fully responsive & works in full screen */}
      {showEpisodesPanel && episodesMap && onSelectEpisode && eqPortalTarget && createPortal(
        <AnimatePresence>
          {showEpisodesPanel && (
            <div className="absolute inset-0 z-[149] pointer-events-none select-none">
              {/* Back scrim clickable to close */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowEpisodesPanel(false)}
                className="absolute inset-0 bg-black/60 z-[149] pointer-events-auto cursor-pointer"
              />
              
              {/* Sliding drawer container */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 220 }}
                className="absolute right-0 top-0 bottom-0 max-w-[90vw] w-[320px] md:w-[380px] h-full z-[150] bg-[#0c0c0e]/95 border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.95)] flex flex-col p-4 sm:p-5 pointer-events-auto select-none backdrop-blur-xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
                  <div className="flex items-center gap-2 text-[#00D1FF]">
                    <Tv className="w-4 h-4 drop-shadow-[0_0_8px_rgba(0,209,255,0.55)]" />
                    <span className="font-extrabold tracking-[0.2em] text-[10px] sm:text-xs uppercase font-sans">
                      Browse Episodes
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowEpisodesPanel(false)}
                    className="text-white/60 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Seasons Toggle */}
                {Object.keys(episodesMap).length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 border-b border-white/5 shrink-0 no-scrollbar">
                    {Object.keys(episodesMap).sort((a,b)=>Number(a)-Number(b)).map((seasonNum) => (
                      <button
                        key={`panel-season-${seasonNum}`}
                        type="button"
                        onClick={() => setPanelSeason(seasonNum)}
                        className={`px-3 py-1 rounded-full text-[9px] md:text-[10px] uppercase font-bold tracking-wider transition-all border shrink-0 cursor-pointer ${
                          panelSeason === seasonNum
                            ? "bg-[#00D1FF]/10 text-[#00D1FF] border-[#00D1FF]/40 shadow-[0_0_10px_rgba(0,209,255,0.2)]"
                            : "bg-white/5 text-white/50 border-white/5 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        Season {seasonNum}
                      </button>
                    ))}
                  </div>
                )}

                {/* Episode Items */}
                <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-2 no-scrollbar scroll-smooth">
                  {episodesMap[panelSeason || '']?.map((episode: any, idx: number) => {
                    const isCurrent = String(episode.id) === String(playingEpisode?.id);
                    return (
                      <button
                        key={`panel-ep-${episode.id}-${idx}`}
                        type="button"
                        onClick={() => {
                          if (onSelectEpisode) {
                            onSelectEpisode(episode, panelSeason);
                          }
                          setShowEpisodesPanel(false);
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer group shrink-0 ${
                          isCurrent
                            ? "bg-gradient-to-r from-[#00D1FF]/15 to-cyan-500/5 text-white border-[#00D1FF]/45 shadow-[0_0_15px_rgba(0,209,255,0.15)]"
                            : "bg-white/5 text-white/80 border-white/5 hover:bg-white/10 hover:border-white/15"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] md:text-xs shrink-0 transition-all ${
                            isCurrent 
                              ? "bg-[#00D1FF] text-black shadow-[0_0_10px_rgba(0,209,255,0.4)]" 
                              : "bg-white/10 text-white/80 group-hover:bg-white/20"
                          }`}>
                            {episode.episode_num}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-[11px] md:text-xs font-bold line-clamp-1 transition-colors ${
                              isCurrent ? "text-[#00D1FF]" : "text-white group-hover:text-cyan-400"
                            }`}>
                              {episode.title}
                            </span>
                            <span className="text-[8px] md:text-[9px] text-white/40 uppercase tracking-widest font-mono">
                              Episode {episode.episode_num}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          {isCurrent && (
                            <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/20 text-[7px] md:text-[8px] font-black uppercase tracking-widest animate-pulse">
                              <span className="w-1 h-1 rounded-full bg-[#00D1FF]" />
                              Playing
                            </span>
                          )}

                          {onDownloadEpisode && (
                            <button
                              type="button"
                              title="Download Episode"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDownloadEpisode({
                                  ...episode,
                                  season: panelSeason
                                });
                              }}
                              className="w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/25 hover:border-emerald-500/40 text-emerald-400 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        eqPortalTarget
      )}
    </div>
  );
};

export default VideoPlayer;
