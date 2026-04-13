import React, { useEffect, useRef } from 'react';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import muxjs from 'mux.js';

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
  const mediaSourceRef = useRef<MediaSource | null>(null);

  const source = options.sources[0];
  const sourceUrl = source?.src;

  useEffect(() => {
    if (!artRef.current || !sourceUrl) return;

    const isHls = sourceUrl.toLowerCase().includes('.m3u8') || source.type === 'application/x-mpegURL';
    const isMkv = sourceUrl.toLowerCase().includes('.mkv');

    const art = new Artplayer({
      container: artRef.current,
      url: sourceUrl,
      type: isHls ? 'm3u8' : 
            (sourceUrl.toLowerCase().includes('.mp4') ? 'mp4' : 
            (sourceUrl.toLowerCase().includes('.webm') ? 'webm' : 
            (isMkv ? 'mkv' : undefined))),
      isLive: isHls,
      poster: options.poster || '',
      autoplay: options.autoplay || false,
      autoSize: true,
      autoMini: true,
      loop: false,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      setting: true,
      pip: true,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoPlayback: true,
      airplay: true,
      lock: true,
      fastForward: true,
      autoOrientation: true,
      theme: '#22d3ee', // Cyan-400
      moreVideoAttr: {
        crossOrigin: 'anonymous',
        playsInline: true,
      },
      customType: {
        mkv: async function (video: HTMLVideoElement, url: string) {
          // Check for CORS issues first
          try {
            const response = await fetch(url, { method: 'HEAD', mode: 'cors' });
            if (!response.ok) throw new Error('CORS or Network Error');
          } catch (err) {
            console.error('MKV CORS Error:', err);
            art.notice.show = 'CORS Error: Please allow this domain in your R2 bucket settings.';
            
            // Add a button to open in new tab as a workaround
            art.controls.add({
              position: 'right',
              html: '<span style="color: #facc15; font-weight: bold;">FIX CORS</span>',
              click: function () {
                window.open(url, '_blank');
              },
            });
          }

          if (window.MediaSource && muxjs) {
            const ms = new MediaSource();
            mediaSourceRef.current = ms;
            video.src = URL.createObjectURL(ms);

            ms.addEventListener('sourceopen', async () => {
              try {
                const transmuxer = new muxjs.mp4.Transmuxer();
                const sourceBuffer = ms.addSourceBuffer('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');

                sourceBuffer.addEventListener('error', (e) => console.error('Buffer Error:', e));

                transmuxer.on('data', (data: any) => {
                  const initSegment = new Uint8Array(data.initSegment);
                  const dataSegment = new Uint8Array(data.data);
                  const combined = new Uint8Array(initSegment.byteLength + dataSegment.byteLength);
                  combined.set(initSegment);
                  combined.set(dataSegment, initSegment.byteLength);
                  
                  if (!sourceBuffer.updating && ms.readyState === 'open') {
                    sourceBuffer.appendBuffer(combined);
                  }
                });

                const response = await fetch(url);
                const reader = response.body?.getReader();
                
                if (reader) {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                      if (ms.readyState === 'open') ms.endOfStream();
                      break;
                    }
                    transmuxer.push(new Uint8Array(value));
                    transmuxer.flush();
                  }
                }
              } catch (err) {
                console.error('MKV Transmuxing Error:', err);
                video.src = url; // Fallback
              }
            });
          } else {
            video.src = url;
          }

          video.addEventListener('error', () => {
            art.notice.show = 'MKV playback failed. Use "Play in VLC" or "New Tab".';
          }, { once: true });
        },
        m3u8: function (video: HTMLVideoElement, url: string) {
          const cacheBustedUrl = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
          
          if (Hls.isSupported()) {
            if (hlsRef.current) {
              hlsRef.current.destroy();
            }

            const hls = new Hls({
              liveSyncDurationCount: 3,
              liveMaxLatencyDurationCount: 10,
              enableWorker: true,
              lowLatencyMode: true,
              manifestLoadingMaxRetry: Infinity,
              levelLoadingMaxRetry: Infinity,
              fragLoadingMaxRetry: Infinity,
            });
            
            hlsRef.current = hls;
            hls.loadSource(cacheBustedUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    hls.recoverMediaError();
                    break;
                  default:
                    hls.destroy();
                    break;
                }
              }
            });

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              const levels = hls.levels;
              if (levels && levels.length > 1) {
                const quality = levels.map((level, index) => ({
                  default: index === hls.currentLevel,
                  html: level.height ? `${level.height}P` : 'Auto',
                  value: index,
                }));
                
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
      plugins: [],
      controls: [
        {
          position: 'right',
          html: 'Download',
          click: function () {
            const a = document.createElement('a');
            a.href = sourceUrl;
            a.download = '';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          },
        },
        {
          position: 'right',
          html: 'Screenshot',
          click: function () {
            art.screenshot();
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
  }, [sourceUrl]);

  return (
    <div 
      ref={artRef} 
      className="w-full h-full artplayer-app rounded-xl overflow-hidden shadow-2xl"
      style={{ minHeight: '220px' }}
    />
  );
};

export default VideoPlayer;
