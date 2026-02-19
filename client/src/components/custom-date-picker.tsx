import { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from '@untitledui/icons';

interface CustomDatePickerProps {
  value: string | null; // YYYY-MM-DD format
  onChange: (date: string) => void;
  minYear?: number;
  maxYear?: number;
  label?: string;
  error?: boolean;
  errorMessage?: string;
  variant?: 'dark' | 'light';
}

export const CustomDatePicker = ({
  value,
  onChange,
  minYear = new Date().getFullYear() - 300,
  maxYear = new Date().getFullYear(),
  label,
  error = false,
  errorMessage,
  variant = 'dark',
}: CustomDatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState<number>(maxYear);
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<{ year: number; month: number; day: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial value - support multiple formats
  useEffect(() => {
    if (value && value.trim()) {
      // Try YYYY-MM-DD format first (e.g., "2024-03-15")
      if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = value.split('-').map(Number);
        if (year && month && day) {
          // Validate date is real (e.g., not 2024-02-30)
          const testDate = new Date(year, month - 1, day);
          if (testDate.getDate() === day && testDate.getMonth() === month - 1 && testDate.getFullYear() === year) {
            setSelectedDate({ year, month, day });
            setViewYear(year);
            setViewMonth(month);
            return;
          } else {
          }
        }
      }
      
      // Try "Month DD, YYYY" format (e.g., "March 15, 2024", "January 01, 2025")
      const monthNameMatch = value.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
      if (monthNameMatch) {
        const monthName = monthNameMatch[1];
        const day = parseInt(monthNameMatch[2], 10);
        const year = parseInt(monthNameMatch[3], 10);
        const monthObj = months.find(m => m.label.toLowerCase() === monthName.toLowerCase());
        if (monthObj && day && year) {
          // Validate this is a real date (e.g., not February 30)
          const testDate = new Date(year, monthObj.value - 1, day);
          if (testDate.getDate() === day && testDate.getMonth() === monthObj.value - 1 && testDate.getFullYear() === year) {
            setSelectedDate({ year, month: monthObj.value, day });
            setViewYear(year);
            setViewMonth(monthObj.value);
            return;
          } else {
          }
        }
      }
      
      // Try parsing as a Date object (handles many other formats)
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = parsed.getMonth() + 1;
        const day = parsed.getDate();
        
        // Validate parsed date is reasonable (year between 1900-2100)
        if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          setSelectedDate({ year, month, day });
          setViewYear(year);
          setViewMonth(month);
          return;
        } else {
        }
      }
      
      // If no valid date found, clear selection
      setSelectedDate(null);
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate years array (descending order - newest first)
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  // Generate months array
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  // Get days in month and first day of week
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfWeek = getFirstDayOfMonth(viewYear, viewMonth);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleDayClick = (day: number) => {
    // Validate date is real (e.g., not Feb 30)
    const testDate = new Date(viewYear, viewMonth - 1, day);
    if (testDate.getDate() !== day || testDate.getMonth() !== viewMonth - 1 || testDate.getFullYear() !== viewYear) {
      console.error('[CustomDatePicker] Invalid date selected:', { year: viewYear, month: viewMonth, day });
      return;
    }
    
    const dateString = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate({ year: viewYear, month: viewMonth, day });
    onChange(dateString);
    setIsOpen(false);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewYear(Number(e.target.value));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewMonth(Number(e.target.value));
  };

  const goToPreviousMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const formatDisplayDate = () => {
    if (!selectedDate) return 'Select date';
    const monthName = months.find(m => m.value === selectedDate.month)?.label || '';
    return `${monthName} ${String(selectedDate.day).padStart(2, '0')}, ${selectedDate.year}`;
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className={`mb-1.5 block text-xs sm:text-sm font-medium ${variant === 'light' ? 'text-gray-700' : 'text-tertiary'}`}>
          {label}
        </label>
      )}
      
      {/* Input Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex gap-2 items-center px-3 py-2 border rounded-lg transition-colors text-left ${
          error ? 'border-error-secondary ring-2 ring-error-secondary' : 'border-primary hover:border-secondary focus:border-brand-solid focus:ring-1 focus:ring-brand-solid'
        }`}
      >
        <CalendarIcon className="w-4 h-4 text-gray-500 shrink-0" />
        <span className={`flex-1 text-sm ${selectedDate ? (variant === 'light' ? 'text-gray-900' : 'text-primary') : (variant === 'light' ? 'text-gray-400' : 'text-quaternary')}`}>
          {formatDisplayDate()}
        </span>
      </button>

      {/* Calendar Popup */}
      {isOpen && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl w-72 p-3">
          {/* Month/Year Selectors */}
          <div className="flex items-center gap-1 mb-3">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={viewMonth}
              onChange={handleMonthChange}
              className="flex-1 px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>

            <select
              value={viewYear}
              onChange={handleYearChange}
              className="px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={goToNextMonth}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of week */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div key={day} className="text-center text-[10px] font-medium text-gray-500 py-0.5">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {/* Empty cells for days before first of month */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            
            {/* Days */}
            {daysArray.map((day) => {
              const isSelected = selectedDate?.year === viewYear && 
                                selectedDate?.month === viewMonth && 
                                selectedDate?.day === day;
              
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`
                    h-7 w-7 flex items-center justify-center text-xs rounded transition-colors
                    ${isSelected 
                      ? 'bg-blue-600 text-white font-semibold' 
                      : 'hover:bg-gray-100 text-gray-900'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && errorMessage && (
        <p className="mt-1.5 text-xs text-error-primary">{errorMessage}</p>
      )}
    </div>
  );
};
