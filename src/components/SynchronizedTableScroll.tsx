import React, { useRef, useEffect } from 'react';

interface SynchronizedTableScrollProps {
  children: React.ReactNode;
  className?: string;
  height?: string;
}

export const SynchronizedTableScroll: React.FC<SynchronizedTableScrollProps> = ({
  children,
  className = '',
  height
}) => {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainTableRef = useRef<HTMLDivElement>(null);
  const dummyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const topScroll = topScrollRef.current;
    const mainTable = mainTableRef.current;
    const dummy = dummyRef.current;
    if (!topScroll || !mainTable || !dummy) return;

    const updateDummyWidth = () => {
      dummy.style.width = mainTable.scrollWidth + 'px';
    };

    updateDummyWidth();

    const handleResize = () => {
      updateDummyWidth();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('load', updateDummyWidth);

    const handleTopScroll = () => {
      if (mainTable.scrollLeft !== topScroll.scrollLeft) {
        mainTable.scrollLeft = topScroll.scrollLeft;
      }
    };

    const handleMainScroll = () => {
      if (topScroll.scrollLeft !== mainTable.scrollLeft) {
        topScroll.scrollLeft = mainTable.scrollLeft;
      }
    };

    topScroll.addEventListener('scroll', handleTopScroll);
    mainTable.addEventListener('scroll', handleMainScroll);

    const resizeObserver = new ResizeObserver(() => {
      updateDummyWidth();
    });
    resizeObserver.observe(mainTable);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('load', updateDummyWidth);
      if (topScroll) topScroll.removeEventListener('scroll', handleTopScroll);
      if (mainTable) mainTable.removeEventListener('scroll', handleMainScroll);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={`w-full flex flex-col ${className}`}>
      {/* Top Scrollbar Wrapper */}
      <div 
        ref={topScrollRef} 
        id="top-scroll-wrapper"
        className="overflow-x-auto overflow-y-hidden h-4 w-full mb-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div ref={dummyRef} id="top-scroll-dummy" className="h-4"></div>
      </div>

      {/* Main Table Container */}
      <div 
        ref={mainTableRef}
        id="main-table-container"
        className={`overflow-x-auto w-full ${height ? height : ''}`}
      >
        {children}
      </div>
    </div>
  );
};
