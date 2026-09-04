import React from 'react';
import { getFrame } from '../utils/profileFrames';

/**
 * Bungkus avatar (children, biasanya <img>) dengan ring/glow sesuai frame yang dipilih.
 * `className` menentukan ukuran (mis. "w-28 h-28 md:w-36 md:h-36"), `rounded` menentukan
 * bentuk sudut — default rounded-2xl, mengikuti gaya avatar yang sudah dipakai di seluruh app.
 * Frame 'rainbow' pakai trik gradient-padding karena butuh multi-warna (ring-* cuma 1 warna).
 */
const AvatarFrame = ({ frameId = 'none', className = 'w-28 h-28', rounded = 'rounded-2xl', children }) => {
  const frame = getFrame(frameId);

  if (frame.isGradient) {
    return (
      <div className={`relative ${className} ${rounded} p-[3px] ${frame.gradient} ${frame.glow}`}>
        <div className={`w-full h-full ${rounded} overflow-hidden bg-[#0b0b10]`}>{children}</div>
      </div>
    );
  }

  return (
    <div className={`relative ${className} ${rounded} overflow-hidden ${frame.ring} ${frame.glow}`}>
      {children}
    </div>
  );
};

export default AvatarFrame;
