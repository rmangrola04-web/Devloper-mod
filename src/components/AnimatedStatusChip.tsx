import React from 'react';
import { CheckCircle2, Clock, RotateCcw, ArrowRightLeft, ShieldCheck, Check } from 'lucide-react';

export type OperationStatus = 
  | 'LOADED'
  | 'UNLOADED'
  | 'LOADING IN-PROGRESS'
  | 'UNLOADING IN-PROGRESS'
  | 'SHUTTLE TRANSIT'
  | 'COMPLETED'
  | 'DISPATCHED'
  | 'PENDING'
  | 'IN PLANT'
  | 'EXITED'
  | 'WAITING'
  | string;

interface AnimatedStatusChipProps {
  status: OperationStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
}

export const AnimatedStatusChip: React.FC<AnimatedStatusChipProps> = ({
  status = 'PENDING',
  size = 'md',
  className = '',
  showIcon = true
}) => {
  const normStatus = (status || '').toUpperCase().trim();

  // Determine variant configuration based on normalized status
  let variant: {
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    dotClass: string;
    icon: React.ReactNode;
    glowClass: string;
  };

  if (normStatus === 'LOADED' || normStatus === 'COMPLETED' || normStatus === 'DONE' || normStatus === 'FINISHED') {
    variant = {
      label: '✔ LOADED',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700 font-extrabold',
      borderClass: 'border-emerald-300',
      dotClass: 'bg-emerald-500 animate-ping',
      glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
    };
  } else if (normStatus === 'UNLOADED') {
    variant = {
      label: '✔ UNLOADED',
      bgClass: 'bg-blue-50',
      textClass: 'text-blue-700 font-extrabold',
      borderClass: 'border-blue-300',
      dotClass: 'bg-blue-500 animate-ping',
      glowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.25)]',
      icon: <Check className="w-3 h-3 text-blue-600 shrink-0" />
    };
  } else if (normStatus === 'LOADING IN-PROGRESS' || normStatus === 'LOADING') {
    variant = {
      label: '⏳ LOADING',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-800 font-bold',
      borderClass: 'border-amber-300',
      dotClass: 'bg-amber-500 animate-pulse',
      glowClass: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
      icon: <Clock className="w-3 h-3 text-amber-600 animate-spin shrink-0" />
    };
  } else if (normStatus === 'UNLOADING IN-PROGRESS' || normStatus === 'UNLOADING') {
    variant = {
      label: '⏳ UNLOADING',
      bgClass: 'bg-cyan-50',
      textClass: 'text-cyan-800 font-bold',
      borderClass: 'border-cyan-300',
      dotClass: 'bg-cyan-500 animate-pulse',
      glowClass: 'shadow-[0_0_12px_rgba(6,182,212,0.25)]',
      icon: <Clock className="w-3 h-3 text-cyan-600 animate-spin shrink-0" />
    };
  } else if (normStatus === 'SHUTTLE TRANSIT') {
    variant = {
      label: '🔄 SHUTTLE TRANSIT',
      bgClass: 'bg-purple-50',
      textClass: 'text-purple-800 font-bold',
      borderClass: 'border-purple-300',
      dotClass: 'bg-purple-500 animate-bounce',
      glowClass: 'shadow-[0_0_12px_rgba(168,85,247,0.25)]',
      icon: <RotateCcw className="w-3 h-3 text-purple-600 animate-spin shrink-0" />
    };
  } else if (normStatus === 'IN PLANT' || normStatus === 'GATE IN') {
    variant = {
      label: '🏢 IN PLANT',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-800 font-extrabold',
      borderClass: 'border-emerald-300',
      dotClass: 'bg-emerald-500 animate-pulse',
      glowClass: 'shadow-[0_0_10px_rgba(16,185,129,0.2)]',
      icon: <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
    };
  } else if (normStatus === 'EXITED' || normStatus === 'DISPATCHED') {
    variant = {
      label: '🚪 EXITED',
      bgClass: 'bg-slate-100',
      textClass: 'text-slate-700 font-bold',
      borderClass: 'border-slate-300',
      dotClass: 'bg-slate-400',
      glowClass: '',
      icon: <CheckCircle2 className="w-3 h-3 text-slate-500 shrink-0" />
    };
  } else if (normStatus === 'WAITING' || normStatus === 'PENDING') {
    variant = {
      label: '⏱ WAITING',
      bgClass: 'bg-amber-50/80',
      textClass: 'text-amber-700 font-semibold',
      borderClass: 'border-amber-200',
      dotClass: 'bg-amber-400 animate-pulse',
      glowClass: '',
      icon: <Clock className="w-3 h-3 text-amber-500 shrink-0" />
    };
  } else {
    variant = {
      label: normStatus,
      bgClass: 'bg-slate-100',
      textClass: 'text-slate-700 font-semibold',
      borderClass: 'border-slate-300',
      dotClass: 'bg-slate-400',
      glowClass: '',
      icon: null
    };
  }

  // Size sizing classes
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[9px] gap-1',
    md: 'px-2 py-0.5 text-[10px] gap-1.5',
    lg: 'px-2.5 py-1 text-[11px] gap-2'
  }[size];

  return (
    <span
      key={normStatus}
      className={`inline-flex items-center rounded-md border tracking-wider uppercase backdrop-blur-xs transition-all duration-200 hover:scale-[1.02] ${variant.bgClass} ${variant.textClass} ${variant.borderClass} ${variant.glowClass} ${sizeClasses} ${className}`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${variant.dotClass}`} />
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${variant.dotClass.replace('animate-ping', '').replace('animate-pulse', '').replace('animate-bounce', '')}`} />
      </span>

      {showIcon && variant.icon}

      <span className="truncate">{variant.label}</span>
    </span>
  );
};
