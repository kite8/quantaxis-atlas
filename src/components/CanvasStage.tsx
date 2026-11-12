import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Expand, Maximize2, RotateCcw, Smartphone, X } from 'lucide-react';
import './canvas-stage.css';

export type CanvasLayout = 'horizontal' | 'vertical';
type OrientationChoice = 'landscape' | 'portrait';
type LockableOrientation = ScreenOrientation & { lock?: (orientation: OrientationChoice) => Promise<void> };
interface CanvasStageProps {
  children: ReactNode;
  layout: CanvasLayout;
  onLayoutChange: (layout: CanvasLayout) => void;
  detailOpen: boolean;
}
interface StageSession { id: string; path: string; hash: string }
const HISTORY_KEY = '__quantaxisCanvasStage';
const FALLBACK_MESSAGE = '浏览器未允许自动转屏；可旋转手机，或使用上方图谱排列。';
function stageMarker(state: unknown): string | undefined {
  return state && typeof state === 'object' ? (state as Record<string, unknown>)[HISTORY_KEY] as string | undefined : undefined;
}

export function CanvasStage({ children, layout, onLayoutChange, detailOpen }: CanvasStageProps) {
  const labelId = useId();
  const [focused, setFocused] = useState(false);
  const [locked, setLocked] = useState<OrientationChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const focusedRef = useRef(false);
  const detailRef = useRef(detailOpen);
  const operation = useRef(0);
  const ownFullscreen = useRef(false);
  const ownOrientation = useRef(false);
  const session = useRef<StageSession | null>(null);
  const closing = useRef(false);
  const restoreHash = useRef<string | null>(null);
  const closeRef = useRef<() => void>(() => {});
  detailRef.current = detailOpen;

  const releaseNative = () => {
    if (ownOrientation.current) {
      ownOrientation.current = false;
      try { screen.orientation?.unlock(); } catch { /* Browser may have released the lock already. */ }
    }
    if (ownFullscreen.current) {
      ownFullscreen.current = false;
      if (document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => {});
    }
  };
  const finishClose = () => {
    operation.current += 1;
    focusedRef.current = false;
    closing.current = false;
    releaseNative();
    setFocused(false);
    setLocked(null);
    setBusy(false);
    setNotice('');
  };
  const close = () => {
    if (!focusedRef.current || closing.current) return;
    const entry = session.current;
    if (entry && stageMarker(window.history.state) === entry.id) {
      closing.current = true;
      restoreHash.current = window.location.hash;
      window.history.back();
    } else {
      session.current = null;
      finishClose();
    }
  };
  closeRef.current = close;

  const enter = () => {
    if (focusedRef.current || closing.current) return;
    focusedRef.current = true;
    const entry = { id: `${labelId}-${Date.now()}`, path: window.location.pathname + window.location.search, hash: window.location.hash };
    try {
      const previous = window.history.state;
      window.history.pushState({ ...(previous && typeof previous === 'object' ? previous : {}), [HISTORY_KEY]: entry.id }, '', window.location.href);
      session.current = entry;
    } catch { session.current = null; }
    setFocused(true);
    setNotice('');
  };

  // Run after parent passive effects have synchronized the selected node into the URL.
  // This retains the current reading position when Back removes only the stage entry.
  useEffect(() => {
    queueMicrotask(() => {
      const entry = session.current;
      if (entry && focusedRef.current && !closing.current && stageMarker(window.history.state) === entry.id) entry.hash = window.location.hash;
    });
  });

  useEffect(() => {
    const pop = () => {
      const entry = session.current;
      if (!entry || stageMarker(window.history.state) === entry.id) return;
      session.current = null;
      const samePage = window.location.pathname + window.location.search === entry.path;
      if (samePage) {
        const nextHash = restoreHash.current ?? entry.hash;
        const oldURL = window.location.href;
        window.history.replaceState(window.history.state, '', entry.path + nextHash);
        // The app reads the current URL, so both this event and a pending native
        // hashchange resolve to the retained node instead of the old entry's node.
        if (oldURL !== window.location.href) window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: window.location.href }));
      }
      restoreHash.current = null;
      finishClose();
    };
    const fullscreenChanged = () => {
      if (ownFullscreen.current && document.fullscreenElement !== document.documentElement) {
        ownFullscreen.current = false;
        if (focusedRef.current) closeRef.current();
      }
    };
    window.addEventListener('popstate', pop);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      window.removeEventListener('popstate', pop);
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      focusedRef.current = false;
      operation.current += 1;
      releaseNative();
      const entry = session.current;
      if (entry && stageMarker(window.history.state) === entry.id) {
        const cleanState = { ...window.history.state };
        delete cleanState[HISTORY_KEY];
        window.history.replaceState(cleanState, '', window.location.href);
      }
    };
  }, []);

  useEffect(() => {
    if (!focused) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const scrollX = window.scrollX, scrollY = window.scrollY;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    exitButton.current?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (detailRef.current) return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(host.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !host.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !host.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      document.removeEventListener('keydown', key);
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
      if (!detailRef.current) (previousFocus?.isConnected ? previousFocus : enterButton.current)?.focus({ preventScroll: true });
    };
  }, [focused]);

  const orient = async (choice: OrientationChoice) => {
    onLayoutChange(choice === 'landscape' ? 'horizontal' : 'vertical');
    if (!focusedRef.current || busy) return;
    const token = ++operation.current;
    setBusy(true); setNotice('');
    const orientation = screen.orientation as LockableOrientation | undefined;
    try {
      if (!orientation?.lock) throw new Error('Orientation lock unavailable');
      if (!document.fullscreenElement) {
        if (!document.documentElement.requestFullscreen) throw new Error('Fullscreen unavailable');
        await document.documentElement.requestFullscreen();
        if (token !== operation.current || !focusedRef.current || closing.current) {
          if (document.fullscreenElement === document.documentElement) await document.exitFullscreen().catch(() => {});
          return;
        }
        ownFullscreen.current = true;
      }
      await orientation.lock(choice);
      if (token !== operation.current || !focusedRef.current || closing.current) {
        try { orientation.unlock(); } catch { /* No active lock. */ }
        return;
      }
      ownOrientation.current = true;
      setLocked(choice);
      setNotice(choice === 'landscape' ? '已锁定横屏方向。' : '已锁定竖屏方向。');
    } catch {
      if (token === operation.current && focusedRef.current && !closing.current) setNotice(FALLBACK_MESSAGE);
    } finally {
      if (token === operation.current && focusedRef.current) setBusy(false);
    }
  };
  const automatic = () => {
    if (busy) return;
    if (ownOrientation.current) {
      ownOrientation.current = false;
      try { screen.orientation?.unlock(); } catch { /* Already unlocked. */ }
    }
    setLocked(null);
    setNotice('屏幕方向跟随设备设置，可旋转手机查看。');
  };

  return <div ref={host} className={`canvas-stage${focused ? ' canvas-stage-focused' : ''}`} role={focused ? 'dialog' : undefined} aria-modal={focused && !detailOpen ? true : undefined} aria-labelledby={focused ? labelId : undefined}>
    <div className="canvas-stage-toolbar"><span id={labelId} className="canvas-stage-title">{focused ? <><Maximize2 size={17} aria-hidden="true"/>专注画布</> : '图谱排列'}</span><div className="canvas-stage-layout" role="group" aria-label="图谱排列"><button type="button" aria-pressed={layout === 'horizontal'} onClick={() => onLayoutChange('horizontal')}>横向</button><button type="button" aria-pressed={layout === 'vertical'} onClick={() => onLayoutChange('vertical')}>纵向</button></div>{focused ? <button ref={exitButton} type="button" className="canvas-stage-exit" onClick={close}><X size={18} aria-hidden="true"/>退出</button> : <button ref={enterButton} type="button" className="canvas-stage-enter" onClick={enter}><Expand size={18} aria-hidden="true"/>专注画布</button>}</div>
    {focused && <div className="canvas-stage-orientation"><span><Smartphone size={16} aria-hidden="true"/>屏幕方向</span><div role="group" aria-label="屏幕方向"><button type="button" disabled={busy} aria-pressed={locked === null} onClick={automatic}><RotateCcw size={14} aria-hidden="true"/>自动</button><button type="button" disabled={busy} aria-pressed={locked === 'landscape'} onClick={() => void orient('landscape')}>横屏</button><button type="button" disabled={busy} aria-pressed={locked === 'portrait'} onClick={() => void orient('portrait')}>竖屏</button></div><p role="status" aria-live="polite">{busy ? '正在请求屏幕方向…' : notice || '屏幕方向由浏览器与设备设置决定。'}</p></div>}
    <div className="canvas-stage-content">{children}</div>
  </div>;
}
