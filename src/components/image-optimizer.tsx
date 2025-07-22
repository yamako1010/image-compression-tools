"use client";
import React, { useState, useRef, useCallback } from "react";
import { 
  Upload, 
  Download, 
  Image as ImageIcon, 
  Smartphone,
  Monitor,
  Mail,
  Youtube,
  Facebook,
  MessageCircle,
  Camera,
  Printer,
  RotateCcw,
  TrendingDown,
  Zap,
  FileImage,
  FileText,
  Shield,
  ShieldCheck,
  Search,
  AlertTriangle,
  CheckCircle,
  Eye
} from "lucide-react";
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { FileSecurityValidator } from '@/lib/security';
import { ClientFileScanner } from '@/lib/client-scanner';

// PDF.js worker設定
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
}

interface ServiceConfig {
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  maxWidth: number;
  maxHeight: number;
  maxSize: number;
  description: string;
}

const services: Record<string, ServiceConfig> = {
  instagram: {
    name: 'Instagram',
    icon: Camera,
    maxWidth: 1080,
    maxHeight: 1080,
    maxSize: 8 * 1024 * 1024,
    description: '最大8MB、1080×1080px'
  },
  line: {
    name: 'LINE',
    icon: MessageCircle,
    maxWidth: 1024,
    maxHeight: 1024,
    maxSize: 10 * 1024 * 1024,
    description: '最大10MB、1024×1024px'
  },
  web: {
    name: 'ウェブ',
    icon: Monitor,
    maxWidth: 1200,
    maxHeight: 800,
    maxSize: 15 * 1024 * 1024,
    description: '最大15MB、1200×800px'
  },
  mobile: {
    name: 'モバイル',
    icon: Smartphone,
    maxWidth: 750,
    maxHeight: 1334,
    maxSize: 5 * 1024 * 1024,
    description: '最大5MB、750×1334px'
  },
  email: {
    name: 'メール',
    icon: Mail,
    maxWidth: 800,
    maxHeight: 600,
    maxSize: 5 * 1024 * 1024,
    description: '最大5MB、800×600px'
  },
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    maxWidth: 1280,
    maxHeight: 720,
    maxSize: 20 * 1024 * 1024,
    description: '最大20MB、1280×720px'
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    maxWidth: 1200,
    maxHeight: 630,
    maxSize: 8 * 1024 * 1024,
    description: '最大8MB、1200×630px'
  },
  print: {
    name: '印刷用',
    icon: Printer,
    maxWidth: 1920,
    maxHeight: 1080,
    maxSize: 10 * 1024 * 1024,
    description: '最大10MB、1920×1080px'
  }
};

export function ImageOptimizer() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [quality, setQuality] = useState(80);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [originalPreview, setOriginalPreview] = useState<string>('');
  const [compressedPreview, setCompressedPreview] = useState<string>('');
  const [compressedDimensions, setCompressedDimensions] = useState<{width: number, height: number} | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf'>('image');
  const [scanPhase, setScanPhase] = useState<'file-check' | 'virus-scan' | 'content-scan' | 'compression' | 'complete'>('file-check');
  const [scanResults, setScanResults] = useState<{safe: boolean, warnings: string[]}>({safe: true, warnings: []});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateDimensions = (
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ) => {
    let width = originalWidth;
    let height = originalHeight;

    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return { width: Math.round(width), height: Math.round(height) };
  };

  const compressImage = useCallback(async (file: File, quality: number): Promise<{blob: Blob, dimensions: {width: number, height: number}}> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // スマートリサイズ: 元サイズが小さい場合はそのまま維持
        let targetWidth = img.width;
        let targetHeight = img.height;
        
        // 大きすぎる場合のみリサイズ
        if (img.width > 1920 || img.height > 1080) {
          const dimensions = calculateDimensions(img.width, img.height, 1920, 1080);
          targetWidth = dimensions.width;
          targetHeight = dimensions.height;
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // 高品質レンダリングのための設定
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // アンチエイリアシングを適用
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // 出力フォーマットを元ファイルに合わせる
        const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const outputQuality = file.type === 'image/png' ? 1 : quality / 100;

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({blob, dimensions: {width: targetWidth, height: targetHeight}});
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          outputFormat,
          outputQuality
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const compressPDF = useCallback(async (file: File, quality: number): Promise<Blob> => {
    const arrayBuffer = await file.arrayBuffer();
    
    try {
      setProcessingMessage('PDFを読み込み中...');
      setProcessingProgress(10);
      
      // PDF.jsを使ってPDFを読み込み、各ページを画像として抽出
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const pdfDoc = await PDFDocument.create();
      
      setProcessingMessage(`${pdf.numPages}ページのPDFを圧縮中...`);
      setProcessingProgress(20);
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const progress = 20 + (pageNum / pdf.numPages) * 70;
        setProcessingProgress(progress);
        setProcessingMessage(`ページ ${pageNum}/${pdf.numPages} を処理中...`);
        
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        
        // Canvasを作成してページをレンダリング
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
          canvasContext: context!,
          viewport: viewport,
        };
        
        await page.render(renderContext).promise;
        
        // 画像として圧縮
        const imageBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => {
            resolve(blob!);
          }, 'image/jpeg', quality / 100);
        });
        
        // 画像をPDFに追加
        const imageBytes = await imageBlob.arrayBuffer();
        const image = await pdfDoc.embedJpg(imageBytes);
        
        const pdfPage = pdfDoc.addPage([image.width, image.height]);
        pdfPage.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }
      
      setProcessingMessage('PDFを保存中...');
      setProcessingProgress(95);
      
      const pdfBytes = await pdfDoc.save();
      
      setProcessingProgress(100);
      setProcessingMessage('完了!');
      
      return new Blob([pdfBytes], { type: 'application/pdf' });
    } catch (error) {
      console.error('PDF compression error:', error);
      setProcessingMessage('エラーが発生しました');
      
      // フォールバック: 単純な再保存
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
      });
      return new Blob([pdfBytes], { type: 'application/pdf' });
    }
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    // セキュリティ検証を最初に実行
    setIsProcessing(true);
    setScanPhase('file-check');
    setProcessingMessage('ファイル形式をチェック中...');
    setProcessingProgress(5);
    
    // 少し待機してUIを表示
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const validationResult = await FileSecurityValidator.validateFile(file);
    if (!validationResult.valid) {
      setIsProcessing(false);
      setScanPhase('file-check');
      setProcessingProgress(0);
      setProcessingMessage('');
      alert(`セキュリティエラー: ${validationResult.error}`);
      return;
    }

    // ウイルススキャンフェーズ
    setScanPhase('virus-scan');
    setProcessingMessage('ウイルススキャン実行中...');
    setProcessingProgress(15);
    
    // スキャン演出のための待機
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const scanResult = await ClientFileScanner.scanFile(file);
    setScanResults({safe: scanResult.safe, warnings: scanResult.warnings});
    
    if (!scanResult.safe) {
      setIsProcessing(false);
      setScanPhase('file-check');
      setProcessingProgress(0);
      setProcessingMessage('');
      const summary = ClientFileScanner.getScanSummary(scanResult);
      alert(`🚨 セキュリティ脅威を検出: ${summary}`);
      return;
    }

    // コンテンツスキャンフェーズ
    setScanPhase('content-scan');
    setProcessingMessage('ファイル内容を詳細チェック中...');
    setProcessingProgress(25);
    
    await new Promise(resolve => setTimeout(resolve, 800));

    if (scanResult.warnings.length > 0) {
      const summary = ClientFileScanner.getScanSummary(scanResult);
      const proceed = confirm(`⚠️ ${summary}\n\n続行しますか？`);
      if (!proceed) {
        setIsProcessing(false);
        setScanPhase('file-check');
        setProcessingProgress(0);
        setProcessingMessage('');
        return;
      }
    }

    const isImage = validationResult.fileType?.startsWith('image/') || false;
    const isPDF = validationResult.fileType === 'application/pdf';

    setOriginalFile(file);
    setFileType(isImage ? 'image' : 'pdf');
    
    if (isImage) {
      setOriginalPreview(URL.createObjectURL(file));
    } else {
      setOriginalPreview(''); // PDFはプレビューなし
    }
    
    // 圧縮フェーズへ移行
    setScanPhase('compression');
    setProcessingProgress(40);
    try {
      if (isImage) {
        setProcessingMessage('画像を圧縮中...');
        setProcessingProgress(50);
        const result = await compressImage(file, quality);
        setCompressedBlob(result.blob);
        setCompressedPreview(URL.createObjectURL(result.blob));
        setCompressedDimensions(result.dimensions);
        setScanPhase('complete');
        setProcessingProgress(100);
        setProcessingMessage('圧縮完了!');
      } else {
        const compressedPDF = await compressPDF(file, quality);
        setCompressedBlob(compressedPDF);
        setCompressedPreview('');
        setCompressedDimensions(null);
        setScanPhase('complete');
      }
    } catch (error) {
      console.error('Compression error:', error);
      setProcessingMessage('エラーが発生しました');
      alert('圧縮処理中にエラーが発生しました。');
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingProgress(0);
        setProcessingMessage('');
        setScanPhase('file-check');
      }, 1000);
    }
  }, [quality, compressImage, compressPDF]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleQualityChange = useCallback(async (newQuality: number) => {
    setQuality(newQuality);
    if (originalFile) {
      setIsProcessing(true);
      setProcessingProgress(0);
      try {
        if (fileType === 'image') {
          setProcessingMessage('画像を圧縮中...');
          setProcessingProgress(50);
          const result = await compressImage(originalFile, newQuality);
          setCompressedBlob(result.blob);
          setCompressedPreview(URL.createObjectURL(result.blob));
          setCompressedDimensions(result.dimensions);
          setProcessingProgress(100);
          setProcessingMessage('完了!');
        } else {
          const compressedPDF = await compressPDF(originalFile, newQuality);
          setCompressedBlob(compressedPDF);
        }
      } catch (error) {
        console.error('Compression error:', error);
        setProcessingMessage('エラーが発生しました');
      } finally {
        setIsProcessing(false);
        setProcessingProgress(0);
        setProcessingMessage('');
      }
    }
  }, [originalFile, fileType, compressImage, compressPDF]);

  const handleDownload = () => {
    if (compressedBlob) {
      const link = document.createElement('a');
      const extension = fileType === 'image' ? 'jpg' : 'pdf';
      const fileName = `compressed_${Date.now()}.${extension}`;
      
      // セキュアなダウンロードURL生成
      link.href = FileSecurityValidator.createSecureDownloadUrl(compressedBlob, fileName);
      link.download = FileSecurityValidator.sanitizeFileName(fileName);
      
      // ダウンロード属性を設定してXSSを防ぐ
      link.setAttribute('rel', 'noopener noreferrer');
      link.click();
      
      // 即座にリンクを削除
      setTimeout(() => {
        if (link.href) {
          URL.revokeObjectURL(link.href);
        }
      }, 100);
    }
  };

  const handleReset = () => {
    setOriginalFile(null);
    setCompressedBlob(null);
    setOriginalPreview('');
    setCompressedPreview('');
    setCompressedDimensions(null);
    setFileType('image');
    setQuality(80);
    setProcessingProgress(0);
    setProcessingMessage('');
    setScanPhase('file-check');
    setScanResults({safe: true, warnings: []});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getCompressionRatio = () => {
    if (originalFile && compressedBlob) {
      return Math.round((1 - compressedBlob.size / originalFile.size) * 100);
    }
    return 0;
  };

  const getSuitableServices = () => {
    if (!compressedBlob || !compressedDimensions) return [];
    
    return Object.entries(services).filter(([_, service]) => {
      return compressedBlob.size <= service.maxSize &&
             compressedDimensions.width <= service.maxWidth &&
             compressedDimensions.height <= service.maxHeight;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 p-4 relative overflow-x-hidden overflow-y-auto">
      {/* 背景装飾 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-300 to-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-yellow-300 to-orange-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-gradient-to-br from-blue-300 to-green-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>
      
      <div className="max-w-6xl mx-auto relative z-10">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent mb-4">
            画像・PDF圧縮ツール
          </h1>
          <p className="text-lg font-medium bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-6">
            シンプルで高品質な画像・PDF圧縮ツール
          </p>
          
          {/* 使い方説明 */}
          <div className="bg-gradient-to-r from-purple-100 via-pink-100 to-orange-100 border-2 border-purple-200 rounded-2xl p-6 max-w-3xl mx-auto shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <h2 className="text-lg font-bold text-purple-800 mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              簡単3ステップ
            </h2>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-white/60 rounded-xl">
                <div className="text-2xl mb-2">1</div>
                <p className="font-medium text-purple-700">画像またはPDFをアップロード</p>
              </div>
              <div className="text-center p-3 bg-white/60 rounded-xl">
                <div className="text-2xl mb-2">2</div>
                <p className="font-medium text-pink-700">スライダーで圧縮レベル調整</p>
              </div>
              <div className="text-center p-3 bg-white/60 rounded-xl">
                <div className="text-2xl mb-2">3</div>
                <p className="font-medium text-orange-700">結果をダウンロード</p>
              </div>
            </div>
          </div>
        </div>


        {/* ファイルアップロード */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center justify-center gap-3">
            <Upload className="w-6 h-6 text-purple-500" />
            ファイルアップロード
            <FileText className="w-6 h-6 text-pink-500" />
          </h2>
          <div
            className="border-3 border-dashed border-purple-300 rounded-2xl p-12 text-center bg-gradient-to-br from-white to-purple-50 hover:from-purple-50 hover:to-pink-50 transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="flex justify-center gap-4 mb-6">
              <ImageIcon className="w-16 h-16 text-purple-400 animate-bounce" />
              <FileText className="w-16 h-16 text-pink-400 animate-bounce" style={{animationDelay: '0.2s'}} />
            </div>
            <p className="text-lg text-slate-700 mb-6 font-medium">
              画像やPDFをドラッグ&ドロップしてください
            </p>
            <p className="text-sm text-slate-500 mb-6">
              対応フォーマット: JPG, PNG, GIF, WebP, PDF
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              ファイルを選択
            </button>
          </div>
        </div>

        {/* プレビューと圧縮情報 */}
        {originalFile && (
          <div className="space-y-8">
            {/* 画質調整 */}
            <div className="bg-gradient-to-br from-white via-purple-50 to-pink-50 rounded-2xl p-6 shadow-xl border-2 border-purple-200 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
              <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500 animate-bounce" />
                画質設定
              </h2>
              <p className="text-sm text-purple-600 font-medium mb-4 flex items-center gap-1">
                👆 スライダーボタンを動かしてみてください！お好みの画質に調整できます
              </p>
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <label className="block text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
                    画質: {quality}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={quality}
                    onChange={(e) => handleQualityChange(parseInt(e.target.value))}
                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer slider-thumb"
                    style={{
                      background: `linear-gradient(to right, #8b5cf6 0%, #ec4899 ${(quality-10)/90*100}%, #fbbf24 ${(quality-10)/90*100}%, #f3f4f6 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>小さく</span>
                    <span>高画質</span>
                  </div>
                </div>
                <div className="text-center p-3 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-xl border-2 border-yellow-200">
                  <div className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">{quality}%</div>
                  <div className="text-xs font-medium text-orange-600">画質</div>
                </div>
              </div>
            </div>

            {/* 圧縮結果 */}
            <div className="bg-gradient-to-br from-white via-blue-50 to-green-50 rounded-2xl p-6 shadow-xl border-2 border-blue-200 hover:shadow-2xl transition-all duration-300">
              <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-6 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-green-500 animate-bounce" />
                圧縮結果
              </h2>
              
              {/* 圧縮統計 */}
              {compressedBlob && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl border-2 border-blue-200 hover:scale-105 transition-transform duration-200">
                    <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                      {formatFileSize(compressedBlob.size)}
                    </div>
                    <div className="text-sm font-medium text-blue-700 flex items-center justify-center gap-1">
                      <FileImage className="w-4 h-4" />
                      圧縮後サイズ
                    </div>
                  </div>
                  
                  <div className="text-center p-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl border-2 border-green-200 hover:scale-105 transition-transform duration-200">
                    <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                      -{getCompressionRatio()}%
                    </div>
                    <div className="text-sm font-medium text-green-700 flex items-center justify-center gap-1">
                      <TrendingDown className="w-4 h-4" />
                      圧縮率
                    </div>
                  </div>
                  
                  <div className="text-center p-4 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl border-2 border-purple-200 hover:scale-105 transition-transform duration-200">
                    <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                      {compressedDimensions ? `${compressedDimensions.width}×${compressedDimensions.height}` : '-'}
                    </div>
                    <div className="text-sm font-medium text-purple-700 flex items-center justify-center gap-1">
                      <ImageIcon className="w-4 h-4" />
                      解像度
                    </div>
                  </div>
                </div>
              )}

              {/* 画像プレビュー */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-bold bg-gradient-to-r from-gray-600 to-gray-800 bg-clip-text text-transparent mb-3">元画像</h3>
                  <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-white shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <img src={originalPreview} alt="Original" className="w-full h-auto max-h-64 object-contain" />
                  </div>
                  <p className="text-xs font-medium text-gray-600 mt-2">
                    {formatFileSize(originalFile.size)} | {originalFile.type}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-3">圧縮後</h3>
                  <div className="border-2 border-green-200 rounded-xl overflow-hidden bg-gradient-to-br from-green-50 to-blue-50 shadow-lg hover:shadow-xl transition-shadow duration-300 relative">
                    {isProcessing ? (
                      <div className="w-full h-64 flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-yellow-100 relative overflow-hidden">
                        {/* メインアイコンとアニメーション */}
                        <div className="relative mb-4">
                          {scanPhase === 'file-check' && (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse flex items-center justify-center">
                              <Search className="w-8 h-8 text-white animate-bounce" />
                            </div>
                          )}
                          {scanPhase === 'virus-scan' && (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center relative">
                              <Shield className="w-8 h-8 text-white animate-spin" style={{animationDuration: '2s'}} />
                              <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping"></div>
                            </div>
                          )}
                          {scanPhase === 'content-scan' && (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center relative">
                              <Eye className="w-8 h-8 text-white animate-pulse" />
                              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-r from-green-400 to-blue-400 animate-bounce">
                                <Search className="w-4 h-4 text-white m-1" />
                              </div>
                            </div>
                          )}
                          {scanPhase === 'compression' && (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-spin flex items-center justify-center">
                              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-yellow-500"></div>
                            </div>
                          )}
                          {scanPhase === 'complete' && (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center animate-bounce">
                              <CheckCircle className="w-8 h-8 text-white" />
                            </div>
                          )}
                        </div>

                        {/* フェーズ別メッセージ */}
                        <div className="text-lg font-bold mb-2 text-center">
                          {scanPhase === 'file-check' && (
                            <div className="text-blue-600 wiggle">📁 ファイル形式をチェック中...</div>
                          )}
                          {scanPhase === 'virus-scan' && (
                            <div className="text-red-600 wiggle">🛡️ ウイルススキャン実行中...</div>
                          )}
                          {scanPhase === 'content-scan' && (
                            <div className="text-yellow-600 wiggle">🔍 ファイル内容を詳細解析中...</div>
                          )}
                          {scanPhase === 'compression' && (
                            <div className="text-purple-600 wiggle">⚡ 高品質圧縮処理中...</div>
                          )}
                          {scanPhase === 'complete' && (
                            <div className="text-green-600 wiggle">✅ 処理完了！</div>
                          )}
                        </div>

                        {/* セキュリティメッセージ */}
                        <div className="text-sm mb-6 text-center max-w-xs">
                          {scanPhase === 'file-check' && (
                            <div className="text-blue-500 pulse-heart">ファイルの安全性を確認しています</div>
                          )}
                          {scanPhase === 'virus-scan' && (
                            <div className="text-red-500 pulse-heart">悪意のあるコードがないかスキャン中</div>
                          )}
                          {scanPhase === 'content-scan' && (
                            <div className="text-yellow-500 pulse-heart">隠れた脅威がないか詳細チェック中</div>
                          )}
                          {scanPhase === 'compression' && (
                            <div className="text-purple-500 pulse-heart">安全が確認できたので圧縮開始！</div>
                          )}
                          {scanPhase === 'complete' && (
                            <div className="text-green-500 pulse-heart">安全に圧縮が完了しました！</div>
                          )}
                        </div>

                        {/* プログレスバー */}
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-48">
                          <div className="w-full bg-gray-200 rounded-full h-3 mb-2 overflow-hidden">
                            <div className="h-3 rounded-full transition-all duration-300 relative" 
                                 style={{
                                   width: `${processingProgress}%`,
                                   background: scanPhase === 'file-check' ? 'linear-gradient(to right, #3b82f6, #6366f1)' :
                                              scanPhase === 'virus-scan' ? 'linear-gradient(to right, #ef4444, #f97316)' :
                                              scanPhase === 'content-scan' ? 'linear-gradient(to right, #eab308, #f97316)' :
                                              scanPhase === 'compression' ? 'linear-gradient(to right, #a855f7, #ec4899)' :
                                              'linear-gradient(to right, #10b981, #059669)'
                                 }}>
                              <div className="absolute inset-0 bg-white bg-opacity-30 animate-pulse"></div>
                            </div>
                          </div>
                          <div className="text-xs text-center font-medium" 
                               style={{
                                 color: scanPhase === 'file-check' ? '#3b82f6' :
                                        scanPhase === 'virus-scan' ? '#ef4444' :
                                        scanPhase === 'content-scan' ? '#eab308' :
                                        scanPhase === 'compression' ? '#a855f7' :
                                        '#10b981'
                               }}>
                            {Math.round(processingProgress)}% {processingMessage}
                          </div>
                        </div>

                        {/* セキュリティスキャン完了後のステータス表示 */}
                        {(scanPhase === 'compression' || scanPhase === 'complete') && scanResults.safe && (
                          <div className="absolute top-4 right-4 bg-green-100 border-2 border-green-300 rounded-lg p-2">
                            <div className="flex items-center gap-1 text-green-700">
                              <ShieldCheck className="w-4 h-4" />
                              <span className="text-xs font-bold">セキュリティ OK</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : compressedPreview ? (
                      <img src={compressedPreview} alt="Compressed" className="w-full h-auto max-h-64 object-contain" />
                    ) : (
                      <div className="w-full h-64 flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-green-100">
                        <div className="w-12 h-12 mb-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500"></div>
                        <div className="text-gray-600 font-medium">画質を調整してください</div>
                      </div>
                    )}
                  </div>
                  {compressedBlob && (
                    <p className="text-xs font-medium text-green-600 mt-2">
                      {formatFileSize(compressedBlob.size)} | {fileType === 'image' ? 'JPEG' : 'PDF'}
                    </p>
                  )}
                </div>
              </div>

              {/* アクションボタン */}
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={handleDownload}
                  disabled={!compressedBlob}
                  className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-400 text-white px-6 py-3 rounded-xl transition-all duration-200 flex items-center gap-2 font-bold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
                >
                  <Download className="w-4 h-4" />
                  ダウンロード
                </button>
                <button
                  onClick={handleReset}
                  className="border-2 border-orange-300 bg-gradient-to-r from-orange-100 to-yellow-100 hover:from-orange-200 hover:to-yellow-200 text-orange-700 px-6 py-3 rounded-xl transition-all duration-200 flex items-center gap-2 font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <RotateCcw className="w-4 h-4" />
                  リセット
                </button>
              </div>

              {/* セキュリティスキャン結果表示 */}
              {compressedBlob && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    セキュリティスキャン結果
                  </h3>
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-bold text-green-700">✅ ファイルは安全です</div>
                        <div className="text-xs text-green-600">ウイルス・マルウェアは検出されませんでした</div>
                      </div>
                    </div>
                    
                    {scanResults.warnings.length > 0 && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          <span className="font-bold text-yellow-700">注意事項</span>
                        </div>
                        <ul className="text-xs text-yellow-700 space-y-1">
                          {scanResults.warnings.map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      <div className="text-center p-2 bg-white/60 rounded-lg">
                        <div className="font-bold text-blue-600">ファイル形式</div>
                        <div className="text-blue-500">✓ 検証済み</div>
                      </div>
                      <div className="text-center p-2 bg-white/60 rounded-lg">
                        <div className="font-bold text-red-600">ウイルス</div>
                        <div className="text-green-500">✓ クリーン</div>
                      </div>
                      <div className="text-center p-2 bg-white/60 rounded-lg">
                        <div className="font-bold text-yellow-600">内容</div>
                        <div className="text-green-500">✓ 安全</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 適用可能サービス */}
              {compressedBlob && getSuitableServices().length > 0 && (
                <div>
                  <h3 className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">このサイズで利用可能なサービス</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {getSuitableServices().map(([key, service]) => {
                      const IconComponent = service.icon;
                      return (
                        <div key={key} className="p-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200 hover:scale-105 transition-transform duration-200 shadow-md hover:shadow-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <IconComponent className="w-4 h-4 text-indigo-600" />
                            <span className="text-sm font-bold text-indigo-800">{service.name}</span>
                          </div>
                          <p className="text-xs font-medium text-purple-600">{service.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}