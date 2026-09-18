import React, { useState } from 'react';

interface HardwareDiagnosticsScreenProps {
  showToast: (msg: string) => void;
}

export function HardwareDiagnosticsScreen({
  showToast,
}: HardwareDiagnosticsScreenProps): React.ReactElement {
  const [diagStep, setDiagStep] = useState<'idle' | 'testing' | 'calibrated'>('idle');
  const [accelStatus, setAccelStatus] = useState<string>('OK');
  const [gyroStatus, setGyroStatus] = useState<string>('OK');
  const [luxStatus, setLuxStatus] = useState<string>('STANDBY');

  const handleCalibrate = () => {
    setDiagStep('testing');
    showToast('Sampling motion sensors at 50Hz...');
    setTimeout(() => {
      setDiagStep('calibrated');
      setAccelStatus('OK');
      setGyroStatus('OK');
      setLuxStatus('ACTIVE');
      showToast('✅ All sensors calibrated & operating within nominal parameters.');
    }, 1200);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-1">
        <div className="flex items-center justify-between">
          <span className="acrylic-pill px-2.5 py-0.5 rounded-full text-[10px] font-bold text-blue-700">
            Diagnostics Mode
          </span>
          <span className="font-mono text-xs text-[#64748b]">ERR_SENS_0x4F</span>
        </div>
        <h2 className="text-xl font-extrabold text-[#0F172A] tracking-tight">
          Sensor Diagnostic & Tabletop Leveling
        </h2>
      </div>

      <div className="acrylic-card p-5 flex flex-col items-center text-center space-y-2">
        <div className="w-16 h-16 rounded-full acrylic-pill flex items-center justify-center text-blue-600 shadow-sm">
          <span className="material-symbols-outlined text-[32px]">screen_rotation</span>
        </div>
        <h3 className="text-base font-extrabold text-[#0F172A]">Motion Sensor Telemetry</h3>
        <p className="text-xs text-[#475569] max-w-sm font-medium leading-relaxed">
          DontLift requires continuous accelerometer and 50Hz gyroscope telemetry to detect when your phone is placed face-down on flat tables.
        </p>
      </div>

      <div className="acrylic-card p-4 space-y-2.5">
        <div className="flex items-center justify-between pb-1 border-b border-white/60 text-xs">
          <span className="font-bold uppercase tracking-wider text-[#64748b]">Subsystem Telemetry</span>
          <span className="font-mono font-bold text-blue-600">3 Monitors Active</span>
        </div>

        <div className="acrylic-pill p-3 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">speed</span>
            </div>
            <div>
              <span className="font-bold text-[#0F172A] block">3-Axis Accelerometer</span>
              <span className="text-[10px] text-[#64748b]">Sampling Rate: 50Hz</span>
            </div>
          </div>
          <span id="diag-status-accel" className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
            {accelStatus}
          </span>
        </div>

        <div className="acrylic-pill p-3 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">screen_rotation</span>
            </div>
            <div>
              <span className="font-bold text-[#0F172A] block">50Hz Precision Gyroscope</span>
              <span className="text-[10px] text-[#64748b]">Yaw, pitch, roll tracking</span>
            </div>
          </div>
          <span id="diag-status-gyro" className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
            {gyroStatus}
          </span>
        </div>

        <div className="acrylic-pill p-3 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px]">lightbulb</span>
            </div>
            <div>
              <span className="font-bold text-[#0F172A] block">Ambient Lux Photocell</span>
              <span className="text-[10px] text-[#64748b]">Tabletop screen-down check</span>
            </div>
          </div>
          <span id="diag-status-lux" className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
            {luxStatus}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <button
          id="btn-calibrate-sensors"
          onClick={handleCalibrate}
          className="w-full h-12 rounded-full btn-primary font-bold text-xs flex items-center justify-center gap-2 shadow-md"
        >
          <span className="material-symbols-outlined text-[18px]">
            {diagStep === 'testing' ? 'progress_activity' : 'tune'}
          </span>
          <span>{diagStep === 'testing' ? 'Calibrating Sensors...' : 'Run Tabletop Sensor Calibration'}</span>
        </button>
      </div>
    </div>
  );
}
