import React from 'react';

interface SafeNumericDisplayProps {
  value: any;
  decimals?: number;
  fallback?: string | number;
  prefix?: string;
  suffix?: string;
}

const SafeNumericDisplay: React.FC<SafeNumericDisplayProps> = ({ 
  value, 
  decimals = 1, 
  fallback = 1, 
  prefix = '', 
  suffix = '' 
}) => {
  const safeValue = React.useMemo(() => {
    try {
      // Handle various input types safely
      let numericValue: number;
      
      if (value === null || value === undefined) {
        numericValue = typeof fallback === 'number' ? fallback : parseFloat(String(fallback)) || 1;
      } else if (typeof value === 'number') {
        numericValue = isNaN(value) ? (typeof fallback === 'number' ? fallback : 1) : value;
      } else if (typeof value === 'string') {
        const parsed = parseFloat(value);
        numericValue = isNaN(parsed) ? (typeof fallback === 'number' ? fallback : 1) : parsed;
      } else {
        // Try to convert to number
        const converted = Number(value);
        numericValue = isNaN(converted) ? (typeof fallback === 'number' ? fallback : 1) : converted;
      }
      
      // Ensure we have a valid number before calling toFixed
      if (typeof numericValue !== 'number' || isNaN(numericValue)) {
        numericValue = typeof fallback === 'number' ? fallback : 1;
      }
      
      return numericValue.toFixed(decimals);
    } catch (error) {
      console.warn('SafeNumericDisplay error:', error, 'value:', value);
      return typeof fallback === 'number' ? fallback.toFixed(decimals) : String(fallback);
    }
  }, [value, decimals, fallback]);

  return <>{prefix}{safeValue}{suffix}</>;
};

export default SafeNumericDisplay;