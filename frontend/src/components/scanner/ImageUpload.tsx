import React, { useRef, useState, useCallback } from 'react';
import { Upload, Image, X, ZoomIn } from 'lucide-react';
import Modal from '../common/Modal.js';
import LoadingSpinner from '../common/LoadingSpinner.js';

interface Props {
  onImageSelected: (file: File) => void;
  isLoading: boolean;
  error?: string;
}

export default function ImageUpload({ onImageSelected, isLoading, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    onImageSelected(file);
  }, [onImageSelected]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        className={`relative border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer ${
          dragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
        }`}
        style={{ minHeight: '200px' }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onInputChange}
        />

        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Trade chart"
              className="w-full rounded-xl object-contain max-h-72"
              onClick={e => { e.stopPropagation(); setFullscreen(true); }}
            />
            <button
              onClick={e => { e.stopPropagation(); setFullscreen(true); }}
              className="absolute top-2 right-2 p-1.5 bg-slate-900/80 rounded-lg text-slate-300 hover:text-white"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); setPreview(null); }}
              className="absolute top-2 left-2 p-1.5 bg-slate-900/80 rounded-lg text-slate-300 hover:text-red-400"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            {isLoading ? (
              <LoadingSpinner size="md" label="Analyzing chart with AI..." />
            ) : (
              <>
                <div className="p-4 bg-slate-700/50 rounded-full mb-3">
                  {dragging ? <Image size={28} className="text-blue-400" /> : <Upload size={28} className="text-slate-400" />}
                </div>
                <p className="text-slate-300 font-medium text-sm">Drop chart screenshot here</p>
                <p className="text-slate-500 text-xs mt-1">or click to browse</p>
                <p className="text-slate-600 text-xs mt-3">PNG, JPG, WEBP up to 10MB</p>
              </>
            )}
          </div>
        )}
      </div>

      {isLoading && preview && (
        <div className="flex items-center gap-2 text-blue-400 text-sm">
          <LoadingSpinner size="sm" />
          <span>AI is extracting trade data...</span>
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Fullscreen preview */}
      <Modal isOpen={fullscreen} onClose={() => setFullscreen(false)} size="xl">
        {preview && (
          <img src={preview} alt="Trade chart" className="w-full rounded-lg" />
        )}
      </Modal>
    </div>
  );
}
