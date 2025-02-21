'use client';

import { liquidFragSource } from '@/app/hero/liquid-frag';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import GIF from 'gif.js.optimized';
import { createFFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const ffmpeg = createFFmpeg({ log: true });

export type ShaderParams = {
  patternScale: number;
  refraction: number;
  edge: number;
  patternBlur: number;
  liquid: number;
  speed: number;
};

export function Canvas({
  imageData,
  params,
  processing,
}: {
  imageData: ImageData;
  params: ShaderParams;
  processing: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);

  const captureFrames = async () => {
    const frames = [];
    for (let i = 0; i < 30; i++) {
      const canvas = canvasRef.current;
      if (canvas) {
        frames.push(canvas.toDataURL('image/png'));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return frames;
  };

  const exportGIF = async () => {
    setLoading(true);
    const frames = await captureFrames();

    const gif = new GIF({ workers: 2, quality: 10 });

    frames.forEach((frame) => {
      const img = new Image();
      img.src = frame;
      gif.addFrame(img, { delay: 100 });
    });

    gif.on('finished', (blob: Blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'animation.gif';
      link.click();
      setLoading(false);
    });

    gif.render();
  };

  const exportMP4 = async () => {
    setLoading(true);
    if (!ffmpeg.isLoaded()) await ffmpeg.load();

    const frames = await captureFrames();

    const inputFiles = frames.map(async (frame, i) => {
      const response = await fetch(frame);
      const blob = await response.blob();
      return ffmpeg.FS('writeFile', `frame${i}.png`, await fetchFile(blob));
    });

    await Promise.all(inputFiles);

    await ffmpeg.run(
      '-framerate', '10', '-i', 'frame%d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', 'output.mp4'
    );

    const data = ffmpeg.FS('readFile', 'output.mp4');
    const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(videoBlob);
    link.download = 'animation.mp4';
    link.click();

    setLoading(false);
  };

  return (
    <div>
      <canvas ref={canvasRef} />
      <button onClick={exportGIF} disabled={loading}>Export as GIF</button>
      <button onClick={exportMP4} disabled={loading}>Export as MP4</button>
    </div>
  );
}
