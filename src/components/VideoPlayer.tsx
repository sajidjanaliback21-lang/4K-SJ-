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
    is_embed?: boolean;
  };
  onReady?: (player: Artplayer) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ options, onReady }) => {
  const artRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Artplayer | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);

  const source = options.sources[0];
  const sourceUrl = source?.src || '';
  const isEmbed = options.is_embed || false;

  const isEmbeddable = (url: string) => {
    if (isEmbed) return true;
    return url.includes('blogger.com') || 
           url.includes('youtube.com/embed') || 
           url.includes('dailymotion.com/embed') ||
           url.includes('vimeo.com/video') ||
           url.includes('/embed/');
  };

  useEffect(() => {
    if (!artRef.current || !sourceUrl || isEmbeddable(sourceUrl)) return;

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
      autoSize: false,
      autoMini: false,
      loop: false,
      flip: false,
      playbackRate: false,
      aspectRatio: false,
      setting: true,
      pip: true,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: false,
      miniProgressBar: false,
      mutex: true,
      backdrop: true,
      playsInline: true,
      autoPlayback: true,
      airplay: true,
      lock: false,
      fastForward: false,
      autoOrientation: true,
      theme: '#22d3ee', // Cyan-400
      moreVideoAttr: {
        crossOrigin: 'anonymous',
        playsInline: true,
      },
      customType: {
        mkv: async function (video: HTMLVideoElement, url: string) {
          // Use our internal proxy to bypass CORS for MKV files
          const proxyUrl = `/api/stream?url=${encodeURIComponent(url)}`;
          
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

                // Fetch through our proxy to avoid CORS
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error(`Proxy failed: ${response.statusText}`);
                
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
                art.notice.show = 'Transmuxing failed. Trying direct playback...';
                video.src = url; // Fallback to direct URL
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
      ],
      plugins: [],
      controls: [],
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
    <div className="w-full h-full relative bg-black overflow-hidden" style={{ minHeight: '220px' }}>
      {isEmbeddable(sourceUrl) ? (
        <iframe
          src={sourceUrl}
          className="absolute inset-0 w-full h-full border-0 m-0 p-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="no-referrer"
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      ) : (
        <div ref={artRef} className="w-full h-full artplayer-app rounded-xl shadow-2xl" />
      )}
    </div>
  );
};

export default VideoPlayer;
