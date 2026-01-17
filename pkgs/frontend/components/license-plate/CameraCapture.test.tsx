/**
 * CameraCaptureコンポーネントのユニットテスト
 *
 * @description
 * カメラキャプチャコンポーネントの動作を検証するテスト。
 * カメラ権限、エラーハンドリング、キャプチャ機能をテスト。
 *
 * @see Requirements 1.1, 1.2, 1.3, 1.4, 7.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { CameraCapture, type CameraCaptureProps } from './CameraCapture';

// ============================================================================
// モック設定
// ============================================================================

// モックコールバックを保存するための変数
let mockOnUserMedia: (() => void) | null = null;
let mockOnUserMediaError: ((error: DOMException | string) => void) | null = null;
let mockGetScreenshot: (() => string | null) | null = null;

// react-webcamのモック
vi.mock('react-webcam', () => {
  return {
    default: vi.fn().mockImplementation((props) => {
      // コールバックを保存
      mockOnUserMedia = props.onUserMedia || null;
      mockOnUserMediaError = props.onUserMediaError || null;

      return null;
    }),
  };
});

// navigator.permissionsのモック
const mockPermissionsQuery = vi.fn();

// ============================================================================
// テストユーティリティ
// ============================================================================

const defaultProps: CameraCaptureProps = {
  mode: 'single',
  onCapture: vi.fn(),
  onError: vi.fn(),
};

function renderCameraCapture(props: Partial<CameraCaptureProps> = {}) {
  return render(<CameraCapture {...defaultProps} {...props} />);
}

// ============================================================================
// テスト
// ============================================================================

describe('CameraCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnUserMedia = null;
    mockOnUserMediaError = null;
    mockGetScreenshot = () => 'data:image/jpeg;base64,mockImageData';

    // navigator.permissionsのモック設定
    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: mockPermissionsQuery,
      },
      writable: true,
      configurable: true,
    });

    mockPermissionsQuery.mockResolvedValue({ state: 'granted' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 基本レンダリングテスト
  // ==========================================================================

  describe('基本レンダリング', () => {
    it('コンポーネントが正常にレンダリングされる', () => {
      renderCameraCapture();
      // コンポーネントがエラーなくレンダリングされることを確認
      expect(screen.getByText('カメラを起動中...')).toBeInTheDocument();
    });

    it('初期化中はローディング表示される', () => {
      renderCameraCapture();
      expect(screen.getByText('カメラを起動中...')).toBeInTheDocument();
    });

    it('シングルモードでキャプチャボタンが表示される（カメラ準備完了後）', async () => {
      renderCameraCapture({ mode: 'single' });

      await act(async () => {
        mockOnUserMedia?.();
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '写真を撮影' })).toBeInTheDocument();
      });
    });

    it('リアルタイムモードでインジケーターが表示される（カメラ準備完了後）', async () => {
      renderCameraCapture({ mode: 'realtime', realtimeEnabled: true });

      await act(async () => {
        mockOnUserMedia?.();
      });

      await waitFor(() => {
        expect(screen.getByText('リアルタイム')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // カメラ権限テスト
  // ==========================================================================

  describe('カメラ権限', () => {
    /**
     * @see Requirements 1.2
     */
    it('権限が拒否された場合、エラーメッセージが表示される', async () => {
      renderCameraCapture();

      const permissionError = new DOMException('Permission denied', 'NotAllowedError');
      await act(async () => {
        mockOnUserMediaError?.(permissionError);
      });

      await waitFor(() => {
        expect(screen.getByText('カメラへのアクセスが許可されていません')).toBeInTheDocument();
      });
    });

    /**
     * @see Requirements 1.2
     */
    it('権限拒否時にonErrorコールバックが呼ばれる', async () => {
      const onError = vi.fn();
      renderCameraCapture({ onError });

      const permissionError = new DOMException('Permission denied', 'NotAllowedError');
      await act(async () => {
        mockOnUserMediaError?.(permissionError);
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'PERMISSION_DENIED',
            message: 'カメラへのアクセスが許可されていません',
          })
        );
      });
    });

    /**
     * @see Requirements 1.2
     */
    it('権限拒否時に再試行ボタンが表示される', async () => {
      renderCameraCapture();

      const permissionError = new DOMException('Permission denied', 'NotAllowedError');
      await act(async () => {
        mockOnUserMediaError?.(permissionError);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // デバイスエラーテスト
  // ==========================================================================

  describe('デバイスエラー', () => {
    /**
     * @see Requirements 1.3
     */
    it('デバイスが見つからない場合、エラーメッセージが表示される', async () => {
      renderCameraCapture();

      const deviceError = new DOMException('Device not found', 'NotFoundError');
      await act(async () => {
        mockOnUserMediaError?.(deviceError);
      });

      await waitFor(() => {
        expect(screen.getByText('カメラデバイスが見つかりません')).toBeInTheDocument();
      });
    });

    /**
     * @see Requirements 1.3
     */
    it('デバイス未検出時にonErrorコールバックが呼ばれる', async () => {
      const onError = vi.fn();
      renderCameraCapture({ onError });

      const deviceError = new DOMException('Device not found', 'NotFoundError');
      await act(async () => {
        mockOnUserMediaError?.(deviceError);
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DEVICE_NOT_FOUND',
            message: 'カメラデバイスが見つかりません',
          })
        );
      });
    });

    /**
     * @see Requirements 1.3
     */
    it('デバイスエラー時に再試行ボタンが表示される', async () => {
      renderCameraCapture();

      const deviceError = new DOMException('Device not found', 'NotFoundError');
      await act(async () => {
        mockOnUserMediaError?.(deviceError);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // コールバックテスト
  // ==========================================================================

  describe('コールバック', () => {
    it('カメラ準備完了時にonReadyが呼ばれる', async () => {
      const onReady = vi.fn();
      renderCameraCapture({ onReady });

      await act(async () => {
        mockOnUserMedia?.();
      });

      await waitFor(() => {
        expect(onReady).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // モード切り替えテスト
  // ==========================================================================

  describe('モード切り替え', () => {
    /**
     * @see Requirements 1.4
     */
    it('シングルモードではリアルタイムインジケーターが表示されない', async () => {
      renderCameraCapture({ mode: 'single' });

      await act(async () => {
        mockOnUserMedia?.();
      });

      await waitFor(() => {
        expect(screen.queryByText('リアルタイム')).not.toBeInTheDocument();
      });
    });

    /**
     * @see Requirements 7.1
     */
    it('リアルタイムモードが無効の場合、インジケーターが表示されない', async () => {
      renderCameraCapture({ mode: 'realtime', realtimeEnabled: false });

      await act(async () => {
        mockOnUserMedia?.();
      });

      await waitFor(() => {
        expect(screen.queryByText('リアルタイム')).not.toBeInTheDocument();
      });
    });
  });
});
