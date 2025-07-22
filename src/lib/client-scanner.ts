// クライアントサイドスキャン機能

export interface ScanResult {
  safe: boolean;
  threats: string[];
  warnings: string[];
}

export class ClientFileScanner {
  
  private static readonly DANGEROUS_PATTERNS = [
    // JavaScript実行可能コード
    /<script[^>]*>/i,
    /javascript:/i,
    /eval\s*\(/i,
    /setTimeout\s*\(/i,
    /setInterval\s*\(/i,
    
    // 危険なHTMLタグ
    /<iframe[^>]*>/i,
    /<object[^>]*>/i,
    /<embed[^>]*>/i,
    /<form[^>]*>/i,
    
    // 実行可能ファイルの特徴
    /MZ[\x00-\xff]{58}PE/,  // PEヘッダー (Windows実行ファイル)
    /\x7fELF/,              // ELF (Linux実行ファイル)
    /\xcf\xfa\xed\xfe/,     // Mach-O (macOS実行ファイル)
  ];

  private static readonly SUSPICIOUS_STRINGS = [
    'cmd.exe',
    'powershell',
    'bash',
    'sh',
    '/bin/',
    'system(',
    'exec(',
    'shell_exec',
    'passthru',
    'proc_open',
    'popen',
    'file_get_contents',
    'curl_exec',
    'wget',
    'download'
  ];

  /**
   * ファイルの簡易スキャンを実行
   */
  static async scanFile(file: File): Promise<ScanResult> {
    const result: ScanResult = {
      safe: true,
      threats: [],
      warnings: []
    };

    try {
      // ファイル名チェック
      this.scanFileName(file.name, result);
      
      // ファイル内容チェック（テキスト可能な部分のみ）
      await this.scanFileContent(file, result);
      
      // ファイル構造チェック
      await this.scanFileStructure(file, result);

    } catch (error) {
      console.error('File scan error:', error);
      result.warnings.push('スキャン中にエラーが発生しました');
    }

    return result;
  }

  /**
   * ファイル名スキャン
   */
  private static scanFileName(fileName: string, result: ScanResult): void {
    const executableExtensions = /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|app|deb|pkg|dmg|msi)$/i;
    if (executableExtensions.test(fileName)) {
      result.safe = false;
      result.threats.push('実行可能ファイル拡張子が検出されました');
    }

    // 二重拡張子チェック
    const doubleExtension = /\.[a-zA-Z]{2,4}\.[a-zA-Z]{2,4}$/;
    if (doubleExtension.test(fileName)) {
      result.warnings.push('二重拡張子が検出されました');
    }

    // 異常に長いファイル名
    if (fileName.length > 255) {
      result.warnings.push('ファイル名が異常に長すぎます');
    }

    // Unicode制御文字
    if (/[\u200E\u200F\u202A-\u202E]/.test(fileName)) {
      result.safe = false;
      result.threats.push('Unicode制御文字が検出されました');
    }
  }

  /**
   * ファイル内容スキャン
   */
  private static async scanFileContent(file: File, result: ScanResult): Promise<void> {
    try {
      // ファイルサイズが大きすぎる場合は先頭部分のみスキャン
      const maxScanSize = Math.min(file.size, 1024 * 1024); // 1MB
      const buffer = await this.readFileBuffer(file, 0, maxScanSize);
      const content = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

      // 危険なパターンをチェック
      for (const pattern of this.DANGEROUS_PATTERNS) {
        if (pattern.test(content)) {
          result.safe = false;
          result.threats.push('危険なコードパターンが検出されました');
          break;
        }
      }

      // 疑わしい文字列をチェック
      const suspiciousCount = this.SUSPICIOUS_STRINGS.filter(str => 
        content.toLowerCase().includes(str.toLowerCase())
      ).length;

      if (suspiciousCount > 2) {
        result.warnings.push('疑わしいコマンドが複数検出されました');
      }

      // 高エントロピーチェック（暗号化・難読化の可能性）
      const entropy = this.calculateEntropy(content.slice(0, 1000));
      if (entropy > 7.5) {
        result.warnings.push('高エントロピーコンテンツが検出されました（暗号化・難読化の可能性）');
      }

    } catch (error) {
      // テキストとして読み込めない場合は正常
    }
  }

  /**
   * ファイル構造スキャン
   */
  private static async scanFileStructure(file: File, result: ScanResult): Promise<void> {
    try {
      const headerSize = Math.min(file.size, 512);
      const buffer = await this.readFileBuffer(file, 0, headerSize);
      const bytes = new Uint8Array(buffer);

      // ZIPアーカイブ内の実行ファイルチェック
      if (this.isZipFile(bytes)) {
        result.warnings.push('アーカイブファイルが検出されました');
      }

      // 隠されたデータストリーム
      if (this.hasHiddenStreams(bytes)) {
        result.warnings.push('隠しデータストリームの可能性があります');
      }

    } catch (error) {
      // エラーは無視
    }
  }

  /**
   * ファイルバッファ読み込み
   */
  private static readFileBuffer(file: File, start: number, length: number): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      
      const blob = file.slice(start, start + length);
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * エントロピー計算
   */
  private static calculateEntropy(text: string): number {
    const freq: Record<string, number> = {};
    
    for (const char of text) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = text.length;

    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * ZIPファイル判定
   */
  private static isZipFile(bytes: Uint8Array): boolean {
    // ZIP signature: PK
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B;
  }

  /**
   * 隠しデータストリーム検出
   */
  private static hasHiddenStreams(bytes: Uint8Array): boolean {
    // NTFS Alternative Data Stream signature
    const adsPattern = [0x3A, 0x24, 0x44, 0x41, 0x54, 0x41]; // :$DATA
    
    for (let i = 0; i < bytes.length - adsPattern.length; i++) {
      let match = true;
      for (let j = 0; j < adsPattern.length; j++) {
        if (bytes[i + j] !== adsPattern[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    
    return false;
  }

  /**
   * スキャン結果のサマリー生成
   */
  static getScanSummary(result: ScanResult): string {
    if (result.safe && result.warnings.length === 0) {
      return '✅ ファイルは安全です';
    }

    if (!result.safe) {
      return `⚠️ 危険な要素が検出されました: ${result.threats.join(', ')}`;
    }

    if (result.warnings.length > 0) {
      return `⚠️ 注意: ${result.warnings.join(', ')}`;
    }

    return '✅ ファイルは安全です';
  }
}