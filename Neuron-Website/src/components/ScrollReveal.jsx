import { useEffect, useRef, useState } from 'react';

/**
 * ScrollReveal: Glides elements up and smoothly fades them in upon scrolling into view.
 */
export function ScrollReveal({ children, className = '', delay = 0, threshold = 0.12 }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-7'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * ScrollWriteHeading: High-performance scroll-triggered typewriter write animation for headings.
 * Types characters sequentially with an electric blue cursor as the user scrolls to it.
 */
export function ScrollWriteHeading({
  text,
  as: Component = 'h2',
  className = '',
  speed = 28,
  delay = 80,
  style = {}
}) {
  const ref = useRef(null);
  const [displayedText, setDisplayedText] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsStarted(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -30px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isStarted) return;

    let charIndex = 0;
    const timeoutId = setTimeout(() => {
      const intervalId = setInterval(() => {
        charIndex++;
        if (charIndex <= text.length) {
          setDisplayedText(text.slice(0, charIndex));
        } else {
          clearInterval(intervalId);
          setIsFinished(true);
        }
      }, speed);

      return () => clearInterval(intervalId);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [isStarted, text, speed, delay]);

  return (
    <Component
      ref={ref}
      style={style}
      className={`transition-all duration-500 ${
        isStarted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
      } ${className}`}
    >
      <span>{displayedText}</span>
      {!isFinished && isStarted && (
        <span className="inline-block w-[3px] h-[0.85em] ml-1.5 bg-[#60A5FA] animate-pulse align-middle rounded-sm shadow-[0_0_8px_#60A5FA]" />
      )}
    </Component>
  );
}
