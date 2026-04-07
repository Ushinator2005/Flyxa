interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-7 h-7 border-2',
  lg: 'w-12 h-12 border-3',
};

export default function LoadingSpinner({ size = 'md', label }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizeMap[size]} rounded-full border-slate-700 border-t-blue-500 animate-spin`}
        style={{ borderWidth: size === 'lg' ? 3 : 2 }}
      />
      {label && <p className="text-slate-400 text-sm">{label}</p>}
    </div>
  );
}
