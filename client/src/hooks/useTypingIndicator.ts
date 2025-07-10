import { useCallback, useEffect, useRef, useState } from "react";

interface UseTypingIndicatorProps {
  onTyping: (isTyping: boolean) => void;
  delay?: number;
}

const useTypingIndicator = ({
  onTyping,
  delay = 1000,
}: UseTypingIndicatorProps) => {
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const startTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout to stop typing
    timeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping(false);
    }, delay);
  }, [isTyping, onTyping, delay]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (isTyping) {
      setIsTyping(false);
      onTyping(false);
    }
  }, [isTyping, onTyping]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isTyping,
    startTyping,
    stopTyping,
  };
};

export default useTypingIndicator;
