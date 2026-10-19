import type { AppStateStatus } from 'react-native';
import type { BackgroundRecoveryInput, BackgroundRecoveryResult, BackgroundTimestamp } from './background-recovery';
import type { ForegroundDetectionController, ForegroundDetectionViewState } from './foreground-detection-controller';

type LifecycleOptions = {
  session: { sessionId: string; userId: string };
  initialState: AppStateStatus;
  repository: {
    begin(input: BackgroundRecoveryInput): Promise<string | null>;
    reconcile(input: BackgroundRecoveryInput): Promise<BackgroundRecoveryResult>;
  };
  getDetector: () => Pick<ForegroundDetectionController, 'getViewState' | 'observeOrientation' | 'initialize'> | null;
  captureTime: () => BackgroundTimestamp;
  onPendingChange: (pending: boolean) => void;
  onRecovered: (result: BackgroundRecoveryResult, detection: ForegroundDetectionViewState | undefined) => void;
  onError: (stage: 'begin' | 'reconcile') => void;
};

// Chỉ xử lý khi nhận AppState hoặc resume; không dựa vào JS timer tiếp tục chạy lúc iOS suspend.
export function createSessionLifecycleController(options: LifecycleOptions) {
  let state = options.initialState;
  let disposed = false;
  let generation = 0;
  const operations: { stage: 'begin' | 'reconcile'; run: () => Promise<void> }[] = [];
  let processing: Promise<void> | null = null;

  const drain = (): Promise<void> => {
    if (processing) return processing;
    if (disposed || operations.length === 0) return Promise.resolve();
    processing = (async () => {
      while (!disposed && operations.length > 0) {
        const operation = operations[0];
        try {
          await operation.run();
          operations.shift();
        } catch {
          if (!disposed) {
            // Giữ nguyên thao tác lỗi và timestamps; AppState kế tiếp retry trước các transition mới.
            options.onPendingChange(true);
            options.onError(operation.stage);
          }
          break;
        }
      }
    })().finally(() => { processing = null; });
    return processing;
  };

  const enqueue = (stage: 'begin' | 'reconcile', run: () => Promise<void>) => {
    operations.push({ stage, run });
    return drain();
  };

  const enqueueReconciliation = (observedAt: BackgroundTimestamp, expectedGeneration: number) => {
    const input = { ...options.session, observedAt };
    let result: BackgroundRecoveryResult | undefined;
    return enqueue('reconcile', async () => {
      // Nếu DB đã commit nhưng detector lỗi, giữ outcome để retry không mất cảnh báo NEEDS_REVIEW.
      result ??= await options.repository.reconcile(input);
      const detection = await options.getDetector()?.initialize();
      // Recovery cũ không được mở khóa khi app đã rời foreground lần nữa hoặc màn bị hủy.
      if (disposed || generation !== expectedGeneration || state !== 'active') return;
      options.onPendingChange(false);
      options.onRecovered(result, detection);
    });
  };

  return {
    handleChange(nextState: AppStateStatus): Promise<void> {
      if (disposed || nextState === state) return drain();
      return this.handleChangeAt(nextState, options.captureTime());
    },
    handleChangeAt(nextState: AppStateStatus, observedAt: BackgroundTimestamp): Promise<void> {
      if (disposed) return Promise.resolve();
      if (nextState === state) return drain();
      const wasActive = state === 'active';
      state = nextState;
      // inactive -> background trên iOS là cùng một lần rời foreground.
      if (!wasActive && nextState !== 'active') return drain();

      const currentGeneration = ++generation;
      const input = { ...options.session, observedAt };
      options.onPendingChange(true);

      if (wasActive) {
        return enqueue('begin', async () => {
          const detector = options.getDetector();
          if (!detector?.getViewState(observedAt.utcMs).isViolationActive) {
            await options.repository.begin(input);
            // Xóa grace chưa confirm để background candidate không ghi thêm cùng một lift.
            await detector?.observeOrientation('UNKNOWN', observedAt.utcMs);
          }
        });
      }

      // Cùng queue với begin: resume nhanh vẫn đợi candidate được lưu bền trước.
      return enqueueReconciliation(observedAt, currentGeneration);
    },
    reconcileCurrent(): Promise<void> {
      const observedAt = options.captureTime();
      const currentGeneration = ++generation;
      options.onPendingChange(true);
      return enqueueReconciliation(observedAt, currentGeneration);
    },
    dispose() {
      disposed = true;
      operations.length = 0;
    },
  };
}