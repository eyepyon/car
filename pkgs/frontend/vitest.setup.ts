import '@testing-library/jest-dom';

/**
 * Canvas および ImageData のモック
 * 
 * jsdom環境ではCanvasとImageDataが部分的にしかサポートされていないため、
 * 画像検証ロジックのテストに必要な最小限のモックを提供します。
 */

// ImageDataのモック（jsdomでは基本的に利用可能だが、念のため拡張）
if (typeof ImageData === 'undefined') {
  global.ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace: PredefinedColorSpace;

    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      widthOrHeight: number,
      heightOrSettings?: number | ImageDataSettings,
      settings?: ImageDataSettings
    ) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = typeof heightOrSettings === 'number' ? heightOrSettings : dataOrWidth.length / (4 * widthOrHeight);
        this.colorSpace = (typeof heightOrSettings === 'object' ? heightOrSettings.colorSpace : settings?.colorSpace) || 'srgb';
      } else {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(dataOrWidth * (widthOrHeight as number) * 4);
        this.colorSpace = (typeof heightOrSettings === 'object' ? heightOrSettings.colorSpace : undefined) || 'srgb';
      }
    }
  } as any;
}

// HTMLCanvasElement のモック（getContext用）
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (contextId: string): any {
    if (contextId === '2d') {
      return {
        drawImage: () => {},
        getImageData: (x: number, y: number, w: number, h: number) => {
          return new ImageData(w, h);
        },
        canvas: this,
      };
    }
    return null;
  };
}

