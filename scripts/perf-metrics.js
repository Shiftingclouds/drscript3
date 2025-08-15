(function(){
  let cls = 0;
  let tbt = 0;

  if ('PerformanceObserver' in window) {
    try {
      const clsObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        }
      });
      clsObserver.observe({type: 'layout-shift', buffered: true});

      const tbtObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const blocking = entry.duration - 50;
          if (blocking > 0) {
            tbt += blocking;
          }
        }
      });
      tbtObserver.observe({type: 'longtask', buffered: true});

      window.addEventListener('load', () => {
        setTimeout(() => {
          console.log('CLS:', cls);
          if (cls > 0.02) {
            console.warn('Cumulative Layout Shift above threshold:', cls);
          }
          console.log('TBT:', tbt);
        }, 0);
      });
    } catch (e) {
      console.warn('PerformanceObserver not supported', e);
    }
  }
})();
