import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ImageSourcePropType } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ReceiptScanResult } from './receipt-scan-api';

type Options = {
  roomId: string;
  confirmedEvidencePath?: string;
  onScanReceipt?: (roomId: string, uri: string, mimeType: string) => Promise<ReceiptScanResult>;
  onUploadReceiptEvidence?: (roomId: string, uri: string, mimeType: string) => Promise<string>;
  onDeleteReceiptEvidence?: (roomId: string, path: string) => Promise<void>;
  getReceiptEvidenceImageSource?: (roomId: string, path: string) => Promise<ImageSourcePropType>;
  setBillInput: Dispatch<SetStateAction<string>>;
  setSubmitted: Dispatch<SetStateAction<boolean>>;
};

export function useReceiptEvidence({
  roomId,
  confirmedEvidencePath,
  onScanReceipt,
  onUploadReceiptEvidence,
  onDeleteReceiptEvidence,
  getReceiptEvidenceImageSource,
  setBillInput,
  setSubmitted,
}: Options) {
  const [isScanning, setIsScanning] = useState(false);
  const [previewUri, setPreviewUri] = useState<string>();
  const [previewMimeType, setPreviewMimeType] = useState<string>();
  const [evidencePath, setEvidencePath] = useState<string>();
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string>();
  const [imageSource, setImageSource] = useState<ImageSourcePropType>();
  const [imageError, setImageError] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [scanError, setScanError] = useState<string>();
  const scanBusy = useRef(false);

  useEffect(() => {
    let active = true;
    setImageSource(undefined);
    setImageError(false);
    if (!confirmedEvidencePath || !getReceiptEvidenceImageSource) return () => { active = false; };
    void getReceiptEvidenceImageSource(roomId, confirmedEvidencePath).then(source => {
      if (active) setImageSource(source);
    }).catch(() => {
      if (active) setImageError(true);
    });
    return () => { active = false; };
  }, [roomId, confirmedEvidencePath, getReceiptEvidenceImageSource]);

  const deleteEvidence = (path: string) => {
    void onDeleteReceiptEvidence?.(roomId, path).catch(() => undefined);
  };

  const scanAsset = async (asset: ImagePicker.ImagePickerAsset | undefined) => {
    if (!asset || scanBusy.current) return;
    const extension = asset.fileName?.split('.').pop()?.toLowerCase();
    const mimeType = asset.mimeType ?? (extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp'
      : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : undefined);
    if (!mimeType || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      setScanError('This photo format is not supported. Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (asset.fileSize != null && asset.fileSize > 10 * 1024 * 1024) {
      setScanError('Choose an image smaller than 10 MB.');
      return;
    }
    if (evidencePath) deleteEvidence(evidencePath);
    setEvidencePath(undefined);
    setEvidenceError(undefined);
    scanBusy.current = true;
    setPreviewUri(asset.uri);
    setPreviewMimeType(mimeType);
    setIsScanning(true);
    setScanError(undefined);
    setScanResult(null);
    try {
      if (!onScanReceipt) throw new Error('Receipt scanning is not available. Enter the amount manually.');
      setScanResult(await onScanReceipt(roomId, asset.uri, mimeType));
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not scan this receipt. Enter the amount manually.');
    } finally {
      scanBusy.current = false;
      setIsScanning(false);
    }
  };

  const captureReceipt = async () => {
    setScanError(undefined);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setScanError('Allow camera access in Settings to take a receipt photo. You can also choose a photo.');
        return;
      }
      const picked = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (!picked.canceled) await scanAsset(picked.assets?.[0]);
    } catch {
      setScanError('Could not open the camera. Check camera access or choose a photo instead.');
    }
  };

  const selectReceipt = async () => {
    setScanError(undefined);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (!picked.canceled) await scanAsset(picked.assets?.[0]);
    } catch {
      setScanError('Could not open your photo library. Check photo access and retry.');
    }
  };

  const acceptAmount = async (amount: number) => {
    if (!previewUri || !previewMimeType) {
      setEvidenceError('The receipt image is no longer available. Select it again to save evidence.');
      return;
    }
    setIsSavingEvidence(true);
    setEvidenceError(undefined);
    try {
      if (!onUploadReceiptEvidence) throw new Error('Receipt evidence storage is not configured.');
      const path = await onUploadReceiptEvidence(roomId, previewUri, previewMimeType);
      setEvidencePath(path);
      setBillInput(String(amount));
      setSubmitted(false);
      setScanResult(null);
      setPreviewUri(undefined);
      setPreviewMimeType(undefined);
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : 'Could not save receipt evidence. Retry or continue without evidence.');
    } finally {
      setIsSavingEvidence(false);
    }
  };

  const continueWithoutEvidence = () => {
    setBillInput(String(scanResult?.suggested_amount ?? scanResult?.amount ?? ''));
    setSubmitted(false);
    setScanResult(null);
    setPreviewUri(undefined);
    setPreviewMimeType(undefined);
    setEvidenceError(undefined);
  };

  const rejectReceipt = () => {
    if (evidencePath) deleteEvidence(evidencePath);
    setEvidencePath(undefined);
    setEvidenceError(undefined);
    setScanResult(null);
    setPreviewUri(undefined);
    setPreviewMimeType(undefined);
  };

  return {
    isScanning,
    previewUri,
    evidencePath,
    isSavingEvidence,
    evidenceError,
    imageSource,
    imageError,
    scanResult,
    scanError,
    captureReceipt,
    selectReceipt,
    acceptAmount,
    continueWithoutEvidence,
    rejectReceipt,
    deleteEvidence,
  };
}
