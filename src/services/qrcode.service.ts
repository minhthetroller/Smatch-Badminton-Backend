import QRCode from 'qrcode';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

class QRCodeService {
  private defaultOptions: QRCodeOptions = {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M',
  };

  /**
   * Generate QR code as base64 data URL
   * Returns: data:image/png;base64,xxxxx
   */
  async generateBase64(content: string, options?: QRCodeOptions): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      const dataUrl = await QRCode.toDataURL(content, {
        width: opts.width,
        margin: opts.margin,
        errorCorrectionLevel: opts.errorCorrectionLevel,
        type: 'image/png',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return dataUrl;
    } catch (error) {
      console.error('QR code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate QR code as raw base64 string (without data URL prefix)
   */
  async generateRawBase64(content: string, options?: QRCodeOptions): Promise<string> {
    const dataUrl = await this.generateBase64(content, options);
    // Remove the "data:image/png;base64," prefix
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  }

  /**
   * Generate QR code as Buffer (for sending as image response)
   */
  async generateBuffer(content: string, options?: QRCodeOptions): Promise<Buffer> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      const buffer = await QRCode.toBuffer(content, {
        width: opts.width,
        margin: opts.margin,
        errorCorrectionLevel: opts.errorCorrectionLevel,
        type: 'png',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return buffer;
    } catch (error) {
      console.error('QR code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate QR code as SVG string
   */
  async generateSVG(content: string, options?: QRCodeOptions): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      const svg = await QRCode.toString(content, {
        type: 'svg',
        width: opts.width,
        margin: opts.margin,
        errorCorrectionLevel: opts.errorCorrectionLevel,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      return svg;
    } catch (error) {
      console.error('QR code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }
}

export const qrcodeService = new QRCodeService();

