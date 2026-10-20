import React, { useMemo, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SearchableOption {
  label: string;
  value: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: (string | SearchableOption)[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Clean native <select> component with enhanced type-to-select support.
 * - No custom search bars or popup inputs (eliminates re-render bugs and master data wipe).
 * - Full native keyboard typing: typing letters jumps directly to matching options.
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Select Option --',
  className = '',
  disabled = false,
  required = false
}) => {
  const normalizedOptions: SearchableOption[] = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') {
        return { label: opt, value: opt };
      }
      return opt;
    });
  }, [options]);

  const searchBufferRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    // Only capture single printable characters (letters, numbers, space)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      searchBufferRef.current += e.key.toLowerCase();
      const currentQuery = searchBufferRef.current.trim();

      if (currentQuery) {
        // First look for prefix match (starts with typed string)
        let match = normalizedOptions.find(opt =>
          opt.label.toLowerCase().startsWith(currentQuery)
        );

        // If no prefix match, look for substring match
        if (!match) {
          match = normalizedOptions.find(opt =>
            opt.label.toLowerCase().includes(currentQuery)
          );
        }

        if (match) {
          onChange(match.value);
        }
      }

      // Reset buffer after 800ms of inactivity
      timeoutRef.current = setTimeout(() => {
        searchBufferRef.current = '';
      }, 800);
    } else if (e.key === 'Backspace') {
      if (searchBufferRef.current.length > 0) {
        searchBufferRef.current = searchBufferRef.current.slice(0, -1);
      }
    } else if (e.key === 'Escape') {
      searchBufferRef.current = '';
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        required={required}
        className={`w-full bg-white border rounded-xl pl-3.5 pr-9 py-2.5 text-xs font-bold text-slate-900 transition outline-none cursor-pointer appearance-none ${
          disabled 
            ? 'bg-slate-100 opacity-60 cursor-not-allowed border-slate-200 text-slate-400' 
            : 'border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
        }`}
      >
        <option value="" disabled className="text-slate-400 font-normal">
          {placeholder}
        </option>
        {normalizedOptions.map((opt, idx) => (
          <option key={idx} value={opt.value} className="text-slate-900 font-semibold py-1">
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
        <ChevronDown className="w-4 h-4" />
      </div>
    </div>
  );
};
