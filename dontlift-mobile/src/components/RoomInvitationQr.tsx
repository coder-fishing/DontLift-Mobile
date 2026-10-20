import React, { useMemo } from 'react';
import { Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { toQR } from 'toqr';
import { Colors } from '../constants/theme';

export function RoomInvitationQr({ value, size = 200 }: { value: string; size?: number }) {
  const result = useMemo(() => {
    try {
      // URI contract chỉ chứa ASCII; truyền bytes trực tiếp để không phụ thuộc TextEncoder của Hermes.
      const matrix = toQR(Uint8Array.from(value, character => character.charCodeAt(0)));
      const dimension = Math.sqrt(matrix.length);
      if (!Number.isInteger(dimension)) return null;
      const runs: string[] = [];
      for (let y = 0; y < dimension; y += 1) {
        for (let x = 0; x < dimension; x += 1) {
          if (matrix[y * dimension + x] === 1) runs.push(`M${x} ${y}h1v1h-1z`);
        }
      }
      return { dimension, path: runs.join('') };
    } catch {
      return null;
    }
  }, [value]);

  if (!result) return <Text accessibilityRole="alert">Không tạo được mã QR. Dùng đường dẫn lời mời hiển thị bên dưới.</Text>;

  return (
    <Svg width={size} height={size} viewBox={`-4 -4 ${result.dimension + 8} ${result.dimension + 8}`} accessibilityLabel="Room invitation QR code">
      <Path d={`M-4 -4h${result.dimension + 8}v${result.dimension + 8}H-4z`} fill={Colors.light.qrBackground} />
      <Path d={result.path} fill={Colors.light.qrForeground} />
    </Svg>
  );
}
