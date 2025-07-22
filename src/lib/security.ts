// セキュリティ検証ユーティリティ

interface FileSignature {
  signature: number[];
  mimeType: string;
  extension: string;
}

// 許可されたファイルのシグネチャ（マジックナンバー）
const ALLOWED_FILE_SIGNATURES: FileSignature[] = [
  // JPEG
  { signature: [0xFF, 0xD8, 0xFF], mimeType: 'image/jpeg', extension: 'jpg' },
  // PNG  
  { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mimeType: 'image/png', extension: 'png' },
  // GIF
  { signature: [0x47, 0x49, 0x46, 0x38], mimeType: 'image/gif', extension: 'gif' },
  // WebP
  { signature: [0x52, 0x49, 0x46, 0x46], mimeType: 'image/webp', extension: 'webp' },
  // PDF
  { signature: [0x25, 0x50, 0x44, 0x46], mimeType: 'application/pdf', extension: 'pdf' }
];

// ファイルサイズ制限（バイト）
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MIN_FILE_SIZE = 100; // 100B

export class FileSecurityValidator {
  
  /**
   * ファイルのセキュリティ検証を実行
   */
  static async validateFile(file: File): Promise<{valid: boolean, error?: string, fileType?: string}> {
    try {
      // 1. ファイルサイズ検証
      const sizeValidation = this.validateFileSize(file);
      if (!sizeValidation.valid) {
        return sizeValidation;
      }

      // 2. ファイル名検証
      const nameValidation = this.validateFileName(file.name);
      if (!nameValidation.valid) {
        return nameValidation;
      }

      // 3. ファイルシグネチャ検証
      const signatureValidation = await this.validateFileSignature(file);
      if (!signatureValidation.valid) {
        return signatureValidation;
      }

      // 4. 追加のファイル内容検証
      const contentValidation = await this.validateFileContent(file);
      if (!contentValidation.valid) {
        return contentValidation;
      }

      return { 
        valid: true, 
        fileType: signatureValidation.fileType 
      };

    } catch (error) {
      console.error('File validation error:', error);
      return { 
        valid: false, 
        error: 'ファイル検証中にエラーが発生しました' 
      };
    }
  }

  /**
   * ファイルサイズ検証
   */
  private static validateFileSize(file: File): {valid: boolean, error?: string} {
    if (file.size > MAX_FILE_SIZE) {
      return { 
        valid: false, 
        error: `ファイルサイズが大きすぎます（最大: ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB）` 
      };
    }
    
    if (file.size < MIN_FILE_SIZE) {
      return { 
        valid: false, 
        error: 'ファイルサイズが小さすぎます' 
      };
    }

    return { valid: true };
  }

  /**
   * ファイル名検証
   */
  private static validateFileName(fileName: string): {valid: boolean, error?: string} {
    // 危険な文字を含むファイル名を拒否
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/g;
    if (dangerousChars.test(fileName)) {
      return { 
        valid: false, 
        error: 'ファイル名に不正な文字が含まれています' 
      };
    }

    // 実行可能ファイル拡張子を拒否
    const executableExtensions = /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|app|deb|pkg|dmg)$/i;
    if (executableExtensions.test(fileName)) {
      return { 
        valid: false, 
        error: '実行可能ファイルはアップロードできません' 
      };
    }

    // ファイル名が長すぎる場合
    if (fileName.length > 255) {
      return { 
        valid: false, 
        error: 'ファイル名が長すぎます' 
      };
    }

    return { valid: true };
  }

  /**
   * ファイルシグネチャ検証（マジックナンバーによる真のファイルタイプ検証）
   */
  private static async validateFileSignature(file: File): Promise<{valid: boolean, error?: string, fileType?: string}> {
    try {
      // ファイルの最初の数バイトを読み取り
      const buffer = await this.readFileBytes(file, 0, 16);
      const bytes = new Uint8Array(buffer);

      // 各許可されたシグネチャと照合
      for (const sig of ALLOWED_FILE_SIGNATURES) {
        if (this.matchesSignature(bytes, sig.signature)) {
          // MIMEタイプも照合（MIME type spoofing対策）
          if (file.type !== sig.mimeType) {
            console.warn(`MIME type mismatch: declared=${file.type}, actual=${sig.mimeType}`);
          }
          return { 
            valid: true, 
            fileType: sig.mimeType 
          };
        }
      }

      return { 
        valid: false, 
        error: 'サポートされていないファイル形式です' 
      };

    } catch (error) {
      return { 
        valid: false, 
        error: 'ファイル形式の検証に失敗しました' 
      };
    }
  }

  /**
   * 追加のファイル内容検証
   */
  private static async validateFileContent(file: File): Promise<{valid: boolean, error?: string}> {
    try {
      // 画像ファイルの場合の追加検証
      if (file.type.startsWith('image/')) {
        return await this.validateImageContent(file);
      }
      
      // PDFファイルの場合の追加検証
      if (file.type === 'application/pdf') {
        return await this.validatePDFContent(file);
      }

      return { valid: true };

    } catch (error) {
      return { 
        valid: false, 
        error: 'ファイル内容の検証に失敗しました' 
      };
    }
  }

  /**
   * 画像ファイル内容の検証
   */
  private static async validateImageContent(file: File): Promise<{valid: boolean, error?: string}> {
    return new Promise((resolve) => {
      const img = new Image();
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ 
            valid: false, 
            error: '画像ファイルの読み込みがタイムアウトしました' 
          });
        }
      }, 5000);

      img.onload = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          
          // 異常に大きな画像サイズをチェック
          if (img.width > 10000 || img.height > 10000) {
            resolve({ 
              valid: false, 
              error: '画像のサイズが大きすぎます' 
            });
          } else {
            resolve({ valid: true });
          }
        }
      };

      img.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ 
            valid: false, 
            error: '破損した画像ファイルです' 
          });
        }
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * PDFファイル内容の検証
   */
  private static async validatePDFContent(file: File): Promise<{valid: boolean, error?: string}> {
    try {
      const buffer = await file.arrayBuffer();
      
      // PDF構造の基本チェック
      const bytes = new Uint8Array(buffer);
      
      // PDFの終端マーカーをチェック
      const endMarker = '%%EOF';
      const fileEnd = new TextDecoder().decode(bytes.slice(-20));
      if (!fileEnd.includes(endMarker)) {
        return { 
          valid: false, 
          error: '不正なPDFファイルです' 
        };
      }

      return { valid: true };

    } catch (error) {
      return { 
        valid: false, 
        error: 'PDFファイルの検証に失敗しました' 
      };
    }
  }

  /**
   * ファイルの指定範囲のバイトを読み取り
   */
  private static readFileBytes(file: File, start: number, length: number): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      
      const blob = file.slice(start, start + length);
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * バイト配列がシグネチャと一致するかチェック
   */
  private static matchesSignature(bytes: Uint8Array, signature: number[]): boolean {
    if (bytes.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (bytes[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * 安全なファイル名を生成
   */
  static sanitizeFileName(fileName: string): string {
    // 危険な文字を除去
    const sanitized = fileName
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/^\.+/, '') // 先頭のドットを除去
      .substring(0, 100); // 長さを制限

    return sanitized || 'file';
  }

  /**
   * ダウンロード用の安全なBlob URLを生成
   */
  static createSecureDownloadUrl(blob: Blob, fileName: string): string {
    const sanitizedName = this.sanitizeFileName(fileName);
    const url = URL.createObjectURL(blob);
    
    // URLを一定時間後に自動削除
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60000); // 1分後

    return url;
  }
}